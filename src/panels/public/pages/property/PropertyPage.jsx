// RE-S-PUB-04 property detail (masked): gallery, price, facts, amenities,
// approximate map circle, badges, RERA, calculators, locality snapshot,
// similar listings and the contact panel that opens RE-S-PUB-06. Lister
// name, phone, email, unit number and exact address never reach this page.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Flag, HandCoins, MapPin, MessageCircle, MessageSquare, Phone, PhoneCall, Share2, ShieldCheck, Home as HomeIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { Button, Card, Tabs, useToast } from '@/shared/ui';
import env from '@/config/env';
import { useMasters } from '@/modules/listings/api';
import { FURNISHING, PUBLIC_DEFAULTS, POSSESSION, recordView, useLocalitySummary, usePublicSettings, useProperty, useSimilar, whatsappClick } from '@/modules/search/api';
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
  { action: 'contact', label: 'Contact', icon: MessageSquare },
  { action: 'callback', label: 'Request call-back', icon: PhoneCall },
  { action: 'visit', label: 'Book site visit', icon: CalendarCheck },
  { action: 'price', label: 'Get best price', icon: HandCoins },
];
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function MediaTabs({ p }) {
  const tabs = [{ value: 'photos', label: `Photos (${p.media.photos.length})` }];
  if (p.media.video) tabs.push({ value: 'video', label: 'Video' });
  if (p.media.floorPlans.length) tabs.push({ value: 'plans', label: `Floor plans (${p.media.floorPlans.length})` });
  const [tab, setTab] = useState('photos');
  const embed = p.media.video && p.media.video.kind === 'youtube' ? youtubeEmbed(p.media.video.url) : null;
  return (
    <div>
      {tabs.length > 1 && <Tabs className="mb-3" tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'photos' && <Gallery photos={p.media.photos} />}
      {tab === 'video' && (
        <div className="aspect-video overflow-hidden rounded-lg bg-ink">
          {embed ? <iframe src={embed} title="Video walkthrough" className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            : <video src={p.media.video.url} controls className="h-full w-full" preload="metadata" />}
        </div>
      )}
      {tab === 'plans' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.media.floorPlans.map((f) => (
            /\.pdf($|\?)/i.test(f.url)
              ? <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-lg border bg-white p-8 text-sm font-medium text-brand-700 hover:bg-surface-muted">Open {f.label || 'floor plan'} (PDF)</a>
              : <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-white"><img src={f.url} alt={f.label || 'Floor plan'} className="w-full object-contain" loading="lazy" /><span className="block px-3 py-2 text-xs text-ink-muted">{f.label || 'Floor plan'}</span></a>
          ))}
        </div>
      )}
    </div>
  );
}

function LocalitySnapshot({ p }) {
  const loc = slugify(p.locality);
  const q = useLocalitySummary(p.city, loc);
  if (!q.data) return null;
  const s = q.data.stats || {};
  const trend = q.data.trend || {};
  const value = p.purpose === 'rent' ? s.rent && s.rent.avgMonthlyRent : s.sale && s.sale.avgPricePerSqft;
  if (!value) return null;
  const change = trend.oneYearChangePct && trend.oneYearChangePct[p.purpose === 'rent' ? 'rent' : 'sale'];
  return (
    <Block title={`${q.data.locality.name} at a glance`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-subtle">{p.purpose === 'rent' ? 'Average monthly rent' : 'Average asking price'}</p>
          <p className="text-xl font-semibold text-ink">{rupees(value)}{p.purpose === 'rent' ? '' : ' / sq ft'}</p>
          <p className="text-xs text-ink-subtle">1-year change: <ChangePill pct={change} /></p>
        </div>
        <Button variant="secondary" size="sm" to={`/city/${q.data.city.code}/${q.data.locality.code}`}>Locality prices and trends</Button>
      </div>
      <p className="mt-2 text-xs text-ink-subtle">Indicative, based on listings and deals on this platform.</p>
    </Block>
  );
}

// 410 LISTING_UNAVAILABLE (RE-S-PUB-04 states): sold, rented, expired / inactive, or paused (temporary).
function GoneListing({ info }) {
  const title = info.temporary ? 'This property is temporarily unavailable'
    : info.status === 'sold' ? 'This property is sold' : info.status === 'rented' ? 'This property is rented' : 'This property is no longer available';
  const where = [info.locality, info.city].filter(Boolean).join(', ');
  const browse = `/search?${new URLSearchParams({ ...(info.purpose ? { purpose: info.purpose } : {}), ...(info.city ? { city: info.city } : {}) })}`;
  useEffect(() => { document.title = `${title} | ${env.appName}`; }, [title]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <NotAvailable icon={HomeIcon} title={title}
        description={`${info.title || 'This listing'}${info.listingNo ? ` (${info.listingNo})` : ''}${where ? ` in ${where}` : ''}. ${info.temporary ? 'The lister has paused it for now.' : 'It has been taken off the market.'} Here are similar homes nearby.`}
        action={<div className="flex flex-wrap justify-center gap-2"><Button to={browse}>Browse {info.city || 'properties'}</Button><Button variant="secondary" to="/request-property">Get alerts for similar homes</Button></div>} />
      {(info.similar || []).length > 0 && (
        <section className="mt-2" aria-labelledby="gone-similar-h">
          <h2 id="gone-similar-h" className="mb-4 text-xl font-semibold text-ink">Similar properties{info.locality ? ` in ${info.locality}` : ''}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{info.similar.map((c) => <PropertyCard key={c.id} card={c} />)}</div>
        </section>
      )}
    </div>
  );
}

function MoveInCost({ price }) {
  const rows = [['Security deposit', price.deposit], ['First month rent', price.monthlyRent], ['Maintenance (monthly)', price.maintenance]].filter(([, v]) => v);
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return (
    <Block title="Move-in cost">
      <dl className="divide-y text-sm">
        {rows.map(([l, v]) => <div key={l} className="flex justify-between py-1.5"><dt className="text-ink-muted">{l}</dt><dd className="font-medium text-ink">{rupees(v)}</dd></div>)}
        <div className="flex justify-between pt-2"><dt className="font-semibold text-ink">To move in</dt><dd className="text-lg font-semibold text-ink">{rupees(total)}</dd></div>
      </dl>
    </Block>
  );
}

export default function PropertyPage() {
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
  const enquiryOpen = ENQUIRY_TYPES.some((t) => t.action === action);

  useEffect(() => { if (p && p.id) recordView(p.id); }, [p && p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p) document.title = `${p.title} | ${env.appName}`; }, [p]);

  const amenityNames = useMemo(() => Object.fromEntries(((masters.data && masters.data.amenities) || []).map((a) => [a.code, a.name])), [masters.data]);
  const openAction = (a) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('action', a); return n; }, { replace: false });
  const closeAction = () => setSp((prev) => { const n = new URLSearchParams(prev); n.delete('action'); return n; }, { replace: true });

  const whatsapp = async () => {
    const w = window.open('', '_blank');
    try {
      const r = await whatsappClick(p.id);
      if (r.url && w) w.location.href = r.url; else { if (w) w.close(); toast.info('WhatsApp is not available right now. Please call the hotline.'); }
    } catch (e) { if (w) w.close(); toast.error(e.message); }
  };

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError && q.error.status === 410 && q.error.details) return <GoneListing info={q.error.details} />;
  if (q.isError && q.error.status === 404) {
    return (
      <NotAvailable icon={HomeIcon} title="Property not found" description="We could not find this listing. Similar homes are waiting for you."
        action={<div className="flex flex-wrap justify-center gap-2"><Button to="/search">Browse properties</Button><Button variant="secondary" to="/request-property">Get alerts for similar homes</Button></div>} />
    );
  }
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const d = p.details || {};
  const price = p.price || {};
  const isRent = p.purpose === 'rent';
  const main = isRent ? price.monthlyRent : price.amount;
  const calc = { ...PUBLIC_DEFAULTS.calc, ...((settings.data && settings.data.calc) || {}) };
  const target = { kind: 'property', id: p.id, title: p.title, listingNo: p.listingNo, subtitle: [p.locality, p.city].filter(Boolean).join(', '), cover: p.cover && p.cover.url, priceText: `${shortRupees(main)}${isRent ? ' / month' : ''}` };
  const hotline = p.hotline || (settings.data && settings.data.hotline) || env.hotline;
  const facts = [
    ['Bedrooms', d.bhk ? `${d.bhk} BHK` : null], ['Bathrooms', d.baths], ['Balconies', d.balconies],
    ['Floor', d.floor != null ? `${d.floor === 0 ? 'Ground' : d.floor}${d.totalFloors ? ` of ${d.totalFloors}` : ''}` : null],
    ['Furnishing', d.furnishing && FURNISHING[d.furnishing]], ['Facing', d.facing && titleCase(d.facing)],
    ['Age', d.ageYears != null ? (d.ageYears < 1 ? 'Under 1 year' : `${d.ageYears} years`) : null],
    ['Possession', d.possession && `${POSSESSION[d.possession.status] || d.possession.status}${d.possession.date && d.possession.status !== 'ready' ? ` (by ${date(d.possession.date)})` : ''}`],
    ['Parking', d.parking && (d.parking.covered || d.parking.open) ? [d.parking.covered && `${d.parking.covered} covered`, d.parking.open && `${d.parking.open} open`].filter(Boolean).join(', ') : null],
    ['Property type', titleCase(p.type)],
  ];

  return (
    <div className="pb-24 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <nav className="mb-3 text-xs text-ink-subtle" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-ink">Home</Link> / <Link to={`/search?purpose=${p.purpose}&city=${encodeURIComponent(p.city || '')}`} className="hover:text-ink">{p.city}</Link>
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
                </div>
                <div className="flex gap-2">
                  <ShortlistButton id={p.id} label />
                  <Button variant="secondary" icon={Share2} onClick={() => shareLink(toast, p.title, shareCode)}>Share</Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="text-3xl font-bold text-ink">{shortRupees(main)}{isRent && <span className="text-base font-normal text-ink-subtle"> / month</span>}</p>
                {!isRent && price.pricePerSqft && <p className="pb-1 text-sm text-ink-muted">{rupees(price.pricePerSqft)} per sq ft</p>}
                {isRent && price.deposit && <p className="pb-1 text-sm text-ink-muted">Deposit {rupees(price.deposit)}</p>}
                {price.maintenance && <p className="pb-1 text-sm text-ink-muted">Maintenance {rupees(price.maintenance)}/month</p>}
                {price.negotiable && <span className="mb-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">Negotiable</span>}
                {price.allInclusive && <span className="mb-1 rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-ink-muted">All inclusive</span>}
              </div>
              <VerificationBadges badges={p.badges} size="md" className="mt-4" />
              <p className="mt-3 text-xs text-ink-subtle">Listing ID <span className="font-semibold text-ink">{p.listingNo}</span> · Posted {date(p.postedAt)} · Availability confirmed {date(p.availabilityConfirmedAt)}{p.stats && p.stats.views ? ` · ${p.stats.views.toLocaleString('en-IN')} views` : ''}</p>
            </div>

            <Block title="Overview">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{facts.map(([l, v]) => <Fact key={l} label={l} value={v} />)}</dl>
              <div className="mt-4"><AreaFacts areas={d.areas} /></div>
            </Block>

            {p.description && (
              <Block title="About this property">
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{p.description}</p>
              </Block>
            )}

            {p.amenities.length > 0 && (
              <Block title="Amenities">
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {p.amenities.map((a) => <li key={a} className="flex items-center gap-2 text-sm text-ink"><ShieldCheck className="h-4 w-4 shrink-0 text-success-600" aria-hidden />{amenityNames[a] || titleCase(a)}</li>)}
                </ul>
              </Block>
            )}

            {p.rera && <ReraBlock numbers={p.rera.numbers} state={p.rera.state} url={p.rera.url} exempt={Boolean(p.rera.exemptReason)} agentRegistrations={settings.data && settings.data.rera && settings.data.rera.agentRegistrations} showQr={Boolean(settings.data && settings.data.rera && settings.data.rera.showQr)} />}

            <Block title="Location">
              <p className="mb-3 text-sm text-ink-muted">{[p.societyName, p.locality, p.city].filter(Boolean).join(', ')}. {p.point && p.point.radiusM ? `The circle shows the area within about ${p.point.radiusM} m; the exact address is shared by our agent before a visit.` : ''}</p>
              <ApproxMap point={p.point} />
              {p.landmarks.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.landmarks.map((l) => <li key={`${l.type}-${l.name}`} className="rounded-full border bg-surface-muted px-3 py-1 text-xs text-ink">{l.name}{l.distanceKm != null && <span className="text-ink-subtle"> · {l.distanceKm} km</span>}</li>)}
                </ul>
              )}
            </Block>

            {isRent ? <MoveInCost price={price} /> : main ? (
              <Block title="EMI calculator">
                <EmiMini pricePaise={main} defaults={calc} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
                  <span>Indicative only. Actual eligibility depends on your lender.</span>
                  <Link to={`/tools/calculators?tab=afford&price=${Math.round(main / 100)}`} className="font-medium text-brand-700 hover:underline">Can I afford this?</Link>
                </div>
              </Block>
            ) : null}

            <LocalitySnapshot p={p} />

            <div className="flex justify-end">
              <button type="button" onClick={() => setReport(true)} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-danger-700"><Flag className="h-4 w-4" aria-hidden />Report this listing</button>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-3">
              <Card>
                <p className="text-sm font-semibold text-ink">Interested? Talk to our sales team</p>
                <p className="mt-0.5 text-xs text-ink-subtle">Free and broker-free. Your number stays private.</p>
                <div className="mt-4 grid gap-2">
                  {CONTACTS.map((c, i) => <Button key={c.action} variant={i === 0 ? 'primary' : 'secondary'} icon={c.icon} block onClick={() => openAction(c.action)}>{c.label}</Button>)}
                  {p.whatsapp && <Button variant="secondary" icon={MessageCircle} block onClick={whatsapp} className="border-success-600 text-success-700">WhatsApp us</Button>}
                </div>
                <HotlineQuote hotline={hotline} listingNo={p.listingNo} className="mt-4" />
              </Card>
              <p className="px-1 text-xs text-ink-subtle">{p.listerBadge}. Contact details stay private; our in-house team arranges visits and relays offers.</p>
            </div>
          </aside>
        </div>

        <section className="mt-10" aria-labelledby="similar-h">
          <h2 id="similar-h" className="mb-4 text-xl font-semibold text-ink">Similar properties</h2>
          {similar.isLoading ? <p className="text-sm text-ink-subtle">Loading…</p>
            : (similar.data || []).length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.data.map((c) => <PropertyCard key={c.id} card={c} />)}</div>
            : <p className="text-sm text-ink-subtle">No similar properties right now. <Link to={`/search?purpose=${p.purpose}&city=${encodeURIComponent(p.city || '')}`} className="text-brand-700 hover:underline">Browse {p.city}</Link></p>}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-2 shadow-lg lg:hidden">
        <div className={cn('grid gap-2', p.whatsapp ? 'grid-cols-3' : 'grid-cols-2')}>
          <a href={hotlineHref(hotline)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm font-medium text-ink"><Phone className="h-4 w-4" aria-hidden />Call</a>
          {p.whatsapp && <button type="button" onClick={whatsapp} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-success-600 text-sm font-medium text-success-700"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</button>}
          <button type="button" onClick={() => openAction('contact')} className="inline-flex h-11 items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white">Enquire</button>
        </div>
      </div>

      <EnquiryModal open={enquiryOpen} onClose={closeAction} target={target} initialType={typeForAction(action)} />
      <ReportModal open={report} onClose={() => setReport(false)} propertyId={p.id} listingNo={p.listingNo} />
    </div>
  );
}

