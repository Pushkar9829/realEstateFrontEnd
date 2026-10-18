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
import { useT } from '@/shared/i18n';

const IST = 330 * 60000;
const istDay = (t) => new Date(t + IST).toISOString().slice(0, 10);
const RANGES = [7, 30, 90, 'custom'];
// With stats.smallCountMasking on, the API sends counts of 1 or 2 as '<3' so
// no single buyer can be inferred; the bar then shows a small stub.
const masked = (n, t) => (n === '<3' ? t('lister.stats.fewerThan3') : n);
const num = (n) => (typeof n === 'number' ? n : 0);

function Funnel({ funnel }) {
  const t = useT();
  const max = Math.max(1, ...funnel.map((f) => num(f.count)));
  return (
    <ul className="space-y-2">
      {funnel.map((f) => (
        <li key={f.stage} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="text-ink-muted">{STAGE_LABELS[f.stage] || f.stage}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-sunken">
            <span className={cn('block h-full rounded-full', f.stage === 'closed_lost' ? 'bg-line-strong' : 'bg-brand-500')} style={{ width: `${f.count === '<3' ? 4 : (num(f.count) / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium text-ink">{masked(f.count, t)}</span>
        </li>
      ))}
    </ul>
  );
}

function Locality({ locality }) {
  const t = useT();
  if (!locality) return <p className="text-sm text-ink-subtle">{t('lister.stats.notEnough')}</p>;
  const yours = locality.yourPricePerSqft;
  const diff = yours && locality.avgPricePerSqft ? Math.round(((yours - locality.avgPricePerSqft) / locality.avgPricePerSqft) * 100) : null;
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between"><dt className="text-ink-subtle">{t('lister.stats.yourPrice')}</dt><dd className="font-semibold text-ink">{yours ? rupees(yours) : '-'}</dd></div>
      <div className="flex justify-between"><dt className="text-ink-subtle">{t('lister.stats.avgPrice')}</dt><dd className="text-ink">{rupees(locality.avgPricePerSqft)}</dd></div>
      {diff != null && (
        <p className={cn('rounded-md px-3 py-2', Math.abs(diff) <= 10 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700')}>
          {diff === 0 ? t('lister.stats.priceMatches') : diff > 0 ? t('lister.stats.priceAbove', { pct: Math.abs(diff) }) : t('lister.stats.priceBelow', { pct: Math.abs(diff) })}
        </p>
      )}
      <div className="flex justify-between"><dt className="text-ink-subtle">{t('lister.stats.avgViews')}</dt><dd className="text-ink">{locality.avgViews}</dd></div>
      <p className="text-xs text-ink-subtle">{t('lister.stats.comparedWith', { n: locality.listings })}</p>
    </dl>
  );
}

export default function ListingStatsPage() {
  const t = useT();
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
    <PageHeader breadcrumb={<Link to="/lister/listings" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />{t('panel.nav.listerListings')}</Link>}
      title={data ? data.title || t('lister.stats.title') : t('lister.stats.title')}
      description={data ? <span className="inline-flex items-center gap-2">{data.listingNo}<Badge tone={listingStatus(data.status).tone}>{listingStatus(data.status).label}</Badge></span> : t('lister.stats.desc')} />
  );

  const rangePicker = (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="inline-flex rounded-md border bg-white p-0.5" role="group" aria-label={t('lister.stats.range')}>
        {RANGES.map((value) => ({ value, label: value === 'custom' ? t('lister.stats.custom') : t('lister.stats.days', { n: value }) })).map((r) => (
          <button key={r.value} type="button" aria-pressed={range === r.value} onClick={() => setRange(r.value)}
            className={cn('rounded px-3 py-1.5 text-sm font-medium', range === r.value ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-muted')}>{r.label}</button>
        ))}
      </div>
      {range === 'custom' && (
        <>
          <Input label={t('lister.stats.from')} type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Input label={t('lister.stats.to')} type="date" value={custom.to} min={custom.from} max={istDay(Date.now())} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} error={badRange ? t('lister.stats.badRange') : undefined} />
        </>
      )}
    </div>
  );

  if (isError) {
    return (<>{header}{error && error.status === 404
      ? <EmptyState icon={BarChart3} title={t('lister.stats.notFound')} action={<Button variant="secondary" to="/lister/listings">{t('lister.stats.back')}</Button>} />
      : <Alert tone="danger" title={t('lister.stats.loadError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}>{error && error.message}</Alert>}</>);
  }
  if (isLoading || !data) return (<>{header}{rangePicker}<div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="mt-6 h-64" /></>);

  const neverLive = ['draft', 'pending_approval', 'changes_requested', 'rejected'].includes(data.status);
  const c = data.counters || {};
  const rc = data.rangeCounters || null;
  const rangeLabel = t('lister.stats.rangeLabel', { from: date(data.from), to: date(data.to) });
  // Range counters exist for dated records; the rest are lifetime totals only.
  const both = (key, lifetime) => (rc && rc[key] != null
    ? { value: rc[key], hint: t('lister.stats.inRange', { n: lifetime }) }
    : { value: lifetime, hint: t('lister.stats.allTime') });
  const counters = [
    { label: t('lister.dashboard.views'), ...both('views', c.views || 0), icon: Eye, tone: 'brand' },
    { label: t('lister.dashboard.shortlists'), ...both('shortlists', c.shortlists || 0), icon: Heart, tone: 'accent' },
    { label: t('lister.dashboard.enquiries'), ...both('enquiries', c.enquiries || 0), icon: MessageSquare, tone: 'info' },
    { label: t('lister.dashboard.whatsappClicks'), value: c.whatsappClicks || 0, hint: t('lister.stats.allTime'), icon: MessageCircle, tone: 'success' },
    { label: t('lister.stats.visitRequests'), ...both('visits', c.visits || 0), icon: CalendarCheck, tone: 'info' },
    { label: t('lister.stats.visitsDone'), ...both('visitsDone', c.visitsDone || 0), icon: Footprints, tone: 'brand' },
    { label: t('lister.stats.offersReceived'), ...both('offersReceived', c.offersReceived || 0), icon: Handshake, tone: 'warning' },
    { label: t('lister.stats.avgInterest'), value: c.avgInterest != null ? `${c.avgInterest} / 5` : '-', hint: c.avgInterest == null ? t('lister.stats.interestHint') : t('lister.stats.allTime'), icon: Star, tone: 'accent' },
  ];
  const rangeViews = (data.viewsPerDay || []).reduce((a, d) => a + d.views, 0);

  return (
    <>
      {header}
      {neverLive && <Alert tone="info" className="mb-6" title={t('lister.stats.notLive')}>{t('lister.stats.notLiveText')}</Alert>}
      {rangePicker}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {counters.map((x) => <Stat key={x.label} label={x.label} value={x.value} hint={x.hint} icon={x.icon} tone={x.tone} />)}
      </div>
      <p className="mt-2 text-xs text-ink-subtle">{rc ? t('lister.stats.rangeNote', { range: rangeLabel }) : t('lister.stats.totalsNote')}</p>
      <Card className="mt-6">
        <CardHeader title={t('lister.stats.viewsPerDay')} description={t('lister.stats.viewsRange', { n: rangeViews, from: date(data.from), to: date(data.to) })} />
        <ViewsChart points={data.viewsPerDay} from={data.from} to={data.to} />
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('lister.stats.funnel')} description={t('lister.stats.funnelDesc')} />
          <Funnel funnel={data.funnel || []} />
        </Card>
        <Card>
          <CardHeader title={t('lister.stats.locality')} description={t('lister.stats.localityDesc')} />
          <Locality locality={data.locality} />
        </Card>
      </div>
      <p className="mt-6 text-sm text-ink-subtle">{t('lister.stats.outcomesIn')} <Link className="font-medium text-brand-700 hover:underline" to="/lister/leads">{t('panel.nav.listerLeads')}</Link>.</p>
    </>
  );
}
