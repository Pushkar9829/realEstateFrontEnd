// Control Center hand-off context (control-center/docs/CC_CONTRACT.md 7.4).
// Kept in sessionStorage for this tab only, and removed when the session ends,
// so the Control bar shows only for sessions that came from the Control Center.
// This file is the same in the four platform frontends.
import { session } from './session';

const KEY = 'cc.ctx';

function read() {
  try { return JSON.parse(window.sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export const controlCenter = {
  get: read,
  set(ctx) {
    try { window.sessionStorage.setItem(KEY, JSON.stringify(ctx)); } catch { /* storage blocked */ }
  },
  clear() {
    try { window.sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  },
  // Link that asks the Control Center to sign this browser in to another platform.
  switchUrl(ctx, code, path) {
    const base = String((ctx && ctx.ccUrl) || '').replace(/\/$/, '');
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
