// Module D - site verification visits (RE-D-13 / RE-S-ADM-32, Could,
// verification.schedule): list, schedule, reschedule / reassign, cancel.
// Endpoints: backend/src/modules/approvals/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));
const labels = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));

export const VERIFICATION_VISIT_STATUS = toned('admin.enum.verificationVisitStatus', {
  requested: 'info',
  scheduled: 'brand',
  verified: 'success',
  not_verified: 'danger',
  lister_absent: 'warning',
  cancelled: 'neutral',
});
export const verificationVisitStatus = (s) => VERIFICATION_VISIT_STATUS[s] || { label: s, tone: 'neutral' };

// Friendly text for the API error codes this screen can meet.
export const VISIT_ERRORS = labels('admin.enum.visitError', ['FEATURE_DISABLED', 'CITY_NOT_OFFERED', 'LISTING_STATUS', 'VISIT_OPEN', 'RESCHEDULE_LIMIT', 'INVALID_TRANSITION']);

export const useVerificationVisits = (params) => useQuery({ queryKey: ['admin', 'verification-visits', params], queryFn: () => api.page('/admin/verification/visits', params) });

function useVisitMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'verification-visits'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/verification/visits'] });
    },
  });
}

export const useScheduleVerificationVisit = () => useVisitMutation((body) => api.post('/admin/verification/visits', body));
export const usePatchVerificationVisit = () => useVisitMutation(({ id, body }) => api.patch(`/admin/verification/visits/${id}`, body));
export const useCancelVerificationVisit = () => useVisitMutation(({ id, reason }) => api.post(`/admin/verification/visits/${id}/cancel`, { reason }));

// Listing picker for "schedule a new visit" (admin property search, staff only).
export const useListingLookup = (q) => useQuery({
  queryKey: ['admin', 'properties', 'lookup', q], queryFn: () => api.page('/admin/properties', { q, status: 'live,pending_approval', limit: 8 }),
  enabled: Boolean(q && q.trim().length >= 2), staleTime: 30_000,
});
