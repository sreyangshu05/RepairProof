import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} · ${error.statusText}`
    : 'The requested page could not be opened.';
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section role="alert" className="max-w-md rounded-xl border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
        <h1 className="mt-4 text-xl font-semibold">We could not open this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-5">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Return to RepairProof
          </Link>
        </Button>
      </section>
    </main>
  );
}
