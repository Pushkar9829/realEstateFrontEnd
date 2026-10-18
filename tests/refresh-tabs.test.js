// Final fix round: refresh tokens rotate and the API keeps one usable token
// per session. Two tabs (two module instances sharing localStorage) that
// refresh together must both keep working and end on the single live token.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const server = vi.hoisted(() => ({ live: new Set(), n: 0, calls: [], onCall: null }));
vi.mock('axios', () => {
  const inst = () => ({ interceptors: { request: { use() {} }, response: { use() {} } } });
  const post = vi.fn(async (url, body) => {
    await new Promise((r) => setTimeout(r, 5)); // network latency so the tabs overlap
    server.calls.push(body.refreshToken);
    if (server.onCall) server.onCall(body.refreshToken);
    if (!server.live.has(body.refreshToken)) {
      const err = new Error('401'); err.response = { status: 401, data: { error: { code: 'REFRESH_SUPERSEDED' } } };
      throw err;
    }
    server.live.delete(body.refreshToken); // strict rotation: one live token
    server.n += 1;
    const next = `ref-${server.n}`;
    server.live.add(next);
    return { data: { data: { accessToken: `acc-${server.n}`, refreshToken: next } } };
  });
  return { default: { create: inst, post } };
});

async function openTab() {
  vi.resetModules();
  const api = await import('@/shared/lib/api');
  const { session } = await import('@/shared/lib/session');
  return { refresh: api.refreshSession, session };
}

function fakeLocks() {
  let chain = Promise.resolve();
  return { request: (name, fn) => { const run = chain.then(() => fn()); chain = run.catch(() => {}); return run; } };
}

beforeEach(() => {
  server.live = new Set(['ref-0']); server.n = 0; server.calls = []; server.onCall = null;
  localStorage.setItem('re.refresh', 'ref-0');
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('[auth] refresh across tabs', () => {
  test('with Web Locks: two tabs refreshing together both succeed and share the one live token', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: fakeLocks() });
    const a = await openTab();
    const b = await openTab();
    const [ra, rb] = await Promise.all([a.refresh(), b.refresh()]);
    expect(ra.accessToken).toBeTruthy();
    expect(rb.accessToken).toBeTruthy();
    expect(server.calls).toEqual(['ref-0', 'ref-1']); // the second tab re-read the stored token
    expect([...server.live]).toEqual([localStorage.getItem('re.refresh')]);
    expect(a.session.getAccess()).toBeTruthy();
    expect(b.session.getAccess()).toBeTruthy();
  });

  test('without Web Locks: a tab whose token was replaced retries with the stored one and never clears it', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    const a = await openTab();
    const b = await openTab();
    await a.refresh(); // tab A rotates ref-0 -> ref-1 and stores it
    server.live = new Set(['ref-1']);
    // tab B had read ref-0 before A stored ref-1: simulate by sending ref-0 first
    localStorage.setItem('re.refresh', 'ref-0');
    const pending = b.refresh();
    localStorage.setItem('re.refresh', 'ref-1'); // A's write lands while B is in flight
    const rb = await pending;
    expect(rb.refreshToken).toBe('ref-2');
    expect(localStorage.getItem('re.refresh')).toBe('ref-2');
    expect([...server.live]).toEqual(['ref-2']);
  });

  test('a refresh that fails while another tab already stored a newer token does not sign that tab out', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    server.live = new Set(); // every refresh fails
    const a = await openTab();
    // another tab stores ref-9 while ref-0 is in flight, then ref-10 while ref-9 is
    server.onCall = (tok) => { if (tok === 'ref-0') localStorage.setItem('re.refresh', 'ref-9'); if (tok === 'ref-9') localStorage.setItem('re.refresh', 'ref-10'); };
    await a.refresh().catch((e) => e);
    expect(server.calls).toEqual(['ref-0', 'ref-9']);
    expect(localStorage.getItem('re.refresh')).toBe('ref-10');
    server.onCall = null;
    // and when nothing newer exists, the session ends as before
    localStorage.setItem('re.refresh', 'ref-0');
    await a.refresh().catch(() => {});
    expect(localStorage.getItem('re.refresh')).toBe(null);
  });
});
