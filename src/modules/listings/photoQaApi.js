// Module A - photo verification QA (RE-A-20 / RE-S-ADM-31, verification.review):
// queue with SLA, claim / release and the approve / reject decision.
// Endpoints: backend/src/modules/listings/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const PHOTO_REJECT_REASONS = [
  { value: 'photos_do_not_match', label: 'Photos do not match the listing' },
  { value: 'location_mismatch', label: 'Location mismatch' },
  { value: 'poor_quality', label: 'Poor quality' },
  { value: 'staged_or_screen', label: 'Staged or photo of a screen' },
  { value: 'other', label: 'Other' },
];

export const SESSION_STATUS = {
  open: { label: 'Capturing', tone: 'neutral' },
  pending_review: { label: 'Pending review', tone: 'info' },
  approved: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};
export const sessionStatus = (s) => SESSION_STATUS[s] || { label: s, tone: 'neutral' };

export const photoQaKeys = {
  queue: (p) => ['admin', 'photo-sessions', p],
  one: (id) => ['admin', 'photo-session', id],
};

export const usePhotoSessions = (params) => useQuery({ queryKey: photoQaKeys.queue(params), queryFn: () => api.page('/admin/verification/photo-sessions', params) });
// Photo URLs are signed for 10 minutes; refetch before they lapse.
export const usePhotoSession = (id) => useQuery({ queryKey: photoQaKeys.one(id), queryFn: () => api.get(`/admin/verification/photo-sessions/${id}`), enabled: Boolean(id), refetchInterval: 8 * 60_000 });

function useSessionMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: photoQaKeys.one(id) });
      qc.invalidateQueries({ queryKey: ['admin', 'photo-sessions'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/verification/photo-sessions'] });
    },
  });
}

export const useClaimSession = (id) => useSessionMutation(id, () => api.post(`/admin/verification/photo-sessions/${id}/claim`));
export const useReleaseSession = (id) => useSessionMutation(id, () => api.post(`/admin/verification/photo-sessions/${id}/release`));
export const useDecideSession = (id) => useSessionMutation(id, (body) => api.post(`/admin/verification/photo-sessions/${id}/decision`, body));
