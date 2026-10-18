// RE-D-01/05 listing approval queue (permission properties.approve): new
// submissions and resubmissions, or revisions of live listings; oldest first.
import { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useReviewQueue } from '@/modules/approvals/api';

const SLA_TONE = { green: 'success', amber: 'warning', red: 'danger' };

export default function ApprovalQueuePage() {
  const t = useT();
  const [queue, setQueue] = useState('new');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReviewQueue({ page, limit: 20, ...(queue === 'revisions' ? { queue: 'revisions' } : {}) });
  const rows = (data && data.items) || [];
  const sla = (level) => (SLA_TONE[level] ? [SLA_TONE[level], t(`admin.approvals.sla.${level}`)] : ['success', t('admin.approvals.sla.green')]);

  return (
    <>
      <PageHeader title={t('admin.approvals.title')} description={t('admin.approvals.description')} />
      <Tabs className="mb-4" value={queue} onChange={(v) => { setQueue(v); setPage(1); }}
        tabs={[{ value: 'new', label: t('admin.approvals.tabs.new') }, { value: 'revisions', label: t('admin.approvals.tabs.revisions') }].map((x) => (x.value === queue && data ? { ...x, count: data.meta.total } : x))} />
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/approvals/${r._id}`} empty={t('admin.approvals.empty')}
        columns={[
          { key: 'title', header: t('admin.approvals.col.listing'), render: (r) => <span><span className="block max-w-sm truncate font-medium text-ink">{r.title}</span><span className="text-xs text-ink-subtle">{r.listingNo} · {titleCase(r.purpose)} · {[r.location?.locality, r.location?.city].filter(Boolean).join(', ')}</span></span> },
          { key: 'lister', header: t('admin.approvals.col.lister'), render: (r) => (r.listerId ? <span className="text-sm">{r.listerId.name}<span className="block text-xs text-ink-subtle">{titleCase(r.listerId.listerType)} · KYC {titleCase(r.listerId.kyc?.status || 'not_started')}</span></span> : '-') },
          { key: 'kind', header: t('admin.approvals.col.type'), render: (r) => (queue === 'revisions' ? <Badge tone="info">{t('admin.approvals.revision')}</Badge> : r.resubmissionCount ? <Badge tone="warning">{t('admin.approvals.resubmitted', { n: r.resubmissionCount })}</Badge> : <Badge>{t('admin.approvals.new')}</Badge>) },
          { key: 'warnings', header: t('admin.approvals.col.checks'), render: (r) => ((r.warnings || []).length ? <Badge tone="warning" icon={AlertTriangle}>{r.warnings.length}</Badge> : <span className="text-xs text-ink-subtle">{t('admin.approvals.none')}</span>) },
          { key: 'waiting', header: t('admin.approvals.col.waiting'), render: (r) => <span className="inline-flex items-center gap-1.5" title={dateTime(r.submittedAt)}>{timeAgo((r.pendingRevision && r.pendingRevision.submittedAt) || r.submittedAt)}{r.review?.claimedBy && new Date(r.review.claimUntil) > new Date() && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label={t('admin.approvals.claimed')} />}</span> },
          { key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = sla(r.sla && r.sla.level); return <Badge tone={tone}>{label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
