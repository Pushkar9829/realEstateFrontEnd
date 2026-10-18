// How each platform setting is edited on the admin Settings screen (audit D3):
// a readable label first (the key only as a hint), the input type, unit and
// allowed values. Keys without an entry fall back to their value's type and
// to units guessed from the key name.

// Fixed choices (string settings) - same values the API accepts.
export const ENUMS = {
  'public.locationPrecision': [['approx', 'Approximate (pin moved 300-500 m)'], ['exact', 'Exact pin']],
  'routing.mode': [['round_robin', 'Round robin (take turns)'], ['least_open_leads', 'Fewest open leads first']],
  'seeker.autoAction': [['flag_only', 'Flag only (no action)'], ['throttle', 'Throttle new enquiries'], ['block', 'Block the phone number']],
};

// Lists picked from known options, kept in the chosen order.
export const LIST_OPTIONS = {
  'home.sections': [['search', 'Search box'], ['featured_properties', 'Featured properties'], ['projects', 'New projects'], ['localities', 'Popular localities'], ['how_it_works', 'How it works'], ['testimonials', 'Testimonials'], ['faqs', 'FAQs'], ['banners', 'Banners']],
  'i18n.languages': [['en', 'English'], ['hi', 'Hindi']],
  'auth.otpChannels': [['email', 'Email'], ['sms', 'SMS (+91 numbers only)']],
  'mlm.events': [['deal.closed', 'Deal closed'], ['deal.reversed', 'Deal reversed'], ['user.signup', 'User signed up']],
};

// Lists of objects edited as JSON even when empty.
export const JSON_KEYS = new Set(['rera.agentRegistrations']);

// Lists where the order matters (shown with move up / down).
export const ORDERED = new Set(['home.sections']);

// Unit shown after a number field, guessed from the key.
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
export function unitOf(key, description = '') {
  if (/\b(INR|rupees)\b/i.test(description)) return '₹';
  const last = String(key).split('.').slice(1).join('.') || key;
  const hit = UNITS.find(([re]) => re.test(last));
  return hit ? hit[1] : '';
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
