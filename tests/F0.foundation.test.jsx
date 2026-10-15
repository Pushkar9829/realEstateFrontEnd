// Frontend phase F0 - foundation: shared lib, UI kit, auth schemas, guards and
// panel navigation. Test names follow "[Module][panel] FEATURE-ID ...".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import { rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { session } from '@/shared/lib/session';
import { http, ApiError, api } from '@/shared/lib/api';
import { Button, OtpInput, Table, Badge } from '@/shared/ui';
import { registerSchema, loginSchema } from '@/modules/auth/schemas';
import { ADMIN_NAV, AGENT_NAV, LISTER_NAV, visibleNav, placeholders } from '@/panels/panelNav';
import tokens from '@/design/tokens.json';

describe('[Infra][shared] design tokens and formatting', () => {
  test('tokens define every colour scale the UI kit uses', () => {
    ['brand', 'accent', 'success', 'warning', 'danger', 'info', 'ink', 'surface', 'line'].forEach((k) => expect(tokens.color[k]).toBeDefined());
    expect(tokens.color.brand['600']).toBe('#1F4E78');
  });

  test('money in paise is shown in rupees with Indian grouping and L / Cr short forms', () => {
    expect(rupees(850000000)).toBe('₹85,00,000');
    expect(shortRupees(850000000)).toBe('₹85 L');
    expect(shortRupees(1250000000)).toBe('₹1.25 Cr');
    expect(titleCase('changes_requested')).toBe('Changes Requested');
  });
});

describe('[Infra][shared] API client', () => {
  beforeEach(() => { session.set({ accessToken: null, refreshToken: null }); });

  test('unwraps the envelope and turns API errors into ApiError with field errors', async () => {
    http.defaults.adapter = async (config) => {
      if (config.url === '/ok') return { status: 200, data: { success: true, data: { id: 1 } }, headers: {}, config };
      const err = new Error('422');
      err.config = config;
      err.response = { status: 422, data: { success: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid', details: [{ in: 'body', path: 'email', message: 'Already registered' }] } } };
      throw err;
    };
    expect(await api.get('/ok')).toEqual({ id: 1 });
    const e = await api.post('/bad', {}).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.fieldErrors).toEqual({ email: 'Already registered' });
  });

  test('a 401 refreshes the session once and retries with the new token', async () => {
    session.set({ accessToken: 'old', refreshToken: 'r1' });
    const axios = (await import('axios')).default;
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'new', refreshToken: 'r2' } } });
    const seen = [];
    http.defaults.adapter = async (config) => {
      seen.push(config.headers.Authorization);
      if (config.headers.Authorization === 'Bearer old') {
        const err = new Error('401'); err.config = config;
        err.response = { status: 401, data: { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } } };
        throw err;
      }
      return { status: 200, data: { success: true, data: 'ok' }, headers: {}, config };
    };
    expect(await api.get('/me')).toBe('ok');
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(session.getRefresh()).toBe('r2');
    post.mockRestore();
  });
});

describe('[Infra][shared] UI kit', () => {
  test('Button shows a spinner and is disabled while loading', () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole('button', { name: /save/i });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
  });

  test('OtpInput fills all boxes on paste of a full code', () => {
    function Host() { const [v, setV] = useState(''); return <><OtpInput value={v} onChange={setV} /><output>{v}</output></>; }
    render(<Host />);
    fireEvent.change(screen.getByLabelText('Digit 1'), { target: { value: '123456' } });
    expect(document.querySelector('output').textContent).toBe('123456');
  });

  test('Table renders rows and an empty state', () => {
    const { rerender } = render(<Table rowKey={(r) => r.id} rows={[{ id: 1, n: 'RE26-000001' }]} columns={[{ key: 'n', header: 'Listing' }]} />);
    expect(screen.getByText('RE26-000001')).toBeInTheDocument();
    rerender(<Table rows={[]} columns={[{ key: 'n', header: 'Listing' }]} empty="No listings" />);
    expect(screen.getByText('No listings')).toBeInTheDocument();
    render(<Badge tone="success">Photo verified</Badge>);
    expect(screen.getByText('Photo verified')).toBeInTheDocument();
  });
});

describe('[M][public] RE-M-01/02 auth form rules mirror the API', () => {
  const base = { role: 'lister', listerType: 'owner', name: 'Asha Owner', email: 'asha@example.com', phone: '9876543210', password: 'Secret123', confirmPassword: 'Secret123', acceptTerms: true, noBrokerDeclaration: true };

  test('valid lister registration passes', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  test('listers must declare they are not brokers; builders need a company', () => {
    const r1 = registerSchema.safeParse({ ...base, noBrokerDeclaration: false });
    expect(r1.error.issues.map((i) => i.path[0])).toContain('noBrokerDeclaration');
    const r2 = registerSchema.safeParse({ ...base, listerType: 'builder' });
    expect(r2.error.issues.map((i) => i.path[0])).toContain('companyName');
  });

  test('weak passwords, mismatches and bad phones are rejected', () => {
    const r = registerSchema.safeParse({ ...base, password: 'abcdefgh', confirmPassword: 'x', phone: '12345' });
    const paths = r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['password', 'phone']));
    expect(registerSchema.safeParse({ ...base, phone: '+14155550123' }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: 'a', password: '' }).success).toBe(false);
  });
});

describe('[Infra][admin] panel navigation and guards', () => {
  test('admin nav shows only screens the staff member has permission for', () => {
    const auth = { user: { role: 'admin' }, hasPermission: (k) => ['listers.verify', 'masters.manage'].includes(k) };
    const items = visibleNav(ADMIN_NAV, auth).flatMap((s) => s.items).map((i) => i.to);
    expect(items).toEqual(expect.arrayContaining(['/admin', '/admin/kyc', '/admin/masters', '/admin/account']));
    expect(items).not.toContain('/admin/deals');
  });

  test('builder projects appear only for builder accounts', () => {
    const owner = visibleNav(LISTER_NAV, { user: { listerType: 'owner' }, hasPermission: () => false }).flatMap((s) => s.items).map((i) => i.to);
    const builder = visibleNav(LISTER_NAV, { user: { listerType: 'builder' }, hasPermission: () => false }).flatMap((s) => s.items).map((i) => i.to);
    expect(owner).not.toContain('/lister/projects');
    expect(builder).toContain('/lister/projects');
  });

  test('placeholders only cover items still flagged with a later phase', () => {
    const nav = [{ items: [{ to: '/admin/x', label: 'X', perm: 'x.view', phase: 'F9' }, { to: '/admin/kyc', label: 'KYC' }] }];
    const p = placeholders(nav, '/admin');
    expect(p).toEqual([expect.objectContaining({ path: 'x', phase: 'F9', perm: 'x.view' })]);
  });

  test('every screen is built: no nav item is left on a placeholder (F2-F5 done)', () => {
    [ADMIN_NAV, AGENT_NAV, LISTER_NAV].forEach((nav) => expect(nav.flatMap((s) => s.items).filter((i) => i.phase)).toEqual([]));
  });
});

describe('[M][public] RE-M-04 guards redirect by session state', () => {
  test('RequireAuth sends guests to /login', async () => {
    vi.resetModules();
    vi.doMock('@/modules/auth', () => ({ useAuth: () => ({ status: 'guest' }), HOME: {} }));
    const { RequireAuth } = await import('@/app/guards');
    render(
      <MemoryRouter initialEntries={['/lister']}>
        <Routes>
          <Route path="/lister" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    vi.doUnmock('@/modules/auth');
  });

  test('RequireRole sends a lister away from the admin panel to their home', async () => {
    vi.resetModules();
    vi.doMock('@/modules/auth', () => ({ useAuth: () => ({ status: 'authed', user: { role: 'lister' } }), HOME: { lister: '/lister' } }));
    const { RequireRole } = await import('@/app/guards');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RequireRole roles={['admin']}><p>admin</p></RequireRole>} />
          <Route path="/lister" element={<p>lister home</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('lister home')).toBeInTheDocument());
    vi.doUnmock('@/modules/auth');
  });
});

describe('[Infra][shared] UI enhancements', () => {
  test('password strength grows with length, case, digits and symbols', async () => {
    const { scorePassword } = await import('@/modules/auth/components/PasswordStrength');
    expect(scorePassword('abc')).toBe(0);
    expect(scorePassword('abcdefgh')).toBe(1);
    expect(scorePassword('Abcdefg1')).toBe(3);
    expect(scorePassword('Abcdefgh12#x')).toBe(4);
  });

  test('Accordion opens one answer at a time', async () => {
    const { Accordion } = await import('@/shared/ui');
    render(<Accordion items={[{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }]} />);
    expect(screen.getByText('A1')).toBeVisible();
    expect(screen.getByText('A2')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Q2' }));
    expect(screen.getByText('A2')).toBeVisible();
    expect(screen.getByText('A1')).not.toBeVisible();
  });
});
