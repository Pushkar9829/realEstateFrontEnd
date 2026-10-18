// Module L - platform settings (RE-S-ADM-27, spec section 7).
// Spec: GET /api/admin/settings; PATCH /api/admin/settings (partial, each change
// audited). The backend keeps defaults in constants/settings.defaults.js
// ({ value, edit, description } per key) and overrides in core/settings.js.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Accepts either [{ key, value, default, edit, description }] or { key: value }
// (or { key: { value, edit, description } }) and returns the list form.
export function normaliseSettings(data) {
  if (!data) return [];
  const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : null;
  if (list) return list.map((s) => ({ ...s, value: s.value !== undefined ? s.value : s.default }));
  return Object.entries(data).map(([key, v]) => (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? { key, ...v } : { key, value: v }));
}

export const useSettings = () => useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get('/admin/settings').then(normaliseSettings), retry: false });

// changes: { [key]: value }. Sent as a list because the API's request sanitizer
// drops object keys that contain dots ("invoice.dueDays").
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (changes) => api.patch('/admin/settings', { changes: Object.entries(changes).map(([key, value]) => ({ key, value })) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }) });
}

// Group of each key prefix (first segment of the key): a stable id used for
// grouping and anchors; groupLabel() gives the translated name for display.
const GROUP_IDS = {
  general: 'general', company: 'general', public: 'masking', commission: 'commission', listing: 'listings', lister: 'listings',
  media: 'listings', kyc: 'verification', verification: 'verification', broker: 'trust', guard: 'trust', seeker: 'trust', trust: 'trust',
  rera: 'rera', lead: 'leads', sla: 'leads', routing: 'routing', visit: 'visits', visits: 'visits', offer: 'offers', offers: 'offers',
  search: 'search', tools: 'search', invoice: 'invoices', deal: 'deals', notifications: 'notifications', whatsapp: 'telephony',
  telephony: 'telephony', partners: 'partners', privacy: 'privacy', retention: 'privacy', audit: 'privacy', mlm: 'mlm', home: 'home',
  calendar: 'leads', agent: 'leads', review: 'listings', buyer: 'leads', alerts: 'search', notify: 'notifications',
  stats: 'masking', reports: 'reports', trends: 'search', calc: 'search', nlsearch: 'search',
  agreement: 'commission', consent: 'privacy', analytics: 'privacy', auth: 'auth', i18n: 'general', projects: 'listings',
};
export const groupIdOf = (key) => GROUP_IDS[String(key).split('.')[0]] || 'other';
// Translated group name (read at call time, so it follows the current language).
export const groupLabel = (id) => t(`admin.settings.groups.${id}`);
// Prefix -> translated group name (same shape as before; values are getters).
export const SETTING_GROUPS = Object.defineProperties({}, Object.fromEntries(Object.entries(GROUP_IDS)
  .map(([prefix, id]) => [prefix, { enumerable: true, get: () => groupLabel(id) }])));
export const groupOf = (key) => groupLabel(groupIdOf(key));
