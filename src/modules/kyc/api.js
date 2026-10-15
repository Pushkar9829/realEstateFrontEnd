// Module F - Lister KYC & No-Broker: API calls and query hooks.
// Endpoints: backend/src/modules/kyc/routes/{lister,admin}.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { useCount } from '@/shared/hooks/useCount';

export const KYC_STATUS = {
  not_started: { label: 'Not started', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'info' },
  resubmission_required: { label: 'Resubmission needed', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  suspended: { label: 'Suspended', tone: 'danger' },
  banned: { label: 'Banned', tone: 'danger' },
};

export const kycStatus = (s) => KYC_STATUS[s] || { label: String(s || 'Not started').replace(/_/g, ' '), tone: 'neutral' };

// Labels for the doc_type master codes (backend cms/baseMasters.js).
export const DOC_LABELS = {
  id_proof: 'Identity proof (masked Aadhaar, passport or voter ID)',
  pan_card: 'PAN card',
  address_proof: 'Address proof',
  incorporation_certificate: 'Company incorporation / registration',
  signatory_id: 'Authorised signatory ID',
  authorisation_letter: 'Board resolution / authorisation letter',
  rera_registration: 'RERA registration (promoter)',
  company_pan: 'Company PAN',
};
export const docLabel = (code) => DOC_LABELS[code] || String(code).replace(/_/g, ' ');

export const CHECK_LABELS = {
  name_mismatch: 'Name does not match the profile',
  pan_reused: 'PAN used by another account',
  document_reused: 'Same document on another account',
  blocklisted: 'Matches a banned account',
};

export const kycKeys = {
  own: ['lister', 'kyc'],
  queue: (p) => ['admin', 'kyc', 'queue', p],
  detail: (id) => ['admin', 'kyc', id],
};

// ---------------------------------------------------------------- lister

export const useOwnKyc = () => useQuery({ queryKey: kycKeys.own, queryFn: () => api.get('/lister/kyc') });

function useOwnMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (kyc) => qc.setQueryData(kycKeys.own, (old) => (old ? { ...old, kyc } : old)),
  });
}

export const useSaveKyc = () => useOwnMutation((body) => api.put('/lister/kyc', body));
export const useAddKycDocument = () => useOwnMutation((body) => api.post('/lister/kyc/documents', body));
export const useRemoveKycDocument = () => useOwnMutation((docId) => api.del(`/lister/kyc/documents/${docId}`));
export const useSubmitKyc = () => useOwnMutation((body) => api.post('/lister/kyc/submit', body));

// ---------------------------------------------------------------- admin

export const useKycQueueCount = (enabled) => useCount('/admin/kyc', {}, { enabled });
export const useBrokerFlagCount = (enabled) => useCount('/admin/broker-flags', { status: 'open' }, { enabled });

export const useKycQueue = (params) => useQuery({ queryKey: kycKeys.queue(params), queryFn: () => api.page('/admin/kyc', params) });
export const useKycDetail = (userId) => useQuery({ queryKey: kycKeys.detail(userId), queryFn: () => api.get(`/admin/kyc/${userId}`) });
export const kycDocumentUrl = (userId, docId) => api.get(`/admin/kyc/${userId}/documents/${docId}`);

function useAdminMutation(userId, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kycKeys.detail(userId) });
      qc.invalidateQueries({ queryKey: ['admin', 'kyc', 'queue'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/kyc'] });
    },
  });
}

export const useClaimKyc = (userId) => useAdminMutation(userId, () => api.post(`/admin/kyc/${userId}/claim`));
export const useReleaseKyc = (userId) => useAdminMutation(userId, () => api.post(`/admin/kyc/${userId}/release`));
export const useDecideKyc = (userId) => useAdminMutation(userId, (body) => api.post(`/admin/kyc/${userId}/decision`, body));

// ---------------------------------------------------------------- admin: listers and broker flags (RE-F-06/07/08)

export const FLAG_RULES = {
  R1: 'Ownership proofs name many different owners (90 days)',
  R2: 'More active listings than the account type allows',
  R3: "Same photos on another lister's listing",
  R4: 'PAN or documents shared with another account',
  R5: 'Many properties across many localities',
  R6: 'Contact details typed into listings 3+ times in 24 h',
  reports: '3+ buyers reported the listing as a broker in 30 days',
  manual: 'Raised manually by staff',
};

export const useListers = (params) => useQuery({ queryKey: ['admin', 'listers', params], queryFn: () => api.page('/admin/listers', params) });
export const useListerDetail = (id) => useQuery({ queryKey: ['admin', 'lister', id], queryFn: () => api.get(`/admin/listers/${id}`), enabled: Boolean(id) });
export const useBrokerFlags = (params) => useQuery({ queryKey: ['admin', 'broker-flags', params], queryFn: () => api.page('/admin/broker-flags', params) });

function useListerAdminMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'lister'] });
      qc.invalidateQueries({ queryKey: ['admin', 'broker-flags'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/broker-flags'] });
    },
  });
}
export const useSetListerStatus = () => useListerAdminMutation(({ id, body }) => api.patch(`/admin/listers/${id}/status`, body));
export const useSetListingLimit = () => useListerAdminMutation(({ id, body }) => api.patch(`/admin/listers/${id}/limits`, body));
export const useResolveFlag = () => useListerAdminMutation(({ id, body }) => api.patch(`/admin/broker-flags/${id}`, body));
export const useManualFlag = () => useListerAdminMutation((body) => api.post('/admin/broker-flags', body));
