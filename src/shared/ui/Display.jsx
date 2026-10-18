// Presentational building blocks: Card, Badge, Alert, EmptyState, Skeleton,
// Avatar, PageHeader, Stat. Kept together because each is small.
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export function Card({ className, children, padded = true, ...rest }) {
  return <div className={cn('min-w-0 rounded-lg border bg-white shadow-sm', padded && 'p-5', className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const BADGE = {
  neutral: 'bg-surface-sunken text-ink-muted',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  accent: 'bg-accent-50 text-accent-700',
};

export function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', BADGE[tone], className)}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </span>
  );
}

const ALERT = {
  info: ['bg-info-50 border-info-100 text-info-700', Info],
  success: ['bg-success-50 border-success-100 text-success-700', CheckCircle2],
  warning: ['bg-warning-50 border-warning-100 text-warning-700', TriangleAlert],
  danger: ['bg-danger-50 border-danger-100 text-danger-700', AlertCircle],
};

export function Alert({ tone = 'info', title, children, className, action }) {
  const [cls, Icon] = ALERT[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border p-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed bg-white px-6 py-12 text-center', className)}>
      {Icon && <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600"><Icon className="h-6 w-6" aria-hidden /></div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className, ...rest }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-sunken', className)} aria-hidden {...rest} />;
}

export function Avatar({ name = '', src, size = 'md' }) {
  const s = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' }[size];
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  if (src) return <img src={src} alt={name} className={cn('rounded-full object-cover', s)} />;
  return <span className={cn('inline-flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700', s)} aria-label={name}>{initials}</span>;
}

export function PageHeader({ title, description, actions, breadcrumb }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-ink-subtle">{breadcrumb}</div>}
        <h1 className="break-words text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'brand' }) {
  return (
    <Card className="flex items-start gap-4">
      {Icon && <div className={cn('rounded-md p-2.5', BADGE[tone])}><Icon className="h-5 w-5" aria-hidden /></div>}
      <div>
        <p className="text-sm text-ink-subtle">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
      </div>
    </Card>
  );
}
