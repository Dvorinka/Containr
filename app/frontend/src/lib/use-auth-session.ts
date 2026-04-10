import { useQuery } from '@tanstack/react-query';
import { getAuthSession } from '@/lib/auth-client';

type UseAuthSessionOptions = {
  enabled?: boolean;
};

export function useAuthSession(options: UseAuthSessionOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['auth-session'],
    queryFn: getAuthSession,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
