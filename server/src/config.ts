import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const LOCAL_CLIENT_ORIGIN = 'http://localhost:5173';
const GITHUB_CALLBACK_PATH = '/auth/github/callback';

function configuredUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }

  if (url.username || url.password) throw new Error(`${name} must not contain credentials.`);
  if (url.search || url.hash) throw new Error(`${name} must not contain a query string or fragment.`);
  if (url.hostname.includes('*')) throw new Error(`${name} must not contain a wildcard hostname.`);
  return url;
}

function configuredClientOrigin(value: string, production: boolean): string {
  const url = configuredUrl(value, 'CLIENT_ORIGIN');
  if (production && url.protocol !== 'https:') throw new Error('CLIENT_ORIGIN must use HTTPS in production.');
  if (url.pathname !== '/') throw new Error('CLIENT_ORIGIN must contain an origin only, without a path.');
  return url.origin;
}

function configuredCallbackUrl(value: string, clientOrigin: string, production: boolean): string {
  const url = configuredUrl(value, 'CALLBACK_URL');
  if (production && url.protocol !== 'https:') throw new Error('CALLBACK_URL must use HTTPS in production.');
  if (url.origin !== clientOrigin) throw new Error('CALLBACK_URL must use the CLIENT_ORIGIN origin.');
  if (url.pathname !== GITHUB_CALLBACK_PATH) throw new Error(`CALLBACK_URL must use the exact ${GITHUB_CALLBACK_PATH} path.`);
  return url.toString();
}

export function getClientOrigin(): string {
  const production = process.env.NODE_ENV === 'production';
  const configured = process.env.CLIENT_ORIGIN?.trim();
  if (configured) return configuredClientOrigin(configured, production);
  if (production) throw new Error('CLIENT_ORIGIN is required in production.');

  const codespaceName = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespaceName && forwardingDomain) {
    return `https://${codespaceName}-5173.${forwardingDomain}`;
  }

  return LOCAL_CLIENT_ORIGIN;
}

export function getGitHubAppCredentials() {
  const production = process.env.NODE_ENV === 'production';
  const clientOrigin = getClientOrigin();
  const clientId = (process.env.GITHUB_APP_CLIENT_ID ?? process.env.GHCP_APP_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.GITHUB_APP_CLIENT_SECRET ?? process.env.GHCP_APP_CLIENT_SECRET ?? '').trim();
  const configuredCallback = process.env.CALLBACK_URL?.trim();

  if (production && !clientId) throw new Error('GITHUB_APP_CLIENT_ID is required in production.');
  if (production && !clientSecret) throw new Error('GITHUB_APP_CLIENT_SECRET is required in production.');
  if (production && !configuredCallback) throw new Error('CALLBACK_URL is required in production.');

  return {
    clientId,
    clientSecret,
    callbackUrl: configuredCallback
      ? configuredCallbackUrl(configuredCallback, clientOrigin, production)
      : `${clientOrigin}${GITHUB_CALLBACK_PATH}`,
  };
}

export function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET ?? process.env.GHCP_SESSION_SECRET;
  if (configured !== undefined) {
    if (configured.length < 32 || configured === 'insecure-development-secret-change-me') throw new Error('SESSION_SECRET must contain at least 32 characters and must not be the development placeholder.');
    return configured;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production.');
  const directory = path.resolve(__dirname, '../../.local');
  const file = path.join(directory, 'session-secret');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!existsSync(file)) {
    try { writeFileSync(file, randomBytes(48).toString('hex'), { mode: 0o600, flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  const secret = readFileSync(file, 'utf8').trim();
  if (secret.length < 32) throw new Error('The local session encryption secret is invalid.');
  return secret;
}

export function getEnterpriseBillingToken(): string {
  return process.env.GHCP_ENTERPRISE_BILLING_TOKEN?.trim() ?? '';
}