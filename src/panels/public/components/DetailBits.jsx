// Small blocks shared by the property and project detail pages (public
// "modern premium" look: white cards, display-font titles, gold accents).
import { useState } from 'react';
import {
  ArrowUpDown, Building2, BusFront, Car, Dumbbell, ExternalLink, FileCheck2, Flame, GraduationCap, Hospital, Landmark, MapPin,
  MessageCircle, Phone, Plane, Route, ShieldCheck, ShoppingBag, Sparkles, Store, TrainFront, TreePine, Waves, Zap, Droplets,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { titleCase } from '@/shared/lib/format';
import env from '@/config/env';
import { useAuth } from '@/modules/auth';
import { useMyReferral, withRef } from '@/modules/search/prefs';
import { t as tr, useT } from '@/shared/i18n';
import { hotlineHref } from './States';

export function Fact({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="rounded-2xl bg-sand-50 px-4 py-3 ring-1 ring-inset ring-navy-900/5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-navy-900">{value}</dd>
    </div>
  );
}

// Eyebrow with the short rule before it (see SectionTitle in HomePage.jsx).
export function Eyebrow({ children, light = false, className }) {
  return (
    <p className={cn('flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]', light ? 'text-gold-300' : 'text-gold-700', className)}>
      <span className="h-px w-8 bg-current" aria-hidden />{children}
    </p>
  );
}

export function Block({ title, eyebrow, action, children, className, id }) {
  return (
    <section className={cn('rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy-900/5 sm:p-8', className)} id={id}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
          <h2 className="font-display text-2xl font-medium leading-tight tracking-tight text-navy-900 sm:text-[1.75rem]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Agent registrations from settings: [{ state, number, validTill }] (shape is admin-entered).
export function AgentRegistrations({ list, state }) {
  const t = useT();
  const rows = (Array.isArray(list) ? list : []).filter((r) => r && (!state || !r.state || String(r.state).toLowerCase() === String(state).toLowerCase()));
  if (!rows.length) return null;
  return <p className="mt-4 text-xs text-navy-400">{t('property.rera.agent', { list: rows.map((r) => [r.number, r.state].filter(Boolean).join(' (') + (r.state ? ')' : '')).join(', ') })}</p>;
}

// QR code for the official RERA URL, drawn by GET /api/rera/qr (https on an allowed RERA host only).
export function ReraQr({ url, number }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  if (failed || !/^https:\/\//i.test(String(url || ''))) return null;
  return (
    <img src={`${env.apiUrl}/rera/qr?${new URLSearchParams({ url })}`} alt={number ? t('property.rera.qrAlt', { number }) : t('property.rera.qrAltGeneric')}
      width={96} height={96} loading="lazy" onError={() => setFailed(true)} className="h-24 w-24 shrink-0 rounded-xl bg-white p-1.5 ring-1 ring-navy-900/10" />
  );
}

// RERA block (RE-G-08): numbers, authority, official link and QR code (when `rera.showQr`), or the Section 3(2) exemption text.
export function ReraBlock({ numbers = [], state, url, exempt, registrations, agentRegistrations, showQr = false }) {
  const t = useT();
  const regs = registrations || numbers.map((n) => ({ number: n, state, url }));
  return (
    <Block title={t('property.rera.title')} eyebrow={t('detail.sections.compliance')}>
      {exempt ? (
        <p className="flex items-start gap-3 text-sm leading-relaxed text-navy-600"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden />{t('property.rera.exempt')}</p>
      ) : (
        <ul className="space-y-3">
          {regs.map((r) => (
            <li key={r.number} className="flex items-center gap-4 rounded-2xl bg-sand-50 p-4 ring-1 ring-inset ring-gold-200/70">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gold-700 ring-1 ring-gold-300"><FileCheck2 className="h-5 w-5" aria-hidden /></span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 break-all font-display text-lg font-semibold tracking-tight text-navy-900">{r.number}{r.phaseLabel && <span className="ml-1 font-sans text-sm font-normal text-navy-400">· {r.phaseLabel}</span>}</span>
                <span className="text-xs text-navy-500">
                  {r.state && `${r.state} RERA`}
                  {r.url && <> · <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 break-all font-medium text-gold-700 underline-offset-4 hover:underline">{r.state ? t('property.rera.verifyOn', { state: r.state }) : t('property.rera.verifyGeneric')} <ExternalLink className="h-3 w-3" aria-hidden /></a></>}
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

export function HotlineQuote({ hotline, listingNo, className, dark = false }) {
  const t = useT();
  const n = hotline || env.hotline;
  return (
    <a href={hotlineHref(n)} className={cn('group flex items-center gap-3 rounded-2xl p-3.5 transition-colors', dark ? 'bg-white/5 ring-1 ring-inset ring-white/10 hover:bg-white/10' : 'bg-sand-50 ring-1 ring-inset ring-navy-900/10 hover:ring-gold-400', className)}>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1', dark ? 'bg-gold-500/10 text-gold-300 ring-gold-400/40' : 'bg-white text-gold-700 ring-gold-300')}><Phone className="h-4 w-4" aria-hidden /></span>
      <span className="min-w-0 text-sm">
        <span className={cn('block font-semibold tracking-wide', dark ? 'text-white' : 'text-navy-900')}>{n}</span>
        {listingNo && <span className={cn('block text-xs', dark ? 'text-navy-300' : 'text-navy-400')}>{t('property.quoteListing')} <span className={cn('font-semibold', dark ? 'text-gold-300' : 'text-navy-900')}>{listingNo}</span></span>}
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-navy-900">{t('property.area.title')}</p>
        <select aria-label={t('property.area.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} className="h-9 rounded-full border-0 bg-sand-100 pl-3 pr-8 text-xs font-medium text-navy-800 ring-1 ring-inset ring-navy-900/10 focus:outline-none focus:ring-2 focus:ring-gold-500">
          {UNITS.map((k) => <option key={k} value={k}>{t(`property.area.${k}`)}</option>)}
        </select>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{rows.map(([l, v]) => <Fact key={l} label={l} value={show(v)} />)}</dl>
    </div>
  );
}

// Key facts as an icon row: [{ icon, label, value }]; empty values are dropped.
export function KeyFacts({ items, className }) {
  const list = items.filter((x) => x.value !== undefined && x.value !== null && x.value !== '' && x.value !== false);
  if (!list.length) return null;
  return (
    <dl className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4', className)}>
      {list.map((f) => (
        <div key={f.label} className="flex min-w-0 items-center gap-3 rounded-2xl bg-white px-3 py-3.5 shadow-card ring-1 ring-navy-900/5 sm:px-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><f.icon className="h-[18px] w-[18px]" aria-hidden /></span>
          <div className="min-w-0">
            <dt className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-400">{f.label}</dt>
            <dd className="truncate text-sm font-semibold text-navy-900">{f.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// Amenity codes (masters) -> icon; anything else gets a neutral sparkle.
const AMENITY_ICONS = {
  lift: ArrowUpDown, gym: Dumbbell, security: ShieldCheck, power_backup: Zap, parking: Car, swimming_pool: Waves,
  club_house: Building2, park: TreePine, gas_pipeline: Flame, rainwater_harvesting: Droplets,
};

export function AmenityGrid({ codes = [], names = {} }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {codes.map((a) => {
        const Icon = AMENITY_ICONS[a] || Sparkles;
        return (
          <li key={a} className="flex items-center gap-3 rounded-2xl bg-sand-50 p-3 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-900/5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gold-700 ring-1 ring-gold-300"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
            <span className="min-w-0 break-words">{names[a] || titleCase(a)}</span>
          </li>
        );
      })}
    </ul>
  );
}

const LANDMARK_ICONS = {
  metro: TrainFront, railway: TrainFront, school: GraduationCap, hospital: Hospital, mall: ShoppingBag, market: Store,
  airport: Plane, bus_stop: BusFront, highway: Route, it_park: Building2, park: TreePine,
};

export function Landmarks({ list = [], className }) {
  const t = useT();
  if (!list.length) return null;
  return (
    <div className={className}>
      <p className="mb-3 text-sm font-semibold text-navy-900">{t('detail.sections.nearby')}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((l) => {
          const Icon = LANDMARK_ICONS[l.type] || Landmark;
          return (
            <li key={`${l.type}-${l.name}`} className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-navy-900/5">
              <span className="flex min-w-0 items-center gap-2.5 text-navy-800"><Icon className="h-4 w-4 shrink-0 text-gold-600" aria-hidden /><span className="truncate">{l.name}</span></span>
              {l.distanceKm != null && <span className="shrink-0 text-xs font-medium text-navy-400">{l.distanceKm} km</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Location line with the gold pin.
export function PlaceLine({ parts, className, light = false }) {
  const text = parts.filter(Boolean).join(', ');
  if (!text) return null;
  return (
    <p className={cn('flex items-start gap-1.5 text-sm', light ? 'text-navy-200' : 'text-navy-500', className)}>
      <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0', light ? 'text-gold-300' : 'text-gold-600')} aria-hidden />{text}
    </p>
  );
}

/**
 * Sticky desktop enquiry card (navy). contacts: [{ action, icon }], the first
 * one is the gold primary "Enquire"; onAction(action) opens the enquiry modal.
 * With no onAction (no enquiry target), only the hotline is offered.
 */
export function EnquiryCard({ title, top, contacts, onAction, onWhatsapp, hotline, listingNo, noEnquiryText, footnote }) {
  const t = useT();
  const [first, ...rest] = contacts || [];
  return (
    <div className="relative overflow-hidden rounded-3xl bg-navy-950 p-6 text-white shadow-lift ring-1 ring-white/5">
      <span className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
      <div className="relative">
        <Eyebrow light>{t('detail.card.eyebrow')}</Eyebrow>
        <p className="mt-2 font-display text-2xl font-medium leading-tight">{title}</p>
        <p className="mt-1 text-xs text-navy-300">{t('property.freePrivate')}</p>
        {top}
        {onAction && first ? (
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => onAction(first.action)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gold-500 px-6 text-base font-semibold text-navy-950 shadow-sm transition-colors hover:bg-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">
              <first.icon className="h-4 w-4" aria-hidden />{t('property.enquire')}
            </button>
            {rest.map((c) => (
              <button key={c.action} type="button" onClick={() => onAction(c.action)}
                className="inline-flex h-11 items-center justify-start gap-3 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
                <c.icon className="h-4 w-4 text-gold-300" aria-hidden />{t(`property.contacts.${c.action}`)}
              </button>
            ))}
            {onWhatsapp && (
              <button type="button" onClick={onWhatsapp}
                className="inline-flex h-11 items-center justify-start gap-3 rounded-full border border-success-600/50 bg-success-600/15 px-5 text-sm font-medium text-white transition-colors hover:bg-success-600/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
                <MessageCircle className="h-4 w-4 text-success-100" aria-hidden />{t('property.whatsappUs')}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-navy-200">{noEnquiryText}</p>
        )}
        <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-[0.14em] text-navy-300">{t('detail.card.orCall')}</p>
        <HotlineQuote hotline={hotline} listingNo={listingNo} dark />
        <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" aria-hidden />
          <div className="text-xs leading-relaxed text-navy-200">
            <p className="text-sm font-semibold text-white">{t('detail.card.private')}</p>
            <p className="mt-0.5">{t('detail.card.privateText')}</p>
          </div>
        </div>
      </div>
      {footnote && <p className="relative mt-4 text-xs leading-relaxed text-navy-300">{footnote}</p>}
    </div>
  );
}

// Fixed bottom action bar on phones: call, optional WhatsApp, and the gold primary.
export function MobileActionBar({ hotline, onWhatsapp, primary }) {
  const t = useT();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-900/10 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_-16px_rgba(13,21,38,0.35)] backdrop-blur-md lg:hidden">
      <div className={cn('mx-auto grid max-w-xl gap-2', onWhatsapp ? 'grid-cols-[auto_auto_1fr]' : 'grid-cols-[auto_1fr]')}>
        <a href={hotlineHref(hotline)} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-navy-900/15 bg-white px-4 text-sm font-medium text-navy-900"><Phone className="h-4 w-4 text-gold-700" aria-hidden />{t('property.call')}</a>
        {onWhatsapp && <button type="button" onClick={onWhatsapp} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-success-600/40 bg-white px-4 text-sm font-medium text-success-700"><MessageCircle className="h-4 w-4" aria-hidden />{t('property.whatsapp')}</button>}
        {primary}
      </div>
    </div>
  );
}

export const mobilePrimaryCls = 'inline-flex h-12 min-w-0 items-center justify-center gap-1.5 truncate rounded-full bg-gold-500 px-4 text-sm font-semibold text-navy-950 shadow-sm';

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
