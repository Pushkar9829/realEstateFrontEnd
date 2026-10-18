// Module K - in-app notification centre (any signed-in user).
// Endpoints: backend/src/modules/notifications/routes/public.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// `label` is a getter, so lists keep their shape and follow the chosen language.
const labelled = (prefix, values) => values.map((value) => ({ value, get label() { return t(`${prefix}.${value}`); } }));

export const NOTIFICATION_CATEGORIES = labelled('common.notify.cat', ['account', 'listings', 'leads', 'visits', 'offers', 'deals', 'finance', 'invoices', 'alerts', 'marketing', 'security', 'system']);
// Category filter options without the duplicate "Invoices" label.
export const NOTIFICATION_FILTERS = NOTIFICATION_CATEGORIES.filter((c) => c.value !== 'invoices');
export const notificationCategoryLabel = (c) => (NOTIFICATION_CATEGORIES.find((x) => x.value === c) || { label: c }).label;

// Channels a user can switch per category (GET/PATCH /me/notification-preferences).
export const NOTIFICATION_CHANNELS = labelled('common.notify.channel', ['in_app', 'email', 'sms', 'whatsapp']);

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
