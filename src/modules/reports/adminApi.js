// Module O - Reports, Audit & System Logs: admin hooks (RE-S-ADM-01, 28, 29).
// Endpoints: backend/src/modules/reports/routes/admin.routes.js and
// backend/src/modules/masking/routes/admin.routes.js (contact reveals).
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError, http } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// ---------------------------------------------------------------- authenticated downloads

// A 4xx body arrives as a Blob when responseType is 'blob'; read it back into
// the API error envelope so the message reaches the user.
async function blobError(res) {
  let body = null;
  try { body = JSON.parse(await res.data.text()); } catch { /* not JSON */ }
  const e = body && body.error;
  return new ApiError({ status: res.status, code: e ? e.code : 'HTTP_ERROR', message: e ? e.message : `Request failed (${res.status})`, details: e && e.details, requestId: e && e.requestId });
}

function saveBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  if (filename) {
    const a = document.createElement('a');
    a.href = href; a.download = filename; a.click();
  } else window.open(href, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

const fileNameFrom = (res, fallback) => {
  const cd = res.headers && (res.headers['content-disposition'] || '');
  const m = /filename="?([^";]+)"?/i.exec(cd || '');
  return (m && m[1]) || fallback;
};

/**
 * GET a file with the bearer token. Saves it (`filename`) or opens it in a
 * new tab (`open: true`). A 202 answer (async export) is returned as JSON
 * instead: { accepted: true, ...data }.
 */
export async function downloadFile(url, { params, filename, open = false } = {}) {
  // 401 still goes through the refresh interceptor; other 4xx are read here.
  const res = await http.get(url, { params, responseType: 'blob', validateStatus: (s) => s < 500 && s !== 401 });
  if (res.status >= 400) throw await blobError(res);
  if (res.status === 202) {
    const body = JSON.parse(await res.data.text());
    return { accepted: true, ...(body.data || {}) };
  }
  saveBlob(res.data, open ? null : fileNameFrom(res, filename || 'download'));
  return { accepted: false, truncated: Boolean(res.headers && res.headers['x-export-truncated'] === 'true') };
}

// ---------------------------------------------------------------- report catalogue

// label / description are read from the dictionary when used (getters).
export const REPORTS = ['agents', 'leads', 'funnel', 'sla', 'commission', 'listings', 'ageing'].map((key) => ({
  key,
  get label() { return t(`admin.enum.report.${key}.label`); },
  get description() { return t(`admin.enum.report.${key}.description`); },
}));
export const reportMeta = (key) => REPORTS.find((r) => r.key === key);

// Commission report breakdown (RE-D-08): GET /admin/reports/commission?groupBy=month|lister|agent|city.
export const COMMISSION_GROUPS = ['month', 'lister', 'agent', 'city'].map((value) => ({ value, get label() { return t(`admin.enum.commissionGroup.${value}`); } }));

export const useReport = (key, params, enabled = true) => useQuery({ queryKey: ['admin', 'report', key, params], queryFn: () => api.get(`/admin/reports/${key}`, params), enabled: Boolean(key) && enabled });

// CSV export: a small report downloads at once; a large one (or async=true)
// answers 202 with { exportId } and is prepared by a background job.
export const exportReport = (key, params) => downloadFile(`/admin/reports/${key}/export`, { params: { ...params, format: 'csv' }, filename: `${key}.csv` });

// GET /admin/exports/:id -> { status } until ready, then { status: 'ready', url, rows, expiresAt }.
export const useExportJob = (id) => useQuery({
  queryKey: ['admin', 'export', id],
  queryFn: () => api.get(`/admin/exports/${id}`),
  enabled: Boolean(id),
  refetchInterval: (q) => (q.state.data && ['ready', 'failed', 'expired'].includes(q.state.data.status) ? false : 3000),
});

// ---------------------------------------------------------------- dashboard

export const useAdminDashboard = () => useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.get('/admin/dashboard'), refetchInterval: 60_000 });

// ---------------------------------------------------------------- logs (logs.view)

export const useAuditLogs = (params) => useQuery({ queryKey: ['admin', 'audit-logs', params], queryFn: () => api.page('/admin/audit-logs', params), placeholderData: (prev) => prev });
export const useLoginHistoryAdmin = (params) => useQuery({ queryKey: ['admin', 'login-history', params], queryFn: () => api.page('/admin/login-history', params), placeholderData: (prev) => prev });
export const useContactReveals = (params) => useQuery({ queryKey: ['admin', 'contact-reveals', params], queryFn: () => api.page('/admin/contact-reveals', params), placeholderData: (prev) => prev });

// CSV exports of the audit log and login history (same filters as the lists,
// newest first, at most 10,000 rows; `truncated` when the cap was hit).
const stripPaging = ({ page, limit, ...rest }) => rest; // eslint-disable-line no-unused-vars
export const useAuditLogExport = () => useMutation({ mutationFn: (params) => downloadFile('/admin/audit-logs/export', { params: stripPaging(params), filename: 'audit-logs.csv' }) });
export const useLoginHistoryExport = () => useMutation({ mutationFn: (params) => downloadFile('/admin/login-history/export', { params: stripPaging(params), filename: 'login-history.csv' }) });

// Small helper so pages can trigger an export with loading state.
export const useReportExport = (key) => useMutation({ mutationFn: (params) => exportReport(key, params) });
