import 'dotenv/config';
import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { auth, closeAuthDatabase, runAuthMigrations } from './auth.js';

const app = express();
const port = Number.parseInt(process.env.AUTH_PORT || '3001', 10);
const internalToken = process.env.BETTER_AUTH_INTERNAL_TOKEN || '';
const autoMigrate = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.BETTER_AUTH_AUTO_MIGRATE || 'true').toLowerCase(),
);

const authHandler = toNodeHandler(auth);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'containr-auth',
  });
});

app.get('/internal/session', async (req, res) => {
  if (!internalToken || req.header('x-containr-auth-internal') !== internalToken) {
    return res.status(401).json({
      authenticated: false,
      error: 'Unauthorized',
    });
  }

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user || !session?.session) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      user: session.user,
      session: session.session,
    });
  } catch (error) {
    console.error('[better-auth] failed to get session', error);
    return res.status(500).json({
      authenticated: false,
      error: 'Failed to verify session',
    });
  }
});

app.all('/api/auth', (req, res) => authHandler(req, res));
app.all('/api/auth/*', (req, res) => authHandler(req, res));

let shuttingDown = false;

const server = app.listen(port, async () => {
  if (autoMigrate) {
    try {
      await runAuthMigrations();
      console.log('[better-auth] migrations completed');
    } catch (error) {
      console.warn('[better-auth] migration skipped due to adapter limitations', error);
    }
  }
  console.log(`[better-auth] ready on :${port}`);
});

const shutdown = async () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  server.close(async () => {
    await closeAuthDatabase();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
