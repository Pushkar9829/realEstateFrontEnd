// Module H - Deals & Receipt Verification: agent API calls and hooks.
// Endpoints: backend/src/modules/deals/routes/agent.routes.js
// Request bodies take rupees; deals come back in paise. Commission, GST and
// the closure checklist are computed by the server on every save.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const DEAL_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'info' },
  returned: { label: 'Returned', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  reversed: { label: 'Reversed', tone: 'danger' },
};
export const dealStatus = (s) => DEAL_STATUS[s] || { label: s, tone: 'neutral' };
export const DEAL_EDITABLE = ['draft', 'returned'];

export const PAYMENT_MODES = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'dd', label: 'Demand draft' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export const DOC_KINDS = {
  receipt: { label: 'Payment receipts', purpose: 'receipt', max: 10, hint: 'At least one receipt is required' },
  agreement: { label: 'Booking form / agreement', purpose: 'agreement_doc', max: 5, hint: 'Agreement to sell, booking form or rent agreement' },
  other: { label: 'Other documents', purpose: 'agreement_doc', max: 10, hint: 'Buyer ID proof or anything else (optional)' },
};

export const FEE_PAYERS = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'split', label: 'Split' },
  { value: 'platform', label: 'Platform' },
];

export const PARTNER_DISCLAIMER = 'The platform does not give lending or legal advice; the partner decides independently.';

export const dealKeys = {
  list: (p) => ['agent', 'deals', p],
  one: (id) => ['agent', 'deal', id],
  partners: (type) => ['agent', 'partners', type],
};

export const useAgentDeals = (params = {}) => useQuery({ queryKey: dealKeys.list(params), queryFn: () => api.page('/agent/deals', params), placeholderData: (prev) => prev });
export const useAgentDeal = (id) => useQuery({ queryKey: dealKeys.one(id), queryFn: () => api.get(`/agent/deals/${id}`), enabled: Boolean(id), retry: (n, e) => e.status !== 404 && n < 2 });

// Partners are listed on the admin panel only (permission partners.manage);
// agents without it type the partner reference their manager gives them.
export const usePartners = (type) => useQuery({ queryKey: dealKeys.partners(type), queryFn: () => api.get('/agent/partners', type ? { type } : undefined), retry: false });

export const dealApi = {
  create: (body) => api.post('/agent/deals', body),
  edit: ({ id, body }) => api.patch(`/agent/deals/${id}`, body),
  addDocument: ({ id, body }) => api.post(`/agent/deals/${id}/documents`, body),
  removeDocument: ({ id, docId }) => api.del(`/agent/deals/${id}/documents/${docId}`),
  submit: ({ id }) => api.post(`/agent/deals/${id}/submit`),
  cancel: ({ id, reason }) => api.post(`/agent/deals/${id}/cancel`, { reason }),
  rentalAgreement: ({ id, body }) => api.post(`/agent/deals/${id}/service-requests`, body),
  loanReferral: ({ leadId, body }) => api.post(`/agent/leads/${leadId}/referrals`, body),
};

export function useDealMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['agent'] }) });
}

// The amount from an accepted offer (last accept round, else last priced round), in paise.
export function offerAmounts(offer) {
  const rounds = [...((offer && offer.rounds) || [])].reverse();
  const acc = rounds.find((r) => r.kind === 'accept');
  const priced = rounds.find((r) => r.amount);
  const tokened = rounds.find((r) => r.terms && r.terms.token);
  return { amount: (acc && acc.amount) || (priced && priced.amount) || null, token: (tokened && tokened.terms.token) || null };
}

export const toRupeesInput = (paise) => (paise == null ? '' : String(Math.round(paise / 100)));

// Live commission preview for DealForm: POST /agent/deals/preview-commission
// with { leadId, propertyId | projectId, dealType, agreedPrice | monthlyRent
// (rupees), bookingDate }. The server runs the same computation as the deal
// (agreement on the booking date, basis, rupee rounding, GST split); nothing is saved.
export const useCommissionPreview = (body, enabled = true) => useQuery({
  queryKey: ['agent', 'commission-preview', body],
  queryFn: () => api.post('/agent/deals/preview-commission', body),
  enabled: Boolean(body) && enabled,
  staleTime: 60_000,
  retry: false,
  placeholderData: (prev) => prev,
});
