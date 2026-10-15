// RE-D-11/12 all listings (properties.manage): filter by status and search,
// then feature, extend, pause, resume, suspend or deactivate.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { Badge, Button, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, shortRupees } from '@/shared/lib/format';
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

export default function AllListingsPage() {
  const [status, setStatus] = useState('live');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);
  const { data, isLoading } = useReviewQueue({ page, limit: 20, status, sort: '-updatedAt', ...(query ? { q: query } : {}) });
  return (
    <>
      <PageHeader title="All listings" description="Search by listing number or title. Every admin action is audited." />
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
          { key: 'act', header: '', render: (r) => (ACTIONS[r.status] ? <Button size="sm" variant="secondary" onClick={() => setActive(r)}>Actions</Button> : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {active && <ActionDialog listing={active} onClose={() => setActive(null)} />}
    </>
  );
}
