// Language state for the UI (SPEC 9: English at launch, Hindi in M7). A tiny
// external store so every page reads the same language without a provider; the
// I18nProvider only narrows the choice to the `i18n.languages` setting. The
// choice is a functional preference (like the chosen city), so it is kept in
// localStorage before any cookie choice; every storage access is in try/catch.
import { DICTIONARIES } from './locales';

export const LANG_KEY = 'pd.lang';
export const DEFAULT_LANG = 'en';
export const SUPPORTED = Object.keys(DICTIONARIES); // ['en', 'hi']
export const LANG_LABELS = { en: 'English', hi: 'हिन्दी' };

const listeners = new Set();
let allowed = SUPPORTED;

const readStored = () => { try { return localStorage.getItem(LANG_KEY) || ''; } catch { return ''; } };
let current = SUPPORTED.includes(readStored()) ? readStored() : DEFAULT_LANG;

function applyDocumentLang(lang) {
  try { document.documentElement.lang = lang; } catch { /* no document (tests / SSR) */ }
}
applyDocumentLang(current);

const emit = () => listeners.forEach((fn) => fn());

export const getLang = () => (allowed.includes(current) ? current : DEFAULT_LANG);
export const getAllowed = () => allowed;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(lang) {
  if (!SUPPORTED.includes(lang)) return;
  current = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked */ }
  applyDocumentLang(getLang());
  emit();
}

// `languages` from GET /api/settings/public (`i18n.languages`); unknown codes are ignored, English is always kept.
export function setAllowed(languages) {
  const list = Array.isArray(languages) ? languages.filter((l) => SUPPORTED.includes(l)) : [];
  const next = list.length ? Array.from(new Set([DEFAULT_LANG, ...list])) : SUPPORTED;
  if (next.join() === allowed.join()) return;
  allowed = next;
  applyDocumentLang(getLang());
  emit();
}

// Picks the stored language again (used by tests and by other tabs through the storage event).
export function reloadFromStorage() {
  const s = readStored();
  current = SUPPORTED.includes(s) ? s : DEFAULT_LANG;
  applyDocumentLang(getLang());
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === LANG_KEY) reloadFromStorage(); });
}
