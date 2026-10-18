// RE-S-AGT-12 My deals: status tabs and the deal table with commission and
// admin comments. Verified, rejected and cancelled deals are read-only.
import { useState } from 'react';
import { Handshake } from 'lucide-react';
import { Badge, EmptyState, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { date, rupees } from '@/shared/lib/format';
import { dealStatus, useAgentDeals } from '@/modules/deals/agentApi';
import { useT } from '@/shared/i18n';
import { ErrorState } from '../../components/common';

// [value, label key under agent.deals.tab]
const TABS = [['', 'all'], ['draft', 'draft'], ['submitted,under_review', 'submitted'], ['returned', 'returned'], ['verified', 'verified'], ['rejected,reversed', 'rejected'], ['cancelled', 'cancelled']];

export default function DealsPage() {
  const t = useT();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useAgentDeals({ page, limit: 20, sort: '-updatedAt', ...(status ? { status } : {}) });
  const rows = (data && data.items) || [];
  return (
    <>
      <PageHeader title={t('panel.nav.agentDeals')} description={t('agent.deals.desc')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map(([value, k]) => { const tab = { value, label: t(`agent.deals.tab.${k}`) }; return value === status && data ? { ...tab, count: data.meta.total } : tab; })} />
      {error ? <ErrorState error={error} onRetry={refetch} title={t('agent.deals.loadError')} /> : !isLoading && !rows.length ? (
        <EmptyState icon={Handshake} title={t('agent.deals.emptyTitle')} description={t('agent.deals.emptyDesc')} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/agent/deals/${r._id}`} empty={t('agent.deals.emptyTab')}
          columns={[
            { key: 'deal', header: t('agent.lead.deal'), render: (r) => <span><span className="block font-medium text-ink">{r.dealNo}</span><span className="text-xs text-ink-subtle">{r.leadId ? r.leadId.leadNo : ''} · {r.dealType === 'rent' ? t('common.rent') : t('common.sale')}</span></span> },
            { key: 'prop', header: t('agent.common.property'), render: (r) => <span className="block max-w-[14rem] truncate text-sm">{r.propertyId ? `${r.propertyId.listingNo} · ${r.propertyId.title}` : r.projectId ? `${r.projectId.projectNo} · ${r.projectId.name}` : '-'}</span> },
            { key: 'price', header: t('agent.deals.agreed'), render: (r) => <span className="whitespace-nowrap">{rupees(r.dealType === 'rent' ? r.monthlyRent : r.agreedPrice)}{r.dealType === 'rent' ? t('agent.common.perMonth') : ''}</span> },
            { key: 'booking', header: t('agent.stage.booking'), render: (r) => <span className="whitespace-nowrap">{rupees(r.bookingAmount)}</span> },
            { key: 'comm', header: t('agent.dealForm.commission'), render: (r) => <span className="whitespace-nowrap">{r.commissionPercent != null ? `${r.commissionPercent}% · ` : ''}{rupees(r.commissionAmount)}</span> },
            { key: 'status', header: t('agent.common.status'), render: (r) => <Badge tone={dealStatus(r.status).tone}>{dealStatus(r.status).label}</Badge> },
            { key: 'sub', header: t('agent.dealStatus.submitted'), render: (r) => <span className="whitespace-nowrap text-xs">{date(r.submittedAt)}</span> },
            { key: 'comment', header: t('agent.deals.adminComment'), render: (r) => <span className="block max-w-[16rem] truncate text-xs text-ink-muted">{(r.review && (r.review.comment || r.review.rejectReason)) || r.cancelReason || '-'}</span> },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
