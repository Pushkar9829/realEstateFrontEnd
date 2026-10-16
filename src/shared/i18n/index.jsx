// Lightweight i18n for the public portal and auth pages (SPEC 9, M7 Hindi UI).
//   const t = useT();  t('header.login')  t('search.results', { count: 12 })
//   const { lang, setLang, languages } = useLang();
// No provider is required (English by default). <I18nProvider languages={...}>
// applies the `i18n.languages` setting from GET /api/settings/public.
// Only fixed UI text is translated; listing titles and other data stay as typed.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getAllowed, getLang, setAllowed, setLang, subscribe, LANG_LABELS, SUPPORTED, DEFAULT_LANG } from './store';
import { translate } from './translate';

export { LANG_LABELS, SUPPORTED, DEFAULT_LANG, setLang, getLang, translate };

const getAllowedSnapshot = getAllowed;

export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  const languages = useSyncExternalStore(subscribe, getAllowedSnapshot, getAllowedSnapshot);
  return { lang, setLang, languages };
}

export function useT() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

// Non-hook form for code outside components (e.g. zod messages built at call time).
export const t = (key, vars) => translate(getLang(), key, vars);

export function I18nProvider({ languages, children }) {
  const key = Array.isArray(languages) ? languages.join(',') : '';
  useEffect(() => { if (key) setAllowed(key.split(',')); }, [key]);
  return children;
}
