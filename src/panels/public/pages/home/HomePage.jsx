// RE-S-PUB-01 public home (marketing landing): full-bleed hero with search
// (purpose tabs, city, autocomplete with sentence parsing, budget, near me),
// live stats, trust strip, featured and new listings, lifestyle tiles (browse
// by type), why-us, new projects, popular cities and localities (GET /api/home),
// how it works, lister pitch, EMI link and FAQ. Empty strips are hidden.
// Photography lives in /public/images/stock (see CREDITS.md there).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Building2, Calculator, CalendarCheck, Crosshair, Handshake, Home, IndianRupee, MapPin,
  PhoneOff, Search, ShieldCheck, Store, UserCheck,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { shortRupees } from '@/shared/lib/format';
import { Accordion, Button, useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import env from '@/config/env';
import { BUDGETS, cleanFilters, useHome, usePublicSettings } from '@/modules/search/api';
import SearchBox from '../../components/SearchBox';
import PropertyCard from '../../components/PropertyCard';
import ProjectCard from '../../components/ProjectCard';
import { CardGridSkeleton } from '../../components/States';
import { rememberCity, useCityPref } from '@/modules/search/prefs';

const IMG = (name) => `/images/stock/${name}.webp`;

const STRIP = [
  { icon: IndianRupee, key: 'brokerage' },
  { icon: UserCheck, key: 'kyc' },
  { icon: PhoneOff, key: 'private' },
  { icon: CalendarCheck, key: 'visits' },
];

// Lifestyle tiles (browse by type): [key under marketing.lifestyle, search query, photo, grid span].
const LIFESTYLE = [
  ['apartment', 'purpose=sale&types=apartment', 'towers-green', 'lg:col-span-2 lg:row-span-2'],
  ['villa', 'purpose=sale&types=villa', 'villa-pool', ''],
  ['house', 'purpose=sale&types=independent_house', 'house-dusk', ''],
  ['land', 'purpose=sale&category=land', 'pune-aerial', ''],
  ['commercial', 'purpose=sale&category=commercial', 'office-glass', ''],
];

const STEPS = [
  { icon: Search, key: 'search' },
  { icon: ShieldCheck, key: 'enquire' },
  { icon: CalendarCheck, key: 'visit' },
  { icon: Handshake, key: 'close' },
];

const WHY = ['p1', 'p2', 'p3'];
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'];
const PURPOSES = ['sale', 'rent', 'commercial', 'land', 'projects'];
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

  const selectCls = 'h-12 w-full rounded-xl border-0 bg-sand-100 px-3 text-sm text-navy-900 ring-1 ring-inset ring-navy-900/10 focus:outline-none focus:ring-2 focus:ring-gold-500';
  return (
    <div className="rounded-3xl bg-white/95 p-3 shadow-lift ring-1 ring-white/40 backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-2xl bg-sand-100 p-1" role="tablist" aria-label={t('home.search.purposeAria')}>
        {PURPOSES.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={purpose === p} onClick={() => { setPurpose(p); setMin(''); setMax(''); }}
            className={cn('flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all sm:px-4', purpose === p ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-600 hover:text-navy-900')}>{t(`home.search.purposes.${p}`)}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <label>
          <span className="sr-only">{t('common.city')}</span>
          <select value={cityValue} onChange={(e) => setCity(e.target.value)} className={selectCls}>
            <option value="">{t('common.allCities')}</option>
            {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <SearchBox city={cityValue} onSearch={go} placeholder={purpose === 'projects' ? t('home.search.placeholderProjects') : t('home.search.placeholder')}
          inputClassName="h-12 rounded-xl border-0 bg-sand-100 ring-1 ring-inset ring-navy-900/10 focus:border-0 focus:ring-2 focus:ring-gold-500" />
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
        <Button variant="outline" size="lg" icon={Crosshair} onClick={nearMe} className="h-12 rounded-xl">{t('home.search.nearMe')}</Button>
        <Button variant="gold" size="lg" icon={Search} onClick={() => go()} className="h-12 rounded-xl px-7 font-semibold">{t('home.search.search')}</Button>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text, action, light = false, center = false }) {
  return (
    <div className={cn('mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', center && 'items-center text-center sm:flex-col sm:items-center')}>
      <div className={cn(center && 'mx-auto max-w-2xl')}>
        {eyebrow && (
          <p className={cn('flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]', center && 'justify-center', light ? 'text-gold-300' : 'text-gold-700')}>
            <span className="h-px w-8 bg-current" aria-hidden />{eyebrow}
          </p>
        )}
        <h2 className={cn('mt-3 font-display text-3xl font-medium leading-tight tracking-tight sm:text-[2.6rem] sm:leading-[1.1]', light ? 'text-white' : 'text-navy-900')}>{title}</h2>
        {text && <p className={cn('mt-3 max-w-2xl text-base leading-relaxed', center && 'mx-auto', light ? 'text-navy-200' : 'text-navy-500')}>{text}</p>}
      </div>
      {action}
    </div>
  );
}

function ViewAll({ to, children, light = false }) {
  return (
    <Link to={to} className={cn('group inline-flex shrink-0 items-center gap-2 text-sm font-semibold', light ? 'text-gold-300 hover:text-gold-200' : 'text-navy-900 hover:text-gold-700')}>
      {children}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

function Strip({ title, eyebrow, action, loading, children, className }) {
  return (
    <section className={cn('mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20', className)}>
      <SectionTitle eyebrow={eyebrow} title={title} action={action} />
      {loading ? <CardGridSkeleton count={4} /> : children}
    </section>
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
  const totalListings = cities.reduce((n, c) => n + (c.listings || 0), 0);
  const liveCities = cities.filter((c) => c.listings > 0).length || cities.length;
  const hotline = h.hotline || env.hotline;
  // Live counts only once they are meaningful; until then, policy facts that are always true.
  const stats = [
    totalListings >= 100 ? [totalListings.toLocaleString('en-IN'), t('marketing.stats.listings')] : ['2 h', t('marketing.stats.callback')],
    liveCities >= 3 ? [liveCities, t('marketing.stats.cities')] : ['1:1', t('marketing.stats.agent')],
    ['100%', t('marketing.stats.verified')],
    ['₹0', t('marketing.stats.brokerage')],
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy-950">
        <img src={IMG('hero-tower')} alt="" fetchpriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_center]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/95 via-navy-950/70 to-navy-950/10" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-navy-950/80 to-transparent" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:pb-14 lg:pt-28">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-gold-200 backdrop-blur">
              <BadgeCheck className="h-4 w-4 text-gold-400" aria-hidden /> {t('marketing.hero.eyebrow')}
            </p>
            <h1 className="mt-6 font-display text-[2.6rem] font-medium leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {t('marketing.hero.title1')}{' '}
              <span className="italic text-gold-300">{t('marketing.hero.titleEm')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-100/90">{t('marketing.hero.subtitle')}</p>
          </div>
          <div className="mt-10 max-w-3xl"><HeroSearch cities={cities} /></div>
          <p className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-navy-200">
            <span className="mr-1">{t('home.hero.popular')}</span>
            {[['/search?purpose=sale&bhk=2', 'home.hero.popular2bhk'], ['/search?purpose=rent', 'home.hero.popularRent'], ['/projects', 'home.hero.popularLaunches'], ['/tools/calculators', 'home.hero.popularEmi']].map(([to, k]) => (
              <Link key={k} to={to} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white backdrop-blur transition-colors hover:border-gold-300/50 hover:bg-white/10">{t(k)}</Link>
            ))}
          </p>
          <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md sm:grid-cols-4">
            {stats.map(([v, label]) => (
              <div key={label} className="bg-navy-950/40 px-5 py-5">
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-3xl font-medium text-white">{v}</dd>
                <dd className="mt-1 text-xs uppercase tracking-[0.14em] text-navy-300">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-navy-900/5 bg-white">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 px-0 sm:px-6 lg:grid-cols-4">
          {STRIP.map((s, i) => (
            <li key={s.key} className={cn('flex items-center gap-4 px-4 py-6', i > 0 && 'lg:border-l lg:border-navy-900/5')}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><s.icon className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block text-sm font-semibold text-navy-900">{t(`home.strip.${s.key}.title`)}</span>
                <span className="block text-xs text-navy-500">{t(`home.strip.${s.key}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {(home.isLoading || featured.length > 0) && (
        <Strip eyebrow={t('home.sections.featuredEyebrow')} title={t('home.sections.featuredTitle')} loading={home.isLoading} action={<ViewAll to="/search?purpose=sale">{t('common.viewAll')}</ViewAll>}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{featured.slice(0, 8).map((c) => <PropertyCard key={c.id} card={c} />)}</div>
        </Strip>
      )}

      {/* Lifestyle tiles */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionTitle eyebrow={t('marketing.lifestyle.eyebrow')} title={t('marketing.lifestyle.title')} text={t('marketing.lifestyle.text')} />
          <div className="grid auto-rows-[220px] gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[240px]">
            {LIFESTYLE.map(([key, q, img, span]) => (
              <Link key={key} to={`/search?${q}`} className={cn('group relative isolate overflow-hidden rounded-3xl', span)}>
                <img src={IMG(img)} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105" />
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/85 via-navy-950/25 to-transparent" aria-hidden />
                <span className="flex h-full flex-col justify-end p-6">
                  <span className="font-display text-2xl font-medium text-white">{t(`marketing.lifestyle.${key}.title`)}</span>
                  <span className="mt-1 text-sm text-navy-100/90">{t(`marketing.lifestyle.${key}.text`)}</span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300">
                    {t('marketing.lifestyle.explore')} <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {!home.isLoading && latest.length > 0 && (
        <Strip eyebrow={t('home.sections.latestEyebrow')} title={t('home.sections.latestTitle')} action={<ViewAll to="/search?sort=newest">{t('home.sections.seeNewest')}</ViewAll>}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{latest.slice(0, 4).map((c) => <PropertyCard key={c.id} card={c} />)}</div>
        </Strip>
      )}

      {/* Why us */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] shadow-lift">
              <img src={IMG('living-warm')} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]" />
            </div>
            <div className="absolute -bottom-6 right-4 hidden w-56 overflow-hidden rounded-2xl border-4 border-sand-50 shadow-lift sm:block lg:-right-8">
              <img src={IMG('kitchen-wood')} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="absolute left-4 top-4 rounded-2xl bg-white/95 px-4 py-3 shadow-card backdrop-blur sm:left-6 sm:top-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><ShieldCheck className="h-5 w-5 text-gold-700" aria-hidden />{t('home.strip.kyc.title')}</p>
              <p className="text-xs text-navy-500">{t('home.strip.kyc.text')}</p>
            </div>
          </div>
          <div>
            <SectionTitle eyebrow={t('marketing.why.eyebrow')} title={t('marketing.why.title')} text={t('marketing.why.text')} />
            <ul className="-mt-2 space-y-6">
              {WHY.map((k, i) => (
                <li key={k} className="flex gap-5">
                  <span className="font-display text-3xl font-medium leading-none text-gold-500">0{i + 1}</span>
                  <span>
                    <span className="block text-lg font-semibold text-navy-900">{t(`marketing.why.${k}.title`)}</span>
                    <span className="mt-1 block leading-relaxed text-navy-500">{t(`marketing.why.${k}.text`)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-10"><Button variant="navy" size="lg" to="/p/about" iconRight={ArrowRight} className="rounded-full px-6">{t('marketing.why.cta')}</Button></div>
          </div>
        </div>
      </section>

      {/* Projects */}
      {!home.isLoading && projects.length > 0 && (
        <section className="relative isolate overflow-hidden bg-navy-950">
          <img src={IMG('podium-garden')} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20" aria-hidden />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950 via-navy-950/90 to-navy-950" aria-hidden />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionTitle light eyebrow={t('marketing.projects.eyebrow')} title={t('marketing.projects.title')} text={t('marketing.projects.text')} action={<ViewAll light to="/projects">{t('home.sections.allProjects')}</ViewAll>} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 3).map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
          </div>
        </section>
      )}

      {/* Cities and localities */}
      {(cities.length > 0 || localities.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="relative isolate overflow-hidden rounded-[2rem]">
              <img src={IMG('pune-street')} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/90 via-navy-950/30 to-transparent" aria-hidden />
              <div className="flex h-full min-h-[22rem] flex-col justify-end p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">{t('marketing.places.eyebrow')}</p>
                <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl">{t('marketing.places.title')}</h2>
                <p className="mt-2 max-w-sm text-navy-100/90">{t('marketing.places.text')}</p>
                {cities.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {cities.slice(0, 6).map((c) => (
                      <Link key={c.code} to={`/city/${c.code}`} className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-gold-300">
                        {c.name}{c.listings ? <span className="ml-2 font-normal text-navy-500">{c.listings}</span> : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <SectionTitle eyebrow={t('home.sections.localitiesEyebrow')} title={t('home.sections.localitiesTitle')} text={t('home.sections.citiesText')} />
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {localities.slice(0, 10).map((l) => (
                  <li key={l.id}>
                    <Link to={cityCode(l.city) ? `/search?purpose=sale&city=${cityCode(l.city)}&localities=${l.id}` : `/search?q=${encodeURIComponent(l.name)}`}
                      className="group flex items-center justify-between gap-3 border-b border-navy-900/10 py-4 transition-colors hover:border-gold-500">
                      <span className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-gold-700" aria-hidden />
                        <span>
                          <span className="block font-medium text-navy-900 group-hover:text-gold-700">{l.name}</span>
                          <span className="block text-xs text-navy-500">{l.city} · {t('marketing.places.listings', { n: l.listings })}</span>
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-navy-300 transition group-hover:text-gold-700" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              {cities[0] && <div className="mt-6"><ViewAll to={`/city/${(cities.find((c) => c.listings > 0) || cities[0]).code}/localities`}>{t('marketing.places.allLocalities')}</ViewAll></div>}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <SectionTitle center eyebrow={t('home.sections.howEyebrow')} title={t('home.sections.howTitle')} />
          <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <span className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-gradient-to-r from-gold-200 via-gold-400 to-gold-200 lg:block" aria-hidden />
            {STEPS.map((s, i) => (
              <li key={s.key} className="relative text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-gold-300 shadow-card ring-8 ring-white"><s.icon className="h-6 w-6" aria-hidden /></span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">{t('home.sections.step', { n: i + 1 })}</p>
                <h3 className="mt-2 font-display text-xl font-medium text-navy-900">{t(`home.steps.${s.key}.title`)}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-navy-500">{t(`home.steps.${s.key}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* For owners */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-navy-900">
          <img src={IMG('villa-white')} alt="" loading="lazy" className="absolute inset-y-0 right-0 -z-10 hidden h-full w-1/2 object-cover lg:block" />
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-gradient-to-r from-navy-900 to-transparent lg:block" aria-hidden />
          <div className="grid lg:grid-cols-2">
            <div className="p-8 sm:p-12 lg:p-14">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">{t('marketing.owners.eyebrow')}</p>
              <h2 className="mt-3 font-display text-3xl font-medium leading-tight text-white sm:text-[2.6rem] sm:leading-[1.1]">{t('marketing.owners.title')}</h2>
              <p className="mt-4 leading-relaxed text-navy-200">{t('marketing.owners.text')}</p>
              <ul className="mt-8 space-y-3">
                {['b1', 'b2', 'b3', 'b4'].map((b) => (
                  <li key={b} className="flex items-start gap-3 text-navy-100"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" aria-hidden /> {t(`home.lister.${b}`)}</li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button variant="gold" size="xl" to="/list-your-property" iconRight={ArrowRight} className="rounded-full">{t('marketing.owners.cta')}</Button>
                <Button variant="glass" size="xl" to="/p/no-broker-policy" className="rounded-full">{t('marketing.owners.secondary')}</Button>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {LISTER_KINDS.map(([k, Icon]) => (
                  <div key={k} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Icon className="h-5 w-5 text-gold-300" aria-hidden />
                    <p className="mt-2 text-sm font-semibold text-white">{t(`home.listerKinds.${k}.title`)}</p>
                    <p className="text-xs text-navy-300">{t(`home.listerKinds.${k}.text`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <SectionTitle center eyebrow={t('home.faq.eyebrow')} title={t('home.faq.title')} />
        <Accordion items={FAQ_KEYS.map((k) => ({ q: t(`home.faq.${k}.q`), a: t(`home.faq.${k}.a`) }))} />
        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-900/5 sm:flex-row">
          <span className="flex items-center gap-3 text-sm text-navy-600"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-50 text-gold-700"><Calculator className="h-5 w-5" aria-hidden /></span>{t('home.faq.emiText')}</span>
          <Button size="md" variant="outline" to="/tools/calculators" iconRight={ArrowRight} className="rounded-full">{t('home.faq.emiCta')}</Button>
        </div>
        <p className="mt-6 text-center text-sm text-navy-500">{t('home.faq.stillBefore')}<a className="font-semibold text-navy-900 underline decoration-gold-400 underline-offset-4" href={`tel:${hotline.replace(/\s/g, '')}`}>{hotline}</a>{t('home.faq.stillAfter')}</p>
      </section>
    </>
  );
}
