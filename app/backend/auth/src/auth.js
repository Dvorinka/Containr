import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins/magic-link';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
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

const gitlabClientId = env.GITLAB_CLIENT_ID?.trim() || 'PLACEHOLDER_GITLAB_CLIENT_ID';
const gitlabClientSecret = env.GITLAB_CLIENT_SECRET?.trim() || 'PLACEHOLDER_GITLAB_CLIENT_SECRET';
const gitlabAuthorizeUrl =
  env.GITLAB_OAUTH_AUTHORIZE_URL?.trim() || 'https://gitlab.com/oauth/authorize';
const gitlabTokenUrl = env.GITLAB_OAUTH_TOKEN_URL?.trim() || 'https://gitlab.com/oauth/token';
const gitlabUserUrl = env.GITLAB_OAUTH_USERINFO_URL?.trim() || 'https://gitlab.com/api/v4/user';

const giteaClientId = env.GITEA_CLIENT_ID?.trim() || 'PLACEHOLDER_GITEA_CLIENT_ID';
const giteaClientSecret = env.GITEA_CLIENT_SECRET?.trim() || 'PLACEHOLDER_GITEA_CLIENT_SECRET';
const giteaAuthorizeUrl =
  env.GITEA_OAUTH_AUTHORIZE_URL?.trim() ||
  'https://gitea.example.com/login/oauth/authorize';
const giteaTokenUrl =
  env.GITEA_OAUTH_TOKEN_URL?.trim() ||
  'https://gitea.example.com/login/oauth/access_token';
const giteaUserUrl = env.GITEA_OAUTH_USERINFO_URL?.trim() || 'https://gitea.example.com/api/v1/user';

const bitbucketClientId = env.BITBUCKET_CLIENT_ID?.trim() || 'PLACEHOLDER_BITBUCKET_CLIENT_ID';
const bitbucketClientSecret =
  env.BITBUCKET_CLIENT_SECRET?.trim() || 'PLACEHOLDER_BITBUCKET_CLIENT_SECRET';
const bitbucketAuthorizeUrl =
  env.BITBUCKET_OAUTH_AUTHORIZE_URL?.trim() || 'https://bitbucket.org/site/oauth2/authorize';
const bitbucketTokenUrl =
  env.BITBUCKET_OAUTH_TOKEN_URL?.trim() || 'https://bitbucket.org/site/oauth2/access_token';
const bitbucketUserUrl =
  env.BITBUCKET_OAUTH_USERINFO_URL?.trim() || 'https://api.bitbucket.org/2.0/user';
const bitbucketEmailsUrl =
  env.BITBUCKET_OAUTH_EMAILS_URL?.trim() || 'https://api.bitbucket.org/2.0/user/emails';

const socialProviders = {};
if (githubClientId && githubClientSecret) {
  socialProviders.github = {
    clientId: githubClientId,
    clientSecret: githubClientSecret,
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
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token, metadata }) => {
        const payload = {
          email,
          url,
          token,
          metadata,
        };
        console.log('[better-auth] magic-link', JSON.stringify(payload));
      },
      disableSignUp: false,
    }),
    genericOAuth({
      config: [
        {
          providerId: 'gitlab',
          clientId: gitlabClientId,
          clientSecret: gitlabClientSecret,
          authorizationUrl: gitlabAuthorizeUrl,
          tokenUrl: gitlabTokenUrl,
          userInfoUrl: gitlabUserUrl,
          scopes: ['read_user', 'read_api'],
          getUserInfo: async (tokens) => {
            if (!tokens.accessToken) {
              return null;
            }

            const response = await fetch(gitlabUserUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            if (!response.ok) {
              return null;
            }

            const profile = await response.json();
            if (!profile || (!profile.id && !profile.username)) {
              return null;
            }

            return {
              id: profile.id || profile.username,
              email: profile.email || null,
              name: profile.name || profile.username || 'GitLab User',
              image: profile.avatar_url || null,
              emailVerified: Boolean(profile.email),
            };
          },
        },
        {
          providerId: 'gitea',
          clientId: giteaClientId,
          clientSecret: giteaClientSecret,
          authorizationUrl: giteaAuthorizeUrl,
          tokenUrl: giteaTokenUrl,
          userInfoUrl: giteaUserUrl,
          scopes: ['read:user', 'read:repository'],
          getUserInfo: async (tokens) => {
            if (!tokens.accessToken) {
              return null;
            }

            const response = await fetch(giteaUserUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `token ${tokens.accessToken}`,
              },
            });

            if (!response.ok) {
              return null;
            }

            const profile = await response.json();
            if (!profile || (!profile.id && !profile.login)) {
              return null;
            }

            return {
              id: profile.id || profile.login,
              email: profile.email || null,
              name: profile.full_name || profile.login || 'Gitea User',
              image: profile.avatar_url || null,
              emailVerified: Boolean(profile.email),
            };
          },
        },
        {
          providerId: 'bitbucket',
          clientId: bitbucketClientId,
          clientSecret: bitbucketClientSecret,
          authorizationUrl: bitbucketAuthorizeUrl,
          tokenUrl: bitbucketTokenUrl,
          userInfoUrl: bitbucketUserUrl,
          scopes: ['account', 'email', 'repository'],
          getUserInfo: async (tokens) => {
            if (!tokens.accessToken) {
              return null;
            }

            const userResponse = await fetch(bitbucketUserUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            if (!userResponse.ok) {
              return null;
            }

            const user = await userResponse.json();
            if (!user || (!user.account_id && !user.username && !user.nickname)) {
              return null;
            }

            let primaryEmail = null;
            const emailsResponse = await fetch(bitbucketEmailsUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });
            if (emailsResponse.ok) {
              const emailsPayload = await emailsResponse.json();
              const values = Array.isArray(emailsPayload?.values) ? emailsPayload.values : [];
              const primary = values.find((entry) => entry?.is_primary) || values[0];
              if (primary && typeof primary.email === 'string') {
                primaryEmail = primary.email;
              }
            }

            return {
              id: user.account_id || user.username || user.nickname,
              email: primaryEmail,
              name: user.display_name || user.nickname || 'Bitbucket User',
              image: user?.links?.avatar?.href || null,
              emailVerified: Boolean(primaryEmail),
            };
          },
        },
      ],
    }),
  ],
});

export async function runAuthMigrations() {
  const { runMigrations } = await getMigrations(auth.options);

  await runMigrations();
}

export async function closeAuthDatabase() {
  await pool.end();
}
