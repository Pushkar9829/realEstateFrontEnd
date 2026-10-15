// Token storage (docs/ARCHITECTURE.md 5.3): the access token lives only in
// memory; the refresh token is kept in localStorage so a reload can resume
// the session. Refresh tokens rotate on every use and reuse is detected by
// the API, which then revokes the whole family.
const KEY = 're.refresh';
let accessToken = null;
const listeners = new Set();

function safeGet() {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
function safeSet(v) {
  try { if (v) window.localStorage.setItem(KEY, v); else window.localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export const session = {
  getAccess: () => accessToken,
  getRefresh: () => safeGet(),
  set({ accessToken: a, refreshToken: r }) {
    accessToken = a || null;
    if (r !== undefined) safeSet(r);
  },
  clear(reason = 'logout') {
    accessToken = null;
    safeSet(null);
    listeners.forEach((fn) => fn(reason));
  },
  onClear(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
