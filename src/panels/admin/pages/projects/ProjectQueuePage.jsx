// RE-G-02 builder project review queue (projects.approve) and all projects.
import { useState } from 'react';
import { Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { timeAgo } from '@/shared/lib/format';
import { projectStatus, useProjectQueue } from '@/modules/projects/api';

const TABS = [{ value: 'pending_approval', label: 'To review' }, { value: 'live', label: 'Live' }, { value: 'sold_out', label: 'Sold out' }, { value: 'changes_requested', label: 'With builder' }, { value: 'rejected', label: 'Rejected' }, { value: 'inactive', label: 'Inactive' }];

export default function ProjectQueuePage() {
  const [status, setStatus] = useState('pending_approval');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectQueue({ page, limit: 20, status });
  return (
    <>
      <PageHeader title="Builder projects" description="Check RERA registrations on the official state site before approving." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      <Table loading={isLoading} rows={(data && data.items) || []} rowHref={(r) => `/admin/projects/${r._id}`} empty="No projects in this state."
        columns={[
          { key: 'name', header: 'Project', render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.projectNo}</span></span> },
          { key: 'builder', header: 'Builder', render: (r) => (r.builderId ? <span>{r.builderId.brand?.name || r.builderId.name}<span className="block text-xs text-ink-subtle">KYC {r.builderId.kyc?.status || 'not started'}</span></span> : '-') },
          { key: 'loc', header: 'Location', render: (r) => [r.location?.locality, r.location?.city].filter(Boolean).join(', ') || '-' },
          { key: 'rera', header: 'RERA', render: (r) => (r.rera?.exempt?.reason ? <Badge tone="warning">Exemption</Badge> : (r.rera?.registrations || []).map((x) => x.number).join(', ') || '-') },
          { key: 'updated', header: 'Updated', render: (r) => timeAgo(r.updatedAt) },
          { key: 'status', header: 'Status', render: (r) => { const s = projectStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
