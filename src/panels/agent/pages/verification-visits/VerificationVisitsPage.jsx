// RE-D-13 site verification visits (Could): the visits assigned to me as the
// in-house field agent (permission verification.field).
import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { EmptyState, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { VERIFICATION_STATUS, useVerificationVisits } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { ErrorState, StatusBadge } from '../../components/common';

// [value, label key under agent.verification.tab]
const TABS = [['scheduled', 'toVisit'], ['verified,not_verified,lister_absent', 'done'], ['', 'all']];

export function NoFieldAccess() {
  const t = useT();
  return <EmptyState icon={ShieldOff} title={t('agent.verification.noAccessTitle')} description={t('agent.verification.noAccessDesc')} />;
}

export default function VerificationVisitsPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('verification.field');
  const [status, setStatus] = useState('scheduled');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useVerificationVisits({ page, limit: 20, sort: 'scheduledAt', ...(status ? { status } : {}) }, allowed);
  if (!allowed) return <NoFieldAccess />;
  const rows = (data && data.items) || [];
  return (
    <>
      <PageHeader title={t('panel.nav.agentVerificationVisits')} description={t('agent.verification.desc')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map(([value, k]) => { const tab = { value, label: t(`agent.verification.tab.${k}`) }; return value === status && data ? { ...tab, count: data.meta.total } : tab; })} />
      {error ? <ErrorState error={error} onRetry={refetch} title={t('agent.verification.loadError')} /> : !isLoading && !rows.length ? (
        <EmptyState icon={ShieldCheck} title={status === 'scheduled' ? t('agent.verification.emptyTitle') : t('agent.verification.nothing')} description={t('agent.verification.emptyDesc')} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/agent/verification-visits/${r._id}`}
          columns={[
            { key: 'no', header: t('agent.wa.visit'), render: (r) => <span className="font-medium text-ink">{r.visitNo}</span> },
            { key: 'prop', header: t('agent.wa.listing'), render: (r) => (r.propertyId ? <span><span className="block max-w-xs truncate">{r.propertyId.title}</span><span className="text-xs text-ink-subtle">{r.propertyId.listingNo} · {[r.propertyId.location?.addressLine, r.propertyId.location?.locality, r.propertyId.location?.city].filter(Boolean).join(', ')}</span></span> : '-') },
            { key: 'when', header: t('agent.verification.when'), render: (r) => <span className="whitespace-nowrap text-sm">{dateTime(r.scheduledAt)}</span> },
            { key: 'status', header: t('agent.common.status'), render: (r) => <StatusBadge map={VERIFICATION_STATUS} status={r.status} /> },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
