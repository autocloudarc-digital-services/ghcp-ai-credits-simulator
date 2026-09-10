import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const express = require("express");
const request = require("supertest");
const billing = require("../server/dist/services/githubBillingService.js");
const router = require("../server/dist/routes/assessment.js").default;
const { GitHubBillingServiceError } = billing;

async function assess(
  context,
  {
    organizationStatus = 403,
    enterpriseStatus,
    enterpriseUsage = [],
    organizationEnterpriseUsage,
    licenseFailure = false,
    seatInventory,
    memberStatus,
  } = {},
) {
  for (const name of [
    "getEnterpriseOrganizations",
    "getEnterpriseMembers",
    "getEnterpriseTeams",
    "getExistingBudgets",
    "getCostCenters",
    "getOrganizationTeams",
  ]) {
    context.mock.method(billing, name, async () => []);
  }
  context.mock.method(billing, "getOrganizationMembers", async () => {
    if (memberStatus)
      throw new GitHubBillingServiceError(
        `Fixture organization members denied (${memberStatus})`,
        memberStatus,
      );
    return [];
  });
  context.mock.method(billing, "getOrganizationDetails", async () => {
    throw new GitHubBillingServiceError("Fixture details unavailable", 404);
  });
  context.mock.method(billing, "getCopilotLicenseInventory", async () => {
    if (licenseFailure)
      throw new GitHubBillingServiceError(
        "Fixture organization licenses denied",
        403,
      );
    return { sku: "copilot-business", count: 1 };
  });
  context.mock.method(
    billing,
    "getEnterpriseCopilotSeatInventory",
    async (_slug, _session, credential) => {
      assert.equal(credential, "fixture-enterprise-token");
      if (!seatInventory)
        throw new GitHubBillingServiceError(
          "Fixture enterprise seats unavailable",
          403,
        );
      return seatInventory;
    },
  );
  context.mock.method(
    billing,
    "getEnterpriseCopilotLicenseCounts",
    async () => ({}),
  );
  context.mock.method(billing, "getAICreditUsage", async () => {
    throw new GitHubBillingServiceError(
      "Fixture organization usage denied",
      organizationStatus,
    );
  });
  const enterpriseCall = context.mock.method(
    billing,
    "getEnterpriseAICreditUsage",
    async (
      _slug,
      _session,
      _year,
      _month,
      credential,
      _costCenter,
      organization,
    ) => {
      assert.equal(credential, "fixture-enterprise-token");
      if (organization) {
        assert.equal(organization, "fixture-org");
        if (organizationEnterpriseUsage !== undefined)
          return organizationEnterpriseUsage;
        throw new GitHubBillingServiceError(
          "Fixture filtered usage unavailable",
          403,
        );
      }
      if (enterpriseStatus)
        throw new GitHubBillingServiceError(
          `Fixture enterprise usage failure (${enterpriseStatus})`,
          enterpriseStatus,
        );
      return enterpriseUsage;
    },
  );
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.sessionID = "isolated-assessment-test";
    req.session = {
      githubUserId: "999000000000001",
      save: (callback) => callback(),
    };
    next();
  });
  app.use("/assessment", router);
  const started = await request(app)
    .post("/assessment/start")
    .send({
      enterpriseSlug: "fixture-enterprise",
      organizations: ["fixture-org"],
      periodDays: 30,
      enterpriseBillingToken: " fixture-enterprise-token ",
    })
    .expect(202);
  const id = started.body.assessmentId;
  let state;
  for (let attempt = 0; attempt < 20; attempt++) {
    state = (await request(app).get(`/assessment/status/${id}`).expect(200))
      .body;
    if (state.status !== "pending") break;
  }
  assert.notEqual(state.status, "pending");
  const result =
    state.status === "complete"
      ? (await request(app).get(`/assessment/results/${id}`).expect(200)).body
      : null;
  return { state, result, enterpriseCall };
}

test("organization membership denial remains explicit with unknown counts", async (context) => {
  const { result } = await assess(context, { memberStatus: 403 });
  assert.equal(result.organizations[0].memberCount, null);
  assert.ok(
    result.governanceDataWarnings.some(
      (warning) =>
        warning.source === "users" &&
        warning.message.includes("403") &&
        warning.message.includes("not a complete organization member list"),
    ),
  );
});

test("403 diagnostics classify access failures without exposing response bodies or SSO URLs", async (context) => {
  const axios = require("axios");
  const auth = require("../server/dist/services/githubAuthService.js");
  context.mock.method(
    auth,
    "getTokenFromSession",
    () => "fixture-oauth-secret",
  );
  const call = context.mock.method(axios, "get");
  const cases = [
    [{ "x-ratelimit-remaining": "0" }, "denied", /rate limiting/],
    [
      { "x-github-sso": "required; url=https://example.test/private-sso" },
      "denied",
      /SAML SSO/,
    ],
    [{}, "OAuth App access restrictions", /owner must approve/],
    [{}, "Resource not accessible by integration", /GitHub App permissions/],
    [
      {},
      "Resource not accessible by personal access token",
      /personal access token lacks/,
    ],
    [{}, "denied fixture-oauth-secret", /organization membership/],
  ];
  for (const [headers, message, expected] of cases) {
    call.mock.mockImplementation(async () => {
      throw Object.assign(new Error("Request failed with status code 403"), {
        response: { status: 403, headers, data: { message } },
      });
    });
    await assert.rejects(
      billing.getOrganizationMembers("fixture-org", {}),
      (error) => {
        assert.equal(error.status, 403);
        assert.match(error.message, expected);
        assert.ok(!error.message.includes("fixture-oauth-secret"));
        assert.ok(!error.message.includes("private-sso"));
        return true;
      },
    );
  }
});

test("malformed or mismatched enterprise usage is not accepted as zero attribution", async (context) => {
  const axios = require("axios");
  const call = context.mock.method(axios, "get");
  for (const data of [{}, { usageItems: [], organization: "wrong-org" }]) {
    call.mock.mockImplementation(async () => ({ data }));
    await assert.rejects(
      billing.getEnterpriseAICreditUsage(
        "fixture-enterprise",
        {},
        2026,
        9,
        "fixture-token",
        undefined,
        "fixture-org",
      ),
      GitHubBillingServiceError,
    );
  }
});

test("enterprise seat inventory replaces incomplete license totals without adding legacy estimates", async (context) => {
  const { state, result } = await assess(context, {
    licenseFailure: true,
    seatInventory: {
      totalBySku: { "copilot-business": 2, "copilot-enterprise": 1 },
      enterpriseOnlyBySku: { "copilot-business": 1 },
      organizationAssignedBySku: {
        "copilot-business": 1,
        "copilot-enterprise": 1,
      },
      byOrganization: {
        "fixture-org": { "copilot-business": 1, "copilot-enterprise": 1 },
      },
    },
  });
  assert.equal(state.status, "complete");
  assert.equal(result.includedCreditPools[0].totalLicenseCount, 3);
  assert.ok(
    !result.governanceDataWarnings.some(
      (warning) => warning.source === "licenses",
    ),
  );
});

test("failed enterprise seat recovery retains the license warning", async (context) => {
  const { result } = await assess(context, { licenseFailure: true });
  assert.ok(
    result.governanceDataWarnings.some(
      (warning) =>
        warning.source === "licenses" &&
        warning.message.includes("seat fallback failed"),
    ),
  );
});

test("enterprise seats paginate assignment rows and deduplicate users across organizations and teams", async (context) => {
  const axios = require("axios");
  const call = context.mock.method(axios, "get", async (url, options) => {
    assert.equal(
      url,
      "https://api.github.com/enterprises/fixture-enterprise/copilot/billing/seats",
    );
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    const seat = {
      assignee: { id: 1 },
      organization: { login: "fixture-org" },
      plan_type: "business",
    };
    return {
      data: {
        total_seats: 2,
        seats:
          options.params.page === 1
            ? Array.from({ length: 100 }, () => seat)
            : [
                { ...seat, organization: { login: "other-org" } },
                { ...seat, organization: null },
                {
                  assignee: { id: 2 },
                  organization: null,
                  plan_type: "enterprise",
                },
              ],
      },
    };
  });
  const result = await billing.getEnterpriseCopilotSeatInventory(
    "fixture-enterprise",
    {},
    "fixture-token",
  );
  assert.equal(call.mock.callCount(), 2);
  assert.deepEqual(result.totalBySku, {
    "copilot-business": 1,
    "copilot-enterprise": 1,
  });
  assert.deepEqual(result.organizationAssignedBySku, { "copilot-business": 1 });
  assert.deepEqual(result.enterpriseOnlyBySku, { "copilot-enterprise": 1 });
  assert.equal(result.byOrganization["other-org"]["copilot-business"], 1);
});

test("incomplete or ambiguous enterprise seats never become verified license totals", async (context) => {
  const axios = require("axios");
  const call = context.mock.method(axios, "get");
  for (const response of [
    { total_seats: 2, seats: [] },
    { total_seats: 1, seats: [{ assignee: { id: 1 }, plan_type: "unknown" }] },
    { total_seats: 1, seats: [{ assignee: null, plan_type: "business" }] },
    {
      total_seats: 1,
      seats: [
        { assignee: { id: 1 }, plan_type: "business" },
        { assignee: { id: 1 }, plan_type: "enterprise" },
      ],
    },
  ]) {
    call.mock.mockImplementation(async () => ({ data: response }));
    await assert.rejects(
      billing.getEnterpriseCopilotSeatInventory(
        "fixture-enterprise",
        {},
        "fixture-token",
      ),
      GitHubBillingServiceError,
    );
  }
});

test("organization 403 reaches enterprise billing with supplied credential and preserves missing attribution", async (context) => {
  const { state, result, enterpriseCall } = await assess(context, {
    enterpriseUsage: [
      {
        product: "copilot",
        sku: "fixture-sku",
        model: "fixture-model",
        grossQuantity: 120,
        discountQuantity: 100,
        netQuantity: 20,
      },
    ],
  });
  assert.equal(state.status, "complete");
  assert.equal(enterpriseCall.mock.callCount(), 2);
  assert.equal(result.totalCreditsConsumed, 120);
  assert.equal(result.meteredCreditsConsumed, 20);
  assert.deepEqual(result.byOrganization, {});
  assert.deepEqual(result.byModel, { "fixture-model": 120 });
  assert.equal(result.includedCreditPools[0].used, 100);
  assert.ok(
    result.governanceDataWarnings.some(
      (warning) =>
        warning.source === "includedCredits" &&
        warning.message.includes("403") &&
        warning.message.includes("attribution remains unavailable"),
    ),
  );
  assert.ok(!JSON.stringify(result).includes("fixture-enterprise-token"));
});

test("organization and enterprise 403 fail explicitly instead of reporting zero usage", async (context) => {
  const { state, result, enterpriseCall } = await assess(context, {
    enterpriseStatus: 403,
  });
  assert.equal(enterpriseCall.mock.callCount(), 2);
  assert.equal(state.status, "failed");
  assert.equal(result, null);
  assert.match(state.error, /complete usage total cannot be calculated/);
  assert.match(state.error, /Fixture enterprise usage failure/);
});

test("verified empty enterprise usage is a valid zero, not a denied-source zero", async (context) => {
  const { state, result } = await assess(context);
  assert.equal(state.status, "complete");
  assert.equal(result.totalCreditsConsumed, 0);
  assert.deepEqual(result.byOrganization, {});
  assert.ok(
    result.governanceDataWarnings.some((warning) =>
      warning.message.includes("403"),
    ),
  );
});

test("organization authentication failures still fail without being suppressed", async (context) => {
  const { state, enterpriseCall } = await assess(context, {
    organizationStatus: 401,
  });
  assert.equal(state.status, "failed");
  assert.equal(enterpriseCall.mock.callCount(), 0);
});

test("existing organization 404 fallback still uses enterprise usage", async (context) => {
  const { state, result } = await assess(context, { organizationStatus: 404 });
  assert.equal(state.status, "complete");
  assert.ok(
    result.governanceDataWarnings.some((warning) =>
      warning.message.includes("attribution is unavailable"),
    ),
  );
});

test("enterprise organization filter recovers attribution without double-counting the total", async (context) => {
  const entry = {
    product: "copilot",
    sku: "fixture-sku",
    model: "fixture-model",
    grossQuantity: 120,
    discountQuantity: 100,
    netQuantity: 20,
  };
  const { state, result } = await assess(context, {
    enterpriseUsage: [entry],
    organizationEnterpriseUsage: [{ ...entry, grossQuantity: 40 }],
  });
  assert.equal(state.status, "complete");
  assert.equal(result.totalCreditsConsumed, 120);
  assert.deepEqual(result.byOrganization, { "fixture-org": 40 });
  assert.ok(
    !result.governanceDataWarnings.some(
      (warning) => warning.source === "includedCredits",
    ),
  );
});

test("enterprise usage passes organization filtering and the supplied credential to GitHub", async (context) => {
  const axios = require("axios");
  const call = context.mock.method(axios, "get", async (url, options) => {
    assert.equal(
      url,
      "https://api.github.com/enterprises/fixture-enterprise/settings/billing/ai_credit/usage",
    );
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    assert.equal(options.params.organization, "fixture-org");
    assert.equal(options.params.cost_center_id, undefined);
    return { data: { usageItems: [] } };
  });
  assert.deepEqual(
    await billing.getEnterpriseAICreditUsage(
      "fixture-enterprise",
      {},
      2026,
      9,
      "fixture-token",
      undefined,
      "fixture-org",
    ),
    [],
  );
  await assert.rejects(
    billing.getEnterpriseAICreditUsage(
      "fixture-enterprise",
      {},
      2026,
      9,
      "fixture-token",
      undefined,
      "../other",
    ),
  );
  assert.equal(call.mock.callCount(), 1);
});
