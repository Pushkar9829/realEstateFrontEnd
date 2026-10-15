// Module H - Deals & Receipt Verification: admin hooks (RE-S-ADM-18, 19, 33).
// Endpoints: backend/src/modules/deals/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '@/shared/lib/api';

export const DEAL_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'brand' },
  returned: { label: 'Returned', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  reversed: { label: 'Reversed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const dealStatus = (s) => DEAL_STATUS[s] || { label: s, tone: 'neutral' };

// Spec RE-S-ADM-19: every item is required to verify.
export const DEAL_CHECKLIST = [
  ['payer_matches_buyer', 'Receipt payer name matches the buyer'],
  ['payee_matches_lister', 'Payee matches the lister (or their authorised account)'],
  ['amount_date_match', 'Amount and date match the deal'],
  ['agreement_identifies_parties', 'Agreement copy identifies the property and parties'],
  ['completed_site_visit', 'At least one completed site visit exists'],
  ['commission_matches_agreement', 'Commission % equals the agreement in force on the booking date'],
  ['no_duplicate_receipt', 'No duplicate receipt (file hash and reference not used in another deal)'],
];

export const REJECT_REASONS = ['Fake receipt', 'Duplicate receipt', 'Deal not through platform', 'Cancelled by buyer', 'Other'];
export const PAYMENT_MODES = { bank_transfer: 'Bank transfer', cheque: 'Cheque', upi: 'UPI', cash: 'Cash', dd: 'Demand draft', other: 'Other' };

const keys = {
  queue: (p) => ['admin', 'deals', 'queue', p],
  one: (id) => ['admin', 'deal', id],
};

export const useDealQueue = (params) => useQuery({ queryKey: keys.queue(params), queryFn: () => api.page('/admin/deals', params), placeholderData: (prev) => prev });
export const useDeal = (id) => useQuery({ queryKey: keys.one(id), queryFn: () => api.get(`/admin/deals/${id}`), enabled: Boolean(id) });
// Signed link valid 10 minutes; each view is audited.
export const dealDocumentUrl = (id, docId) => api.get(`/admin/deals/${id}/documents/${docId}`);

function useDealMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.one(id) });
      qc.invalidateQueries({ queryKey: ['admin', 'deals'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export const claimDeal = (id) => api.post(`/admin/deals/${id}/claim`);
export const useClaimDeal = (id) => useDealMutation(id, () => api.post(`/admin/deals/${id}/claim`));
export const useReleaseDeal = (id) => useDealMutation(id, () => api.post(`/admin/deals/${id}/release`));

// decision: verify | return (comment) | reject (reason). Verify carries an
// Idempotency-Key so a double click or retry returns the first result.
// Pass the same `idempotencyKey` when the user retries the same verification.
export const useDecideDeal = (id) => useDealMutation(id, ({ idempotencyKey, ...body }) => (body.decision === 'verify'
  ? http.post(`/admin/deals/${id}/decision`, body, { headers: { 'Idempotency-Key': idempotencyKey || crypto.randomUUID() } }).then((r) => r.data.data)
  : api.post(`/admin/deals/${id}/decision`, body)));

// { reason, effectiveDate?, leadOutcome: negotiation | closed_lost, lostReason? } -> { ...deal, effects: [] }
export const useReverseDeal = (id) => useDealMutation(id, (body) => api.post(`/admin/deals/${id}/reverse`, body));

// ---------------------------------------------------------------- partners and referrals (Could)

export const PARTNER_TYPES = { bank: 'Bank', nbfc: 'NBFC', rental_agreement: 'Rental agreement', other: 'Other' };
export const LOAN_FLOW = { referred: ['contacted', 'rejected', 'withdrawn'], contacted: ['sanctioned', 'rejected', 'withdrawn'], sanctioned: ['disbursed', 'rejected', 'withdrawn'], disbursed: [], rejected: [], withdrawn: [] };
export const SERVICE_FLOW = { requested: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [] };

export const usePartners = (params) => useQuery({ queryKey: ['admin', 'partners', params], queryFn: () => api.get('/admin/partners', params) });
export const usePartnerReferrals = (params) => useQuery({ queryKey: ['admin', 'partner-referrals', params], queryFn: () => api.page('/admin/partner-referrals', params), placeholderData: (prev) => prev });

function usePartnerMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'partners'] }); qc.invalidateQueries({ queryKey: ['admin', 'partner-referrals'] }); } });
}
export const useCreatePartner = () => usePartnerMutation((body) => api.post('/admin/partners', body));
export const useEditPartner = () => usePartnerMutation(({ id, body }) => api.patch(`/admin/partners/${id}`, body));
// Partner agreement: a private signed_agreement upload, opened through a 10-minute signed link.
export const PARTNER_AGREEMENT_PURPOSE = 'signed_agreement';
export const partnerAgreementUrl = (id) => api.get(`/admin/partners/${id}/agreement`);
// { status?, partnerRef?, note?, payoutDue?, payoutReceived?, sanctionedAmount?, disbursedAmount? (rupees), fileId? }
export const usePatchReferral = () => usePartnerMutation(({ id, body }) => api.patch(`/admin/partner-referrals/${id}`, body));
