import { Router } from 'express';
import {
  exchangeCodeForToken,
  getAuthorizationUrl,
  isAuthenticated,
  revokeToken,
} from '../services/githubAuthService';

const router = Router();

// GET /auth/csrf-token - returns the per-session CSRF token issued by the
// `lusca.csrf()` middleware (mounted globally in index.ts) via
// `res.locals._csrf`. The client must echo this value back in the
// X-CSRF-Token header on any state-changing request.
router.get('/csrf-token', (_req, res) => {
  res.json({ csrfToken: res.locals._csrf });
});

// GET /auth/github - redirect to GitHub OAuth authorization page.
router.get('/github', (req, res) => {
  const url = getAuthorizationUrl(req.session);
  res.redirect(url);
});

// GET /auth/github/callback - handle the OAuth callback and exchange the
// authorization code for an access token, stored encrypted server-side.
router.get('/github/callback', async (req, res) => {
  const { code, state, enterprise } = req.query;

  if (typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send('Missing OAuth code or state parameter.');
    return;
  }

  const result = await exchangeCodeForToken(code, state, req.session);
  if (!result.success) {
    res.status(400).send(`GitHub authentication failed: ${result.error}`);
    return;
  }

  req.session.enterprise = typeof enterprise === 'string' ? enterprise : 'connected-enterprise';
  res.redirect('/');
});

// GET /auth/status - lets the client know (without ever exposing the token)
// whether the current session is authenticated.
router.get('/status', (req, res) => {
  res.json({
    connected: isAuthenticated(req.session),
    enterprise: req.session.enterprise ?? null,
  });
});

// POST /auth/logout - revoke the token with GitHub and clear session state.
router.post('/logout', async (req, res) => {
  await revokeToken(req.session);
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
