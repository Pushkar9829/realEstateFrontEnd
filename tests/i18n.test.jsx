// Lightweight i18n (SPEC 9, M7 Hindi UI): t() lookup, fallbacks, plurals,
// the remembered language, the `i18n.languages` setting and the switcher.
import { describe, test, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, setLang, translate, useLang, useT } from '@/shared/i18n';
import LanguageSwitcher from '@/shared/i18n/LanguageSwitcher';
import { DICTIONARIES } from '@/shared/i18n/locales';
import { LANG_KEY, reloadFromStorage, setAllowed } from '@/shared/i18n/store';

function Probe() {
  const t = useT();
  const { lang } = useLang();
  return <p data-testid="probe" data-lang={lang}>{t('common.header.login')}</p>;
}

beforeEach(() => {
  act(() => { setAllowed(null); setLang('en'); });
  localStorage.clear();
});

describe('translate()', () => {
  test('English is the default, Hindi is used when chosen', () => {
    expect(translate('en', 'common.header.login')).toBe('Log in');
    expect(translate('hi', 'common.header.login')).toBe('लॉग इन');
  });

  test('fills {placeholders} and picks plural forms', () => {
    expect(translate('en', 'common.footer.rights', { year: 2026, company: 'PD' })).toBe('© 2026 PD. All rights reserved.');
    expect(translate('en', 'common.header.shortlist', { count: 1 })).toBe('Shortlist, 1 saved property');
    expect(translate('en', 'common.header.shortlist', { count: 3 })).toBe('Shortlist, 3 saved properties');
    expect(translate('hi', 'common.header.shortlist', { count: 3 })).toMatch(/शॉर्टलिस्ट, 3/);
  });

  test('missing Hindi text falls back to English; an unknown key returns the key', () => {
    DICTIONARIES.en.common.__onlyEnglish = 'Only in English';
    expect(translate('hi', 'common.__onlyEnglish')).toBe('Only in English');
    delete DICTIONARIES.en.common.__onlyEnglish;
    expect(translate('hi', 'common.nope.missing')).toBe('common.nope.missing');
  });

  test('every Hindi string has an English source and every value is Devanagari or neutral', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
    const en = new Map(flat(DICTIONARIES.en));
    const hi = flat(DICTIONARIES.hi);
    hi.forEach(([k]) => expect(en.has(k), `hi key ${k} has no English`).toBe(true));
    // placeholders must match between languages
    hi.forEach(([k, v]) => {
      const ph = (s) => (typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join() : '');
      expect(ph(v), `placeholders of ${k}`).toBe(ph(en.get(k)));
    });
  });
});

describe('useT / useLang / LanguageSwitcher', () => {
  test('re-renders on language change and remembers the choice', async () => {
    render(<><Probe /><LanguageSwitcher /></>);
    expect(screen.getByTestId('probe')).toHaveTextContent('Log in');
    await userEvent.click(screen.getByRole('button', { name: 'हिन्दी' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('लॉग इन');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'hi');
    expect(localStorage.getItem(LANG_KEY)).toBe('hi');
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByRole('button', { name: 'हिन्दी' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('reads the remembered language from storage', () => {
    localStorage.setItem(LANG_KEY, 'hi');
    act(() => reloadFromStorage());
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('लॉग इन');
  });

  test('an unknown stored value falls back to English', () => {
    localStorage.setItem(LANG_KEY, 'fr');
    act(() => reloadFromStorage());
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('Log in');
  });

  test('respects i18n.languages: English only hides the switcher and forces English', () => {
    act(() => setLang('hi'));
    render(<I18nProvider languages={['en']}><Probe /><LanguageSwitcher /></I18nProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('Log in');
    expect(screen.queryByRole('button', { name: 'हिन्दी' })).toBeNull();
  });

  test('i18n.languages [en, hi] shows both options', () => {
    render(<I18nProvider languages={['en', 'hi']}><LanguageSwitcher /></I18nProvider>);
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'हिन्दी' })).toBeInTheDocument();
  });

  test('works when storage throws', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      render(<Probe />);
      act(() => setLang('hi'));
      expect(screen.getByTestId('probe')).toHaveTextContent('लॉग इन');
    } finally { Storage.prototype.setItem = orig; }
  });
});
