// Module H - Deals & Receipt Verification: agent API calls and hooks.
// Endpoints: backend/src/modules/deals/routes/agent.routes.js
// Request bodies take rupees; deals come back in paise. Commission, GST and
// the closure checklist are computed by the server on every save.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are getters that call t() when read, so they follow the chosen language.
const withLabel = (obj, key) => Object.defineProperty(obj, 'label', { get: () => t(key), enumerable: true });

export const DEAL_STATUS = Object.fromEntries(Object.entries({
  draft: 'neutral', submitted: 'info', under_review: 'info', returned: 'warning', verified: 'success', rejected: 'danger', cancelled: 'neutral', reversed: 'danger',
}).map(([s, tone]) => [s, withLabel({ tone }, `agent.dealStatus.${s}`)]));
export const dealStatus = (s) => DEAL_STATUS[s] || { label: s, tone: 'neutral' };
export const DEAL_EDITABLE = ['draft', 'returned'];

export const PAYMENT_MODES = ['bank_transfer', 'cheque', 'upi', 'dd', 'cash', 'other'].map((value) => withLabel({ value }, `agent.paymentMode.${value}`));

const docKind = (kind, purpose, max) => Object.defineProperties({ purpose, max }, {
  label: { get: () => t(`agent.docKind.${kind}.label`), enumerable: true },
  hint: { get: () => t(`agent.docKind.${kind}.hint`), enumerable: true },
});
export const DOC_KINDS = {
  receipt: docKind('receipt', 'receipt', 10),
  agreement: docKind('agreement', 'agreement_doc', 5),
  other: docKind('other', 'agreement_doc', 10),
};

export const FEE_PAYERS = ['tenant', 'landlord', 'split', 'platform'].map((value) => withLabel({ value }, `agent.feePayer.${value}`));

// English text kept for any importer that needs a plain string; screens use partnerDisclaimer().
export const PARTNER_DISCLAIMER = 'The platform does not give lending or legal advice; the partner decides independently.';
export const partnerDisclaimer = () => t('agent.modals.partnerDisclaimer');

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
