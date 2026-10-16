// Funnel analytics (RE-L-11). track(event, params) sends a GA4 event only when
// the visitor has chosen "Accept analytics" and the GA4 script is loaded (the
// cookie banner injects it after consent; panels never load it). Parameters
// are filtered to an allow-list of non-personal fields, and any value that
// looks like an email or phone number is dropped, so names, phones, emails,
// exact addresses and lead numbers never reach Google.
//
// Events: search, property_view, enquiry_open, enquiry_submit, visit_booked,
// calculator_used, shortlist_add, whatsapp_click.
import { readConsent } from '@/shared/components/CookieBanner';

export const EVENTS = ['search', 'property_view', 'project_view', 'enquiry_open', 'enquiry_submit', 'visit_booked', 'calculator_used', 'shortlist_add', 'whatsapp_click'];

// Non-personal parameters only (snake_case as GA4 expects).
const ALLOWED = {
  listingNo: 'listing_no', projectSlug: 'project_slug', purpose: 'purpose', city: 'city', locality: 'locality',
  category: 'category', propertyType: 'property_type', type: 'enquiry_type', bhk: 'bhk', budget: 'budget_band',
  filters: 'filters', sort: 'sort', results: 'results', view: 'view', radiusKm: 'radius_km', calculator: 'calculator',
  source: 'source', lang: 'language', page: 'page_number',
};

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s-]{8,}\d)/;

export function sanitize(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    const name = ALLOWED[k];
    if (!name || v === undefined || v === null || v === '') return;
    if (typeof v === 'number') { if (Number.isFinite(v)) out[name] = v; return; }
    if (typeof v === 'boolean') { out[name] = v; return; }
    const s = String(v).slice(0, 100);
    if (EMAIL.test(s) || PHONE.test(s.replace(/[(),]/g, ''))) return;
    out[name] = s;
  });
  return out;
}

// Short "key:value" summary of search filters, e.g. "purpose:sale|bhk:2,3|budget:yes".
// Free text (keyword) is reduced to a flag, never sent as typed.
export function filtersSummary(f) {
  const parts = [];
  Object.entries(f || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    if (['keyword', 'q', 'lat', 'lng', 'bbox', 'page', 'sort', 'limit'].includes(k)) { if (k === 'keyword' || k === 'q') parts.push('keyword:yes'); return; }
    if (/min|max|budget|price|rent|area/i.test(k)) { parts.push(`${k}:yes`); return; }
    parts.push(`${k}:${Array.isArray(v) ? v.join(',') : String(v)}`);
  });
  return parts.join('|').slice(0, 100);
}

export const analyticsAllowed = () => readConsent() === 'analytics' && typeof window !== 'undefined' && typeof window.gtag === 'function';

export function track(event, params) {
  try {
    if (!analyticsAllowed()) return false;
    window.gtag('event', event, sanitize(params));
    return true;
  } catch { return false; } // a blocked or failed script never breaks the page
}
