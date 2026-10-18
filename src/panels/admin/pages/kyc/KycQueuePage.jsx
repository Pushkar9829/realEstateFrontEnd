// RE-F-04 KYC review queue (permission listers.verify). Oldest first, with
// SLA colouring, claim holder and auto-check warnings.
import { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { kycStatus, useKycQueue } from '@/modules/kyc/api';

const TABS = [
  { value: '', label: 'To review' },
  { value: 'resubmission_required', label: 'Waiting for lister' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];
const SLA = { green: ['success', 'On time'], amber: ['warning', 'Due soon'], red: ['danger', 'Overdue'] };

export default function KycQueuePage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useKycQueue({ page, limit: 20, ...(status ? { status } : {}) });
  const rows = (data && data.items) || [];
  const reviewing = status === '';

  return (
    <>
      <PageHeader title="KYC queue" description="Verify owners, builders and landlords before their listings can go live. Decide within 48 hours." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/kyc/${r._id}`} empty={reviewing ? 'Nothing to review. The queue is clear.' : 'No listers in this state.'}
        columns={[
          { key: 'name', header: 'Lister', render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.email}</span></span> },
          { key: 'type', header: 'Type', render: (r) => <Badge tone="brand">{titleCase(r.listerType)}</Badge> },
          { key: 'submitted', header: 'Submitted', render: (r) => <span title={dateTime(r.kyc && r.kyc.submittedAt)}>{timeAgo(r.kyc && r.kyc.submittedAt)}</span> },
          { key: 'checks', header: 'Auto-checks', render: (r) => { const n = ((r.kyc && r.kyc.autoChecks) || []).length; const high = ((r.kyc && r.kyc.autoChecks) || []).some((c) => c.severity === 'high'); return n ? <Badge tone={high ? 'danger' : 'warning'} icon={AlertTriangle}>{n} warning{n > 1 ? 's' : ''}</Badge> : <span className="text-xs text-ink-subtle">None</span>; } },
          { key: 'status', header: 'Status', render: (r) => { const s = kycStatus(r.kyc && r.kyc.status); return <span className="inline-flex items-center gap-1.5"><Badge tone={s.tone}>{s.label}</Badge>{r.kyc && r.kyc.claim && new Date(r.kyc.claim.until) > new Date() && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label="Claimed" />}</span>; } },
          ...(reviewing ? [{ key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <Badge tone={tone}>{label} · {r.sla ? r.sla.ageHours : 0}h</Badge>; } }] : []),
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
