// Module O - lister side: dashboard aggregates and per-listing stats (RE-O-08).
// Endpoints: backend/src/modules/reports/routes/lister.routes.js
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

// { listings: { total, byStatus, expiringSoon[] }, totals, leads: { open }, visits: { upcoming }, offers: { awaitingYou }, badges, invoices: { outstanding, overdue } }
export const useListerDashboard = () => useQuery({ queryKey: ['lister', 'dashboard'], queryFn: () => api.get('/lister/dashboard'), staleTime: 30_000 });

// params: { from, to } ISO dates
export const useListingStats = (id, params) => useQuery({
  queryKey: ['lister', 'stats', id, params],
  queryFn: () => api.get(`/lister/properties/${id}/stats`, params),
  enabled: Boolean(id),
});

export const STAGE_LABELS = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', site_visit_scheduled: 'Visit scheduled', site_visit_done: 'Visited',
  negotiation: 'Negotiating', booking: 'Booking', closed_won: 'Closed (won)', closed_lost: 'Closed (lost)',
};
