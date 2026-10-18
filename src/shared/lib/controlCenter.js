// Control Center hand-off context (control-center/docs/CC_CONTRACT.md 7.4).
// Kept in sessionStorage for this tab only, and removed when the session ends,
// so the Control bar shows only for sessions that came from the Control Center.
// This file is the same in the four platform frontends.
import { session } from './session';

const KEY = 'cc.ctx';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

// Links from the hand-off context go into href, so only https is allowed, or
// plain http when both the link and this page are on localhost (development).
export function safeCcUrl(u) {
  if (typeof u !== 'string' || !u) return null;
  let url;
  try { url = new URL(u); } catch { return null; }
  if (url.username || url.password) return null;
  if (url.protocol === 'https:') return url.href.replace(/\/$/, '');
  const here = typeof window !== 'undefined' ? window.location.hostname : '';
  if (url.protocol === 'http:' && LOCAL.test(url.hostname) && LOCAL.test(here)) return url.href.replace(/\/$/, '');
  return null;
}

function valid(ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  const ccUrl = safeCcUrl(ctx.ccUrl);
  return ccUrl ? { ...ctx, ccUrl } : null;
}

function read() {
  try { return valid(JSON.parse(window.sessionStorage.getItem(KEY) || 'null')); } catch { return null; }
}

export const controlCenter = {
  get: read,
  set(ctx) {
    const ok = valid(ctx);
    try {
      if (ok) window.sessionStorage.setItem(KEY, JSON.stringify(ok));
      else window.sessionStorage.removeItem(KEY);
    } catch { /* storage blocked */ }
  },
  clear() {
    try { window.sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  },
  // Link that asks the Control Center to sign this browser in to another platform.
  switchUrl(ctx, code, path) {
    const base = safeCcUrl(ctx && ctx.ccUrl);
    if (!base) return '#';
    return `${base}/go/${encodeURIComponent(code)}${path ? `?path=${encodeURIComponent(path)}` : ''}`;
  },
};

session.onClear(() => controlCenter.clear());

// The assertion arrives in the URL fragment (#assertion=...), or as ?assertion= .
export function readAssertion(location) {
  const fromHash = new URLSearchParams(String(location.hash || '').replace(/^#/, '')).get('assertion');
  return fromHash || new URLSearchParams(location.search || '').get('assertion');
}

export const safePath = (p, fallback) => (typeof p === 'string' && /^\/(?!\/)[^\s\\]*$/.test(p) ? p : fallback);
