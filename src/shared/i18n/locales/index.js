// Dictionaries: one file per language and namespace (en/<ns>.js, hi/<ns>.js),
// each its own chunk loaded on demand, so a visitor downloads only the
// language they read and staff panels add their namespaces when they open.
// t('common.login') reads DICTIONARIES[lang].common.login once loaded.
const LOADERS = import.meta.glob(['./en/*.js', './hi/*.js']);

export const LANGUAGES = ['en', 'hi'];
// Public site, auth and account screens: loaded at start-up.
export const PUBLIC_NAMESPACES = ['common', 'auth', 'home', 'search', 'property', 'account', 'marketing', 'discover', 'detail', 'pages'];
// Panel namespaces: loaded by the panel shell (panel = shared panel chrome).
export const PANEL_NAMESPACES = ['panel', 'lister', 'agent', 'admin'];

// Mutable registry: filled by loadNamespaces().
export const DICTIONARIES = Object.fromEntries(LANGUAGES.map((l) => [l, {}]));

const pending = new Map();

export const isLoaded = (lang, ns) => Boolean(DICTIONARIES[lang] && DICTIONARIES[lang][ns]);

function loadOne(lang, ns) {
  if (isLoaded(lang, ns)) return Promise.resolve();
  const key = `${lang}/${ns}`;
  if (!pending.has(key)) {
    const loader = LOADERS[`./${key}.js`];
    const p = (loader ? loader() : Promise.resolve({ default: {} }))
      .then((m) => { DICTIONARIES[lang][ns] = m.default || {}; })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return pending.get(key);
}

// Loads the namespaces for `lang` and English (the fallback for missing text).
export function loadNamespaces(lang, namespaces) {
  const langs = lang === 'en' ? ['en'] : ['en', lang];
  return Promise.all(langs.flatMap((l) => namespaces.map((ns) => loadOne(l, ns))));
}

// Tests and tools: every dictionary at once.
export const loadAll = () => Promise.all(LANGUAGES.flatMap((l) => [...PUBLIC_NAMESPACES, ...PANEL_NAMESPACES].map((ns) => loadOne(l, ns))));
