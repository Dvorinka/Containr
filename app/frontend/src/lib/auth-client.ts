export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type AuthSessionPayload = {
  user: AuthUser;
  session: AuthSession;
};

export type AuthBootstrap = {
  hasUsers: boolean;
  userCount: number;
  mode: 'register' | 'login';
};

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const rawAuthBase = (import.meta.env.VITE_AUTH_URL as string | undefined) ?? 'http://localhost:8082/api/auth';
const AUTH_BASE = rawAuthBase.replace(/\/$/, '');

export function getAuthBaseUrl(): string {
  return AUTH_BASE;
}

export async function getAuthBootstrap(): Promise<AuthBootstrap> {
  const apiBase = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8082').replace(/\/$/, '');
  const normalizedApiBase = /\/api\/v1$/.test(apiBase) ? apiBase : `${apiBase}/api/v1`;
  const response = await fetch(`${normalizedApiBase}/auth/bootstrap`, {
    method: 'GET',
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const message =
      (payload?.message as string | undefined) ??
      (payload?.error as string | undefined) ??
      `Auth bootstrap request failed with status ${response.status}`;
    throw new AuthError(message, response.status);
  }

  return {
    hasUsers: Boolean(payload?.has_users),
    userCount: typeof payload?.user_count === 'number' ? payload.user_count : 0,
    mode: payload?.mode === 'register' ? 'register' : 'login',
  };
}

function normalizeSessionPayload(payload: unknown): AuthSessionPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const source = (objectPayload.data as Record<string, unknown> | undefined) ?? objectPayload;
  const user = source.user as Record<string, unknown> | undefined;
  const session = source.session as Record<string, unknown> | undefined;

  if (!user || !session || typeof user.id !== 'string' || typeof user.email !== 'string' || typeof user.name !== 'string' || typeof session.id !== 'string' || typeof session.userId !== 'string' || typeof session.expiresAt !== 'string') {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: typeof user.image === 'string' ? user.image : null,
    },
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    },
  };
}

async function authRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${AUTH_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const objectPayload = payload as Record<string, unknown> | null;
    const message =
      (objectPayload?.message as string | undefined) ??
      (objectPayload?.error as string | undefined) ??
      `Auth request failed with status ${response.status}`;

    throw new AuthError(message, response.status);
  }

  return payload;
}

function parseOAuthRedirectPayload(payload: unknown): { url: string; redirect: boolean } {
  if (!payload || typeof payload !== 'object') {
    throw new AuthError('Invalid OAuth response payload', 500);
  }

  const objectPayload = payload as Record<string, unknown>;
  const source = (objectPayload.data as Record<string, unknown> | undefined) ?? objectPayload;
  const url = source.url;
  const redirect = source.redirect;

  if (typeof url !== 'string' || !url.trim()) {
    throw new AuthError('OAuth redirect URL missing in response', 500);
  }

  return {
    url,
    redirect: redirect !== false,
  };
}

export async function getAuthSession(): Promise<AuthSessionPayload | null> {
  const response = await fetch(`${AUTH_BASE}/get-session`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const objectPayload = payload as Record<string, unknown> | null;
    const message =
      (objectPayload?.message as string | undefined) ??
      (objectPayload?.error as string | undefined) ??
      `Auth session request failed with status ${response.status}`;

    throw new AuthError(message, response.status);
  }

  return normalizeSessionPayload(payload);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthSessionPayload | null> {
  const payload = await authRequest('/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });

  return normalizeSessionPayload(payload);
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<AuthSessionPayload | null> {
  const payload = await authRequest('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });

  return normalizeSessionPayload(payload);
}

export async function startGitHubSignIn(callbackURL: string): Promise<void> {
  const payload = await authRequest('/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'github',
      callbackURL,
      disableRedirect: true,
    }),
  });

  const oauth = parseOAuthRedirectPayload(payload);
  if (oauth.redirect) {
    window.location.assign(oauth.url);
  }
}

export async function startGoogleSignIn(callbackURL: string): Promise<void> {
  const payload = await authRequest('/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      callbackURL,
      disableRedirect: true,
    }),
  });

  const oauth = parseOAuthRedirectPayload(payload);
  if (oauth.redirect) {
    window.location.assign(oauth.url);
  }
}

export async function signOutAuthSession(): Promise<void> {
  await authRequest('/sign-out', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
