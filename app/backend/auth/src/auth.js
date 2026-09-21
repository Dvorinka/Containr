import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import { getMigrations } from 'better-auth/db/migration';

const env = process.env;
const defaultBackendURL = env.BACKEND_URL?.trim() || 'http://localhost:8082';

const asBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const buildPoolConfig = () => {
  const host = env.DB_HOST?.trim();
  const user = env.DB_USER?.trim();
  const password = env.DB_PASSWORD ?? '';
  const database = env.DB_NAME?.trim();

  if (host && user && database) {
    return {
      host,
      port: Number.parseInt(env.DB_PORT || '5432', 10),
      user,
      password,
      database,
    };
  }

  return {
    connectionString: env.DATABASE_URL,
  };
};

const pool = new Pool({
  ...buildPoolConfig(),
});

const database = new PostgresDialect({
  pool,
});

const realCredential = (value) => {
  const trimmed = (value || '').trim();
  return trimmed && !trimmed.startsWith('PLACEHOLDER_') ? trimmed : '';
};

const githubClientId = realCredential(env.GITHUB_CLIENT_ID);
const githubClientSecret = realCredential(env.GITHUB_CLIENT_SECRET);
const googleClientId = realCredential(env.GOOGLE_CLIENT_ID);
const googleClientSecret = realCredential(env.GOOGLE_CLIENT_SECRET);

const socialProviders = {};
if (githubClientId && githubClientSecret) {
  socialProviders.github = {
    clientId: githubClientId,
    clientSecret: githubClientSecret,
    disableImplicitSignUp: true,
  };
}
if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    disableImplicitSignUp: true,
  };
}

const staticTrustedOrigins = [
  ...splitCsv(env.BETTER_AUTH_TRUSTED_ORIGINS),
  env.FRONTEND_URL,
  env.BACKEND_URL,
  env.BETTER_AUTH_URL,
  defaultBackendURL,
  'http://localhost:3000',
  'http://localhost:8082',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]
  .map((origin) => (origin || '').trim())
  .filter(Boolean);

// Self-hosted installs are reached over arbitrary hosts/IPs, so the static
// list above cannot cover them. Trust an Origin only when it matches the
// request's own Host header - that is genuine same-origin traffic (browsers
// cannot forge either header cross-origin). Do NOT consult x-forwarded-host
// here: clients can set it freely.
const resolveTrustedOrigins = (request) => {
  const origins = new Set(staticTrustedOrigins);
  const host = request?.headers?.get('host');
  const origin = request?.headers?.get('origin');
  if (host && origin) {
    try {
      if (new URL(origin).host === host) {
        origins.add(origin);
      }
    } catch {
      // malformed Origin header - leave untrusted
    }
  }
  return [...origins];
};

export const auth = betterAuth({
  appName: env.BETTER_AUTH_APP_NAME || 'Containr',
  baseURL: env.BETTER_AUTH_URL || defaultBackendURL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET || 'PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN',
  trustedOrigins: resolveTrustedOrigins,
  database,
  user: {
    modelName: 'auth_users',
  },
  session: {
    modelName: 'auth_sessions',
  },
  account: {
    modelName: 'auth_accounts',
  },
  verification: {
    modelName: 'auth_verifications',
  },
  rateLimit: {
    modelName: 'auth_rate_limits',
    enabled: asBool(env.BETTER_AUTH_RATE_LIMIT_ENABLED, false),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
});

export async function runAuthMigrations() {
  const { runMigrations } = await getMigrations(auth.options);

  await runMigrations();
}

export async function closeAuthDatabase() {
  await pool.end();
}
