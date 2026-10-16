// Small blocks shared by the property and project detail pages.
import { useState } from 'react';
import { ExternalLink, FileCheck2, Phone, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui';
import env from '@/config/env';
import { useAuth } from '@/modules/auth';
import { useMyReferral, withRef } from '@/modules/search/prefs';
import { t as tr, useT } from '@/shared/i18n';
import { hotlineHref } from './States';

export function Fact({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="rounded-md bg-surface-muted px-3 py-2">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export function Block({ title, children, className, id }) {
  return (
    <Card className={className} id={id}>
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      {children}
    </Card>
  );
}

// Agent registrations from settings: [{ state, number, validTill }] (shape is admin-entered).
export function AgentRegistrations({ list, state }) {
  const t = useT();
  const rows = (Array.isArray(list) ? list : []).filter((r) => r && (!state || !r.state || String(r.state).toLowerCase() === String(state).toLowerCase()));
  if (!rows.length) return null;
  return <p className="mt-3 text-xs text-ink-subtle">{t('property.rera.agent', { list: rows.map((r) => [r.number, r.state].filter(Boolean).join(' (') + (r.state ? ')' : '')).join(', ') })}</p>;
}

// QR code for the official RERA URL, drawn by GET /api/rera/qr (https on an allowed RERA host only).
export function ReraQr({ url, number }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  if (failed || !/^https:\/\//i.test(String(url || ''))) return null;
  return (
    <img src={`${env.apiUrl}/rera/qr?${new URLSearchParams({ url })}`} alt={number ? t('property.rera.qrAlt', { number }) : t('property.rera.qrAltGeneric')}
      width={96} height={96} loading="lazy" onError={() => setFailed(true)} className="h-24 w-24 shrink-0 rounded border bg-white p-1" />
  );
}

// RERA block (RE-G-08): numbers, authority, official link and QR code (when `rera.showQr`), or the Section 3(2) exemption text.
export function ReraBlock({ numbers = [], state, url, exempt, registrations, agentRegistrations, showQr = false }) {
  const t = useT();
  const regs = registrations || numbers.map((n) => ({ number: n, state, url }));
  return (
    <Block title={t('property.rera.title')}>
      {exempt ? (
        <p className="flex items-start gap-2 text-sm text-ink-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden />{t('property.rera.exempt')}</p>
      ) : (
        <ul className="space-y-2">
          {regs.map((r) => (
            <li key={r.number} className="flex items-center gap-3 rounded-md border bg-surface-muted p-3 text-sm">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-2 font-medium text-ink"><FileCheck2 className="h-4 w-4 text-accent-700" aria-hidden />{r.number}{r.phaseLabel && <span className="font-normal text-ink-subtle">· {r.phaseLabel}</span>}</span>
                <span className="text-xs text-ink-subtle">
                  {r.state && `${r.state} RERA`}
                  {r.url && <> · <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 break-all text-brand-700 hover:underline">{r.state ? t('property.rera.verifyOn', { state: r.state }) : t('property.rera.verifyGeneric')} <ExternalLink className="h-3 w-3" aria-hidden /></a></>}
                </span>
              </div>
              {showQr && r.url && <ReraQr url={r.url} number={r.number} />}
            </li>
          ))}
        </ul>
      )}
      <AgentRegistrations list={agentRegistrations} state={state || (regs[0] && regs[0].state)} />
    </Block>
  );
}

export function HotlineQuote({ hotline, listingNo, className }) {
  const t = useT();
  const n = hotline || env.hotline;
  return (
    <a href={hotlineHref(n)} className={cn('flex items-center gap-3 rounded-md border bg-white p-3 hover:border-brand-300', className)}>
      <span className="rounded-full bg-brand-50 p-2 text-brand-600"><Phone className="h-4 w-4" aria-hidden /></span>
      <span className="text-sm">
        <span className="block font-semibold text-ink">{n}</span>
        {listingNo && <span className="block text-xs text-ink-subtle">{t('property.quoteListing')} <span className="font-semibold text-ink">{listingNo}</span></span>}
      </span>
    </a>
  );
}

const TO_SQFT = { sqft: 1, sqm: 10.7639, sqyd: 9, acre: 43560, hectare: 107639, bigha: 27000 };
const UNITS = ['sqft', 'sqm', 'sqyd', 'acre'];

// Areas with a unit switcher (stored in the lister's unit).
export function AreaFacts({ areas }) {
  const t = useT();
  const [unit, setUnit] = useState('sqft');
  if (!areas) return null;
  const from = TO_SQFT[areas.unit || 'sqft'] || 1;
  const show = (v) => (v ? `${(+((v * from) / TO_SQFT[unit]).toFixed(unit === 'acre' ? 3 : 0)).toLocaleString('en-IN')} ${t(`property.area.${unit}`)}` : null);
  const rows = [[t('property.area.carpet'), areas.carpet], [t('property.area.builtUp'), areas.builtUp], [t('property.area.superBuiltUp'), areas.superBuiltUp], [t('property.area.plot'), areas.plot]].filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t('property.area.title')}</p>
        <select aria-label={t('property.area.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} className="h-7 rounded border border-line-strong bg-white px-1.5 text-xs">
          {UNITS.map((k) => <option key={k} value={k}>{t(`property.area.${k}`)}</option>)}
        </select>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{rows.map(([l, v]) => <Fact key={l} label={l} value={show(v)} />)}</dl>
    </div>
  );
}

// YouTube watch / short links -> embed URL.
export function youtubeEmbed(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

// The signed-in user's own referral code (GET /api/me/referral), used by Share (RE-N-01).
export function useShareCode() {
  const { isAuthed } = useAuth();
  const q = useMyReferral(isAuthed);
  return (isAuthed && q.data && q.data.code) || '';
}

// Shares the page URL; with refCode it carries ?ref=<the sharer's own code>.
export async function shareLink(toast, title, refCode) {
  const url = withRef(window.location.href.split('?')[0], refCode);
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    toast.success(tr('property.linkCopied'));
  } catch { /* share sheet closed */ }
}
