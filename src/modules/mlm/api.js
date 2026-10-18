// Module N - MLM Referral Capture & Outbox: admin monitor hooks (RE-S-ADM-30).
// Endpoints: backend/src/modules/mlm/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are getters: they follow the chosen language when read.
const labels = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { tone, get label() { return t(`${prefix}.${k}`); } }]));

export const OUTBOX_STATUS = labels('admin.mlm.outbox', { pending: 'warning', sent: 'success', skipped_unreferred: 'neutral', dead: 'danger' });
export const JOB_STATUS = labels('admin.mlm.job', { queued: 'neutral', running: 'info', done: 'success', failed: 'warning', dead: 'danger' });
export const OUTBOX_TYPES = ['user.signup', 'deal.closed', 'deal.reversed'];

// meta.counts = { pending, sent, dead, ... } for the whole outbox.
export const useOutbox = (params) => useQuery({ queryKey: ['admin', 'outbox', params], queryFn: () => api.page('/admin/outbox', params), placeholderData: (prev) => prev, refetchInterval: 30_000 });
export const useOutboxEvent = (id) => useQuery({ queryKey: ['admin', 'outbox-event', id], queryFn: () => api.get(`/admin/outbox/${id}`), enabled: Boolean(id) });
// GET /admin/integrations/status: one card per channel (provider, switch, last success / failure).
export const INTEGRATION_HEALTH = labels('admin.mlm.health', { ok: 'success', warning: 'warning', error: 'danger', off: 'neutral' });
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
