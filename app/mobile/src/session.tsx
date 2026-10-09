import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Api } from './api';

const KEY_URL = 'containr.server_url';
const KEY_TOKEN = 'containr.token';

interface Session {
  ready: boolean;
  api: Api | null;
  serverUrl: string | null;
  signIn: (serverUrl: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Session>({
  ready: false,
  api: null,
  serverUrl: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function normalizeServerUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, t] = await Promise.all([
          SecureStore.getItemAsync(KEY_URL),
          SecureStore.getItemAsync(KEY_TOKEN),
        ]);
        setServerUrl(u);
        setToken(t);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<Session>(
    () => ({
      ready,
      serverUrl,
      api: serverUrl && token ? new Api(serverUrl, token) : null,
      signIn: async (url, tok) => {
        const normalized = normalizeServerUrl(url);
        await SecureStore.setItemAsync(KEY_URL, normalized);
        await SecureStore.setItemAsync(KEY_TOKEN, tok.trim());
        setServerUrl(normalized);
        setToken(tok.trim());
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(KEY_URL);
        await SecureStore.deleteItemAsync(KEY_TOKEN);
        setServerUrl(null);
        setToken(null);
      },
    }),
    [ready, serverUrl, token],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}

export function useApi(): Api {
  const { api } = useSession();
  if (!api) throw new Error('not signed in');
  return api;
}
