// RE-S-PUB-15 city landing page: live listings and average prices, purpose
// toggle, top listings, projects, localities with averages, FAQ and the
// request-a-property call to action.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { rupees } from '@/shared/lib/format';
import { Accordion, Button, Card, Stat } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import env from '@/config/env';
import { useCitySummary, useProjectSearch, useSearch } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import ProjectCard from '../../components/ProjectCard';
import { CardGridSkeleton, DetailSkeleton, ErrorState, NotAvailable, SectionTitle } from '../../components/States';

export function PurposeToggle({ value, onChange }) {
  const t = useT();
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-white p-0.5" role="tablist" aria-label={t('home.search.purposeAria')}>
      {[['sale', 'common.buy'], ['rent', 'common.rent']].map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={cn('rounded px-4 py-1.5 text-sm font-medium', value === v ? 'bg-brand-600 text-white' : 'text-ink-muted hover:text-ink')}>{t(l)}</button>
      ))}
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
  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title={t('home.city.notFound')} description={t('home.city.notFoundText')} action={<Button to="/search">{t('home.city.browseAll')}</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const stats = d.stats[purpose];
  const items = (listings.data && listings.data.items) || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-3 text-xs text-ink-subtle" aria-label={t('home.place.breadcrumbAria')}><Link to="/" className="hover:text-ink">{t('home.place.home')}</Link> / <span className="text-ink">{c.name}</span></nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{t(purpose === 'rent' ? 'home.place.titleRent' : 'home.place.titleSale', { place: c.name })}</h1>
          <p className="mt-1 text-sm text-ink-muted">{c.state ? `${c.state} · ` : ''}{t('home.city.subtitle')}</p>
        </div>
        <PurposeToggle value={purpose} onChange={setPurpose} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t('home.place.liveListings')} value={stats.listings.toLocaleString('en-IN')} icon={Building2} />
        <Stat label={purpose === 'rent' ? t('home.place.avgRent') : t('home.place.avgPrice')} value={avgText(t, avgFor(stats, purpose), purpose)} hint={avgFor(stats, purpose) ? t('home.city.avgHint') : t('home.place.shownOnce', { n: d.stats.minDataPoints })} tone="accent" />
        <Card className="flex flex-col justify-center gap-2">
          <Button to={`/search?purpose=${purpose}&city=${c.code}`} iconRight={ArrowRight}>{t(purpose === 'rent' ? 'home.city.seeAllRent' : 'home.city.seeAllSale', { city: c.name })}</Button>
          <Button variant="secondary" to={`/city/${c.code}/localities`}>{t('home.city.compare')}</Button>
        </Card>
      </div>

      <section className="mt-10">
        <SectionTitle title={t('home.city.latestIn', { city: c.name })} action={<Link to={`/search?purpose=${purpose}&city=${c.code}`} className="text-sm font-medium text-brand-700 hover:underline">{t('common.viewAll')}</Link>} />
        {listings.isLoading ? <CardGridSkeleton count={3} /> : listings.isError ? <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
          : items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((x) => <PropertyCard key={x.id} card={x} />)}</div>
          : <p className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-ink-muted">{t(purpose === 'rent' ? 'home.city.noneRent' : 'home.city.noneSale')} <Link to={`/request-property?purpose=${purpose}&city=${c.code}`} className="font-medium text-brand-700">{t('home.city.tellUs')}</Link></p>}
      </section>

      {d.localities.length > 0 && (
        <section className="mt-10">
          <SectionTitle title={t('home.city.localitiesIn', { city: c.name })} action={<Link to={`/city/${c.code}/localities`} className="text-sm font-medium text-brand-700 hover:underline">{t('home.city.allLocalities')}</Link>} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {d.localities.map((l) => (
              <Link key={l.id} to={`/city/${c.code}/${l.code}`} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="mt-1 text-xs text-ink-subtle">{t('home.city.live', { n: purpose === 'rent' ? l.rentListings : l.saleListings })}</p>
                <p className="mt-1 text-sm text-ink-muted">{avgText(t, avgFor(l, purpose), purpose)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {purpose === 'sale' && ((projects.data && projects.data.items) || []).length > 0 && (
        <section className="mt-10">
          <SectionTitle title={t('home.city.projectsIn', { city: c.name })} action={<Link to={`/projects?city=${encodeURIComponent(c.name)}`} className="text-sm font-medium text-brand-700 hover:underline">{t('home.city.allProjects')}</Link>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.data.items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
        </section>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div><SectionTitle title={t('home.place.questions')} /><Accordion items={placeFaq(t, c.name, purpose)} /></div>
        <Card className="self-start bg-brand-50">
          <ClipboardList className="h-6 w-6 text-brand-600" aria-hidden />
          <p className="mt-2 font-semibold text-ink">{t('home.place.requestIn', { place: c.name })}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('home.city.requestText')}</p>
          <Button className="mt-4" to={`/request-property?purpose=${purpose}&city=${c.code}`}>{t('home.place.requestCta')}</Button>
        </Card>
      </section>
    </div>
  );
}
