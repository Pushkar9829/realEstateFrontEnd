// RE-S-AGT-12 My deals: status tabs and the deal table with commission and
// admin comments. Verified, rejected and cancelled deals are read-only.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { Badge, EmptyState, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { date, rupees } from '@/shared/lib/format';
import { dealStatus, useAgentDeals } from '@/modules/deals/agentApi';
import { ErrorState } from '../../components/common';

const TABS = [
  { value: '', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'submitted,under_review', label: 'Submitted' }, { value: 'returned', label: 'Returned' },
  { value: 'verified', label: 'Verified' }, { value: 'rejected,reversed', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' },
];

export default function DealsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useAgentDeals({ page, limit: 20, sort: '-updatedAt', ...(status ? { status } : {}) });
  const rows = (data && data.items) || [];
  return (
    <>
      <PageHeader title="My deals" description="Record the negotiated deal with receipts and submit it for verification. Commission is computed by the server." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      {error ? <ErrorState error={error} onRetry={refetch} title="Could not load deals" /> : !isLoading && !rows.length ? (
        <EmptyState icon={Handshake} title="Deals appear when a lead reaches booking" description="Open a lead in negotiation and choose Create deal, or accept an offer and create the deal from it." />
      ) : (
        <Table loading={isLoading} rows={rows} onRowClick={(r) => navigate(`/agent/deals/${r._id}`)} empty="No deals in this tab"
          columns={[
            { key: 'deal', header: 'Deal', render: (r) => <span><span className="block font-medium text-ink">{r.dealNo}</span><span className="text-xs text-ink-subtle">{r.leadId ? r.leadId.leadNo : ''} · {r.dealType === 'rent' ? 'Rent' : 'Sale'}</span></span> },
            { key: 'prop', header: 'Property', render: (r) => <span className="block max-w-[14rem] truncate text-sm">{r.propertyId ? `${r.propertyId.listingNo} · ${r.propertyId.title}` : r.projectId ? `${r.projectId.projectNo} · ${r.projectId.name}` : '-'}</span> },
            { key: 'price', header: 'Agreed', render: (r) => <span className="whitespace-nowrap">{rupees(r.dealType === 'rent' ? r.monthlyRent : r.agreedPrice)}{r.dealType === 'rent' ? '/mo' : ''}</span> },
            { key: 'booking', header: 'Booking', render: (r) => <span className="whitespace-nowrap">{rupees(r.bookingAmount)}</span> },
            { key: 'comm', header: 'Commission', render: (r) => <span className="whitespace-nowrap">{r.commissionPercent != null ? `${r.commissionPercent}% · ` : ''}{rupees(r.commissionAmount)}</span> },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={dealStatus(r.status).tone}>{dealStatus(r.status).label}</Badge> },
            { key: 'sub', header: 'Submitted', render: (r) => <span className="whitespace-nowrap text-xs">{date(r.submittedAt)}</span> },
            { key: 'comment', header: 'Admin comment', render: (r) => <span className="block max-w-[16rem] truncate text-xs text-ink-muted">{(r.review && (r.review.comment || r.review.rejectReason)) || r.cancelReason || '-'}</span> },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
