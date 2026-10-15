import { useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui';

// Error boundary for every route: shows the request ID when the API sent one.
export default function RouteError() {
  const error = useRouteError();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 inline-flex rounded-full bg-danger-50 p-3 text-danger-600"><AlertTriangle className="h-6 w-6" /></div>
        <h1 className="text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-subtle">{(error && error.message) || 'An unexpected error occurred.'}</p>
        {error && error.requestId && <p className="mt-1 text-xs text-ink-subtle">Reference: {error.requestId}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
          <Button onClick={() => { window.location.href = '/'; }}>Go home</Button>
        </div>
      </div>
    </div>
  );
}
