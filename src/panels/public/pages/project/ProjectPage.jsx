// RE-S-PUB-05 builder project detail: gallery, verified builder (no contact),
// RERA block, possession and status, configuration table (available / few
// left / sold out, never exact counts), amenities, approximate location and
// contact buttons with the configuration preselectable.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Building2, CalendarCheck, CalendarClock, FileCheck2, FileText, HandCoins, Maximize2, MessageSquare, Phone, PhoneCall, Share2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, shortRupees, titleCase } from '@/shared/lib/format';
import { Button, useToast } from '@/shared/ui';
import env from '@/config/env';
import { useT } from '@/shared/i18n';
import { track } from '@/shared/lib/analytics';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useMasters } from '@/modules/listings/api';
import { CONFIG_AVAILABILITY, useProjectSearch, usePublicProject, usePublicSettings } from '@/modules/search/api';
import { ENQUIRY_TYPES, typeForAction } from '@/modules/leads/publicApi';
import Gallery from '../../components/Gallery';
import EnquiryModal from '../../components/EnquiryModal';
import BrochureButton from '../../components/BrochureButton';
import { ApproxMap } from '../../components/PublicMap';
import { DetailSkeleton, ErrorState, NotAvailable, hotlineHref } from '../../components/States';
import { AmenityGrid, Block, EnquiryCard, Eyebrow, Landmarks, MobileActionBar, PlaceLine, ReraBlock, mobilePrimaryCls, shareLink, useShareCode } from '../../components/DetailBits';
import ProjectCard, { configRange } from '../../components/ProjectCard';

const CONTACTS = [
  { action: 'contact', icon: MessageSquare },
  { action: 'callback', icon: PhoneCall },
  { action: 'visit', icon: CalendarCheck },
  { action: 'price', icon: HandCoins },
];

// Availability band -> pill colours and how many of the three band marks are lit (a band, never a unit count).
const BAND = {
  available: { pill: 'bg-success-50 text-success-700 ring-success-600/20', bar: 'bg-success-600', lit: 3 },
  few_left: { pill: 'bg-warning-50 text-warning-700 ring-warning-600/20', bar: 'bg-warning-600', lit: 1 },
  sold_out: { pill: 'bg-sand-100 text-navy-500 ring-navy-900/10', bar: 'bg-navy-300', lit: 0 },
};

const geoPoint = (g, radiusM) => (g && g.coordinates ? { lat: g.coordinates[1], lng: g.coordinates[0], radiusM } : null);

export default function ProjectPage() {
  const t = useT();
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const toast = useToast();
  const q = usePublicProject(slug);
  const p = q.data;
  const masters = useMasters();
  const settings = usePublicSettings();
  const shareCode = useShareCode();
  const others = useProjectSearch(p ? { city: p.location.city, limit: 4 } : { limit: 4 });
  const [configId, setConfigId] = useState('');
  const action = sp.get('action');
  const open = ENQUIRY_TYPES.some((x) => x.action === action);
  const amenityNames = useMemo(() => Object.fromEntries(((masters.data && masters.data.amenities) || []).map((a) => [a.code, a.name])), [masters.data]);

  const openAction = (a, cid = '') => { setConfigId(cid); setSp((prev) => { const n = new URLSearchParams(prev); n.set('action', a); return n; }); };
  const closeAction = () => setSp((prev) => { const n = new URLSearchParams(prev); n.delete('action'); return n; }, { replace: true });

  // Funnel analytics: one project_view per loaded project (slug and city only).
  const viewSlug = p && p.slug;
  const viewCity = p && p.location && p.location.city;
  useEffect(() => { if (viewSlug) track('project_view', { projectSlug: slug, city: viewCity }); }, [slug, viewSlug, viewCity]);

  const metaRange = p ? configRange(p.configurations) : null;
  const metaPlace = p && p.location ? [p.location.locality, p.location.city].filter(Boolean).join(', ') : '';
  const metaCover = p && p.media && p.media.photos && p.media.photos[0] && p.media.photos[0].url;
  useDocumentMeta({
    title: p ? p.name : q.isError && q.error.status === 404 ? t('property.project.notFound') : undefined,
    description: p ? (metaRange ? t('property.project.metaDescPrice', { place: metaPlace, price: `${shortRupees(metaRange[0])}${metaRange[1] !== metaRange[0] ? ` - ${shortRupees(metaRange[1])}` : ''}` }) : t('property.project.metaDesc', { place: metaPlace })) : undefined,
    path: slug ? `/projects/${slug}` : undefined,
    image: metaCover && /^https?:\/\//i.test(metaCover) ? metaCover : undefined,
    type: 'article',
  });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 404) return <NotAvailable icon={Building2} title={t('property.project.notFound')} description={t('property.project.notFoundDesc')} action={<Button variant="gold" size="lg" to="/projects" className="rounded-full font-semibold">{t('property.project.seeAll')}</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const projectId = p.id || p._id; // see report: the public project view has no id yet
  const range = configRange(p.configurations);
  const hotline = (settings.data && settings.data.hotline) || env.hotline;
  const radius = settings.data && settings.data.locationPrecision === 'exact' ? 0 : 500;
  const status = p.status === 'sold_out' ? t('property.availability.sold_out') : p.possession && p.possession.status === 'ready' ? t('property.possession.ready') : t('property.possession.under_construction');
  const similar = ((others.data && others.data.items) || []).filter((x) => x.slug !== p.slug).slice(0, 3);
  const target = projectId && { kind: 'project', id: projectId, title: p.name, listingNo: p.projectNo, subtitle: [p.location.locality, p.location.city].filter(Boolean).join(', '), cover: p.media.photos[0] && p.media.photos[0].url, priceText: range ? `${shortRupees(range[0])} - ${shortRupees(range[1])}` : undefined, configurations: p.configurations, slug: p.slug || slug, city: p.location.city, brochure: p.media.brochure ? { kind: 'project', slug: p.slug || slug } : null };
  const cover = p.media.photos[0];
  const reraNo = p.rera && p.rera.registrations && p.rera.registrations[0] && p.rera.registrations[0].number;
  const place = [p.location.locality, p.location.city];
  const configs = p.configurations || [];
  const bandOf = (c) => (CONFIG_AVAILABILITY[c.availability] ? c.availability : 'available');
  const floorPlans = Array.isArray(p.media.floorPlans) ? p.media.floorPlans : [];

  return (
    <div className="pb-28 lg:pb-0">
      <section className="relative isolate overflow-hidden bg-navy-950">
        {cover
          ? <img src={cover.url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          : <img src="/images/stock/pune-aerial.webp" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/30" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/80 via-navy-950/30 to-transparent" aria-hidden />
        <div className="mx-auto flex min-h-[440px] max-w-7xl flex-col justify-end px-4 pb-10 pt-6 sm:px-6 lg:min-h-[540px] lg:pb-14">
          <nav className="mb-auto flex flex-wrap items-center gap-x-1.5 pb-10 text-xs text-navy-300" aria-label={t('property.breadcrumb')}>
            <Link to="/" className="transition-colors hover:text-white">{t('property.home')}</Link><span aria-hidden>/</span><Link to="/projects" className="transition-colors hover:text-white">{t('property.project.projects')}</Link><span aria-hidden>/</span><span className="text-white">{p.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-900">{status}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-navy-950/40 px-3 py-1 text-xs font-medium text-gold-300 backdrop-blur"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />{t('property.project.verifiedBuilder')}</span>
            {reraNo && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur"><FileCheck2 className="h-3.5 w-3.5 text-gold-300" aria-hidden />{t('detail.project.rera', { number: reraNo })}</span>}
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-medium leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">{p.name}</h1>
          <PlaceLine parts={place} light className="mt-4 text-base" />
          <div className="mt-8 flex flex-col gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              {range && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">{t('detail.project.startingFrom')}</p>
                  <p className="mt-1 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">{shortRupees(range[0])}{range[1] !== range[0] && <span className="text-2xl font-medium text-navy-200 sm:text-3xl"> - {shortRupees(range[1])}</span>}</p>
                </div>
              )}
              {p.possession && p.possession.date && <p className="flex items-center gap-2 pb-1.5 text-sm text-navy-200"><CalendarClock className="h-4 w-4 text-gold-300" aria-hidden />{t('property.project.possessionOn', { date: date(p.possession.date) })}</p>}
              <p className="pb-1.5 text-xs text-navy-300">{t('property.project.projectId')} <span className="font-semibold text-white">{p.projectNo}</span></p>
            </div>
            <Button variant="glass" size="lg" icon={Share2} onClick={() => shareLink(toast, p.name, shareCode)} className="self-start rounded-full sm:self-auto">{t('property.share')}</Button>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-10 grid max-w-7xl gap-8 px-4 sm:px-6 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <div className="min-w-0 space-y-8">
          <Block title={t('property.project.configurations')} eyebrow={t('detail.sections.configurations')}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {configs.map((c) => {
                const aKey = bandOf(c);
                const sold = c.availability === 'sold_out';
                return (
                  <li key={c._id} className={cn('flex flex-col rounded-2xl bg-sand-50 p-5 ring-1 ring-inset ring-navy-900/5 transition', sold ? 'opacity-60' : 'hover:bg-white hover:shadow-card')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-xl font-medium text-navy-900">{c.name || `${c.bhk} BHK`}</p>
                        {c.type && <p className="text-xs text-navy-500">{titleCase(c.type)}</p>}
                      </div>
                      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', BAND[aKey].pill)}>{t(`property.availability.${aKey}`)}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-navy-900/5 pt-4">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-500">{t('property.project.colCarpet')}</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-navy-800"><Maximize2 className="h-3.5 w-3.5 text-gold-700" aria-hidden />{t('property.project.sqft', { area: c.carpetMin === c.carpetMax ? c.carpetMin : `${c.carpetMin} - ${c.carpetMax}` })}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-500">{t('property.project.colPrice')}</dt>
                        <dd className="mt-0.5 font-display text-lg font-semibold text-navy-900">{shortRupees(c.priceMin)}{c.priceMax !== c.priceMin && ` - ${shortRupees(c.priceMax)}`}</dd>
                      </div>
                    </dl>
                    {!sold && projectId && (
                      <button type="button" onClick={() => openAction('contact', c._id)}
                        className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-navy-900/15 bg-white text-sm font-medium text-navy-900 transition-colors hover:border-gold-500 hover:text-gold-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500">
                        {t('property.enquire')}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Block>

          {configs.length > 0 && (
            <Block title={t('detail.sections.availability')} eyebrow={t('property.project.colAvailability')}>
              <ul className="space-y-3">
                {configs.map((c) => {
                  const aKey = bandOf(c);
                  return (
                    <li key={c._id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,180px)_1fr_110px]">
                      <span className="truncate text-sm font-medium text-navy-800">{c.name || `${c.bhk} BHK`}</span>
                      <span className="col-span-2 row-start-2 flex gap-1.5 sm:col-span-1 sm:row-start-auto" aria-hidden>
                        {[0, 1, 2].map((i) => <span key={i} className={cn('h-2 flex-1 rounded-full', i < BAND[aKey].lit ? BAND[aKey].bar : 'bg-sand-200')} />)}
                      </span>
                      <span className="text-right text-xs font-medium text-navy-500 sm:col-start-3 sm:row-start-1">{t(`property.availability.${aKey}`)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-5 text-xs text-navy-500">{t('detail.project.availabilityNote')}</p>
            </Block>
          )}

          {p.media.photos.length > 0 && (
            <section aria-label={t('detail.project.photosTitle')}>
              <Eyebrow className="mb-4">{t('detail.sections.media')}</Eyebrow>
              <Gallery photos={p.media.photos} />
            </section>
          )}

          {p.description && <Block title={t('property.project.about')}><p className="whitespace-pre-line text-[15px] leading-relaxed text-navy-600">{p.description}</p></Block>}

          {(p.amenities || []).length > 0 && (
            <Block title={t('property.amenities')} eyebrow={t('detail.sections.lifestyle')}>
              <AmenityGrid codes={p.amenities} names={amenityNames} />
            </Block>
          )}

          <ReraBlock registrations={(p.rera && p.rera.registrations) || []} exempt={Boolean(p.rera && p.rera.exempt)} agentRegistrations={settings.data && settings.data.rera && settings.data.rera.agentRegistrations} showQr={Boolean(settings.data && settings.data.rera && settings.data.rera.showQr)} />

          <Block title={t('property.location')} eyebrow={t('detail.sections.neighbourhood')}>
            <PlaceLine parts={place} className="mb-4 font-medium text-navy-800" />
            <div className="overflow-hidden rounded-2xl ring-1 ring-navy-900/10"><ApproxMap point={geoPoint(p.location.publicGeo, radius)} /></div>
            <Landmarks list={p.location.landmarks || []} className="mt-5" />
          </Block>

          {(p.media.brochure || floorPlans.length > 0) && (
            <Block title={t('detail.project.brochureTitle')}>
              {p.media.brochure && (
                <div className="flex flex-col gap-4 rounded-2xl bg-sand-50 p-5 ring-1 ring-inset ring-navy-900/5 sm:flex-row sm:items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-gold-700 ring-1 ring-gold-300"><FileText className="h-5 w-5" aria-hidden /></span>
                  <p className="flex-1 text-sm leading-relaxed text-navy-600">{t('property.project.brochure', { rera: reraNo ? t('property.project.brochureRera', { number: reraNo }) : '' })}</p>
                  <BrochureButton kind="project" slug={p.slug || slug} onEnquire={projectId ? () => openAction('contact') : undefined} variant="gold" className="self-start rounded-full px-5 font-semibold sm:self-auto" />
                </div>
              )}
              {floorPlans.length > 0 && (
                <div className={cn('grid gap-4 sm:grid-cols-2', p.media.brochure && 'mt-4')}>
                  {floorPlans.filter((f) => f && f.url).map((f) => (
                    <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl bg-white ring-1 ring-navy-900/10 transition hover:shadow-card">
                      {/\.pdf($|\?)/i.test(f.url)
                        ? <span className="flex items-center gap-3 p-5 text-sm font-medium text-navy-900"><FileText className="h-5 w-5 text-gold-700" aria-hidden />{t('property.media.openPdf', { label: f.label || t('property.media.floorPlanLower') })}</span>
                        : <><img src={f.url} alt={f.label || t('property.media.floorPlan')} className="w-full bg-sand-50 object-contain" loading="lazy" /><span className="block px-4 py-3 text-sm font-medium text-navy-800">{f.label || t('property.media.floorPlan')}</span></>}
                    </a>
                  ))}
                </div>
              )}
            </Block>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 pb-8">
            <EnquiryCard title={t('property.project.talk')} contacts={CONTACTS} onAction={projectId ? (a) => openAction(a) : null} hotline={hotline} listingNo={p.projectNo}
              noEnquiryText={t('property.project.callToEnquire')}
              top={range ? <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{shortRupees(range[0])}{range[1] !== range[0] && <span className="text-xl font-medium text-navy-300"> - {shortRupees(range[1])}</span>}</p> : null} />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16 border-t border-navy-900/5 bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>{t('detail.sections.explore')}</Eyebrow>
                <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-navy-900 sm:text-[2.6rem] sm:leading-[1.1]">{t('property.project.moreIn', { city: p.location.city })}</h2>
              </div>
              <Button variant="outline" to="/projects" iconRight={ArrowRight} className="self-start rounded-full sm:self-auto">{t('property.project.seeAll')}</Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{similar.map((x) => <ProjectCard key={x.slug} p={x} />)}</div>
          </div>
        </section>
      )}
      {similar.length === 0 && <div className="h-16" aria-hidden />}

      <MobileActionBar hotline={hotline}
        primary={projectId
          ? <button type="button" onClick={() => openAction('contact')} className={mobilePrimaryCls}><MessageSquare className="h-4 w-4 shrink-0" aria-hidden />{t('property.enquire')}</button>
          : <a href={hotlineHref(hotline)} className={mobilePrimaryCls}><Phone className="h-4 w-4 shrink-0" aria-hidden />{t('property.project.quote', { no: p.projectNo })}</a>} />
      {target && <EnquiryModal open={open} onClose={closeAction} target={target} initialType={typeForAction(action)} initialConfigId={configId} />}
    </div>
  );
}
