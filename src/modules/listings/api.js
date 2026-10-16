// Module A - Property Listing & Catalog: API calls and query hooks.
// Endpoints: backend/src/modules/listings/routes/{lister,admin,public}.routes.js
// Prices are sent in rupees (the API stores paise) and read back in paise.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { useCount } from '@/shared/hooks/useCount';

export const LISTING_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_approval: { label: 'Pending approval', tone: 'info' },
  changes_requested: { label: 'Changes requested', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  expired: { label: 'Expired', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'danger' },
  sold: { label: 'Sold', tone: 'brand' },
  rented: { label: 'Rented', tone: 'brand' },
};
export const listingStatus = (s) => LISTING_STATUS[s] || { label: s, tone: 'neutral' };

export const WIZARD_STEPS = [
  { n: 1, key: 'basic', label: 'Basic' },
  { n: 2, key: 'location', label: 'Location' },
  { n: 3, key: 'details', label: 'Details' },
  { n: 4, key: 'price', label: 'Price' },
  { n: 5, key: 'amenities', label: 'Amenities' },
  { n: 6, key: 'media', label: 'Photos and documents' },
  { n: 7, key: 'commission', label: 'Commission' },
  { n: 8, key: 'review', label: 'Review' },
];

// Statuses whose content can be edited directly, and those where edits become a revision.
export const EDITABLE = ['draft', 'changes_requested', 'pending_approval'];
export const REVISABLE = ['live', 'paused'];

export const WARNING_LABELS = {
  pin_far_from_locality: 'The map pin is far from the chosen locality',
  locality_requested: 'New locality requested; our team will review it',
  rera_number_format: 'RERA number does not match the state format',
  rera_url_host: 'RERA link is not on the official state website',
  duplicate_unit: 'Another listing exists for the same unit',
  duplicate_photos: 'Some photos match another listing',
  price_outlier: 'Price is far from the locality average',
  contact_patterns: 'Text looks like it contains contact details',
  rera_missing: 'RERA details are missing',
  commission_below_current_min: 'Commission is below the current minimum',
  rera_expired: 'The project RERA registration validity has passed',
};

export const listingKeys = {
  own: (p) => ['lister', 'properties', p],
  one: (id) => ['lister', 'property', id],
  masters: ['masters', 'public'],
  cities: ['locations', 'cities'],
  localities: (city) => ['locations', 'localities', city],
  template: (purpose) => ['agreement-template', purpose],
};

// ---------------------------------------------------------------- lookups (public, cached long)

export const useMasters = () => useQuery({ queryKey: listingKeys.masters, queryFn: () => api.get('/masters/public'), staleTime: 3_600_000 });
export const useCities = () => useQuery({ queryKey: listingKeys.cities, queryFn: () => api.get('/locations/cities'), staleTime: 3_600_000 });
export const useLocalities = (city) => useQuery({ queryKey: listingKeys.localities(city), queryFn: () => api.get('/locations/localities', { city }), enabled: Boolean(city), staleTime: 600_000 });
export const geocode = (q) => api.get('/geo/geocode', { q });
export const reverseGeocode = (lat, lng) => api.get('/geo/reverse', { lat, lng });

// ---------------------------------------------------------------- lister listings

export const useOwnListingCount = (status) => useCount('/lister/properties', status ? { status } : {});
export const useOwnListings = (params = {}) => useQuery({ queryKey: listingKeys.own(params), queryFn: () => api.page('/lister/properties', params) });
export const useListing = (id) => useQuery({ queryKey: listingKeys.one(id), queryFn: () => api.get(`/lister/properties/${id}`), enabled: Boolean(id) });
export const useAgreementTemplate = (purpose) => useQuery({ queryKey: listingKeys.template(purpose), queryFn: () => api.get('/lister/agreement-template', { purpose }), enabled: Boolean(purpose) });

function useListingMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.one(id) });
      qc.invalidateQueries({ queryKey: ['lister', 'properties'] });
      qc.invalidateQueries({ queryKey: ['count', '/lister/properties'] });
    },
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/lister/properties'), onSuccess: () => qc.invalidateQueries({ queryKey: ['lister', 'properties'] }) });
}
export const useSaveStep = (id) => useListingMutation(id, ({ step, body }) => api.patch(`/lister/properties/${id}/steps/${step}`, body));
export const useAddMedia = (id) => useListingMutation(id, (body) => api.post(`/lister/properties/${id}/media`, body));
export const useEditMedia = (id) => useListingMutation(id, ({ mediaId, body }) => api.patch(`/lister/properties/${id}/media/${mediaId}`, body));
export const useOrderMedia = (id) => useListingMutation(id, (body) => api.patch(`/lister/properties/${id}/media/order`, body));
export const useRemoveMedia = (id) => useListingMutation(id, (mediaId) => api.del(`/lister/properties/${id}/media/${mediaId}`));
export const useAcceptCommission = (id) => useListingMutation(id, (body) => api.post(`/lister/properties/${id}/commission`, body));
export const useSubmitListing = (id) => useListingMutation(id, () => api.post(`/lister/properties/${id}/submit`));

// Lifecycle actions from the list: { action, body }.
const ACTION_PATH = { withdraw: 'withdraw', renew: 'renew', deactivate: 'deactivate', reactivate: 'reactivate', duplicate: 'duplicate', pause: 'pause', resume: 'resume', check: 'availability-check' };
export function useListingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }) => (action === 'delete' ? api.del(`/lister/properties/${id}`) : api.post(`/lister/properties/${id}/${ACTION_PATH[action]}`, body || {})),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['lister', 'properties'] });
      qc.invalidateQueries({ queryKey: listingKeys.one(id) });
      qc.invalidateQueries({ queryKey: ['count', '/lister/properties'] });
    },
  });
}

// ---------------------------------------------------------------- admin

export const useAdminListingCount = (params, enabled) => useCount('/admin/properties', params, { enabled });
export const useApprovalQueue = (params = {}, enabled = true) => useQuery({
  queryKey: ['admin', 'properties', 'queue', params],
  queryFn: () => api.page('/admin/properties', params),
  enabled,
});

// ---------------------------------------------------------------- helpers

// What the API will still ask for before submit (mirrors listings/service.js missingForSubmit).
export function missingSteps(listing, { builder, minPhotos = 3 } = {}) {
  if (!listing) return [];
  const done = (listing.wizard && listing.wizard.stepsDone) || [];
  const out = [];
  [1, 2, 3, 4, 5].forEach((n) => { if (!done.includes(n)) out.push({ step: n, text: `${WIZARD_STEPS[n - 1].label} not saved` }); });
  const photos = ((listing.media && listing.media.photos) || []).filter((p) => !p.moderation || p.moderation.status !== 'rejected');
  if (photos.length < minPhotos) out.push({ step: 6, text: `At least ${minPhotos} photos (${photos.length} added)` });
  if (!builder && !((listing.media && listing.media.ownershipProofs) || []).length) out.push({ step: 6, text: 'Ownership proof (private)' });
  if (builder) {
    const r = listing.rera || {};
    if (!(((r.numbers || []).length && r.url && r.certificateFileId) || (r.exempt && r.exempt.reason))) out.push({ step: 6, text: 'RERA number, link and certificate (or exemption)' });
  }
  if (!done.includes(7) || !listing.activeAgreementId) out.push({ step: 7, text: 'Commission agreement' });
  return out;
}

export const priceOf = (l) => (l.purpose === 'rent' ? l.price && l.price.monthlyRent : l.price && l.price.amount);
