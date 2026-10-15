// RE-A-20 photo verification capture page (token link opened on a phone at
// the property, no login): 1) share GPS (within the allowed distance of the
// private pin, accuracy <= 100 m), 2) take live photos with the camera,
// 3) send to our QA team. The exact pin is never sent to this page.
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, CheckCircle2, Link2Off, LocateFixed, MapPin, Send, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import { Alert, Button, Card, Checkbox, Skeleton } from '@/shared/ui';
import { sendCaptureLocation, submitCapture, uploadCapturePhoto, useCaptureSession } from '@/modules/search/api';
import { NarrowPage, NotAvailable } from '../../components/States';

const STATUS_PAGE = {
  pending_review: ['Sent for review', 'Our team reviews the photos within 48 hours. You can close this page.'],
  approved: ['Photos verified', 'The "Photo verified" badge is now on the listing.'],
  rejected: ['Not approved', 'The lister can start a new verification from the panel.'],
  expired: ['This link has expired', 'Ask the lister to start a new verification from the panel.'],
};

function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not available on this device. Open the link in your phone browser.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied. Allow location for this site in your browser settings and try again.' : 'Could not get your location. Turn on GPS and try again.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
    );
  });
}

function Step({ n, title, done, active, children }) {
  return (
    <li className={cn('rounded-lg border p-4', active ? 'border-brand-300 bg-white' : 'border-line bg-surface-muted')}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs', done ? 'bg-success-600 text-white' : active ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-subtle')}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
        {title}
      </p>
      {(active || done) && children && <div className="mt-3">{children}</div>}
    </li>
  );
}

export default function VerifyPhotosPage() {
  const { token } = useParams();
  const q = useCaptureSession(token);
  const input = useRef(null);
  const [gps, setGps] = useState(null);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previews, setPreviews] = useState([]);

  if (q.isLoading) return <NarrowPage><Skeleton className="h-96 w-full" /></NarrowPage>;
  if (q.isError) return <NotAvailable icon={Link2Off} title="This link is not valid" description="Ask the lister to send a new verification link." />;
  const s = q.data;
  if (sent || STATUS_PAGE[s.status]) {
    const [title, text] = STATUS_PAGE[sent ? 'pending_review' : s.status];
    return <NotAvailable icon={sent || s.status === 'pending_review' || s.status === 'approved' ? ShieldCheck : Link2Off} title={title} description={text} />;
  }

  const count = photos == null ? s.photos : photos;
  const located = Boolean(gps) || s.distanceM != null;
  const enough = count >= s.minPhotos;

  const shareLocation = async () => {
    setLocating(true); setError(null);
    try {
      const p = await position();
      const r = await sendCaptureLocation(token, p);
      setGps({ ...p, distanceM: r.distanceM });
    } catch (e) { setError(e.message); } finally { setLocating(false); }
  };

  const onFiles = async (list) => {
    const files = [...(list || [])].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    setError(null);
    for (const file of files) {
      if (file.size > 8 * 1048576) { setError(`${file.name} is larger than 8 MB`); continue; }
      try {
        const p = await position();
        setProgress(0);
        const r = await uploadCapturePhoto(token, file, { ...p, capturedAt: new Date().toISOString() }, setProgress);
        setPhotos(r.photos);
        setPreviews((xs) => [...xs, URL.createObjectURL(file)].slice(-12));
      } catch (e) { setError(e.message); }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
  };

  const send = async () => {
    setSending(true); setError(null);
    try { await submitCapture(token, { addToGallery: gallery }); setSent(true); } catch (e) { setError(e.message); } finally { setSending(false); }
  };

  return (
    <NarrowPage>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Photo verification</p>
        <h1 className="mt-1 text-lg font-semibold text-ink">{s.listing.title}</h1>
        <p className="flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden />{[s.listing.locality, s.listing.city].filter(Boolean).join(', ')} · {s.listing.listingNo}</p>
        <p className="mt-2 text-xs text-ink-subtle">Stand at the property. Photos must be taken live with this phone's camera. Link valid until {dateTime(s.expiresAt)}.</p>

        <ol className="mt-5 space-y-3">
          <Step n={1} title="Share your location" done={located} active={!located}>
            {located ? (
              <p className="text-sm text-success-700">Location checked{(gps && gps.distanceM != null) || s.distanceM != null ? `: about ${gps ? gps.distanceM : s.distanceM} m from the property` : ''}.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-muted">We check that you are within {s.maxDistanceM} m of the property. Turn on GPS for best accuracy.</p>
                <Button icon={LocateFixed} loading={locating} onClick={shareLocation} block>Share my location</Button>
              </>
            )}
          </Step>
          <Step n={2} title={`Take at least ${s.minPhotos} photos`} done={enough} active={located && !enough}>
            <p className="mb-3 text-sm text-ink-muted">{count} of {s.minPhotos} taken (up to 12). Cover the entrance, living room, kitchen and bedrooms.</p>
            {previews.length > 0 && <div className="mb-3 grid grid-cols-4 gap-1.5">{previews.map((u) => <img key={u} src={u} alt="" className="aspect-square w-full rounded object-cover" />)}</div>}
            <Button icon={Camera} variant={enough ? 'secondary' : 'primary'} block disabled={!located || progress !== null || count >= 12} loading={progress !== null} onClick={() => input.current && input.current.click()}>
              {progress !== null ? `Uploading ${progress}%` : enough ? 'Take another photo' : 'Open camera'}
            </Button>
            <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => onFiles(e.target.files)} />
          </Step>
          <Step n={3} title="Send for review" done={false} active={enough}>
            <Checkbox label="Also add these photos to the listing gallery" checked={gallery} onChange={(e) => setGallery(e.target.checked)} />
            <Button icon={Send} className="mt-3" block loading={sending} onClick={send}>Send to our team</Button>
          </Step>
        </ol>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </Card>
    </NarrowPage>
  );
}
