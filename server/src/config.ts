import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const LOCAL_CLIENT_ORIGIN = 'http://localhost:5173';

export function getClientOrigin(): string {
  if (process.env.CLIENT_ORIGIN) {
    return process.env.CLIENT_ORIGIN.replace(/\/$/, '');
  }

  const codespaceName = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespaceName && forwardingDomain) {
    return `https://${codespaceName}-5173.${forwardingDomain}`;
  }

  return LOCAL_CLIENT_ORIGIN;
}

export function getGitHubAppCredentials() {
  return {
    clientId: process.env.GITHUB_APP_CLIENT_ID ?? process.env.GHCP_APP_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET ?? process.env.GHCP_APP_CLIENT_SECRET ?? '',
    callbackUrl: process.env.CALLBACK_URL ?? `${getClientOrigin()}/auth/github/callback`,
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