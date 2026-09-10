import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function validateLedger(ledger) {
  assert.equal(ledger.targetPercent, 90);
  assert.equal(ledger.maxIterations, 10);
  assert.equal(ledger.requirements.length, 30);
  assert.deepEqual(
    ledger.requirements.map((item) => item.id),
    Array.from(
      { length: 30 },
      (_, index) => `R${String(index + 1).padStart(2, "0")}`,
    ),
  );
  for (const item of ledger.requirements) {
    assert.equal(typeof item.verified, "boolean", item.id);
    assert.ok(typeof item.source === "string" && item.source.trim(), item.id);
    assert.ok(
      typeof item.requirement === "string" && item.requirement.trim(),
      item.id,
    );
    assert.ok(Array.isArray(item.evidence), item.id);
    if (item.verified)
      assert.ok(item.evidence.length > 0, `${item.id} needs evidence`);
    for (const evidence of item.evidence) {
      assert.equal(typeof evidence, "string", item.id);
      assert.ok(
        evidence.trim() && evidence.split("#")[0].trim(),
        `${item.id}: empty evidence`,
      );
      const path = resolve(root, evidence.split("#")[0]);
      assert.ok(
        !relative(root, path).startsWith("..") &&
          existsSync(path) &&
          statSync(path).isFile(),
        `${item.id}: missing local evidence ${evidence}`,
      );
    }
  }
  const verified = ledger.requirements.filter((item) => item.verified).length;
  return {
    verified,
    total: 30,
    percent: (100 * verified) / 30,
    targetMet: verified >= 27,
  };
}

function main() {
  const flags = new Set(process.argv.slice(2));
  for (const flag of flags)
    assert.ok(
      ["--ledger-only", "--require-target"].includes(flag),
      `Unknown option: ${flag}`,
    );
  const ledger = JSON.parse(
    readFileSync(
      resolve(root, "docs/active-register-requirements.json"),
      "utf8",
    ),
  );
  const score = validateLedger(ledger);
  for (const file of [
    ".github/instructions/active-register.instructions.md",
    ".github/skills/governance-kaizen/SKILL.md",
    ".github/agents/governance-loop.agent.md",
    ".github/prompts/governance-kaizen.prompt.md",
    "docs/active-register.md",
    "docs/active-register-iterations.md",
  ]) {
    const text = readFileSync(resolve(root, file), "utf8");
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    assert.ok(match, `Missing frontmatter: ${file}`);
    const metadata = load(match[1]);
    assert.ok(
      typeof metadata?.description === "string" && metadata.description.trim(),
      file,
    );
  }
  if (!flags.has("--ledger-only")) {
    for (const [command, args] of [
      ["npm", ["run", "build"]],
      [
        process.execPath,
        [
          "--test",
          "scripts/register-test.mjs",
          "scripts/register-api-test.mjs",
          "scripts/assessment-test.mjs",
        ],
      ],
    ]) {
      const result = spawnSync(command, args, {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, REGISTER_INTEGRATION: "1" },
      });
      if (result.error) throw result.error;
      assert.equal(
        result.status,
        0,
        `${command} failed; acceptance is not certified`,
      );
    }
  }
  console.log(
    `Recorded coverage: ${score.verified}/${score.total} (${score.percent.toFixed(1)}%); target: 27/30 (90%).`,
  );
  console.log(
    `Unverified: ${
      ledger.requirements
        .filter((item) => !item.verified)
        .map((item) => item.id)
        .join(", ") || "none"
    }.`,
  );
  console.log(
    flags.has("--ledger-only")
      ? "Ledger validation only; executable safety gates were not run."
      : "Builds and executable safety gates passed; external evidence still requires independent review.",
  );
  console.log(
    score.targetMet
      ? "Recorded coverage meets the numerical target."
      : "The 90% acceptance target has NOT been reached.",
  );
  if (
    flags.has("--require-target") &&
    (!score.targetMet || flags.has("--ledger-only"))
  )
    process.exitCode = 2;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
