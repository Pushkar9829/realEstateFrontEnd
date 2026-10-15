// Module K - in-app notification centre (any signed-in user).
// Endpoints: backend/src/modules/notifications/routes/public.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const NOTIFICATION_CATEGORIES = [
  { value: 'account', label: 'Account' }, { value: 'listings', label: 'Listings' }, { value: 'leads', label: 'Leads' },
  { value: 'visits', label: 'Visits' }, { value: 'offers', label: 'Offers' }, { value: 'deals', label: 'Deals' },
  { value: 'finance', label: 'Invoices' }, { value: 'alerts', label: 'Alerts' }, { value: 'security', label: 'Security' }, { value: 'system', label: 'System' },
];

export const notificationKeys = { list: (p) => ['me', 'notifications', p], unread: ['me', 'notifications', 'unread-count'] };

// params: { page, limit, unread: 'true' } -> { items, meta }
export const useNotifications = (params = {}) => useQuery({ queryKey: notificationKeys.list(params), queryFn: () => api.page('/me/notifications', params) });
export const useUnreadCount = () => useQuery({ queryKey: notificationKeys.unread, queryFn: () => api.get('/me/notifications/unread-count').then((d) => d.count), staleTime: 30_000 });

function useNotificationMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notifications'] }) });
}
export const useMarkRead = () => useNotificationMutation((id) => api.patch(`/me/notifications/${id}/read`));
export const useMarkAllRead = () => useNotificationMutation(() => api.post('/me/notifications/read-all'));
