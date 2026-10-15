// Development only: the demo logins created by backend/scripts/seed-demo-users.js,
// shown on the login page with one-click fill. Rendered only when
// import.meta.env.DEV is true, so production builds drop this file entirely.
import { useState } from 'react';
import { Check, Copy, FlaskConical } from 'lucide-react';
import { Badge } from '@/shared/ui';

export const DEMO_PASSWORD = 'Demo@12345';

export const DEMO_ACCOUNTS = [
  { email: 'superadmin@demo.local', role: 'Super admin', panel: 'Admin panel, every screen', tone: 'danger' },
  { email: 'admin@demo.local', role: 'Admin staff', panel: 'Admin panel, 5 permissions', tone: 'brand' },
  { email: 'manager@demo.local', role: 'Sales manager', panel: 'Agent panel + team admin', tone: 'info' },
  { email: 'agent@demo.local', role: 'Sales agent', panel: 'Agent panel', tone: 'success' },
  { email: 'builder@demo.local', role: 'Builder', panel: 'Lister panel, KYC verified', tone: 'accent' },
  { email: 'owner@demo.local', role: 'Owner', panel: 'Lister panel, KYC not started', tone: 'warning' },
  { email: 'buyer@demo.local', role: 'Buyer', panel: 'Public site and account', tone: 'neutral' },
];

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink" aria-label={`Copy ${label}`}>
      {done ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function DemoAccounts({ onPick }) {
  return (
    <section className="mt-6 rounded-xl border border-dashed border-accent-300 bg-accent-50/60 p-4" aria-label="Demo accounts">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-accent-700" aria-hidden />
        <h2 className="text-sm font-semibold text-ink">Demo accounts</h2>
        <Badge tone="accent" className="ml-auto">Development only</Badge>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Click an account to fill the form. Password for all: <code className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold text-ink">{DEMO_PASSWORD}</code>
        <CopyButton text={DEMO_PASSWORD} label="password" />
      </p>
      <ul className="space-y-1.5">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <div role="button" tabIndex={0} onClick={() => onPick(a.email, DEMO_PASSWORD)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(a.email, DEMO_PASSWORD); } }}
              className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
              <Badge tone={a.tone} className="w-28 shrink-0 justify-center whitespace-nowrap">{a.role}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-medium text-ink">{a.email}</span>
                <span className="block truncate text-[11px] text-ink-subtle">{a.panel}</span>
              </span>
              <CopyButton text={a.email} label={a.email} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-subtle">
        The 6-digit sign-in code is printed in the backend console (no real email or SMS is sent in development).
        Recreate these accounts with <code className="font-mono">node scripts/seed-demo-users.js</code> in <code className="font-mono">backend/</code>.
      </p>
    </section>
  );
}
