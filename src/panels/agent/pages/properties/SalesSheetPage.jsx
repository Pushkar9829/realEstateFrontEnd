// RE-S-AGT-11 Property sales sheet: full details with exact address and pin,
// owner card with the audited contact reveal, commission and agreement,
// visit availability, open offers, visit history and photos.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Eye, Home, Lock, Mail, MapPin, Phone, ShieldAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton, useToast } from '@/shared/ui';
import { date, dateTime, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { errorText, maskedCallToLister, offerStatus, revealListerContact, useSalesSheet, visitStatus } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { ErrorState, Section, enumLabel, listingStatus } from '../../components/common';

function OwnerCard({ sheet }) {
  const t = useT();
  const toast = useToast();
  const [shown, setShown] = useState({});
  const [busy, setBusy] = useState('');
  const reveal = async (field) => {
    setBusy(field);
    try { const r = await revealListerContact(sheet._id, field); setShown((s) => ({ ...s, [field]: r.value || t('agent.buyer.notGiven') })); } catch (e) { toast.error(errorText(e)); } finally { setBusy(''); }
  };
  const masked = async () => { try { const r = await maskedCallToLister(sheet._id); toast.info(r.message || t('agent.buyer.calling')); } catch (e) { toast.error(errorText(e)); } };
  const l = sheet.lister || {};
  return (
    <Section title={t('agent.activity.owner')}>
      <p className="font-semibold text-ink">{l.name}</p>
      <p className="text-xs text-ink-subtle">{enumLabel('listerType', l.type)}{l.brand ? ` · ${l.brand}` : ''} · KYC {enumLabel('kyc', l.kycStatus || 'not_started')}</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-ink-subtle" />{shown.phone ? <a className="text-brand-700 hover:underline" href={`tel:${shown.phone}`}>{shown.phone}</a> : t('agent.sheet.hidden')}</span>
          {!shown.phone && <Button size="sm" variant="secondary" icon={Eye} loading={busy === 'phone'} onClick={() => reveal('phone')}>{t('agent.buyer.reveal')}</Button>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-ink-subtle" />{shown.email || t('agent.sheet.hidden')}</span>
          {!shown.email && <Button size="sm" variant="ghost" icon={Eye} loading={busy === 'email'} onClick={() => reveal('email')}>{t('agent.buyer.reveal')}</Button>}
        </div>
        <Button size="sm" variant="ghost" icon={Phone} onClick={masked}>{t('agent.sheet.maskedCall')}</Button>
        <p className="text-xs text-ink-subtle">{l.contactHint}</p>
      </div>
    </Section>
  );
}

export default function SalesSheetPage() {
  const t = useT();
  const { id } = useParams();
  const { data: s, isLoading, error, refetch } = useSalesSheet(id);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-80" /></div>;
  if (error && error.status === 403) return <EmptyState icon={Lock} title={t('agent.sheet.lockedTitle')} description={t('agent.sheet.lockedDesc')} action={<Button variant="secondary" to="/agent/properties">{t('agent.sheet.back')}</Button>} />;
  if (error && error.status === 404) return <EmptyState icon={Home} title={t('agent.sheet.notFound')} action={<Button variant="secondary" to="/agent/properties">{t('agent.sheet.back')}</Button>} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const a = s.address || {};
  const coords = a.geo && a.geo.coordinates;
  const price = s.purpose === 'rent' ? s.price && s.price.monthlyRent : s.price && s.price.amount;
  const d = s.details || {};
  const av = s.availability;
  const blackouts = ((av && av.blackouts) || []).filter((b) => new Date(b.to) > new Date()).slice(0, 5);
  const facts = [
    [t('agent.lookup.price'), price ? `${rupees(price)}${s.purpose === 'rent' ? t('agent.sheet.perMonth') : ''}` : '-'],
    ...(s.purpose === 'rent' && s.price && s.price.deposit ? [[t('agent.sheet.deposit'), rupees(s.price.deposit)]] : []),
    [t('agent.followup.type'), enumLabel('propertyType', s.type)], ['BHK', d.bhk != null ? `${d.bhk} BHK` : '-'], [t('agent.sheet.area'), d.areaSqft ? t('agent.common.sqft', { n: d.areaSqft }) : '-'],
    [t('agent.sheet.floor'), d.floor != null ? `${d.floor}${d.totalFloors ? ` ${t('agent.sheet.of', { n: d.totalFloors })}` : ''}` : '-'], [t('agent.sheet.furnishing'), enumLabel('furnishing', d.furnishing) || '-'], [t('agent.sheet.facing'), enumLabel('facing', d.facing) || '-'],
  ];

  return (
    <>
      <PageHeader breadcrumb={<Link to="/agent/properties" className="hover:text-ink">{t('panel.nav.agentProperties')}</Link>} title={s.title}
        description={`${s.listingNo} · ${s.purpose === 'rent' ? t('agent.sheet.forRent') : t('agent.sheet.forSale')} · ${[a.locality, a.city].filter(Boolean).join(', ')}`}
        actions={<Badge tone={s.status === 'live' ? 'success' : 'warning'}>{listingStatus(s.status)}</Badge>} />
      <Alert tone="warning" className="mb-6" title={t('agent.sheet.contactsTitle')}>{t('agent.sheet.contactsText')}</Alert>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(s.media && s.media.photos && s.media.photos.length > 0) && (
            <div className="flex gap-2 overflow-x-auto pb-1">{s.media.photos.map((p) => <img key={p.url} src={p.url} alt="" loading="lazy" className="h-32 w-48 shrink-0 rounded-md object-cover" />)}</div>
          )}
          <Section title={t('agent.sheet.details')}>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{facts.map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-ink-subtle">{k}</dt><dd className="text-right text-ink">{v}</dd></div>)}</dl>
            {(s.amenities || []).length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{s.amenities.map((x) => <Badge key={x}>{titleCase(x)}</Badge>)}</div>}
          </Section>
          <Section title={t('agent.sheet.address')}>
            <p className="flex items-start gap-2 text-sm text-ink"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
              <span>{[a.unitNo && t('agent.sheet.unit', { no: a.unitNo }), a.societyName, a.addressLine, a.locality, a.city, a.pincode].filter(Boolean).join(', ')}</span></p>
            {coords && <a className="mt-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`}>{t('agent.sheet.directions')} <ExternalLink className="h-3.5 w-3.5" /></a>}
            {(a.landmarks || []).length > 0 && <p className="mt-2 text-xs text-ink-subtle">{t('agent.sheet.near', { list: a.landmarks.map((l) => `${l.name}${l.distanceKm ? ` (${l.distanceKm} km)` : ''}`).join(', ') })}</p>}
          </Section>
          <Section title={t('agent.sheet.openOffers')}>
            {(s.openOffers || []).length ? (
              <ul className="divide-y text-sm">
                {s.openOffers.map((o) => { const last = o.rounds[o.rounds.length - 1]; return (
                  <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-medium text-ink">{o.offerNo}</span> · {o.buyerLabel} · {last && last.amount ? shortRupees(last.amount) : '-'}</span>
                    <Badge tone={offerStatus(o.status).tone}>{offerStatus(o.status).label}</Badge>
                  </li>
                ); })}
              </ul>
            ) : <p className="text-sm text-ink-subtle">{t('agent.sheet.noOffers')}</p>}
          </Section>
          <Section title={t('agent.sheet.visitHistory')}>
            {(s.visits || []).length ? (
              <ul className="divide-y text-sm">
                {s.visits.map((v) => (
                  <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{v.visitNo} · {dateTime(v.scheduledAt)}{v.outcome && v.outcome.interest ? ` · ${t('agent.activity.interest', { n: v.outcome.interest })}` : ''}</span>
                    <Badge tone={visitStatus(v.status).tone}>{visitStatus(v.status).label}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-subtle">{t('agent.activity.noVisits')}</p>}
          </Section>
        </div>
        <div className="space-y-6">
          <OwnerCard sheet={s} />
          <Card>
            <h3 className="mb-2 text-base font-semibold text-ink">{t('agent.dealForm.commission')}</h3>
            <p className="text-2xl font-semibold text-ink">{s.commission && s.commission.percent != null ? `${s.commission.percent}%` : '-'}</p>
            <p className="text-xs text-ink-subtle">{s.commission && s.commission.agreementNo ? t('agent.sheet.agreement', { no: s.commission.agreementNo }) : t('agent.sheet.noAgreement')}</p>
          </Card>
          <Section title={t('agent.sheet.availability')}>
            {!av ? <p className="text-sm text-ink-subtle">{t('agent.sheet.noSlots')}</p> : (
              <div className="space-y-2 text-sm">
                {(av.weekly || []).length ? (
                  <ul className="space-y-0.5">{av.weekly.slice().sort((x, y) => x.day - y.day).map((w) => <li key={`${w.day}${w.start}`} className="flex justify-between"><span className="text-ink-subtle">{(t('agent.common.weekdays') || [])[w.day]}</span><span className="text-ink">{w.start} - {w.end}</span></li>)}</ul>
                ) : <p className="text-ink-subtle">{t('agent.sheet.noWeekly')}</p>}
                <p className="text-xs text-ink-subtle">{t('agent.sheet.notice', { n: av.noticeHours || 2 })}</p>
                {blackouts.length > 0 && <div><p className="flex items-center gap-1 text-xs font-medium text-warning-700"><ShieldAlert className="h-3.5 w-3.5" />{t('agent.sheet.notAvailable')}</p><ul className="text-xs text-ink-muted">{blackouts.map((b) => <li key={b.from}>{date(b.from)} - {date(b.to)}{b.reason ? ` · ${b.reason}` : ''}</li>)}</ul></div>}
                {av.note && <p className="rounded-md bg-surface-muted p-2 text-xs text-ink-muted">{av.note}</p>}
              </div>
            )}
          </Section>
          {s.stats && (
            <Card>
              <h3 className="mb-2 text-base font-semibold text-ink">{t('agent.activity.title')}</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">{[[t('agent.sheet.views'), s.stats.views], [t('agent.sheet.enquiries'), s.stats.enquiries], [t('agent.activity.group.visit'), s.stats.visits], [t('agent.activity.offers'), s.stats.offers]].map(([k, v]) => <div key={k}><dt className="text-ink-subtle">{k}</dt><dd className="font-semibold text-ink">{v || 0}</dd></div>)}</dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
