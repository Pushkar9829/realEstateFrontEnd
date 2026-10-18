// RE-D-13 site verification visits (Could): the visits assigned to me as the
// in-house field agent (permission verification.field).
import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { EmptyState, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { VERIFICATION_STATUS, useVerificationVisits } from '@/modules/leads/agentApi';
import { ErrorState, StatusBadge } from '../../components/common';

const TABS = [{ value: 'scheduled', label: 'To visit' }, { value: 'verified,not_verified,lister_absent', label: 'Done' }, { value: '', label: 'All' }];

export function NoFieldAccess() {
  return <EmptyState icon={ShieldOff} title="Field verification is not enabled for you" description="Site verification visits are for in-house agents with field verification access. Ask an admin if you should have it." />;
}

export default function VerificationVisitsPage() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('verification.field');
  const [status, setStatus] = useState('scheduled');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useVerificationVisits({ page, limit: 20, sort: 'scheduledAt', ...(status ? { status } : {}) }, allowed);
  if (!allowed) return <NoFieldAccess />;
  const rows = (data && data.items) || [];
  return (
    <>
      <PageHeader title="Verification visits" description="Visit the listing, capture GPS on arrival, tick the checklist and upload 4-20 photos. A verified result gives the listing the Site verified badge." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      {error ? <ErrorState error={error} onRetry={refetch} title="Could not load your visits" /> : !isLoading && !rows.length ? (
        <EmptyState icon={ShieldCheck} title={status === 'scheduled' ? 'No visits assigned to you' : 'Nothing here yet'} description="The verification team assigns visits to you; you are notified with the address and time." />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/agent/verification-visits/${r._id}`}
          columns={[
            { key: 'no', header: 'Visit', render: (r) => <span className="font-medium text-ink">{r.visitNo}</span> },
            { key: 'prop', header: 'Listing', render: (r) => (r.propertyId ? <span><span className="block max-w-xs truncate">{r.propertyId.title}</span><span className="text-xs text-ink-subtle">{r.propertyId.listingNo} · {[r.propertyId.location?.addressLine, r.propertyId.location?.locality, r.propertyId.location?.city].filter(Boolean).join(', ')}</span></span> : '-') },
            { key: 'when', header: 'When', render: (r) => <span className="whitespace-nowrap text-sm">{dateTime(r.scheduledAt)}</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge map={VERIFICATION_STATUS} status={r.status} /> },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
