// Module C - Integrated Lead Management: admin / manager hooks (RE-S-ADM-12,
// 13, 17). Managers get team-scoped data from the API.
// Endpoints: backend/src/modules/leads/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '@/shared/lib/api';

export const LEAD_STAGES = {
  new: { label: 'New', tone: 'info' },
  contacted: { label: 'Contacted', tone: 'brand' },
  qualified: { label: 'Qualified', tone: 'brand' },
  site_visit_scheduled: { label: 'Visit scheduled', tone: 'accent' },
  site_visit_done: { label: 'Visit done', tone: 'accent' },
  negotiation: { label: 'Negotiation', tone: 'warning' },
  booking: { label: 'Booking', tone: 'warning' },
  closed_won: { label: 'Won', tone: 'success' },
  closed_lost: { label: 'Lost', tone: 'danger' },
};
export const leadStage = (s) => LEAD_STAGES[s] || { label: String(s || '-').replace(/_/g, ' '), tone: 'neutral' };

export const LEAD_SOURCES = ['enquiry', 'callback', 'site_visit', 'best_price', 'contact_form', 'whatsapp', 'hotline', 'walk_in', 'referral', 'requirement', 'recycled'];
export const LEAD_PRIORITIES = { hot: 'danger', warm: 'warning', cold: 'info' };

export const VISIT_STATUS = {
  requested: { label: 'Requested', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  no_show: { label: 'No-show', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const visitStatus = (s) => VISIT_STATUS[s] || { label: s, tone: 'neutral' };

// SLA state of a lead row: breached, due (first contact pending) or met.
export function leadSla(l) {
  if (l.slaBreachedAt) return { tone: 'danger', label: 'Breached' };
  if (l.stage === 'new' && !l.firstContactAt && l.slaDueAt) {
    return new Date(l.slaDueAt) < new Date() ? { tone: 'danger', label: 'Overdue' } : { tone: 'warning', label: 'Due' };
  }
  if (l.firstContactAt) return { tone: 'success', label: 'Met' };
  return { tone: 'neutral', label: '-' };
}

export const adminLeadKeys = {
  list: (p) => ['admin', 'leads', 'list', p],
  one: (id) => ['admin', 'lead', id],
  queue: ['admin', 'leads', 'queue'],
  visits: (p) => ['admin', 'site-visits', p],
};

export const useAdminLeads = (params, opts = {}) => useQuery({ queryKey: adminLeadKeys.list(params), queryFn: () => api.page('/admin/leads', params), ...opts });
export const useAdminLead = (id) => useQuery({ queryKey: adminLeadKeys.one(id), queryFn: () => api.get(`/admin/leads/${id}`), enabled: Boolean(id) });
export const useLeadQueue = () => useQuery({ queryKey: adminLeadKeys.queue, queryFn: () => api.get('/admin/leads/queue'), refetchInterval: 60_000 });

function useLeadMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'leads'] });
      qc.invalidateQueries({ queryKey: ['admin', 'lead'] });
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/leads'] });
    },
  });
}

export const useAssignLead = () => useLeadMutation(({ id, agentId, reason }) => api.post(`/admin/leads/${id}/assign`, { agentId, ...(reason ? { reason } : {}) }));
export const useBulkAssign = () => useLeadMutation((body) => api.post('/admin/leads/bulk-assign', body));
export const useReopenLead = () => useLeadMutation(({ id, note }) => api.post(`/admin/leads/${id}/reopen`, { note }));
export const useRecycleLead = () => useLeadMutation((id) => api.post(`/admin/leads/${id}/recycle`));
export const useMergeLead = () => useLeadMutation(({ id, intoLeadId }) => api.post(`/admin/leads/${id}/merge`, { intoLeadId }));
export const useDecideReassign = () => useLeadMutation(({ id, reqId, body }) => api.post(`/admin/leads/${id}/reassign-requests/${reqId}/decision`, body));

// Audited contact reveal (RE-B-10): managers reveal through the agent panel
// (their team's leads); admins need contacts.view and use the admin route.
export const revealBuyerContact = (id, field = 'phone', { asAdmin = false } = {}) => api.post(`/${asAdmin ? 'admin' : 'agent'}/leads/${id}/reveal-contact`, { field });

export const useAddLeadNote = () => useLeadMutation(({ id, text }) => api.post(`/admin/leads/${id}/notes`, { text }));

// CSV export (leads.export): fetched with the auth header, saved as a blob.
export async function exportLeadsCsv(params) {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null));
  const res = await http.get('/admin/leads/export', { params: clean, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- site visits oversight (RE-S-ADM-17)

export const useAdminSiteVisits = (params) => useQuery({ queryKey: adminLeadKeys.visits(params), queryFn: () => api.page('/admin/site-visits', params) });

export function usePatchSiteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.patch(`/admin/site-visits/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'site-visits'] });
      qc.invalidateQueries({ queryKey: ['admin', 'lead'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/site-visits'] });
    },
  });
}
