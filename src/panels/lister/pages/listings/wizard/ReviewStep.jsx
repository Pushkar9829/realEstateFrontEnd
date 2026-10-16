// Step 8: completeness checklist, a masked public preview (what buyers will
// see: no name, unit number or address) and submit for approval.
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Bath, BedDouble, CheckCircle2, MapPin, Ruler, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, useToast } from '@/shared/ui';
import { shortRupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { missingSteps, priceOf, REVISABLE, useMasters, useSubmitListing, WARNING_LABELS } from '@/modules/listings/api';

export default function ReviewStep({ listing, goto, back }) {
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
  const typeName = (((masters.data && masters.data.propertyTypes) || []).find((t) => t.code === listing.type) || {}).name || titleCase(listing.type);

  const onSubmit = async () => {
    try {
      const r = await submit.mutateAsync();
      toast.success(r.revision ? 'Changes sent for review' : 'Submitted for approval. Our team reviews listings within 24 hours.');
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
          <CardHeader title={revision ? 'Pending changes' : 'Checklist'} description={revision ? 'Your edits are reviewed before they replace the live listing.' : `Completeness ${listing.wizard?.completeness || 0}%`} />
          {revision ? (
            <p className="text-sm text-ink-muted">{listing.pendingRevision && listing.pendingRevision.changes ? `Changed: ${Object.keys(listing.pendingRevision.changes).map((k) => (/^\d$/.test(k) ? `step ${k}` : k)).join(', ')}` : 'No changes yet. Edit any step and save.'}</p>
          ) : missing.length ? (
            <ul className="space-y-2">
              {missing.map((m) => (
                <li key={m.text} className="flex items-center justify-between gap-3 rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-700">
                  <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{m.text}</span>
                  <button type="button" className="font-semibold underline-offset-4 hover:underline" onClick={() => goto(m.step)}>Fix</button>
                </li>
              ))}
            </ul>
          ) : <p className="flex items-center gap-2 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" /> Everything required is in place.</p>}
          {(listing.warnings || []).length > 0 && (
            <Alert tone="info" className="mt-4" title="Notes for our reviewer">
              <ul className="list-disc pl-4">{listing.warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || w}</li>)}</ul>
            </Alert>
          )}
          {!kycOk && <Alert tone="warning" className="mt-4">You can submit now, but the listing goes live only after your verification (KYC) is approved.</Alert>}
          {listing.status === 'changes_requested' && (listing.reviewComments || []).length > 0 && (
            <Alert tone="warning" className="mt-4" title="Requested changes">
              <ul className="list-disc pl-4">{listing.reviewComments.map((c, i) => <li key={i}><strong>{titleCase(c.field)}:</strong> {c.comment}</li>)}</ul>
            </Alert>
          )}
        </Card>
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={back}>Back</Button>
          <Button size="lg" icon={Send} disabled={!canSubmit} loading={submit.isPending} onClick={onSubmit}>{revision ? 'Send changes for review' : listing.status === 'changes_requested' ? 'Resubmit for approval' : 'Submit for approval'}</Button>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="border-b bg-surface-muted px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Public preview · what buyers see</div>
        <div className="aspect-[16/9] bg-surface-sunken">
          {cover ? <img src={cover.url} alt={cover.caption || listing.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-ink-subtle">Cover photo</div>}
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{listing.purpose === 'rent' ? 'For rent' : 'For sale'}</Badge>
            <Badge tone="success" icon={BadgeCheck}>Verified {titleCase(user.listerType)}{builder && user.brand?.name ? ` · ${user.brand.name}` : ''}</Badge>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-ink">{listing.title || 'Your title'}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-subtle"><MapPin className="h-4 w-4" />{[listing.location?.locality, listing.location?.city].filter(Boolean).join(', ') || 'Locality, City'} · approximate location</p>
          </div>
          <p className="text-2xl font-bold text-ink">{price ? shortRupees(price) : '₹ —'}{listing.purpose === 'rent' && price ? <span className="text-base font-normal text-ink-subtle"> /month</span> : ''}</p>
          <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
            <span>{typeName}</span>
            {d.bhk != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-4 w-4" />{d.bhk === 0 ? 'Studio' : `${d.bhk} BHK`}</span>}
            {d.baths != null && <span className="inline-flex items-center gap-1"><Bath className="h-4 w-4" />{d.baths} bath</span>}
            {d.areaSqft && <span className="inline-flex items-center gap-1"><Ruler className="h-4 w-4" />{d.areaSqft.toLocaleString('en-IN')} sq ft</span>}
          </div>
          {listing.description && <p className="line-clamp-4 text-sm leading-relaxed text-ink-muted">{listing.description}</p>}
          {(listing.amenities || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">{listing.amenities.slice(0, 10).map((a) => <Badge key={a}>{amenityNames[a] || titleCase(a)}</Badge>)}</div>
          )}
          <p className="rounded-md bg-surface-muted p-3 text-xs text-ink-subtle">Your name, phone number, flat number and full address are never shown. Buyers contact our sales team, who arrange visits.</p>
        </div>
      </Card>
    </div>
  );
}
