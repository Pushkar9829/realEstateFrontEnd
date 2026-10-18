// RE-S-ADM-18 deal verification queue (deals.verify; managers read-only for
// their teams): tabs by status, SLA due / breached against deal.verifySlaHours,
// claim straight from the row, open -> RE-S-ADM-19.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, Search } from 'lucide-react';
import { Badge, Button, Input, PageHeader, Pagination, Table, Tabs, useToast } from '@/shared/ui';
import { dateTime, rupees, timeAgo } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { claimDeal, dealStatus, useDealQueue } from '@/modules/deals/adminApi';

const TABS = (t) => [
  { value: 'waiting', label: t('admin.deals.queue.tabs.waiting'), status: 'submitted,under_review' },
  { value: 'mine', label: t('admin.deals.queue.tabs.mine'), status: 'under_review' },
  { value: 'returned', label: t('admin.deals.queue.tabs.returned'), status: 'returned' },
  { value: 'verified', label: t('admin.deals.queue.tabs.verified'), status: 'verified' },
  { value: 'rejected', label: t('admin.deals.queue.tabs.rejected'), status: 'rejected' },
  { value: 'reversed', label: t('admin.deals.queue.tabs.reversed'), status: 'reversed' },
];

function Sla({ d }) {
  const t = useT();
  if (!['submitted', 'under_review'].includes(d.status) || !d.slaDueAt) return <span className="text-xs text-ink-subtle">-</span>;
  if (d.slaBreached) return <Badge tone="danger" icon={AlertTriangle}>{t('admin.deals.queue.sla.breached')}</Badge>;
  const hoursLeft = (new Date(d.slaDueAt) - Date.now()) / 3600000;
  return <Badge tone={hoursLeft < 12 ? 'warning' : 'success'} className="whitespace-nowrap">{hoursLeft < 12 ? t('admin.deals.queue.sla.dueSoon') : t('admin.deals.queue.sla.onTime')}</Badge>;
}

export default function DealQueuePage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasPermission } = useAuth();
  const canVerify = hasPermission('deals.verify');
  const [tab, setTab] = useState('waiting');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [claiming, setClaiming] = useState(null);
  const tabs = TABS(t);
  const status = tabs.find((x) => x.value === tab).status;
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
      toast.success(t('admin.deals.queue.claimed', { no: d.dealNo }));
      navigate(`/admin/deals/${d._id}`);
    } catch (err) {
      toast.error(err.message);
      refetch();
    } finally { setClaiming(null); }
  };

  const target = (d) => (d.propertyId ? `${d.propertyId.listingNo} ${d.propertyId.title || ''}` : d.projectId ? `${d.projectId.projectNo} ${d.projectId.name || ''}` : '-');

  return (
    <>
      <PageHeader title={t('admin.deals.queue.title')} description={`${t('admin.deals.queue.description')}${canVerify ? '' : t('admin.deals.queue.readOnly')}`} />
      <Tabs className="mb-4" value={tab} onChange={(v) => { setTab(v); setPage(1); }}
        tabs={tabs.map((x) => (x.value === tab && data ? { ...x, count: tab === 'mine' ? rows.length : data.meta.total } : x))} />
      <div className="mb-4 max-w-xs">
        <Input aria-label={t('admin.deals.queue.searchLabel')} placeholder={t('admin.deals.queue.searchPlaceholder')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {error && <p className="mb-3 text-sm text-danger-700">{error.message}</p>}
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/deals/${r._id}`} empty={tab === 'waiting' ? t('admin.deals.queue.emptyWaiting') : t('admin.deals.queue.empty')}
        columns={[
          { key: 'dealNo', header: t('admin.deals.queue.col.deal'), render: (r) => <span><span className="block font-medium text-ink">{r.dealNo}</span><span className="text-xs text-ink-subtle">{r.leadId ? r.leadId.leadNo : ''}{r.resubmissionCount ? t('admin.deals.queue.resubmitted', { n: r.resubmissionCount }) : ''}</span></span> },
          { key: 'property', header: t('admin.deals.queue.col.property'), render: (r) => <span className="block max-w-[14rem] truncate" title={target(r)}>{target(r)}</span> },
          { key: 'agent', header: t('admin.deals.queue.col.agent'), render: (r) => (r.agentId ? r.agentId.name : '-') },
          { key: 'price', header: t('admin.deals.queue.col.agreed'), render: (r) => <span className="whitespace-nowrap">{r.dealType === 'rent' ? t('admin.deals.queue.perMonth', { amount: rupees(r.monthlyRent) }) : rupees(r.agreedPrice)}</span> },
          { key: 'booking', header: t('admin.deals.queue.col.booking'), render: (r) => <span className="whitespace-nowrap">{rupees(r.bookingAmount)}{r.paymentMode === 'cash' && <Badge tone="warning" className="ml-1">{t('admin.deals.queue.cash')}</Badge>}</span> },
          { key: 'commission', header: t('admin.deals.queue.col.commission'), render: (r) => <span className="whitespace-nowrap">{rupees(r.commissionAmount)}</span> },
          { key: 'submittedAt', header: t('admin.deals.queue.col.submitted'), render: (r) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={dateTime(r.submittedAt)}>{timeAgo(r.submittedAt)}{r.review?.claimedBy && new Date(r.review.claimUntil) > new Date() && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label={t('admin.deals.queue.claimedLock')} />}</span> },
          { key: 'sla', header: t('admin.deals.queue.col.sla'), render: (r) => <span title={r.slaDueAt ? t('admin.deals.queue.dueAt', { date: dateTime(r.slaDueAt) }) : ''}><Sla d={r} /></span> },
          { key: 'status', header: t('admin.deals.queue.col.status'), render: (r) => { const s = dealStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          ...(canVerify ? [{ key: 'claim', header: '', render: (r) => {
            const lockedByOther = r.status === 'under_review' && r.review?.claimedBy && String(r.review.claimedBy) !== String(user._id) && new Date(r.review.claimUntil) > new Date();
            return ['submitted', 'under_review'].includes(r.status) && !lockedByOther
              ? <Button size="sm" variant="secondary" icon={Lock} loading={claiming === r._id} onClick={(e) => claim(e, r)}>{r.status === 'under_review' ? t('admin.deals.queue.open') : t('admin.deals.queue.claim')}</Button>
              : null;
          } }] : []),
        ]} />
      {data && tab !== 'mine' && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
