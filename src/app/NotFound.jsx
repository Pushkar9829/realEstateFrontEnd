import { MapPinOff } from 'lucide-react';
import { Button } from '@/shared/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex rounded-full bg-brand-50 p-3 text-brand-600"><MapPinOff className="h-6 w-6" /></div>
        <h1 className="text-xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-subtle">The address may be mistyped, or the page has moved.</p>
        <Button className="mt-6" to="/">Go to home</Button>
      </div>
    </div>
  );
}
