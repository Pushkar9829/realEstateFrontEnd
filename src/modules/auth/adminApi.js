// Module M - buyer accounts and privacy (RE-S-ADM-22), permission users.manage:
// GET /api/admin/users(/:id), PATCH /api/admin/users/:id/status,
// POST /api/admin/users/:id/anonymise, GET /api/admin/users/:id/consents,
// GET/PATCH /api/admin/deletion-requests(/:id)
// (backend/src/modules/auth/routes/admin.routes.js).
// Staff users (RE-S-ADM-16), permission staff.manage: /api/admin/staff
// (backend/src/modules/teams/routes/admin.routes.js).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));
const labels = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));
const options = (prefix, values) => values.map((value) => ({ value, get label() { return t(`${prefix}.${value}`); } }));

export const CONSENT_PURPOSES = labels('admin.enum.consentPurpose', ['sales_contact', 'whatsapp_updates', 'marketing_alerts', 'partner_sharing', 'call_recording', 'analytics']);
export const DELETION_STATUS = toned('admin.enum.deletionStatus', {
  requested: 'warning',
  in_progress: 'info',
  completed: 'success',
  rejected: 'neutral',
});

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
// { id, reason (5-500) }
export const useAnonymiseBuyer = () => useBuyerMutation(({ id, reason }) => api.post(`/admin/users/${id}/anonymise`, { reason }));
// { status: in_progress | completed | rejected, note (5-1000) }; completed anonymises the buyer.
export const useDecideDeletion = () => useBuyerMutation(({ id, body }) => api.patch(`/admin/deletion-requests/${id}`, body));

// ---------------------------------------------------------------- staff users (RE-S-ADM-16)

export const STAFF_ROLES = options('admin.enum.staffRole', ['agent', 'manager', 'admin']);
export const staffKeys = { list: (p) => ['admin', 'staff-users', p] };

// params: { page, limit, q, role, status }
export const useStaffUsers = (params) => useQuery({ queryKey: staffKeys.list(params), queryFn: () => api.page('/admin/staff', params), placeholderData: (prev) => prev });

function useStaffMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff-users'] }); qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); } });
}
// { role, name, email, phone, teamId?, permissions[] } -> a temporary password is emailed
export const useCreateStaff = () => useStaffMutation((body) => api.post('/admin/staff', body));
// { name?, role?, teamId?, permissions? }
export const useEditStaff = () => useStaffMutation(({ id, body }) => api.patch(`/admin/staff/${id}`, body));
// { reason, reassignTo? } -> { disabled, leadsMoved }
export const useDisableStaff = () => useStaffMutation(({ id, body }) => api.post(`/admin/staff/${id}/disable`, body));
export const useEnableStaff = () => useStaffMutation((id) => api.post(`/admin/staff/${id}/enable`));
export const useResetStaff2fa = () => useStaffMutation((id) => api.post(`/admin/staff/${id}/reset-2fa`));
export const useForceLogoutStaff = () => useStaffMutation((id) => api.post(`/admin/staff/${id}/force-logout`));

// 404 / 501 from a spec endpoint that the backend has not built yet.
export const isMissingEndpoint = (e) => Boolean(e && (e.code === 'ROUTE_NOT_FOUND' || e.code === 'NOT_IMPLEMENTED' || e.status === 501));

// Permission catalogue (backend/src/constants/permissions.js). Managers always
// get MANAGER_DEFAULTS; agents can only be given verification.field.
// Labels: admin.enum.permission.<key with dots as underscores>.
export const STAFF_PERMISSIONS = [
  'dashboard.view', 'listers.verify', 'listers.manage', 'properties.approve', 'properties.manage', 'verification.review', 'verification.schedule', 'verification.field', 'partners.manage', 'projects.approve', 'agreements.manage', 'agreements.view', 'leads.view_all', 'leads.assign', 'leads.export', 'contacts.view', 'routing.manage', 'teams.manage', 'staff.manage', 'sitevisits.view', 'deals.verify', 'receivables.manage', 'invoices.issue', 'users.manage', 'masters.manage', 'cms.manage', 'templates.manage', 'settings.manage', 'reports.view', 'logs.view', 'integrations.manage',
].map((value) => ({ value, get label() { return t(`admin.enum.permission.${value.replace(/\./g, '_')}`); } }));
export const MANAGER_DEFAULT_PERMISSIONS = ['dashboard.view', 'agreements.view', 'leads.view_all', 'leads.assign', 'sitevisits.view', 'reports.view'];
