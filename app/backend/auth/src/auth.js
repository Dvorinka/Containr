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

const githubClientId = env.GITHUB_CLIENT_ID?.trim() || '';
const githubClientSecret = env.GITHUB_CLIENT_SECRET?.trim() || '';
const googleClientId = env.GOOGLE_CLIENT_ID?.trim() || '';
const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim() || '';

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

const trustedOrigins = [
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
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]
  .map((origin) => (origin || '').trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: env.BETTER_AUTH_APP_NAME || 'Containr',
  baseURL: env.BETTER_AUTH_URL || defaultBackendURL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET || 'PLACEHOLDER_BETTER_AUTH_SECRET_CHANGE_ME_32CHARS_MIN',
  trustedOrigins,
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
