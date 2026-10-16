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
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import SkylineArt from '@/shared/components/SkylineArt';
import env from '@/config/env';
import { BUDGETS, cleanFilters, useHome, usePublicSettings } from '@/modules/search/api';
import SearchBox from '../../components/SearchBox';
import PropertyCard from '../../components/PropertyCard';
import ProjectCard from '../../components/ProjectCard';
import { CardGridSkeleton } from '../../components/States';
import { rememberCity, useCityPref } from '@/modules/search/prefs';

const STRIP = [
  { icon: IndianRupee, key: 'brokerage' },
  { icon: UserCheck, key: 'kyc' },
  { icon: PhoneOff, key: 'private' },
  { icon: CalendarCheck, key: 'visits' },
];

const TYPES = [
  { icon: Building, key: 'apartment', q: 'types=apartment' },
  { icon: Home, key: 'house', q: 'types=independent_house' },
  { icon: Trees, key: 'villa', q: 'types=villa' },
  { icon: LandPlot, key: 'land', q: 'category=land' },
  { icon: Store, key: 'commercial', q: 'category=commercial' },
  { icon: Warehouse, key: 'warehouse', q: 'types=warehouse' },
];

const STEPS = [
  { icon: Search, key: 'search' },
  { icon: ShieldCheck, key: 'enquire' },
  { icon: CalendarCheck, key: 'visit' },
  { icon: Handshake, key: 'close' },
];

const LISTER_BENEFITS = ['b1', 'b2', 'b3', 'b4'];
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'];
const PURPOSES = ['sale', 'rent', 'commercial', 'land', 'projects'];

// Owner / builder / landlord tiles: [key under home.listerKinds, icon].
const LISTER_KINDS = [['owners', Home], ['builders', Building2], ['landlords', Store]];

// Purpose tab -> search filters.
const PURPOSE_FILTERS = { sale: { purpose: 'sale' }, rent: { purpose: 'rent' }, commercial: { purpose: 'sale', category: 'commercial' }, land: { purpose: 'sale', category: 'land' } };

function HeroSearch({ cities }) {
  const t = useT();
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
    if (!navigator.geolocation) { toast.error(t('home.search.locationDenied')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => navigate(`/search/map?${new URLSearchParams({ ...PURPOSE_FILTERS[purpose === 'projects' ? 'sale' : purpose], lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5), radius: '5' })}`),
      () => toast.error(t('home.search.locationDenied')),
      { timeout: 10000, maximumAge: 300000 },
    );
  };

  const selectCls = 'h-11 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';
  return (
    <Card className="p-3 shadow-lg sm:p-4">
      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label={t('home.search.purposeAria')}>
        {PURPOSES.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={purpose === p} onClick={() => { setPurpose(p); setMin(''); setMax(''); }}
            className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4', purpose === p ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-sunken')}>{t(`home.search.purposes.${p}`)}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
        <label>
          <span className="sr-only">{t('common.city')}</span>
          <select value={cityValue} onChange={(e) => setCity(e.target.value)} className={selectCls}>
            <option value="">{t('common.allCities')}</option>
            {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <SearchBox city={cityValue} onSearch={go} placeholder={purpose === 'projects' ? t('home.search.placeholderProjects') : t('home.search.placeholder')} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        {purpose !== 'projects' && (
          <>
            <label><span className="sr-only">{t('home.search.minBudgetLabel')}</span>
              <select value={min} onChange={(e) => { setMin(e.target.value); if (max && Number(e.target.value) > Number(max)) setMax(''); }} className={selectCls}>
                <option value="">{t('home.search.minBudget')}</option>{budgets.map((b) => <option key={b} value={b}>{shortRupees(b * 100)}</option>)}
              </select>
            </label>
            <label><span className="sr-only">{t('home.search.maxBudgetLabel')}</span>
              <select value={max} onChange={(e) => setMax(e.target.value)} className={selectCls}>
                <option value="">{t('home.search.maxBudget')}</option>{budgets.filter((b) => !min || b >= Number(min)).map((b) => <option key={b} value={b}>{shortRupees(b * 100)}</option>)}
              </select>
            </label>
          </>
        )}
        <Button variant="secondary" size="lg" icon={Crosshair} onClick={nearMe} className="h-11">{t('home.search.nearMe')}</Button>
        <Button size="lg" icon={Search} onClick={() => go()} className="h-11">{t('home.search.search')}</Button>
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
  const t = useT();
  useDocumentMeta({ title: t('home.meta.title'), description: t('home.meta.description'), path: '/' });
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
              <BadgeCheck className="h-4 w-4 text-accent-300" /> {t('home.hero.badge')}
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              {t('home.hero.title1')}<span className="text-accent-300">{t('home.hero.titleHighlight')}</span>{t('home.hero.title2')}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">{t('home.hero.subtitle')}</p>
            <div className="mt-8 max-w-2xl"><HeroSearch cities={cities} /></div>
            <p className="mt-4 text-sm text-brand-200">{t('home.hero.popular')} <Link to="/search?purpose=sale&bhk=2" className="text-white underline-offset-4 hover:underline">{t('home.hero.popular2bhk')}</Link> · <Link to="/search?purpose=rent" className="text-white underline-offset-4 hover:underline">{t('home.hero.popularRent')}</Link> · <Link to="/projects" className="text-white underline-offset-4 hover:underline">{t('home.hero.popularLaunches')}</Link> · <Link to="/tools/calculators" className="text-white underline-offset-4 hover:underline">{t('home.hero.popularEmi')}</Link></p>
          </div>
          <SkylineArt className="mx-auto hidden w-full max-w-md lg:block" />
        </div>
      </section>

      <section className="border-b bg-white">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-line px-0 sm:px-6 lg:grid-cols-4">
          {STRIP.map((s) => (
            <li key={s.key} className="flex items-center gap-3 bg-white px-4 py-5">
              <span className="rounded-md bg-brand-50 p-2.5 text-brand-600"><s.icon className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block text-sm font-semibold text-ink">{t(`home.strip.${s.key}.title`)}</span>
                <span className="block text-xs text-ink-subtle">{t(`home.strip.${s.key}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="pt-14">
        {(home.isLoading || featured.length > 0) && (
          <Strip eyebrow={t('home.sections.featuredEyebrow')} title={t('home.sections.featuredTitle')} loading={home.isLoading} action={<Link to="/search?purpose=sale" className="text-sm font-medium text-brand-700 hover:underline">{t('common.viewAll')}</Link>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.slice(0, 8).map((c) => <PropertyCard key={c.id} card={c} />)}</div>
          </Strip>
        )}
        {!home.isLoading && latest.length > 0 && (
          <Strip eyebrow={t('home.sections.latestEyebrow')} title={t('home.sections.latestTitle')} action={<Link to="/search?sort=newest" className="text-sm font-medium text-brand-700 hover:underline">{t('home.sections.seeNewest')}</Link>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{latest.slice(0, 4).map((c) => <PropertyCard key={c.id} card={c} />)}</div>
          </Strip>
        )}
        {!home.isLoading && projects.length > 0 && (
          <Strip eyebrow={t('home.sections.projectsEyebrow')} title={t('home.sections.projectsTitle')} action={<Link to="/projects" className="text-sm font-medium text-brand-700 hover:underline">{t('home.sections.allProjects')}</Link>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 3).map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
          </Strip>
        )}
      </div>

      {cities.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <SectionTitle eyebrow={t('home.sections.citiesEyebrow')} title={t('home.sections.citiesTitle')} text={t('home.sections.citiesText')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cities.slice(0, 12).map((c, i) => (
              <Link key={c.code} to={`/city/${c.code}`}
                className="group relative overflow-hidden rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                <span className={cn('mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md', i % 2 ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-600')}><Building2 className="h-5 w-5" aria-hidden /></span>
                <span className="block font-semibold text-ink group-hover:text-brand-700">{c.name}</span>
                <span className="block truncate text-xs text-ink-subtle">{c.listings ? t('home.sections.cityListings', { n: c.listings.toLocaleString('en-IN') }) : c.state || t('home.sections.comingSoon')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {localities.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <SectionTitle eyebrow={t('home.sections.localitiesEyebrow')} title={t('home.sections.localitiesTitle')} />
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
        <SectionTitle eyebrow={t('home.sections.browseEyebrow')} title={t('home.sections.browseTitle')} />
        <div className="flex flex-wrap gap-2">
          {TYPES.map((ty) => (
            <Link key={ty.key} to={`/search?purpose=sale&${ty.q}`} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-brand-300 hover:text-brand-700">
              <ty.icon className="h-4 w-4 text-brand-600" aria-hidden /> {t(`home.types.${ty.key}`)}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <SectionTitle eyebrow={t('home.sections.howEyebrow')} title={t('home.sections.howTitle')} />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.key} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-md"><s.icon className="h-5 w-5" aria-hidden /></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t('home.sections.step', { n: i + 1 })}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{t(`home.steps.${s.key}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`home.steps.${s.key}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid overflow-hidden rounded-xl border bg-white shadow-sm lg:grid-cols-2">
          <div className="p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">{t('home.lister.eyebrow')}</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">{t('home.lister.title')}</h2>
            <ul className="mt-6 space-y-3">
              {LISTER_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink-muted"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden /> {t(`home.lister.${b}`)}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to="/list-your-property" iconRight={ArrowRight}>{t('home.lister.cta')}</Button>
              <Button size="lg" variant="secondary" to="/p/no-broker-policy">{t('home.lister.policy')}</Button>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 bg-brand-50 p-8 sm:p-10">
            {LISTER_KINDS.map(([k, Icon]) => (
              <div key={k} className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
                <span className="rounded-md bg-brand-600 p-2.5 text-white"><Icon className="h-5 w-5" aria-hidden /></span>
                <span><span className="block font-semibold text-ink">{t(`home.listerKinds.${k}.title`)}</span><span className="block text-sm text-ink-subtle">{t(`home.listerKinds.${k}.text`)}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <SectionTitle eyebrow={t('home.faq.eyebrow')} title={t('home.faq.title')} />
        <Accordion items={FAQ_KEYS.map((k) => ({ q: t(`home.faq.${k}.q`), a: t(`home.faq.${k}.a`) }))} />
        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-lg border bg-white p-4 sm:flex-row">
          <span className="flex items-center gap-3 text-sm text-ink-muted"><Calculator className="h-5 w-5 text-brand-600" aria-hidden />{t('home.faq.emiText')}</span>
          <Button size="sm" variant="secondary" to="/tools/calculators" iconRight={ArrowRight}>{t('home.faq.emiCta')}</Button>
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">{t('home.faq.stillBefore')}<a className="font-semibold text-brand-700" href={`tel:${(h.hotline || env.hotline).replace(/\s/g, '')}`}>{h.hotline || env.hotline}</a>{t('home.faq.stillAfter')}</p>
      </section>
    </>
  );
}
