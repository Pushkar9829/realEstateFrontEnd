// How each platform setting is edited on the admin Settings screen (audit D3):
// a readable label first (the key only as a hint), the input type, unit and
// allowed values. Keys without an entry fall back to their value's type and
// to units guessed from the key name.

import { t } from '@/shared/i18n';

// Option lists as [value, label] pairs; labels are translated when read.
const opts = (prefix, values) => values.map((v) => [v, t(`admin.settings.options.${prefix}.${v.replace(/\./g, '_')}`)]);

// Fixed choices (string settings) - same values the API accepts.
// Each entry is a getter so the labels follow the current language.
export const ENUMS = {
  get 'public.locationPrecision'() { return opts('locationPrecision', ['approx', 'exact']); },
  get 'routing.mode'() { return opts('routingMode', ['round_robin', 'least_open_leads']); },
  get 'seeker.autoAction'() { return opts('seekerAutoAction', ['flag_only', 'throttle', 'block']); },
};

// Lists picked from known options, kept in the chosen order.
export const LIST_OPTIONS = {
  get 'home.sections'() { return opts('homeSections', ['search', 'featured_properties', 'projects', 'localities', 'how_it_works', 'testimonials', 'faqs', 'banners']); },
  get 'i18n.languages'() { return opts('languages', ['en', 'hi']); },
  get 'auth.otpChannels'() { return opts('otpChannels', ['email', 'sms']); },
  get 'mlm.events'() { return opts('mlmEvents', ['deal.closed', 'deal.reversed', 'user.signup']); },
};

// Lists of objects edited as JSON even when empty.
export const JSON_KEYS = new Set(['rera.agentRegistrations']);

// Lists where the order matters (shown with move up / down).
export const ORDERED = new Set(['home.sections']);

// Unit shown after a number field, guessed from the key. Word units are
// translation ids (admin.settings.units.*); '%' and '₹' are shown as is.
const UNITS = [
  [/percent|Percent/, '%'],
  [/[Pp]aise|Amount|Fee$|Rupees/, '₹'],
  [/Minutes$|minutes/, 'minutes'],
  [/Hours$|hours/i, 'hours'],
  [/Days$|days|Offsets$/i, 'days'],
  [/Months$/, 'months'],
  [/Meters$/, 'metres'],
  [/Seconds$/, 'seconds'],
];
const unitText = (u) => (u === '%' || u === '₹' ? u : t(`admin.settings.units.${u}`));
export function unitOf(key, description = '') {
  if (/\b(INR|rupees)\b/i.test(description)) return '₹';
  const last = String(key).split('.').slice(1).join('.') || key;
  const hit = UNITS.find(([re]) => re.test(last));
  return hit ? unitText(hit[1]) : '';
}

// "commission.minPercent.sale" -> "Min percent sale" (fallback when there is no description).
export function humanKey(key) {
  const words = String(key).split('.').slice(1).join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

export function labelOf(s) {
  const d = String(s.description || '').trim();
  return d ? d[0].toUpperCase() + d.slice(1) : humanKey(s.key);
}

export function kindOf(s) {
  const v = s.value;
  if (JSON_KEYS.has(s.key)) return 'json';
  if (ENUMS[s.key]) return 'enum';
  if (LIST_OPTIONS[s.key]) return 'pick';
  if (Array.isArray(v)) return v.length && v.every((x) => x && typeof x === 'object') ? 'json' : 'list';
  if (v === null) return 'text';
  if (typeof v === 'object') return 'json';
  return typeof v; // boolean | number | string
}
