// Loading, error and section helpers shared by the public pages, plus the
// "modern premium" building blocks of the inner pages (docs/PUBLIC_DESIGN.md):
// the dark header band, eyebrow, refined empty state, segmented control and
// the form skin that restyles the shared inputs inside public forms.
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, Phone, RefreshCw, SearchX } from 'lucide-react';
import { Button } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import env from '@/config/env';
import { useT } from '@/shared/i18n';

export const IMG = (name) => `/images/stock/${name}.webp`;

// Short gold rule + uppercase label.
export function Eyebrow({ children, light = false, className }) {
  return (
    <p className={cn('flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]', light ? 'text-gold-300' : 'text-gold-700', className)}>
      <span className="h-px w-8 bg-current" aria-hidden />{children}
    </p>
  );
}

// Round icon in a gold ring (empty states, small feature tiles).
export function IconRing({ icon: Icon, tone = 'gold', className }) {
  return (
    <span className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-1 ring-offset-4 ring-offset-white',
      tone === 'danger' ? 'bg-danger-50 text-danger-700 ring-danger-100' : 'bg-gold-50 text-gold-700 ring-gold-300', className)}>
      <Icon className="h-7 w-7" aria-hidden />
    </span>
  );
}

// Empty state (illustration free): gold-ringed icon, display heading, short text, actions.
export function PublicEmpty({ icon = SearchX, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-3xl bg-white px-6 py-14 text-center shadow-card ring-1 ring-navy-900/5 sm:py-16', className)}>
      <IconRing icon={icon} />
      <h3 className="mt-7 font-display text-2xl font-medium text-navy-900 sm:text-[1.75rem]">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-navy-500">{description}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className, title }) {
  const t = useT();
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-danger-100 sm:flex-row sm:items-center', className)}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-700 ring-1 ring-danger-100"><AlertCircle className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-medium text-navy-900">{title || t('common.somethingWrong')}</p>
        <p className="mt-0.5 text-sm text-navy-500">{(error && error.message) || t('common.tryAgain')}</p>
      </div>
      {onRetry && <Button size="md" variant="navy" icon={RefreshCw} onClick={onRetry} className="rounded-full">{t('common.retry')}</Button>}
    </div>
  );
}

// Pulse block on sand (the shared Skeleton uses the panel palette).
export function Shimmer({ className }) {
  return <div className={cn('animate-pulse', className)} aria-hidden />;
}

export function CardGridSkeleton({ count = 6, className }) {
  return (
    <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', className)} aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5">
          <Shimmer className="aspect-[4/3] w-full bg-sand-200" />
          <div className="space-y-2.5 p-5"><Shimmer className="h-6 w-1/2 bg-sand-200 rounded-md" /><Shimmer className="h-4 w-3/4 bg-sand-100 rounded-md" /><Shimmer className="h-4 w-1/3 bg-sand-100 rounded-md" /></div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy>
      <div className="bg-navy-950">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-12 sm:px-6 lg:py-16">
          <Shimmer className="h-3 w-40 bg-white/10 rounded-md" /><Shimmer className="h-10 w-2/3 bg-white/10 rounded-md" /><Shimmer className="h-4 w-1/3 bg-white/10 rounded-md" />
        </div>
      </div>
      <div className="mx-auto mt-8 grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3"><Shimmer className="h-8 w-2/3 bg-sand-200 rounded-md" /><Shimmer className="h-5 w-1/3 bg-sand-200 rounded-md" /><Shimmer className="h-40 w-full rounded-2xl bg-sand-200" /></div>
        <Shimmer className="h-64 w-full rounded-2xl bg-sand-200" />
      </div>
    </div>
  );
}

// 404 / gone pages for token links and detail pages.
export function NotAvailable({ title, description, action, icon = SearchX }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:py-20">
      <PublicEmpty icon={icon} title={title} description={description} action={action} />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, text, action, as: H = 'h2' }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <H className="font-display text-2xl font-medium leading-tight tracking-tight text-navy-900 sm:text-[2rem]">{title}</H>
        {text && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy-500 sm:text-base">{text}</p>}
      </div>
      {action}
    </div>
  );
}

// Text link with an arrow, used as a section action.
export function ArrowLink({ to, children, light = false, className }) {
  return (
    <Link to={to} className={cn('group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold', light ? 'text-gold-300 hover:text-gold-200' : 'text-navy-900 hover:text-gold-700', className)}>
      {children}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/**
 * Inner-page header band: navy, optional decorative stock photo, breadcrumb,
 * eyebrow, display title, one line of text, key figures and actions.
 * crumbs: [{ to?, label }] (last one is the current page); stats: [{ label, value, hint? }].
 */
export function PageBand({ image, crumbs, crumbsLabel, eyebrow, title, text, stats, actions, children, className }) {
  return (
    <section className={cn('relative isolate overflow-hidden bg-navy-950', className)}>
      {image && <img src={IMG(image)} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/50" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-navy-950/80 to-transparent" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label={crumbsLabel} className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-navy-300">
              {crumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-navy-500" aria-hidden />}
                  {c.to && i < crumbs.length - 1 ? <Link to={c.to} className="transition-colors hover:text-white">{c.label}</Link> : <span className="text-navy-100" aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {eyebrow && <Eyebrow light>{eyebrow}</Eyebrow>}
            <h1 className="mt-4 font-display text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl">{title}</h1>
            {text && <p className="mt-4 max-w-2xl text-base leading-relaxed text-navy-200">{text}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {stats && stats.length > 0 && (
          <dl className={cn('mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md', stats.length >= 3 ? 'sm:grid-cols-3' : stats.length === 2 ? 'sm:max-w-2xl sm:grid-cols-2' : 'sm:max-w-xs')}>
            {stats.map((s) => (
              <div key={s.label} className="bg-navy-950/50 px-5 py-5">
                <dt className="text-xs uppercase tracking-[0.14em] text-navy-300">{s.label}</dt>
                <dd className="mt-1.5 font-display text-2xl font-medium text-white sm:text-3xl">{s.value}</dd>
                {s.hint && <dd className="mt-1 text-xs text-navy-300">{s.hint}</dd>}
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </section>
  );
}

/**
 * Segmented control (pill group). options: [{ value, label, icon? }].
 * role="tablist" + aria-selected (as the purpose toggles always had), or
 * role="group" + aria-pressed when `pressed` is set.
 */
export function Segmented({ value, onChange, options, label, dark = false, pressed = false, className }) {
  return (
    <div className={cn('inline-flex rounded-full p-1', dark ? 'bg-white/10 ring-1 ring-white/15 backdrop-blur' : 'bg-sand-100 ring-1 ring-navy-900/5', className)}
      role={pressed ? 'group' : 'tablist'} aria-label={label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" role={pressed ? undefined : 'tab'} aria-selected={pressed ? undefined : on} aria-pressed={pressed ? on : undefined} onClick={() => onChange(o.value)}
            className={cn('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-all',
              on ? (dark ? 'bg-white text-navy-900 shadow-sm' : 'bg-navy-900 text-white shadow-sm') : (dark ? 'text-navy-100 hover:text-white' : 'text-navy-600 hover:text-navy-900'))}>
            {o.icon && <o.icon className="h-4 w-4" aria-hidden />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

// Restyles the shared Input / Select / Textarea / Checkbox inside a public form
// (sand fill, rounded-xl, gold focus ring, navy labels) without changing them.
export const FORM_SKIN = [
  '[&_label]:text-navy-800',
  '[&_input:not([type=checkbox]):not([type=radio])]:h-11 [&_select]:h-11',
  '[&_input:not([type=checkbox]):not([type=radio])]:rounded-xl [&_select]:rounded-xl [&_textarea]:rounded-xl',
  '[&_input:not([type=checkbox]):not([type=radio])]:bg-sand-100 [&_select]:bg-sand-100 [&_textarea]:bg-sand-100',
  '[&_input:not([type=checkbox]):not([type=radio])]:shadow-none [&_select]:shadow-none [&_textarea]:shadow-none',
  '[&_input:not([type=checkbox]):not([type=radio]):not([aria-invalid])]:border-navy-900/10 [&_select:not([aria-invalid])]:border-navy-900/10 [&_textarea:not([aria-invalid])]:border-navy-900/10',
  '[&_input:not([type=checkbox]):not([type=radio]):focus]:bg-white [&_select:focus]:bg-white [&_textarea:focus]:bg-white',
  '[&_input:not([type=checkbox]):not([type=radio]):focus:not([aria-invalid])]:border-gold-500 [&_select:focus:not([aria-invalid])]:border-gold-500 [&_textarea:focus:not([aria-invalid])]:border-gold-500',
  '[&_input:focus]:ring-gold-500/30 [&_select:focus]:ring-gold-500/30 [&_textarea:focus]:ring-gold-500/30',
  '[&_input[type=checkbox]]:text-navy-900 [&_input[type=checkbox]]:border-navy-900/25',
].join(' ');

// The public hotline: the admin setting (GET /api/settings/public) once loaded,
// otherwise the build-time default. PublicShell records the setting.
let liveHotline = null;
export const setLiveHotline = (n) => { if (n) liveHotline = n; };
export const currentHotline = () => liveHotline || env.hotline;

export const hotlineHref = (n) => `tel:${String(n || currentHotline()).replace(/[^\d+]/g, '')}`;

export function HotlineButton({ label, className }) {
  const t = useT();
  return (
    <a href={hotlineHref()} className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-full bg-navy-900 px-5 text-sm font-medium text-white transition-colors hover:bg-navy-800', className)}>
      <Phone className="h-4 w-4 text-gold-300" aria-hidden />{label || t('common.callHotline')} {currentHotline()}
    </a>
  );
}

// Narrow centred page used by token links and forms.
export function NarrowPage({ children, className }) {
  return <div className={cn('mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12', className)}>{children}</div>;
}
