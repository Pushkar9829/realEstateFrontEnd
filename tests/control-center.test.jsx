// Control Center hand-off (control-center/docs/CC_CONTRACT.md 7.4): /sso/cc and the Control bar.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from '@/shared/lib/api';
import { session } from '@/shared/lib/session';
import { controlCenter, readAssertion } from '@/shared/lib/controlCenter';
import { AuthProvider } from '@/modules/auth/AuthProvider';
import SsoCc from '@/modules/auth/SsoCc';
import ControlBar from '@/shared/components/ControlBar';

const CURRENT = 'realestate'; // this platform
const NAMES = { realestate: 'Real Estate', ecommerce: 'E-commerce', lms: 'LMS', hub: 'Growth Hub' };
const OTHER = CURRENT === 'ecommerce' ? 'lms' : 'ecommerce';
const CTX = { ccUrl: 'http://localhost:5185', env: 'demo', ccRole: 'owner', projects: [CURRENT, OTHER].map((code) => ({ code, name: NAMES[code] })), ccUser: { name: 'Demo Owner', email: 'owner@demo.local' } };
const ME = { _id: 'u1', name: 'Demo Owner (Control Center)', email: 'cc-x@control-center.invalid', role: 'admin', status: 'active', permissions: [] };

function renderAt(path, routes) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider><Routes>{routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}</Routes></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => { vi.unstubAllGlobals(); controlCenter.clear(); sessionStorage.clear(); });

describe('[CC] Control Center single sign-on', () => {
  test('reads the assertion from the fragment (or the query string)', () => {
    expect(readAssertion({ hash: '#assertion=abc.def', search: '' })).toBe('abc.def');
    expect(readAssertion({ hash: '', search: '?assertion=xyz' })).toBe('xyz');
  });

  test('/sso/cc posts the assertion once, stores the session and opens the requested page', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { accessToken: 'acc-1', refreshToken: 'ref-1', user: ME, home: '/admin', cc: { path: '/admin/target', ctx: CTX, ccUser: CTX.ccUser } } }) }));
    vi.stubGlobal('fetch', fetchMock);
    http.defaults.adapter = async (config) => ({ status: 200, data: { success: true, data: /me$/.test(config.url) ? ME : {} }, headers: {}, config });
    renderAt('/sso/cc#assertion=signed.jwt.value', [
      { path: '/sso/cc', element: <SsoCc /> },
      { path: '/admin/target', element: <p>Target screen</p> },
    ]);
    expect(await screen.findByText('Target screen')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ assertion: 'signed.jwt.value' });
    expect(session.getAccess()).toBe('acc-1');
    expect(controlCenter.get()).toMatchObject({ ccUrl: 'http://localhost:5185', ccUser: { name: 'Demo Owner' } });
  });

  test('a used or expired link shows a clear message and a normal login link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ success: false, error: { code: 'SSO_REPLAYED', message: 'used' } }) })));
    renderAt('/sso/cc#assertion=old', [{ path: '/sso/cc', element: <SsoCc /> }]);
    expect(await screen.findByRole('alert')).toHaveTextContent('already used');
    expect(screen.getByRole('link', { name: /own account/ })).toBeInTheDocument();
  });

  test('the Control bar shows only for Control Center sessions, with switch links', async () => {
    const { unmount } = render(<ControlBar current={CURRENT} />);
    expect(screen.queryByTestId('control-bar')).toBeNull();
    unmount();
    controlCenter.set(CTX);
    render(<ControlBar current={CURRENT} />);
    expect(screen.getByTestId('control-bar')).toHaveTextContent('Acting via Control Center as Demo Owner');
    expect(screen.getByText('Demo')).toBeInTheDocument();
    screen.getByRole('button', { name: new RegExp(NAMES[CURRENT]) }).click();
    await waitFor(() => expect(screen.getByRole('menuitem', { name: new RegExp(NAMES[OTHER]) })).toHaveAttribute('href', `http://localhost:5185/go/${OTHER}`));
    session.clear('logout');
    expect(controlCenter.get()).toBeNull();
  });
});
