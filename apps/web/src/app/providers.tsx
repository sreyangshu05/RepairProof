import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppErrorBoundary } from './app-error-boundary';
import { I18nProvider } from '../i18n/I18nProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <AppErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </I18nProvider>
    </AppErrorBoundary>
  );
}
