// Module F - Lister KYC & No-Broker: API calls and query hooks.
// Endpoints: backend/src/modules/kyc/routes/{lister,admin}.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { useCount } from '@/shared/hooks/useCount';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));
const texts = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));

export const KYC_STATUS = toned('lister.kyc.status', {
  not_started: 'neutral',
  submitted: 'info',
  under_review: 'info',
  resubmission_required: 'warning',
  verified: 'success',
  rejected: 'danger',
  suspended: 'danger',
  banned: 'danger',
});

export const kycStatus = (s) => KYC_STATUS[s] || { label: s ? String(s).replace(/_/g, ' ') : t('lister.kyc.status.not_started'), tone: 'neutral' };

// Labels for the doc_type master codes (backend cms/baseMasters.js).
export const DOC_LABELS = texts('lister.kyc.docs', [
  'id_proof', 'pan_card', 'address_proof', 'incorporation_certificate', 'signatory_id', 'authorisation_letter', 'rera_registration', 'company_pan',
]);
export const docLabel = (code) => DOC_LABELS[code] || String(code).replace(/_/g, ' ');

export const CHECK_LABELS = texts('lister.kyc.checks', [
  'name_mismatch', 'pan_reused', 'document_reused', 'blocklisted',
]);

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

export const FLAG_RULES = texts('lister.kyc.flagRules', [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'reports', 'manual',
]);

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

// ---------------------------------------------------------------- builder brand (RE-B-02)
// Lister: GET/PATCH /lister/profile/brand { name, logoFileId }. Admin: POST /admin/listers/:id/approve-brand { decision, reason }.

export const brandKeys = { own: ['lister', 'brand'] };
export const useOwnBrand = (enabled = true) => useQuery({ queryKey: brandKeys.own, queryFn: () => api.get('/lister/profile/brand'), enabled });
export function useRequestBrand() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => api.patch('/lister/profile/brand', body), onSuccess: (brand) => qc.setQueryData(brandKeys.own, brand) });
}
export const useDecideBrand = () => useListerAdminMutation(({ id, body }) => api.post(`/admin/listers/${id}/approve-brand`, body));
