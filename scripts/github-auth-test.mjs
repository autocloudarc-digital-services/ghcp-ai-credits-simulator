import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import {
  exchangeCodeForToken,
  getAuthorizationUrl,
  getTokenFromSession,
} from "../server/dist/services/githubAuthService.js";

const require = createRequire(import.meta.url);
const axiosModule = require("axios");
const axios = axiosModule.default ?? axiosModule;

const AUTH_ENVIRONMENT_KEYS = [
  "NODE_ENV",
  "CLIENT_ORIGIN",
  "CALLBACK_URL",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GHCP_APP_CLIENT_ID",
  "GHCP_APP_CLIENT_SECRET",
  "SESSION_SECRET",
  "GHCP_SESSION_SECRET",
];

async function withAuthEnvironment(assertion) {
  const previous = new Map(
    AUTH_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of AUTH_ENVIRONMENT_KEYS) delete process.env[key];
  Object.assign(process.env, {
    NODE_ENV: "development",
    CLIENT_ORIGIN: "http://localhost:5173",
    CALLBACK_URL: "http://localhost:5173/auth/github/callback",
    GITHUB_APP_CLIENT_ID: "github-client-id",
    GITHUB_APP_CLIENT_SECRET: "github-client-secret",
    SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  });

  try {
    await assertion();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("GitHub authorization uses PKCE without legacy OAuth scopes", async () => {
  await withAuthEnvironment(async () => {
    const session = {};
    const authorizationUrl = new URL(getAuthorizationUrl(session));

    assert.equal(authorizationUrl.origin, "https://github.com");
    assert.equal(authorizationUrl.pathname, "/login/oauth/authorize");
    assert.equal(authorizationUrl.searchParams.get("scope"), null);
    assert.equal(
      authorizationUrl.searchParams.get("state"),
      session.oauthState,
    );
    assert.equal(
      authorizationUrl.searchParams.get("code_challenge_method"),
      "S256",
    );
    assert.ok(session.oauthCodeVerifier.length >= 43);
    assert.equal(
      authorizationUrl.searchParams.get("code_challenge"),
      crypto
        .createHash("sha256")
        .update(session.oauthCodeVerifier)
        .digest("base64url"),
    );
  });
});

test("GitHub callback sends the PKCE verifier and clears transient state", async (context) => {
  await withAuthEnvironment(async () => {
    const session = {};
    const authorizationUrl = new URL(getAuthorizationUrl(session));
    const expectedVerifier = session.oauthCodeVerifier;
    const state = authorizationUrl.searchParams.get("state");

    context.mock.method(axios, "post", async (_url, body) => {
      assert.equal(body.code_verifier, expectedVerifier);
      return {
        data: {
          access_token: "github-access-token",
          refresh_token: "github-refresh-token",
          expires_in: 28800,
        },
      };
    });
    context.mock.method(axios, "get", async () => ({
      data: { id: 123456789 },
    }));

    assert.deepEqual(
      await exchangeCodeForToken("authorization-code", state, session),
      {
        success: true,
      },
    );
    assert.equal(session.oauthState, undefined);
    assert.equal(session.oauthCodeVerifier, undefined);
    assert.equal(session.githubUserId, "123456789");
    assert.equal(getTokenFromSession(session), "github-access-token");
  });
});

test("GitHub callback rejects invalid state and clears the PKCE attempt", async () => {
  await withAuthEnvironment(async () => {
    const session = {};
    getAuthorizationUrl(session);

    const result = await exchangeCodeForToken(
      "authorization-code",
      "invalid-state",
      session,
    );
    assert.equal(result.success, false);
    assert.match(result.error, /Invalid or missing OAuth state/);
    assert.equal(session.oauthState, undefined);
    assert.equal(session.oauthCodeVerifier, undefined);
  });
});
