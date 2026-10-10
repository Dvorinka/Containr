import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { ToastProvider } from './shared/components';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Serve the persisted snapshot while offline instead of erroring.
      networkMode: 'offlineFirst',
    },
  },
});

// High-churn or bulky keys never hit localStorage — a stale log tail is
// worse than none.
const NEVER_PERSIST = new Set([
  'auth-session',
  'shell-notifications',
  'notifications',
  'service-logs',
  'logs',
  'activity',
  'audit-logs',
  'audit',
  'metrics',
  'connectivity',
]);

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'containr-query-cache-v1',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === 'success' && !NEVER_PERSIST.has(String(q.queryKey[0])),
        },
      }}
    >
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
