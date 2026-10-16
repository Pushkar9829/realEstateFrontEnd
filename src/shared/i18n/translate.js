// t(key, vars) lookup: nested keys ("home.hero.title"), {name} placeholders and
// plural forms (`key_one` / `key_other`, chosen with Intl.PluralRules when
// `vars.count` is a number). Missing Hindi text falls back to English, and a
// missing key returns the key itself so it is easy to spot.
import { DICTIONARIES } from './locales';

const plural = {};
const pluralRule = (lang) => {
  if (!plural[lang]) { try { plural[lang] = new Intl.PluralRules(lang); } catch { plural[lang] = { select: (n) => (n === 1 ? 'one' : 'other') }; } }
  return plural[lang];
};

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function pick(lang, key, vars) {
  const dict = DICTIONARIES[lang];
  if (!dict) return undefined;
  if (vars && typeof vars.count === 'number') {
    const form = lookup(dict, `${key}_${pluralRule(lang).select(vars.count)}`) ?? lookup(dict, `${key}_other`);
    if (typeof form === 'string') return form;
  }
  const v = lookup(dict, key);
  return typeof v === 'string' || Array.isArray(v) ? v : undefined;
}

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k]))) : s);

export function translate(lang, key, vars) {
  const v = pick(lang, key, vars) ?? pick('en', key, vars);
  if (v === undefined) return key;
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? fill(x, vars) : x)) : fill(v, vars);
}

export const hasKey = (lang, key) => pick(lang, key) !== undefined;
