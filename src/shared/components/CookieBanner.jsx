// Cookie consent banner (RE-L-11). Shown on the first visit with "Essential
// only" and "Accept analytics"; the choice is kept for `consent.cookieDays`
// in a first-party cookie (plus localStorage). Nothing non-essential loads
// before the visitor accepts: GA4 (`analytics.ga4MeasurementId`) is injected
// only after "Accept analytics". The footer "Cookie settings" link reopens it
// through openCookieSettings().
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useT } from '@/shared/i18n';

const KEY = 'pd.consent';
const COOKIE = 'pd_consent';
const OPEN_EVENT = 'pd-cookie-settings';
const CHOICES = ['essential', 'analytics'];
const GA_ID = /^G-[A-Z0-9]{4,20}$/;

function readCookie(name) {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
  } catch { return ''; }
}

// 'essential' | 'analytics' | null (not chosen yet or the choice expired).
export function readConsent() {
  try {
    const row = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (row && CHOICES.includes(row.choice) && row.until > Date.now()) return row.choice;
    if (row) localStorage.removeItem(KEY);
  } catch { /* storage blocked or bad JSON */ }
  const c = readCookie(COOKIE);
  return CHOICES.includes(c) ? c : null;
}

function writeConsent(choice, days) {
  const d = Math.max(1, Math.min(730, Number(days) || 180));
  try { localStorage.setItem(KEY, JSON.stringify({ choice, at: Date.now(), until: Date.now() + d * 86_400_000 })); } catch { /* storage blocked */ }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${choice}; Max-Age=${d * 86400}; Path=/; SameSite=Lax${secure}`;
  } catch { /* cookies blocked */ }
}

export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_EVENT));

function loadGa(id) {
  if (!GA_ID.test(id || '')) return;
  window[`ga-disable-${id}`] = false;
  if (document.getElementById('pd-ga4')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.id = 'pd-ga4';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

// Withdrawal: stop GA from sending and drop its cookies.
function stopGa(id) {
  if (GA_ID.test(id || '')) window[`ga-disable-${id}`] = true;
  try {
    const host = window.location.hostname;
    document.cookie.split('; ').map((c) => c.split('=')[0]).filter((n) => n === '_ga' || n.startsWith('_ga_')).forEach((n) => {
      document.cookie = `${n}=; Max-Age=0; Path=/`;
      document.cookie = `${n}=; Max-Age=0; Path=/; Domain=.${host.replace(/^www\./, '')}`;
    });
  } catch { /* cookies blocked */ }
}

// Compact bar (audit P1): one line of text and two buttons along the bottom
// edge, about 56 px on desktop and under 90 px on a phone. Its height is
// published as --cookie-bar so the sticky mobile Enquire bar sits above it and
// the page gets the same bottom padding (nothing is covered).
function Bar({ t, choice, choose }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    const apply = () => { const h = el ? el.offsetHeight : 0; root.style.setProperty('--cookie-bar', `${h}px`); document.body.style.paddingBottom = `${h}px`; };
    apply();
    let ro;
    if (el && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(apply); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); root.style.setProperty('--cookie-bar', '0px'); document.body.style.paddingBottom = ''; };
  }, []);
  return (
    <div ref={ref} role="region" aria-label={t('common.cookie.title')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 px-4 py-2.5 text-white shadow-lift backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p id="cookie-d" className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-snug text-navy-100 sm:items-center sm:text-sm">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-gold-300 sm:mt-0" aria-hidden />
          <span>
            {t('common.cookie.short')}{' '}
            <Link to="/p/privacy" className="font-medium text-gold-300 underline underline-offset-2 hover:text-gold-200">{t('common.cookie.privacyNotice')}</Link>
            {choice && <span className="text-navy-300"> · {t('common.cookie.current', { choice: t(choice === 'analytics' ? 'common.cookie.currentAnalytics' : 'common.cookie.currentEssential') })}</span>}
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="glass" size="sm" className="!rounded-full flex-1 sm:flex-none" onClick={() => choose('essential')}>{t('common.cookie.essential')}</Button>
          <Button variant="gold" size="sm" className="!rounded-full flex-1 font-semibold sm:flex-none" onClick={() => choose('analytics')}>{t('common.cookie.accept')}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * ready: settings have loaded (or failed); enabled: consent.bannerEnabled;
 * cookieDays: consent.cookieDays; ga4Id: analytics.ga4MeasurementId;
 * onChoice(choice): called after the visitor picks 'essential' or 'analytics'
 * (the public shell records it in the consent ledger for a signed-in user).
 */
export default function CookieBanner({ ready, enabled = true, cookieDays = 180, ga4Id, onChoice }) {
  const t = useT();
  const [choice, setChoice] = useState(readConsent);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  // Analytics only after an explicit "Accept analytics" (and only while the banner is in use).
  useEffect(() => { if (ready && enabled && choice === 'analytics') loadGa(ga4Id); }, [ready, enabled, choice, ga4Id]);

  if (!ready || !enabled) return null;
  if (choice && !open) return null;

  const choose = (c) => {
    writeConsent(c, cookieDays);
    if (c === 'essential') stopGa(ga4Id);
    setChoice(c);
    setOpen(false);
    if (onChoice) { try { onChoice(c); } catch { /* recording the choice never blocks the banner */ } }
  };

  return <Bar t={t} choice={choice} choose={choose} />;
}
