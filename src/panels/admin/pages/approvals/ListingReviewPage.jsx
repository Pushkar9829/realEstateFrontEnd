// RE-D-02/03/04 listing review: public content beside private data (address,
// unit, lister, KYC, agreement, ownership proof via signed link), per-photo
// moderation, auto-check warnings, the approval checklist and the decision.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ExternalLink, FileText, Lock, LockOpen, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { listingStatus, WARNING_LABELS, useMasters } from '@/modules/listings/api';
import { CHECKLIST_LABELS, listingFileUrl, useClaimListing, useDecideListing, useModeratePhoto, useReleaseListing, useReviewListing } from '@/modules/approvals/api';

const FIELDS = ['title', 'description', 'location', 'details', 'price', 'amenities', 'photos', 'ownership_proof', 'commission', 'rera'];

function Row({ label, children, privateField }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="flex w-40 shrink-0 items-center gap-1 text-sm text-ink-subtle">{label}{privateField && <Lock className="h-3 w-3" aria-label="Private" />}</dt>
      <dd className="min-w-0 text-sm text-ink">{children || '-'}</dd>
    </div>
  );
}

function Photo({ p, editable, onDecide }) {
  const [reason, setReason] = useState('');
  const st = (p.moderation && p.moderation.status) || 'pending';
  return (
    <li className={cn('overflow-hidden rounded-lg border bg-white', st === 'approved' && 'border-success-600', st === 'rejected' && 'border-danger-600')}>
      <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-surface-sunken"><img src={p.thumbUrl || p.url} alt={p.caption || ''} className="h-full w-full object-cover" loading="lazy" /></a>
      <div className="space-y-2 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-muted">{p.caption || 'No caption'}{p.isCover ? ' · cover' : ''}</span>
          <Badge tone={st === 'approved' ? 'success' : st === 'rejected' ? 'danger' : 'neutral'}>{st}</Badge>
        </div>
        {editable && (
          <>
            <input className="h-8 w-full rounded border border-line px-2 text-xs" placeholder="Reason if rejecting" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Rejection reason" />
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant={st === 'approved' ? 'primary' : 'secondary'} icon={Check} onClick={() => onDecide(p._id, { status: 'approved' })}>Approve</Button>
              <Button size="sm" variant={st === 'rejected' ? 'danger' : 'secondary'} icon={X} disabled={!reason.trim()} onClick={() => onDecide(p._id, { status: 'rejected', reason: reason.trim() })}>Reject</Button>
            </div>
          </>
        )}
        {!editable && p.moderation?.reason && <p className="text-[11px] text-danger-700">{p.moderation.reason}</p>}
      </div>
    </li>
  );
}

export default function ListingReviewPage() {
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
      toast.success({ approve: revision ? 'Revision approved and merged' : 'Listing approved and live', changes: 'Changes requested from the lister', reject: 'Listing rejected' }[decision]);
      navigate('/admin/approvals');
    } catch (e) {
      setFormError(Array.isArray(e.details) && e.code === 'APPROVAL_BLOCKED' ? e.details.join(' · ') : e.message);
    }
  };

  return (
    <>
      <Link to="/admin/approvals" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Approval queue</Link>
      <PageHeader title={l.title} breadcrumb={`${l.listingNo} · ${titleCase(l.purpose)} · ${typeName}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>{revision && <Badge tone="info">Revision</Badge>}
          {reviewable && !claimActive && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), 'Claimed for 30 minutes')}>Claim to review</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), 'Released')}>Release</Button>}
        </>} />
      {claimActive && !mine && <Alert tone="warning" className="mb-4">Another reviewer holds this listing until {dateTime(l.review.claimUntil)}.</Alert>}
      {(l.warnings || []).length > 0 && (
        <Alert tone="warning" className="mb-4" title="Auto-check warnings">
          <ul className="list-disc pl-4">{l.warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || w}</li>)}</ul>
        </Alert>
      )}
      {revision && (
        <Alert tone="info" className="mb-4" title="Changes waiting for approval">
          Changed: {Object.keys(l.pendingRevision.changes || {}).map((k) => (/^\d$/.test(k) ? ['', 'basic details', 'location', 'details', 'price', 'amenities', 'media / RERA'][k] : k)).join(', ')}. The values below are the live version; approving merges the changes.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={`Photos (${approvedPhotos} of ${photos.length} approved)`} description="Approve at least 3. Rejected photos are hidden and the lister sees the reason." />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => <Photo key={p._id} p={p} editable={mine} onDecide={(mediaId, body) => act(() => moderate.mutateAsync({ mediaId, body }))} />)}
            </ul>
            {mine && photos.some((p) => p.moderation?.status !== 'approved') && (
              <Button className="mt-3" variant="secondary" size="sm" icon={CheckCircle2}
                onClick={() => act(async () => { for (const p of photos.filter((x) => x.moderation?.status !== 'approved')) await moderate.mutateAsync({ mediaId: p._id, body: { status: 'approved' } }); }, 'All photos approved')}>Approve all photos</Button>
            )}
          </Card>

          <Card>
            <CardHeader title="Listing details" description="Public fields, with private fields marked." />
            <dl className="divide-y">
              <Row label="Price">{price ? `${rupees(price)}${l.purpose === 'rent' ? ' / month' : ''}${l.price?.negotiable ? ' · negotiable' : ''}` : null}</Row>
              {l.purpose === 'rent' && <Row label="Deposit">{l.price?.deposit != null ? rupees(l.price.deposit) : null}</Row>}
              <Row label="Configuration">{[l.details?.bhk != null && `${l.details.bhk} BHK`, l.details?.baths != null && `${l.details.baths} bath`, l.details?.areaSqft && `${l.details.areaSqft} sq ft`, l.details?.furnishing && titleCase(l.details.furnishing)].filter(Boolean).join(' · ')}</Row>
              <Row label="Floor">{l.details?.floor != null ? `${l.details.floor} of ${l.details.totalFloors ?? '?'}` : null}</Row>
              <Row label="Locality">{[l.location?.locality, l.location?.city, l.location?.pincode].filter(Boolean).join(', ')}</Row>
              <Row label="Address" privateField>{[l.location?.societyName, l.location?.addressLine].filter(Boolean).join(', ')}</Row>
              <Row label="Unit number" privateField>{l.location?.unitNo}</Row>
              <Row label="Exact pin" privateField>{l.location?.geo?.coordinates ? <a className="text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${l.location.geo.coordinates[1]}&mlon=${l.location.geo.coordinates[0]}#map=17/${l.location.geo.coordinates[1]}/${l.location.geo.coordinates[0]}`}>{l.location.geo.coordinates[1]}, {l.location.geo.coordinates[0]} <ExternalLink className="inline h-3 w-3" /></a> : null}</Row>
              <Row label="Amenities">{(l.amenities || []).map((a) => amenityNames[a] || titleCase(a)).join(', ')}</Row>
              <Row label="Description"><span className="whitespace-pre-line">{l.description}</span></Row>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Lister and agreement" />
            <dl className="divide-y">
              <Row label="Lister">{lister.name} <span className="text-xs text-ink-subtle">({titleCase(lister.listerType)})</span></Row>
              <Row label="KYC"><Badge tone={lister.kyc?.status === 'verified' ? 'success' : 'warning'}>{titleCase(lister.kyc?.status || 'not_started')}</Badge>{lister.kyc?.legalName ? ` ${lister.kyc.legalName}` : ''}</Row>
              <Row label="Contact" privateField>{lister.phone} · {lister.email}</Row>
              <Row label="Commission">{l.commission?.percent != null ? `${l.commission.percent}% · accepted by ${l.commission.acceptedName || '-'}` : null}</Row>
              <Row label="Agreement">{l.activeAgreementId?.agreementNo ? `${l.activeAgreementId.agreementNo} v${l.activeAgreementId.version}` : null}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title={builder ? 'RERA' : 'Ownership proof'} description="Opens a 10-minute link; each view is recorded." />
            <ul className="space-y-2">
              {(l.media?.ownershipProofs || []).map((pr) => (
                <li key={pr.fileId}><Button variant="secondary" size="sm" icon={FileText} onClick={() => openFile(pr.fileId)}>{titleCase(pr.docType)}</Button></li>
              ))}
              {builder && <li className="text-sm text-ink-muted">{(l.rera?.numbers || []).join(', ') || 'No RERA number'}{l.rera?.url && <> · <a className="text-brand-700 hover:underline" href={l.rera.url} target="_blank" rel="noreferrer">official link</a></>}</li>}
              {builder && l.rera?.certificateFileId && <li><Button variant="secondary" size="sm" icon={FileText} onClick={() => openFile(l.rera.certificateFileId)}>RERA certificate</Button></li>}
              {!builder && !(l.media?.ownershipProofs || []).length && <li className="text-sm text-danger-700">No ownership proof uploaded</li>}
            </ul>
          </Card>

          {mine ? (
            <Card>
              <CardHeader title="Decision" />
              <div className="space-y-4">
                <div className="space-y-2">
                  {items.map((k) => <Checkbox key={k} label={CHECKLIST_LABELS[k] || k} checked={Boolean(checks[k])} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />)}
                </div>
                {!builder && <Input label="Owner name on the proof" hint="Compared with the lister's verified name (broker check R1)." value={proofOwnerName} onChange={(e) => setProofOwnerName(e.target.value)} />}
                <Button block icon={ShieldCheck} disabled={!allTicked} loading={decide.isPending} onClick={() => submit('approve')}>{revision ? 'Approve changes' : 'Approve and publish'}</Button>

                <div className="border-t pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">Request changes</p>
                    <Button size="sm" variant="ghost" icon={Plus} onClick={() => setComments((c) => [...c, { field: 'photos', comment: '' }])}>Add comment</Button>
                  </div>
                  {comments.map((c, i) => (
                    <div key={i} className="mb-2 grid grid-cols-[110px_1fr_auto] gap-2">
                      <Select aria-label="Field" value={c.field} onChange={(e) => setComments((x) => x.map((y, j) => (j === i ? { ...y, field: e.target.value } : y)))} options={FIELDS.map((f) => ({ value: f, label: titleCase(f) }))} />
                      <input className="h-10 rounded-md border border-line-strong px-3 text-sm" placeholder="What to fix" value={c.comment} onChange={(e) => setComments((x) => x.map((y, j) => (j === i ? { ...y, comment: e.target.value } : y)))} />
                      <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove comment" onClick={() => setComments((x) => x.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                  <Button block variant="secondary" disabled={!comments.some((c) => c.comment.trim().length >= 2)} loading={decide.isPending} onClick={() => submit('changes')}>Send back for changes</Button>
                </div>

                <div className="border-t pt-4">
                  <Textarea label="Rejection reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button className="mt-2" block variant="danger" disabled={!reason.trim()} loading={decide.isPending} onClick={() => submit('reject')}>Reject</Button>
                </div>
                {formError && <Alert tone="danger" title="Cannot decide yet"><span className="inline-flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{formError}</span></Alert>}
              </div>
            </Card>
          ) : reviewable && !claimActive ? <Alert tone="info">Claim this listing to moderate photos and decide.</Alert> : null}
          {(l.statusHistory || []).length > 0 && (
            <Card>
              <CardHeader title="History" />
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
