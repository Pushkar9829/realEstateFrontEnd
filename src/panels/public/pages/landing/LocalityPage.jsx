// RE-S-PUB-15 locality landing page with price trends (RE-E-17): stats,
// 12-month trend chart, 1-year change, top listings, nearby localities,
// FAQ and "Request a property in <locality>".
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, MapPin, TrendingUp } from 'lucide-react';
import { Accordion, Button, Card, Stat } from '@/shared/ui';
import env from '@/config/env';
import { useLocalitiesIndex, useLocalitySummary, useSearch } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import TrendChart, { ChangePill } from '../../components/TrendChart';
import { CardGridSkeleton, DetailSkeleton, ErrorState, NotAvailable, SectionTitle } from '../../components/States';
import { PurposeToggle, avgFor, avgText, placeFaq } from './CityPage';

export default function LocalityPage() {
  const { city, locality } = useParams();
  const [purpose, setPurpose] = useState('sale');
  const q = useLocalitySummary(city, locality);
  const index = useLocalitiesIndex(city);
  const d = q.data;
  const listings = useSearch(d ? { city: d.city.code, localities: d.locality.code, purpose, limit: 9 } : { city, localities: locality, purpose, limit: 9 });
  useEffect(() => { if (d) document.title = `Properties in ${d.locality.name}, ${d.city.name} | ${env.appName}`; }, [d]);

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title="Locality not found" description="Check the spelling or browse the city." action={<Button to={`/city/${city}`}>Browse the city</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const stats = d.stats[purpose];
  const series = (d.trend && d.trend[purpose]) || [];
  const change = d.trend && d.trend.oneYearChangePct && d.trend.oneYearChangePct[purpose];
  const points = series.reduce((a, s) => a + (s.dataPoints || 0), 0);
  const items = (listings.data && listings.data.items) || [];
  const nearby = ((index.data) || []).filter((l) => l.code !== d.locality.code).slice(0, 8);
  const place = `${d.locality.name}, ${d.city.name}`;
  const searchLink = `/search?purpose=${purpose}&city=${d.city.code}&localities=${d.locality.code}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-3 text-xs text-ink-subtle" aria-label="Breadcrumb"><Link to="/" className="hover:text-ink">Home</Link> / <Link to={`/city/${d.city.code}`} className="hover:text-ink">{d.city.name}</Link> / <span className="text-ink">{d.locality.name}</span></nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Properties for {purpose === 'rent' ? 'rent' : 'sale'} in {place}</h1>
        <PurposeToggle value={purpose} onChange={setPurpose} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Live listings" value={stats.listings.toLocaleString('en-IN')} icon={Building2} />
        <Stat label={purpose === 'rent' ? 'Average monthly rent' : 'Average price per sq ft'} value={avgText(avgFor(stats, purpose), purpose)} hint={avgFor(stats, purpose) ? 'Indicative' : `Shown once ${d.stats.minDataPoints} listings are live`} tone="accent" />
        <Stat label="1-year change" value={<ChangePill pct={change} />} icon={TrendingUp} tone="success" hint={purpose === 'rent' ? 'Rent per sq ft' : 'Asking price per sq ft'} />
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{purpose === 'rent' ? 'Rent' : 'Price'} trend, last 12 months</h2>
          {series.length > 0 && <p className="text-xs text-ink-subtle">Based on {points.toLocaleString('en-IN')} data points from live listings and verified deals</p>}
        </div>
        {series.length >= 2 ? <TrendChart series={series} /> : <p className="rounded-md bg-surface-muted p-6 text-center text-sm text-ink-muted">Not enough data yet for {d.locality.name}.</p>}
        <p className="mt-2 text-xs text-ink-subtle">Figures are indicative, based on listings and deals on this platform. Individual deal prices are never shown.</p>
      </Card>

      <section className="mt-10">
        <SectionTitle title={`Top listings in ${d.locality.name}`} action={<Link to={searchLink} className="text-sm font-medium text-brand-700 hover:underline">View all</Link>} />
        {listings.isLoading ? <CardGridSkeleton count={3} /> : listings.isError ? <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
          : items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((x) => <PropertyCard key={x.id} card={x} />)}</div>
          : <p className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-ink-muted">Nothing live in {d.locality.name} right now. Try a nearby locality below.</p>}
        {items.length > 0 && <div className="mt-4"><Button variant="secondary" to={searchLink} iconRight={ArrowRight}>All {purpose === 'rent' ? 'rentals' : 'homes'} in {d.locality.name}</Button></div>}
      </section>

      {nearby.length > 0 && (
        <section className="mt-10">
          <SectionTitle title="Other localities" action={<Link to={`/city/${d.city.code}/localities`} className="text-sm font-medium text-brand-700 hover:underline">Compare all</Link>} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {nearby.map((l) => (
              <Link key={l.id} to={`/city/${d.city.code}/${l.code}`} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand-300">
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="mt-1 text-sm text-ink-muted">{avgText(avgFor(l, purpose), purpose)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div><SectionTitle title="Questions" /><Accordion items={placeFaq(d.locality.name, purpose)} /></div>
        <Card className="self-start bg-brand-50">
          <ClipboardList className="h-6 w-6 text-brand-600" aria-hidden />
          <p className="mt-2 font-semibold text-ink">Request a property in {d.locality.name}</p>
          <p className="mt-1 text-sm text-ink-muted">Our team calls you with options that match your budget.</p>
          <Button className="mt-4" to={`/request-property?purpose=${purpose}&city=${d.city.code}&localities=${d.locality.code}`}>Request a property</Button>
        </Card>
      </section>
    </div>
  );
}
