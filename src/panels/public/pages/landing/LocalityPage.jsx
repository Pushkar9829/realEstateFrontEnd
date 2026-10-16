// RE-S-PUB-15 locality landing page with price trends (RE-E-17): stats,
// 12-month trend chart, 1-year change, top listings, nearby localities,
// FAQ and "Request a property in <locality>".
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, MapPin } from 'lucide-react';
import { Accordion, Button } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useLocalitiesIndex, useLocalitySummary, useSearch } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import TrendChart from '../../components/TrendChart';
import { ArrowLink, CardGridSkeleton, DetailSkeleton, ErrorState, Eyebrow, NotAvailable, PageBand, PublicEmpty, SectionTitle } from '../../components/States';
import { LocalityTile, PurposeToggle, RequestCard, avgFor, avgText, placeFaq } from './CityPage';

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
  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title={t('home.locality.notFound')} description={t('home.locality.notFoundText')} action={<Button variant="gold" size="lg" className="rounded-full" to={`/city/${city}`}>{t('home.locality.browseCity')}</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-14"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const stats = d.stats[purpose];
  const series = (d.trend && d.trend[purpose]) || [];
  const change = d.trend && d.trend.oneYearChangePct && d.trend.oneYearChangePct[purpose];
  const points = series.reduce((a, s) => a + (s.dataPoints || 0), 0);
  const items = (listings.data && listings.data.items) || [];
  const nearby = ((index.data) || []).filter((l) => l.code !== d.locality.code).slice(0, 8);
  const place = `${d.locality.name}, ${d.city.name}`;
  const name = d.locality.name;
  const searchLink = `/search?purpose=${purpose}&city=${d.city.code}&localities=${d.locality.code}`;

  const avg = avgFor(stats, purpose);
  const changeValue = change == null ? '-' : <span className={change >= 0 ? 'text-success-100' : 'text-danger-100'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change)}%</span>;

  return (
    <>
      <PageBand image={d.city.code === 'pune' ? 'pune-street' : 'podium-garden'} crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { to: `/city/${d.city.code}`, label: d.city.name }, { label: d.locality.name }]}
        eyebrow={`${t('discover.locality.eyebrow')} · ${d.city.name}`}
        title={t(purpose === 'rent' ? 'home.place.titleRent' : 'home.place.titleSale', { place })}
        actions={<PurposeToggle dark value={purpose} onChange={setPurpose} />}
        stats={[
          { label: t('home.place.liveListings'), value: stats.listings.toLocaleString('en-IN') },
          { label: purpose === 'rent' ? t('home.place.avgRent') : t('home.place.avgPrice'), value: avgText(t, avg, purpose), hint: avg ? t('home.locality.indicative') : t('home.place.shownOnce', { n: d.stats.minDataPoints }) },
          { label: t('home.locality.change'), value: changeValue, hint: purpose === 'rent' ? t('home.locality.hintRent') : t('home.locality.hintSale') },
        ]} />

      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:pt-16">
        <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-900/5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>{t('discover.locality.chartEyebrow')}</Eyebrow>
              <h2 className="mt-3 font-display text-2xl font-medium text-navy-900">{purpose === 'rent' ? t('home.locality.trendRent') : t('home.locality.trendPrice')}</h2>
            </div>
            {series.length > 0 && <p className="text-xs text-navy-400">{t('home.locality.basedOn', { n: points.toLocaleString('en-IN') })}</p>}
          </div>
          {series.length >= 2 ? <TrendChart series={series} /> : <p className="rounded-2xl bg-sand-100 p-8 text-center text-sm text-navy-500">{t('home.locality.notEnough', { place: name })}</p>}
          <p className="mt-4 text-xs text-navy-400">{t('home.locality.disclaimer')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle title={t('home.locality.topIn', { place: name })} action={<ArrowLink to={searchLink}>{t('common.viewAll')}</ArrowLink>} />
        {listings.isLoading ? <CardGridSkeleton count={3} /> : listings.isError ? <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
          : items.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((x) => <PropertyCard key={x.id} card={x} />)}</div>
          : <PublicEmpty icon={Building2} title={t('home.locality.nothing', { place: name })} />}
        {items.length > 0 && <div className="mt-8"><Button variant="navy" size="lg" className="rounded-full" to={searchLink} iconRight={ArrowRight}>{t(purpose === 'rent' ? 'home.locality.allRent' : 'home.locality.allSale', { place: name })}</Button></div>}
      </section>

      {nearby.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionTitle title={t('home.locality.other')} action={<ArrowLink to={`/city/${d.city.code}/localities`}>{t('home.locality.compareAll')}</ArrowLink>} />
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-4">
              {nearby.map((l) => <LocalityTile key={l.id} to={`/city/${d.city.code}/${l.code}`} name={l.name} value={avgText(t, avgFor(l, purpose), purpose)} />)}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_380px] lg:py-20">
        <div><SectionTitle title={t('home.place.questions')} /><Accordion items={placeFaq(t, name, purpose)} /></div>
        <RequestCard title={t('home.place.requestIn', { place: name })} text={t('home.locality.requestText')} to={`/request-property?purpose=${purpose}&city=${d.city.code}&localities=${d.locality.code}`} cta={t('home.place.requestCta')} />
      </section>
    </>
  );
}
