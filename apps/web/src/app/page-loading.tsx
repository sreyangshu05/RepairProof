import { Skeleton } from '../components/ui/skeleton';

export function PageLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8"
    >
      <span className="sr-only">Loading page content</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </main>
  );
}
