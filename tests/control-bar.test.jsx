// Final fix round: Control Center bar inside the panel layout (after the skip
// link), translated, compact owner name on phones, one environment badge,
// sidebar height minus the bar, and only safe links from the hand-off context.
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, act, within, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { controlCenter, safeCcUrl } from '@/shared/lib/controlCenter';
import { setLang } from '@/shared/i18n';
import ControlBar from '@/shared/components/ControlBar';
import PanelLayout from '@/shared/layouts/PanelLayout';

const CTX = { ccUrl: 'https://cc.example.com/', env: 'demo', projects: [{ code: 'realestate', name: 'Real Estate' }, { code: 'lms', name: 'LMS' }], ccUser: { name: 'Pushkar Raj Sharma' } };
const USER = { name: 'Owner', email: 'o@x.test' };
const SECTIONS = [{ id: 'main', items: [{ to: '/admin', label: 'Dashboard', end: true }] }];

function layout(topBar) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<PanelLayout panel="admin" panelLabel="Admin panel" base="/admin" sections={SECTIONS} user={USER} accountTo="/admin/account" onLogout={() => {}} topBar={topBar} />}>
          <Route index element={<p>page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); act(() => setLang('en')); controlCenter.clear(); sessionStorage.clear(); });

describe('[CC] Control bar', () => {
  test('comes after the skip link and the layout takes its 40 px off the sticky sidebar', () => {
    controlCenter.set(CTX);
    const { container } = layout(<ControlBar current="realestate" />);
    const focusables = [...container.querySelectorAll('a[href], button')];
    expect(focusables[0]).toHaveAttribute('href', '#main');
    expect(screen.getByTestId('control-bar').contains(focusables[1])).toBe(true);
    const root = container.firstChild;
    expect(root.style.getPropertyValue('--cc-bar')).toBe('2.5rem');
    expect(screen.getByTestId('panel-sidebar').className).toContain('h-[calc(100vh-var(--cc-bar))]');
    expect(screen.getByTestId('panel-sidebar').className).toContain('top-[var(--cc-bar)]');
    // the bar is a row of the min-h-screen column (not stacked above a second h-screen), so no extra 40 px scroll
    expect(root.className).toContain('flex-col');
    expect(root.contains(screen.getByTestId('control-bar'))).toBe(true);
  });

  test('without a bar the layout is unchanged (no offset)', () => {
    const { container } = layout(null);
    expect(container.firstChild.style.getPropertyValue('--cc-bar')).toBe('0px');
    expect(screen.queryByTestId('control-bar')).toBeNull();
  });

  test('is translated into Hindi and shows exactly one environment badge', () => {
    act(() => setLang('hi'));
    controlCenter.set(CTX);
    render(<ControlBar current="realestate" />);
    const bar = screen.getByTestId('control-bar');
    expect(bar).toHaveAttribute('aria-label', 'कंट्रोल सेंटर');
    expect(bar).toHaveTextContent('कंट्रोल सेंटर पर वापस');
    expect(bar).not.toHaveTextContent('Back to Control Center');
    expect(bar).not.toHaveTextContent('Acting via');
    expect(within(bar).getAllByText('डेमो')).toHaveLength(1);
  });

  test('phones get initials (no truncated name); the full name stays for screen readers', () => {
    controlCenter.set(CTX);
    render(<ControlBar current="realestate" />);
    const ini = screen.getByTestId('control-bar-initials');
    expect(ini).toHaveTextContent(/^PR$/);
    expect(ini.className).toContain('sm:hidden');
    expect(ini).toHaveAttribute('title', 'Pushkar Raj Sharma');
    expect(screen.getByText('Acting via Control Center as Pushkar Raj Sharma', { selector: '.sr-only' })).toBeInTheDocument();
  });

  test('only https links (or http on localhost) are accepted from the session', () => {
    expect(safeCcUrl('https://cc.example.com/')).toBe('https://cc.example.com');
    expect(safeCcUrl('http://localhost:5185')).toBe('http://localhost:5185'); // the test page is on localhost
    expect(safeCcUrl('http://cc.example.com')).toBeNull();
    expect(safeCcUrl('javascript:alert(1)')).toBeNull();
    expect(safeCcUrl('data:text/html,hi')).toBeNull();
    expect(safeCcUrl('https://user:pw@cc.example.com')).toBeNull();
    expect(safeCcUrl('//cc.example.com')).toBeNull();
    controlCenter.set({ ...CTX, ccUrl: 'javascript:alert(1)' });
    expect(controlCenter.get()).toBeNull();
    sessionStorage.setItem('cc.ctx', JSON.stringify({ ...CTX, ccUrl: 'http://evil.example.com' })); // tampered storage
    expect(controlCenter.get()).toBeNull();
    render(<ControlBar current="realestate" />);
    expect(screen.queryByTestId('control-bar')).toBeNull();
    expect(controlCenter.switchUrl({ ccUrl: 'javascript:x' }, 'lms')).toBe('#');
  });
});
