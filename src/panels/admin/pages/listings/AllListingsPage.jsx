// RE-D-11/12 all listings (properties.manage): filter by status and search,
// then feature, extend, pause, resume, suspend or deactivate. RE-S-ADM-08:
// per-listing history drawer (GET /admin/properties/:id/history) and CSV
// export of the current status tab (POST /admin/properties/export).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, History, Search, Star } from 'lucide-react';
import { Alert, Badge, Button, Drawer, Input, Modal, PageHeader, Pagination, Select, Skeleton, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { api, ApiError, http } from '@/shared/lib/api';
import { date, dateTime, shortRupees, titleCase } from '@/shared/lib/format';
import { listingStatus, priceOf } from '@/modules/listings/api';
import { useAdminListingAction, useReviewQueue } from '@/modules/approvals/api';
import { useT } from '@/shared/i18n';

const TABS = (t) => [{ value: 'live', label: t('admin.listings.tabs.live') }, { value: 'paused', label: t('admin.listings.tabs.paused') }, { value: 'pending_approval', label: t('admin.listings.tabs.inReview') }, { value: 'expired', label: t('admin.listings.tabs.expired') }, { value: 'suspended', label: t('admin.listings.tabs.suspended') }, { value: 'inactive,rejected', label: t('admin.listings.tabs.inactive') }, { value: 'sold,rented', label: t('admin.listings.tabs.closed') }];
const ACTIONS = {
  live: ['feature', 'unfeature', 'extend', 'pause', 'suspend', 'deactivate'],
  paused: ['resume', 'extend', 'suspend', 'deactivate'],
  expired: ['extend'],
  pending_approval: ['suspend'],
};
const ACTION_IDS = ['feature', 'unfeature', 'extend', 'pause', 'resume', 'suspend', 'deactivate'];
const actionLabel = (t, a) => (ACTION_IDS.includes(a) ? t(`admin.listings.action.${a}`) : a);

function ActionDialog({ listing, onClose }) {
  const t = useT();
  const toast = useToast();
  const act = useAdminListingAction(listing._id);
  const options = (ACTIONS[listing.status] || []).filter((a) => !(a === 'feature' && listing.featured?.on) && !(a === 'unfeature' && !listing.featured?.on));
  const [action, setAction] = useState(options[0]);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('30');
  const needsReason = ['pause', 'suspend', 'deactivate'].includes(action);
  const submit = async () => {
    try {
      await act.mutateAsync({ action, ...(needsReason ? { reason: reason.trim() } : {}), ...(action === 'extend' ? { days: Number(days) } : {}) });
      toast.success(t('admin.listings.actionDone', { action: actionLabel(t, action) })); onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={listing.title} description={listing.listingNo}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant={['suspend', 'deactivate'].includes(action) ? 'danger' : 'primary'} disabled={!action || (needsReason && reason.trim().length < 3)} loading={act.isPending} onClick={submit}>{t('admin.listings.apply')}</Button></>}>
      {options.length ? (
        <div className="space-y-4">
          <Select label={t('admin.listings.actionField')} value={action} onChange={(e) => setAction(e.target.value)} options={options.map((a) => ({ value: a, label: actionLabel(t, a) }))} />
          {action === 'extend' && <Input label={t('admin.listings.extendBy')} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />}
          {needsReason && <Textarea label={t('admin.listings.reason')} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('admin.listings.reasonHint')} />}
        </div>
      ) : <p className="text-sm text-ink-muted">{t('admin.listings.noActions', { status: listingStatus(listing.status).label.toLowerCase() })}</p>}
    </Modal>
  );
}

// Status changes and the audit trail of one listing, newest first.
function HistoryDrawer({ listing, onClose }) {
  const t = useT();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'listing-history', listing._id], queryFn: () => api.get(`/admin/properties/${listing._id}/history`) });
  const events = data ? [
    ...(data.statusHistory || []).map((h) => ({ at: h.at, title: `${h.from ? `${listingStatus(h.from).label} → ` : ''}${listingStatus(h.to).label}`, note: h.note, kind: 'status' })),
    ...(data.audit || []).map((a) => ({ at: a.at, title: titleCase(String(a.action).replace(/^(property|listing)\./, '').replace(/\./g, ' ')), note: a.reason, kind: 'audit', role: a.actorRole })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)) : [];
  return (
    <Drawer open onClose={onClose} side="right" title={t('admin.listings.historyTitle', { no: listing.listingNo })}>
      <div className="space-y-3 p-4">
        <p className="text-sm font-medium text-ink">{listing.title}</p>
        {data && data.revisionNo ? <p className="text-xs text-ink-subtle">{t('admin.listings.revision', { n: data.revisionNo })}{data.pendingRevision ? t('admin.listings.pendingEdit') : ''}</p> : null}
        {error && <Alert tone="danger">{error.message}</Alert>}
        {isLoading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />) : !events.length ? <p className="text-sm text-ink-subtle">{t('admin.listings.noHistory')}</p> : (
          <ol className="space-y-3 border-l pl-4">
            {events.map((e, i) => (
              <li key={`${e.kind}-${i}`} className="relative">
                <span className={`absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full ${e.kind === 'status' ? 'bg-brand-600' : 'bg-line-strong'}`} aria-hidden />
                <p className="text-sm text-ink">{e.title}</p>
                <p className="text-xs text-ink-subtle">{dateTime(e.at)}{e.role ? ` · ${titleCase(e.role)}` : ''}</p>
                {e.note && <p className="mt-0.5 text-xs text-ink-muted">{e.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}

// CSV with the auth header; errors come back as a Blob and are read here.
async function exportListingsCsv(status, t) {
  const res = await http.post('/admin/properties/export', { status }, { responseType: 'blob', validateStatus: (s) => s < 500 && s !== 401 });
  if (res.status >= 400) {
    let e = null;
    try { e = JSON.parse(await res.data.text()).error; } catch { /* not JSON */ }
    throw new ApiError({ status: res.status, code: e ? e.code : 'HTTP_ERROR', message: e ? e.message : t('admin.listings.exportFailed', { status: res.status }) });
  }
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = `listings-${status.replace(/,/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export default function AllListingsPage() {
  const t = useT();
  const toast = useToast();
  const [history, setHistory] = useState(null);
  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try { await exportListingsCsv(status, t); toast.success(t('admin.listings.csvDownloaded')); } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };
  const [status, setStatus] = useState('live');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);
  const { data, isLoading } = useReviewQueue({ page, limit: 20, status, sort: '-updatedAt', ...(query ? { q: query } : {}) });
  return (
    <>
      <PageHeader title={t('panel.nav.adminListings')} description={t('admin.listings.description')}
        actions={<Button variant="secondary" icon={Download} loading={exporting} onClick={runExport}>{t('admin.listings.exportCsv')}</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS(t).map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} className="flex gap-2">
          <input className="h-9 w-56 rounded-md border border-line-strong px-3 text-sm" placeholder={t('admin.listings.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('admin.listings.searchAria')} />
          <Button size="sm" variant="secondary" icon={Search} type="submit">{t('admin.listings.search')}</Button>
        </form>
      </div>
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('admin.listings.empty')}
        columns={[
          { key: 'title', header: t('admin.listings.col.title'), render: (r) => <span><Link to={`/admin/approvals/${r._id}`} className="block max-w-sm truncate font-medium text-ink hover:text-brand-700">{r.title}</Link><span className="text-xs text-ink-subtle">{r.listingNo} · {[r.location?.locality, r.location?.city].filter(Boolean).join(', ')}</span></span> },
          { key: 'lister', header: t('admin.listings.col.lister'), render: (r) => r.listerId?.name || '-' },
          { key: 'price', header: t('admin.listings.col.price'), render: (r) => (priceOf(r) ? shortRupees(priceOf(r)) : '-') },
          { key: 'status', header: t('admin.listings.col.status'), render: (r) => { const s = listingStatus(r.status); return <span className="inline-flex items-center gap-1"><Badge tone={s.tone}>{s.label}</Badge>{r.featured?.on && <Star className="h-4 w-4 text-accent-600" aria-label={t('admin.listings.featured')} />}</span>; } },
          { key: 'expires', header: t('admin.listings.col.expires'), render: (r) => date(r.expiresAt) },
          { key: 'act', header: '', render: (r) => (
            <span className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" icon={History} onClick={() => setHistory(r)} aria-label={t('admin.listings.historyOf', { no: r.listingNo })}>{t('admin.listings.history')}</Button>
              {ACTIONS[r.status] ? <Button size="sm" variant="secondary" onClick={() => setActive(r)}>{t('admin.listings.actions')}</Button> : null}
            </span>
          ) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {active && <ActionDialog listing={active} onClose={() => setActive(null)} />}
      {history && <HistoryDrawer listing={history} onClose={() => setHistory(null)} />}
      <p className="mt-3 text-xs text-ink-subtle">{t('admin.listings.exportNote')}</p>
    </>
  );
}
