// RE-S-LIS-13 leads, visits and activity: what the sales team is doing on the
// lister's listings, without any buyer identity ("Buyer N" labels and counts only).
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Activity, CalendarDays, MessageSquareReply, Star, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Skeleton, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { useListerActivity, useListerLeads, useListerVisits, useRespondUpdate, visitStatus } from '@/modules/leads/listerApi';
import ListingPicker from '../../components/ListingPicker';

const listingRef = (p) => (p ? `${p.listingNo || ''}${p.title ? ` · ${p.title}` : ''}` : '-');
const shownCount = (c) => (c === '<3' ? 'fewer than 3' : c);

// One bucket per label: the server merges stages that share a simplified label
// (and masks small counts after merging), so buckets are shown as they come.
function Funnel({ funnel }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {(funnel || []).map((f) => (
        <li key={f.label} className="rounded-md border bg-surface-muted p-3">
          <p className="text-xs text-ink-subtle">{f.label}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{shownCount(f.count)}</p>
        </li>
      ))}
    </ol>
  );
}

function LeadsTab({ propertyId }) {
  const { data, isLoading, isError, refetch } = useListerLeads(propertyId ? { propertyId } : {});
  if (isError) return <Alert tone="danger" title="Could not load leads" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Enquiry funnel" description="Counts only. Small counts are shown as 'fewer than 3' so no single buyer can be identified." />
        {isLoading ? <Skeleton className="h-16" /> : <Funnel funnel={data.funnel} />}
      </Card>
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No leads on your listings yet" columns={[
        { key: 'buyer', header: 'Buyer', render: (r) => <span className="font-medium">{r.buyer}</span> },
        { key: 'property', header: 'Listing', render: (r) => <span className="block max-w-xs truncate">{listingRef(r.property)}</span> },
        { key: 'createdAt', header: 'Received', render: (r) => date(r.createdAt) },
        { key: 'status', header: 'Stage', render: (r) => <Badge tone="brand">{r.status}</Badge> },
        { key: 'visits', header: 'Visits', render: (r) => `${r.visitsDone} done / ${r.visits}` },
        { key: 'last', header: 'Last update', render: (r) => timeAgo(r.lastActivityAt || r.createdAt) },
      ]} />
    </div>
  );
}

function VisitsTab({ filters }) {
  const [upcoming, setUpcoming] = useState(true);
  const { data, isLoading, isError, refetch } = useListerVisits({ ...filters, ...(upcoming ? { upcoming: 'true' } : {}) });
  const rows = (data && data.items) || [];
  const feedback = (data && data.feedback) || [];
  if (isError) return <Alert tone="danger" title="Could not load visits" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />;
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button size="sm" variant={upcoming ? 'primary' : 'secondary'} onClick={() => setUpcoming(true)}>Upcoming</Button>
        <Button size="sm" variant={!upcoming ? 'primary' : 'secondary'} onClick={() => setUpcoming(false)}>All visits</Button>
      </div>
      {feedback.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {feedback.map((f) => (
            <Card key={listingRef(f.property)} className="flex items-center gap-3">
              <Star className="h-5 w-5 text-accent-600" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-subtle">{listingRef(f.property)}</p>
                <p className="text-sm text-ink"><strong>{f.averageInterest} / 5</strong> average buyer interest after visits ({f.responses} responses)</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Table loading={isLoading} rows={rows} empty={upcoming ? 'No upcoming visits' : 'No visits yet'} columns={[
        { key: 'scheduledAt', header: 'When', render: (r) => dateTime(r.scheduledAt) },
        { key: 'buyer', header: 'Buyer', render: (r) => <span className="font-medium">{r.buyer}</span> },
        { key: 'property', header: 'Listing', render: (r) => <span className="block max-w-xs truncate">{listingRef(r.property)}</span> },
        { key: 'status', header: 'Status', render: (r) => { const s = visitStatus(r.status); return <span className="inline-flex flex-wrap gap-1"><Badge tone={s.tone}>{s.label}</Badge>{r.outsideListerSlots && <Badge tone="warning">Outside your slots</Badge>}{r.lastReschedule && r.lastReschedule.reason && <span className="block w-full text-xs text-ink-subtle">Moved: {r.lastReschedule.reason}</span>}</span>; } },
        { key: 'outcome', header: 'Outcome shared by agent', render: (r) => (r.outcome
          ? <span className="text-sm">{titleCase(r.outcome.result)}{r.outcome.interest ? ` · interest ${r.outcome.interest}/5` : ''}{r.outcome.nextStep ? <span className="block text-xs text-ink-subtle">Next: {r.outcome.nextStep}</span> : null}</span>
          : <span className="text-ink-subtle">-</span>) },
      ]} />
    </div>
  );
}

function ActivityTab({ filters }) {
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
      toast.success('Reply sent to the agent');
      setOpen(null);
    } catch (e) { setError(e.fieldErrors.response || e.message); }
  };

  if (isError) return <Alert tone="danger" title="Could not load activity" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />;
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!rows.length) return <EmptyState icon={Activity} title="No activity yet" description="Updates our agents share about your listings appear here." />;
  return (
    <>
      <ul className="space-y-3">
        {rows.map((u) => (
          <li key={u.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              {u.tag && <Badge tone="info">{titleCase(u.tag)}</Badge>}
              <span>{u.buyer}</span><span>·</span><span className="truncate">{listingRef(u.property)}</span><span>·</span><span>{dateTime(u.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-ink">{u.text}</p>
            {u.amount ? <p className="mt-1 text-sm font-semibold text-ink">{rupees(u.amount)}</p> : null}
            {u.response ? (
              <div className="mt-3 rounded-md bg-surface-muted p-3 text-sm">
                <p className="text-xs text-ink-subtle">Your reply · {dateTime(u.respondedAt)}</p>
                <p className="mt-1 text-ink">{u.response}</p>
              </div>
            ) : (
              <Button className="mt-3" size="sm" variant="secondary" icon={MessageSquareReply} onClick={() => { setOpen(u); setText(''); setError(''); }}>Reply to agent</Button>
            )}
          </li>
        ))}
      </ul>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Reply to the agent" description="Your reply goes to the agent handling this buyer. Do not share phone numbers or emails."
        footer={<><Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button><Button loading={respond.isPending} disabled={text.trim().length < 2} onClick={send}>Send reply</Button></>}>
        {open && <p className="mb-3 rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{open.text}</p>}
        <Textarea label="Your reply" rows={4} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} error={error} hint={`${text.length}/500`} />
      </Modal>
    </>
  );
}

export default function LeadsPage() {
  const location = useLocation();
  const [tab, setTab] = useState(location.pathname.endsWith('/visits') ? 'visits' : 'leads');
  const [propertyId, setPropertyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Listing and IST date range are filtered on the server (GET /lister/visits, /lister/activity).
  const filters = { ...(propertyId ? { propertyId } : {}), ...(from ? { from: `${from}T00:00:00+05:30` } : {}), ...(to ? { to: `${to}T23:59:59.999+05:30` } : {}) };

  return (
    <>
      <PageHeader title="Leads and visits" description="Buyers are shown as 'Buyer N'. Our agents handle every buyer; their names and contacts stay private."
        actions={<Button variant="secondary" icon={CalendarDays} to="/lister/availability">Visit availability</Button>} />
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'leads', label: 'Leads' }, { value: 'visits', label: 'Visits' }, { value: 'activity', label: 'Activity feed' }]} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {tab !== 'leads' && (
            <>
              <Input label="From" type="date" className="sm:w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              <Input label="To" type="date" className="sm:w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          <ListingPicker className="sm:w-80" value={propertyId} onChange={setPropertyId} />
        </div>
      </div>
      {tab === 'leads' && <LeadsTab propertyId={propertyId} />}
      {tab === 'visits' && <VisitsTab filters={filters} />}
      {tab === 'activity' && <ActivityTab filters={filters} />}
      <p className="mt-6 flex items-center gap-2 text-xs text-ink-subtle"><Users className="h-4 w-4" aria-hidden />Offers are answered in the Offers page.</p>
    </>
  );
}
