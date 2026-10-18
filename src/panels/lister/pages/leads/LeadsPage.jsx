// RE-S-LIS-13 leads, visits and activity: what the sales team is doing on the
// lister's listings, without any buyer identity ("Buyer N" labels and counts only).
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Activity, CalendarDays, MessageSquareReply, Star, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Skeleton, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { useListerActivity, useListerLeads, useListerVisits, useRespondUpdate, visitStatus } from '@/modules/leads/listerApi';
import ListingPicker from '../../components/ListingPicker';
import { useT } from '@/shared/i18n';
import { buyerText } from '@/panels/lister/components/buyerLabel';

const listingRef = (p) => (p ? `${p.listingNo || ''}${p.title ? ` · ${p.title}` : ''}` : '-');
const shownCount = (c, t) => (c === '<3' ? t('lister.stats.fewerThan3') : c);

// One bucket per label: the server merges stages that share a simplified label
// and masks small counts. The table below already lists every lead (as
// "Buyer N", no identity; SPEC RE-S-LIS-13), so on this tab the buckets are
// counted from those rows and shown exactly; masking stays on the stats
// charts (stats.smallCountMasking). Over 200 leads the server counts are used.
const LIST_LIMIT = 200;
function exactFunnel(funnel, items) {
  if (!items || items.length >= LIST_LIMIT) return funnel || [];
  return (funnel || []).map((f) => ({ ...f, count: items.filter((i) => i.status === f.label).length }));
}

function Funnel({ funnel }) {
  const t = useT();
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {(funnel || []).map((f) => (
        <li key={f.label} className="rounded-md border bg-surface-muted p-3">
          <p className="text-xs text-ink-subtle">{f.label}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{shownCount(f.count, t)}</p>
        </li>
      ))}
    </ol>
  );
}

function LeadsTab({ propertyId }) {
  const t = useT();
  const { data, isLoading, isError, refetch } = useListerLeads(propertyId ? { propertyId } : {});
  if (isError) return <Alert tone="danger" title={t('lister.leads.loadLeads')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t('lister.stats.funnel')} description={t('lister.leads.funnelDesc')} />
        {isLoading ? <Skeleton className="h-16" /> : <Funnel funnel={exactFunnel(data.funnel, data.items)} />}
      </Card>
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('lister.leads.noLeads')} columns={[
        { key: 'buyer', header: t('lister.leads.col.buyer'), render: (r) => <span className="whitespace-nowrap font-medium">{buyerText(t, r.buyer)}{r.property && r.property.listingNo ? <span className="font-normal text-ink-subtle"> · {r.property.listingNo}</span> : null}</span> },
        { key: 'property', header: t('lister.leads.col.listing'), render: (r) => <span className="block max-w-xs truncate">{listingRef(r.property)}</span> },
        { key: 'createdAt', header: t('lister.leads.col.received'), render: (r) => date(r.createdAt) },
        { key: 'status', header: t('lister.leads.col.stage'), render: (r) => <Badge tone="brand">{r.status}</Badge> },
        { key: 'visits', header: t('lister.leads.col.visits'), render: (r) => t('lister.leads.visitsDone', { done: r.visitsDone, total: r.visits }) },
        { key: 'last', header: t('lister.leads.col.last'), render: (r) => timeAgo(r.lastActivityAt || r.createdAt) },
      ]} />
    </div>
  );
}

function VisitsTab({ filters }) {
  const t = useT();
  const [upcoming, setUpcoming] = useState(true);
  const { data, isLoading, isError, refetch } = useListerVisits({ ...filters, ...(upcoming ? { upcoming: 'true' } : {}) });
  const rows = (data && data.items) || [];
  const feedback = (data && data.feedback) || [];
  if (isError) return <Alert tone="danger" title={t('lister.leads.loadVisits')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />;
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button size="sm" variant={upcoming ? 'primary' : 'secondary'} onClick={() => setUpcoming(true)}>{t('lister.leads.upcoming')}</Button>
        <Button size="sm" variant={!upcoming ? 'primary' : 'secondary'} onClick={() => setUpcoming(false)}>{t('lister.dashboard.allVisits')}</Button>
      </div>
      {feedback.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {feedback.map((f) => (
            <Card key={listingRef(f.property)} className="flex items-center gap-3">
              <Star className="h-5 w-5 text-accent-600" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-subtle">{listingRef(f.property)}</p>
                <p className="text-sm text-ink"><strong>{f.averageInterest} / 5</strong> {t('lister.leads.avgInterest', { n: f.responses })}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Table loading={isLoading} rows={rows} empty={upcoming ? t('lister.leads.noUpcoming') : t('lister.leads.noVisits')} columns={[
        { key: 'scheduledAt', header: t('lister.leads.col.when'), render: (r) => dateTime(r.scheduledAt) },
        { key: 'buyer', header: t('lister.leads.col.buyer'), render: (r) => <span className="font-medium">{buyerText(t, r.buyer)}</span> },
        { key: 'property', header: t('lister.leads.col.listing'), render: (r) => <span className="block max-w-xs truncate">{listingRef(r.property)}</span> },
        { key: 'status', header: t('lister.leads.col.status'), render: (r) => { const s = visitStatus(r.status); return <span className="inline-flex flex-wrap gap-1"><Badge tone={s.tone}>{s.label}</Badge>{r.outsideListerSlots && <Badge tone="warning">{t('lister.leads.outsideSlots')}</Badge>}{r.lastReschedule && r.lastReschedule.reason && <span className="block w-full text-xs text-ink-subtle">{t('lister.leads.moved', { reason: r.lastReschedule.reason })}</span>}</span>; } },
        { key: 'outcome', header: t('lister.leads.col.outcome'), render: (r) => (r.outcome
          ? <span className="text-sm">{titleCase(r.outcome.result)}{r.outcome.interest ? ` · ${t('lister.leads.interest', { n: r.outcome.interest })}` : ''}{r.outcome.nextStep ? <span className="block text-xs text-ink-subtle">{t('lister.leads.next', { step: r.outcome.nextStep })}</span> : null}</span>
          : <span className="text-ink-subtle">-</span>) },
      ]} />
    </div>
  );
}

function ActivityTab({ filters }) {
  const t = useT();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useListerActivity(filters);
  const respond = useRespondUpdate();
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const rows = data || [];

  const send = async () => {
    setError('');
    try {
      await respond.mutateAsync({ id: open.id, response: text.trim() });
      toast.success(t('lister.leads.replySent'));
      setOpen(null);
    } catch (e) { setError(e.fieldErrors.response || e.message); }
  };

  if (isError) return <Alert tone="danger" title={t('lister.leads.loadActivity')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />;
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!rows.length) return <EmptyState icon={Activity} title={t('lister.dashboard.noActivity')} description={t('lister.leads.activityEmpty')} />;
  return (
    <>
      <ul className="space-y-3">
        {rows.map((u) => (
          <li key={u.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              {u.tag && <Badge tone="info">{titleCase(u.tag)}</Badge>}
              <span>{buyerText(t, u.buyer)}</span><span>·</span><span className="truncate">{listingRef(u.property)}</span><span>·</span><span>{dateTime(u.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-ink">{u.text}</p>
            {u.amount ? <p className="mt-1 text-sm font-semibold text-ink">{rupees(u.amount)}</p> : null}
            {u.response ? (
              <div className="mt-3 rounded-md bg-surface-muted p-3 text-sm">
                <p className="text-xs text-ink-subtle">{t('lister.leads.yourReply')} · {dateTime(u.respondedAt)}</p>
                <p className="mt-1 text-ink">{u.response}</p>
              </div>
            ) : (
              <Button className="mt-3" size="sm" variant="secondary" icon={MessageSquareReply} onClick={() => { setOpen(u); setText(''); setError(''); }}>{t('lister.leads.replyToAgent')}</Button>
            )}
          </li>
        ))}
      </ul>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={t('lister.leads.replyTitle')} description={t('lister.leads.replyDesc')}
        footer={<><Button variant="ghost" onClick={() => setOpen(null)}>{t('common.cancel')}</Button><Button loading={respond.isPending} disabled={text.trim().length < 2} onClick={send}>{t('lister.leads.sendReply')}</Button></>}>
        {open && <p className="mb-3 rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{open.text}</p>}
        <Textarea label={t('lister.leads.yourReply')} rows={4} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} error={error} hint={`${text.length}/500`} />
      </Modal>
    </>
  );
}

export default function LeadsPage() {
  const t = useT();
  const location = useLocation();
  const [tab, setTab] = useState(location.pathname.endsWith('/visits') ? 'visits' : 'leads');
  const [propertyId, setPropertyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Listing and IST date range are filtered on the server (GET /lister/visits, /lister/activity).
  const filters = { ...(propertyId ? { propertyId } : {}), ...(from ? { from: `${from}T00:00:00+05:30` } : {}), ...(to ? { to: `${to}T23:59:59.999+05:30` } : {}) };

  return (
    <>
      <PageHeader title={t('panel.nav.listerLeads')} description={t('lister.leads.desc')}
        actions={<Button variant="secondary" icon={CalendarDays} to="/lister/availability">{t('panel.nav.listerAvailability')}</Button>} />
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'leads', label: t('lister.leads.tabLeads') }, { value: 'visits', label: t('lister.leads.col.visits') }, { value: 'activity', label: t('lister.leads.tabActivity') }]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {tab !== 'leads' && (
            <>
              <Input label={t('lister.stats.from')} type="date" className="sm:w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              <Input label={t('lister.stats.to')} type="date" className="sm:w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          <ListingPicker className="sm:w-80" value={propertyId} onChange={setPropertyId} />
        </div>
      </div>
      {tab === 'leads' && <LeadsTab propertyId={propertyId} />}
      {tab === 'visits' && <VisitsTab filters={filters} />}
      {tab === 'activity' && <ActivityTab filters={filters} />}
      <p className="mt-6 flex items-center gap-2 text-xs text-ink-subtle"><Users className="h-4 w-4" aria-hidden />{t('lister.leads.offersNote')}</p>
    </>
  );
}
