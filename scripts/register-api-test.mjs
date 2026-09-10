import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const express = require("express");
const session = require("express-session");
const { csrf } = require("lusca");
const request = require("supertest");
const { createRegisterRouter } = require("../server/dist/register/routes.js");
const { configuredAccess } = require("../server/dist/register/access.js");

test("local operator mapping is development-only and environment configuration takes precedence", (context) => {
  const fs = require("node:fs");
  const previousEnvironment = process.env.NODE_ENV;
  const previousConfiguration = process.env.REGISTER_ACCESS_JSON;
  const localMap = '{"123":{"tenant":"test:local-config","role":"reader"}}';
  const exists = context.mock.method(fs, "existsSync", (file) => {
    assert.ok(file.endsWith("/.local/register-access.json"));
    return true;
  });
  const read = context.mock.method(fs, "readFileSync", () => localMap);
  try {
    process.env.NODE_ENV = "development";
    delete process.env.REGISTER_ACCESS_JSON;
    assert.deepEqual(configuredAccess("123"), {
      actor: "123",
      tenant: "test:local-config",
      role: "reader",
    });
    assert.throws(() => configuredAccess("999"), /no Active Register role/);
    read.mock.mockImplementation(() => "{invalid");
    assert.throws(() => configuredAccess("123"), /configuration is invalid/);
    read.mock.mockImplementation(() => localMap);
    exists.mock.mockImplementation(() => false);
    assert.throws(() => configuredAccess("123"), /not configured/);
    exists.mock.mockImplementation(() => true);
    process.env.REGISTER_ACCESS_JSON =
      '{"123":{"tenant":"test:explicit","role":"editor"}}';
    assert.equal(configuredAccess("123").tenant, "test:explicit");
    process.env.REGISTER_ACCESS_JSON = "{}";
    assert.throws(() => configuredAccess("123"), /no Active Register role/);
    process.env.REGISTER_ACCESS_JSON = "";
    assert.throws(() => configuredAccess("123"), /not configured/);
    delete process.env.REGISTER_ACCESS_JSON;
    process.env.NODE_ENV = "production";
    const readsBefore = read.mock.callCount();
    assert.throws(() => configuredAccess("123"), /not configured/);
    assert.equal(read.mock.callCount(), readsBefore);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousConfiguration === undefined)
      delete process.env.REGISTER_ACCESS_JSON;
    else process.env.REGISTER_ACCESS_JSON = previousConfiguration;
  }
});

test("operator access is explicit, numeric-ID based, and deny by default", () => {
  assert.throws(() => configuredAccess("123", ""), /not configured/);
  assert.throws(() => configuredAccess("123", "{invalid"), /invalid/);
  assert.throws(() => configuredAccess("123", "{}"), /no Active Register role/);
  assert.deepEqual(
    configuredAccess(
      "123",
      '{"123":{"tenant":"enterprise:stable-id","role":"reader"}}',
    ),
    { actor: "123", tenant: "enterprise:stable-id", role: "reader" },
  );
});

test("CSV uses canonical identity, numeric amounts, semicolon SKUs, and spreadsheet protection", () => {
  const { registerCsv } = require("../server/dist/register/export.js");
  const output = registerCsv({
    exported_at: "2026-09-10T00:00:00Z",
    records: [],
    revisions: [
      {
        record_id: "test",
        revision: 1,
        actor_id: "test",
        recorded_at: "2026-09-10T00:00:00Z",
        document: {
          record_type: "metered-budget",
          scope_id: "=SUM(1)",
          enterprise_control_id: "control",
          budget_amount_currency: 20,
          currency: "USD",
          covered_ai_credit_sku: ["provider-one", "provider-two"],
          provider_control_id: null,
        },
      },
    ],
  });
  assert.ok(output.includes("'=SUM(1)"));
  assert.ok(output.includes("not-applicable,0"));
  assert.ok(output.includes("provider-one;provider-two"));
  assert.ok(output.includes(",20,"));
});

function appFor(access) {
  const app = express();
  app.use(express.json());
  app.use(
    session({ secret: randomUUID(), resave: false, saveUninitialized: true }),
  );
  app.use(csrf());
  app.get("/csrf", (_req, res) => res.json({ token: res.locals._csrf }));
  app.use(
    "/register",
    createRegisterRouter(async () => {
      if (!access)
        throw Object.assign(new Error("Authentication required."), {
          status: 401,
        });
      return access;
    }),
  );
  app.use((error, _req, res, _next) =>
    res
      .status(error.status ?? res.statusCode ?? 500)
      .json({ message: "Rejected" }),
  );
  return app;
}
test("anonymous denied and mutations require CSRF", async () => {
  await request(appFor(null)).get("/register").expect(401);
  await request(appFor({ actor: "test", tenant: "test", role: "editor" }))
    .post("/register")
    .send({})
    .expect(403);
});

test(
  "authenticated API validates payloads, rejects readers, and saves audit actor",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async () => {
    const access = {
      actor: "automated-api-test",
      tenant: `test:${randomUUID()}`,
      role: "editor",
    };
    const client = request.agent(appFor(access));
    const {
      body: { token },
    } = await client.get("/csrf").expect(200);
    const document = {
      record_type: "ULB",
      scope_id: "test:scope",
      enterprise_control_id: randomUUID(),
      owner_primary: "Local test owner",
      phase: "Prepare",
      record_status: "draft",
      production_intended: false,
    };
    await client
      .post("/register")
      .set("X-CSRF-Token", token)
      .send({ document, expected_revision: 0, actor: "spoofed" })
      .expect(422);
    const saved = await client
      .post("/register")
      .set("X-CSRF-Token", token)
      .send({ document, expected_revision: 0 })
      .expect(201);
    const history = await client
      .get(`/register/${saved.body.id}/history`)
      .expect(200);
    assert.equal(history.body.revisions[0].actor_id, access.actor);
    const snapshot = await client
      .get("/register/export?format=json")
      .expect(200);
    assert.equal(snapshot.body.records.length, 1);
    assert.equal(snapshot.body.revisions[0].actor_id, access.actor);
    assert.ok(snapshot.body.exported_at);
    await client
      .get("/register/export?format=csv")
      .expect(200)
      .expect("Content-Type", /text\/csv/);
    await client
      .put(`/register/${saved.body.id}`)
      .set("X-CSRF-Token", token)
      .send({ document, expected_revision: 0 })
      .expect(409);
    const reader = request.agent(appFor({ ...access, role: "reader" }));
    const readerToken = (await reader.get("/csrf")).body.token;
    await reader
      .post("/register")
      .set("X-CSRF-Token", readerToken)
      .send({ document, expected_revision: 0 })
      .expect(403);
  },
);
