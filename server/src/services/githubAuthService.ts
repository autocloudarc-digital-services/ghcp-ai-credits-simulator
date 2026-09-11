import crypto from 'crypto';
import axios from 'axios';
import { Session } from 'express-session';
import { getGitHubAppCredentials, getSessionSecret } from '../config';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    oauthCodeVerifier?: string;
    encryptedToken?: { iv: string; authTag: string; data: string };
    enterprise?: string;
    tokenObtainedAt?: number;
    tokenExpiresIn?: number;
    refreshToken?: string;
    assessmentCompleted?: boolean;
    githubUserId?: string;
  }
}

const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_BASE_URL = 'https://api.github.com';

function sessionData(session: Session): Session & Partial<import('express-session').SessionData> {
  return session as Session & Partial<import('express-session').SessionData>;
}

function clearOAuthAttempt(session: Session): void {
  const data = sessionData(session);
  delete data.oauthState;
  delete data.oauthCodeVerifier;
}

function matchingState(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

/**
 * Derives a stable 32-byte AES key from the SESSION_SECRET environment
 * variable so OAuth access tokens can be encrypted at rest within the
 * server-side session store.
 */
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(getSessionSecret()).digest();
}

function encryptToken(token: string): { iv: string; authTag: string; data: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), authTag: authTag.toString('hex'), data: encrypted.toString('hex') };
}

function decryptToken(payload: { iv: string; authTag: string; data: string }): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(payload.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Builds the GitHub OAuth authorization URL, generating and stashing a CSRF
 * state token on the provided session. The state must be validated on the
 * callback before an authorization code is exchanged for a token.
 */
export function getAuthorizationUrl(session: Session): string {
  const { clientId, clientSecret, callbackUrl } = getGitHubAppCredentials();
  if (!clientId || !clientSecret) {
    const missingVariables = [
      !clientId && 'GITHUB_APP_CLIENT_ID (or GHCP_APP_CLIENT_ID)',
      !clientSecret && 'GITHUB_APP_CLIENT_SECRET (or GHCP_APP_CLIENT_SECRET)',
    ].filter(Boolean);
    const error = new Error(`GitHub OAuth is not configured. Missing ${missingVariables.join(' and ')}.`);
    Object.assign(error, { status: 503 });
    throw error;
  }

  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const data = sessionData(session);
  data.oauthState = state;
  data.oauthCodeVerifier = codeVerifier;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${GITHUB_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchanges an OAuth authorization code for an access token, validating the
 * CSRF state parameter first. The resulting token is encrypted and stored
 * server-side on the session; it is never returned to the caller/browser.
 */
export async function exchangeCodeForToken(
  code: string,
  state: string,
  session: Session
): Promise<{ success: boolean; error?: string }> {
  const data = sessionData(session);
  const sessionState = data.oauthState;
  const codeVerifier = data.oauthCodeVerifier;
  if (!sessionState || !codeVerifier || !matchingState(sessionState, state)) {
    clearOAuthAttempt(session);
    return { success: false, error: 'Invalid or missing OAuth state parameter (possible CSRF attempt).' };
  }

  try {
    const { clientId, clientSecret, callbackUrl } = getGitHubAppCredentials();
    const response = await axios.post(
      GITHUB_OAUTH_TOKEN_URL,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
        code_verifier: codeVerifier,
      },
      { headers: { Accept: 'application/json' } }
    );

    if (response.data.error) {
      return { success: false, error: response.data.error_description || response.data.error };
    }

    const accessToken: string = response.data.access_token;
    if (!accessToken) {
      return { success: false, error: 'GitHub did not return an access token.' };
    }

    const identity = await axios.get(`${GITHUB_API_BASE_URL}/user`, { timeout: 10000, headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' } });
    if (!Number.isSafeInteger(identity.data.id) || identity.data.id <= 0) throw new Error('GitHub identity could not be verified.');
    (session as Session & Partial<import('express-session').SessionData>).githubUserId = String(identity.data.id);
    (session as any).encryptedToken = encryptToken(accessToken);
    (session as any).refreshToken = response.data.refresh_token;
    (session as any).tokenObtainedAt = Date.now();
    (session as any).tokenExpiresIn = response.data.expires_in;

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to exchange authorization code for an access token.' };
  } finally {
    clearOAuthAttempt(session);
  }
}

/**
 * Retrieves the decrypted access token from the session, if present.
 * This function is the only place tokens are decrypted, and the result
 * should never be sent back to the client.
 */
export function getTokenFromSession(session: Session): string | null {
  const encrypted = (session as any).encryptedToken;
  if (!encrypted) return null;
  try {
    return decryptToken(encrypted);
  } catch {
    return null;
  }
}

/**
 * Refreshes the OAuth token for a session if it is close to expiring and a
 * refresh token is available. GitHub Apps issue expiring user tokens when
 * configured to do so; this is a no-op for non-expiring tokens.
 */
export async function refreshTokenIfNeeded(
  session: Session
): Promise<void> {
  const obtainedAt = (session as any).tokenObtainedAt as number | undefined;
  const expiresIn = (session as any).tokenExpiresIn as number | undefined;
  const refreshToken = (session as any).refreshToken as string | undefined;

  if (!obtainedAt || !expiresIn || !refreshToken) return;

  const expiresAt = obtainedAt + expiresIn * 1000;
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() < expiresAt - bufferMs) return;

  const { clientId, clientSecret } = getGitHubAppCredentials();
  try {
    const response = await axios.post(
      GITHUB_OAUTH_TOKEN_URL,
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      { headers: { Accept: 'application/json' } }
    );

    if (response.data.access_token) {
      (session as any).encryptedToken = encryptToken(response.data.access_token);
      (session as any).refreshToken = response.data.refresh_token ?? refreshToken;
      (session as any).tokenObtainedAt = Date.now();
      (session as any).tokenExpiresIn = response.data.expires_in;
    }
  } catch {
    // If refresh fails, leave the existing (possibly expired) token in place;
    // downstream API calls will surface a 401 and prompt re-authentication.
  }
}

/**
 * Revokes the OAuth token associated with the session and clears all
 * auth-related session state.
 */
export async function revokeToken(session: Session): Promise<void> {
  const token = getTokenFromSession(session);
  const { clientId, clientSecret } = getGitHubAppCredentials();

  if (token && clientId && clientSecret) {
    try {
      await axios.delete(`${GITHUB_API_BASE_URL}/applications/${clientId}/token`, {
        auth: { username: clientId, password: clientSecret },
        data: { access_token: token },
        headers: { Accept: 'application/vnd.github+json' },
      });
    } catch {
      // Best-effort revocation; continue clearing local session state regardless.
    }
  }

  delete (session as any).encryptedToken;
  delete (session as any).refreshToken;
  delete (session as any).enterprise;
  delete (session as any).tokenObtainedAt;
  delete (session as any).tokenExpiresIn;
  clearOAuthAttempt(session);
}

export function isAuthenticated(session: Session): boolean {
  return Boolean(getTokenFromSession(session));
}
