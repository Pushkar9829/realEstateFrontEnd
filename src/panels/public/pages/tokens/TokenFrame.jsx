// Shared frame for the email / SMS token landing pages (navy + gold look): a
// slim photo band, a centred card, display-font headings, status pills and the
// "link not valid" notice.
import { Phone } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import env from '@/config/env';
import { useT } from '@/shared/i18n';
import { PUBLIC_FORM_SKIN } from '@/shared/layouts/AuthLayout';
import { hotlineHref } from '../../components/States';

export function TokenPage({ children, photo = 'living-light' }) {
  return (
    <div className="relative isolate bg-sand-50">
      <div className="absolute inset-x-0 top-0 -z-10 h-56 overflow-hidden bg-navy-950 sm:h-64" aria-hidden>
        <img src={`/images/stock/${photo}.webp`} alt="" className="h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/85 to-navy-950" />
      </div>
      <div className={cn('mx-auto max-w-xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14', PUBLIC_FORM_SKIN)}>{children}</div>
    </div>
  );
}

export function TokenCard({ children, className }) {
  return <div className={cn('rounded-3xl bg-white p-6 shadow-lift ring-1 ring-navy-900/5 sm:p-8', className)}>{children}</div>;
}

export function TokenEyebrow({ children }) {
  return (
    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
      <span className="h-px w-8 bg-current" aria-hidden />{children}
    </p>
  );
}

const PILL = {
  neutral: 'bg-sand-100 text-navy-600 ring-navy-900/10',
  brand: 'bg-navy-50 text-navy-800 ring-navy-900/10',
  info: 'bg-info-50 text-info-700 ring-info-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  accent: 'bg-gold-50 text-gold-800 ring-gold-200',
};

// Status pill; `tone` accepts the Badge tones used by the modules.
export function Pill({ tone = 'neutral', children, className }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', PILL[tone] || PILL.neutral, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{children}
    </span>
  );
}

export function TokenHotline({ label, className }) {
  const t = useT();
  return (
    <a href={hotlineHref()} className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-navy-800', className)}>
      <Phone className="h-4 w-4 text-gold-300" aria-hidden />{label || t('common.callHotline')} {env.hotline}
    </a>
  );
}

// Invalid / expired / finished link states.
export function TokenNotice({ icon: Icon, title, description, action, tone = 'neutral' }) {
  return (
    <TokenPage>
      <TokenCard className="text-center sm:p-10">
        {Icon && (
          <span className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-1',
            tone === 'success' ? 'bg-success-50 text-success-600 ring-success-100' : 'bg-gold-50 text-gold-700 ring-gold-200')}>
            <Icon className="h-7 w-7" aria-hidden />
          </span>
        )}
        <h1 className="mt-6 font-display text-3xl font-medium leading-tight text-navy-900">{title}</h1>
        {description && <p className="mx-auto mt-3 max-w-sm leading-relaxed text-navy-500">{description}</p>}
        {action && <div className="mt-8 flex justify-center">{action}</div>}
      </TokenCard>
    </TokenPage>
  );
}
