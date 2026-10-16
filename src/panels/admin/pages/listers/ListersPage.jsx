// RE-F-07/08 listers: search, KYC status filter, and per-lister detail with
// suspend / ban / reinstate (listers.manage), listing-limit override and the
// builder brand approval (RE-B-02, listers.verify or listers.manage).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, BadgeCheck, Flag, PauseCircle, PlayCircle, Search, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Modal, PageHeader, PageSpinner, Pagination, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { FLAG_RULES, kycStatus, useDecideBrand, useListerDetail, useListers, useManualFlag, useSetListerStatus, useSetListingLimit } from '@/modules/kyc/api';

const TABS = [{ value: '', label: 'All' }, { value: 'verified', label: 'Verified' }, { value: 'submitted', label: 'Submitted' }, { value: 'not_started', label: 'Not started' }, { value: 'suspended', label: 'Suspended' }, { value: 'banned', label: 'Banned' }];

function ListerList() {
  const navigate = useNavigate();
  const [kycStatusF, setKyc] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListers({ page, limit: 20, sort: '-createdAt', ...(kycStatusF ? { kycStatus: kycStatusF } : {}), ...(query ? { q: query } : {}) });
  return (
    <>
      <PageHeader title="Listers" description="Owners, builders and landlords. Suspending hides their listings; banning also blocklists their phone, email, PAN and documents." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={kycStatusF} onChange={(v) => { setKyc(v); setPage(1); }} tabs={TABS} />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} className="flex gap-2">
          <input className="h-9 w-56 rounded-md border border-line-strong px-3 text-sm" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search listers" />
          <Button size="sm" variant="secondary" icon={Search} type="submit">Search</Button>
        </form>
      </div>
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => navigate(`/admin/listers/${r._id}`)} empty="No listers found."
        columns={[
          { key: 'name', header: 'Lister', render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.email} · {r.phone}</span></span> },
          { key: 'type', header: 'Type', render: (r) => <span>{titleCase(r.listerType)}{r.brand?.name && <span className="block text-xs text-ink-subtle">{r.brand.name}</span>}{r.brand?.pending?.name && <Badge tone="warning" className="mt-0.5">Brand pending</Badge>}</span> },
          { key: 'kyc', header: 'KYC', render: (r) => { const s = kycStatus(r.kyc?.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          { key: 'limit', header: 'Limit override', render: (r) => (r.listingLimit != null ? r.listingLimit : '-') },
          { key: 'joined', header: 'Joined', render: (r) => date(r.createdAt) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

// RE-B-02: the brand shows publicly as "Verified Builder · <brand>" only once approved.
function BrandCard({ id, brand, canDecide }) {
  const toast = useToast();
  const decide = useDecideBrand();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const target = brand.pending || (brand.name && !brand.approved ? brand : null);
  const run = async (body, msg) => {
    try { await decide.mutateAsync({ id, body }); toast.success(msg); setRejecting(false); setReason(''); } catch (e) { toast.error(e.message); }
  };
  return (
    <Card className="lg:col-span-3">
      <CardHeader title="Builder brand" description={`Public badge: ${brand.publicLabel}`}
        action={target ? <Badge tone="warning">Awaiting approval</Badge> : brand.approved ? <Badge tone="success" icon={BadgeCheck}>Approved</Badge> : null} />
      <div className="flex flex-wrap items-start gap-6 text-sm">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded border object-contain" /> : null}
          <div><p className="text-ink-subtle">Current</p><p className="font-medium text-ink">{brand.name || 'None'}{brand.name && !brand.approved ? ' (not approved)' : ''}</p></div>
        </div>
        {brand.pending && (
          <div className="flex items-center gap-3">
            {brand.pending.logoUrl ? <img src={brand.pending.logoUrl} alt="" className="h-12 w-12 rounded border object-contain" /> : null}
            <div><p className="text-ink-subtle">Requested {date(brand.pending.requestedAt)}</p><p className="font-medium text-ink">{brand.pending.name}</p></div>
          </div>
        )}
        {brand.rejectReason && !target && <p className="text-ink-subtle">Last change rejected: {brand.rejectReason}</p>}
      </div>
      {target && canDecide && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          <Button size="sm" icon={BadgeCheck} loading={decide.isPending && !rejecting} onClick={() => run({ decision: 'approve' }, 'Brand approved')}>Approve "{target.name}"</Button>
          <Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting(true)}>Reject</Button>
        </div>
      )}
      <Modal open={rejecting} onClose={() => setRejecting(false)} size="sm" title="Reject brand change" description="The builder keeps the current brand and sees your reason."
        footer={<><Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={decide.isPending} onClick={() => run({ decision: 'reject', reason: reason.trim() }, 'Brand change rejected')}>Reject</Button></>}>
        <Textarea label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </Card>
  );
}

function ListerDetail({ id }) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data, isLoading, error } = useListerDetail(id);
  const setStatus = useSetListerStatus();
  const setLimit = useSetListingLimit();
  const flag = useManualFlag();
  const [dialog, setDialog] = useState(null);
  const [text, setText] = useState('');
  const [limit, setLimitVal] = useState('');
  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  const { user, kyc, listings, flags, listingLimit, brand } = data;
  const s = kycStatus(kyc.status);
  const manage = hasPermission('listers.manage');
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); setDialog(null); setText(''); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <Link to="/admin/listers" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Listers</Link>
      <PageHeader title={user.name} description={`${titleCase(user.listerType)} · ${user.email} · ${user.phone} · joined ${date(user.createdAt)}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {manage && kyc.status === 'verified' && <Button variant="secondary" icon={PauseCircle} onClick={() => setDialog('suspend')}>Suspend</Button>}
          {manage && kyc.status === 'suspended' && <Button variant="secondary" icon={PlayCircle} onClick={() => setDialog('reinstate')}>Reinstate</Button>}
          {manage && kyc.status !== 'banned' && <Button variant="danger" icon={Ban} onClick={() => setDialog('ban')}>Ban</Button>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Listings" />
          <ul className="space-y-1 text-sm">{(listings || []).length ? listings.map((l) => <li key={l._id} className="flex justify-between"><span>{titleCase(l._id)}</span><span className="font-semibold">{l.n}</span></li>) : <li className="text-ink-subtle">No listings</li>}</ul>
          <div className="mt-4 border-t pt-4 text-sm">
            <p className="text-ink-subtle">Active listing limit: <strong className="text-ink">{listingLimit == null ? 'Unlimited' : listingLimit}</strong></p>
            {manage && (
              <div className="mt-2 flex gap-2">
                <input className="h-9 w-24 rounded-md border border-line-strong px-2 text-sm" type="number" min={0} placeholder="New" value={limit} onChange={(e) => setLimitVal(e.target.value)} aria-label="Listing limit" />
                <Button size="sm" variant="secondary" disabled={limit === ''} onClick={() => act(() => setLimit.mutateAsync({ id, body: { listingLimit: Number(limit) } }), 'Limit updated')}>Set</Button>
                <Button size="sm" variant="ghost" onClick={() => act(() => setLimit.mutateAsync({ id, body: { listingLimit: null } }), 'Back to the default limit')}>Default</Button>
              </div>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Broker flags" action={manage ? <Button size="sm" variant="secondary" icon={Flag} onClick={() => setDialog('flag')}>Raise flag</Button> : null} />
          {(flags || []).length ? (
            <ul className="divide-y">{flags.map((f) => (
              <li key={f._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{f.flagNo}</strong> · {FLAG_RULES[f.rule] || f.rule}</span>
                <span className="flex items-center gap-2"><Badge tone={f.status === 'resolved' ? 'neutral' : 'warning'}>{f.status === 'resolved' ? titleCase(f.resolution) : titleCase(f.status)}</Badge><span className="text-xs text-ink-subtle">{dateTime(f.createdAt)}</span></span>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-ink-subtle">No flags.</p>}
          {kyc.autoChecks?.length > 0 && <Alert tone="warning" className="mt-4">KYC auto-checks: {kyc.autoChecks.map((c) => c.code).join(', ')}</Alert>}
        </Card>
        {brand && <BrandCard id={id} brand={brand} canDecide={manage || hasPermission('listers.verify')} />}
      </div>

      <Modal open={['suspend', 'ban', 'reinstate'].includes(dialog)} onClose={() => setDialog(null)} size="sm"
        title={{ suspend: 'Suspend lister', ban: 'Ban lister', reinstate: 'Reinstate lister' }[dialog]}
        description={{ suspend: 'All open listings are suspended until reinstated.', ban: 'Listings are suspended and their phone, email, PAN and documents are blocklisted. This cannot be undone here.', reinstate: 'Suspended listings return to their previous state.' }[dialog]}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant={dialog === 'reinstate' ? 'primary' : 'danger'} disabled={text.trim().length < 3} loading={setStatus.isPending}
          onClick={() => act(() => setStatus.mutateAsync({ id, body: { action: dialog, reason: text.trim() } }), { suspend: 'Lister suspended', ban: 'Lister banned', reinstate: 'Lister reinstated' }[dialog])}>Confirm</Button></>}>
        <Textarea label="Reason" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
      <Modal open={dialog === 'flag'} onClose={() => setDialog(null)} size="sm" title="Raise a broker flag" description="Opens a case in Trust and safety."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={text.trim().length < 5} loading={flag.isPending} onClick={() => act(() => flag.mutateAsync({ listerId: id, note: text.trim() }), 'Flag raised')}>Raise flag</Button></>}>
        <Textarea label="What did you notice?" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </>
  );
}

export default function ListersPage() {
  const { id } = useParams();
  return id ? <ListerDetail id={id} /> : <ListerList />;
}
