// RE-D-02/03/04 listing review: public content beside private data (address,
// unit, lister, KYC, agreement, ownership proof via signed link), per-photo
// moderation, auto-check warnings, the approval checklist and the decision.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ExternalLink, FileText, Lock, LockOpen, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useAuth } from '@/modules/auth';
import { listingStatus, WARNING_LABELS, useMasters } from '@/modules/listings/api';
import { CHECKLIST_LABELS, listingFileUrl, useClaimListing, useDecideListing, useModeratePhoto, useReleaseListing, useReviewListing } from '@/modules/approvals/api';

const FIELDS = ['title', 'description', 'location', 'details', 'price', 'amenities', 'photos', 'ownership_proof', 'commission', 'rera'];

function Row({ label, children, privateField }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="flex w-40 shrink-0 items-center gap-1 text-sm text-ink-subtle">{label}{privateField && <Lock className="h-3 w-3" aria-label={t('admin.approvals.review.private')} />}</dt>
      <dd className="min-w-0 text-sm text-ink">{children || '-'}</dd>
    </div>
  );
}

function Photo({ p, editable, onDecide }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const st = (p.moderation && p.moderation.status) || 'pending';
  return (
    <li className={cn('overflow-hidden rounded-lg border bg-white', st === 'approved' && 'border-success-600', st === 'rejected' && 'border-danger-600')}>
      <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-surface-sunken"><img src={p.thumbUrl || p.url} alt={p.caption || ''} className="h-full w-full object-cover" loading="lazy" /></a>
      <div className="space-y-2 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-muted">{p.caption || t('admin.approvals.review.noCaption')}{p.isCover ? ` · ${t('admin.approvals.review.cover')}` : ''}</span>
          <Badge tone={st === 'approved' ? 'success' : st === 'rejected' ? 'danger' : 'neutral'}>{['approved', 'rejected', 'pending'].includes(st) ? t(`admin.approvals.review.photoStatus.${st}`) : st}</Badge>
        </div>
        {editable && (
          <>
            <input className="h-8 w-full rounded border border-line px-2 text-xs" placeholder={t('admin.approvals.review.photoReason')} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t('admin.approvals.review.rejectReason')} />
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant={st === 'approved' ? 'primary' : 'secondary'} icon={Check} onClick={() => onDecide(p._id, { status: 'approved' })}>{t('admin.approvals.review.approve')}</Button>
              <Button size="sm" variant={st === 'rejected' ? 'danger' : 'secondary'} icon={X} disabled={!reason.trim()} onClick={() => onDecide(p._id, { status: 'rejected', reason: reason.trim() })}>{t('admin.approvals.review.reject')}</Button>
            </div>
          </>
        )}
        {!editable && p.moderation?.reason && <p className="text-[11px] text-danger-700">{p.moderation.reason}</p>}
      </div>
    </li>
  );
}

export default function ListingReviewPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me } = useAuth();
  const { data: l, isLoading, error } = useReviewListing(id);
  const masters = useMasters();
  const claim = useClaimListing(id);
  const release = useReleaseListing(id);
  const decide = useDecideListing(id);
  const moderate = useModeratePhoto(id);
  const [checks, setChecks] = useState({});
  const [proofOwnerName, setProofOwnerName] = useState('');
  const [comments, setComments] = useState([]);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const s = listingStatus(l.status);
  const lister = l.listerId || {};
  const builder = lister.listerType === 'builder';
  const items = [...(l.checklist || []), ...(l.builderChecklist || [])];
  const claimActive = l.review?.claimedBy && new Date(l.review.claimUntil) > new Date();
  const mine = claimActive && String(l.review.claimedBy) === String(me._id);
  const revision = ['live', 'paused'].includes(l.status) && l.pendingRevision?.submittedAt;
  const reviewable = l.status === 'pending_approval' || revision;
  const photos = l.media?.photos || [];
  const approvedPhotos = photos.filter((p) => p.moderation?.status === 'approved').length;
  const price = l.purpose === 'rent' ? l.price?.monthlyRent : l.price?.amount;
  const typeName = ((masters.data?.propertyTypes || []).find((t) => t.code === l.type) || {}).name || titleCase(l.type);
  const amenityNames = Object.fromEntries((masters.data?.amenities || []).map((a) => [a.code, a.name]));

  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); } catch (e) { toast.error(e.message); } };
  const openFile = async (fileId) => { try { const r = await listingFileUrl(id, fileId); window.open(r.url, '_blank', 'noopener'); } catch (e) { toast.error(e.message); } };
  const allTicked = items.every((k) => checks[k]);

  const submit = async (decision) => {
    setFormError(null);
    const body = { decision };
    if (decision === 'approve') { body.checklist = Object.fromEntries(items.map((k) => [k, Boolean(checks[k])])); if (proofOwnerName.trim()) body.proofOwnerName = proofOwnerName.trim(); }
    if (decision === 'changes') body.comments = comments.filter((c) => c.comment.trim().length >= 2);
    if (decision === 'reject') body.reason = reason.trim();
    try {
      await decide.mutateAsync(body);
      toast.success({ approve: revision ? t('admin.approvals.review.toastRevision') : t('admin.approvals.review.toastApproved'), changes: t('admin.approvals.review.toastChanges'), reject: t('admin.approvals.review.toastRejected') }[decision]);
      navigate('/admin/approvals');
    } catch (e) {
      setFormError(Array.isArray(e.details) && e.code === 'APPROVAL_BLOCKED' ? e.details.join(' · ') : e.message);
    }
  };

  return (
    <>
      <Link to="/admin/approvals" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.approvals.title')}</Link>
      <PageHeader title={l.title} breadcrumb={`${l.listingNo} · ${titleCase(l.purpose)} · ${typeName}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>{revision && <Badge tone="info">{t('admin.approvals.revision')}</Badge>}
          {reviewable && !claimActive && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), t('admin.approvals.review.claimedToast'))}>{t('admin.approvals.review.claim')}</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), t('admin.approvals.review.releasedToast'))}>{t('admin.approvals.review.release')}</Button>}
        </>} />
      {claimActive && !mine && <Alert tone="warning" className="mb-4">{t('admin.approvals.review.claimedByOther', { date: dateTime(l.review.claimUntil) })}</Alert>}
      {(l.warnings || []).length > 0 && (
        <Alert tone="warning" className="mb-4" title={t('admin.approvals.review.warningsTitle')}>
          <ul className="list-disc pl-4">{l.warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || w}</li>)}</ul>
        </Alert>
      )}
      {revision && (
        <Alert tone="info" className="mb-4" title={t('admin.approvals.review.changesTitle')}>
          {t('admin.approvals.review.changed', { list: Object.keys(l.pendingRevision.changes || {}).map((c) => (/^[1-6]$/.test(c) ? t(`admin.approvals.review.steps.s${c}`) : /^\d$/.test(c) ? undefined : c)).join(', ') })}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('admin.approvals.review.photos', { approved: approvedPhotos, total: photos.length })} description={t('admin.approvals.review.photosDesc')} />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => <Photo key={p._id} p={p} editable={mine} onDecide={(mediaId, body) => act(() => moderate.mutateAsync({ mediaId, body }))} />)}
            </ul>
            {mine && photos.some((p) => p.moderation?.status !== 'approved') && (
              <Button className="mt-3" variant="secondary" size="sm" icon={CheckCircle2}
                onClick={() => act(async () => { for (const p of photos.filter((x) => x.moderation?.status !== 'approved')) await moderate.mutateAsync({ mediaId: p._id, body: { status: 'approved' } }); }, t('admin.approvals.review.allPhotosToast'))}>{t('admin.approvals.review.approveAllPhotos')}</Button>
            )}
          </Card>

          <Card>
            <CardHeader title={t('admin.approvals.review.detailsTitle')} description={t('admin.approvals.review.detailsDesc')} />
            <dl className="divide-y">
              <Row label={t('admin.approvals.review.price')}>{price ? `${rupees(price)}${l.purpose === 'rent' ? ` / ${t('admin.approvals.review.month')}` : ''}${l.price?.negotiable ? ` · ${t('admin.approvals.review.negotiable')}` : ''}` : null}</Row>
              {l.purpose === 'rent' && <Row label={t('admin.approvals.review.deposit')}>{l.price?.deposit != null ? rupees(l.price.deposit) : null}</Row>}
              <Row label={t('admin.approvals.review.configuration')}>{[l.details?.bhk != null && `${l.details.bhk} BHK`, l.details?.baths != null && t('admin.approvals.review.bath', { n: l.details.baths }), l.details?.areaSqft && t('admin.approvals.review.sqft', { n: l.details.areaSqft }), l.details?.furnishing && titleCase(l.details.furnishing)].filter(Boolean).join(' · ')}</Row>
              <Row label={t('admin.approvals.review.floor')}>{l.details?.floor != null ? t('admin.approvals.review.floorOf', { floor: l.details.floor, total: l.details.totalFloors ?? '?' }) : null}</Row>
              <Row label={t('admin.approvals.review.locality')}>{[l.location?.locality, l.location?.city, l.location?.pincode].filter(Boolean).join(', ')}</Row>
              <Row label={t('admin.approvals.review.address')} privateField>{[l.location?.societyName, l.location?.addressLine].filter(Boolean).join(', ')}</Row>
              <Row label={t('admin.approvals.review.unit')} privateField>{l.location?.unitNo}</Row>
              <Row label={t('admin.approvals.review.pin')} privateField>{l.location?.geo?.coordinates ? <a className="text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${l.location.geo.coordinates[1]}&mlon=${l.location.geo.coordinates[0]}#map=17/${l.location.geo.coordinates[1]}/${l.location.geo.coordinates[0]}`}>{l.location.geo.coordinates[1]}, {l.location.geo.coordinates[0]} <ExternalLink className="inline h-3 w-3" /></a> : null}</Row>
              <Row label={t('admin.approvals.review.amenities')}>{(l.amenities || []).map((a) => amenityNames[a] || titleCase(a)).join(', ')}</Row>
              <Row label={t('admin.approvals.review.description')}><span className="whitespace-pre-line">{l.description}</span></Row>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('admin.approvals.review.listerTitle')} />
            <dl className="divide-y">
              <Row label={t('admin.approvals.review.lister')}>{lister.name} <span className="text-xs text-ink-subtle">({titleCase(lister.listerType)})</span></Row>
              <Row label="KYC"><Badge tone={lister.kyc?.status === 'verified' ? 'success' : 'warning'}>{titleCase(lister.kyc?.status || 'not_started')}</Badge>{lister.kyc?.legalName ? ` ${lister.kyc.legalName}` : ''}</Row>
              <Row label={t('admin.approvals.review.contact')} privateField>{lister.phone} · {lister.email}</Row>
              <Row label={t('admin.approvals.review.commission')}>{l.commission?.percent != null ? t('admin.approvals.review.commissionValue', { percent: l.commission.percent, name: l.commission.acceptedName || '-' }) : null}</Row>
              <Row label={t('admin.approvals.review.agreement')}>{l.activeAgreementId?.agreementNo ? `${l.activeAgreementId.agreementNo} v${l.activeAgreementId.version}` : null}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title={builder ? 'RERA' : t('admin.approvals.review.proof')} description={t('admin.approvals.review.proofDesc')} />
            <ul className="space-y-2">
              {(l.media?.ownershipProofs || []).map((pr) => (
                <li key={pr.fileId}><Button variant="secondary" size="sm" icon={FileText} onClick={() => openFile(pr.fileId)}>{titleCase(pr.docType)}</Button></li>
              ))}
              {builder && <li className="text-sm text-ink-muted">{(l.rera?.numbers || []).join(', ') || t('admin.approvals.review.noRera')}{l.rera?.url && <> · <a className="text-brand-700 hover:underline" href={l.rera.url} target="_blank" rel="noreferrer">{t('admin.approvals.review.officialLink')}</a></>}</li>}
              {builder && l.rera?.certificateFileId && <li><Button variant="secondary" size="sm" icon={FileText} onClick={() => openFile(l.rera.certificateFileId)}>{t('admin.approvals.review.reraCert')}</Button></li>}
              {!builder && !(l.media?.ownershipProofs || []).length && <li className="text-sm text-danger-700">{t('admin.approvals.review.noProof')}</li>}
            </ul>
          </Card>

          {mine ? (
            <Card>
              <CardHeader title={t('admin.approvals.review.decision')} />
              <div className="space-y-4">
                <div className="space-y-2">
                  {items.map((k) => <Checkbox key={k} label={CHECKLIST_LABELS[k] || k} checked={Boolean(checks[k])} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />)}
                </div>
                {!builder && <Input label={t('admin.approvals.review.ownerName')} hint={t('admin.approvals.review.ownerNameHint')} value={proofOwnerName} onChange={(e) => setProofOwnerName(e.target.value)} />}
                <Button block icon={ShieldCheck} disabled={!allTicked} loading={decide.isPending} onClick={() => submit('approve')}>{revision ? t('admin.approvals.review.approveChanges') : t('admin.approvals.review.approvePublish')}</Button>

                <div className="border-t pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">{t('admin.approvals.review.requestChanges')}</p>
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => setComments((c) => [...c, { field: 'photos', comment: '' }])}>{t('admin.approvals.review.addComment')}</Button>
                  </div>
                  {comments.map((c, i) => (
                    <div key={i} className="mb-2 grid grid-cols-[110px_1fr_auto] gap-2">
                      <Select aria-label={t('admin.approvals.review.field')} value={c.field} onChange={(e) => setComments((x) => x.map((y, j) => (j === i ? { ...y, field: e.target.value } : y)))} options={FIELDS.map((f) => ({ value: f, label: t(`admin.approvals.review.fields.${f}`) }))} />
                      <input className="h-10 rounded-md border border-line-strong px-3 text-sm" placeholder={t('admin.approvals.review.whatToFix')} value={c.comment} onChange={(e) => setComments((x) => x.map((y, j) => (j === i ? { ...y, comment: e.target.value } : y)))} />
                      <Button variant="ghost" size="sm" icon={Trash2} aria-label={t('admin.approvals.review.removeComment')} onClick={() => setComments((x) => x.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                  <Button block variant="secondary" disabled={!comments.some((c) => c.comment.trim().length >= 2)} loading={decide.isPending} onClick={() => submit('changes')}>{t('admin.approvals.review.sendBack')}</Button>
                </div>

                <div className="border-t pt-4">
                  <Textarea label={t('admin.approvals.review.rejectReason')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button className="mt-2" block variant="danger" disabled={!reason.trim()} loading={decide.isPending} onClick={() => submit('reject')}>{t('admin.approvals.review.reject')}</Button>
                </div>
                {formError && <Alert tone="danger" title={t('admin.approvals.review.cannotDecide')}><span className="inline-flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{formError}</span></Alert>}
              </div>
            </Card>
          ) : reviewable && !claimActive ? <Alert tone="info">{t('admin.approvals.review.claimHint')}</Alert> : null}
          {(l.statusHistory || []).length > 0 && (
            <Card>
              <CardHeader title={t('admin.approvals.review.history')} />
              <ol className="space-y-2 text-sm">
                {[...l.statusHistory].reverse().slice(0, 8).map((h, i) => (
                  <li key={i} className="flex justify-between gap-3"><span className="text-ink">{titleCase(h.from)} → {titleCase(h.to)}{h.note ? <span className="text-ink-subtle"> · {h.note}</span> : ''}</span><span className="shrink-0 text-xs text-ink-subtle">{dateTime(h.at)}</span></li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
