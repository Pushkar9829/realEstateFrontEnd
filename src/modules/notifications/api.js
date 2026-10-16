// Module K - in-app notification centre (any signed-in user).
// Endpoints: backend/src/modules/notifications/routes/public.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const NOTIFICATION_CATEGORIES = [
  { value: 'account', label: 'Account' }, { value: 'listings', label: 'Listings' }, { value: 'leads', label: 'Leads' },
  { value: 'visits', label: 'Visits' }, { value: 'offers', label: 'Offers' }, { value: 'deals', label: 'Deals' },
  { value: 'finance', label: 'Invoices' }, { value: 'invoices', label: 'Invoices' }, { value: 'alerts', label: 'Alerts' }, { value: 'marketing', label: 'Offers and news' },
  { value: 'security', label: 'Security' }, { value: 'system', label: 'System' },
];
// Category filter options without the duplicate "Invoices" label.
export const NOTIFICATION_FILTERS = NOTIFICATION_CATEGORIES.filter((c) => c.value !== 'invoices');
export const notificationCategoryLabel = (c) => (NOTIFICATION_CATEGORIES.find((x) => x.value === c) || { label: c }).label;

// Channels a user can switch per category (GET/PATCH /me/notification-preferences).
export const NOTIFICATION_CHANNELS = [
  { value: 'in_app', label: 'In-app' }, { value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' },
];

export const notificationKeys = { list: (p) => ['me', 'notifications', p], unread: ['me', 'notifications', 'unread-count'], prefs: ['me', 'notification-preferences'] };

// params: { page, limit, unread: 'true' } -> { items, meta }
export const useNotifications = (params = {}) => useQuery({ queryKey: notificationKeys.list(params), queryFn: () => api.page('/me/notifications', params) });
export const useUnreadCount = ({ poll = false } = {}) => useQuery({
  queryKey: notificationKeys.unread, queryFn: () => api.get('/me/notifications/unread-count').then((d) => d.count), staleTime: 30_000,
  ...(poll ? { refetchInterval: 60_000, refetchIntervalInBackground: false } : {}),
});

function useNotificationMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notifications'] }) });
}
export const useMarkRead = () => useNotificationMutation((id) => api.patch(`/me/notifications/${id}/read`));
export const useMarkAllRead = () => useNotificationMutation(() => api.post('/me/notifications/read-all'));

// { categories: string[], prefs: { [category]: { email?, sms?, in_app?, whatsapp? } } }
export const useNotificationPrefs = () => useQuery({ queryKey: notificationKeys.prefs, queryFn: () => api.get('/me/notification-preferences') });
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => api.patch('/me/notification-preferences', body), onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.prefs }) });
}
