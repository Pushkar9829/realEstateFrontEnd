// Module I - Commission Receivables & Invoicing: admin hooks (RE-S-ADM-20, 21).
// Endpoints: backend/src/modules/receivables/routes/admin.routes.js
// Money in responses is paise; request bodies take rupees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { downloadFile } from '@/modules/reports/adminApi';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));
const labels = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));

export const RECEIVABLE_STATUS = toned('admin.enum.receivableStatus', {
  pending_invoice: 'neutral',
  invoiced: 'info',
  partially_paid: 'brand',
  overdue: 'danger',
  paid: 'success',
  disputed: 'warning',
  written_off: 'neutral',
  cancelled: 'neutral',
});
export const receivableStatus = (s) => RECEIVABLE_STATUS[s] || { label: s, tone: 'neutral' };
export const INVOICE_TONE = { draft: 'neutral', issued: 'success', cancelled: 'danger' };
export const PAYMENT_MODES = labels('admin.enum.paymentMode', ['bank_transfer', 'upi', 'cheque', 'cash', 'other']);

const keys = {
  list: (p) => ['admin', 'receivables', 'list', p],
  one: (id) => ['admin', 'receivable', id],
};

export const useReceivables = (params) => useQuery({ queryKey: keys.list(params), queryFn: () => api.page('/admin/receivables', params), placeholderData: (prev) => prev });
export const useReceivable = (id) => useQuery({ queryKey: keys.one(id), queryFn: () => api.get(`/admin/receivables/${id}`), enabled: Boolean(id) });

export const exportReceivablesCsv = (params) => downloadFile('/admin/receivables/export', { params, filename: 'receivables.csv' });
export const openInvoicePdf = (invoiceId) => downloadFile(`/admin/invoices/${invoiceId}/pdf`, { open: true });

function useRecMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (id) qc.invalidateQueries({ queryKey: keys.one(id) });
      qc.invalidateQueries({ queryKey: ['admin', 'receivables'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

// { ids?: [] } -> { sent, considered }
export const useBulkRemind = () => useRecMutation(null, (body) => api.post('/admin/receivables/remind', body || {}));
// { amount? (rupees, partial invoicing), note? }
export const useDraftInvoice = (id) => useRecMutation(id, (body) => api.post(`/admin/receivables/${id}/invoices`, body));
// invoiceId + { dueDays? }
export const useIssueInvoice = (id) => useRecMutation(id, ({ invoiceId, ...body }) => api.post(`/admin/invoices/${invoiceId}/issue`, body));
// invoiceId + { reason } (draft: deleted; issued: cancelled with a credit note)
export const useCancelInvoice = (id) => useRecMutation(id, ({ invoiceId, ...body }) => api.post(`/admin/invoices/${invoiceId}/cancel`, body));
// { amount, tds, date, mode, reference, proofFileId? }
export const useRecordPayment = (id) => useRecMutation(id, (body) => api.post(`/admin/receivables/${id}/payments`, body));
// proofId + { decision: confirm | reject, amount?, tds?, reason? }
export const useDecideProof = (id) => useRecMutation(id, ({ proofId, ...body }) => api.post(`/admin/receivables/${id}/payment-proofs/${proofId}/decision`, body));
export const useRaiseDispute = (id) => useRecMutation(id, (body) => api.post(`/admin/receivables/${id}/dispute`, body));
export const useResolveDispute = (id) => useRecMutation(id, (body) => api.post(`/admin/receivables/${id}/dispute/resolve`, body));
export const useWriteOff = (id) => useRecMutation(id, (body) => api.post(`/admin/receivables/${id}/write-off`, body));

// ---------------------------------------------------------------- sold-elsewhere checks (RE-A-19, RE-D-09)
// Endpoints: backend/src/modules/listings/routes/admin.routes.js (receivables.manage)

export const CHECK_STATUS = toned('admin.enum.soldElsewhereStatus', {
  open: 'warning',
  no_claim: 'neutral',
  claim_raised: 'danger',
  closed: 'success',
});
export const useSoldElsewhereChecks = (params, enabled = true) => useQuery({ queryKey: ['admin', 'sold-elsewhere', params], queryFn: () => api.page('/admin/sold-elsewhere-checks', params), enabled, placeholderData: (prev) => prev });
export function useDecideSoldElsewhere() {
  const qc = useQueryClient();
  // { status?: no_claim | claim_raised | closed, note?, claimAmount? (rupees), assignee? }
  return useMutation({ mutationFn: ({ id, body }) => api.patch(`/admin/sold-elsewhere-checks/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sold-elsewhere'] }) });
}
