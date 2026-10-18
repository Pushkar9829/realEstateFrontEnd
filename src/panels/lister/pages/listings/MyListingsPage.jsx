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
import { useT } from '@/shared/i18n';

// Tab and action labels are dictionary keys under lister.listings.tabs / .actions.
const TABS = [
  { value: '', key: 'all' }, { value: 'live', key: 'live' }, { value: 'pending_approval', key: 'review' }, { value: 'changes_requested', key: 'changes' },
  { value: 'draft', key: 'drafts' }, { value: 'paused', key: 'paused' }, { value: 'expired,inactive', key: 'expired' }, { value: 'sold,rented', key: 'closed' },
];

const ACTIONS = {
  draft: [['edit', 'continue', Pencil], ['delete', 'deleteDraft', Trash2]],
  pending_approval: [['edit', 'viewCorrect', Pencil], ['withdraw', 'withdraw', Undo2]],
  changes_requested: [['edit', 'fix', Pencil], ['delete', 'delete', Trash2]],
  live: [['edit', 'edit', Pencil], ['view', 'view', Eye], ['pause', 'pause', Pause], ['deactivate', 'deactivate', XCircle], ['duplicate', 'duplicate', Copy]],
  paused: [['resume', 'resume', Play], ['edit', 'edit', Pencil], ['deactivate', 'deactivate', XCircle]],
  expired: [['renew', 'renew', RotateCcw], ['duplicate', 'duplicate', Copy]],
  inactive: [['reactivate', 'reactivate', RotateCcw], ['duplicate', 'duplicate', Copy]],
  rejected: [['duplicate', 'duplicate', Copy]],
  sold: [['duplicate', 'duplicate', Copy]],
  rented: [['duplicate', 'duplicate', Copy]],
};

// Stats (RE-S-LIS-09) and verification entry points (RE-S-LIS-19, RE-D-13) added after the lifecycle actions.
const STATS_STATUSES = ['live', 'paused', 'expired', 'inactive', 'sold', 'rented'];
const PHOTO_STATUSES = ['live', 'pending_approval', 'paused'];
const extraActions = (status) => [
  ...(STATS_STATUSES.includes(status) ? [['stats', 'stats', BarChart3]] : []),
  ...(PHOTO_STATUSES.includes(status) ? [['photo', 'photo', Camera]] : []),
  ...(['live', 'paused'].includes(status) ? [['site', 'site', BadgeCheck]] : []),
];

// Actions that only open another screen are real links (new tab, discoverable).
const LINK_ACTIONS = {
  stats: (l) => `/lister/listings/${l._id}/stats`,
  view: (l) => `/lister/listings/${l._id}`,
};

function ActionMenu({ listing, onAction }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const items = [...(ACTIONS[listing.status] || []), ...extraActions(listing.status)];
  if (!items.length) return null;
  const [primary, ...rest] = items;
  return (
    <div className="flex items-center gap-1">
      {LINK_ACTIONS[primary[0]]
        ? <Button size="sm" variant="secondary" icon={primary[2]} to={LINK_ACTIONS[primary[0]](listing)}>{t(`lister.listings.actions.${primary[1]}`)}</Button>
        : <Button size="sm" variant="secondary" icon={primary[2]} onClick={() => onAction(primary[0], listing)}>{t(`lister.listings.actions.${primary[1]}`)}</Button>}
      {rest.length > 0 && (
        <div className="relative">
          <Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={t('lister.listings.moreActions')} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
              <div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-lg border bg-white py-1 shadow-lg">
                {rest.map(([key, label, Icon]) => (LINK_ACTIONS[key] ? (
                  <Link key={key} role="menuitem" to={LINK_ACTIONS[key](listing)} onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted">
                    <Icon className="h-4 w-4" aria-hidden />{t(`lister.listings.actions.${label}`)}
                  </Link>
                ) : (
                  <button key={key} role="menuitem" type="button" onClick={() => { setOpen(false); onAction(key, listing); }}
                    className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted', key === 'delete' ? 'text-danger-700' : 'text-ink')}>
                    <Icon className="h-4 w-4" aria-hidden />{t(`lister.listings.actions.${label}`)}
                  </button>
                )))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ListingCard({ l, onAction }) {
  const t = useT();
  const s = listingStatus(l.status);
  const photos = (l.media && l.media.photos) || [];
  const cover = photos.find((p) => p.isCover) || photos[0];
  const price = priceOf(l);
  return (
    <li className="flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm sm:flex-row">
      <Link to={l.status === 'draft' ? `/lister/listings/${l._id}/edit` : `/lister/listings/${l._id}`} aria-label={l.title || t('lister.listings.untitled')} tabIndex={-1} className="block h-28 w-full shrink-0 overflow-hidden rounded-md bg-surface-sunken sm:w-40">
        {cover ? <img src={cover.thumbUrl || cover.url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-ink-subtle"><Home className="h-8 w-8" /></div>}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          <span className="text-xs text-ink-subtle">{l.listingNo}</span>
          {l.pendingRevision && l.pendingRevision.submittedAt && <Badge tone="info">{t('lister.listings.changesInReview')}</Badge>}
          {l.pause && l.status === 'paused' && l.pause.reason === 'no_reply' && <Badge tone="warning">{t('lister.listings.pausedNoReply')}</Badge>}
        </div>
        <Link to={l.status === 'draft' ? `/lister/listings/${l._id}/edit` : `/lister/listings/${l._id}`} className="mt-1 block truncate text-base font-semibold text-ink hover:text-brand-700">{l.title || t('lister.listings.untitled')}</Link>
        <p className="truncate text-sm text-ink-subtle">{[l.location?.locality, l.location?.city].filter(Boolean).join(', ') || t('lister.listings.noLocation')} · {l.purpose === 'rent' ? t('lister.listings.forRent') : t('lister.listings.forSale')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-muted">
          <span className="font-semibold text-ink">{price ? `${shortRupees(price)}${l.purpose === 'rent' ? t('lister.common.perMonth') : ''}` : t('lister.listings.noPrice')}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{l.stats?.views || 0}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{l.stats?.enquiries || 0}</span>
          {STATS_STATUSES.includes(l.status) && <Link to={LINK_ACTIONS.stats(l)} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><BarChart3 className="h-4 w-4" aria-hidden />{t('lister.listings.actions.stats')}</Link>}
          {l.status === 'draft' && <span>{t('lister.listings.complete', { pct: l.wizard?.completeness || 0 })}</span>}
          {l.expiresAt && ['live', 'paused'].includes(l.status) && <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" />{t('lister.listings.expires', { date: date(l.expiresAt) })}</span>}
        </div>
      </div>
      <div className="flex items-start sm:justify-end"><ActionMenu listing={l} onAction={onAction} /></div>
    </li>
  );
}

export default function MyListingsPage() {
  const t = useT();
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
    const r = await run(l._id, key, {}, t(`lister.listings.done.${key}`));
    if (key === 'duplicate' && r && r._id) navigate(`/lister/listings/${r._id}/edit?step=1`);
  };

  const rows = (data && data.items) || [];
  return (
    <>
      <PageHeader title={t('panel.nav.listerListings')} description={t('lister.listings.desc')}
        actions={<Button icon={Plus} loading={create.isPending} onClick={newListing}>{t('lister.common.postProperty')}</Button>} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map(({ key, ...tab }) => ({ ...tab, label: t(`lister.listings.tabs.${key}`), ...(tab.value === status && data ? { count: data.meta.total } : {}) }))} />
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Home} title={status ? t('lister.listings.emptyTab') : t('lister.dashboard.noListings')} description={t('lister.listings.emptyDesc')}
          action={<Button icon={Plus} onClick={newListing}>{t('lister.common.postProperty')}</Button>} />
      ) : (
        <ul className="space-y-3">{rows.map((l) => <ListingCard key={l._id} l={l} onAction={onAction} />)}</ul>
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}

      <Modal open={dialog && dialog.key === 'pause'} onClose={() => setDialog(null)} title={t('lister.listings.pauseTitle')} size="sm" description={t('lister.listings.pauseDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button loading={action.isPending} disabled={!form.reason || form.reason.length < 3} onClick={() => run(dialog.l._id, 'pause', { reason: form.reason }, t('lister.listings.done.pause'))}>{t('lister.listings.actions.pause')}</Button></>}>
        <Input label={t('lister.listings.reason')} placeholder={t('lister.listings.pausePh')} value={form.reason || ''} onChange={(e) => setForm({ reason: e.target.value })} />
      </Modal>

      <Modal open={dialog && dialog.key === 'deactivate'} onClose={() => setDialog(null)} title={t('lister.listings.actions.deactivate')} description={t('lister.listings.deactivateDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={action.isPending}
          onClick={() => run(dialog.l._id, 'deactivate', { reason: form.reason, ...(form.note ? { note: form.note } : {}), ...(form.saleDate ? { saleDate: form.saleDate } : {}), ...(form.price ? { price: Number(form.price) } : {}) }, t('lister.listings.done.deactivate'))}>{t('lister.listings.actions.deactivate')}</Button></>}>
        <div className="space-y-4">
          <Select label={t('lister.listings.reason')} value={form.reason || ''} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            options={['sold_outside', 'rented_outside', 'no_longer_available', 'other'].map((value) => ({ value, label: t(`lister.listings.offReasons.${value}`) }))} />
          {['sold_outside', 'rented_outside'].includes(form.reason) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={form.reason === 'rented_outside' ? t('lister.listings.moveIn') : t('lister.listings.saleDate')} type="date" required value={form.saleDate || ''} onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))} />
              <Input label={t('lister.listings.priceOptional')} leading="₹" type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
          )}
          <Textarea label={t('lister.listings.note')} rows={2} value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
      </Modal>

      {dialog && dialog.key === 'photo' && <PhotoVerificationModal open listing={dialog.l} onClose={() => setDialog(null)} />}
      {dialog && dialog.key === 'site' && <SiteVisitRequestModal open listing={dialog.l} onClose={() => setDialog(null)} />}

      <Modal open={dialog && dialog.key === 'delete'} onClose={() => setDialog(null)} title={t('lister.listings.deleteTitle')} size="sm" description={t('lister.listings.deleteDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={action.isPending} onClick={() => run(dialog.l._id, 'delete', null, t('lister.listings.done.delete'))}>{t('lister.listings.actions.delete')}</Button></>}>
        <p className="text-sm text-ink-muted">{dialog && dialog.l.title ? t('lister.listings.willDelete', { name: `"${dialog.l.title}"` }) : t('lister.listings.willDeleteDraft')}</p>
      </Modal>
    </>
  );
}
