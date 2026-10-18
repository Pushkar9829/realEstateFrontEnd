// RE-S-LIS-09 listing performance: views per day (plain SVG), counters for
// the chosen range next to the lifetime totals,
// enquiry funnel by stage (counts only) and the locality comparison.
// No buyer names, phones, emails or lead numbers anywhere on this page.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarCheck, Eye, Handshake, Heart, MessageCircle, MessageSquare, Star, Footprints } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Skeleton, Stat } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, rupees } from '@/shared/lib/format';
import { listingStatus } from '@/modules/listings/api';
import { STAGE_LABELS, useListingStats } from '@/modules/reports/listerApi';
import ViewsChart from '../../components/ViewsChart';

const IST = 330 * 60000;
const istDay = (t) => new Date(t + IST).toISOString().slice(0, 10);
const RANGES = [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 'custom', label: 'Custom' }];
// With stats.smallCountMasking on, the API sends counts of 1 or 2 as '<3' so
// no single buyer can be inferred; the bar then shows a small stub.
const masked = (n) => (n === '<3' ? 'fewer than 3' : n);
const num = (n) => (typeof n === 'number' ? n : 0);

function Funnel({ funnel }) {
  const max = Math.max(1, ...funnel.map((f) => num(f.count)));
  return (
    <ul className="space-y-2">
      {funnel.map((f) => (
        <li key={f.stage} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="text-ink-muted">{STAGE_LABELS[f.stage] || f.stage}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-sunken">
            <span className={cn('block h-full rounded-full', f.stage === 'closed_lost' ? 'bg-line-strong' : 'bg-brand-500')} style={{ width: `${f.count === '<3' ? 4 : (num(f.count) / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium text-ink">{masked(f.count)}</span>
        </li>
      ))}
    </ul>
  );
}

function Locality({ locality }) {
  if (!locality) return <p className="text-sm text-ink-subtle">Not enough live listings in this locality to compare yet (at least 3 needed).</p>;
  const yours = locality.yourPricePerSqft;
  const diff = yours && locality.avgPricePerSqft ? Math.round(((yours - locality.avgPricePerSqft) / locality.avgPricePerSqft) * 100) : null;
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between"><dt className="text-ink-subtle">Your price per sq ft</dt><dd className="font-semibold text-ink">{yours ? rupees(yours) : '-'}</dd></div>
      <div className="flex justify-between"><dt className="text-ink-subtle">Locality average per sq ft</dt><dd className="text-ink">{rupees(locality.avgPricePerSqft)}</dd></div>
      {diff != null && (
        <p className={cn('rounded-md px-3 py-2', Math.abs(diff) <= 10 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700')}>
          {diff === 0 ? 'Your price matches the locality average.' : `Your price is ${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'} the locality average.`}
        </p>
      )}
      <div className="flex justify-between"><dt className="text-ink-subtle">Average views of similar listings</dt><dd className="text-ink">{locality.avgViews}</dd></div>
      <p className="text-xs text-ink-subtle">Compared with {locality.listings} live listings for the same purpose in your locality.</p>
    </dl>
  );
}

export default function ListingStatsPage() {
  const { id } = useParams();
  const [range, setRange] = useState(30);
  const [custom, setCustom] = useState({ from: istDay(Date.now() - 30 * 86400000), to: istDay(Date.now()) });
  const params = useMemo(() => {
    if (range === 'custom') return { from: `${custom.from}T00:00:00+05:30`, to: `${custom.to}T23:59:59+05:30` };
    const now = Date.now();
    return { from: `${istDay(now - range * 86400000)}T00:00:00+05:30`, to: `${istDay(now)}T23:59:59+05:30` };
  }, [range, custom]);
  const badRange = range === 'custom' && (!custom.from || !custom.to || custom.from > custom.to);
  const { data, isLoading, isError, error, refetch } = useListingStats(badRange ? null : id, params);

  const header = (
    <PageHeader breadcrumb={<Link to="/lister/listings" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />My listings</Link>}
      title={data ? data.title || 'Listing performance' : 'Listing performance'}
      description={data ? <span className="inline-flex items-center gap-2">{data.listingNo}<Badge tone={listingStatus(data.status).tone}>{listingStatus(data.status).label}</Badge></span> : 'Aggregate numbers only; buyers stay private.'} />
  );

  const rangePicker = (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="inline-flex rounded-md border bg-white p-0.5" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => setRange(r.value)}
            className={cn('rounded px-3 py-1.5 text-sm font-medium', range === r.value ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-muted')}>{r.label}</button>
        ))}
      </div>
      {range === 'custom' && (
        <>
          <Input label="From" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Input label="To" type="date" value={custom.to} min={custom.from} max={istDay(Date.now())} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} error={badRange ? 'Pick a valid range' : undefined} />
        </>
      )}
    </div>
  );

  if (isError) {
    return (<>{header}{error && error.status === 404
      ? <EmptyState icon={BarChart3} title="Listing not found" action={<Button variant="secondary" to="/lister/listings">Back to my listings</Button>} />
      : <Alert tone="danger" title="Could not load the stats" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>}>{error && error.message}</Alert>}</>);
  }
  if (isLoading || !data) return (<>{header}{rangePicker}<div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="mt-6 h-64" /></>);

  const neverLive = ['draft', 'pending_approval', 'changes_requested', 'rejected'].includes(data.status);
  const c = data.counters || {};
  const rc = data.rangeCounters || null;
  const rangeLabel = `${date(data.from)} to ${date(data.to)}`;
  // Range counters exist for dated records; the rest are lifetime totals only.
  const both = (key, lifetime) => (rc && rc[key] != null
    ? { value: rc[key], hint: `In range · ${lifetime} all time` }
    : { value: lifetime, hint: 'All time' });
  const counters = [
    { label: 'Views', ...both('views', c.views || 0), icon: Eye, tone: 'brand' },
    { label: 'Shortlists', ...both('shortlists', c.shortlists || 0), icon: Heart, tone: 'accent' },
    { label: 'Enquiries', ...both('enquiries', c.enquiries || 0), icon: MessageSquare, tone: 'info' },
    { label: 'WhatsApp clicks', value: c.whatsappClicks || 0, hint: 'All time', icon: MessageCircle, tone: 'success' },
    { label: 'Visit requests', ...both('visits', c.visits || 0), icon: CalendarCheck, tone: 'info' },
    { label: 'Visits done', ...both('visitsDone', c.visitsDone || 0), icon: Footprints, tone: 'brand' },
    { label: 'Offers received', ...both('offersReceived', c.offersReceived || 0), icon: Handshake, tone: 'warning' },
    { label: 'Avg interest after visits', value: c.avgInterest != null ? `${c.avgInterest} / 5` : '-', hint: c.avgInterest == null ? 'Shown after 3 buyer feedbacks' : 'All time', icon: Star, tone: 'accent' },
  ];
  const rangeViews = (data.viewsPerDay || []).reduce((a, d) => a + d.views, 0);

  return (
    <>
      {header}
      {neverLive && <Alert tone="info" className="mb-6" title="Stats appear once your listing is live">Numbers below fill in after approval.</Alert>}
      {rangePicker}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {counters.map((x) => <Stat key={x.label} label={x.label} value={x.value} hint={x.hint} icon={x.icon} tone={x.tone} />)}
      </div>
      <p className="mt-2 text-xs text-ink-subtle">{rc ? `Big numbers are for ${rangeLabel}; "all time" is the total since the listing went live. WhatsApp clicks and interest are all-time only.` : 'Counters are totals since the listing went live.'}</p>
      <Card className="mt-6">
        <CardHeader title="Views per day" description={`${rangeViews} views from ${date(data.from)} to ${date(data.to)}`} />
        <ViewsChart points={data.viewsPerDay} from={data.from} to={data.to} />
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Enquiry funnel" description="Leads on this listing by stage. Counts only." />
          <Funnel funnel={data.funnel || []} />
        </Card>
        <Card>
          <CardHeader title="Your locality" description="How this listing compares with similar live listings nearby." />
          <Locality locality={data.locality} />
        </Card>
      </div>
      <p className="mt-6 text-sm text-ink-subtle">Visit outcomes shared by our agents are in <Link className="font-medium text-brand-700 hover:underline" to="/lister/leads">Leads and visits</Link>.</p>
    </>
  );
}
