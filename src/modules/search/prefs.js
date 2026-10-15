// Public-portal visitor preferences kept in this browser: the chosen city
// (header selector, home search and search links) and the referral code from
// a `?ref=CODE` landing URL (RE-N-01). Both are functional storage: the city
// remembers the visitor's own choice and the referral code attributes a
// later enquiry or sign-up; neither is analytics, so they work before the
// cookie banner choice (RE-L-11). Every storage access is wrapped in try/catch.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

// ---------------------------------------------------------------- city

const CITY_KEY = 'pd.city';
const CITY_EVENT = 'pd-city';

export const lastCity = () => { try { return localStorage.getItem(CITY_KEY) || ''; } catch { return ''; } };
export function rememberCity(c) {
  if (!c || c === lastCity()) return;
  try { localStorage.setItem(CITY_KEY, c); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(CITY_EVENT));
}
export function forgetCity() {
  try { localStorage.removeItem(CITY_KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(CITY_EVENT));
}

// [city, setCity]: the remembered city code (or name for old values), synced across the header, home and tabs.
export function useCityPref() {
  const [city, setCity] = useState(lastCity);
  useEffect(() => {
    const sync = () => setCity(lastCity());
    window.addEventListener(CITY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CITY_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const set = (c) => { if (c) rememberCity(c); else forgetCity(); setCity(c || ''); };
  return [city, set];
}

// ---------------------------------------------------------------- referral capture (RE-N-01)

const REF_KEY = 'pd.ref';
const REF_COOKIE = 'pd_ref';
export const REF_PATTERN = /^[A-Z0-9]{6,12}$/;
const DAY = 86_400_000;

function readCookie(name) {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
  } catch { return ''; }
}

// Stores the code for `days` (setting mlm.refCaptureDays, default 30). The last code wins.
export function captureReferral(search, days = 30) {
  let code;
  try { code = String(new URLSearchParams(search || '').get('ref') || '').trim().toUpperCase(); } catch { return null; }
  if (!REF_PATTERN.test(code)) return null;
  const d = Math.max(1, Math.min(365, Number(days) || 30));
  try { localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now(), until: Date.now() + d * DAY })); } catch { /* storage blocked */ }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${REF_COOKIE}=${encodeURIComponent(code)}; Max-Age=${d * 86400}; Path=/; SameSite=Lax${secure}`;
  } catch { /* cookies blocked */ }
  return code;
}

// The captured code while it is inside its window, else ''.
export function referralCode() {
  try {
    const row = JSON.parse(localStorage.getItem(REF_KEY) || 'null');
    if (row && REF_PATTERN.test(row.code) && row.until > Date.now()) return row.code;
    if (row) localStorage.removeItem(REF_KEY);
  } catch { /* storage blocked or bad JSON */ }
  const c = readCookie(REF_COOKIE).toUpperCase();
  return REF_PATTERN.test(c) ? c : '';
}

// Spread into payloads that accept `referralCode` (guest enquiry, registration).
export const referralField = () => { const c = referralCode(); return c ? { referralCode: c } : {}; };

// GET /api/me/referral -> { code, shareLink, referredBy } for the signed-in user.
export const useMyReferral = (enabled) => useQuery({ queryKey: ['me', 'referral'], queryFn: () => api.get('/me/referral'), enabled: Boolean(enabled), staleTime: Infinity, retry: false });

// Adds ?ref=<own code> to a share URL.
export function withRef(url, code) {
  if (!code) return url;
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('ref', code);
    return u.toString();
  } catch { return url; }
}
