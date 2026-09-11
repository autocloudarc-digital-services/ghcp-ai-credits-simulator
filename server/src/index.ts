import path from 'path';
import cors from 'cors';
import express from 'express';
import session, { type Store } from 'express-session';
import rateLimit from 'express-rate-limit';
import { csrf } from 'lusca';
import authRoutes from './routes/auth';
import assessmentRoutes, { interruptActiveAssessments } from './routes/assessment';
import reportRoutes from './routes/report';
import registerRoutes from './register/routes';
import workflowRoutes from './routes/workflow';
import { PostgresSessionStore } from './persistence/sessionStore';
import { checkPersistenceReadiness } from './persistence/client';
import { requireAuth } from './middleware/requireAuth';
import { getClientOrigin, getGitHubAppCredentials, getSessionSecret } from './config';
import { registerSettings } from './register/store';

interface AppOptions {
  clientOrigin?: string;
  sessionSecret?: string;
  sessionStore?: Store;
  readinessCheck?: () => Promise<void>;
  production?: boolean;
  validateProductionConfiguration?: boolean;
  clientDistPath?: string;
  globalRateLimitMax?: number;
}

interface StartOptions {
  app?: express.Express;
  sessionStore?: Store & { prune(): Promise<void> };
  port?: number;
  cleanupIntervalMs?: number;
  shutdownTimeoutMs?: number;
  registerSignalHandlers?: boolean;
  interruptAssessments?: () => Promise<{ attempted: number; failed: number }>;
}

export interface ShutdownReport {
  signal: string;
  interruptedAssessments: number;
  failedInterruptionUpdates: number;
  timedOut: boolean;
}

export function productionClientDistPath(): string {
  return path.resolve(__dirname, '../../client/dist');
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const readinessCheck = options.readinessCheck ?? checkPersistenceReadiness;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      await readinessCheck();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not-ready' });
    }
  });

  const clientOrigin = options.clientOrigin ?? getClientOrigin();
  const sessionSecret = options.sessionSecret ?? getSessionSecret();
  if (production && options.validateProductionConfiguration !== false) {
    getGitHubAppCredentials();
    registerSettings();
  }
  const sessionStore = options.sessionStore ?? new PostgresSessionStore(sessionSecret);

  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));

  app.use(
    session({
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: production,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8,
      },
    })
  );

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: options.globalRateLimitMax ?? 300, standardHeaders: true, legacyHeaders: false }));

  app.use(csrf());

  const authRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

  app.use('/auth', authRateLimiter, authRoutes);
  app.use('/api/assessment', requireAuth, assessmentRoutes);
  app.use('/api/report', requireAuth, reportRoutes);
  app.use('/api/register', requireAuth, registerRoutes);
  app.use('/api/workflow', requireAuth, workflowRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }));

  if (production) {
    const clientDistPath = options.clientDistPath ?? productionClientDistPath();
    app.use(express.static(clientDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use((err: Error & { status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (!production) console.error(err);
    const status = err.status || err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
    const message = production && status >= 500 ? 'Internal server error' : err.message || 'Internal server error';
    res.status(status).json({ message });
  });

  return app;
}

export function startServer(options: StartOptions = {}) {
  const port = options.port ?? (Number(process.env.PORT) || 3001);
  let maintainedStore = options.sessionStore;
  let app = options.app;
  if (!app) {
    const sessionSecret = getSessionSecret();
    maintainedStore = maintainedStore ?? new PostgresSessionStore(sessionSecret);
    app = createApp({ sessionSecret, sessionStore: maintainedStore });
  }
  const server = app.listen(port, () => console.log(`GHCP AI Credits Simulator server listening on port ${port}`));
  const cleanupInterval = maintainedStore
    ? setInterval(() => { void maintainedStore?.prune().catch(() => console.error('Expired-session cleanup failed.')); }, options.cleanupIntervalMs ?? 60 * 60 * 1000)
    : undefined;
  cleanupInterval?.unref();
  let shutdownPromise: Promise<ShutdownReport> | undefined;

  const shutdown = (signal = 'manual'): Promise<ShutdownReport> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      if (cleanupInterval) clearInterval(cleanupInterval);
      process.off('SIGTERM', handleSigterm);
      process.off('SIGINT', handleSigint);

      const closePromise = new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeIdleConnections?.();
      });
      const interruptionPromise = (options.interruptAssessments ?? interruptActiveAssessments)();
      let timeout: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        timeout = setTimeout(() => resolve('timeout'), options.shutdownTimeoutMs ?? 25000);
        timeout.unref();
      });
      const completed = Promise.all([closePromise, interruptionPromise]);
      const outcome = await Promise.race([completed, timeoutPromise]);
      if (timeout) clearTimeout(timeout);
      if (outcome === 'timeout') {
        server.closeAllConnections?.();
        return { signal, interruptedAssessments: 0, failedInterruptionUpdates: 0, timedOut: true };
      }
      const [, interruption] = outcome;
      return {
        signal,
        interruptedAssessments: interruption.attempted,
        failedInterruptionUpdates: interruption.failed,
        timedOut: false,
      };
    })();
    return shutdownPromise;
  };

  const handleSignal = (signal: 'SIGTERM' | 'SIGINT') => {
    void shutdown(signal).then((report) => {
      console.log(`Shutdown complete; ${report.interruptedAssessments} active assessment(s) marked interrupted.`);
      if (report.timedOut || report.failedInterruptionUpdates > 0) process.exitCode = 1;
    }).catch(() => {
      console.error('Graceful shutdown failed.');
      process.exitCode = 1;
    });
  };
  const handleSigterm = () => handleSignal('SIGTERM');
  const handleSigint = () => handleSignal('SIGINT');
  if (options.registerSignalHandlers !== false) {
    process.once('SIGTERM', handleSigterm);
    process.once('SIGINT', handleSigint);
  }

  return { app, server, shutdown };
}

if (require.main === module) startServer();

export default createApp;
