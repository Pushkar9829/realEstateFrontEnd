// RE-S-ADM-31 photo verification queue (RE-A-20, verification.review): geo
// camera sessions waiting for QA, with age against the review SLA.
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Alert, Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime, timeAgo } from '@/shared/lib/format';
import { sessionStatus, usePhotoSessions } from '@/modules/listings/photoQaApi';

const SLA = { green: ['success', 'On time'], amber: ['warning', 'Due soon'], red: ['danger', 'Overdue'] };
const TABS = [
  { value: 'pending_review', label: 'Pending' },
  { value: 'mine', label: 'Claimed by me' },
  { value: 'approved', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired links' },
];

export default function PhotoQueuePage() {
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const pending = ['pending_review', 'mine'].includes(status);
  const { data, isLoading, error } = usePhotoSessions({ status, page, limit: 20, sort: pending ? 'updatedAt' : '-updatedAt' });
  const rows = (data && data.items) || [];

  return (
    <>
      <PageHeader title="Photo verification" description="Live photos taken at the property with a GPS check. Approve to grant the Photo verified badge; claims lock a session for 30 minutes." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/photo-verification/${r._id}`} empty={pending ? 'No verifications waiting.' : 'Nothing here.'}
        columns={[
          { key: 'session', header: 'Session', render: (r) => <span className="font-medium text-ink">{r.sessionNo}</span> },
          { key: 'listing', header: 'Listing', render: (r) => (r.propertyId ? <span className="block max-w-xs"><span className="block truncate text-sm">{r.propertyId.title}</span><span className="text-xs text-ink-subtle">{r.propertyId.listingNo} · {[r.propertyId.location?.locality, r.propertyId.location?.city].filter(Boolean).join(', ')}</span></span> : '-') },
          { key: 'submitted', header: 'Submitted', render: (r) => <span className="whitespace-nowrap text-sm" title={dateTime(r.updatedAt)}>{timeAgo(r.updatedAt)}</span> },
          { key: 'photos', header: 'Photos', render: (r) => (r.photos || []).length },
          { key: 'gps', header: 'Distance / accuracy', render: (r) => (r.gps ? <span className="text-sm">{r.gps.distanceM ?? '-'} m<span className="text-xs text-ink-subtle"> · ±{Math.round(r.gps.accuracy ?? 0)} m</span></span> : '-') },
          { key: 'claim', header: 'Claimed', render: (r) => (r.review?.claimedBy && r.review.claimUntil && new Date(r.review.claimUntil) > new Date() ? <Lock className="h-4 w-4 text-ink-subtle" aria-label="Claimed" /> : null) },
          pending
            ? { key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <span title={r.sla ? `${r.sla.ageHours} h of ${r.sla.hours} h` : undefined}><Badge tone={tone}>{label}</Badge></span>; } }
            : { key: 'status', header: 'Status', render: (r) => { const s = sessionStatus(r.status); return <span><Badge tone={s.tone}>{s.label}</Badge>{r.review?.reason && <span className="block text-xs text-ink-subtle">{r.review.reason.replace(/_/g, ' ')}</span>}</span>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
