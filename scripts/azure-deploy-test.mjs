import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { load } from "js-yaml";

const workflow = load(
  readFileSync(
    new URL("../.github/workflows/azure-deploy.yml", import.meta.url),
    "utf8",
  ),
);
const steps = workflow.jobs.deploy.steps;
const validationIndex = steps.findIndex(
  (step) => step.name === "Verify deployment configuration",
);
const environment = {
  ...Object.fromEntries(
    Object.keys(workflow.jobs.deploy.env).map((key) => [key, "test"]),
  ),
  LOCATION: "eastus2",
  POSTGREST_SOURCE_IMAGE: `docker.io/postgrest/postgrest@sha256:${"a".repeat(64)}`,
};

test("dispatch requires only ceiling acknowledgement and change reason", () => {
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs).sort(), [
    "approved_public_retail_ceiling_usd",
    "change_reason",
  ]);
  const costStep = workflow.jobs.validate.steps.find(
    (step) => step.name === "Verify cost acknowledgement",
  );
  assert.deepEqual(costStep.env, {
    APPROVED_CEILING: "${{ inputs.approved_public_retail_ceiling_usd }}",
  });
  assert.doesNotMatch(
    JSON.stringify(workflow),
    /verified_monthly_estimate_usd|VERIFIED_ESTIMATE/,
  );
  for (const ceiling of ["209.51", "", "209.50", "210", "invalid"]) {
    const result = spawnSync("bash", ["-c", costStep.run], {
      env: { APPROVED_CEILING: ceiling },
      encoding: "utf8",
    });
    assert.equal(result.status, ceiling === "209.51" ? 0 : 1, result.stderr);
    if (ceiling !== "209.51") {
      assert.match(
        result.stderr,
        /ceiling must be acknowledged exactly as 209.51/,
      );
    }
  }
});

test("dispatch defaults pass the cost gate and preserve protected deployment", () => {
  const inputs = workflow.on.workflow_dispatch.inputs;
  assert.equal(inputs.approved_public_retail_ceiling_usd.default, "209.51");
  assert.equal(
    inputs.change_reason.default,
    "Deploy the selected revision to production.",
  );
  for (const input of Object.values(inputs)) {
    assert.equal(input.type, "string");
    assert.equal(input.required, true);
    assert.ok(input.default.trim());
  }
  const costStep = workflow.jobs.validate.steps.find(
    (step) => step.name === "Verify cost acknowledgement",
  );
  const result = spawnSync("bash", ["-c", costStep.run], {
    env: {
      APPROVED_CEILING: inputs.approved_public_retail_ceiling_usd.default,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(workflow.jobs.deploy.needs, "validate");
  assert.equal(workflow.jobs.deploy.environment.name, "production");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
});

function validateJobName(name) {
  return spawnSync("bash", ["-c", steps[validationIndex].run], {
    env: { ...environment, MIGRATION_JOB_NAME: name },
    encoding: "utf8",
  });
}

test("deployment configuration is validated before Azure login", () => {
  assert.ok(validationIndex >= 0);
  const loginIndex = steps.findIndex((step) =>
    step.uses?.startsWith("azure/login@"),
  );
  assert.ok(loginIndex > validationIndex);
});

test("migration job validation accepts valid names including length boundaries", () => {
  for (const name of [
    "ab",
    "a0",
    "a-b",
    "a".repeat(32),
    "caj-ghcp-ai-credits-migrate-prod",
  ]) {
    const result = validateJobName(name);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
});

test("migration job validation rejects the production failure and invalid names", () => {
  for (const name of [
    "caj-ghcp-ai-credits-migration-prod",
    "a".repeat(33),
    "a",
    "1job",
    "-job",
    "job-",
    "job--name",
    "Job",
    "job_name",
    "job.name",
    "job name",
    "job\n",
    " job",
  ]) {
    const result = validateJobName(name);
    assert.equal(result.status, 1, name);
    assert.match(
      result.stderr,
      /Invalid protected production variable MIGRATION_JOB_NAME/,
    );
    assert.match(result.stderr, /caj-ghcp-ai-credits-migrate-prod/);
  }
});

test("missing migration job name still fails the required variable check", () => {
  const result = validateJobName("");
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Missing protected production variable: MIGRATION_JOB_NAME/,
  );
});

function verifyReadinessAndTraffic(overrides = {}) {
  const step = steps.find(
    (step) => step.name === "Verify readiness and traffic",
  );
  const directory = mkdtempSync(join(tmpdir(), "azure-deploy-test-"));
  const outputPath = join(directory, "github-output");
  try {
    const result = spawnSync(
      "bash",
      [
        "-c",
        `
    curl() {
      case "\${*: -1}" in
        "$APPLICATION_ORIGIN/readyz")
          echo readiness-check >&2
          return "$READINESS_STATUS"
          ;;
        "$APPLICATION_ORIGIN/healthz")
          echo health-check >&2
          return "$HEALTH_STATUS"
          ;;
        *) return 1 ;;
      esac
    }
    az() {
      if [[ "$*" != "containerapp ingress traffic show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP_NAME --query [?latestRevision].weight | [0] --output tsv" ]]; then
        echo "Unexpected Azure command: $*" >&2
        return 1
      fi
      echo traffic-check >&2
      printf '%s\\n' "$LATEST_WEIGHT"
      return "$AZURE_STATUS"
    }
    ${step.run}
    `,
      ],
      {
        env: {
          APPLICATION_ORIGIN: "https://app.example.com",
          CONTAINER_APP_NAME: "test-app",
          RESOURCE_GROUP_NAME: "test-group",
          GITHUB_OUTPUT: outputPath,
          LATEST_WEIGHT: "100",
          READINESS_STATUS: "0",
          HEALTH_STATUS: "0",
          AZURE_STATUS: "0",
          ...overrides,
        },
        encoding: "utf8",
      },
    );
    return {
      ...result,
      output: existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "",
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("single-revision deployment verifies traffic without mutating it", () => {
  const application = readFileSync(
    new URL("../infra/modules/application.bicep", import.meta.url),
    "utf8",
  );
  assert.match(application, /activeRevisionsMode: 'Single'/);
  assert.match(
    application,
    /traffic:\s*\[\s*{\s*latestRevision: true\s*weight: 100/,
  );

  const result = verifyReadinessAndTraffic();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "readiness-check\ntraffic-check\nhealth-check\n");
  assert.equal(result.output, "application_origin=https://app.example.com\n");
});

test("deployment verification rejects missing or incomplete latest revision traffic", () => {
  for (const weight of ["", "None", "0", "50"]) {
    const result = verifyReadinessAndTraffic({ LATEST_WEIGHT: weight });
    assert.equal(result.status, 1, weight);
    assert.match(
      result.stderr,
      /Latest revision did not receive 100 percent of traffic/,
    );
    assert.doesNotMatch(result.stderr, /health-check/);
    assert.equal(result.output, "");
  }
});

test("deployment verification preserves readiness, Azure, and health failure gates", () => {
  for (const [variable, expectedChecks] of [
    ["READINESS_STATUS", "readiness-check\n"],
    ["AZURE_STATUS", "readiness-check\ntraffic-check\n"],
    ["HEALTH_STATUS", "readiness-check\ntraffic-check\nhealth-check\n"],
  ]) {
    const result = verifyReadinessAndTraffic({ [variable]: "1" });
    assert.equal(result.status, 1, variable);
    assert.equal(result.stderr, expectedChecks);
    assert.equal(result.output, "");
  }
});
