// Module D - agreement registry (RE-D-06/07/10): hooks for both panels.
// scope 'lister' -> /api/lister/agreements (own only); 'admin' -> /api/admin/agreements.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));

export const AGREEMENT_STATUS = toned('lister.agreements.status', {
  accepted: 'info',
  countersigned: 'success',
  superseded: 'neutral',
  terminated: 'danger',
  void: 'neutral',
});
export const agreementStatus = (s) => AGREEMENT_STATUS[s] || { label: s, tone: 'neutral' };

const base = (scope) => (scope === 'admin' ? '/admin/agreements' : '/lister/agreements');

export const useAgreements = (scope, params) => useQuery({ queryKey: ['agreements', scope, params], queryFn: () => api.page(base(scope), params) });
export const useAgreement = (scope, id) => useQuery({ queryKey: ['agreement', scope, id], queryFn: () => api.get(`${base(scope)}/${id}`), enabled: Boolean(id) });

// Authenticated download (the API needs the bearer token, so no plain <a href>).
export async function openBlob(url, { download } = {}) {
  const res = await http.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  if (download) {
    const a = document.createElement('a');
    a.href = href; a.download = download; a.click();
  } else window.open(href, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
export const openAgreementPdf = (scope, id) => openBlob(`${base(scope)}/${id}/pdf`);
export const downloadAgreementsCsv = () => openBlob('/admin/agreements/export', { download: 'agreements.csv' });

function useAdminAgreementMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreement', 'admin', id] });
      qc.invalidateQueries({ queryKey: ['agreements', 'admin'] });
    },
  });
}
export const useUploadSigned = (id) => useAdminAgreementMutation(id, (body) => api.post(`/admin/agreements/${id}/signed-document`, body));
export const useTerminateAgreement = (id) => useAdminAgreementMutation(id, (body) => api.post(`/admin/agreements/${id}/terminate`, body));
export const useRequestNewVersion = (id) => useAdminAgreementMutation(id, (body) => api.post(`/admin/agreements/${id}/request-new-version`, body));
