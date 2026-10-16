// Cookie consent banner (RE-L-11). Shown on the first visit with "Essential
// only" and "Accept analytics"; the choice is kept for `consent.cookieDays`
// in a first-party cookie (plus localStorage). Nothing non-essential loads
// before the visitor accepts: GA4 (`analytics.ga4MeasurementId`) is injected
// only after "Accept analytics". The footer "Cookie settings" link reopens it
// through openCookieSettings().
import { useEffect, useState } from 'react';
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

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-h" aria-describedby="cookie-d"
      className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-white/10 bg-navy-950 p-5 text-white shadow-lift sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-md sm:rounded-3xl sm:border">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600" aria-hidden />
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-300/30 bg-white/5 text-gold-300"><Cookie className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <p id="cookie-h" className="font-display text-lg font-medium text-white">{t('common.cookie.title')}</p>
          <p id="cookie-d" className="mt-1 text-xs leading-relaxed text-navy-200">
            {t('common.cookie.body')}
            {' '}<Link to="/p/privacy" className="font-medium text-gold-300 underline-offset-4 hover:text-gold-200 hover:underline">{t('common.cookie.privacyNotice')}</Link>
          </p>
          {choice && <p className="mt-1.5 text-xs text-navy-300">{t('common.cookie.current', { choice: t(choice === 'analytics' ? 'common.cookie.currentAnalytics' : 'common.cookie.currentEssential') })}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="glass" size="md" className="!rounded-full" onClick={() => choose('essential')}>{t('common.cookie.essential')}</Button>
        <Button variant="gold" size="md" className="!rounded-full font-semibold" onClick={() => choose('analytics')}>{t('common.cookie.accept')}</Button>
      </div>
    </div>
  );
}
