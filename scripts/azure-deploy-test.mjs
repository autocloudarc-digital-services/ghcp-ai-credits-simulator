import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";

const workflow = load(
  readFileSync(new URL("../.github/workflows/azure-deploy.yml", import.meta.url), "utf8"),
);
const steps = workflow.jobs.deploy.steps;
const validationIndex = steps.findIndex(
  (step) => step.name === "Verify deployment configuration",
);
const environment = {
  ...Object.fromEntries(Object.keys(workflow.jobs.deploy.env).map((key) => [key, "test"])),
  LOCATION: "eastus2",
  POSTGREST_SOURCE_IMAGE: `docker.io/postgrest/postgrest@sha256:${"a".repeat(64)}`,
};

function validateJobName(name) {
  return spawnSync("bash", ["-c", steps[validationIndex].run], {
    env: { ...environment, MIGRATION_JOB_NAME: name },
    encoding: "utf8",
  });
}

test("deployment configuration is validated before Azure login", () => {
  assert.ok(validationIndex >= 0);
  const loginIndex = steps.findIndex((step) => step.uses?.startsWith("azure/login@"));
  assert.ok(loginIndex > validationIndex);
});

test("migration job validation accepts valid names including length boundaries", () => {
  for (const name of ["ab", "a0", "a-b", "a".repeat(32), "caj-ghcp-ai-credits-migrate-prod"]) {
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
    assert.match(result.stderr, /Invalid protected production variable MIGRATION_JOB_NAME/);
    assert.match(result.stderr, /caj-ghcp-ai-credits-migrate-prod/);
  }
});

test("missing migration job name still fails the required variable check", () => {
  const result = validateJobName("");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing protected production variable: MIGRATION_JOB_NAME/);
});
