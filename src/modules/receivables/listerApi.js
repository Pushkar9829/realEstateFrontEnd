// Module I - lister side: own commission invoices, PDF, payment proofs and disputes.
// Endpoints: backend/src/modules/receivables/routes/lister.routes.js
// Amounts come back in paise; the payment-proof body takes rupees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));

export const INVOICE_STATUS = toned('lister.invoices.invoiceStatus', {
  issued: 'info',
  cancelled: 'neutral',
  draft: 'neutral',
});
export const RECEIVABLE_STATUS = toned('lister.invoices.receivableStatus', {
  pending_invoice: 'neutral',
  invoiced: 'info',
  partially_paid: 'warning',
  overdue: 'danger',
  paid: 'success',
  disputed: 'accent',
  written_off: 'neutral',
  cancelled: 'neutral',
});
export const PAYMENT_STATUS = toned('lister.invoices.paymentStatus', {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'danger',
});
export const PAYMENT_MODES = ['bank_transfer', 'upi', 'cheque', 'cash', 'other']
  .map((value) => ({ value, get label() { return t(`lister.invoices.modes.${value}`); } }));
const pick = (map, s) => map[s] || { label: String(s || '-').replace(/_/g, ' '), tone: 'neutral' };
export const receivableStatus = (s) => pick(RECEIVABLE_STATUS, s);
export const invoiceStatus = (s) => pick(INVOICE_STATUS, s);
export const paymentStatus = (s) => pick(PAYMENT_STATUS, s);

export const invoiceKeys = {
  list: (p) => ['lister', 'invoices', p],
  one: (id) => ['lister', 'invoice', id],
};

// { items: [invoice], meta: { outstanding (paise), overdue (count) } }
export const useListerInvoices = (params = {}) => useQuery({ queryKey: invoiceKeys.list(params), queryFn: () => api.page('/lister/invoices', params) });
export const useListerInvoice = (id) => useQuery({ queryKey: invoiceKeys.one(id), queryFn: () => api.get(`/lister/invoices/${id}`), enabled: Boolean(id) });

function useInvoiceMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.one(id) });
      qc.invalidateQueries({ queryKey: ['lister', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['lister', 'dashboard'] });
    },
  });
}
// body: { fileId, amount (rupees), tds?, date, mode, reference? }
export const useUploadProof = (id) => useInvoiceMutation(id, (body) => api.post(`/lister/invoices/${id}/payment-proof`, body));
// body: { reason (10-1000) }
export const useRaiseDispute = (id) => useInvoiceMutation(id, (body) => api.post(`/lister/invoices/${id}/dispute`, body));

// The PDF needs the bearer token, so it is fetched as a blob and opened.
export async function openInvoicePdf(id, invoiceNo) {
  const res = await http.get(`/lister/invoices/${id}/pdf`, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const w = window.open(href, '_blank', 'noopener');
  if (!w) {
    const a = document.createElement('a');
    a.href = href; a.download = `${String(invoiceNo || 'invoice').replace(/\//g, '-')}.pdf`; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
