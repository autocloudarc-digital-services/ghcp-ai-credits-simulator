import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const {
  PostgresSessionStore,
} = require("../server/dist/persistence/sessionStore.js");
const { persistenceClient } = require("../server/dist/persistence/client.js");
test(
  "fresh Express instances restore encrypted sessions and retain CSRF and logout protection",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async () => {
    const express = require("express");
    const request = require("supertest");
    const session = require("express-session");
    const { csrf } = require("lusca");
    const secret = "fixture-only-session-key-at-least-32-characters";
    const build = () => {
      const app = express();
      app.use(express.json());
      app.use(
        session({
          secret,
          store: new PostgresSessionStore(secret),
          resave: false,
          saveUninitialized: false,
          cookie: { maxAge: 60000 },
        }),
      );
      app.use(csrf());
      app.get("/fixture", (req, res) => {
        req.session.githubUserId = "987654321";
        res.json({ csrf: res.locals._csrf });
      });
      app.get("/who", (req, res) =>
        res.json({ owner: req.session.githubUserId ?? null }),
      );
      app.post("/logout", (req, res, next) =>
        req.session.destroy((error) =>
          error ? next(error) : res.sendStatus(204),
        ),
      );
      app.use((error, _req, res, _next) =>
        res
          .status(error.status ?? 403)
          .json({ message: "Fixture request rejected" }),
      );
      return app;
    };
    const first = await request(build()).get("/fixture").expect(200);
    const cookie = first.headers["set-cookie"][0].split(";")[0];
    const restarted = build();
    assert.equal(
      (await request(restarted).get("/who").set("Cookie", cookie).expect(200))
        .body.owner,
      "987654321",
    );
    await request(restarted)
      .post("/logout")
      .set("Cookie", cookie)
      .send({})
      .expect(403);
    await request(restarted)
      .post("/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", first.body.csrf)
      .send({})
      .expect(204);
    assert.equal(
      (await request(build()).get("/who").set("Cookie", cookie).expect(200))
        .body.owner,
      null,
    );
  },
);

test(
  "report API stores authoritative assessment snapshots and re-downloads only for the owner",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async (context) => {
    const express = require("express");
    const request = require("supertest");
    const data = require("../server/dist/persistence/applicationStore.js");
    const renderer = require("../server/dist/services/reportGenerationService.js");
    const bytes = Buffer.from("%PDF-1.7 fixture report");
    context.mock.method(renderer, "generateReportPdf", async (snapshot) => {
      assert.equal(snapshot.assessmentResult.totalCreditsConsumed, 42);
      return bytes;
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = { githubUserId: req.headers["x-fixture-account"] };
      next();
    });
    app.use(require("../server/dist/routes/report.js").default);
    app.use((error, _req, res, _next) =>
      res.status(error.status ?? 500).json({ message: error.message }),
    );
    const owner = `5${Date.now()}`;
    const other = `4${Date.now()}`;
    const id = randomUUID();
    await data.createAssessment(owner, id, {
      enterpriseSlug: "fixture",
      organizations: ["fixture"],
      periodDays: 30,
    });
    await data.updateAssessment(owner, id, {
      status: "complete",
      result: { totalCreditsConsumed: 42 },
    });
    const input = {
      assessmentId: id,
      assessmentResult: { totalCreditsConsumed: 999 },
      recommendations: [],
      simulatorConfig: {
        enterpriseName: "Fixture",
        licenseCountBusiness: 1,
        licenseCountEnterprise: 0,
        licenseCountCloudAgent: 0,
        licenseCountSpark: 0,
        billingCycleStartDate: "2026-09-01",
        currentDayOfCycle: 1,
        populationAllocation: {
          universalUlb: 1,
          overageUsers: 0,
          abundantUsers: 0,
          exponentialUsers: 0,
        },
      },
    };
    await request(app)
      .post("/generate")
      .set("x-fixture-account", other)
      .send(input)
      .expect(409);
    const generated = await request(app)
      .post("/generate")
      .set("x-fixture-account", owner)
      .send(input)
      .expect(200);
    const reportId = generated.headers["x-report-id"];
    assert.equal(
      (await data.getReport(owner, reportId)).input.assessmentId,
      id,
    );
    assert.equal(
      (await data.getReport(owner, reportId)).input.assessmentResult
        .totalCreditsConsumed,
      42,
    );
    assert.deepEqual(
      (
        await request(app)
          .get(`/download/${reportId}`)
          .set("x-fixture-account", owner)
          .expect(200)
      ).body,
      bytes,
    );
    await request(app)
      .get(`/download/${reportId}`)
      .set("x-fixture-account", other)
      .expect(404);
    assert.equal(
      (
        await request(app)
          .get("/history")
          .set("x-fixture-account", owner)
          .expect(200)
      ).body[0].id,
      reportId,
    );
  },
);
test(
  "workflow API validates ownership, credentials, and revisions",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async () => {
    const express = require("express");
    const request = require("supertest");
    const data = require("../server/dist/persistence/applicationStore.js");
    const workflow = require("../server/dist/routes/workflow.js").default;
    const owner = `7${Date.now()}`;
    const other = `6${Date.now()}`;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      if (!req.headers["x-fixture-account"]) {
        res.sendStatus(401);
        return;
      }
      req.session = { githubUserId: req.headers["x-fixture-account"] };
      next();
    });
    app.use(workflow);
    app.use((error, _req, res, _next) =>
      res.status(error.status ?? 500).json({ message: error.message }),
    );
    const id = randomUUID();
    await data.createAssessment(owner, id, {
      enterpriseSlug: "fixture",
      organizations: ["fixture"],
      periodDays: 30,
    });
    await data.updateAssessment(owner, id, {
      status: "complete",
      result: { totalCreditsConsumed: 42 },
    });
    const document = {
      simulatorConfig: {
        enterpriseName: "Fixture",
        licenseCountBusiness: 1,
        licenseCountEnterprise: 0,
        licenseCountCloudAgent: 0,
        licenseCountSpark: 0,
        billingCycleStartDate: "2026-09-01",
        currentDayOfCycle: 1,
        creditsConsumedSoFar: 0,
        populationAllocation: {
          universalUlb: 1,
          overageUsers: 0,
          abundantUsers: 0,
          exponentialUsers: 0,
        },
      },
      simulatorResult: null,
      scenarios: [],
      assessmentId: id,
      recommendations: [],
      hasConfirmedSimulation: false,
      hasReviewedDashboard: false,
      hasReviewedRecommendations: false,
      use3DVisualizer: false,
      allocationPlans: {
        fixture: { budget: 100, percentages: { center: 100 } },
      },
    };
    await request(app).get("/").expect(401);
    assert.equal(
      (await request(app).get("/").set("x-fixture-account", owner).expect(200))
        .body.latestAssessment.id,
      id,
    );
    await request(app)
      .put("/")
      .set("x-fixture-account", other)
      .send({ accountId: other, expectedRevision: 0, document })
      .expect(400);
    await request(app)
      .put("/")
      .set("x-fixture-account", other)
      .send({ accountId: owner, expectedRevision: 0, document })
      .expect(409);
    await request(app)
      .put("/")
      .set("x-fixture-account", owner)
      .send({
        accountId: owner,
        expectedRevision: 0,
        document: { ...document, enterpriseBillingToken: "fixture-token" },
      })
      .expect(400);
    await request(app)
      .put("/")
      .set("x-fixture-account", owner)
      .send({ accountId: owner, expectedRevision: 0, document })
      .expect(200);
    const loaded = (
      await request(app).get("/").set("x-fixture-account", owner).expect(200)
    ).body;
    assert.deepEqual(loaded.document, document);
    assert.equal(loaded.assessment.result.totalCreditsConsumed, 42);
    assert.equal(
      (await request(app).get("/").set("x-fixture-account", other).expect(200))
        .body.document,
      null,
    );
    await request(app)
      .put("/")
      .set("x-fixture-account", owner)
      .send({ accountId: owner, expectedRevision: 0, document })
      .expect(409);
    assert.ok(!JSON.stringify(loaded).includes("fixture-token"));
  },
);
test(
  "assessments, workflow revisions, and report bytes persist and remain account isolated",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async () => {
    const data = require("../server/dist/persistence/applicationStore.js");
    const owner = `9${Date.now()}`;
    const other = `8${Date.now()}`;
    const id = randomUUID();
    await data.createAssessment(owner, id, {
      enterpriseSlug: "fixture",
      organizations: ["fixture"],
      periodDays: 30,
    });
    await data.updateAssessment(owner, id, {
      status: "complete",
      result: { totalCreditsConsumed: 12 },
    });
    assert.equal(
      (await data.getAssessment(owner, id)).result.totalCreditsConsumed,
      12,
    );
    assert.equal(await data.getAssessment(other, id), null);
    assert.equal((await data.latestAssessment(owner)).id, id);
    const first = await data.saveWorkflow(
      owner,
      { scenarios: [], fixture: "durable" },
      0,
    );
    assert.equal(first.revision, 1);
    assert.equal((await data.getWorkflow(owner)).document.fixture, "durable");
    assert.equal(await data.getWorkflow(other), null);
    const updates = await Promise.allSettled([
      data.saveWorkflow(owner, { fixture: "one" }, 1),
      data.saveWorkflow(owner, { fixture: "two" }, 1),
    ]);
    assert.equal(
      updates.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const reportId = randomUUID();
    const bytes = Buffer.from("%PDF-local-fixture");
    await data.saveReport(
      owner,
      reportId,
      "fixture.pdf",
      { fixture: true },
      bytes,
    );
    assert.deepEqual(
      Buffer.from((await data.getReport(owner, reportId)).pdf_base64, "base64"),
      bytes,
    );
    assert.equal(await data.getReport(other, reportId), null);
    assert.equal((await data.listReports(owner))[0].id, reportId);
    const interrupted = randomUUID();
    await data.createAssessment(owner, interrupted, {
      enterpriseSlug: "fixture",
      organizations: ["fixture"],
      periodDays: 30,
    });
    await persistenceClient("application_data", owner).patch(
      "/assessment_jobs",
      { lease_expires_at: "2020-01-01T00:00:00Z" },
      { params: { id: `eq.${interrupted}` } },
    );
    assert.equal(
      (await data.getAssessment(owner, interrupted)).status,
      "failed",
    );
    await assert.rejects(
      persistenceClient("application_data", other).post("/assessment_jobs", {
        id: randomUUID(),
        owner_id: owner,
        status: "pending",
        input: {},
      }),
    );
  },
);
const invoke = (store, method, ...args) =>
  new Promise((resolve, reject) =>
    store[method](...args, (error, value) =>
      error ? reject(error) : resolve(value),
    ),
  );

test(
  "PostgreSQL sessions survive a store restart, are encrypted, isolated, expiring, and revocable",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async () => {
    const secret = "local-test-session-key-not-a-real-credential";
    const store = new PostgresSessionStore(secret);
    const sid = randomUUID();
    const id = createHash("sha256").update(sid).digest("hex");
    const value = {
      cookie: { expires: new Date(Date.now() + 60000).toISOString() },
      refreshToken: "local-fixture-token",
      githubUserId: "123",
    };
    try {
      await invoke(store, "set", sid, value);
      assert.deepEqual(
        await invoke(new PostgresSessionStore(secret), "get", sid),
        value,
      );
      const raw = await persistenceClient("application_sessions", id).get(
        "/application_sessions",
        { params: { id: `eq.${id}` } },
      );
      assert.ok(!JSON.stringify(raw.data).includes("local-fixture-token"));
      assert.deepEqual(
        (
          await persistenceClient(
            "application_sessions",
            createHash("sha256").update("other").digest("hex"),
          ).get("/application_sessions", { params: { id: `eq.${id}` } })
        ).data,
        [],
      );
      await assert.rejects(
        invoke(
          new PostgresSessionStore(
            "different-local-test-key-which-is-long-enough",
          ),
          "get",
          sid,
        ),
      );
      await invoke(store, "touch", sid, {
        cookie: { expires: "2020-01-01T00:00:00Z" },
      });
      assert.equal(await invoke(store, "get", sid), null);
      await invoke(store, "set", sid, value);
      await invoke(store, "destroy", sid);
      assert.equal(await invoke(store, "get", sid), null);
    } finally {
      await invoke(store, "destroy", sid);
    }
  },
);
