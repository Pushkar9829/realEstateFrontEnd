// RE-A-11/13/15/18 my listings: status tabs and the actions allowed in each
// status (continue, withdraw, pause / resume, renew, take off market,
// reactivate, duplicate, delete draft).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, BarChart3, CalendarClock, Camera, Copy, Eye, Home, MessageSquare, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, Trash2, Undo2, XCircle } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Pagination, Select, Skeleton, Tabs, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, shortRupees } from '@/shared/lib/format';
import { listingStatus, priceOf, useCreateDraft, useListingAction, useOwnListings } from '@/modules/listings/api';
import { PhotoVerificationModal, SiteVisitRequestModal } from '../../components/VerificationModal';

const TABS = [
  { value: '', label: 'All' }, { value: 'live', label: 'Live' }, { value: 'pending_approval', label: 'In review' }, { value: 'changes_requested', label: 'Needs changes' },
  { value: 'draft', label: 'Drafts' }, { value: 'paused', label: 'Paused' }, { value: 'expired,inactive', label: 'Expired / inactive' }, { value: 'sold,rented', label: 'Closed' },
];

const ACTIONS = {
  draft: [['edit', 'Continue editing', Pencil], ['delete', 'Delete draft', Trash2]],
  pending_approval: [['edit', 'View / correct', Pencil], ['withdraw', 'Withdraw from review', Undo2]],
  changes_requested: [['edit', 'Fix and resubmit', Pencil], ['delete', 'Delete', Trash2]],
  live: [['edit', 'Edit', Pencil], ['view', 'Status and history', Eye], ['pause', 'Pause', Pause], ['deactivate', 'Take off market', XCircle], ['duplicate', 'Duplicate', Copy]],
  paused: [['resume', 'Resume', Play], ['edit', 'Edit', Pencil], ['deactivate', 'Take off market', XCircle]],
  expired: [['renew', 'Renew', RotateCcw], ['duplicate', 'Duplicate', Copy]],
  inactive: [['reactivate', 'Send back to review', RotateCcw], ['duplicate', 'Duplicate', Copy]],
  rejected: [['duplicate', 'Duplicate', Copy]],
  sold: [['duplicate', 'Duplicate', Copy]],
  rented: [['duplicate', 'Duplicate', Copy]],
};

// Stats (RE-S-LIS-09) and verification entry points (RE-S-LIS-19, RE-D-13) added after the lifecycle actions.
const STATS_STATUSES = ['live', 'paused', 'expired', 'inactive', 'sold', 'rented'];
const PHOTO_STATUSES = ['live', 'pending_approval', 'paused'];
const extraActions = (status) => [
  ...(STATS_STATUSES.includes(status) ? [['stats', 'Stats', BarChart3]] : []),
  ...(PHOTO_STATUSES.includes(status) ? [['photo', 'Photo verification', Camera]] : []),
  ...(['live', 'paused'].includes(status) ? [['site', 'Request site visit', BadgeCheck]] : []),
];

function ActionMenu({ listing, onAction }) {
  const [open, setOpen] = useState(false);
  const items = [...(ACTIONS[listing.status] || []), ...extraActions(listing.status)];
  if (!items.length) return null;
  const [primary, ...rest] = items;
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="secondary" icon={primary[2]} onClick={() => onAction(primary[0], listing)}>{primary[1]}</Button>
      {rest.length > 0 && (
        <div className="relative">
          <Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label="More actions" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
              <div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-lg border bg-white py-1 shadow-lg">
                {rest.map(([key, label, Icon]) => (
                  <button key={key} role="menuitem" type="button" onClick={() => { setOpen(false); onAction(key, listing); }}
                    className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted', key === 'delete' ? 'text-danger-700' : 'text-ink')}>
                    <Icon className="h-4 w-4" />{label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ListingCard({ l, onAction }) {
  const s = listingStatus(l.status);
  const photos = (l.media && l.media.photos) || [];
  const cover = photos.find((p) => p.isCover) || photos[0];
  const price = priceOf(l);
  return (
    <li className="flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm sm:flex-row">
      <Link to={l.status === 'draft' ? `/lister/listings/${l._id}/edit` : `/lister/listings/${l._id}`} aria-label={l.title || 'Untitled draft'} tabIndex={-1} className="block h-28 w-full shrink-0 overflow-hidden rounded-md bg-surface-sunken sm:w-40">
        {cover ? <img src={cover.thumbUrl || cover.url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-ink-subtle"><Home className="h-8 w-8" /></div>}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          <span className="text-xs text-ink-subtle">{l.listingNo}</span>
          {l.pendingRevision && l.pendingRevision.submittedAt && <Badge tone="info">Changes in review</Badge>}
          {l.pause && l.status === 'paused' && l.pause.reason === 'no_reply' && <Badge tone="warning">Paused: no reply to check</Badge>}
        </div>
        <Link to={l.status === 'draft' ? `/lister/listings/${l._id}/edit` : `/lister/listings/${l._id}`} className="mt-1 block truncate text-base font-semibold text-ink hover:text-brand-700">{l.title || 'Untitled draft'}</Link>
        <p className="truncate text-sm text-ink-subtle">{[l.location?.locality, l.location?.city].filter(Boolean).join(', ') || 'Location not added'} · {l.purpose === 'rent' ? 'For rent' : 'For sale'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-muted">
          <span className="font-semibold text-ink">{price ? `${shortRupees(price)}${l.purpose === 'rent' ? '/mo' : ''}` : 'Price not set'}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{l.stats?.views || 0}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{l.stats?.enquiries || 0}</span>
          {l.status === 'draft' && <span>{l.wizard?.completeness || 0}% complete</span>}
          {l.expiresAt && ['live', 'paused'].includes(l.status) && <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" />expires {date(l.expiresAt)}</span>}
        </div>
      </div>
      <div className="flex items-start sm:justify-end"><ActionMenu listing={l} onAction={onAction} /></div>
    </li>
  );
}

export default function MyListingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOwnListings({ page, limit: 10, sort: '-updatedAt', ...(status ? { status } : {}) });
  const create = useCreateDraft();
  const action = useListingAction();
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});

  const newListing = async () => {
    try { const d = await create.mutateAsync(); navigate(`/lister/listings/${d._id}/edit?step=1`); } catch (e) { toast.error(e.message); }
  };
  const run = async (id, act, body, msg) => {
    try { const r = await action.mutateAsync({ id, action: act, body }); toast.success(msg); setDialog(null); return r; } catch (e) { toast.error(e.message); return null; }
  };
  const onAction = async (key, l) => {
    if (key === 'stats') { navigate(`/lister/listings/${l._id}/stats`); return; }
    if (key === 'view') { navigate(`/lister/listings/${l._id}`); return; }
    if (key === 'photo' || key === 'site') { setDialog({ key, l }); return; }
    if (key === 'edit') { navigate(`/lister/listings/${l._id}/edit?step=${l.status === 'changes_requested' ? 8 : 1}`); return; }
    if (['pause', 'deactivate', 'delete'].includes(key)) { setForm(key === 'deactivate' ? { reason: l.purpose === 'rent' ? 'rented_outside' : 'sold_outside' } : {}); setDialog({ key, l }); return; }
    const msgs = { withdraw: 'Withdrawn from review', resume: 'Listing is live again', renew: 'Listing renewed', reactivate: 'Sent back to review', duplicate: 'Copied to a new draft' };
    const r = await run(l._id, key, {}, msgs[key]);
    if (key === 'duplicate' && r && r._id) navigate(`/lister/listings/${r._id}/edit?step=1`);
  };

  const rows = (data && data.items) || [];
  return (
    <>
      <PageHeader title="My listings" description="Listings go live after verification and a quick review. Live listings expire after 90 days (sale) or 60 days (rent) unless renewed."
        actions={<Button icon={Plus} loading={create.isPending} onClick={newListing}>Post a property</Button>} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Home} title={status ? 'Nothing in this tab' : 'No listings yet'} description="Post your first property. It takes about 10 minutes."
          action={<Button icon={Plus} onClick={newListing}>Post a property</Button>} />
      ) : (
        <ul className="space-y-3">{rows.map((l) => <ListingCard key={l._id} l={l} onAction={onAction} />)}</ul>
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}

      <Modal open={dialog && dialog.key === 'pause'} onClose={() => setDialog(null)} title="Pause listing" size="sm" description="Paused listings are hidden from buyers. Resume any time."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button loading={action.isPending} disabled={!form.reason || form.reason.length < 3} onClick={() => run(dialog.l._id, 'pause', { reason: form.reason }, 'Listing paused')}>Pause</Button></>}>
        <Input label="Reason" placeholder="e.g. Tenant moving out next month" value={form.reason || ''} onChange={(e) => setForm({ reason: e.target.value })} />
      </Modal>

      <Modal open={dialog && dialog.key === 'deactivate'} onClose={() => setDialog(null)} title="Take off market" description="Tell us why. If it was sold or rented, our team follows up on the commission agreement."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" loading={action.isPending}
          onClick={() => run(dialog.l._id, 'deactivate', { reason: form.reason, ...(form.note ? { note: form.note } : {}), ...(form.saleDate ? { saleDate: form.saleDate } : {}), ...(form.price ? { price: Number(form.price) } : {}) }, 'Listing taken off the market')}>Take off market</Button></>}>
        <div className="space-y-4">
          <Select label="Reason" value={form.reason || ''} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            options={[{ value: 'sold_outside', label: 'Sold outside the platform' }, { value: 'rented_outside', label: 'Rented outside the platform' }, { value: 'no_longer_available', label: 'No longer available' }, { value: 'other', label: 'Other' }]} />
          {['sold_outside', 'rented_outside'].includes(form.reason) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={form.reason === 'rented_outside' ? 'Move-in date' : 'Sale date'} type="date" required value={form.saleDate || ''} onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))} />
              <Input label="Price (optional)" leading="₹" type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
          )}
          <Textarea label="Note" rows={2} value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
      </Modal>

      {dialog && dialog.key === 'photo' && <PhotoVerificationModal open listing={dialog.l} onClose={() => setDialog(null)} />}
      {dialog && dialog.key === 'site' && <SiteVisitRequestModal open listing={dialog.l} onClose={() => setDialog(null)} />}

      <Modal open={dialog && dialog.key === 'delete'} onClose={() => setDialog(null)} title="Delete listing?" size="sm" description="The draft and its uploads are removed. This cannot be undone."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" loading={action.isPending} onClick={() => run(dialog.l._id, 'delete', null, 'Draft deleted')}>Delete</Button></>}>
        <p className="text-sm text-ink-muted">{dialog && dialog.l.title ? `"${dialog.l.title}"` : 'This draft'} will be deleted.</p>
      </Modal>
    </>
  );
}
