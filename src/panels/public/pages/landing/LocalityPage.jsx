// RE-S-PUB-15 locality landing page with price trends (RE-E-17): stats,
// 12-month trend chart, 1-year change, top listings, nearby localities,
// FAQ and "Request a property in <locality>".
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, MapPin, TrendingUp } from 'lucide-react';
import { Accordion, Button, Card, Stat } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useLocalitiesIndex, useLocalitySummary, useSearch } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import TrendChart, { ChangePill } from '../../components/TrendChart';
import { CardGridSkeleton, DetailSkeleton, ErrorState, NotAvailable, SectionTitle } from '../../components/States';
import { PurposeToggle, avgFor, avgText, placeFaq } from './CityPage';

export default function LocalityPage() {
  const t = useT();
  const { city, locality } = useParams();
  const [purpose, setPurpose] = useState('sale');
  const q = useLocalitySummary(city, locality);
  const index = useLocalitiesIndex(city);
  const d = q.data;
  const listings = useSearch(d ? { city: d.city.code, localities: d.locality.code, purpose, limit: 9 } : { city, localities: locality, purpose, limit: 9 });
  const metaVars = d ? { locality: d.locality.name, city: d.city.name } : null;
  useDocumentMeta({
    title: metaVars ? t('home.locality.meta.title', metaVars) : undefined,
    description: metaVars ? t('home.locality.meta.description', metaVars) : undefined,
    path: `/city/${city}/${locality}`,
  });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title={t('home.locality.notFound')} description={t('home.locality.notFoundText')} action={<Button to={`/city/${city}`}>{t('home.locality.browseCity')}</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const stats = d.stats[purpose];
  const series = (d.trend && d.trend[purpose]) || [];
  const change = d.trend && d.trend.oneYearChangePct && d.trend.oneYearChangePct[purpose];
  const points = series.reduce((a, s) => a + (s.dataPoints || 0), 0);
  const items = (listings.data && listings.data.items) || [];
  const nearby = ((index.data) || []).filter((l) => l.code !== d.locality.code).slice(0, 8);
  const place = `${d.locality.name}, ${d.city.name}`;
  const name = d.locality.name;
  const searchLink = `/search?purpose=${purpose}&city=${d.city.code}&localities=${d.locality.code}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-3 text-xs text-ink-subtle" aria-label={t('home.place.breadcrumbAria')}><Link to="/" className="hover:text-ink">{t('home.place.home')}</Link> / <Link to={`/city/${d.city.code}`} className="hover:text-ink">{d.city.name}</Link> / <span className="text-ink">{d.locality.name}</span></nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{t(purpose === 'rent' ? 'home.place.titleRent' : 'home.place.titleSale', { place })}</h1>
        <PurposeToggle value={purpose} onChange={setPurpose} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t('home.place.liveListings')} value={stats.listings.toLocaleString('en-IN')} icon={Building2} />
        <Stat label={purpose === 'rent' ? t('home.place.avgRent') : t('home.place.avgPrice')} value={avgText(t, avgFor(stats, purpose), purpose)} hint={avgFor(stats, purpose) ? t('home.locality.indicative') : t('home.place.shownOnce', { n: d.stats.minDataPoints })} tone="accent" />
        <Stat label={t('home.locality.change')} value={<ChangePill pct={change} />} icon={TrendingUp} tone="success" hint={purpose === 'rent' ? t('home.locality.hintRent') : t('home.locality.hintSale')} />
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{purpose === 'rent' ? t('home.locality.trendRent') : t('home.locality.trendPrice')}</h2>
          {series.length > 0 && <p className="text-xs text-ink-subtle">{t('home.locality.basedOn', { n: points.toLocaleString('en-IN') })}</p>}
        </div>
        {series.length >= 2 ? <TrendChart series={series} /> : <p className="rounded-md bg-surface-muted p-6 text-center text-sm text-ink-muted">{t('home.locality.notEnough', { place: name })}</p>}
        <p className="mt-2 text-xs text-ink-subtle">{t('home.locality.disclaimer')}</p>
      </Card>

      <section className="mt-10">
        <SectionTitle title={t('home.locality.topIn', { place: name })} action={<Link to={searchLink} className="text-sm font-medium text-brand-700 hover:underline">{t('common.viewAll')}</Link>} />
        {listings.isLoading ? <CardGridSkeleton count={3} /> : listings.isError ? <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
          : items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((x) => <PropertyCard key={x.id} card={x} />)}</div>
          : <p className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-ink-muted">{t('home.locality.nothing', { place: name })}</p>}
        {items.length > 0 && <div className="mt-4"><Button variant="secondary" to={searchLink} iconRight={ArrowRight}>{t(purpose === 'rent' ? 'home.locality.allRent' : 'home.locality.allSale', { place: name })}</Button></div>}
      </section>

      {nearby.length > 0 && (
        <section className="mt-10">
          <SectionTitle title={t('home.locality.other')} action={<Link to={`/city/${d.city.code}/localities`} className="text-sm font-medium text-brand-700 hover:underline">{t('home.locality.compareAll')}</Link>} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {nearby.map((l) => (
              <Link key={l.id} to={`/city/${d.city.code}/${l.code}`} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand-300">
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="mt-1 text-sm text-ink-muted">{avgText(t, avgFor(l, purpose), purpose)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div><SectionTitle title={t('home.place.questions')} /><Accordion items={placeFaq(t, name, purpose)} /></div>
        <Card className="self-start bg-brand-50">
          <ClipboardList className="h-6 w-6 text-brand-600" aria-hidden />
          <p className="mt-2 font-semibold text-ink">{t('home.place.requestIn', { place: name })}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('home.locality.requestText')}</p>
          <Button className="mt-4" to={`/request-property?purpose=${purpose}&city=${d.city.code}&localities=${d.locality.code}`}>{t('home.place.requestCta')}</Button>
        </Card>
      </section>
    </div>
  );
}
