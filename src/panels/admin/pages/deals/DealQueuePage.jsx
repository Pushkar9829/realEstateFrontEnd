// RE-S-ADM-18 deal verification queue (deals.verify; managers read-only for
// their teams): tabs by status, SLA due / breached against deal.verifySlaHours,
// claim straight from the row, open -> RE-S-ADM-19.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, Search } from 'lucide-react';
import { Badge, Button, Input, PageHeader, Pagination, Table, Tabs, useToast } from '@/shared/ui';
import { dateTime, rupees, timeAgo } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { claimDeal, dealStatus, useDealQueue } from '@/modules/deals/adminApi';

const TABS = [
  { value: 'waiting', label: 'Submitted', status: 'submitted,under_review' },
  { value: 'mine', label: 'Claimed by me', status: 'under_review' },
  { value: 'returned', label: 'Returned', status: 'returned' },
  { value: 'verified', label: 'Verified', status: 'verified' },
  { value: 'rejected', label: 'Rejected', status: 'rejected' },
  { value: 'reversed', label: 'Reversed', status: 'reversed' },
];

function Sla({ d }) {
  if (!['submitted', 'under_review'].includes(d.status) || !d.slaDueAt) return <span className="text-xs text-ink-subtle">-</span>;
  if (d.slaBreached) return <Badge tone="danger" icon={AlertTriangle}>Breached</Badge>;
  const hoursLeft = (new Date(d.slaDueAt) - Date.now()) / 3600000;
  return <Badge tone={hoursLeft < 12 ? 'warning' : 'success'} className="whitespace-nowrap">{hoursLeft < 12 ? 'Due soon' : 'On time'}</Badge>;
}

export default function DealQueuePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasPermission } = useAuth();
  const canVerify = hasPermission('deals.verify');
  const [tab, setTab] = useState('waiting');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [claiming, setClaiming] = useState(null);
  const status = TABS.find((t) => t.value === tab).status;
  const params = { page, limit: 20, status, ...(q.trim() ? { q: q.trim() } : {}), ...(tab === 'waiting' || tab === 'mine' ? {} : { sort: '-updatedAt' }) };
  const { data, isLoading, error, refetch } = useDealQueue(params);
  let rows = (data && data.items) || [];
  // The API has no claimedBy filter; "Claimed by me" narrows the current page.
  if (tab === 'mine') rows = rows.filter((d) => d.review && String(d.review.claimedBy) === String(user._id));

  const claim = async (e, d) => {
    e.stopPropagation();
    setClaiming(d._id);
    try {
      await claimDeal(d._id);
      toast.success(`${d.dealNo} claimed for 30 minutes`);
      navigate(`/admin/deals/${d._id}`);
    } catch (err) {
      toast.error(err.message);
      refetch();
    } finally { setClaiming(null); }
  };

  const target = (d) => (d.propertyId ? `${d.propertyId.listingNo} ${d.propertyId.title || ''}` : d.projectId ? `${d.projectId.projectNo} ${d.projectId.name || ''}` : '-');

  return (
    <>
      <PageHeader title="Deal verification" description={`Check receipts, the agreement and the commission, then verify within the SLA. Claiming locks a deal for 30 minutes.${canVerify ? '' : ' You have read-only access.'}`} />
      <Tabs className="mb-4" value={tab} onChange={(v) => { setTab(v); setPage(1); }}
        tabs={TABS.map((t) => (t.value === tab && data ? { ...t, count: tab === 'mine' ? rows.length : data.meta.total } : t))} />
      <div className="mb-4 max-w-xs">
        <Input aria-label="Search deal number" placeholder="Search deal no." leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {error && <p className="mb-3 text-sm text-danger-700">{error.message}</p>}
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/deals/${r._id}`} empty={tab === 'waiting' ? 'No deals awaiting verification' : 'No deals here'}
        columns={[
          { key: 'dealNo', header: 'Deal', render: (r) => <span><span className="block font-medium text-ink">{r.dealNo}</span><span className="text-xs text-ink-subtle">{r.leadId ? r.leadId.leadNo : ''}{r.resubmissionCount ? ` · resubmitted ×${r.resubmissionCount}` : ''}</span></span> },
          { key: 'property', header: 'Property', render: (r) => <span className="block max-w-[14rem] truncate" title={target(r)}>{target(r)}</span> },
          { key: 'agent', header: 'Agent', render: (r) => (r.agentId ? r.agentId.name : '-') },
          { key: 'price', header: 'Agreed', render: (r) => <span className="whitespace-nowrap">{r.dealType === 'rent' ? `${rupees(r.monthlyRent)} / mo` : rupees(r.agreedPrice)}</span> },
          { key: 'booking', header: 'Booking', render: (r) => <span className="whitespace-nowrap">{rupees(r.bookingAmount)}{r.paymentMode === 'cash' && <Badge tone="warning" className="ml-1">Cash</Badge>}</span> },
          { key: 'commission', header: 'Commission', render: (r) => <span className="whitespace-nowrap">{rupees(r.commissionAmount)}</span> },
          { key: 'submittedAt', header: 'Submitted', render: (r) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={dateTime(r.submittedAt)}>{timeAgo(r.submittedAt)}{r.review?.claimedBy && new Date(r.review.claimUntil) > new Date() && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label="Claimed" />}</span> },
          { key: 'sla', header: 'SLA', render: (r) => <span title={r.slaDueAt ? `Due ${dateTime(r.slaDueAt)}` : ''}><Sla d={r} /></span> },
          { key: 'status', header: 'Status', render: (r) => { const s = dealStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          ...(canVerify ? [{ key: 'claim', header: '', render: (r) => {
            const lockedByOther = r.status === 'under_review' && r.review?.claimedBy && String(r.review.claimedBy) !== String(user._id) && new Date(r.review.claimUntil) > new Date();
            return ['submitted', 'under_review'].includes(r.status) && !lockedByOther
              ? <Button size="sm" variant="secondary" icon={Lock} loading={claiming === r._id} onClick={(e) => claim(e, r)}>{r.status === 'under_review' ? 'Open' : 'Claim'}</Button>
              : null;
          } }] : []),
        ]} />
      {data && tab !== 'mine' && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
