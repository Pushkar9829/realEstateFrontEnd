// RE-D-01/05 listing approval queue (permission properties.approve): new
// submissions and resubmissions, or revisions of live listings; oldest first.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock } from 'lucide-react';
import { Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { useReviewQueue } from '@/modules/approvals/api';

const SLA = { green: ['success', 'On time'], amber: ['warning', 'Due soon'], red: ['danger', 'Overdue'] };

export default function ApprovalQueuePage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState('new');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReviewQueue({ page, limit: 20, ...(queue === 'revisions' ? { queue: 'revisions' } : {}) });
  const rows = (data && data.items) || [];

  return (
    <>
      <PageHeader title="Approval queue" description="Check each listing against its private data and decide within 24 hours. Claiming locks it for 30 minutes." />
      <Tabs className="mb-4" value={queue} onChange={(v) => { setQueue(v); setPage(1); }}
        tabs={[{ value: 'new', label: 'New and resubmitted' }, { value: 'revisions', label: 'Revisions of live listings' }].map((t) => (t.value === queue && data ? { ...t, count: data.meta.total } : t))} />
      <Table loading={isLoading} rows={rows} onRowClick={(r) => navigate(`/admin/approvals/${r._id}`)} empty="Queue is clear. Nothing is waiting for review."
        columns={[
          { key: 'title', header: 'Listing', render: (r) => <span><span className="block max-w-sm truncate font-medium text-ink">{r.title}</span><span className="text-xs text-ink-subtle">{r.listingNo} · {titleCase(r.purpose)} · {[r.location?.locality, r.location?.city].filter(Boolean).join(', ')}</span></span> },
          { key: 'lister', header: 'Lister', render: (r) => (r.listerId ? <span className="text-sm">{r.listerId.name}<span className="block text-xs text-ink-subtle">{titleCase(r.listerId.listerType)} · KYC {titleCase(r.listerId.kyc?.status || 'not_started')}</span></span> : '-') },
          { key: 'kind', header: 'Type', render: (r) => (queue === 'revisions' ? <Badge tone="info">Revision</Badge> : r.resubmissionCount ? <Badge tone="warning">Resubmitted ×{r.resubmissionCount}</Badge> : <Badge>New</Badge>) },
          { key: 'warnings', header: 'Auto-checks', render: (r) => ((r.warnings || []).length ? <Badge tone="warning" icon={AlertTriangle}>{r.warnings.length}</Badge> : <span className="text-xs text-ink-subtle">None</span>) },
          { key: 'waiting', header: 'Waiting', render: (r) => <span className="inline-flex items-center gap-1.5" title={dateTime(r.submittedAt)}>{timeAgo((r.pendingRevision && r.pendingRevision.submittedAt) || r.submittedAt)}{r.review?.claimedBy && new Date(r.review.claimUntil) > new Date() && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label="Claimed" />}</span> },
          { key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <Badge tone={tone}>{label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
