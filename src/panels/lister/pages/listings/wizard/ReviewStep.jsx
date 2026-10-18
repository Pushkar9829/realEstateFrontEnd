// Step 8: completeness checklist, a masked public preview (what buyers will
// see: no name, unit number or address) and submit for approval.
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Bath, BedDouble, CheckCircle2, MapPin, Ruler, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, useToast } from '@/shared/ui';
import { number, shortRupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { missingSteps, priceOf, REVISABLE, useMasters, useSubmitListing, WARNING_LABELS } from '@/modules/listings/api';
import { useT } from '@/shared/i18n';

export default function ReviewStep({ listing, goto, back }) {
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const masters = useMasters();
  const submit = useSubmitListing(listing._id);
  const builder = user.listerType === 'builder';
  const revision = REVISABLE.includes(listing.status);
  const missing = revision ? [] : missingSteps(listing, { builder });
  const kycOk = user.kyc && user.kyc.status === 'verified';
  const photos = (listing.media && listing.media.photos) || [];
  const cover = photos.find((p) => p.isCover) || photos[0];
  const d = listing.details || {};
  const price = priceOf(listing);
  const amenityNames = Object.fromEntries(((masters.data && masters.data.amenities) || []).map((a) => [a.code, a.name]));
  const typeName = (((masters.data && masters.data.propertyTypes) || []).find((pt) => pt.code === listing.type) || {}).name || titleCase(listing.type);

  const onSubmit = async () => {
    try {
      const r = await submit.mutateAsync();
      toast.success(r.revision ? t('lister.wizard.review.changesSent') : t('lister.wizard.review.submitted'));
      navigate(`/lister/listings/${listing._id}`); // RE-S-LIS-08
    } catch (e) {
      toast.error(e.message);
    }
  };

  const canSubmit = revision ? Boolean(listing.pendingRevision && listing.pendingRevision.changes && !listing.pendingRevision.submittedAt) : ['draft', 'changes_requested'].includes(listing.status) && !missing.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader title={revision ? t('lister.wizard.review.pending') : t('lister.wizard.review.checklist')} description={revision ? t('lister.wizard.review.pendingDesc') : t('lister.wizard.review.completeness', { pct: listing.wizard?.completeness || 0 })} />
          {revision ? (
            <p className="text-sm text-ink-muted">{listing.pendingRevision && listing.pendingRevision.changes ? t('lister.wizard.review.changed', { list: Object.keys(listing.pendingRevision.changes).map((k) => (/^\d$/.test(k) ? t('lister.wizard.review.stepN', { n: k }) : k)).join(', ') }) : t('lister.wizard.review.noChanges')}</p>
          ) : missing.length ? (
            <ul className="space-y-2">
              {missing.map((m) => (
                <li key={m.text} className="flex items-center justify-between gap-3 rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-700">
                  <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{m.text}</span>
                  <button type="button" className="font-semibold underline-offset-4 hover:underline" onClick={() => goto(m.step)}>{t('lister.wizard.review.fix')}</button>
                </li>
              ))}
            </ul>
          ) : <p className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" /> {t('lister.wizard.review.allSet')}</p>}
          {(listing.warnings || []).length > 0 && (
            <Alert tone="info" className="mt-4" title={t('lister.wizard.review.notes')}>
              <ul className="list-disc pl-4">{listing.warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || w}</li>)}</ul>
            </Alert>
          )}
          {!kycOk && <Alert tone="warning" className="mt-4">{t('lister.wizard.review.kyc')}</Alert>}
          {listing.status === 'changes_requested' && (listing.reviewComments || []).length > 0 && (
            <Alert tone="warning" className="mt-4" title={t('lister.wizard.review.requested')}>
              <ul className="list-disc pl-4">{listing.reviewComments.map((c, i) => <li key={i}><strong>{titleCase(c.field)}:</strong> {c.comment}</li>)}</ul>
            </Alert>
          )}
        </Card>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={back}>{t('common.back')}</Button>
          <Button size="lg" icon={Send} disabled={!canSubmit} loading={submit.isPending} onClick={onSubmit}>{revision ? t('lister.wizard.review.sendChanges') : listing.status === 'changes_requested' ? t('lister.wizard.review.resubmit') : t('lister.wizard.review.submit')}</Button>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="border-b bg-surface-muted px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t('lister.wizard.review.preview')}</div>
        <div className="aspect-[16/9] bg-surface-sunken">
          {cover ? <img src={cover.url} alt={cover.caption || listing.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-ink-subtle">{t('lister.wizard.review.coverPhoto')}</div>}
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{listing.purpose === 'rent' ? t('lister.listings.forRent') : t('lister.listings.forSale')}</Badge>
            <Badge tone="success" icon={BadgeCheck}>{t('lister.wizard.review.verified', { type: user.listerType ? t(`lister.common.listerType.${user.listerType}`) : titleCase(user.listerType) })}{builder && user.brand?.name ? ` · ${user.brand.name}` : ''}</Badge>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-ink">{listing.title || t('lister.wizard.review.yourTitle')}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-subtle"><MapPin className="h-4 w-4" />{[listing.location?.locality, listing.location?.city].filter(Boolean).join(', ') || t('lister.wizard.review.localityCity')} · {t('lister.wizard.review.approx')}</p>
          </div>
          <p className="text-2xl font-bold text-ink">{price ? shortRupees(price) : '₹ —'}{listing.purpose === 'rent' && price ? <span className="text-base font-normal text-ink-subtle"> {t('lister.wizard.review.perMonth')}</span> : ''}</p>
          <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
            <span>{typeName}</span>
            {d.bhk != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-4 w-4" />{d.bhk === 0 ? t('lister.wizard.review.studio') : `${d.bhk} BHK`}</span>}
            {d.baths != null && <span className="inline-flex items-center gap-1"><Bath className="h-4 w-4" />{t('lister.wizard.review.baths', { n: d.baths })}</span>}
            {d.areaSqft && <span className="inline-flex items-center gap-1"><Ruler className="h-4 w-4" />{t('lister.wizard.review.sqft', { n: number(d.areaSqft) })}</span>}
          </div>
          {listing.description && <p className="line-clamp-4 text-sm leading-relaxed text-ink-muted">{listing.description}</p>}
          {(listing.amenities || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">{listing.amenities.slice(0, 10).map((a) => <Badge key={a}>{amenityNames[a] || titleCase(a)}</Badge>)}</div>
          )}
          <p className="rounded-md bg-surface-muted p-3 text-xs text-ink-subtle">{t('lister.wizard.review.privacy')}</p>
        </div>
      </Card>
    </div>
  );
}
