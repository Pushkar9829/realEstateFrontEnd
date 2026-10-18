// Final fix round (docs/audit/v2/realestate.md): trust badges by code in Hindi,
// valid <dl> markup, no nested interactive controls, Buy active on plain
// /search, 404 in the interface language, masked buyer labels in Hindi,
// labelled bulk-select on phone cards, accent badge contrast and the bell menu.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Home } from 'lucide-react';
import { setLang, translate } from '@/shared/i18n';
import { setAllowed } from '@/shared/i18n/store';
import VerificationBadges, { badgeLabel } from '@/panels/public/components/VerificationBadges';
import { KeyFacts } from '@/panels/public/components/DetailBits';
import DemoAccounts from '@/panels/public/pages/auth/DemoAccounts';
import NotFound from '@/app/NotFound';
import { linkActive } from '@/shared/layouts/PublicLayout';
import PanelLayout from '@/shared/layouts/PanelLayout';
import { buyerText } from '@/panels/lister/components/buyerLabel';
import { Badge, Table } from '@/shared/ui';

const hi = () => act(() => setLang('hi'));
beforeEach(() => { act(() => { setAllowed(null); setLang('en'); }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); act(() => setLang('en')); });

const INTERACTIVE = 'a[href], button, input, select, textarea, [role=button], [tabindex]:not([tabindex="-1"])';
const nestedInteractive = (root) => [...root.querySelectorAll(INTERACTIVE)].filter((el) => el.parentElement && el.parentElement.closest(INTERACTIVE));

describe('trust badges (N1)', () => {
  const BADGES = [
    { code: 'verified_lister', labelCode: 'verified_builder', brand: 'Skyline Homes', label: 'Verified Builder · Skyline Homes', verifiedAt: '2026-10-05T06:00:00Z', tooltip: 'Our team checked the builder\'s ID ... on 05/10/2026.' },
    { code: 'photo_verified', labelCode: 'photo_verified', label: 'Photo verified', verifiedAt: '2026-10-06T06:00:00Z' },
    { code: 'rera', labelCode: 'rera', label: 'RERA registered', reraNumbers: ['P5210001'] },
  ];

  test('English keeps the API text; Hindi translates by code and keeps the brand name', () => {
    render(<VerificationBadges badges={BADGES} />);
    expect(screen.getByRole('button', { name: /Verified Builder · Skyline Homes/ })).toBeInTheDocument();
    cleanup();
    hi();
    render(<VerificationBadges badges={BADGES} />);
    expect(screen.getByRole('button', { name: /सत्यापित बिल्डर · Skyline Homes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /फ़ोटो सत्यापित/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RERA पंजीकृत/ })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Verified|Photo verified|RERA registered/);
    // tooltips follow the language too, with the dd/mm/yyyy date
    expect(document.body).toHaveTextContent('06/10/2026');
    expect(document.body).toHaveTextContent('P5210001');
  });

  test('an unknown code falls back to the API label', () => {
    const t = (k, v) => translate('hi', k, v);
    expect(badgeLabel(t, 'something_new', undefined, 'New badge')).toBe('New badge');
    expect(badgeLabel(t, 'verified_owner')).toBe('सत्यापित मालिक');
  });
});

describe('description lists (N3)', () => {
  test('every <dl> item holds only <dt> and <dd>', () => {
    const { container } = render(<KeyFacts items={[{ icon: Home, label: 'Type', value: 'Flat' }, { icon: Home, label: 'Floor', value: '3 of 10' }]} />);
    const dl = container.querySelector('dl');
    [...dl.children].forEach((item) => {
      expect(item.tagName).toBe('DIV');
      expect([...item.children].map((c) => c.tagName)).toEqual(['DT', 'DD']);
    });
    expect(within(dl).getByText('Flat')).toBeInTheDocument();
  });
});

describe('no nested interactive controls (N4)', () => {
  test('login demo accounts: one fill button and a separate copy button per account', async () => {
    const onPick = vi.fn();
    const { container } = render(<DemoAccounts onPick={onPick} />);
    expect(nestedInteractive(container)).toEqual([]);
    expect(container.querySelector('[role=button]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Admin staff admin@demo\.local/ }));
    expect(onPick).toHaveBeenCalledWith('admin@demo.local', expect.any(String));
  });
});

describe('public header (N12)', () => {
  test('a search without purpose marks Buy as current, not Rent', () => {
    const loc = { pathname: '/search', search: '' };
    expect(linkActive('/search?purpose=sale', loc)).toBe(true);
    expect(linkActive('/search?purpose=rent', loc)).toBe(false);
    expect(linkActive('/search?purpose=rent', { pathname: '/search', search: '?purpose=rent' })).toBe(true);
  });
});

describe('404 page (N8)', () => {
  test('is translated', () => {
    hi();
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'पेज नहीं मिला' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'होम पर जाएँ' })).toHaveAttribute('href', '/');
  });
});

describe('masked buyer labels (N7)', () => {
  test('"Buyer 2" and "A buyer" follow the language; other text is data', () => {
    const t = (k, v) => translate('hi', k, v);
    expect(buyerText(t, 'Buyer 2')).toBe('खरीदार 2');
    expect(buyerText(t, 'A buyer')).toBe('एक खरीदार');
    expect(buyerText(t, 'Asha')).toBe('Asha');
  });
});

describe('bulk select on phone cards (N10)', () => {
  test('a labelled Select box in the card title row and Select all above the list', async () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('max-width'), addEventListener() {}, removeEventListener() {} }));
    const toggled = [];
    const rows = [{ _id: 'a', no: 'LD-1' }, { _id: 'b', no: 'LD-2' }];
    const columns = [
      { key: 'sel', mobile: 'select', header: <input type="checkbox" aria-label="Select all on this page" onChange={() => toggled.push('all')} />, render: (r) => <input type="checkbox" aria-label={`Select ${r.no}`} onChange={() => toggled.push(r.no)} /> },
      { key: 'no', header: 'Lead' },
    ];
    render(<MemoryRouter><Table rows={rows} columns={columns} rowHref={(r) => `/x/${r._id}`} /></MemoryRouter>);
    const all = screen.getByTestId('select-all-mobile');
    expect(all).toHaveTextContent('Select all on this page');
    const card = screen.getByRole('link', { name: 'LD-1' }).closest('li');
    expect(card.firstChild).toContainElement(within(card).getByRole('checkbox', { name: 'Select LD-1' }));
    expect(card.firstChild).toHaveTextContent('Select');
    await userEvent.click(within(card).getByText('Select'));
    await userEvent.click(within(all).getByText('Select all on this page'));
    expect(toggled).toEqual(['LD-1', 'all']);
  });
});

describe('accent badge contrast (N5)', () => {
  test('uses accent-800 text (5.8:1 on accent-50)', () => {
    render(<Badge tone="accent">Warm</Badge>);
    expect(screen.getByText('Warm').className).toContain('text-accent-800');
  });
});

describe('bell menu (L8)', () => {
  test('opens notifications or marks everything read', async () => {
    const markAll = vi.fn(async () => {});
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<PanelLayout panel="admin" panelLabel="Admin panel" base="/admin" sections={[{ id: 'm', items: [{ to: '/admin', label: 'Dashboard', end: true }] }]} user={{ name: 'A', email: 'a@x.test' }} accountTo="/admin/account" onLogout={() => {}} notificationsTo="/admin/notifications" notificationsCount={4} onMarkAllRead={markAll} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /4/ }));
    expect(screen.getByRole('menuitem', { name: /Open notifications/ })).toHaveAttribute('href', '/admin/notifications');
    await userEvent.click(screen.getByRole('menuitem', { name: /Mark all read/ }));
    expect(markAll).toHaveBeenCalledTimes(1);
  });
});
