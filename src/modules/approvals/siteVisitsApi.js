// Module D - site verification visits (RE-D-13 / RE-S-ADM-32, Could,
// verification.schedule): list, schedule, reschedule / reassign, cancel.
// Endpoints: backend/src/modules/approvals/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const VERIFICATION_VISIT_STATUS = {
  requested: { label: 'Requested', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  verified: { label: 'Verified', tone: 'success' },
  not_verified: { label: 'Not verified', tone: 'danger' },
  lister_absent: { label: 'Lister absent', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const verificationVisitStatus = (s) => VERIFICATION_VISIT_STATUS[s] || { label: s, tone: 'neutral' };

// Friendly text for the API error codes this screen can meet.
export const VISIT_ERRORS = {
  FEATURE_DISABLED: 'Site verification visits are switched off in Settings (verification.siteVisitEnabled).',
  CITY_NOT_OFFERED: 'The listing city is not in verification.siteVisitCities.',
  LISTING_STATUS: 'Only live or pending-approval listings can be site verified.',
  VISIT_OPEN: 'This listing already has an open visit.',
  RESCHEDULE_LIMIT: 'A visit can be rescheduled only once after the lister was absent.',
  INVALID_TRANSITION: 'The visit is no longer in a state that allows this.',
};

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
