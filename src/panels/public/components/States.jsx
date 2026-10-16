// Loading, error and section helpers shared by the public pages.
import { Phone, RefreshCw, SearchX } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import env from '@/config/env';
import { useT } from '@/shared/i18n';

export function ErrorState({ error, onRetry, className, title }) {
  const t = useT();
  return (
    <Alert tone="danger" title={title || t('common.somethingWrong')} className={className}
      action={onRetry && <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>{t('common.retry')}</Button>}>
      {(error && error.message) || t('common.tryAgain')}
    </Alert>
  );
}

export function CardGridSkeleton({ count = 6, className }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)} aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} padded={false} className="overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-4"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" /></div>
        </Card>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6" aria-busy>
      <Skeleton className="aspect-[16/7] w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-5 w-1/3" /><Skeleton className="h-40 w-full" /></div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

// 404 / gone pages for token links and detail pages.
export function NotAvailable({ title, description, action, icon = SearchX }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, text, action, as: H = 'h2' }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <H className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{title}</H>
        {text && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export const hotlineHref = (n) => `tel:${String(n || env.hotline).replace(/\s/g, '')}`;

export function HotlineButton({ label, className }) {
  const t = useT();
  return (
    <a href={hotlineHref()} className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700', className)}>
      <Phone className="h-4 w-4" aria-hidden />{label || t('common.callHotline')} {env.hotline}
    </a>
  );
}

// Narrow centred page used by token links and forms.
export function NarrowPage({ children, className }) {
  return <div className={cn('mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12', className)}>{children}</div>;
}
