// RE-S-PUB-04 property detail (masked): gallery, price, facts, amenities,
// approximate map circle, badges, RERA, calculators, locality snapshot,
// similar listings and the contact panel that opens RE-S-PUB-06. Lister
// name, phone, email, unit number and exact address never reach this page.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Flag, HandCoins, MapPin, MessageCircle, MessageSquare, Phone, PhoneCall, Share2, ShieldCheck, Building2, Home as HomeIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { Button, Card, Tabs, useToast } from '@/shared/ui';
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
import { DetailSkeleton, ErrorState, NotAvailable, hotlineHref } from '../../components/States';
import { AreaFacts, Block, Fact, HotlineQuote, ReraBlock, shareLink, useShareCode, youtubeEmbed } from '../../components/DetailBits';

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
      {tabs.length > 1 && <Tabs className="mb-3" tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'photos' && <Gallery photos={p.media.photos} />}
      {tab === 'video' && (
        <div className="aspect-video overflow-hidden rounded-lg bg-ink">
          {embed ? <iframe src={embed} title={t('property.media.videoTitle')} className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            : <video src={p.media.video.url} controls className="h-full w-full" preload="metadata" />}
        </div>
      )}
      {tab === 'plans' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.media.floorPlans.map((f) => (
            /\.pdf($|\?)/i.test(f.url)
              ? <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-lg border bg-white p-8 text-sm font-medium text-brand-700 hover:bg-surface-muted">{t('property.media.openPdf', { label: f.label || t('property.media.floorPlanLower') })}</a>
              : <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-white"><img src={f.url} alt={f.label || t('property.media.floorPlan')} className="w-full object-contain" loading="lazy" /><span className="block px-3 py-2 text-xs text-ink-muted">{f.label || t('property.media.floorPlan')}</span></a>
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
    <Block title={t('property.locality.title', { name: q.data.locality.name })}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-subtle">{p.purpose === 'rent' ? t('property.locality.avgRent') : t('property.locality.avgPrice')}</p>
          <p className="text-xl font-semibold text-ink">{rupees(value)}{p.purpose === 'rent' ? '' : t('property.locality.perSqft')}</p>
          <p className="text-xs text-ink-subtle">{t('property.locality.change')} <ChangePill pct={change} /></p>
        </div>
        <Button variant="secondary" size="sm" to={`/city/${q.data.city.code}/${q.data.locality.code}`}>{t('property.locality.trends')}</Button>
      </div>
      <p className="mt-2 text-xs text-ink-subtle">{t('property.locality.note')}</p>
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
        action={<div className="flex flex-wrap justify-center gap-2"><Button to={browse}>{info.city ? t('property.gone.browseCity', { city: info.city }) : t('property.gone.browseAll')}</Button><Button variant="secondary" to="/request-property">{t('property.gone.alerts')}</Button></div>} />
      {(info.similar || []).length > 0 && (
        <section className="mt-2" aria-labelledby="gone-similar-h">
          <h2 id="gone-similar-h" className="mb-4 text-xl font-semibold text-ink">{info.locality ? t('property.gone.similarIn', { locality: info.locality }) : t('property.similar')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{info.similar.map((c) => <PropertyCard key={c.id} card={c} />)}</div>
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
    <Block title={t('property.moveIn.title')}>
      <dl className="divide-y text-sm">
        {rows.map(([l, v]) => <div key={l} className="flex justify-between py-1.5"><dt className="text-ink-muted">{l}</dt><dd className="font-medium text-ink">{rupees(v)}</dd></div>)}
        <div className="flex justify-between pt-2"><dt className="font-semibold text-ink">{t('property.moveIn.total')}</dt><dd className="text-lg font-semibold text-ink">{rupees(total)}</dd></div>
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
        action={<div className="flex flex-wrap justify-center gap-2"><Button to="/search">{t('property.gone.browseAll')}</Button><Button variant="secondary" to="/request-property">{t('property.gone.alerts')}</Button></div>} />
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
  const facts = [
    [t('property.facts.bedrooms'), d.bhk ? `${d.bhk} BHK` : null], [t('property.facts.bathrooms'), d.baths], [t('property.facts.balconies'), d.balconies],
    [t('property.facts.floor'), d.floor != null ? (d.totalFloors ? t('property.facts.floorOf', { floor: floorName, total: d.totalFloors }) : floorName) : null],
    [t('property.facts.furnishing'), d.furnishing && enumLabel(t, 'furnishing', d.furnishing)], [t('property.facts.facing'), d.facing && titleCase(d.facing)],
    [t('property.facts.age'), d.ageYears != null ? (d.ageYears < 1 ? t('property.facts.under1') : t('property.facts.years', { n: d.ageYears })) : null],
    [t('property.facts.possession'), d.possession && (d.possession.date && d.possession.status !== 'ready' ? t('property.facts.possessionBy', { status: possessionName, date: date(d.possession.date) }) : possessionName)],
    [t('property.facts.parking'), d.parking && (d.parking.covered || d.parking.open) ? [d.parking.covered && t('property.facts.covered', { n: d.parking.covered }), d.parking.open && t('property.facts.open', { n: d.parking.open })].filter(Boolean).join(', ') : null],
    [t('property.facts.propertyType'), titleCase(p.type)],
  ];

  return (
    <div className="pb-24 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <nav className="mb-3 text-xs text-ink-subtle" aria-label={t('property.breadcrumb')}>
          <Link to="/" className="hover:text-ink">{t('property.home')}</Link> / <Link to={`/search?purpose=${p.purpose}&city=${encodeURIComponent(p.city || '')}`} className="hover:text-ink">{p.city}</Link>
          {p.locality && <> / <Link to={`/city/${slugify(p.city)}/${slugify(p.locality)}`} className="hover:text-ink">{p.locality}</Link></>} / <span className="text-ink">{p.listingNo}</span>
        </nav>
        <MediaTabs p={p} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{p.title}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden />{[p.societyName, p.locality, p.city].filter(Boolean).join(', ')}</p>
                  {p.project && (
                    <Link to={`/projects/${p.project.slug}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline" data-testid="part-of-project">
                      <Building2 className="h-4 w-4" aria-hidden />
                      {p.project.configuration ? t('property.partOfConfig', { project: p.project.name, config: p.project.configuration }) : t('property.partOf', { project: p.project.name })}
                    </Link>
                  )}
                </div>
                <div className="flex gap-2">
                  <ShortlistButton id={p.id} label listingNo={viewNo} purpose={viewPurpose} city={viewCity} />
                  <Button variant="secondary" icon={Share2} onClick={() => shareLink(toast, p.title, shareCode)}>{t('property.share')}</Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="text-3xl font-bold text-ink">{shortRupees(main)}{isRent && <span className="text-base font-normal text-ink-subtle">{t('property.perMonth')}</span>}</p>
                {!isRent && price.pricePerSqft && <p className="pb-1 text-sm text-ink-muted">{t('property.price.perSqft', { price: rupees(price.pricePerSqft) })}</p>}
                {isRent && price.deposit && <p className="pb-1 text-sm text-ink-muted">{t('property.price.deposit', { amount: rupees(price.deposit) })}</p>}
                {price.maintenance && <p className="pb-1 text-sm text-ink-muted">{t('property.price.maintenance', { amount: rupees(price.maintenance) })}</p>}
                {price.negotiable && <span className="mb-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">{t('property.price.negotiable')}</span>}
                {price.allInclusive && <span className="mb-1 rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-ink-muted">{t('property.price.allInclusive')}</span>}
              </div>
              <VerificationBadges badges={p.badges} size="md" className="mt-4" />
              <p className="mt-3 text-xs text-ink-subtle">{t('property.info.listingId')} <span className="font-semibold text-ink">{p.listingNo}</span> · {t('property.info.posted', { date: date(p.postedAt) })} · {t('property.info.confirmed', { date: date(p.availabilityConfirmedAt) })}{p.stats && p.stats.views ? ` · ${t('property.info.views', { n: p.stats.views.toLocaleString('en-IN') })}` : ''}</p>
            </div>

            <Block title={t('property.overview')}>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{facts.map(([l, v]) => <Fact key={l} label={l} value={v} />)}</dl>
              <div className="mt-4"><AreaFacts areas={d.areas} /></div>
            </Block>

            {p.description && (
              <Block title={t('property.about')}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{p.description}</p>
              </Block>
            )}

            {p.amenities.length > 0 && (
              <Block title={t('property.amenities')}>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {p.amenities.map((a) => <li key={a} className="flex items-center gap-2 text-sm text-ink"><ShieldCheck className="h-4 w-4 shrink-0 text-success-600" aria-hidden />{amenityNames[a] || titleCase(a)}</li>)}
                </ul>
              </Block>
            )}

            {p.rera && <ReraBlock numbers={p.rera.numbers} state={p.rera.state} url={p.rera.url} exempt={Boolean(p.rera.exemptReason)} agentRegistrations={settings.data && settings.data.rera && settings.data.rera.agentRegistrations} showQr={Boolean(settings.data && settings.data.rera && settings.data.rera.showQr)} />}

            <Block title={t('property.location')}>
              <p className="mb-3 text-sm text-ink-muted">{[p.societyName, p.locality, p.city].filter(Boolean).join(', ')}. {p.point && p.point.radiusM ? t('property.locationNote', { m: p.point.radiusM }) : ''}</p>
              <ApproxMap point={p.point} />
              {p.landmarks.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.landmarks.map((l) => <li key={`${l.type}-${l.name}`} className="rounded-full border bg-surface-muted px-3 py-1 text-xs text-ink">{l.name}{l.distanceKm != null && <span className="text-ink-subtle"> · {l.distanceKm} km</span>}</li>)}
                </ul>
              )}
            </Block>

            {isRent ? <MoveInCost price={price} /> : main ? (
              <Block title={t('property.emi.title')}>
                <EmiMini pricePaise={main} defaults={calc} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
                  <span>{t('property.emi.note')}</span>
                  <Link to={`/tools/calculators?tab=afford&price=${Math.round(main / 100)}`} className="font-medium text-brand-700 hover:underline">{t('property.emi.afford')}</Link>
                </div>
              </Block>
            ) : null}

            <LocalitySnapshot p={p} />

            <div className="flex justify-end">
              <button type="button" onClick={() => setReport(true)} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-danger-700"><Flag className="h-4 w-4" aria-hidden />{t('property.report')}</button>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-3">
              <Card>
                <p className="text-sm font-semibold text-ink">{t('property.interested')}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{t('property.freePrivate')}</p>
                <div className="mt-4 grid gap-2">
                  {CONTACTS.map((c, i) => <Button key={c.action} variant={i === 0 ? 'primary' : 'secondary'} icon={c.icon} block onClick={() => openAction(c.action)}>{t(`property.contacts.${c.action}`)}</Button>)}
                  {p.whatsapp && <Button variant="secondary" icon={MessageCircle} block onClick={whatsapp} className="border-success-600 text-success-700">{t('property.whatsappUs')}</Button>}
                </div>
                <HotlineQuote hotline={hotline} listingNo={p.listingNo} className="mt-4" />
              </Card>
              <p className="px-1 text-xs text-ink-subtle">{p.listerBadge}. {t('property.privateNote')}</p>
            </div>
          </aside>
        </div>

        <section className="mt-10" aria-labelledby="similar-h">
          <h2 id="similar-h" className="mb-4 text-xl font-semibold text-ink">{t('property.similar')}</h2>
          {similar.isLoading ? <p className="text-sm text-ink-subtle">{t('common.loading')}</p>
            : (similar.data || []).length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.data.map((c) => <PropertyCard key={c.id} card={c} />)}</div>
            : <p className="text-sm text-ink-subtle">{t('property.noSimilar')} <Link to={`/search?purpose=${p.purpose}&city=${encodeURIComponent(p.city || '')}`} className="text-brand-700 hover:underline">{p.city ? t('property.gone.browseCity', { city: p.city }) : t('property.gone.browseAll')}</Link></p>}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-2 shadow-lg lg:hidden">
        <div className={cn('grid gap-2', p.whatsapp ? 'grid-cols-3' : 'grid-cols-2')}>
          <a href={hotlineHref(hotline)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm font-medium text-ink"><Phone className="h-4 w-4" aria-hidden />{t('property.call')}</a>
          {p.whatsapp && <button type="button" onClick={whatsapp} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-success-600 text-sm font-medium text-success-700"><MessageCircle className="h-4 w-4" aria-hidden />{t('property.whatsapp')}</button>}
          <button type="button" onClick={() => openAction('contact')} className="inline-flex h-11 items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white">{t('property.enquire')}</button>
        </div>
      </div>

      <EnquiryModal open={enquiryOpen} onClose={closeAction} target={target} initialType={typeForAction(action)} />
      <ReportModal open={report} onClose={() => setReport(false)} propertyId={p.id} listingNo={p.listingNo} />
    </div>
  );
}

