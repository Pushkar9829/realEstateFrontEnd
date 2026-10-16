// Module M - buyer accounts and privacy (RE-S-ADM-22), permission users.manage:
// GET /api/admin/users(/:id), PATCH /api/admin/users/:id/status,
// POST /api/admin/users/:id/anonymise, GET /api/admin/users/:id/consents,
// GET/PATCH /api/admin/deletion-requests(/:id)
// (backend/src/modules/auth/routes/admin.routes.js).
// Staff users (RE-S-ADM-16), permission staff.manage: /api/admin/staff
// (backend/src/modules/teams/routes/admin.routes.js).
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
// { id, reason (5-500) }
export const useAnonymiseBuyer = () => useBuyerMutation(({ id, reason }) => api.post(`/admin/users/${id}/anonymise`, { reason }));
// { status: in_progress | completed | rejected, note (5-1000) }; completed anonymises the buyer.
export const useDecideDeletion = () => useBuyerMutation(({ id, body }) => api.patch(`/admin/deletion-requests/${id}`, body));

// ---------------------------------------------------------------- staff users (RE-S-ADM-16)

export const STAFF_ROLES = [{ value: 'agent', label: 'Sales agent' }, { value: 'manager', label: 'Sales manager' }, { value: 'admin', label: 'Admin staff' }];
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
export const STAFF_PERMISSIONS = [
  ['dashboard.view', 'Dashboard'], ['listers.verify', 'Review and decide KYC'], ['listers.manage', 'Suspend, ban, reinstate listers; broker flags'],
  ['properties.approve', 'Approve, reject, request changes on listings'], ['properties.manage', 'Manage any listing (feature, extend, pause, deactivate)'],
  ['verification.review', 'Photo verification QA'], ['verification.schedule', 'Schedule site verification visits'], ['verification.field', 'Do site verification visits'],
  ['partners.manage', 'Partner banks and service partners'], ['projects.approve', 'Moderate builder projects'], ['agreements.manage', 'Agreement registry: upload, terminate'],
  ['agreements.view', 'View agreements'], ['leads.view_all', 'All leads'], ['leads.assign', 'Assign, reassign, reopen leads'], ['leads.export', 'Lead CSV export'],
  ['contacts.view', 'See buyer and lister phone / email'], ['routing.manage', 'Routing rules'], ['teams.manage', 'Teams, territories, capacities'],
  ['staff.manage', 'Staff users and 2FA resets'], ['sitevisits.view', 'Site visits'], ['deals.verify', 'Verify, return, reject deals'],
  ['receivables.manage', 'Receivables, payments, write-offs'], ['invoices.issue', 'Create and send invoices'], ['users.manage', 'Buyers, privacy, seeker flags'],
  ['masters.manage', 'Masters (cities, localities, types, reasons)'], ['cms.manage', 'CMS pages, banners, FAQs'], ['templates.manage', 'Notification templates'],
  ['settings.manage', 'Platform settings'], ['reports.view', 'Reports'], ['logs.view', 'Audit logs and login history'], ['integrations.manage', 'Jobs and MLM outbox'],
].map(([value, label]) => ({ value, label }));
export const MANAGER_DEFAULT_PERMISSIONS = ['dashboard.view', 'agreements.view', 'leads.view_all', 'leads.assign', 'sitevisits.view', 'reports.view'];
