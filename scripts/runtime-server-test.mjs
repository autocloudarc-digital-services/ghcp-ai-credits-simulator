import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const express = require("express");
const session = require("express-session");
const request = require("supertest");
const {
  createApp,
  productionClientDistPath,
  startServer,
} = require("../server/dist/index.js");

function appOptions(overrides = {}) {
  return {
    clientOrigin: "https://credits.example.com",
    sessionSecret: "test-session-secret-with-at-least-32-characters",
    sessionStore: new session.MemoryStore(),
    readinessCheck: async () => {},
    production: false,
    validateProductionConfiguration: false,
    ...overrides,
  };
}

test("liveness bypasses storage and readiness discloses no failure detail", async (context) => {
  const store = new session.MemoryStore();
  const storeGet = context.mock.method(store, "get", () => {
    throw new Error("storage must not be used");
  });
  const healthy = createApp(appOptions({ sessionStore: store }));
  await request(healthy).get("/healthz").expect(200, { status: "ok" });
  assert.equal(storeGet.mock.callCount(), 0);

  const unavailable = createApp(
    appOptions({
      readinessCheck: async () => {
        throw new Error("database-password-must-not-leak");
      },
    }),
  );
  const response = await request(unavailable)
    .get("/readyz")
    .expect(503, { status: "not-ready" });
  assert.doesNotMatch(response.text, /database-password/);
});

test("one trusted proxy hop enables secure session cookies", async () => {
  const app = createApp(appOptions({ production: true }));
  const trustProxy = app.get("trust proxy fn");
  assert.equal(trustProxy("10.0.0.4", 0), true);
  assert.equal(trustProxy("10.0.0.5", 1), false);

  const response = await request(app)
    .get("/auth/csrf-token")
    .set("X-Forwarded-Proto", "https")
    .expect(200);
  assert.match(response.headers["set-cookie"]?.[0] ?? "", /; Secure;/);
});

test("rate limiting ignores spoofed addresses beyond the trusted hop", async () => {
  const app = createApp(appOptions({ globalRateLimitMax: 1 }));
  await request(app)
    .get("/api/not-a-route")
    .set("X-Forwarded-For", "203.0.113.1, 198.51.100.10")
    .expect(404);
  await request(app)
    .get("/api/not-a-route")
    .set("X-Forwarded-For", "203.0.113.2, 198.51.100.10")
    .expect(429);
  await request(app)
    .get("/api/not-a-route")
    .set("X-Forwarded-For", "203.0.113.2, 198.51.100.11")
    .expect(404);
});

test("production static routes preserve API precedence", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "credits-client-"));
  try {
    await writeFile(
      path.join(directory, "index.html"),
      "<main>packaged-client</main>",
    );
    const app = createApp(
      appOptions({ production: true, clientDistPath: directory }),
    );
    await request(app)
      .get("/dashboard")
      .expect(200, /packaged-client/);
    await request(app)
      .get("/api/not-a-route")
      .expect("Content-Type", /json/)
      .expect(404, { message: "API endpoint not found." });
    assert.equal(productionClientDistPath(), path.resolve("client/dist"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("server shutdown closes ingress and reports interrupted assessments", async () => {
  const app = express();
  app.get("/healthz", (_request, response) => response.json({ status: "ok" }));
  const runtime = startServer({
    app,
    port: 0,
    registerSignalHandlers: false,
    shutdownTimeoutMs: 1000,
    interruptAssessments: async () => ({ attempted: 2, failed: 0 }),
  });
  if (!runtime.server.listening) await once(runtime.server, "listening");
  assert.equal(runtime.server.listening, true);

  assert.deepEqual(await runtime.shutdown("test"), {
    signal: "test",
    interruptedAssessments: 2,
    failedInterruptionUpdates: 0,
    timedOut: false,
  });
  assert.equal(runtime.server.listening, false);
});
