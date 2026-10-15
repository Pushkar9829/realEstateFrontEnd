// Module D - Admin Approval & Operations: listing review hooks.
// Endpoints: backend/src/modules/approvals/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const CHECKLIST_LABELS = {
  photos_genuine: 'Photos are genuine and of this property',
  details_match: 'Details, area and price look right',
  ownership_proof_matches_kyc: 'Ownership proof matches the verified lister',
  no_contact_info: 'No contact details in text or photos',
  commission_ok: 'Commission is within limits',
  location_ok: 'Map pin and locality are correct',
  rera_verified: 'RERA number checked on the official site',
};

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
