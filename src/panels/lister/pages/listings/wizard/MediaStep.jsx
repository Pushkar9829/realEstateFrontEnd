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
import { useT } from '@/shared/i18n';

// Labels: lister.wizard.media.proofTypes.<code>.
const PROOF_TYPES = ['sale_deed', 'property_tax_receipt', 'utility_bill', 'allotment_letter', 'sanctioned_plan', 'other'];
const MOD_TONE = { approved: 'success', rejected: 'danger', pending: 'neutral' };

function Photos({ listing }) {
  const t = useT();
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
      <CardHeader title={t('lister.projects.tabs.media')} description={t('lister.wizard.media.photosDesc')} action={<Badge tone={photos.length >= 3 ? 'success' : 'warning'}>{photos.length} / 20</Badge>} />
      {photos.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p._id} className={cn('overflow-hidden rounded-lg border bg-white', p._id === coverId && 'ring-2 ring-accent-500')}>
              <div className="relative aspect-[4/3] bg-surface-sunken">
                <img src={p.thumbUrl || p.url} alt={p.caption || t('lister.wizard.media.photoN', { n: i + 1 })} className="h-full w-full object-cover" loading="lazy" />
                {p._id === coverId && <span className="absolute left-2 top-2"><Badge tone="accent" icon={Star}>{t('lister.wizard.media.cover')}</Badge></span>}
                {p.moderation && p.moderation.status !== 'pending' && <span className="absolute right-2 top-2"><Badge tone={MOD_TONE[p.moderation.status]}>{MOD_TONE[p.moderation.status] ? t(`lister.wizard.media.mod.${p.moderation.status}`) : p.moderation.status}</Badge></span>}
              </div>
              <div className="space-y-2 p-2">
                <input className="h-8 w-full rounded border border-line px-2 text-xs" placeholder={t('lister.wizard.media.captionPh')} defaultValue={p.caption || ''} maxLength={100}
                  onBlur={(e) => { if (e.target.value !== (p.caption || '')) edit.mutate({ mediaId: p._id, body: { caption: e.target.value } }); }} aria-label={t('lister.wizard.media.captionFor', { n: i + 1 })} />
                <div className="flex items-center justify-between">
                  <div className="flex">
                    <Button variant="ghost" size="sm" icon={ArrowLeft} disabled={i === 0 || order.isPending} onClick={() => reorder(i, i - 1)} aria-label={t('lister.wizard.media.left')} />
                    <Button variant="ghost" size="sm" icon={ArrowRight} disabled={i === photos.length - 1 || order.isPending} onClick={() => reorder(i, i + 1)} aria-label={t('lister.wizard.media.right')} />
                  </div>
                  <div className="flex">
                    {p._id !== coverId && <Button variant="ghost" size="sm" icon={Star} onClick={() => setCover(p._id)} aria-label={t('lister.wizard.media.makeCover')} />}
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove.mutate(p._id)} aria-label={t('lister.wizard.media.removePhoto')} />
                  </div>
                </div>
                {p.moderation && p.moderation.reason && <p className="text-[11px] text-danger-700">{p.moderation.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FileDrop multiple purpose="property_photo" kind="image" disabled={photos.length >= 20} label={t('lister.wizard.media.drop')}
        onUploaded={async (f) => { await add.mutateAsync({ kind: 'photo', fileId: f.id }); }} />
    </Card>
  );
}

function Documents({ listing, builder }) {
  const t = useT();
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
          <CardHeader title={t('lister.wizard.media.proof')} description={t('lister.wizard.media.proofDesc')} action={<Badge icon={Lock}>{t('lister.wizard.media.private')}</Badge>} />
          <ul className="mb-3 space-y-2">
            {proofs.map((pr) => (
              <li key={pr.fileId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-ink-subtle" />{PROOF_TYPES.includes(pr.docType) ? t(`lister.wizard.media.proofTypes.${pr.docType}`) : pr.docType}</span>
                <Button variant="ghost" size="sm" icon={Trash2} aria-label={t('lister.wizard.media.removeProof')} onClick={() => remove.mutate(String(pr.fileId))} />
              </li>
            ))}
          </ul>
          <Select label={t('lister.wizard.media.docType')} value={proofType} onChange={(e) => setProofType(e.target.value)} options={PROOF_TYPES.map((value) => ({ value, label: t(`lister.wizard.media.proofTypes.${value}`) }))} className="mb-3" />
          <FileDrop compact purpose="ownership_proof" kind="document" label={t('lister.wizard.media.uploadProof')} onUploaded={(f) => addMedia({ kind: 'ownership_proof', fileId: f.id, docType: proofType }, t('lister.wizard.media.proofAdded'))} />
        </Card>
      )}
      <Card>
        <CardHeader title={t('lister.wizard.media.plans')} description={t('lister.wizard.media.plansDesc')} />
        <ul className="mb-3 space-y-2">
          {plans.map((pl) => (
            <li key={pl.fileId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <a href={pl.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-700 hover:underline"><FileText className="h-4 w-4" />{pl.label || t('lister.wizard.media.floorPlan')}</a>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label={t('lister.wizard.media.removePlan')} onClick={() => remove.mutate(String(pl.fileId))} />
            </li>
          ))}
          {m.brochure && m.brochure.url && (
            <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <a href={m.brochure.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brand-700 hover:underline"><FileText className="h-4 w-4" />{t('lister.wizard.media.brochure')}</a>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label={t('lister.wizard.media.removeBrochure')} onClick={() => remove.mutate(String(m.brochure.fileId))} />
            </li>
          )}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <FileDrop compact purpose="floor_plan" kind="document" label={t('lister.wizard.media.addPlan')} disabled={plans.length >= 10} onUploaded={(f) => addMedia({ kind: 'floor_plan', fileId: f.id }, t('lister.wizard.media.planAdded'))} />
          <FileDrop compact purpose="brochure" kind="document" label={m.brochure ? t('lister.wizard.media.replaceBrochure') : t('lister.wizard.media.addBrochure')} onUploaded={(f) => addMedia({ kind: 'brochure', fileId: f.id }, t('lister.wizard.media.brochureAdded'))} />
        </div>
      </Card>
    </div>
  );
}

function VideoAndRera({ listing, builder, next, back }) {
  const t = useT();
  const r = listing.rera || {};
  const [video, setVideo] = useState((listing.media && listing.media.video && listing.media.video.kind === 'youtube' && listing.media.video.url) || '');
  const [rera, setRera] = useState({ numbers: (r.numbers || []).join(', '), state: r.state || 'Maharashtra', url: r.url || '', certificateFileId: r.certificateFileId || '' });
  const linked = Boolean(listing.projectId); // RE-G-07: RERA is inherited from the project
  const body = () => ({
    video: video.trim() ? { kind: 'youtube', url: video.trim() } : null,
    ...(builder && !linked && rera.numbers.trim() ? { rera: { numbers: rera.numbers.split(',').map((x) => x.trim()).filter(Boolean), state: rera.state, ...(rera.url ? { url: rera.url } : {}), ...(rera.certificateFileId ? { certificateFileId: rera.certificateFileId } : {}) } } : {}),
  });
  const s = useStepSave(listing, 6, { onSaved: next, value: { video, rera }, build: body });
  const save = () => s.run(body());
  return (
    <Card>
      <CardHeader title={builder ? t('lister.wizard.media.videoRera') : t('lister.wizard.media.video')} description={t('lister.wizard.media.videoDesc')} />
      <StepMessages formError={s.formError} warnings={s.warnings} />
      <Input label={t('lister.wizard.media.youtube')} placeholder="https://youtu.be/…" value={video} onChange={(e) => setVideo(e.target.value)} error={s.errors.video} />
      {builder && linked && (
        <Alert tone="info" className="mt-5">RERA {(r.numbers || []).join(', ') || (r.exempt && r.exempt.reason ? t('lister.wizard.media.exempt') : '-')}{r.state ? ` (${r.state})` : ''} {t('lister.wizard.media.reraFromProject', { name: listing.project ? listing.project.name : '' })}</Alert>
      )}
      {builder && !linked && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label={t('lister.wizard.media.reraNumbers')} required hint={t('lister.wizard.media.reraHint')} value={rera.numbers} onChange={(e) => setRera((x) => ({ ...x, numbers: e.target.value }))} error={s.errors.rera} />
          <Input label={t('lister.kyc.details.state')} value={rera.state} onChange={(e) => setRera((x) => ({ ...x, state: e.target.value }))} />
          <Input label={t('lister.wizard.media.reraLink')} className="sm:col-span-2" placeholder="https://maharera.maharashtra.gov.in/…" value={rera.url} onChange={(e) => setRera((x) => ({ ...x, url: e.target.value }))} />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-ink">{t('lister.wizard.media.reraCert')} {rera.certificateFileId && <Badge tone="success" className="ml-2">{t('lister.kyc.docs2.uploaded')}</Badge>}</p>
            <FileDrop compact purpose="rera_certificate" kind="document" label={rera.certificateFileId ? t('lister.wizard.media.replaceCert') : t('lister.wizard.media.uploadCert')} onUploaded={(f) => setRera((x) => ({ ...x, certificateFileId: f.id }))} />
          </div>
        </div>
      )}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </Card>
  );
}

export default function MediaStep({ listing, next, back }) {
  const t = useT();
  const { user } = useAuth();
  const builder = user.listerType === 'builder';
  return (
    <div className="space-y-6">
      {(listing.media?.photos || []).some((p) => p.moderation && p.moderation.status === 'rejected') && <Alert tone="warning">{t('lister.wizard.media.rejected')}</Alert>}
      <Photos listing={listing} />
      <Documents listing={listing} builder={builder} />
      <VideoAndRera listing={listing} builder={builder} next={next} back={back} />
    </div>
  );
}
