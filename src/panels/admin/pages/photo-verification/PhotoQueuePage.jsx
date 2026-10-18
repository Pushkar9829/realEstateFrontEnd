// RE-S-ADM-31 photo verification queue (RE-A-20, verification.review): geo
// camera sessions waiting for QA, with age against the review SLA.
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Alert, Badge, PageHeader, Pagination, Table, Tabs } from '@/shared/ui';
import { dateTime, timeAgo } from '@/shared/lib/format';
import { sessionStatus, usePhotoSessions } from '@/modules/listings/photoQaApi';
import { useT } from '@/shared/i18n';

const SLA = { green: ['success', 'onTime'], amber: ['warning', 'dueSoon'], red: ['danger', 'overdue'] };
const TABS = (t) => [
  { value: 'pending_review', label: t('admin.photos.tabs.pending') },
  { value: 'mine', label: t('admin.photos.tabs.mine') },
  { value: 'approved', label: t('admin.photos.tabs.approved') },
  { value: 'rejected', label: t('admin.photos.tabs.rejected') },
  { value: 'expired', label: t('admin.photos.tabs.expired') },
];

export default function PhotoQueuePage() {
  const t = useT();
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const pending = ['pending_review', 'mine'].includes(status);
  const { data, isLoading, error } = usePhotoSessions({ status, page, limit: 20, sort: pending ? 'updatedAt' : '-updatedAt' });
  const rows = (data && data.items) || [];

  return (
    <>
      <PageHeader title={t('panel.nav.adminPhotoVerification')} description={t('admin.photos.queueDescription')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS(t).map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/photo-verification/${r._id}`} empty={pending ? t('admin.photos.emptyPending') : t('admin.photos.emptyOther')}
        columns={[
          { key: 'session', header: t('admin.photos.col.session'), render: (r) => <span className="font-medium text-ink">{r.sessionNo}</span> },
          { key: 'listing', header: t('admin.photos.col.listing'), render: (r) => (r.propertyId ? <span className="block max-w-xs"><span className="block truncate text-sm">{r.propertyId.title}</span><span className="text-xs text-ink-subtle">{r.propertyId.listingNo} · {[r.propertyId.location?.locality, r.propertyId.location?.city].filter(Boolean).join(', ')}</span></span> : '-') },
          { key: 'submitted', header: t('admin.photos.col.submitted'), render: (r) => <span className="whitespace-nowrap text-sm" title={dateTime(r.updatedAt)}>{timeAgo(r.updatedAt)}</span> },
          { key: 'photos', header: t('admin.photos.col.photos'), render: (r) => (r.photos || []).length },
          { key: 'gps', header: t('admin.photos.col.gps'), render: (r) => (r.gps ? <span className="text-sm">{r.gps.distanceM ?? '-'} m<span className="text-xs text-ink-subtle"> · ±{Math.round(r.gps.accuracy ?? 0)} m</span></span> : '-') },
          { key: 'claim', header: t('admin.photos.col.claim'), render: (r) => (r.review?.claimedBy && r.review.claimUntil && new Date(r.review.claimUntil) > new Date() ? <Lock className="h-4 w-4 text-ink-subtle" aria-label={t('admin.photos.col.claim')} /> : null) },
          pending
            ? { key: 'sla', header: t('admin.photos.col.sla'), render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <span title={r.sla ? t('admin.photos.slaAge', { age: r.sla.ageHours, hours: r.sla.hours }) : undefined}><Badge tone={tone}>{t(`admin.photos.sla.${label}`)}</Badge></span>; } }
            : { key: 'status', header: t('admin.photos.col.status'), render: (r) => { const s = sessionStatus(r.status); return <span><Badge tone={s.tone}>{s.label}</Badge>{r.review?.reason && <span className="block text-xs text-ink-subtle">{r.review.reason.replace(/_/g, ' ')}</span>}</span>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
