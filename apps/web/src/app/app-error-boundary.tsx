import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) console.error('RepairProof UI error', error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      this.props.fallback ?? (
        <main className="grid min-h-[60vh] place-items-center p-6">
          <section role="alert" className="max-w-md rounded-xl border bg-card p-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h1 className="mt-4 text-lg font-semibold">This page could not load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your information is safe. Refresh this view to try again.
            </p>
            <Button className="mt-5" onClick={this.reset}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </section>
        </main>
      )
    );
  }
}
