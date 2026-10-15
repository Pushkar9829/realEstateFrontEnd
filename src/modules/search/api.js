// Module E - Search & Discovery (plus the public sides of A, B and G): API
// calls and query hooks for the public portal.
// Endpoints: backend/src/modules/search/routes/public.routes.js,
// masking/routes/public.routes.js, projects/routes/public.routes.js and the
// token pages in listings/routes/public.routes.js.
// Query-string prices are rupees; prices read back are paise.
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '@/shared/lib/api';

// ---------------------------------------------------------------- filters <-> URL

// Every search filter the API understands (search/service.js filterSchema).
export const FILTER_KEYS = ['purpose', 'city', 'localities', 'category', 'types', 'bhk', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'furnishing', 'possession', 'amenities', 'postedBy', 'verified', 'q'];

export const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'ppsf_asc', label: 'Price per sq ft: low to high' },
  { value: 'area_desc', label: 'Area: largest first' },
];

export const BHK_OPTIONS = ['1', '2', '3', '4+'];
export const FURNISHING = { unfurnished: 'Unfurnished', semi: 'Semi-furnished', full: 'Fully furnished' };
export const POSSESSION = { ready: 'Ready to move', under_construction: 'Under construction' };
export const POSTED_BY = { owner: 'Owner', builder: 'Builder', landlord: 'Landlord' };
export const CATEGORIES = { residential: 'Residential', commercial: 'Commercial', land: 'Plots and land' };

export const BUDGETS = {
  sale: [500000, 2500000, 5000000, 7500000, 10000000, 15000000, 20000000, 30000000, 50000000, 100000000],
  rent: [5000, 10000, 15000, 20000, 30000, 40000, 60000, 100000, 200000],
};

// Old home links used `type=` and a free-text `q` for the city; keep them working.
export function filtersFromParams(sp) {
  const f = {};
  FILTER_KEYS.forEach((k) => { const v = sp.get(k); if (v !== null && v !== '') f[k] = v; });
  if (!f.types && sp.get('type')) f.types = sp.get('type');
  // Friendly URLs (?purpose=buy) map to the API purpose; anything unknown falls back to sale.
  if (f.purpose) f.purpose = { buy: 'sale', sale: 'sale', rent: 'rent' }[String(f.purpose).toLowerCase()] || 'sale';
  return f;
}

export function cleanFilters(f) {
  return Object.fromEntries(Object.entries(f || {}).filter(([k, v]) => FILTER_KEYS.includes(k) && v !== undefined && v !== null && v !== '' && v !== false));
}

export const csvList = (v) => (v ? String(v).split(',').filter(Boolean) : []);
export const toggleCsv = (v, item) => { const s = new Set(csvList(v)); if (s.has(item)) s.delete(item); else s.add(item); return [...s].join(','); };

// Human summary for chips and saved searches.
export function describeFilters(f = {}) {
  const out = [];
  if (f.purpose) out.push(f.purpose === 'rent' ? 'Rent' : 'Buy');
  if (f.city) out.push(f.city);
  if (f.localities) out.push(`${csvList(f.localities).length} localit${csvList(f.localities).length > 1 ? 'ies' : 'y'}`);
  if (f.category) out.push(CATEGORIES[f.category] || f.category);
  if (f.types) out.push(csvList(f.types).map((t) => t.replace(/_/g, ' ')).join(', '));
  if (f.bhk) out.push(`${f.bhk} BHK`);
  if (f.minPrice || f.maxPrice) out.push(`${f.minPrice ? `from ₹${Number(f.minPrice).toLocaleString('en-IN')}` : ''}${f.minPrice && f.maxPrice ? ' ' : ''}${f.maxPrice ? `up to ₹${Number(f.maxPrice).toLocaleString('en-IN')}` : ''}`);
  if (f.furnishing) out.push(csvList(f.furnishing).map((x) => FURNISHING[x] || x).join(', '));
  if (f.possession) out.push(POSSESSION[f.possession] || f.possession);
  if (f.postedBy) out.push(`By ${POSTED_BY[f.postedBy] || f.postedBy}`);
  if (f.verified) out.push('Verified only');
  if (f.q) out.push(`"${f.q}"`);
  return out;
}

// ---------------------------------------------------------------- settings and lookups

export const PUBLIC_DEFAULTS = {
  // Fallbacks while GET /settings/public loads (it returns calc, visit and features).
  calc: { interestRate: 8.5, tenureYears: 20, loanPercent: 80, foirPercent: 50, downPaymentPercent: 20 },
  visit: { dayStart: '08:00', dayEnd: '20:00', minLeadHours: 2 },
};

export const usePublicSettings = () => useQuery({ queryKey: ['settings', 'public'], queryFn: () => api.get('/settings/public'), staleTime: 600_000 });
export const useHome = () => useQuery({ queryKey: ['public', 'home'], queryFn: () => api.get('/home'), staleTime: 60_000 });

export function useAutocomplete(q, city) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  const term = String(debounced || '').trim();
  return useQuery({
    queryKey: ['public', 'autocomplete', term, city || ''],
    queryFn: () => api.get('/properties/autocomplete', { q: term, ...(city ? { city } : {}) }),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}

export const parseSentence = (q, city) => api.get('/search/parse', { q, ...(city ? { city } : {}) });

// ---------------------------------------------------------------- search, map, near

export const useSearch = (params) => useQuery({
  queryKey: ['public', 'search', params],
  queryFn: () => api.page('/properties', params),
  placeholderData: keepPreviousData,
});

// bbox: { swLat, swLng, neLat, neLng } -> { total, pins, clusters }
export const useMapSearch = (filters, bbox) => useQuery({
  queryKey: ['public', 'map', filters, bbox],
  queryFn: () => api.get('/properties/map', { ...filters, ...bbox }),
  enabled: Boolean(bbox),
  placeholderData: keepPreviousData,
});

export const useNear = (filters, point, enabled = true) => useQuery({
  queryKey: ['public', 'near', filters, point],
  queryFn: () => api.get('/properties/near', { ...filters, lat: point.lat, lng: point.lng, radiusKm: point.radiusKm, limit: 50 }),
  enabled: Boolean(enabled && point),
});

// ---------------------------------------------------------------- property detail

export const propertyKeys = { one: (slug) => ['public', 'property', slug], similar: (id) => ['public', 'similar', id] };
// 404: never existed. 410 LISTING_UNAVAILABLE: sold / rented / expired / paused; error.details =
// { title, listingNo, purpose, city, locality, status: sold | rented | unavailable, temporary, similar: [cards] }.
export const useProperty = (slug) => useQuery({ queryKey: propertyKeys.one(slug), queryFn: () => api.get(`/properties/${encodeURIComponent(slug)}`), enabled: Boolean(slug), retry: (n, e) => ![404, 410].includes(e.status) && n < 2 });
export const useSimilar = (id) => useQuery({ queryKey: propertyKeys.similar(id), queryFn: () => api.get(`/properties/${id}/similar`), enabled: Boolean(id), retry: false });

// One id per browser tab session so the API can de-duplicate views for 24 h.
function viewSession() {
  try {
    let id = sessionStorage.getItem('pd.viewSession');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('pd.viewSession', id); }
    return id;
  } catch { return undefined; }
}
export const recordView = (id) => http.post(`/properties/${id}/view`, {}, { headers: viewSession() ? { 'X-Session-Id': viewSession() } : {} }).catch(() => {});

// Returns { url } (wa.me link) or { url: null } when WhatsApp is not configured.
export const whatsappClick = (id) => api.post(`/properties/${id}/whatsapp-click`);

export const REPORT_REASONS = [
  { value: 'broker', label: 'Lister is a broker' },
  { value: 'wrong_info', label: 'Wrong information' },
  { value: 'already_sold', label: 'Already sold or rented' },
  { value: 'fraud', label: 'Fraud or scam' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'other', label: 'Something else' },
];
export const useReportListing = (id) => useMutation({ mutationFn: (body) => api.post(`/properties/${id}/report`, body) });

// ---------------------------------------------------------------- compare (ids kept in localStorage, max 4)

const COMPARE_KEY = 'pd.compare';
const readCompare = () => { try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]').slice(0, 4); } catch { return []; } };
const writeCompare = (ids) => {
  try { localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, 4))); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('pd-compare'));
};
export const COMPARE_MAX = 4;

export function useCompareIds() {
  const [ids, setIds] = useState(readCompare);
  useEffect(() => {
    const sync = () => setIds(readCompare());
    window.addEventListener('pd-compare', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('pd-compare', sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = (id) => {
    const cur = readCompare();
    if (cur.includes(id)) { writeCompare(cur.filter((x) => x !== id)); return true; }
    if (cur.length >= COMPARE_MAX) return false;
    writeCompare([...cur, id]);
    return true;
  };
  const remove = (id) => writeCompare(readCompare().filter((x) => x !== id));
  const clear = () => writeCompare([]);
  return { ids, toggle, remove, clear, has: (id) => ids.includes(id) };
}

export const useCompare = (ids) => useQuery({ queryKey: ['public', 'compare', ids], queryFn: () => api.get('/compare', { ids: ids.join(',') }), enabled: ids.length > 0 });

// ---------------------------------------------------------------- landing pages and trends

const seg = (s) => encodeURIComponent(String(s));

export const useCitySummary = (city) => useQuery({ queryKey: ['public', 'city', city], queryFn: () => api.get(`/locations/${seg(city)}/summary`), enabled: Boolean(city), retry: (n, e) => e.status !== 404 && n < 2 });
export const useLocalitySummary = (city, locality) => useQuery({ queryKey: ['public', 'locality', city, locality], queryFn: () => api.get(`/locations/${seg(city)}/${seg(locality)}/summary`), enabled: Boolean(city && locality), retry: (n, e) => e.status !== 404 && n < 2 });
export const useLocalitiesIndex = (city) => useQuery({ queryKey: ['public', 'localities-index', city], queryFn: () => api.get(`/locations/${seg(city)}/localities/trends`), enabled: Boolean(city), retry: (n, e) => e.status !== 404 && n < 2 });
export const useTrends = (city, locality) => useQuery({ queryKey: ['public', 'trends', city, locality], queryFn: () => api.get(`/locations/${seg(city)}/${seg(locality)}/trends`), enabled: Boolean(city && locality) });

// ---------------------------------------------------------------- projects (module G public)

export const useProjectSearch = (params) => useQuery({ queryKey: ['public', 'projects', params], queryFn: () => api.page('/projects', params), placeholderData: keepPreviousData });
export const usePublicProject = (slug) => useQuery({ queryKey: ['public', 'project', slug], queryFn: () => api.get(`/projects/${encodeURIComponent(slug)}`), enabled: Boolean(slug), retry: (n, e) => e.status !== 404 && n < 2 });

export const CONFIG_AVAILABILITY = { available: { label: 'Available', tone: 'success' }, few_left: { label: 'Few left', tone: 'warning' }, sold_out: { label: 'Sold out', tone: 'neutral' } };

// ---------------------------------------------------------------- shortlist (buyer, lister)

export const shortlistKey = ['me', 'shortlist'];
export const useShortlist = (enabled = true) => useQuery({ queryKey: shortlistKey, queryFn: () => api.get('/me/shortlist'), enabled, staleTime: 30_000 });

export function useToggleShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }) => (saved ? api.del(`/me/shortlist/${id}`) : api.post('/me/shortlist', { propertyId: id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: shortlistKey }),
  });
}

// ---------------------------------------------------------------- saved searches (buyer, lister)

export const FREQUENCIES = [
  { value: 'instant', label: 'Instant' }, { value: 'daily', label: 'Daily digest' }, { value: 'weekly', label: 'Weekly digest' }, { value: 'off', label: 'Off' },
];
export const savedKey = ['me', 'saved-searches'];
export const useSavedSearches = () => useQuery({ queryKey: savedKey, queryFn: () => api.get('/me/saved-searches') });

function useSavedMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: savedKey }) });
}
export const useCreateSavedSearch = () => useSavedMutation((body) => api.post('/me/saved-searches', body));
export const useEditSavedSearch = () => useSavedMutation(({ id, body }) => api.patch(`/me/saved-searches/${id}`, body));
export const useDeleteSavedSearch = () => useSavedMutation((id) => api.del(`/me/saved-searches/${id}`));

export const useUnsubscribe = (token) => useQuery({ queryKey: ['public', 'unsubscribe', token], queryFn: () => api.get(`/alerts/unsubscribe/${token}`), enabled: Boolean(token), retry: false, staleTime: Infinity });

// ---------------------------------------------------------------- token pages for listers (module A public)

// "Still available?" check (RE-A-17): GET summary, POST { answer, saleDate?, price?, reason? }.
export const useListingCheck = (token) => useQuery({ queryKey: ['public', 'listing-check', token], queryFn: () => api.get(`/listing-checks/${token}`), enabled: Boolean(token), retry: false });
export function useAnswerListingCheck(token) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => api.post(`/listing-checks/${token}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['public', 'listing-check', token] }) });
}

// Photo verification capture (RE-A-20).
export const useCaptureSession = (token) => useQuery({ queryKey: ['public', 'verify-photos', token], queryFn: () => api.get(`/verify-photos/${token}`), enabled: Boolean(token), retry: false });
export const sendCaptureLocation = (token, gps) => api.post(`/verify-photos/${token}/location`, gps);
export async function uploadCapturePhoto(token, file, { lat, lng, accuracy, capturedAt }, onProgress) {
  const form = new FormData();
  form.append('lat', String(lat));
  form.append('lng', String(lng));
  form.append('accuracy', String(accuracy));
  form.append('capturedAt', capturedAt);
  form.append('file', file);
  const res = await http.post(`/verify-photos/${token}/photos`, form, {
    timeout: 120000,
    onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
  });
  return res.data.data;
}
export const submitCapture = (token, body) => api.post(`/verify-photos/${token}/submit`, body);
