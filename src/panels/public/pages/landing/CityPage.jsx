// RE-S-PUB-15 city landing page: live listings and average prices, purpose
// toggle, top listings, projects, localities with averages, FAQ and the
// request-a-property call to action.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Building2, ClipboardList, MapPin } from 'lucide-react';
import { rupees } from '@/shared/lib/format';
import { Accordion, Button } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import env from '@/config/env';
import { useCitySummary, useProjectSearch, useSearch } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import ProjectCard from '../../components/ProjectCard';
import { ArrowLink, CardGridSkeleton, DetailSkeleton, ErrorState, IMG, NotAvailable, PageBand, PublicEmpty, SectionTitle, Segmented } from '../../components/States';

export function PurposeToggle({ value, onChange, dark = false }) {
  const t = useT();
  return <Segmented value={value} onChange={onChange} dark={dark} label={t('home.search.purposeAria')} options={[{ value: 'sale', label: t('common.buy') }, { value: 'rent', label: t('common.rent') }]} />;
}

// Locality tile (city page and locality page "other localities").
export function LocalityTile({ to, name, meta, value }) {
  return (
    <Link to={to} className="group flex flex-col justify-between rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-lg font-medium leading-snug text-navy-900 transition-colors group-hover:text-gold-700">{name}</span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-navy-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-700" aria-hidden />
      </span>
      <span className="mt-4 block">
        <span className="block text-sm font-semibold text-navy-700">{value}</span>
        {meta && <span className="mt-0.5 block text-xs text-navy-500">{meta}</span>}
      </span>
    </Link>
  );
}

// Navy request-a-property card with a decorative photo.
export function RequestCard({ title, text, to, cta }) {
  return (
    <div className="relative isolate self-start overflow-hidden rounded-3xl bg-navy-900 p-7 shadow-lift">
      <img src={IMG('living-warm')} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/85 to-navy-950/40" aria-hidden />
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-gold-300 ring-1 ring-white/15"><ClipboardList className="h-5 w-5" aria-hidden /></span>
      <p className="mt-5 font-display text-2xl font-medium leading-tight text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-navy-200">{text}</p>
      <Button variant="gold" size="lg" className="mt-6 rounded-full" iconRight={ArrowRight} to={to}>{cta}</Button>
    </div>
  );
}

export const avgFor = (row, purpose) => (purpose === 'rent' ? row.avgMonthlyRent : row.avgPricePerSqft);
export const avgText = (t, v, purpose) => (v ? t(purpose === 'rent' ? 'home.place.avgMonth' : 'home.place.avgSqft', { price: rupees(v) }) : '-');

export function placeFaq(t, place, purpose) {
  return [
    { q: t('home.place.faq.q1', { place }), a: t('home.place.faq.a1', { place }) },
    { q: t(purpose === 'rent' ? 'home.place.faq.q2Rent' : 'home.place.faq.q2Sale'), a: t('home.place.faq.a2') },
    { q: t('home.place.faq.q3'), a: t('home.place.faq.a3', { hotline: env.hotline }) },
  ];
}

export default function CityPage() {
  const t = useT();
  const { city } = useParams();
  const [purpose, setPurpose] = useState('sale');
  const q = useCitySummary(city);
  const c = q.data && q.data.city;
  const listings = useSearch({ city, purpose, limit: 9 });
  const projects = useProjectSearch(c ? { city: c.name, limit: 3 } : { limit: 3 });
  useDocumentMeta({
    title: c ? t('home.city.meta.title', { city: c.name }) : undefined,
    description: c ? t('home.city.meta.description', { city: c.name }) : undefined,
    path: `/city/${city}`,
  });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title={t('home.city.notFound')} description={t('home.city.notFoundText')} action={<Button variant="gold" size="lg" className="rounded-full" to="/search">{t('home.city.browseAll')}</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-14"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const stats = d.stats[purpose];
  const items = (listings.data && listings.data.items) || [];

  const avg = avgFor(stats, purpose);
  const seeAll = `/search?purpose=${purpose}&city=${c.code}`;

  return (
    <>
      <PageBand image={c.code === 'pune' ? 'pune-aerial' : 'towers-night'} crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { label: c.name }]}
        eyebrow={[t('discover.city.eyebrow'), c.state].filter(Boolean).join(' · ')}
        title={t(purpose === 'rent' ? 'home.place.titleRent' : 'home.place.titleSale', { place: c.name })}
        text={t('home.city.subtitle')}
        actions={<PurposeToggle dark value={purpose} onChange={setPurpose} />}
        stats={[
          { label: t('home.place.liveListings'), value: stats.listings.toLocaleString('en-IN') },
          { label: purpose === 'rent' ? t('home.place.avgRent') : t('home.place.avgPrice'), value: avgText(t, avg, purpose), hint: avg ? t('home.city.avgHint') : t('home.place.shownOnce', { n: d.stats.minDataPoints }) },
          { label: t('discover.city.localities'), value: d.localities.length.toLocaleString('en-IN') },
        ]}>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="gold" size="lg" to={seeAll} iconRight={ArrowRight} className="rounded-full">{t(purpose === 'rent' ? 'home.city.seeAllRent' : 'home.city.seeAllSale', { city: c.name })}</Button>
          <Button variant="glass" size="lg" to={`/city/${c.code}/localities`} className="rounded-full">{t('home.city.compare')}</Button>
        </div>
      </PageBand>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionTitle title={t('home.city.latestIn', { city: c.name })} action={<ArrowLink to={seeAll}>{t('common.viewAll')}</ArrowLink>} />
        {listings.isLoading ? <CardGridSkeleton count={3} /> : listings.isError ? <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
          : items.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((x) => <PropertyCard key={x.id} card={x} />)}</div>
          : <PublicEmpty icon={Building2} title={t(purpose === 'rent' ? 'home.city.noneRent' : 'home.city.noneSale')} action={<Button variant="gold" size="lg" className="rounded-full" to={`/request-property?purpose=${purpose}&city=${c.code}`}>{t('home.city.tellUs')}</Button>} />}
      </section>

      {d.localities.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionTitle title={t('home.city.localitiesIn', { city: c.name })} action={<ArrowLink to={`/city/${c.code}/localities`}>{t('home.city.allLocalities')}</ArrowLink>} />
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {d.localities.map((l) => (
                <LocalityTile key={l.id} to={`/city/${c.code}/${l.code}`} name={l.name} value={avgText(t, avgFor(l, purpose), purpose)} meta={t('home.city.live', { n: purpose === 'rent' ? l.rentListings : l.saleListings })} />
              ))}
            </div>
          </div>
        </section>
      )}

      {purpose === 'sale' && ((projects.data && projects.data.items) || []).length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle title={t('home.city.projectsIn', { city: c.name })} action={<ArrowLink to={`/projects?city=${encodeURIComponent(c.name)}`}>{t('home.city.allProjects')}</ArrowLink>} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{projects.data.items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-4 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div><SectionTitle title={t('home.place.questions')} /><Accordion items={placeFaq(t, c.name, purpose)} /></div>
        <RequestCard title={t('home.place.requestIn', { place: c.name })} text={t('home.city.requestText')} to={`/request-property?purpose=${purpose}&city=${c.code}`} cta={t('home.place.requestCta')} />
      </section>
    </>
  );
}
