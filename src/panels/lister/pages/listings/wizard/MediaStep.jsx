// Step 6: photos (3-20, min 1024 x 768, location data removed, cover + order +
// captions), floor plans, brochure, YouTube video, private ownership proof
// (owners and landlords) and RERA details (builders). RE-A-05/06/07, RE-F-03, RE-G-08.
import { useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, Lock, Star, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Badge, Button, Card, CardHeader, Input, Select, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import { useAuth } from '@/modules/auth';
import { useAddMedia, useEditMedia, useOrderMedia, useRemoveMedia } from '@/modules/listings/api';
import { StepFooter, StepMessages, useStepSave } from './common';

const PROOF_TYPES = [
  ['sale_deed', 'Sale deed'], ['property_tax_receipt', 'Property tax receipt'], ['utility_bill', 'Electricity / utility bill'],
  ['allotment_letter', 'Allotment letter'], ['sanctioned_plan', 'Sanctioned plan'], ['other', 'Other ownership document'],
];
const MOD_TONE = { approved: 'success', rejected: 'danger', pending: 'neutral' };

function Photos({ listing }) {
  const toast = useToast();
  const add = useAddMedia(listing._id);
  const edit = useEditMedia(listing._id);
  const order = useOrderMedia(listing._id);
  const remove = useRemoveMedia(listing._id);
  const photos = (listing.media && listing.media.photos) || [];
  const ids = photos.map((p) => p._id);
  const coverId = (photos.find((p) => p.isCover) || photos[0] || {})._id;

  const reorder = async (from, to) => {
    const next = ids.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    try { await order.mutateAsync({ photoIds: next, coverId }); } catch (e) { toast.error(e.message); }
  };
  const setCover = async (id) => { try { await order.mutateAsync({ photoIds: ids, coverId: id }); } catch (e) { toast.error(e.message); } };

  return (
    <Card>
      <CardHeader title="Photos" description="3 to 20 photos, at least 1024 x 768. Camera location data is removed automatically." action={<Badge tone={photos.length >= 3 ? 'success' : 'warning'}>{photos.length} / 20</Badge>} />
      {photos.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p._id} className={cn('overflow-hidden rounded-lg border bg-white', p._id === coverId && 'ring-2 ring-accent-500')}>
              <div className="relative aspect-[4/3] bg-surface-sunken">
                <img src={p.thumbUrl || p.url} alt={p.caption || `Photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {p._id === coverId && <span className="absolute left-2 top-2"><Badge tone="accent" icon={Star}>Cover</Badge></span>}
                {p.moderation && p.moderation.status !== 'pending' && <span className="absolute right-2 top-2"><Badge tone={MOD_TONE[p.moderation.status]}>{p.moderation.status}</Badge></span>}
              </div>
              <div className="space-y-2 p-2">
                <input className="h-8 w-full rounded border border-line px-2 text-xs" placeholder="Caption (e.g. Living room)" defaultValue={p.caption || ''} maxLength={100}
                  onBlur={(e) => { if (e.target.value !== (p.caption || '')) edit.mutate({ mediaId: p._id, body: { caption: e.target.value } }); }} aria-label={`Caption for photo ${i + 1}`} />
                <div className="flex items-center justify-between">
                  <div className="flex">
                    <Button variant="ghost" size="sm" icon={ArrowLeft} disabled={i === 0 || order.isPending} onClick={() => reorder(i, i - 1)} aria-label="Move left" />
                    <Button variant="ghost" size="sm" icon={ArrowRight} disabled={i === photos.length - 1 || order.isPending} onClick={() => reorder(i, i + 1)} aria-label="Move right" />
                  </div>
                  <div className="flex">
                    {p._id !== coverId && <Button variant="ghost" size="sm" icon={Star} onClick={() => setCover(p._id)} aria-label="Make cover" />}
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove.mutate(p._id)} aria-label="Remove photo" />
                  </div>
                </div>
                {p.moderation && p.moderation.reason && <p className="text-[11px] text-danger-700">{p.moderation.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FileDrop multiple purpose="property_photo" kind="image" disabled={photos.length >= 20} label="Drop photos here or click to choose"
        onUploaded={async (f) => { await add.mutateAsync({ kind: 'photo', fileId: f.id }); }} />
    </Card>
  );
}

function Documents({ listing, builder }) {
  const add = useAddMedia(listing._id);
  const remove = useRemoveMedia(listing._id);
  const toast = useToast();
  const [proofType, setProofType] = useState('sale_deed');
  const m = listing.media || {};
  const proofs = m.ownershipProofs || [];
  const plans = m.floorPlans || [];
  const addMedia = async (body, msg) => { try { await add.mutateAsync(body); toast.success(msg); } catch (e) { toast.error(e.message); } };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {!builder && (
        <Card>
          <CardHeader title="Ownership proof" description="Required. Private: only our verification team sees it." action={<Badge icon={Lock}>Private</Badge>} />
          <ul className="mb-3 space-y-2">
            {proofs.map((pr) => (
              <li key={pr.fileId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-ink-subtle" />{(PROOF_TYPES.find(([c]) => c === pr.docType) || [0, pr.docType])[1]}</span>
                <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove proof" onClick={() => remove.mutate(String(pr.fileId))} />
              </li>
            ))}
          </ul>
          <Select label="Document type" value={proofType} onChange={(e) => setProofType(e.target.value)} options={PROOF_TYPES.map(([value, label]) => ({ value, label }))} className="mb-3" />
          <FileDrop compact purpose="ownership_proof" kind="document" label="Upload ownership proof" onUploaded={(f) => addMedia({ kind: 'ownership_proof', fileId: f.id, docType: proofType }, 'Ownership proof added')} />
        </Card>
      )}
      <Card>
        <CardHeader title="Floor plans and brochure" description="Optional. Up to 10 floor plans (PDF or image)." />
        <ul className="mb-3 space-y-2">
          {plans.map((pl) => (
            <li key={pl.fileId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <a href={pl.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-700 hover:underline"><FileText className="h-4 w-4" />{pl.label || 'Floor plan'}</a>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove floor plan" onClick={() => remove.mutate(String(pl.fileId))} />
            </li>
          ))}
          {m.brochure && m.brochure.url && (
            <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <a href={m.brochure.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-700 hover:underline"><FileText className="h-4 w-4" />Brochure</a>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove brochure" onClick={() => remove.mutate(String(m.brochure.fileId))} />
            </li>
          )}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <FileDrop compact purpose="floor_plan" kind="document" label="Add floor plan" disabled={plans.length >= 10} onUploaded={(f) => addMedia({ kind: 'floor_plan', fileId: f.id }, 'Floor plan added')} />
          <FileDrop compact purpose="brochure" kind="document" label={m.brochure ? 'Replace brochure' : 'Add brochure'} onUploaded={(f) => addMedia({ kind: 'brochure', fileId: f.id }, 'Brochure added')} />
        </div>
      </Card>
    </div>
  );
}

function VideoAndRera({ listing, builder, next, back }) {
  const r = listing.rera || {};
  const [video, setVideo] = useState((listing.media && listing.media.video && listing.media.video.kind === 'youtube' && listing.media.video.url) || '');
  const [rera, setRera] = useState({ numbers: (r.numbers || []).join(', '), state: r.state || 'Maharashtra', url: r.url || '', certificateFileId: r.certificateFileId || '' });
  const s = useStepSave(listing, 6, { onSaved: next });
  const save = () => s.run({
    video: video.trim() ? { kind: 'youtube', url: video.trim() } : null,
    ...(builder && rera.numbers.trim() ? { rera: { numbers: rera.numbers.split(',').map((x) => x.trim()).filter(Boolean), state: rera.state, ...(rera.url ? { url: rera.url } : {}), ...(rera.certificateFileId ? { certificateFileId: rera.certificateFileId } : {}) } } : {}),
  });
  return (
    <Card>
      <CardHeader title={builder ? 'Video and RERA' : 'Video'} description="A YouTube walkthrough helps buyers shortlist faster." />
      <StepMessages formError={s.formError} warnings={s.warnings} />
      <Input label="YouTube link (optional)" placeholder="https://youtu.be/…" value={video} onChange={(e) => setVideo(e.target.value)} error={s.errors.video} />
      {builder && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="RERA registration number(s)" required hint="Separate several numbers with commas" value={rera.numbers} onChange={(e) => setRera((x) => ({ ...x, numbers: e.target.value }))} error={s.errors.rera} />
          <Input label="State" value={rera.state} onChange={(e) => setRera((x) => ({ ...x, state: e.target.value }))} />
          <Input label="Official RERA link" className="sm:col-span-2" placeholder="https://maharera.maharashtra.gov.in/…" value={rera.url} onChange={(e) => setRera((x) => ({ ...x, url: e.target.value }))} />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-ink">RERA certificate {rera.certificateFileId && <Badge tone="success" className="ml-2">Uploaded</Badge>}</p>
            <FileDrop compact purpose="rera_certificate" kind="document" label={rera.certificateFileId ? 'Replace certificate' : 'Upload certificate'} onUploaded={(f) => setRera((x) => ({ ...x, certificateFileId: f.id }))} />
          </div>
        </div>
      )}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </Card>
  );
}

export default function MediaStep({ listing, next, back }) {
  const { user } = useAuth();
  const builder = user.listerType === 'builder';
  return (
    <div className="space-y-6">
      {(listing.media?.photos || []).some((p) => p.moderation && p.moderation.status === 'rejected') && <Alert tone="warning">Some photos were rejected by our team. Replace them before resubmitting.</Alert>}
      <Photos listing={listing} />
      <Documents listing={listing} builder={builder} />
      <VideoAndRera listing={listing} builder={builder} next={next} back={back} />
    </div>
  );
}
