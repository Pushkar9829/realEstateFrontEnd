// Module L - platform settings (RE-S-ADM-27, spec section 7).
// Spec: GET /api/admin/settings; PATCH /api/admin/settings (partial, each change
// audited). The backend keeps defaults in constants/settings.defaults.js
// ({ value, edit, description } per key) and overrides in core/settings.js.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

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

// Group labels for key prefixes (first segment of the key).
export const SETTING_GROUPS = {
  general: 'General', company: 'General', public: 'Masking and public display', commission: 'Commission', listing: 'Listings', lister: 'Listings',
  media: 'Listings', kyc: 'Verification', verification: 'Verification', broker: 'Trust', guard: 'Trust', seeker: 'Trust', trust: 'Trust',
  rera: 'RERA', lead: 'Leads and SLA', sla: 'Leads and SLA', routing: 'Routing', visit: 'Visits', visits: 'Visits', offer: 'Offers', offers: 'Offers',
  search: 'Search and tools', tools: 'Search and tools', invoice: 'Invoices', deal: 'Deals', notifications: 'Notifications', whatsapp: 'WhatsApp and telephony',
  telephony: 'WhatsApp and telephony', partners: 'Partners', privacy: 'Privacy', retention: 'Privacy', audit: 'Privacy', mlm: 'MLM', home: 'Home page',
  calendar: 'Leads and SLA', agent: 'Leads and SLA', review: 'Listings', buyer: 'Leads and SLA', alerts: 'Search and tools', notify: 'Notifications',
  stats: 'Masking and public display', reports: 'Reports', trends: 'Search and tools', calc: 'Search and tools', nlsearch: 'Search and tools',
  agreement: 'Commission', consent: 'Privacy', analytics: 'Privacy', auth: 'Sign-in and security', i18n: 'General', projects: 'Listings',
};
export const groupOf = (key) => SETTING_GROUPS[String(key).split('.')[0]] || 'Other';
