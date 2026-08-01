import path from 'path';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { csrf } from 'lusca';
import authRoutes from './routes/auth';
import assessmentRoutes from './routes/assessment';
import reportRoutes from './routes/report';
import { requireAuth } from './middleware/requireAuth';
import { getClientOrigin, getSessionSecret } from './config';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = getClientOrigin();

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

app.use(
  session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Global rate limit covers static assets, the SPA catch-all, and API
// routes alike; the /auth mount below layers a stricter limit on top.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Double-submit CSRF check (lusca) for all state-changing (non-GET/HEAD/
// OPTIONS) requests. The token is exposed to the client via
// GET /auth/csrf-token (res.locals._csrf) and must be echoed back in the
// X-CSRF-Token header.
app.use(csrf());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

const authRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

app.use('/auth', authRateLimiter, authRoutes);
app.use('/api/assessment', requireAuth, assessmentRoutes);
app.use('/api/report', requireAuth, reportRoutes);

if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized error handler (must be registered last, with 4 args). Ensures
// failures -- including lusca's CSRF rejections, which set `res.statusCode`
// directly rather than an `err.status` property -- return a clean JSON
// response instead of Express's default HTML page, which would otherwise
// leak internal file paths and stack traces to the client.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  const status = err.status || err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  res.status(status).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GHCP AI Credits Simulator server listening on port ${PORT}`);
});

export default app;
