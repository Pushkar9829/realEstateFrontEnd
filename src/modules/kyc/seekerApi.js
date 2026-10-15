// Module F - seeker behaviour flags (RE-F-10, users.manage): list, detail with
// the leads involved, and the dismiss / throttle / block decision.
// Endpoints: backend/src/modules/kyc/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const SEEKER_RULES = {
  many_listers: 'Enquired with many different listers in the window',
  many_localities: 'Enquired across many localities in the window',
  manual: 'Raised by staff from a lead',
};

export const SEEKER_ACTIONS = [
  { value: 'dismiss', label: 'Clear (lift limits)' },
  { value: 'throttle', label: 'Throttle (1 enquiry a day, manager queue)' },
  { value: 'block', label: 'Block (enquiries refused)' },
];

export const SEEKER_STATUS = {
  open: { label: 'Open', tone: 'warning' },
  actioned: { label: 'Actioned', tone: 'danger' },
  cleared: { label: 'Cleared', tone: 'success' },
};

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
