// RE-S-PUB-15 city landing page: live listings and average prices, purpose
// toggle, top listings, projects, localities with averages, FAQ and the
// request-a-property call to action.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { rupees } from '@/shared/lib/format';
import { Accordion, Button, Card, Stat } from '@/shared/ui';
import env from '@/config/env';
import { useCitySummary, useProjectSearch, useSearch } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import ProjectCard from '../../components/ProjectCard';
import { CardGridSkeleton, DetailSkeleton, ErrorState, NotAvailable, SectionTitle } from '../../components/States';

export function PurposeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-white p-0.5" role="tablist" aria-label="Purpose">
      {[['sale', 'Buy'], ['rent', 'Rent']].map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={cn('rounded px-4 py-1.5 text-sm font-medium', value === v ? 'bg-brand-600 text-white' : 'text-ink-muted hover:text-ink')}>{l}</button>
      ))}
    </div>
  );
}

export const avgFor = (row, purpose) => (purpose === 'rent' ? row.avgMonthlyRent : row.avgPricePerSqft);
export const avgText = (v, purpose) => (v ? `${rupees(v)}${purpose === 'rent' ? ' / month' : ' / sq ft'}` : '-');

export function placeFaq(place, purpose) {
  return [
    { q: `How do I find a broker-free home in ${place}?`, a: `Every listing in ${place} comes from a KYC-verified owner, builder or landlord. Enquire on any listing and our in-house sales team arranges the visit; you never pay brokerage.` },
    { q: `How are the average ${purpose === 'rent' ? 'rents' : 'prices'} calculated?`, a: 'They are indicative, based on live listings and verified deals on this platform. Figures appear only when there are at least 5 data points.' },
    { q: 'Can you find something that is not listed yet?', a: `Yes. Tell us what you need and our team will call you with matching options. You can also call ${env.hotline}.` },
  ];
}

export default function CityPage() {
  const { city } = useParams();
  const [purpose, setPurpose] = useState('sale');
  const q = useCitySummary(city);
  const c = q.data && q.data.city;
  const listings = useSearch({ city, purpose, limit: 9 });
  const projects = useProjectSearch(c ? { city: c.name, limit: 3 } : { limit: 3 });
  useEffect(() => { if (c) document.title = `Properties in ${c.name} | ${env.appName}`; }, [c]);

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title="City not found" description="We are not live in this city yet." action={<Button to="/search">Browse all properties</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const stats = d.stats[purpose];
  const items = (listings.data && listings.data.items) || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-3 text-xs text-ink-subtle" aria-label="Breadcrumb"><Link to="/" className="hover:text-ink">Home</Link> / <span className="text-ink">{c.name}</span></nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Properties for {purpose === 'rent' ? 'rent' : 'sale'} in {c.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">{c.state ? `${c.state} · ` : ''}Verified owners and builders, no brokers.</p>
        </div>
        <PurposeToggle value={purpose} onChange={setPurpose} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Live listings" value={stats.listings.toLocaleString('en-IN')} icon={Building2} />
        <Stat label={purpose === 'rent' ? 'Average monthly rent' : 'Average price per sq ft'} value={avgText(avgFor(stats, purpose), purpose)} hint={avgFor(stats, purpose) ? 'Indicative, based on listings and deals on this platform' : `Shown once ${d.stats.minDataPoints} listings are live`} tone="accent" />
        <Card className="flex flex-col justify-center gap-2">
          <Button to={`/search?purpose=${purpose}&city=${c.code}`} iconRight={ArrowRight}>See all {purpose === 'rent' ? 'rentals' : 'homes'} in {c.name}</Button>
          <Button variant="secondary" to={`/city/${c.code}/localities`}>Compare localities</Button>
        </Card>
      </div>

      <section className="mt-10">
        <SectionTitle title={`Latest in ${c.name}`} action={<Link to={`/search?purpose=${purpose}&city=${c.code}`} className="text-sm font-medium text-brand-700 hover:underline">View all</Link>} />
        {listings.isLoading ? <CardGridSkeleton count={3} /> : listings.isError ? <ErrorState error={listings.error} onRetry={() => listings.refetch()} />
          : items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((x) => <PropertyCard key={x.id} card={x} />)}</div>
          : <p className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-ink-muted">No {purpose === 'rent' ? 'rentals' : 'homes for sale'} live yet. <Link to={`/request-property?purpose=${purpose}&city=${c.code}`} className="font-medium text-brand-700">Tell us what you need</Link></p>}
      </section>

      {d.localities.length > 0 && (
        <section className="mt-10">
          <SectionTitle title={`Localities in ${c.name}`} action={<Link to={`/city/${c.code}/localities`} className="text-sm font-medium text-brand-700 hover:underline">All localities and trends</Link>} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {d.localities.map((l) => (
              <Link key={l.id} to={`/city/${c.code}/${l.code}`} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="mt-1 text-xs text-ink-subtle">{purpose === 'rent' ? l.rentListings : l.saleListings} live</p>
                <p className="mt-1 text-sm text-ink-muted">{avgText(avgFor(l, purpose), purpose)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {purpose === 'sale' && ((projects.data && projects.data.items) || []).length > 0 && (
        <section className="mt-10">
          <SectionTitle title={`New projects in ${c.name}`} action={<Link to={`/projects?city=${encodeURIComponent(c.name)}`} className="text-sm font-medium text-brand-700 hover:underline">All projects</Link>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.data.items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
        </section>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div><SectionTitle title="Questions" /><Accordion items={placeFaq(c.name, purpose)} /></div>
        <Card className="self-start bg-brand-50">
          <ClipboardList className="h-6 w-6 text-brand-600" aria-hidden />
          <p className="mt-2 font-semibold text-ink">Request a property in {c.name}</p>
          <p className="mt-1 text-sm text-ink-muted">Tell us your budget and preferred localities. Our team calls you with matching options.</p>
          <Button className="mt-4" to={`/request-property?purpose=${purpose}&city=${c.code}`}>Request a property</Button>
        </Card>
      </section>
    </div>
  );
}
