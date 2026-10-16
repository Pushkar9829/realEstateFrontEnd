// RE-S-PUB-05 builder project detail: gallery, verified builder (no contact),
// RERA block, possession and status, configuration table (available / few
// left / sold out, never exact counts), amenities, approximate location and
// contact buttons with the configuration preselectable.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Building2, CalendarClock, CalendarCheck, HandCoins, MapPin, MessageSquare, Phone, PhoneCall, Share2, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, shortRupees, titleCase } from '@/shared/lib/format';
import { Badge, Button, Card, useToast } from '@/shared/ui';
import env from '@/config/env';
import { useT } from '@/shared/i18n';
import { track } from '@/shared/lib/analytics';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useMasters } from '@/modules/listings/api';
import { CONFIG_AVAILABILITY, useProjectSearch, usePublicProject, usePublicSettings } from '@/modules/search/api';
import { ENQUIRY_TYPES, typeForAction } from '@/modules/leads/publicApi';
import Gallery from '../../components/Gallery';
import EnquiryModal from '../../components/EnquiryModal';
import { ApproxMap } from '../../components/PublicMap';
import { DetailSkeleton, ErrorState, NotAvailable, hotlineHref } from '../../components/States';
import { Block, HotlineQuote, ReraBlock, shareLink, useShareCode } from '../../components/DetailBits';
import ProjectCard, { configRange } from '../../components/ProjectCard';

const CONTACTS = [
  { action: 'contact', icon: MessageSquare },
  { action: 'callback', icon: PhoneCall },
  { action: 'visit', icon: CalendarCheck },
  { action: 'price', icon: HandCoins },
];

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
  if (q.isError && q.error.status === 404) return <NotAvailable icon={Building2} title={t('property.project.notFound')} description={t('property.project.notFoundDesc')} action={<Button to="/projects">{t('property.project.seeAll')}</Button>} />;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const projectId = p.id || p._id; // see report: the public project view has no id yet
  const range = configRange(p.configurations);
  const hotline = (settings.data && settings.data.hotline) || env.hotline;
  const radius = settings.data && settings.data.locationPrecision === 'exact' ? 0 : 500;
  const status = p.status === 'sold_out' ? [t('property.availability.sold_out'), 'neutral'] : p.possession && p.possession.status === 'ready' ? [t('property.possession.ready'), 'success'] : [t('property.possession.under_construction'), 'info'];
  const similar = ((others.data && others.data.items) || []).filter((x) => x.slug !== p.slug).slice(0, 3);
  const target = projectId && { kind: 'project', id: projectId, title: p.name, listingNo: p.projectNo, subtitle: [p.location.locality, p.location.city].filter(Boolean).join(', '), cover: p.media.photos[0] && p.media.photos[0].url, priceText: range ? `${shortRupees(range[0])} - ${shortRupees(range[1])}` : undefined, configurations: p.configurations, slug: p.slug || slug, city: p.location.city };
  const contact = projectId ? CONTACTS.map((c, i) => <Button key={c.action} variant={i === 0 ? 'primary' : 'secondary'} icon={c.icon} block onClick={() => openAction(c.action)}>{t(`property.contacts.${c.action}`)}</Button>) : null;

  return (
    <div className="pb-24 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <nav className="mb-3 text-xs text-ink-subtle" aria-label={t('property.breadcrumb')}><Link to="/" className="hover:text-ink">{t('property.home')}</Link> / <Link to="/projects" className="hover:text-ink">{t('property.project.projects')}</Link> / <span className="text-ink">{p.name}</span></nav>
        <Gallery photos={p.media.photos} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-6">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-1.5"><Badge tone={status[1]}>{status[0]}</Badge><Badge tone="success" icon={BadgeCheck}>{t('property.project.verifiedBuilder')}</Badge></div>
                  <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{p.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden />{[p.location.locality, p.location.city].filter(Boolean).join(', ')}</p>
                </div>
                <Button variant="secondary" icon={Share2} onClick={() => shareLink(toast, p.name, shareCode)}>{t('property.share')}</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                {range && <p className="text-3xl font-bold text-ink">{shortRupees(range[0])}{range[1] !== range[0] && <span> - {shortRupees(range[1])}</span>}</p>}
                {p.possession && p.possession.date && <p className="flex items-center gap-1 pb-1 text-sm text-ink-muted"><CalendarClock className="h-4 w-4" aria-hidden />{t('property.project.possessionOn', { date: date(p.possession.date) })}</p>}
              </div>
              <p className="mt-2 text-xs text-ink-subtle">{t('property.project.projectId')} <span className="font-semibold text-ink">{p.projectNo}</span></p>
            </div>

            <Block title={t('property.project.configurations')}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-2 pr-3">{t('property.project.colType')}</th><th className="py-2 pr-3">{t('property.project.colCarpet')}</th><th className="py-2 pr-3">{t('property.project.colPrice')}</th><th className="py-2 pr-3">{t('property.project.colAvailability')}</th><th className="py-2" /></tr></thead>
                  <tbody className="divide-y">
                    {p.configurations.map((c) => {
                      const aKey = CONFIG_AVAILABILITY[c.availability] ? c.availability : 'available';
                      const a = CONFIG_AVAILABILITY[aKey];
                      const sold = c.availability === 'sold_out';
                      return (
                        <tr key={c._id} className={cn(sold && 'text-ink-subtle opacity-60')}>
                          <td className="py-2.5 pr-3 font-medium">{c.name || `${c.bhk} BHK`}<span className="block text-xs font-normal text-ink-subtle">{titleCase(c.type)}</span></td>
                          <td className="py-2.5 pr-3">{t('property.project.sqft', { area: c.carpetMin === c.carpetMax ? c.carpetMin : `${c.carpetMin} - ${c.carpetMax}` })}</td>
                          <td className="py-2.5 pr-3">{shortRupees(c.priceMin)}{c.priceMax !== c.priceMin && ` - ${shortRupees(c.priceMax)}`}</td>
                          <td className="py-2.5 pr-3"><Badge tone={a.tone}>{t(`property.availability.${aKey}`)}</Badge></td>
                          <td className="py-2.5 text-right">{!sold && projectId && <Button size="sm" variant="secondary" onClick={() => openAction('contact', c._id)}>{t('property.enquire')}</Button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Block>

            {p.description && <Block title={t('property.project.about')}><p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{p.description}</p></Block>}

            {(p.amenities || []).length > 0 && (
              <Block title={t('property.amenities')}>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {p.amenities.map((a) => <li key={a} className="flex items-center gap-2 text-sm text-ink"><ShieldCheck className="h-4 w-4 shrink-0 text-success-600" aria-hidden />{amenityNames[a] || titleCase(a)}</li>)}
                </ul>
              </Block>
            )}

            <ReraBlock registrations={(p.rera && p.rera.registrations) || []} exempt={Boolean(p.rera && p.rera.exempt)} agentRegistrations={settings.data && settings.data.rera && settings.data.rera.agentRegistrations} showQr={Boolean(settings.data && settings.data.rera && settings.data.rera.showQr)} />

            <Block title={t('property.location')}>
              <ApproxMap point={geoPoint(p.location.publicGeo, radius)} />
              {(p.location.landmarks || []).length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.location.landmarks.map((l) => <li key={`${l.type}-${l.name}`} className="rounded-full border bg-surface-muted px-3 py-1 text-xs text-ink">{l.name}{l.distanceKm != null && <span className="text-ink-subtle"> · {l.distanceKm} km</span>}</li>)}
                </ul>
              )}
            </Block>
            {p.media.brochure && <p className="text-sm text-ink-muted">{t('property.project.brochure', { rera: p.rera && p.rera.registrations && p.rera.registrations[0] ? t('property.project.brochureRera', { number: p.rera.registrations[0].number }) : '' })}</p>}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <Card>
                <p className="text-sm font-semibold text-ink">{t('property.project.talk')}</p>
                <p className="mt-0.5 text-xs text-ink-subtle">{t('property.freePrivate')}</p>
                {contact ? <div className="mt-4 grid gap-2">{contact}</div> : <p className="mt-3 text-sm text-ink-muted">{t('property.project.callToEnquire')}</p>}
                <HotlineQuote hotline={hotline} listingNo={p.projectNo} className="mt-4" />
              </Card>
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold text-ink">{t('property.project.moreIn', { city: p.location.city })}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.map((x) => <ProjectCard key={x.slug} p={x} />)}</div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-2 shadow-lg lg:hidden">
        <div className="grid grid-cols-2 gap-2">
          <a href={hotlineHref(hotline)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm font-medium text-ink"><Phone className="h-4 w-4" aria-hidden />{t('property.call')}</a>
          {projectId ? <button type="button" onClick={() => openAction('contact')} className="inline-flex h-11 items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white">{t('property.enquire')}</button>
            : <a href={hotlineHref(hotline)} className="inline-flex h-11 items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white">{t('property.project.quote', { no: p.projectNo })}</a>}
        </div>
      </div>
      {target && <EnquiryModal open={open} onClose={closeAction} target={target} initialType={typeForAction(action)} initialConfigId={configId} />}
    </div>
  );
}
