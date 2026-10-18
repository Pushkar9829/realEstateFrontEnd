// RE-F-04 KYC review queue (permission listers.verify). Oldest first, with
// SLA colouring, claim holder and auto-check warnings.
import { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { kycStatus, useKycQueue } from '@/modules/kyc/api';

const TABS = (t) => [
  { value: '', label: t('admin.kyc.tabs.toReview') },
  { value: 'resubmission_required', label: t('admin.kyc.tabs.waiting') },
  { value: 'verified', label: t('admin.kyc.tabs.verified') },
  { value: 'rejected', label: t('admin.kyc.tabs.rejected') },
];
const SLA_TONE = { green: 'success', amber: 'warning', red: 'danger' };

export default function KycQueuePage() {
  const t = useT();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useKycQueue({ page, limit: 20, ...(status ? { status } : {}) });
  const rows = (data && data.items) || [];
  const reviewing = status === '';
  const sla = (level) => (SLA_TONE[level] ? [SLA_TONE[level], t(`admin.kyc.sla.${level}`)] : ['success', t('admin.kyc.sla.green')]);

  return (
    <>
      <PageHeader title={t('admin.kyc.title')} description={t('admin.kyc.description')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS(t).map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
      <Table loading={isLoading} error={error} onRetry={() => refetch()} rows={rows} rowHref={(r) => `/admin/kyc/${r._id}`} empty={reviewing ? t('admin.kyc.emptyReview') : t('admin.kyc.emptyState')}
        columns={[
          { key: 'name', header: t('admin.kyc.col.lister'), render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.email}</span></span> },
          { key: 'type', header: t('admin.kyc.col.type'), render: (r) => <Badge tone="brand">{titleCase(r.listerType)}</Badge> },
          { key: 'submitted', header: t('admin.kyc.col.submitted'), render: (r) => <span title={dateTime(r.kyc && r.kyc.submittedAt)}>{timeAgo(r.kyc && r.kyc.submittedAt)}</span> },
          { key: 'checks', header: t('admin.kyc.col.checks'), render: (r) => { const n = ((r.kyc && r.kyc.autoChecks) || []).length; const high = ((r.kyc && r.kyc.autoChecks) || []).some((c) => c.severity === 'high'); return n ? <Badge tone={high ? 'danger' : 'warning'} icon={AlertTriangle}>{t('admin.kyc.warnings', { count: n })}</Badge> : <span className="text-xs text-ink-subtle">{t('admin.kyc.none')}</span>; } },
          { key: 'status', header: t('admin.kyc.col.status'), render: (r) => { const s = kycStatus(r.kyc && r.kyc.status); return <span className="inline-flex items-center gap-1.5"><Badge tone={s.tone}>{s.label}</Badge>{r.kyc && r.kyc.claim && new Date(r.kyc.claim.until) > new Date() && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label={t('admin.kyc.claimed')} />}</span>; } },
          ...(reviewing ? [{ key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = sla(r.sla && r.sla.level); return <Badge tone={tone}>{label} · {r.sla ? r.sla.ageHours : 0}h</Badge>; } }] : []),
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
