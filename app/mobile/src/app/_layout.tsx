import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../session';
import { colors } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, networkMode: 'offlineFirst' },
  },
});

// High-churn keys never hit disk — a stale notification count or log
// tail is worse than none.
const NEVER_PERSIST = new Set(['notifications', 'notification-channels', 'logs', 'connectivity']);

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'containr-query-cache-v1',
});

function AuthGate() {
  const { ready, api } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inLogin = segments[0] === 'login';
    if (api && inLogin) router.replace('/');
  }, [ready, api, segments, router]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!!api}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
        <Stack.Screen name="service/[id]" options={{ title: 'Service' }} />
        <Stack.Screen name="service/logs" options={{ title: 'Logs' }} />
        <Stack.Screen name="service/variables" options={{ title: 'Variables' }} />
        <Stack.Screen name="service/domains" options={{ title: 'Domains' }} />
        <Stack.Screen name="service/cron" options={{ title: 'Cron jobs' }} />
        <Stack.Screen name="service/settings" options={{ title: 'Service settings' }} />
      </Stack.Protected>
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === 'success' && !NEVER_PERSIST.has(String(q.queryKey[0])),
        },
      }}
    >
      <SessionProvider>
        <StatusBar style="light" />
        <AuthGate />
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}
