import { useQuery } from '@tanstack/react-query';
import { consumerDashboardSchema } from './types';

export const consumerDashboardQueryKey = ['consumer', 'dashboard'] as const;

export function useConsumerDashboard() {
  const useMockData = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true';
  return useQuery({
    queryKey: consumerDashboardQueryKey,
    queryFn: async () => {
      const response = useMockData
        ? (await import('./mock-data')).consumerDashboardMockData
        : (() => { throw new Error('Consumer dashboard API is not available in this release.'); })();
      return consumerDashboardSchema.parse(response);
    },
    enabled: useMockData,
    retry: 0,
  });
}
