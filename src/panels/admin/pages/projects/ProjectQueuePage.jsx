// RE-G-02 builder project review queue (projects.approve) and all projects.
import { useState } from 'react';
import { Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { timeAgo } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { projectStatus, useProjectQueue } from '@/modules/projects/api';

const TABS = (t) => [
  { value: 'pending_approval', label: t('admin.projects.tabs.toReview') },
  { value: 'live', label: t('admin.projects.tabs.live') },
  { value: 'sold_out', label: t('admin.projects.tabs.soldOut') },
  { value: 'changes_requested', label: t('admin.projects.tabs.withBuilder') },
  { value: 'rejected', label: t('admin.projects.tabs.rejected') },
  { value: 'inactive', label: t('admin.projects.tabs.inactive') },
];

export default function ProjectQueuePage() {
  const t = useT();
  const [status, setStatus] = useState('pending_approval');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useProjectQueue({ page, limit: 20, status });
  return (
    <>
      <PageHeader title={t('admin.projects.title')} description={t('admin.projects.description')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS(t).map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
      <Table loading={isLoading} error={error} onRetry={() => refetch()} rows={(data && data.items) || []} rowHref={(r) => `/admin/projects/${r._id}`} empty={t('admin.projects.empty')}
        columns={[
          { key: 'name', header: t('admin.projects.col.project'), render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.projectNo}</span></span> },
          { key: 'builder', header: t('admin.projects.col.builder'), render: (r) => (r.builderId ? <span>{r.builderId.brand?.name || r.builderId.name}<span className="block text-xs text-ink-subtle">KYC {r.builderId.kyc?.status || t('admin.projects.notStarted')}</span></span> : '-') },
          { key: 'loc', header: t('admin.projects.col.location'), render: (r) => [r.location?.locality, r.location?.city].filter(Boolean).join(', ') || '-' },
          { key: 'rera', header: 'RERA', render: (r) => (r.rera?.exempt?.reason ? <Badge tone="warning">{t('admin.projects.exemption')}</Badge> : (r.rera?.registrations || []).map((x) => x.number).join(', ') || '-') },
          { key: 'updated', header: t('admin.projects.col.updated'), render: (r) => timeAgo(r.updatedAt) },
          { key: 'status', header: t('admin.projects.col.status'), render: (r) => { const s = projectStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
