// Module D - Admin Approval & Operations: listing review hooks.
// Endpoints: backend/src/modules/approvals/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const labels = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));

export const CHECKLIST_LABELS = labels('admin.enum.listingChecklist', ['photos_genuine', 'details_match', 'ownership_proof_matches_kyc', 'no_contact_info', 'commission_ok', 'location_ok', 'rera_verified']);

export const reviewKeys = {
  queue: (p) => ['admin', 'properties', 'queue', p],
  one: (id) => ['admin', 'property', id],
};

export const useReviewQueue = (params) => useQuery({ queryKey: reviewKeys.queue(params), queryFn: () => api.page('/admin/properties', params) });
export const useReviewListing = (id) => useQuery({ queryKey: reviewKeys.one(id), queryFn: () => api.get(`/admin/properties/${id}`) });
export const listingFileUrl = (id, fileId) => api.get(`/admin/properties/${id}/files/${fileId}`);

function useReviewMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.one(id) });
      qc.invalidateQueries({ queryKey: ['admin', 'properties', 'queue'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/properties'] });
    },
  });
}

export const useClaimListing = (id) => useReviewMutation(id, () => api.post(`/admin/properties/${id}/claim`));
export const useReleaseListing = (id) => useReviewMutation(id, () => api.post(`/admin/properties/${id}/release`));
export const useDecideListing = (id) => useReviewMutation(id, (body) => api.post(`/admin/properties/${id}/decision`, body));
export const useModeratePhoto = (id) => useReviewMutation(id, ({ mediaId, body }) => api.patch(`/admin/properties/${id}/media/${mediaId}/moderation`, body));
export const useAdminListingAction = (id) => useReviewMutation(id, (body) => api.patch(`/admin/properties/${id}`, body));
