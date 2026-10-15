// RE-S-PUB-01 public home: hero search (purpose tabs, city, autocomplete with
// sentence parsing, budget, near me), trust strip, featured and new listings,
// new projects, popular cities and localities (GET /api/home), browse by type,
// how it works, lister benefits, EMI link and FAQ. Empty strips are hidden.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Building, Building2, Calculator, CalendarCheck, Crosshair, Handshake, Home, IndianRupee, LandPlot, MapPin,
  PhoneOff, Search, ShieldCheck, Store, Trees, UserCheck, Warehouse,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { shortRupees } from '@/shared/lib/format';
import { Accordion, Button, Card, useToast } from '@/shared/ui';
import SkylineArt from '@/shared/components/SkylineArt';
import env from '@/config/env';
import { BUDGETS, cleanFilters, useHome, usePublicSettings } from '@/modules/search/api';
import SearchBox from '../../components/SearchBox';
import PropertyCard from '../../components/PropertyCard';
import ProjectCard from '../../components/ProjectCard';
import { CardGridSkeleton } from '../../components/States';
import { rememberCity, useCityPref } from '@/modules/search/prefs';

const STRIP = [
  { icon: IndianRupee, title: 'Zero brokerage', text: 'for buyers and tenants' },
  { icon: UserCheck, title: 'KYC-verified', text: 'owners, builders, landlords' },
  { icon: PhoneOff, title: 'Private numbers', text: 'never shared with listers' },
  { icon: CalendarCheck, title: 'Assisted visits', text: 'with our in-house agent' },
];

const TYPES = [
  { icon: Building, label: 'Apartments', q: 'types=apartment' },
  { icon: Home, label: 'Independent houses', q: 'types=independent_house' },
  { icon: Trees, label: 'Villas', q: 'types=villa' },
  { icon: LandPlot, label: 'Plots and land', q: 'category=land' },
  { icon: Store, label: 'Shops and offices', q: 'category=commercial' },
  { icon: Warehouse, label: 'Warehouses', q: 'types=warehouse' },
];

const STEPS = [
  { icon: Search, title: 'Search verified listings', text: 'Filter by city, budget and type. Every listing was checked by our team.' },
  { icon: ShieldCheck, title: 'Enquire in one tap', text: 'Your number stays private. Our sales team calls you within 2 working hours.' },
  { icon: CalendarCheck, title: 'Visit with our agent', text: 'Pick a slot the owner has opened. An agent meets you at the property.' },
  { icon: Handshake, title: 'Close directly', text: 'Negotiate through us, then pay the owner or builder directly. No brokerage.' },
];

const LISTER_BENEFITS = [
  'Free listing for owners, builders and landlords',
  'Serious, phone-verified buyers only, no broker calls',
  'Our sales team handles enquiries and site visits',
  'Commission only when a deal closes, at the % you agree',
];

const FAQ = [
  { q: 'Is it really broker-free?', a: 'Yes. Every lister passes KYC and signs a no-broker declaration. Accounts that broker are suspended and banned, and buyers can report a listing in one tap.' },
  { q: 'Do buyers or tenants pay anything?', a: 'No. Searching, enquiring and visiting are free. The platform earns a pre-agreed commission from the lister only when a deal is verified.' },
  { q: 'Why can I not see the owner\'s phone number?', a: 'To stop spam and broker calls, contact details stay private. Our in-house team speaks to both sides, arranges visits and relays offers.' },
  { q: 'How are listings verified?', a: 'Listers are KYC-verified, ownership proof is checked for each property, and every listing is reviewed before it goes live. Look for the Photo verified badge for on-site photos.' },
  { q: 'Are builder projects RERA-registered?', a: 'Every builder project shows its RERA registration number and the official RERA link. Exemptions are allowed only under Section 3(2) of the RERA Act.' },
];

const PURPOSES = [
  { value: 'sale', label: 'Buy' }, { value: 'rent', label: 'Rent' }, { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Plots / Land' }, { value: 'projects', label: 'Projects' },
];

// Purpose tab -> search filters.
const PURPOSE_FILTERS = { sale: { purpose: 'sale' }, rent: { purpose: 'rent' }, commercial: { purpose: 'sale', category: 'commercial' }, land: { purpose: 'sale', category: 'land' } };

function HeroSearch({ cities }) {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = usePublicSettings();
  const [purpose, setPurpose] = useState('sale');
  const [city, setCity] = useCityPref(); // shared with the header city selector
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const defaultCity = settings.data && settings.data.defaultCity;
  const known = cities.find((c) => [c.code, c.name].includes(city));
  const cityValue = (known && known.code) || (cities.find((c) => c.name === defaultCity) || {}).code || '';
  const budgets = BUDGETS[purpose === 'rent' ? 'rent' : 'sale'];

  const go = (patch = {}) => {
    if (purpose === 'projects') {
      const c = cities.find((x) => x.code === cityValue);
      const p = new URLSearchParams({ ...(c ? { city: c.name } : {}), ...(patch.q ? { q: patch.q } : {}) });
      navigate(`/projects${p.toString() ? `?${p}` : ''}`);
      return;
    }
    rememberCity(patch.city || cityValue);
    const f = cleanFilters({ ...PURPOSE_FILTERS[purpose], city: cityValue, ...(min ? { minPrice: min } : {}), ...(max ? { maxPrice: max } : {}), ...patch });
    navigate(`/search?${new URLSearchParams(f)}`);
  };
  const nearMe = () => {
    if (!navigator.geolocation) { toast.error('Location permission denied, choose a city instead'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => navigate(`/search/map?${new URLSearchParams({ ...PURPOSE_FILTERS[purpose === 'projects' ? 'sale' : purpose], lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5), radius: '5' })}`),
      () => toast.error('Location permission denied, choose a city instead'),
      { timeout: 10000, maximumAge: 300000 },
    );
  };

  const selectCls = 'h-11 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';
  return (
    <Card className="p-3 shadow-lg sm:p-4">
      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Purpose">
        {PURPOSES.map((p) => (
          <button key={p.value} type="button" role="tab" aria-selected={purpose === p.value} onClick={() => { setPurpose(p.value); setMin(''); setMax(''); }}
            className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4', purpose === p.value ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-sunken')}>{p.label}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
        <label>
          <span className="sr-only">City</span>
          <select value={cityValue} onChange={(e) => setCity(e.target.value)} className={selectCls}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <SearchBox city={cityValue} onSearch={go} placeholder={purpose === 'projects' ? 'Project name' : 'Locality, project, landmark or "2 BHK under 60 lakh"'} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        {purpose !== 'projects' && (
          <>
            <label><span className="sr-only">Minimum budget</span>
              <select value={min} onChange={(e) => { setMin(e.target.value); if (max && Number(e.target.value) > Number(max)) setMax(''); }} className={selectCls}>
                <option value="">Min budget</option>{budgets.map((b) => <option key={b} value={b}>{shortRupees(b * 100)}</option>)}
              </select>
            </label>
            <label><span className="sr-only">Maximum budget</span>
              <select value={max} onChange={(e) => setMax(e.target.value)} className={selectCls}>
                <option value="">Max budget</option>{budgets.filter((b) => !min || b >= Number(min)).map((b) => <option key={b} value={b}>{shortRupees(b * 100)}</option>)}
              </select>
            </label>
          </>
        )}
        <Button variant="secondary" size="lg" icon={Crosshair} onClick={nearMe} className="h-11">Near me</Button>
        <Button size="lg" icon={Search} onClick={() => go()} className="h-11">Search</Button>
      </div>
    </Card>
  );
}

function Strip({ title, eyebrow, action, loading, children }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
      <SectionTitle eyebrow={eyebrow} title={title} action={action} />
      {loading ? <CardGridSkeleton count={3} /> : children}
    </section>
  );
}

function SectionTitle({ eyebrow, title, text, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
        {text && <p className="mt-1 max-w-2xl text-ink-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export default function HomePage() {
  const home = useHome();
  const h = home.data || {};
  const cities = h.cities || [];
  const featured = h.featured || [];
  const latest = (h.latest || []).filter((l) => !featured.some((f) => f.id === l.id));
  const projects = h.projects || [];
  const localities = h.localities || [];
  const cityCode = (name) => (cities.find((c) => c.name === name) || {}).code;
  return (
    <>
      <section className="relative overflow-hidden bg-brand-700">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(242,159,5,0.15),transparent_40%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/15">
              <BadgeCheck className="h-4 w-4 text-accent-300" /> 100% broker-free marketplace
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Verified homes, <span className="text-accent-300">directly</span> from owners and builders
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">No brokerage, no spam calls. Every lister is KYC-verified and every listing is reviewed before it goes live.</p>
            <div className="mt-8 max-w-2xl"><HeroSearch cities={cities} /></div>
            <p className="mt-4 text-sm text-brand-200">Popular: <Link to="/search?purpose=sale&bhk=2" className="text-white underline-offset-4 hover:underline">2 BHK homes</Link> · <Link to="/search?purpose=rent" className="text-white underline-offset-4 hover:underline">Homes for rent</Link> · <Link to="/projects" className="text-white underline-offset-4 hover:underline">New launches</Link> · <Link to="/tools/calculators" className="text-white underline-offset-4 hover:underline">Calculate your EMI</Link></p>
          </div>
          <SkylineArt className="mx-auto hidden w-full max-w-md lg:block" />
        </div>
      </section>

      <section className="border-b bg-white">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-line px-0 sm:px-6 lg:grid-cols-4">
          {STRIP.map((s) => (
            <li key={s.title} className="flex items-center gap-3 bg-white px-4 py-5">
              <span className="rounded-md bg-brand-50 p-2.5 text-brand-600"><s.icon className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block text-sm font-semibold text-ink">{s.title}</span>
                <span className="block text-xs text-ink-subtle">{s.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="pt-14">
        {(home.isLoading || featured.length > 0) && (
          <Strip eyebrow="Handpicked" title="Featured properties" loading={home.isLoading} action={<Link to="/search?purpose=sale" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.slice(0, 8).map((c) => <PropertyCard key={c.id} card={c} />)}</div>
          </Strip>
        )}
        {!home.isLoading && latest.length > 0 && (
          <Strip eyebrow="Just listed" title="New on the platform" action={<Link to="/search?sort=newest" className="text-sm font-medium text-brand-700 hover:underline">See newest</Link>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{latest.slice(0, 4).map((c) => <PropertyCard key={c.id} card={c} />)}</div>
          </Strip>
        )}
        {!home.isLoading && projects.length > 0 && (
          <Strip eyebrow="Builders" title="New projects" action={<Link to="/projects" className="text-sm font-medium text-brand-700 hover:underline">All projects</Link>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 3).map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
          </Strip>
        )}
      </div>

      {cities.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <SectionTitle eyebrow="Explore" title="Popular cities" text="Start with a city, then narrow down by locality, budget and type." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cities.slice(0, 12).map((c, i) => (
              <Link key={c.code} to={`/city/${c.code}`}
                className="group relative overflow-hidden rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                <span className={cn('mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md', i % 2 ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-600')}><Building2 className="h-5 w-5" aria-hidden /></span>
                <span className="block font-semibold text-ink group-hover:text-brand-700">{c.name}</span>
                <span className="block truncate text-xs text-ink-subtle">{c.listings ? `${c.listings.toLocaleString('en-IN')} live listings` : c.state || 'Coming soon'}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {localities.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <SectionTitle eyebrow="Localities" title="Popular localities" />
          <div className="flex flex-wrap gap-2">
            {localities.map((l) => (
              <Link key={l.id} to={cityCode(l.city) ? `/search?purpose=sale&city=${cityCode(l.city)}&localities=${l.id}` : `/search?q=${encodeURIComponent(l.name)}`}
                className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-ink shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                <MapPin className="h-4 w-4 text-brand-600" aria-hidden />{l.name}, {l.city}<span className="text-xs text-ink-subtle">{l.listings}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <SectionTitle eyebrow="Browse" title="Find the right kind of property" />
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Link key={t.label} to={`/search?purpose=sale&${t.q}`} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-brand-300 hover:text-brand-700">
              <t.icon className="h-4 w-4 text-brand-600" aria-hidden /> {t.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <SectionTitle eyebrow="How it works" title="From search to keys, without a broker" />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-md"><s.icon className="h-5 w-5" aria-hidden /></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid overflow-hidden rounded-xl border bg-white shadow-sm lg:grid-cols-2">
          <div className="p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">For owners, builders and landlords</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">List your property free. Pay only on a closed deal.</h2>
            <ul className="mt-6 space-y-3">
              {LISTER_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink-muted"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden /> {b}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to="/list-your-property" iconRight={ArrowRight}>List your property</Button>
              <Button size="lg" variant="secondary" to="/p/no-broker-policy">Read our no-broker policy</Button>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 bg-brand-50 p-8 sm:p-10">
            {[['Owners', 'Sell or rent your home', Home], ['Builders', 'Projects with RERA details and unit inventory', Building2], ['Landlords', 'Rent out flats, shops and offices', Store]].map(([t, d, Icon]) => (
              <div key={t} className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
                <span className="rounded-md bg-brand-600 p-2.5 text-white"><Icon className="h-5 w-5" aria-hidden /></span>
                <span><span className="block font-semibold text-ink">{t}</span><span className="block text-sm text-ink-subtle">{d}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <SectionTitle eyebrow="Questions" title="Frequently asked" />
        <Accordion items={FAQ} />
        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-lg border bg-white p-4 sm:flex-row">
          <span className="flex items-center gap-3 text-sm text-ink-muted"><Calculator className="h-5 w-5 text-brand-600" aria-hidden />Planning a home loan? Check your EMI and budget.</span>
          <Button size="sm" variant="secondary" to="/tools/calculators" iconRight={ArrowRight}>Calculate your EMI</Button>
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">Still have a question? Call us on <a className="font-semibold text-brand-700" href={`tel:${(h.hotline || env.hotline).replace(/\s/g, '')}`}>{h.hotline || env.hotline}</a></p>
      </section>
    </>
  );
}
