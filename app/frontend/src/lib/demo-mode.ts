import { useSearchParams } from 'react-router-dom';

/**
 * Build-time flag for public demo deployments that ship without a backend
 * (e.g. the Vercel showcase). When enabled every route behaves as if
 * `?demo=1` was passed — fixtures render instead of API calls.
 */
export const PUBLIC_DEMO = (import.meta.env.VITE_PUBLIC_DEMO ?? '') === '1';

export function isDemoSearch(search: string): boolean {
  return PUBLIC_DEMO || new URLSearchParams(search).get('demo') === '1';
}

export function useDemoMode(): boolean {
  const [searchParams] = useSearchParams();
  return PUBLIC_DEMO || searchParams.get('demo') === '1';
}
