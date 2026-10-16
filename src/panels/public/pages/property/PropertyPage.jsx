// RE-S-PUB-04 property detail (masked): gallery, price, facts, amenities,
// approximate map circle, badges, RERA, calculators, locality snapshot,
// similar listings and the contact panel that opens RE-S-PUB-06. Lister
// name, phone, email, unit number and exact address never reach this page.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bath, BedDouble, Building2, CalendarCheck, Compass, FileText, Flag, HandCoins, Home as HomeIcon, KeyRound, Layers, Maximize2, MessageSquare, PhoneCall, Share2, Sofa, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { Button, useToast } from '@/shared/ui';
import env from '@/config/env';
import { useT } from '@/shared/i18n';
import { track } from '@/shared/lib/analytics';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useMasters } from '@/modules/listings/api';
import { PUBLIC_DEFAULTS, recordView, useLocalitySummary, usePublicSettings, useProperty, useSimilar, whatsappClick } from '@/modules/search/api';
import { typeForAction, ENQUIRY_TYPES } from '@/modules/leads/publicApi';
import Gallery from '../../components/Gallery';
import VerificationBadges from '../../components/VerificationBadges';
import ShortlistButton from '../../components/ShortlistButton';
import PropertyCard from '../../components/PropertyCard';
import EnquiryModal from '../../components/EnquiryModal';
import { ReportModal } from '../../components/SmallModals';
import { ApproxMap } from '../../components/PublicMap';
import { EmiMini } from '../../components/Calculators';
import { ChangePill } from '../../components/TrendChart';
import { DetailSkeleton, ErrorState, NotAvailable } from '../../components/States';
import {
  AmenityGrid, AreaFacts, Block, EnquiryCard, Eyebrow, Fact, KeyFacts, Landmarks, MobileActionBar, PlaceLine, ReraBlock, mobilePrimaryCls, shareLink, useShareCode, youtubeEmbed,
} from '../../components/DetailBits';

const CONTACTS = [
  { action: 'contact', icon: MessageSquare },
  { action: 'callback', icon: PhoneCall },
  { action: 'visit', icon: CalendarCheck },
  { action: 'price', icon: HandCoins },
];
// Label for an enum value from this namespace, or the raw value when unknown.
const enumLabel = (t, ns, v) => { const k = `property.${ns}.${v}`; const s = t(k); return s === k ? v : s; };

// Title for a 410 listing (sold, rented, expired or paused).
const goneTitle = (t, info) => t(info.temporary ? 'property.gone.temporary'
  : info.status === 'sold' ? 'property.gone.sold' : info.status === 'rented' ? 'property.gone.rented' : 'property.gone.unavailable');
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function MediaTabs({ p }) {
  const t = useT();
  const tabs = [{ value: 'photos', label: t('property.media.photos', { count: p.media.photos.length }) }];
  if (p.media.video) tabs.push({ value: 'video', label: t('property.media.video') });
  if (p.media.floorPlans.length) tabs.push({ value: 'plans', label: t('property.media.plans', { count: p.media.floorPlans.length }) });
  const [tab, setTab] = useState('photos');
  const embed = p.media.video && p.media.video.kind === 'youtube' ? youtubeEmbed(p.media.video.url) : null;
  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-card ring-1 ring-navy-900/5" role="tablist">
          {tabs.map((x) => (
            <button key={x.value} type="button" role="tab" aria-selected={tab === x.value} onClick={() => setTab(x.value)}
              className={cn('h-9 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-all', tab === x.value ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-600 hover:text-navy-900')}>{x.label}</button>
          ))}
        </div>
      )}
      {tab === 'photos' && <Gallery photos={p.media.photos} />}
      {tab === 'video' && (
        <div className="aspect-video overflow-hidden rounded-3xl bg-navy-950 shadow-card sm:rounded-[2rem]">
          {embed ? <iframe src={embed} title={t('property.media.videoTitle')} className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            : <video src={p.media.video.url} controls className="h-full w-full" preload="metadata" />}
        </div>
      )}
      {tab === 'plans' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {p.media.floorPlans.map((f) => (
            /\.pdf($|\?)/i.test(f.url)
              ? <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-10 text-sm font-medium text-navy-900 shadow-card ring-1 ring-navy-900/5 transition hover:-translate-y-1 hover:shadow-lift"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-300"><FileText className="h-5 w-5" aria-hidden /></span>{t('property.media.openPdf', { label: f.label || t('property.media.floorPlanLower') })}</a>
              : <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-navy-900/5 transition hover:-translate-y-1 hover:shadow-lift"><img src={f.url} alt={f.label || t('property.media.floorPlan')} className="w-full bg-sand-50 object-contain" loading="lazy" /><span className="block px-4 py-3 text-sm font-medium text-navy-800">{f.label || t('property.media.floorPlan')}</span></a>
          ))}
        </div>
      )}
    </div>
  );
}

function LocalitySnapshot({ p }) {
  const t = useT();
  const loc = slugify(p.locality);
  const q = useLocalitySummary(p.city, loc);
  if (!q.data) return null;
  const s = q.data.stats || {};
  const trend = q.data.trend || {};
  const value = p.purpose === 'rent' ? s.rent && s.rent.avgMonthlyRent : s.sale && s.sale.avgPricePerSqft;
  if (!value) return null;
  const change = trend.oneYearChangePct && trend.oneYearChangePct[p.purpose === 'rent' ? 'rent' : 'sale'];
  return (
    <Block title={t('property.locality.title', { name: q.data.locality.name })} eyebrow={t('detail.sections.market')}>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-sand-50 p-5 ring-1 ring-inset ring-navy-900/5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-navy-400">{p.purpose === 'rent' ? t('property.locality.avgRent') : t('property.locality.avgPrice')}</p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-navy-900">{rupees(value)}<span className="font-sans text-sm font-normal text-navy-400">{p.purpose === 'rent' ? '' : t('property.locality.perSqft')}</span></p>
          <p className="mt-1 text-xs text-navy-500">{t('property.locality.change')} <ChangePill pct={change} /></p>
        </div>
        <Button variant="outline" to={`/city/${q.data.city.code}/${q.data.locality.code}`} iconRight={ArrowRight} className="rounded-full">{t('property.locality.trends')}</Button>
      </div>
      <p className="mt-3 text-xs text-navy-400">{t('property.locality.note')}</p>
    </Block>
  );
}

// 410 LISTING_UNAVAILABLE (RE-S-PUB-04 states): sold, rented, expired / inactive, or paused (temporary).
function GoneListing({ info }) {
  const t = useT();
  const title = goneTitle(t, info);
  const where = [info.locality, info.city].filter(Boolean).join(', ');
  const browse = `/search?${new URLSearchParams({ ...(info.purpose ? { purpose: info.purpose } : {}), ...(info.city ? { city: info.city } : {}) })}`;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <NotAvailable icon={HomeIcon} title={title}
        description={t('property.gone.description', {
          name: info.title || t('property.gone.thisListing'),
          id: info.listingNo ? t('property.gone.idPart', { no: info.listingNo }) : '',
          where: where ? t('property.gone.wherePart', { where }) : '',
          reason: info.temporary ? t('property.gone.paused') : t('property.gone.offMarket'),
        })}
        action={<div className="flex flex-wrap justify-center gap-2"><Button variant="gold" size="lg" to={browse} className="rounded-full font-semibold">{info.city ? t('property.gone.browseCity', { city: info.city }) : t('property.gone.browseAll')}</Button><Button variant="outline" size="lg" to="/request-property" className="rounded-full">{t('property.gone.alerts')}</Button></div>} />
      {(info.similar || []).length > 0 && (
        <section className="mt-4" aria-labelledby="gone-similar-h">
          <h2 id="gone-similar-h" className="mb-6 font-display text-3xl font-medium tracking-tight text-navy-900">{info.locality ? t('property.gone.similarIn', { locality: info.locality }) : t('property.similar')}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{info.similar.map((c) => <PropertyCard key={c.id} card={c} />)}</div>
        </section>
      )}
    </div>
  );
}

function MoveInCost({ price }) {
  const t = useT();
  const rows = [[t('property.moveIn.deposit'), price.deposit], [t('property.moveIn.firstRent'), price.monthlyRent], [t('property.moveIn.maintenance'), price.maintenance]].filter(([, v]) => v);
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return (
    <Block title={t('property.moveIn.title')} eyebrow={t('detail.sections.finance')}>
      <dl className="divide-y divide-navy-900/5 text-sm">
        {rows.map(([l, v]) => <div key={l} className="flex justify-between py-2.5"><dt className="text-navy-500">{l}</dt><dd className="font-medium text-navy-900">{rupees(v)}</dd></div>)}
        <div className="flex items-baseline justify-between pt-3"><dt className="font-semibold text-navy-900">{t('property.moveIn.total')}</dt><dd className="font-display text-2xl font-semibold text-navy-900">{rupees(total)}</dd></div>
      </dl>
    </Block>
  );
}

export default function PropertyPage() {
  const t = useT();
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const toast = useToast();
  const q = useProperty(slug);
  const p = q.data;
  const similar = useSimilar(p && p.id);
  const masters = useMasters();
  const settings = usePublicSettings();
  const shareCode = useShareCode();
  const [report, setReport] = useState(false);
  const action = sp.get('action');
  const enquiryOpen = ENQUIRY_TYPES.some((x) => x.action === action);

  useEffect(() => { if (p && p.id) recordView(p.id); }, [p && p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Funnel analytics: one property_view per loaded listing (public listing number, purpose and city only).
  const viewNo = p && p.listingNo;
  const viewPurpose = p && p.purpose;
  const viewCity = p && p.city;
  useEffect(() => { if (viewNo) track('property_view', { listingNo: viewNo, purpose: viewPurpose, city: viewCity }); }, [slug, viewNo, viewPurpose, viewCity]);

  const gone = q.isError && q.error.status === 410 && q.error.details ? q.error.details : null;
  const metaPrice = p && p.price ? (p.purpose === 'rent' ? p.price.monthlyRent : p.price.amount) : null;
  const metaWhat = p ? [p.details && p.details.bhk ? `${p.details.bhk} BHK` : '', titleCase(p.type)].filter(Boolean).join(' ') : '';
  const metaPlace = p ? [p.locality, p.city].filter(Boolean).join(', ') : '';
  const metaPriceText = metaPrice ? `${shortRupees(metaPrice)}${p.purpose === 'rent' ? t('property.perMonth') : ''}` : '';
  useDocumentMeta({
    title: p ? p.title : gone ? goneTitle(t, gone) : q.isError && q.error.status === 404 ? t('property.notFound.title') : undefined,
    description: p ? t(p.purpose === 'rent' ? 'property.meta.descRent' : 'property.meta.descSale', { what: metaWhat || p.title, place: metaPlace, price: metaPriceText }).replace(/,\s*([.।])$/, '$1') : undefined,
    path: slug ? `/property/${slug}` : undefined,
    image: p && p.cover && /^https?:\/\//i.test(p.cover.url || '') ? p.cover.url : undefined,
    type: 'article',
  });

  const amenityNames = useMemo(() => Object.fromEntries(((masters.data && masters.data.amenities) || []).map((a) => [a.code, a.name])), [masters.data]);
  const openAction = (a) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('action', a); return n; }, { replace: false });
  const closeAction = () => setSp((prev) => { const n = new URLSearchParams(prev); n.delete('action'); return n; }, { replace: true });

  const whatsapp = async () => {
    track('whatsapp_click', { listingNo: p.listingNo, purpose: p.purpose, city: p.city });
    const w = window.open('', '_blank');
    try {
      const r = await whatsappClick(p.id);
      if (r.url && w) w.location.href = r.url; else { if (w) w.close(); toast.info(t('property.whatsappOff')); }
    } catch (e) { if (w) w.close(); toast.error(e.message); }
  };

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 410 && q.error.details) return <GoneListing info={q.error.details} />;
  if (q.isError && q.error.status === 404) {
    return (
      <NotAvailable icon={HomeIcon} title={t('property.notFound.title')} description={t('property.notFound.description')}
        action={<div className="flex flex-wrap justify-center gap-2"><Button variant="gold" size="lg" to="/search" className="rounded-full font-semibold">{t('property.gone.browseAll')}</Button><Button variant="outline" size="lg" to="/request-property" className="rounded-full">{t('property.gone.alerts')}</Button></div>} />
    );
  }
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const d = p.details || {};
  const price = p.price || {};
  const isRent = p.purpose === 'rent';
  const main = isRent ? price.monthlyRent : price.amount;
  const calc = { ...PUBLIC_DEFAULTS.calc, ...((settings.data && settings.data.calc) || {}) };
  const target = { kind: 'property', id: p.id, title: p.title, listingNo: p.listingNo, subtitle: [p.locality, p.city].filter(Boolean).join(', '), cover: p.cover && p.cover.url, priceText: `${shortRupees(main)}${isRent ? t('property.perMonth') : ''}`, purpose: p.purpose, city: p.city };
  const hotline = p.hotline || (settings.data && settings.data.hotline) || env.hotline;
  const floorName = d.floor === 0 ? t('property.facts.ground') : d.floor;
  const possessionName = d.possession ? enumLabel(t, 'possession', d.possession.status) : '';
  const areaSqft = d.areaSqft || p.areaSqft;
  // Key facts (icon row) and the remaining facts (overview grid); together they are the full fact list.
  const keyFacts = [
    { icon: BedDouble, label: t('property.facts.bedrooms'), value: d.bhk ? `${d.bhk} BHK` : null },
    { icon: Bath, label: t('property.facts.bathrooms'), value: d.baths },
    { icon: Maximize2, label: t('property.area.title'), value: areaSqft ? t('search.card.sqft', { n: Math.round(areaSqft).toLocaleString('en-IN') }) : null },
    { icon: Layers, label: t('property.facts.floor'), value: d.floor != null ? (d.totalFloors ? t('property.facts.floorOf', { floor: floorName, total: d.totalFloors }) : floorName) : null },
    { icon: Sofa, label: t('property.facts.furnishing'), value: d.furnishing && enumLabel(t, 'furnishing', d.furnishing) },
    { icon: Compass, label: t('property.facts.facing'), value: d.facing && titleCase(d.facing) },
    { icon: KeyRound, label: t('property.facts.possession'), value: d.possession && (d.possession.date && d.possession.status !== 'ready' ? t('property.facts.possessionBy', { status: possessionName, date: date(d.possession.date) }) : possessionName) },
    { icon: HomeIcon, label: t('property.facts.propertyType'), value: titleCase(p.type) },
  ];
  const facts = [
    [t('property.facts.balconies'), d.balconies],
    [t('property.facts.age'), d.ageYears != null ? (d.ageYears < 1 ? t('property.facts.under1') : t('property.facts.years', { n: d.ageYears })) : null],
    [t('property.facts.parking'), d.parking && (d.parking.covered || d.parking.open) ? [d.parking.covered && t('property.facts.covered', { n: d.parking.covered }), d.parking.open && t('property.facts.open', { n: d.parking.open })].filter(Boolean).join(', ') : null],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');
  const showOverview = facts.length > 0 || Boolean(d.areas && (d.areas.carpet || d.areas.builtUp || d.areas.superBuiltUp || d.areas.plot));
  const place = [p.societyName, p.locality, p.city];
  const browseHref = `/search?purpose=${p.purpose}&city=${encodeURIComponent(p.city || '')}`;

  return (
    <div className="pb-28 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:pt-8">
        <nav className="mb-4 flex flex-wrap items-center gap-x-1.5 text-xs text-navy-400" aria-label={t('property.breadcrumb')}>
          <Link to="/" className="transition-colors hover:text-gold-700">{t('property.home')}</Link><span aria-hidden>/</span><Link to={browseHref} className="transition-colors hover:text-gold-700">{p.city}</Link>
          {p.locality && <><span aria-hidden>/</span><Link to={`/city/${slugify(p.city)}/${slugify(p.locality)}`} className="transition-colors hover:text-gold-700">{p.locality}</Link></>}<span aria-hidden>/</span><span className="font-medium text-navy-700">{p.listingNo}</span>
        </nav>
        <MediaTabs p={p} />
      </div>

      <div className="mx-auto mt-8 grid max-w-7xl gap-8 px-4 sm:px-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <div className="min-w-0 space-y-8">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-navy-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">{isRent ? t('search.card.forRent') : t('search.card.forSale')}</span>
              {p.featured && <span className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-950"><Star className="h-3 w-3" aria-hidden />{t('search.card.featured')}</span>}
            </div>
            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-medium leading-[1.15] tracking-tight text-navy-900 sm:text-4xl lg:text-[2.75rem]">{p.title}</h1>
                <PlaceLine parts={place} className="mt-3 text-[15px]" />
                {p.project && (
                  <Link to={`/projects/${p.project.slug}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold-50 px-3.5 py-1.5 text-sm font-medium text-gold-800 ring-1 ring-inset ring-gold-200 transition-colors hover:bg-gold-100" data-testid="part-of-project">
                    <Building2 className="h-4 w-4 text-gold-700" aria-hidden />
                    {p.project.configuration ? t('property.partOfConfig', { project: p.project.name, config: p.project.configuration }) : t('property.partOf', { project: p.project.name })}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <ShortlistButton id={p.id} label listingNo={viewNo} purpose={viewPurpose} city={viewCity} />
                <Button variant="outline" icon={Share2} onClick={() => shareLink(toast, p.title, shareCode)} className="h-11 rounded-full px-5">{t('property.share')}</Button>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy-900/5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">{isRent ? t('detail.price.rent') : t('detail.price.asking')}</p>
              <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="font-display text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">{shortRupees(main)}{isRent && <span className="font-sans text-base font-normal text-navy-400">{t('property.perMonth')}</span>}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1.5 text-sm text-navy-500">
                  {!isRent && price.pricePerSqft && <span>{t('property.price.perSqft', { price: rupees(price.pricePerSqft) })}</span>}
                  {isRent && price.deposit && <span>{t('property.price.deposit', { amount: rupees(price.deposit) })}</span>}
                  {price.maintenance && <span>{t('property.price.maintenance', { amount: rupees(price.maintenance) })}</span>}
                  {price.negotiable && <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">{t('property.price.negotiable')}</span>}
                  {price.allInclusive && <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-navy-600">{t('property.price.allInclusive')}</span>}
                </div>
              </div>
              <VerificationBadges badges={p.badges} size="md" className="mt-5" />
              <p className="mt-4 border-t border-navy-900/5 pt-4 text-xs text-navy-400">{t('property.info.listingId')} <span className="font-semibold text-navy-800">{p.listingNo}</span> · {t('property.info.posted', { date: date(p.postedAt) })} · {t('property.info.confirmed', { date: date(p.availabilityConfirmedAt) })}{p.stats && p.stats.views ? ` · ${t('property.info.views', { n: p.stats.views.toLocaleString('en-IN') })}` : ''}</p>
            </div>
          </header>

          <section aria-label={t('property.overview')}>
            <Eyebrow className="mb-3">{t('detail.sections.overview')}</Eyebrow>
            <KeyFacts items={keyFacts} />
          </section>

          {showOverview && (
            <Block title={t('property.overview')} eyebrow={t('detail.sections.details')}>
              {facts.length > 0 && <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{facts.map(([l, v]) => <Fact key={l} label={l} value={v} />)}</dl>}
              <AreaFacts areas={d.areas} />
            </Block>
          )}

          {p.description && (
            <Block title={t('property.about')}>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-navy-600">{p.description}</p>
            </Block>
          )}

          {p.amenities.length > 0 && (
            <Block title={t('property.amenities')} eyebrow={t('detail.sections.lifestyle')}>
              <AmenityGrid codes={p.amenities} names={amenityNames} />
            </Block>
          )}

          <Block title={t('property.location')} eyebrow={t('detail.sections.neighbourhood')}>
            <PlaceLine parts={place} className="mb-1 font-medium text-navy-800" />
            {p.point && p.point.radiusM ? <p className="mb-4 pl-6 text-xs text-navy-400">{t('property.locationNote', { m: p.point.radiusM })}</p> : <div className="mb-4" />}
            <div className="overflow-hidden rounded-2xl ring-1 ring-navy-900/10"><ApproxMap point={p.point} /></div>
            <Landmarks list={p.landmarks} className="mt-5" />
          </Block>

          {p.rera && <ReraBlock numbers={p.rera.numbers} state={p.rera.state} url={p.rera.url} exempt={Boolean(p.rera.exemptReason)} agentRegistrations={settings.data && settings.data.rera && settings.data.rera.agentRegistrations} showQr={Boolean(settings.data && settings.data.rera && settings.data.rera.showQr)} />}

          {isRent ? <MoveInCost price={price} /> : main ? (
            <Block title={t('property.emi.title')} eyebrow={t('detail.sections.finance')}>
              <EmiMini pricePaise={main} defaults={calc} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-navy-400">
                <span>{t('property.emi.note')}</span>
                <Link to={`/tools/calculators?tab=afford&price=${Math.round(main / 100)}`} className="inline-flex items-center gap-1 text-sm font-medium text-gold-700 underline-offset-4 hover:underline">{t('property.emi.afford')}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
              </div>
            </Block>
          ) : null}

          <LocalitySnapshot p={p} />

          <div className="flex justify-end">
            <button type="button" onClick={() => setReport(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-navy-400 transition-colors hover:bg-danger-50 hover:text-danger-700"><Flag className="h-4 w-4" aria-hidden />{t('property.report')}</button>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 pb-8">
            <EnquiryCard title={t('property.interested')} contacts={CONTACTS} onAction={openAction} onWhatsapp={p.whatsapp ? whatsapp : null} hotline={hotline} listingNo={p.listingNo}
              top={<p className="mt-3 font-display text-3xl font-semibold tracking-tight">{shortRupees(main)}{isRent && <span className="font-sans text-sm font-normal text-navy-300">{t('property.perMonth')}</span>}</p>}
              footnote={`${p.listerBadge}. ${t('property.privateNote')}`} />
          </div>
        </aside>
      </div>

      <section className="mt-16 border-t border-navy-900/5 bg-white py-16 lg:py-20" aria-labelledby="similar-h">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>{t('detail.sections.explore')}</Eyebrow>
              <h2 id="similar-h" className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-navy-900 sm:text-[2.6rem] sm:leading-[1.1]">{t('property.similar')}</h2>
            </div>
            <Button variant="outline" to={browseHref} iconRight={ArrowRight} className="self-start rounded-full sm:self-auto">{p.city ? t('property.gone.browseCity', { city: p.city }) : t('property.gone.browseAll')}</Button>
          </div>
          {similar.isLoading ? <p className="text-sm text-navy-400">{t('common.loading')}</p>
            : (similar.data || []).length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{similar.data.map((c) => <PropertyCard key={c.id} card={c} />)}</div>
            : <p className="rounded-3xl bg-sand-50 p-8 text-center text-sm text-navy-500 ring-1 ring-inset ring-navy-900/5">{t('property.noSimilar')} <Link to={browseHref} className="font-medium text-gold-700 underline-offset-4 hover:underline">{p.city ? t('property.gone.browseCity', { city: p.city }) : t('property.gone.browseAll')}</Link></p>}
        </div>
      </section>

      <MobileActionBar hotline={hotline} onWhatsapp={p.whatsapp ? whatsapp : null}
        primary={<button type="button" onClick={() => openAction('contact')} className={mobilePrimaryCls}><MessageSquare className="h-4 w-4 shrink-0" aria-hidden />{t('property.enquire')}</button>} />

      <EnquiryModal open={enquiryOpen} onClose={closeAction} target={target} initialType={typeForAction(action)} />
      <ReportModal open={report} onClose={() => setReport(false)} propertyId={p.id} listingNo={p.listingNo} />
    </div>
  );
}

