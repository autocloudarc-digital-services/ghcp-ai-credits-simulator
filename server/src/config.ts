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
  return (
    process.env.SESSION_SECRET ??
    process.env.GHCP_SESSION_SECRET ??
    'insecure-development-secret-change-me'
  );
}

export function getEnterpriseBillingToken(): string {
  return process.env.GHCP_ENTERPRISE_BILLING_TOKEN?.trim() ?? '';
}