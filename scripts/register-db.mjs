import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  openSync,
  closeSync,
} from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, ".local");
const envFile = resolve(directory, "register.env");
const action = process.argv[2] ?? "status";
if (!existsSync(envFile)) {
  if (action !== "up") throw new Error("Run npm run register:db:up first.");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    envFile,
    `REGISTER_DB_PASSWORD=${randomBytes(32).toString("hex")}\nREGISTER_JWT_SECRET=${randomBytes(48).toString("hex")}\nREGISTER_GATEWAY_PORT=3302\n`,
    { mode: 0o600, flag: "wx" },
  );
}
const base = [
  "compose",
  "--env-file",
  envFile,
  "-f",
  resolve(root, "compose.register.yaml"),
];
function compose(args, input, capture = false) {
  const result = spawnSync("docker", [...base, ...args], {
    cwd: root,
    input,
    encoding: "utf8",
    stdio: capture
      ? ["pipe", "pipe", "inherit"]
      : input
        ? ["pipe", "inherit", "inherit"]
        : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Docker operation failed (${result.status}).`);
  return result.stdout?.trim();
}
function fingerprint(database = "active_register") {
  return compose(
    [
      "exec",
      "-T",
      "postgres",
      "psql",
      "-X",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "register_owner",
      "-d",
      database,
      "-c",
      `SELECT jsonb_build_object(
        'records', (SELECT md5(COALESCE(string_agg(to_jsonb(record_row)::text,'' ORDER BY id),'')) FROM register.records record_row),
        'revisions', (SELECT md5(COALESCE(string_agg(to_jsonb(history_row)::text,'' ORDER BY record_id,revision),'')) FROM register.revisions history_row),
        'sessions', (SELECT md5(COALESCE(string_agg(to_jsonb(session_row)::text,'' ORDER BY id),'')) FROM register.application_sessions session_row),
        'assessments', (SELECT md5(COALESCE(string_agg(to_jsonb(job_row)::text,'' ORDER BY id),'')) FROM register.assessment_jobs job_row),
        'workflows', (SELECT md5(COALESCE(string_agg(to_jsonb(workflow_row)::text,'' ORDER BY owner_id),'')) FROM register.workflows workflow_row),
        'reports', (SELECT md5(COALESCE(string_agg(to_jsonb(report_row)::text,'' ORDER BY id),'')) FROM register.generated_reports report_row)
      );`,
    ],
    undefined,
    true,
  );
}
function backup() {
  const backupDirectory = resolve(directory, "backups");
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const backupFile = resolve(
    backupDirectory,
    `register-${Date.now()}-${randomBytes(4).toString("hex")}.dump`,
  );
  const output = openSync(backupFile, "wx", 0o600);
  try {
    const result = spawnSync(
      "docker",
      [
        ...base,
        "exec",
        "-T",
        "postgres",
        "pg_dump",
        "-U",
        "register_owner",
        "-Fc",
        "-n",
        "register",
        "active_register",
      ],
      { stdio: ["ignore", output, "inherit"] },
    );
    if (result.error || result.status !== 0)
      throw new Error("Database backup failed; do not use the partial file.");
  } finally {
    closeSync(output);
  }
  console.log(`Backup created: ${backupFile}`);
  return backupFile;
}
function verifyRecovery() {
  const originalContainer = compose(["ps", "-q", "postgres"], undefined, true);
  const original = fingerprint();
  assert.ok(original, "Fingerprint must be present.");
  const backupFile = backup();
  compose(["up", "-d", "--force-recreate", "--wait", "postgres"]);
  assert.notEqual(
    compose(["ps", "-q", "postgres"], undefined, true),
    originalContainer,
  );
  assert.equal(
    fingerprint(),
    original,
    "All register and application tables must survive container recreation. Run recovery checks without concurrent application writes.",
  );
  const restoreDatabase = `register_restore_${randomBytes(8).toString("hex")}`;
  compose([
    "exec",
    "-T",
    "postgres",
    "createdb",
    "-U",
    "register_owner",
    restoreDatabase,
  ]);
  try {
    const input = openSync(backupFile, "r");
    try {
      const result = spawnSync(
        "docker",
        [
          ...base,
          "exec",
          "-T",
          "postgres",
          "pg_restore",
          "-U",
          "register_owner",
          "--exit-on-error",
          "--no-owner",
          "-d",
          restoreDatabase,
        ],
        { stdio: [input, "inherit", "inherit"] },
      );
      if (result.error || result.status !== 0)
        throw new Error("Isolated restore failed.");
    } finally {
      closeSync(input);
    }
    assert.equal(
      fingerprint(restoreDatabase),
      original,
      "All restored register and application tables must match the source.",
    );
    console.log(
      "PASS: container recreation durability and isolated backup restore.",
    );
  } finally {
    compose([
      "exec",
      "-T",
      "postgres",
      "dropdb",
      "-U",
      "register_owner",
      restoreDatabase,
    ]);
  }
}
function migrate() {
  const migrations = resolve(root, "server/src/register/migrations");
  for (const name of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    compose(
      [
        "exec",
        "-T",
        "postgres",
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "register_owner",
        "-d",
        "active_register",
      ],
      readFileSync(resolve(migrations, name), "utf8"),
    );
  }
}
if (action === "up") {
  compose(["up", "-d", "--wait", "postgres"]);
  migrate();
  compose(["up", "-d", "--wait", "gateway"]);
} else if (action === "migrate") {
  migrate();
} else if (action === "restart") {
  compose(["restart"]);
} else if (action === "stop") {
  compose(["stop"]);
} else if (action === "status") {
  compose(["ps"]);
} else if (action === "backup") {
  backup();
} else if (action === "verify-recovery") {
  verifyRecovery();
} else {
  throw new Error(
    "Supported actions: up, migrate, restart, stop, status, backup, verify-recovery. Volumes are never removed.",
  );
}
