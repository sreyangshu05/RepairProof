import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

type EvaluatedFlag = { enabled: boolean; variant?: string };
type EvaluationResponse = {
  flags: Record<string, EvaluatedFlag>;
  evaluatedAt: string;
  degraded?: boolean;
};

/** UI presentation only. Never use this hook to authorize or validate a backend operation. */
export function useFeatureFlag(key: string) {
  const profileId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: ['feature-flags', profileId],
    queryFn: () => apiGet<EvaluationResponse>('/feature-flags/effective'),
    enabled: Boolean(profileId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return {
    enabled: query.data?.flags[key]?.enabled ?? false,
    variant: query.data?.flags[key]?.variant,
    loading: query.isLoading,
    degraded: query.data?.degraded ?? query.isError,
  };
}
