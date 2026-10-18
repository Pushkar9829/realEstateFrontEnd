// Module F - seeker behaviour flags (RE-F-10, users.manage): list, detail with
// the leads involved, and the dismiss / throttle / block decision.
// Endpoints: backend/src/modules/kyc/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));
const labels = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));
const options = (prefix, values) => values.map((value) => ({ value, get label() { return t(`${prefix}.${value}`); } }));

export const SEEKER_RULES = labels('admin.enum.seekerRule', ['many_listers', 'many_localities', 'manual']);

export const SEEKER_ACTIONS = options('admin.enum.seekerAction', ['dismiss', 'throttle', 'block']);

export const SEEKER_STATUS = toned('admin.enum.seekerStatus', {
  open: 'warning',
  actioned: 'danger',
  cleared: 'success',
});

export const useSeekerFlags = (params) => useQuery({ queryKey: ['admin', 'seeker-flags', params], queryFn: () => api.page('/admin/seeker-flags', params) });
export const useSeekerFlag = (id) => useQuery({ queryKey: ['admin', 'seeker-flag', id], queryFn: () => api.get(`/admin/seeker-flags/${id}`), enabled: Boolean(id) });

export function useDecideSeekerFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.patch(`/admin/seeker-flags/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'seeker-flags'] });
      qc.invalidateQueries({ queryKey: ['admin', 'seeker-flag'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/seeker-flags'] });
    },
  });
}
