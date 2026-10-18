// Module O - lister side: dashboard aggregates and per-listing stats (RE-O-08).
// Endpoints: backend/src/modules/reports/routes/lister.routes.js
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// { listings: { total, byStatus, expiringSoon[] }, totals, leads: { open }, visits: { upcoming }, offers: { awaitingYou }, badges, invoices: { outstanding, overdue } }
export const useListerDashboard = () => useQuery({ queryKey: ['lister', 'dashboard'], queryFn: () => api.get('/lister/dashboard'), staleTime: 30_000 });

// params: { from, to } ISO dates
export const useListingStats = (id, params) => useQuery({
  queryKey: ['lister', 'stats', id, params],
  queryFn: () => api.get(`/lister/properties/${id}/stats`, params),
  enabled: Boolean(id),
});

export const STAGE_LABELS = Object.defineProperties({}, Object.fromEntries(['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booking', 'closed_won', 'closed_lost']
  .map((k) => [k, { get: () => t(`lister.stats.stages.${k}`), enumerable: true }])));
