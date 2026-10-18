// Audit fixes (docs/audit/realestate.md): table rows as real links, dd/mm/yyyy
// dates in IST, the dd/mm/yyyy date field, the compact cookie bar, dictionaries
// loaded per language and namespace, and the panel menu's Jump to filter.
import { describe, test, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Table } from '@/shared/ui';
import DateInput, { dmyToIso, isoToDmy, maskDmy } from '@/shared/ui/DateInput';
import { date, dateTime, rupees } from '@/shared/lib/format';
import CookieBanner from '@/shared/components/CookieBanner';
import { setLang, translate } from '@/shared/i18n';
import { DICTIONARIES, PANEL_NAMESPACES, PUBLIC_NAMESPACES, isLoaded } from '@/shared/i18n/locales';
import { setAllowed } from '@/shared/i18n/store';

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}</p>; }

beforeEach(() => { act(() => { setAllowed(null); setLang('en'); }); });

describe('Table rows (A2)', () => {
  const rows = [{ _id: 'a1', no: 'LD26-000001', name: 'Asha' }, { _id: 'b2', no: 'LD26-000002', name: 'Ravi' }];
  const columns = [{ key: 'no', header: 'Lead' }, { key: 'name', header: 'Buyer' }];

  test('the first column is a real link to the row page; clicking elsewhere on the row follows it', async () => {
    render(<MemoryRouter initialEntries={['/list']}><Routes><Route path="*" element={<><Table rows={rows} columns={columns} rowHref={(r) => `/leads/${r._id}`} /><Where /></>} /></Routes></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'LD26-000001' });
    expect(link).toHaveAttribute('href', '/leads/a1');
    await userEvent.click(screen.getByText('Ravi'));
    expect(screen.getByTestId('where')).toHaveTextContent('/leads/b2');
  });

  test('keyboard: the link is focusable and Enter opens it', async () => {
    render(<MemoryRouter initialEntries={['/list']}><Routes><Route path="*" element={<><Table rows={rows} columns={columns} rowHref={(r) => `/leads/${r._id}`} /><Where /></>} /></Routes></MemoryRouter>);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'LD26-000001' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/leads/a1');
  });

  test('onRowClick (in-page detail) gets a keyboard button in the first cell', async () => {
    const opened = [];
    render(<Table rows={rows} columns={columns} onRowClick={(r) => opened.push(r._id)} />);
    await userEvent.click(screen.getByRole('button', { name: 'LD26-000002' }));
    expect(opened).toEqual(['b2']);
  });

  test('an API error shows an error state instead of an empty table', () => {
    render(<Table rows={[]} columns={columns} error={{ message: 'Server down' }} onRetry={() => {}} />);
    expect(screen.getByText('Could not load this list')).toBeInTheDocument();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
  });
});

describe('One date and money format (dd/mm/yyyy, IST)', () => {
  test('dates are dd/mm/yyyy in IST; rupees in Indian grouping', () => {
    expect(date('2026-10-17T20:00:00Z')).toBe('18/10/2026'); // 01:30 IST next day
    expect(dateTime('2026-10-17T05:32:00Z')).toMatch(/^17\/10\/2026, 11:02 am$/i);
    expect(date(null)).toBe('-');
    expect(rupees(123456700)).toBe('₹12,34,567');
  });

  test('DateInput converts between dd/mm/yyyy and ISO and rejects impossible dates', () => {
    expect(isoToDmy('2026-02-03')).toBe('03/02/2026');
    expect(dmyToIso('03/02/2026')).toBe('2026-02-03');
    expect(dmyToIso('31/02/2026')).toBeNull();
    expect(maskDmy('03022026')).toBe('03/02/2026');
  });

  test('typing dd/mm/yyyy emits the ISO value', () => {
    const got = [];
    render(<DateInput aria-label="From" value="" onChange={(e) => got.push(e.target.value)} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '05112026' } });
    expect(screen.getByLabelText('From')).toHaveValue('05/11/2026');
    expect(got.at(-1)).toBe('2026-11-05');
  });
});

describe('Cookie bar (P1)', () => {
  test('a compact region along the bottom that publishes its height for the sticky Enquire bar', async () => {
    const { unmount } = render(<MemoryRouter><CookieBanner ready enabled /></MemoryRouter>);
    const bar = screen.getByRole('region', { name: 'Cookies on this site' });
    expect(bar.className).toMatch(/fixed inset-x-0 bottom-0/);
    expect(screen.getByRole('button', { name: 'Essential only' })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--cookie-bar')).toMatch(/px$/);
    await userEvent.click(screen.getByRole('button', { name: 'Essential only' }));
    expect(screen.queryByRole('region', { name: 'Cookies on this site' })).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--cookie-bar')).toBe('0px');
    unmount();
  });
});

describe('Dictionaries per language and namespace (bundle)', () => {
  test('every public and panel namespace exists in both languages with the same keys', () => {
    [...PUBLIC_NAMESPACES, ...PANEL_NAMESPACES].forEach((ns) => {
      expect(isLoaded('en', ns), `en/${ns}`).toBe(true);
      expect(isLoaded('hi', ns), `hi/${ns}`).toBe(true);
    });
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    PANEL_NAMESPACES.forEach((ns) => {
      const en = new Set(flat(DICTIONARIES.en[ns]));
      const missing = flat(DICTIONARIES.hi[ns]).filter((k) => !en.has(k));
      expect(missing, `${ns} hi keys without English`).toEqual([]);
    });
  });

  test('panel chrome is translated', () => {
    expect(translate('hi', 'panel.nav.listerListings')).toBe('मेरी लिस्टिंग');
    expect(translate('en', 'panel.layout.jumpTo')).toBe('Jump to…');
    expect(translate('hi', 'common.skipToContent')).toBe('मुख्य सामग्री पर जाएँ');
  });
});

describe('Routing rules: property type checkboxes', () => {
  test('MultiCheck takes { value, label } options: labels shown, ticking stores the value and stays ticked', async () => {
    const { MultiCheck } = await import('@/panels/admin/pages/routing/RoutingRulesPage');
    function Harness() {
      const [v, setV] = useState([]);
      return <><MultiCheck label="Property types" values={v} options={[{ value: 'apartment', label: 'Apartment / flat' }, { value: 'villa', label: 'Villa' }]} onChange={setV} /><p data-testid="v">{v.join(',')}</p></>;
    }
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Apartment / flat'));
    expect(screen.getByTestId('v')).toHaveTextContent('apartment');
    expect(screen.getByLabelText('Apartment / flat')).toBeChecked();
    expect(screen.getByLabelText('Villa')).not.toBeChecked();
  });

  test('plain string options still work (sources, lister types)', async () => {
    const { MultiCheck } = await import('@/panels/admin/pages/routing/RoutingRulesPage');
    const got = [];
    render(<MultiCheck label="Sources" values={['walk_in']} options={['enquiry', 'walk_in']} onChange={(v) => got.push(v)} />);
    expect(screen.getByLabelText('Walk In')).toBeChecked();
    await userEvent.click(screen.getByLabelText('Enquiry'));
    expect(got.at(-1)).toEqual(['walk_in', 'enquiry']);
  });
});
