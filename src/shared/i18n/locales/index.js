// Dictionaries by language, one file per namespace (each file holds en + hi).
// t('common.login') reads DICTIONARIES[lang].common.login.
import common from './common';
import auth from './auth';
import home from './home';
import search from './search';
import property from './property';
import account from './account';
import marketing from './marketing';
import discover from './discover';
import detail from './detail';
import pages from './pages';

const NAMESPACES = { common, auth, home, search, property, account, marketing, discover, detail, pages };

const build = (lang) => Object.fromEntries(Object.entries(NAMESPACES).map(([ns, d]) => [ns, d[lang] || {}]));

export const DICTIONARIES = { en: build('en'), hi: build('hi') };
