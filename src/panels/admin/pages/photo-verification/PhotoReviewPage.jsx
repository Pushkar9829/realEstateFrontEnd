// RE-S-ADM-31 photo verification review: captured photos (10-minute signed
// links) beside the listing gallery, capture points against the exact pin,
// claim / release and the approve or reject decision. On approve the reviewer
// may override the lister's add-to-gallery choice.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, Lock, LockOpen, MapPin, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { PHOTO_REJECT_REASONS, sessionStatus, useClaimSession, useDecideSession, usePhotoSession, useReleaseSession } from '@/modules/listings/photoQaApi';

const osm = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

function Row({ label, children }) {
  return <div className="flex gap-4 py-2 text-sm"><dt className="w-36 shrink-0 text-ink-subtle">{label}</dt><dd className="min-w-0 text-ink">{children ?? '-'}</dd></div>;
}

export default function PhotoReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me } = useAuth();
  const { data: s, isLoading, error } = usePhotoSession(id);
  const claim = useClaimSession(id);
  const release = useReleaseSession(id);
  const decide = useDecideSession(id);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [galleryChoice, setGalleryChoice] = useState(null); // null = keep the lister's choice
  const [formError, setFormError] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const p = s.propertyId || {};
  const st = sessionStatus(s.status);
  const pending = s.status === 'pending_review';
  const claimActive = pending && s.review?.claimedBy && new Date(s.review.claimUntil) > new Date();
  const mine = claimActive && String(s.review.claimedBy) === String(me._id);
  const pin = p.location?.geo?.coordinates; // [lng, lat]
  const gallery = p.media?.photos || [];
  const addToGallery = galleryChoice ?? Boolean(s.addToGallery);

  const act = async (fn, msg) => { try { await fn(); toast.success(msg); } catch (e) { toast.error(e.message); } };
  const submit = async (decision) => {
    setFormError(null);
    if (decision === 'reject' && (!reason || comment.trim().length < 10)) { setFormError('Pick a reason and write a comment of at least 10 characters.'); return; }
    try {
      await decide.mutateAsync({ decision, ...(decision === 'reject' ? { reason } : { addToGallery }), ...(comment.trim() ? { comment: comment.trim() } : {}) });
      toast.success(decision === 'approve' ? 'Approved: Photo verified badge granted' : 'Rejected; the lister is told why');
      navigate('/admin/photo-verification');
    } catch (e) { setFormError(e.message); }
  };

  return (
    <>
      <Link to="/admin/photo-verification" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Photo verification</Link>
      <PageHeader title={p.title || s.sessionNo} breadcrumb={`${s.sessionNo} · ${p.listingNo || ''}`}
        actions={<>
          <Badge tone={st.tone}>{st.label}</Badge>
          {pending && !claimActive && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), 'Claimed for 30 minutes')}>Claim to review</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), 'Released')}>Release</Button>}
        </>} />
      {claimActive && !mine && <Alert tone="warning" className="mb-4">Another reviewer holds this session until {dateTime(s.review.claimUntil)}. Read only.</Alert>}
      {!pending && s.review?.decision && (
        <Alert tone={s.review.decision === 'approve' ? 'success' : 'danger'} className="mb-4" title={s.review.decision === 'approve' ? 'Approved' : 'Rejected'}>
          {[s.review.reason && s.review.reason.replace(/_/g, ' '), s.review.comment, s.review.at && dateTime(s.review.at)].filter(Boolean).join(' · ')}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={`Captured photos (${(s.photos || []).length})`} description="Taken live during the session. Links expire after 10 minutes and refresh automatically." />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(s.photos || []).map((ph, i) => (
                <li key={String(ph.fileId) || i} className="overflow-hidden rounded-lg border bg-white">
                  {ph.url ? <a href={ph.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-surface-sunken"><img src={ph.url} alt={`Captured photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" /></a>
                    : <div className="flex aspect-[4/3] items-center justify-center bg-surface-sunken text-xs text-ink-subtle">File missing</div>}
                  <div className="p-2 text-xs text-ink-muted">
                    <p>{dateTime(ph.capturedAt)}</p>
                    {ph.lat != null && <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={osm(ph.lat, ph.lng)} target="_blank" rel="noreferrer"><MapPin className="h-3 w-3" />{Number(ph.lat).toFixed(5)}, {Number(ph.lng).toFixed(5)}</a>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title={`Listing gallery (${gallery.length})`} description="Compare with the captured photos." />
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {gallery.map((ph) => <li key={ph._id || ph.fileId}><a href={ph.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-md bg-surface-sunken"><img src={ph.thumbUrl || ph.url} alt={ph.caption || ''} className="h-full w-full object-cover" loading="lazy" /></a></li>)}
              {!gallery.length && <li className="col-span-full text-sm text-ink-subtle">No gallery photos.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Location check" />
            <dl className="divide-y">
              <Row label="Distance from pin">{s.gps?.distanceM != null ? `${s.gps.distanceM} m` : null}</Row>
              <Row label="GPS accuracy">{s.gps?.accuracy != null ? `±${Math.round(s.gps.accuracy)} m` : null}</Row>
              <Row label="Exact pin">{pin ? <a className="text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={osm(pin[1], pin[0])}>{pin[1]}, {pin[0]} <ExternalLink className="inline h-3 w-3" /></a> : null}</Row>
              <Row label="Capture point">{s.gps?.lat != null ? <a className="text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={osm(s.gps.lat, s.gps.lng)}>{s.gps.lat}, {s.gps.lng} <ExternalLink className="inline h-3 w-3" /></a> : null}</Row>
              <Row label="Locality">{[p.location?.locality, p.location?.city].filter(Boolean).join(', ')}</Row>
              <Row label="Session started">{dateTime(s.createdAt)}</Row>
              <Row label="Add to gallery">{s.addToGallery ? 'Yes, the lister asked to add these photos to the gallery on approval' : 'No'}</Row>
              <Row label="Current badge">{p.verification?.photo?.status ? `${p.verification.photo.status}${p.verification.photo.expiresAt ? ` until ${dateTime(p.verification.photo.expiresAt)}` : ''}` : 'None'}</Row>
            </dl>
          </Card>

          {mine ? (
            <Card>
              <CardHeader title="Decision" description="Approving grants the Photo verified badge for 180 days." />
              <div className="space-y-4">
                <Checkbox label="Add the captured photos to the listing gallery" description={`The lister ${s.addToGallery ? 'asked to add them' : 'did not ask to add them'}. Up to 20 gallery photos in all.`} checked={addToGallery} onChange={(e) => setGalleryChoice(e.target.checked)} />
                <Button block icon={Check} loading={decide.isPending} onClick={() => submit('approve')}>Approve</Button>
                <div className="space-y-3 border-t pt-4">
                  <Select label="Reject reason" placeholder="Choose a reason" value={reason} onChange={(e) => setReason(e.target.value)} options={PHOTO_REJECT_REASONS} />
                  <Textarea label="Comment" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} hint="Required to reject (10-500 characters). Sent to the lister." />
                  <Button block variant="danger" icon={X} disabled={!reason || comment.trim().length < 10} loading={decide.isPending} onClick={() => submit('reject')}>Reject</Button>
                </div>
                {formError && <Alert tone="danger">{formError}</Alert>}
              </div>
            </Card>
          ) : pending && !claimActive ? <Alert tone="info">Claim this session to decide.</Alert> : null}
        </div>
      </div>
    </>
  );
}
