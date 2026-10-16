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

const TABS = [{ value: 'live', label: 'Live' }, { value: 'paused', label: 'Paused' }, { value: 'pending_approval', label: 'In review' }, { value: 'expired', label: 'Expired' }, { value: 'suspended', label: 'Suspended' }, { value: 'inactive,rejected', label: 'Inactive / rejected' }, { value: 'sold,rented', label: 'Closed' }];
const ACTIONS = {
  live: ['feature', 'unfeature', 'extend', 'pause', 'suspend', 'deactivate'],
  paused: ['resume', 'extend', 'suspend', 'deactivate'],
  expired: ['extend'],
  pending_approval: ['suspend'],
};
const LABEL = { feature: 'Feature on home page', unfeature: 'Remove from featured', extend: 'Extend expiry', pause: 'Pause (admin review)', resume: 'Resume', suspend: 'Suspend', deactivate: 'Deactivate' };

function ActionDialog({ listing, onClose }) {
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
      toast.success(`${LABEL[action]}: done`); onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={listing.title} description={listing.listingNo}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={['suspend', 'deactivate'].includes(action) ? 'danger' : 'primary'} disabled={!action || (needsReason && reason.trim().length < 3)} loading={act.isPending} onClick={submit}>Apply</Button></>}>
      {options.length ? (
        <div className="space-y-4">
          <Select label="Action" value={action} onChange={(e) => setAction(e.target.value)} options={options.map((a) => ({ value: a, label: LABEL[a] }))} />
          {action === 'extend' && <Input label="Extend by (days)" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />}
          {needsReason && <Textarea label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="Recorded in the audit log and shown to the lister." />}
        </div>
      ) : <p className="text-sm text-ink-muted">No admin actions for a {listingStatus(listing.status).label.toLowerCase()} listing.</p>}
    </Modal>
  );
}

// Status changes and the audit trail of one listing, newest first.
function HistoryDrawer({ listing, onClose }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'listing-history', listing._id], queryFn: () => api.get(`/admin/properties/${listing._id}/history`) });
  const events = data ? [
    ...(data.statusHistory || []).map((h) => ({ at: h.at, title: `${h.from ? `${listingStatus(h.from).label} → ` : ''}${listingStatus(h.to).label}`, note: h.note, kind: 'status' })),
    ...(data.audit || []).map((a) => ({ at: a.at, title: titleCase(String(a.action).replace(/^(property|listing)\./, '').replace(/\./g, ' ')), note: a.reason, kind: 'audit', role: a.actorRole })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)) : [];
  return (
    <Drawer open onClose={onClose} side="right" title={`History · ${listing.listingNo}`}>
      <div className="space-y-3 p-4">
        <p className="text-sm font-medium text-ink">{listing.title}</p>
        {data && data.revisionNo ? <p className="text-xs text-ink-subtle">Revision {data.revisionNo}{data.pendingRevision ? ' · an edit is waiting for review' : ''}</p> : null}
        {error && <Alert tone="danger">{error.message}</Alert>}
        {isLoading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />) : !events.length ? <p className="text-sm text-ink-subtle">No history yet.</p> : (
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
async function exportListingsCsv(status) {
  const res = await http.post('/admin/properties/export', { status }, { responseType: 'blob', validateStatus: (s) => s < 500 && s !== 401 });
  if (res.status >= 400) {
    let e = null;
    try { e = JSON.parse(await res.data.text()).error; } catch { /* not JSON */ }
    throw new ApiError({ status: res.status, code: e ? e.code : 'HTTP_ERROR', message: e ? e.message : `Export failed (${res.status})` });
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
  const toast = useToast();
  const [history, setHistory] = useState(null);
  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try { await exportListingsCsv(status); toast.success('CSV downloaded'); } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };
  const [status, setStatus] = useState('live');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);
  const { data, isLoading } = useReviewQueue({ page, limit: 20, status, sort: '-updatedAt', ...(query ? { q: query } : {}) });
  return (
    <>
      <PageHeader title="All listings" description="Search by listing number or title. Every admin action is audited."
        actions={<Button variant="secondary" icon={Download} loading={exporting} onClick={runExport}>Export CSV</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} className="flex gap-2">
          <input className="h-9 w-56 rounded-md border border-line-strong px-3 text-sm" placeholder="RE26-000001 or title" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search listings" />
          <Button size="sm" variant="secondary" icon={Search} type="submit">Search</Button>
        </form>
      </div>
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No listings in this state."
        columns={[
          { key: 'title', header: 'Listing', render: (r) => <span><Link to={`/admin/approvals/${r._id}`} className="block max-w-sm truncate font-medium text-ink hover:text-brand-700">{r.title}</Link><span className="text-xs text-ink-subtle">{r.listingNo} · {[r.location?.locality, r.location?.city].filter(Boolean).join(', ')}</span></span> },
          { key: 'lister', header: 'Lister', render: (r) => r.listerId?.name || '-' },
          { key: 'price', header: 'Price', render: (r) => (priceOf(r) ? shortRupees(priceOf(r)) : '-') },
          { key: 'status', header: 'Status', render: (r) => { const s = listingStatus(r.status); return <span className="inline-flex items-center gap-1"><Badge tone={s.tone}>{s.label}</Badge>{r.featured?.on && <Star className="h-4 w-4 text-accent-600" aria-label="Featured" />}</span>; } },
          { key: 'expires', header: 'Expires', render: (r) => date(r.expiresAt) },
          { key: 'act', header: '', render: (r) => (
            <span className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" icon={History} onClick={() => setHistory(r)} aria-label={`History of ${r.listingNo}`}>History</Button>
              {ACTIONS[r.status] ? <Button size="sm" variant="secondary" onClick={() => setActive(r)}>Actions</Button> : null}
            </span>
          ) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {active && <ActionDialog listing={active} onClose={() => setActive(null)} />}
      {history && <HistoryDrawer listing={history} onClose={() => setHistory(null)} />}
      <p className="mt-3 text-xs text-ink-subtle">Export CSV downloads every listing in the current tab (no lister contact details).</p>
    </>
  );
}
