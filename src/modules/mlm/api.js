// Module N - MLM Referral Capture & Outbox: admin monitor hooks (RE-S-ADM-30).
// Endpoints: backend/src/modules/mlm/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const OUTBOX_STATUS = {
  pending: { label: 'Pending', tone: 'warning' },
  sent: { label: 'Sent', tone: 'success' },
  skipped_unreferred: { label: 'Skipped (no referral)', tone: 'neutral' },
  dead: { label: 'Dead', tone: 'danger' },
};
export const JOB_STATUS = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'warning' },
  dead: { label: 'Dead', tone: 'danger' },
};
export const OUTBOX_TYPES = ['user.signup', 'deal.closed', 'deal.reversed'];

// meta.counts = { pending, sent, dead, ... } for the whole outbox.
export const useOutbox = (params) => useQuery({ queryKey: ['admin', 'outbox', params], queryFn: () => api.page('/admin/outbox', params), placeholderData: (prev) => prev, refetchInterval: 30_000 });
export const useOutboxEvent = (id) => useQuery({ queryKey: ['admin', 'outbox-event', id], queryFn: () => api.get(`/admin/outbox/${id}`), enabled: Boolean(id) });
// GET /admin/integrations/status: one card per channel (provider, switch, last success / failure).
export const INTEGRATION_HEALTH = {
  ok: { label: 'Working', tone: 'success' },
  warning: { label: 'Check setup', tone: 'warning' },
  error: { label: 'Failing', tone: 'danger' },
  off: { label: 'Off', tone: 'neutral' },
};
export const useIntegrationsStatus = () => useQuery({ queryKey: ['admin', 'integrations-status'], queryFn: () => api.get('/admin/integrations/status'), refetchInterval: 60_000 });
export const useJobs = (params) => useQuery({ queryKey: ['admin', 'jobs', params], queryFn: () => api.page('/admin/jobs', params), placeholderData: (prev) => prev, refetchInterval: 30_000 });

function useMlmMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'outbox'] });
      qc.invalidateQueries({ queryKey: ['admin', 'outbox-event'] });
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin', 'integrations-status'] });
    },
  });
}
export const useRetryOutbox = () => useMlmMutation((id) => api.post(`/admin/outbox/${id}/retry`));
export const useMarkDead = () => useMlmMutation(({ id, reason }) => api.post(`/admin/outbox/${id}/mark-dead`, { reason }));
export const useRetryJob = () => useMlmMutation((id) => api.post(`/admin/jobs/${id}/retry`));
