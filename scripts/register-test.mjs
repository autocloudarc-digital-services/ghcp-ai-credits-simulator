import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateLedger } from "./register-check.mjs";
const require = createRequire(import.meta.url);
const {
  documentSchema,
  validateTransition,
  phases,
  testIds,
  effectiveStatus,
} = require("../server/dist/register/schema.js");
const draft = (record_type = "ULB") => ({
  record_type,
  scope_id: "cost-center:immutable-1",
  enterprise_control_id: "control-1",
  owner_primary: "Named test owner",
  phase: "Prepare",
  record_status: "draft",
  production_intended: false,
  evidence: [],
  tests: [],
});
const parse = (value) => documentSchema.safeParse(value);

test("acceptance ledger keeps thirty requirements and rejects unsupported verification", () => {
  const ledger = JSON.parse(
    readFileSync(
      new URL("../docs/active-register-requirements.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(validateLedger(ledger).total, 30);
  const candidate = () => structuredClone(ledger);
  const shortened = candidate();
  shortened.requirements.pop();
  assert.throws(() => validateLedger(shortened));
  const unsubstantiated = candidate();
  unsubstantiated.requirements[0].verified = true;
  for (const evidence of [[], [""], ["docs"], ["../outside.md"]]) {
    unsubstantiated.requirements[0].evidence = evidence;
    assert.throws(() => validateLedger(unsubstantiated));
  }
  const scored = candidate();
  scored.requirements.forEach((item, index) => {
    item.verified = index < 26;
    item.evidence = ["scripts/register-test.mjs"];
  });
  assert.equal(validateLedger(scored).targetMet, false);
  scored.requirements[26].verified = true;
  assert.equal(validateLedger(scored).targetMet, true);
});

const observedEvidence = () => [
  {
    evidence_link: "test:source",
    source_url: "https://example.test",
    retrieval_timestamp: "2020-01-01T00:00:00Z",
    observation: "observed",
  },
];
const passingTest = (test_id) => ({
  test_id,
  test_result: "pass",
  tested_at: "2020-01-01T00:00:00Z",
  evidence_link: `test:${test_id}`,
  bounded_population: "local fixture only",
  decision_owner: "Local test owner",
});

test("production approval individually requires ownership, evidence, effective dates, and rollback", () => {
  const approved = {
    ...draft("policy-profile"),
    policy_or_profile: "Local test pattern",
    profile_version: 1,
    phase: "Approve",
    production_intended: true,
    evidence: observedEvidence(),
    owner_delegate: "Local delegate",
    support_contact: "Local support",
    approving_owner: "Local approver",
    operating_owner: "Local operator",
    rollback_owner: "Local rollback owner",
    escalation: "Local escalation",
    next_review: "2030-01-01T00:00:00Z",
    approval_id: "test:approval",
    approval_outcome: "approve",
    approval_evidence: "test:approval-evidence",
    approved_at: "2020-01-02T00:00:00Z",
    effective_start: "2020-01-03T00:00:00Z",
    effective_end: "2030-01-01T00:00:00Z",
    rollback_reference: "test:rollback",
  };
  assert.equal(parse(approved).success, true);
  for (const field of [
    "owner_primary",
    "owner_delegate",
    "support_contact",
    "approving_owner",
    "operating_owner",
    "rollback_owner",
    "escalation",
    "next_review",
    "approval_id",
    "approval_outcome",
    "approval_evidence",
    "approved_at",
    "effective_start",
    "effective_end",
    "rollback_reference",
  ]) {
    assert.equal(parse({ ...approved, [field]: null }).success, false, field);
  }
  assert.equal(
    parse({ ...approved, approval_outcome: "reject" }).success,
    false,
  );
});

test("observations preserve unknowns, provenance, time ordering, and source classification", () => {
  const value = { ...draft(), phase: "Baseline", evidence: observedEvidence() };
  for (const observation of ["observed", "calculated", "forecast", "unknown"]) {
    assert.equal(
      parse({
        ...value,
        evidence: [
          {
            ...value.evidence[0],
            observation,
            limitations: "Local test evidence only",
          },
        ],
      }).success,
      true,
    );
  }
  assert.equal(
    parse({
      ...value,
      evidence: [{ ...value.evidence[0], observation: "unknown" }],
    }).success,
    false,
  );
  assert.equal(
    parse({
      ...value,
      evidence: [
        { ...value.evidence[0], retrieval_timestamp: "2999-01-01T00:00:00Z" },
      ],
    }).success,
    false,
  );
  assert.equal(
    parse({ ...value, evidence: [{ ...value.evidence[0], source_url: null }] })
      .success,
    false,
  );
});

test("entitlement purpose and observed cycle are required without inferring a reset", () => {
  const value = {
    ...draft("entitlement-baseline"),
    phase: "Design",
    evidence: observedEvidence(),
    entitlement_basis: "test:licenses",
    baseline_purpose: "reconciliation-only",
    billing_cycle_start: "2020-01-01T00:00:00Z",
    billing_cycle_end: "2020-02-01T00:00:00Z",
    timezone_source: "test:UTC",
  };
  assert.equal(parse(value).success, true);
  assert.equal(documentSchema.parse(value).observed_next_reset, undefined);
  for (const field of [
    "entitlement_basis",
    "baseline_purpose",
    "billing_cycle_start",
    "billing_cycle_end",
    "timezone_source",
  ])
    assert.equal(parse({ ...value, [field]: null }).success, false, field);
  assert.equal(
    parse({ ...value, billing_cycle_end: value.billing_cycle_start }).success,
    false,
  );
});

test("included controls retain numeric caps and downstream references without owning Stop usage", () => {
  const value = {
    ...draft("included-usage-control"),
    phase: "Design",
    evidence: observedEvidence(),
    assigned_license_evidence: "test:licenses",
    observed_cap_behavior: "Local fixture, no provider assertion",
    provider_cap_ai_credits: 100,
    downstream_metered_budget_reference: "test:metered-budget",
  };
  assert.equal(parse(value).success, true);
  assert.equal(
    parse({ ...value, provider_cap_ai_credits: "100" }).success,
    false,
  );
  assert.equal(
    parse({ ...value, provider_cap_ai_credits: null }).success,
    true,
  );
  assert.equal(
    parse({ ...value, stop_usage_state: "disabled" }).success,
    false,
  );
});

test("license forecast design requires numeric amounts, SKU, population, period, and variance owner", () => {
  const value = {
    ...draft("license-baseline"),
    phase: "Design",
    evidence: observedEvidence(),
    license_baseline_amount: 20,
    license_baseline_currency: "USD",
    covered_license_sku: ["test:sku"],
    eligible_count: 1,
    forecast_period: "Local fixture month",
    variance_owner: "Local test owner",
  };
  assert.equal(parse(value).success, true);
  for (const field of [
    "license_baseline_amount",
    "license_baseline_currency",
    "covered_license_sku",
    "eligible_count",
    "forecast_period",
    "variance_owner",
  ])
    assert.equal(parse({ ...value, [field]: null }).success, false, field);
  assert.equal(
    parse({ ...value, license_baseline_amount: "20 USD" }).success,
    false,
  );
});

test("all six provider test identifiers gate progression without treating fixtures as provider proof", () => {
  assert.deepEqual(testIds, ["P-01", "P-01a", "P-02", "P-03", "P-04", "P-05"]);
  const value = {
    ...draft("controlled-test"),
    phase: "Rollout",
    evidence: observedEvidence(),
    population: "local fixture only",
    configured_state: "test configuration",
    decision_owner: "Local test owner",
    tests: testIds.map(passingTest),
  };
  assert.equal(parse(value).success, true);
  for (const testId of testIds) {
    assert.equal(
      parse({
        ...value,
        tests: value.tests.filter((entry) => entry.test_id !== testId),
      }).success,
      false,
      testId,
    );
    assert.equal(
      parse({
        ...value,
        tests: value.tests.map((entry) =>
          entry.test_id === testId ? { ...entry, test_result: "fail" } : entry,
        ),
      }).success,
      false,
      testId,
    );
  }
});

test("paused rollout must explicitly resume and closure requires matching effective evidence", () => {
  const paused = documentSchema.parse({
    ...draft("rollout-wave"),
    record_status: "paused",
  });
  assert.ok(
    validateTransition(paused, { ...paused, phase: "Baseline" }).length,
  );
  assert.ok(
    validateTransition(paused, {
      ...paused,
      record_status: "draft",
      phase: "Baseline",
    }).length,
  );
  assert.deepEqual(
    validateTransition(paused, { ...paused, record_status: "draft" }),
    [],
  );
  const value = {
    ...draft("rollout-wave"),
    phase: "Operate",
    record_status: "closed",
    evidence: observedEvidence(),
    population: "local fixture only",
    configured_state: "enabled",
    effective_state: "enabled",
    verification_evidence: "test:verification",
    decision_owner: "Local test owner",
    tests: [passingTest("P-05")],
  };
  assert.equal(parse(value).success, true);
  assert.equal(parse({ ...value, effective_state: "unknown" }).success, false);
  assert.equal(parse({ ...value, verification_evidence: null }).success, false);
});

test("database JSON key ordering does not change evidence identity", () => {
  const entry = {
    evidence_link: "test:immutable",
    source_url: "https://example.test",
    retrieval_timestamp: "2020-01-01T00:00:00Z",
    observation: "observed",
  };
  const before = { ...documentSchema.parse(draft()), evidence: [entry] };
  const reordered = Object.fromEntries(Object.entries(entry).reverse());
  assert.deepEqual(
    validateTransition(before, { ...before, evidence: [reordered] }),
    [],
  );
});

test("review decisions, active status, and ISO currencies have explicit gates", () => {
  assert.equal(parse({ ...draft(), record_status: "active" }).success, false);
  assert.equal(
    parse({ ...draft(), review_decision: "rollback" }).success,
    false,
  );
  assert.equal(
    parse({ ...draft("license-baseline"), license_baseline_currency: "ZZZ" })
      .success,
    false,
  );
  assert.equal(
    parse({ ...draft("license-baseline"), license_baseline_currency: "USD" })
      .success,
    true,
  );
  assert.equal(
    parse({
      ...draft(),
      review_decision: "retain",
      review_owner: "Test owner",
      reviewed_at: "2020-01-01T00:00:00Z",
      review_evidence: "test:review",
    }).success,
    true,
  );
});

test("enabled metered stop requires nonexpired observed evidence and P-04", () => {
  const value = {
    ...draft("metered-budget"),
    stop_usage_state: "enabled",
    evidence: [
      {
        evidence_link: "test:source",
        source_url: "https://example.test/control",
        retrieval_timestamp: "2020-01-01T00:00:00Z",
        observation: "observed",
      },
    ],
    tests: [
      {
        test_id: "P-04",
        test_result: "pass",
        tested_at: "2020-01-01T00:00:00Z",
        evidence_link: "test:result",
        bounded_population: "local fixture only",
        decision_owner: "Test owner",
      },
    ],
  };
  assert.equal(parse(value).success, false);
  value.evidence[0].valid_until = new Date(Date.now() + 86400000).toISOString();
  assert.equal(parse(value).success, true);
  value.evidence[0].valid_until = "2021-01-01T00:00:00Z";
  assert.equal(parse(value).success, false);
});

test("approved control attributes and original evidence cannot be overwritten", () => {
  const before = {
    ...documentSchema.parse(draft()),
    phase: "Approve",
    ulb_amount_ai_credits: 10,
    evidence: [
      {
        evidence_link: "test:immutable",
        source_url: "https://example.test",
        retrieval_timestamp: "2020-01-01T00:00:00Z",
        observation: "observed",
      },
    ],
  };
  assert.ok(
    validateTransition(before, { ...before, ulb_amount_ai_credits: 20 }).some(
      (message) => message.includes("Material"),
    ),
  );
  assert.ok(
    validateTransition(before, {
      ...before,
      evidence: [{ ...before.evidence[0], source_url: "https://changed.test" }],
    }).some((message) => message.includes("immutable")),
  );
  assert.deepEqual(
    validateTransition(before, { ...before, notes: "A monitoring note" }),
    [],
  );
});

test("cost-center ULB Design needs membership and tenant reset evidence", () => {
  const value = {
    ...draft(),
    phase: "Design",
    ulb_type: "cost-center",
    ulb_amount_ai_credits: 100,
    evidence: [
      {
        evidence_link: "test:baseline",
        source_url: "https://example.test",
        retrieval_timestamp: "2020-01-01T00:00:00Z",
        observation: "observed",
      },
    ],
  };
  assert.equal(parse(value).success, false);
  assert.equal(
    parse({
      ...value,
      membership_evidence: "test:membership",
      reset_evidence: "test:tenant-reset",
    }).success,
    true,
  );
});

test(
  "database atomically saves revisions, rejects conflicts, and isolates tenants",
  { skip: process.env.REGISTER_INTEGRATION !== "1" },
  async () => {
    const {
      registerClient,
      saveRecord,
      getRecord,
      recordHistory,
    } = require("../server/dist/register/store.js");
    const access = {
      actor: "automated-local-test",
      tenant: `test:${randomUUID()}`,
      role: "editor",
    };
    const value = documentSchema.parse({
      ...draft(),
      enterprise_control_id: randomUUID(),
    });
    const saved = await saveRecord(access, value, 0, null);
    assert.equal(saved.revision, 1);
    assert.equal((await recordHistory(access, saved.id)).length, 1);
    const results = await Promise.allSettled([
      saveRecord(access, { ...value, notes: "concurrent one" }, 1, saved.id),
      saveRecord(access, { ...value, notes: "concurrent two" }, 1, saved.id),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal((await recordHistory(access, saved.id)).length, 2);
    assert.equal(
      await getRecord({ ...access, tenant: "different-test-tenant" }, saved.id),
      null,
    );
    await assert.rejects(
      saveRecord(
        { ...access, tenant: "different-test-tenant" },
        value,
        2,
        saved.id,
      ),
    );
    await assert.rejects(
      saveRecord({ ...access, role: "reader" }, value, 2, saved.id),
    );
    await assert.rejects(
      registerClient(access).delete("/revisions", {
        params: { record_id: `eq.${saved.id}` },
      }),
    );
    await assert.rejects(
      registerClient(access).post("/records", {
        tenant_id: access.tenant,
        document: value,
      }),
    );
    await assert.rejects(saveRecord(access, value, 0, null));
  },
);

test("nine typed drafts preserve unknowns and reject foreign fields", () => {
  for (const type of [
    "policy-profile",
    "ULB",
    "entitlement-baseline",
    "included-usage-control",
    "metered-budget",
    "license-baseline",
    "rollout-wave",
    "controlled-test",
    "exception",
  ]) {
    const value = {
      ...draft(type),
      provider_control_id: null,
      ...(type === "policy-profile"
        ? { policy_or_profile: "Test profile", profile_version: 1 }
        : {}),
    };
    assert.equal(parse(value).success, true, type);
    assert.equal(parse({ ...value, tenant_id: "spoofed" }).success, false);
    assert.equal(documentSchema.parse(value).provider_control_id, null);
  }
});
test("ULB amounts are whole non-negative AI Credits", () => {
  for (const value of [-1, 1.5, "20", Infinity])
    assert.equal(
      parse({ ...draft(), ulb_amount_ai_credits: value }).success,
      false,
    );
  assert.equal(parse({ ...draft(), ulb_amount_ai_credits: 0 }).success, true);
});
test("metered amounts must be numeric USD, never text money", () => {
  assert.equal(
    parse({
      ...draft("metered-budget"),
      budget_amount_currency: "20 USD",
      currency: "USD",
    }).success,
    false,
  );
  assert.equal(
    parse({
      ...draft("metered-budget"),
      budget_amount_currency: 20,
      currency: "EUR",
    }).success,
    false,
  );
  assert.equal(
    parse({
      ...draft("metered-budget"),
      budget_amount_currency: 20,
      currency: "USD",
    }).success,
    true,
  );
});
test("included usage and baselines never own Stop usage", () => {
  for (const type of [
    "included-usage-control",
    "entitlement-baseline",
    "license-baseline",
  ])
    assert.equal(
      parse({ ...draft(type), stop_usage_state: "enabled" }).success,
      false,
    );
  assert.equal(
    parse({ ...draft("metered-budget"), stop_usage_state: "enabled" }).success,
    false,
  );
});
test("phase gates require source evidence and production approvals", () => {
  assert.equal(parse({ ...draft(), phase: "Baseline" }).success, false);
  assert.equal(
    parse({ ...draft(), phase: "Approve", production_intended: true }).success,
    false,
  );
  assert.equal(parse({ ...draft(), owner_primary: "" }).success, false);
});
test("thresholds require increasing same-unit values and response ownership", () => {
  const threshold = (value) => ({
    value,
    unit: "%",
    provider_evidence: "test:provider-1",
  });
  const value = {
    ...draft("metered-budget"),
    alert_recipients: ["test-owner"],
    response_sla: "15 minutes",
    alert_thresholds: [threshold(90), threshold(75)],
  };
  assert.equal(parse(value).success, false);
  assert.equal(
    parse({ ...value, alert_thresholds: [threshold(75), threshold(90)] })
      .success,
    true,
  );
});
test("passing tests need timestamped bounded evidence; P-01a is included", () => {
  assert.ok(testIds.includes("P-01a"));
  assert.equal(
    parse({ ...draft(), tests: [{ test_id: "P-01", test_result: "pass" }] })
      .success,
    false,
  );
});
test("exactly seven phases and stable canonical identity", () => {
  assert.deepEqual(phases, [
    "Prepare",
    "Baseline",
    "Design",
    "Approve",
    "Pilot",
    "Rollout",
    "Operate",
  ]);
  const before = documentSchema.parse(draft());
  assert.equal(
    validateTransition(before, { ...before, phase: "Design" }).length,
    1,
  );
  assert.equal(
    validateTransition(before, { ...before, scope_id: "changed" }).length,
    1,
  );
});
test("expired active exceptions rejected and read status dynamically expires", () => {
  const value = {
    ...draft("exception"),
    record_status: "active",
    exception_expiry: "2020-01-01T00:00:00Z",
  };
  assert.equal(parse(value).success, false);
  assert.equal(effectiveStatus(value), "expired");
});
test("rollout closure cannot substitute configured state for effective evidence", () => {
  assert.equal(
    parse({
      ...draft("rollout-wave"),
      record_status: "closed",
      configured_state: "enabled",
      effective_state: "unknown",
    }).success,
    false,
  );
});
