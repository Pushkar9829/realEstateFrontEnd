// Development only: the demo logins created by backend/scripts/seed-demo-users.js,
// shown on the login page with one-click fill. Rendered only when
// import.meta.env.DEV is true, so production builds drop this file entirely.
import { useState } from 'react';
import { Check, Copy, FlaskConical } from 'lucide-react';
import { Badge } from '@/shared/ui';
import { useT } from '@/shared/i18n';

export const DEMO_PASSWORD = 'Demo@12345';

export const DEMO_ACCOUNTS = [
  { email: 'superadmin@demo.local', key: 'superadmin', tone: 'danger' },
  { email: 'admin@demo.local', key: 'admin', tone: 'brand' },
  { email: 'manager@demo.local', key: 'manager', tone: 'info' },
  { email: 'agent@demo.local', key: 'agent', tone: 'success' },
  { email: 'builder@demo.local', key: 'builder', tone: 'accent' },
  { email: 'owner@demo.local', key: 'owner', tone: 'warning' },
  { email: 'buyer@demo.local', key: 'buyer', tone: 'neutral' },
];

function CopyButton({ text, label }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} className="rounded-md p-1.5 text-navy-400 hover:bg-sand-100 hover:text-navy-900" aria-label={t('auth.demo.copy', { label })}>
      {done ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function DemoAccounts({ onPick }) {
  const t = useT();
  return (
    <section className="mt-6 rounded-3xl border border-dashed border-gold-300 bg-gold-50/60 p-4 sm:p-5" aria-label={t('auth.demo.title')}>
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-gold-700" aria-hidden />
        <h2 className="font-display text-base font-medium text-navy-900">{t('auth.demo.title')}</h2>
        <Badge tone="accent" className="ml-auto">{t('auth.demo.devOnly')}</Badge>
      </div>
      <p className="mb-3 text-xs text-navy-500">
        {t('auth.demo.intro')}<code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold text-navy-900 ring-1 ring-navy-900/10">{DEMO_PASSWORD}</code>
        <CopyButton text={DEMO_PASSWORD} label={t('auth.demo.copyPassword')} />
      </p>
      <ul className="space-y-1.5">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <div role="button" tabIndex={0} onClick={() => onPick(a.email, DEMO_PASSWORD)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(a.email, DEMO_PASSWORD); } }}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-900/10 bg-white px-3 py-2 text-left transition hover:border-gold-400 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40">
              <Badge tone={a.tone} className="w-28 shrink-0 justify-center whitespace-nowrap">{t(`auth.demo.role.${a.key}`)}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-medium text-navy-900">{a.email}</span>
                <span className="block truncate text-[11px] text-navy-400">{t(`auth.demo.panel.${a.key}`)}</span>
              </span>
              <CopyButton text={a.email} label={a.email} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-navy-400">
        {t('auth.demo.footer')}{t('auth.demo.recreateBefore')}<code className="font-mono">node scripts/seed-demo-users.js</code>{t('auth.demo.recreateMid')}<code className="font-mono">backend/</code>{t('auth.demo.recreateAfter')}
      </p>
    </section>
  );
}
