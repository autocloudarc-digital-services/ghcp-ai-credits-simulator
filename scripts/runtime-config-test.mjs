import assert from "node:assert/strict";
import test from "node:test";
import {
  getClientOrigin,
  getGitHubAppCredentials,
} from "../server/dist/config.js";
import { registerSettings } from "../server/dist/register/store.js";

const CONFIG_ENVIRONMENT_KEYS = [
  "NODE_ENV",
  "CLIENT_ORIGIN",
  "CALLBACK_URL",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GHCP_APP_CLIENT_ID",
  "GHCP_APP_CLIENT_SECRET",
  "CODESPACE_NAME",
  "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN",
  "REGISTER_GATEWAY_URL",
  "REGISTER_JWT_SECRET",
];

function withEnvironment(values, assertion) {
  const previous = new Map(
    CONFIG_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of CONFIG_ENVIRONMENT_KEYS) delete process.env[key];
  Object.assign(process.env, values);

  try {
    assertion();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const validProductionEnvironment = {
  NODE_ENV: "production",
  CLIENT_ORIGIN: "https://credits.example.com",
  CALLBACK_URL: "https://credits.example.com/auth/github/callback",
  GITHUB_APP_CLIENT_ID: "github-client-id",
  GITHUB_APP_CLIENT_SECRET: "github-client-secret",
};

test("production requires an explicit HTTPS client origin", () => {
  withEnvironment({ NODE_ENV: "production" }, () => {
    assert.throws(() => getClientOrigin(), /CLIENT_ORIGIN is required/);
  });

  withEnvironment(
    { NODE_ENV: "production", CLIENT_ORIGIN: "http://credits.example.com" },
    () => {
      assert.throws(() => getClientOrigin(), /must use HTTPS/);
    },
  );
});

test("production accepts an exact same-origin GitHub callback", () => {
  withEnvironment(validProductionEnvironment, () => {
    assert.deepEqual(getGitHubAppCredentials(), {
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      callbackUrl: "https://credits.example.com/auth/github/callback",
    });
  });
});

test("production rejects unsafe client origins", () => {
  for (const origin of [
    "https://user:password@credits.example.com",
    "https://credits.example.com/app",
    "https://credits.example.com?source=test",
    "https://*.example.com",
  ]) {
    withEnvironment(
      { ...validProductionEnvironment, CLIENT_ORIGIN: origin },
      () => {
        assert.throws(() => getClientOrigin());
      },
    );
  }
});

test("production rejects callbacks outside the exact configured route", () => {
  for (const callbackUrl of [
    "https://other.example.com/auth/github/callback",
    "https://credits.example.com/auth/github/callback/extra",
    "https://credits.example.com/auth/github/callback?source=test",
    "https://user:password@credits.example.com/auth/github/callback",
  ]) {
    withEnvironment(
      { ...validProductionEnvironment, CALLBACK_URL: callbackUrl },
      () => {
        assert.throws(() => getGitHubAppCredentials());
      },
    );
  }
});

test("production requires GitHub credentials and an explicit callback", () => {
  for (const missing of [
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "CALLBACK_URL",
  ]) {
    const environment = { ...validProductionEnvironment };
    delete environment[missing];
    withEnvironment(environment, () => {
      assert.throws(
        () => getGitHubAppCredentials(),
        /is required in production/,
      );
    });
  }
});

test("development keeps the local callback fallback", () => {
  withEnvironment({}, () => {
    assert.equal(getClientOrigin(), "http://localhost:5173");
    assert.equal(
      getGitHubAppCredentials().callbackUrl,
      "http://localhost:5173/auth/github/callback",
    );
  });
});

test("production requires an explicit register gateway", () => {
  withEnvironment(
    { NODE_ENV: "production", REGISTER_JWT_SECRET: "a".repeat(32) },
    () => {
      assert.throws(
        () => registerSettings(),
        /REGISTER_GATEWAY_URL is required/,
      );
    },
  );
});

test("production permits HTTPS or numeric loopback register gateways", () => {
  for (const gatewayUrl of [
    "https://postgrest.internal.example",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ]) {
    withEnvironment(
      {
        NODE_ENV: "production",
        REGISTER_JWT_SECRET: "a".repeat(32),
        REGISTER_GATEWAY_URL: gatewayUrl,
      },
      () => {
        assert.equal(registerSettings().url, new URL(gatewayUrl).origin);
      },
    );
  }
});

test("production rejects unsafe register gateways", () => {
  for (const gatewayUrl of [
    "http://postgrest.internal.example",
    "http://localhost:3000",
    "https://user:password@postgrest.internal.example",
    "https://postgrest.internal.example/api",
    "https://postgrest.internal.example?tenant=test",
    "https://*.internal.example",
    "not-a-url",
  ]) {
    withEnvironment(
      {
        NODE_ENV: "production",
        REGISTER_JWT_SECRET: "a".repeat(32),
        REGISTER_GATEWAY_URL: gatewayUrl,
      },
      () => {
        assert.throws(() => registerSettings());
      },
    );
  }
});
