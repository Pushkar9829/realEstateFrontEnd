// Module M - buyer accounts and privacy (RE-S-ADM-22), permission users.manage.
// Built: GET /api/admin/deletion-requests, GET /api/admin/users/:id/consents
// (backend/src/modules/auth/routes/admin.routes.js).
// Spec only (not in the backend yet): GET /api/admin/users, GET /api/admin/users/:id,
// PATCH /api/admin/users/:id/status, POST /api/admin/users/:id/anonymise.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const CONSENT_PURPOSES = {
  sales_contact: 'Sales contact', whatsapp_updates: 'WhatsApp updates', marketing_alerts: 'Marketing alerts',
  partner_sharing: 'Partner sharing', call_recording: 'Call recording', analytics: 'Analytics',
};
export const DELETION_STATUS = {
  requested: { label: 'Requested', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
};

export const useBuyers = (params) => useQuery({ queryKey: ['admin', 'buyers', params], queryFn: () => api.page('/admin/users', { role: 'buyer', ...params }), retry: false, placeholderData: (prev) => prev });
export const useBuyer = (id) => useQuery({ queryKey: ['admin', 'buyer', id], queryFn: () => api.get(`/admin/users/${id}`), enabled: Boolean(id), retry: false });
export const useUserConsents = (id) => useQuery({ queryKey: ['admin', 'consents', id], queryFn: () => api.get(`/admin/users/${id}/consents`), enabled: Boolean(id) });
export const useDeletionRequests = (params) => useQuery({ queryKey: ['admin', 'deletion-requests', params], queryFn: () => api.page('/admin/deletion-requests', params), placeholderData: (prev) => prev });

function useBuyerMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'buyers'] }); qc.invalidateQueries({ queryKey: ['admin', 'buyer'] }); qc.invalidateQueries({ queryKey: ['admin', 'deletion-requests'] }); } });
}
// { status: active | blocked, reason? }
export const useSetBuyerStatus = () => useBuyerMutation(({ id, body }) => api.patch(`/admin/users/${id}/status`, body));
export const useAnonymiseBuyer = () => useBuyerMutation((id) => api.post(`/admin/users/${id}/anonymise`));

// 404 / 501 from a spec endpoint that the backend has not built yet.
export const isMissingEndpoint = (e) => Boolean(e && (e.code === 'ROUTE_NOT_FOUND' || e.code === 'NOT_IMPLEMENTED' || e.status === 501));
