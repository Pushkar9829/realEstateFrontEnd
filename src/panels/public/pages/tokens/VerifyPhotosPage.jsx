// RE-A-20 photo verification capture page (token link opened on a phone at
// the property, no login): 1) share GPS (within the allowed distance of the
// private pin, accuracy <= 100 m), 2) take live photos with the camera,
// 3) send to our QA team. The exact pin is never sent to this page.
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, CheckCircle2, Link2Off, LocateFixed, MapPin, Send, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import { Alert, Button, Checkbox, Skeleton } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { sendCaptureLocation, submitCapture, uploadCapturePhoto, useCaptureSession } from '@/modules/search/api';
import { TokenCard, TokenEyebrow, TokenNotice, TokenPage } from './TokenFrame';

const STATUS_PAGE = {
  pending_review: ['account.verify.pendingTitle', 'account.verify.pendingText'],
  approved: ['account.verify.approvedTitle', 'account.verify.approvedText'],
  rejected: ['account.verify.rejectedTitle', 'account.verify.rejectedText'],
  expired: ['account.verify.expiredTitle', 'account.verify.expiredText'],
};

function position(t) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error(t('account.verify.noGeo'))); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? t('account.verify.denied') : t('account.verify.noFix'))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
    );
  });
}

function Step({ n, title, done, active, children }) {
  return (
    <li className={cn('rounded-2xl border p-4 transition-colors sm:p-5', active ? 'border-gold-300 bg-white shadow-card' : 'border-navy-900/10 bg-sand-50')}>
      <p className="flex items-center gap-3 text-sm font-semibold text-navy-900">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-success-600 text-white' : active ? 'bg-navy-900 text-gold-300' : 'bg-sand-200 text-navy-500')}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
        {title}
      </p>
      {(active || done) && children && <div className="mt-3">{children}</div>}
    </li>
  );
}

export default function VerifyPhotosPage() {
  const { token } = useParams();
  const t = useT();
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
  useDocumentMeta({ title: t('account.meta.verifyPhotos'), noindex: true });

  if (q.isLoading) return <TokenPage><Skeleton className="h-96 w-full" /></TokenPage>;
  if (q.isError) return <TokenNotice icon={Link2Off} title={t('account.verify.invalidTitle')} description={t('account.verify.invalidText')} />;
  const s = q.data;
  if (sent || STATUS_PAGE[s.status]) {
    const [title, text] = STATUS_PAGE[sent ? 'pending_review' : s.status];
    return <TokenNotice tone={sent || s.status === 'pending_review' || s.status === 'approved' ? 'success' : 'neutral'} icon={sent || s.status === 'pending_review' || s.status === 'approved' ? ShieldCheck : Link2Off} title={t(title)} description={t(text)} />;
  }

  const count = photos == null ? s.photos : photos;
  const located = Boolean(gps) || s.distanceM != null;
  const enough = count >= s.minPhotos;
  const distance = gps && gps.distanceM != null ? gps.distanceM : s.distanceM;

  const shareLocation = async () => {
    setLocating(true); setError(null);
    try {
      const p = await position(t);
      const r = await sendCaptureLocation(token, p);
      setGps({ ...p, distanceM: r.distanceM });
    } catch (e) { setError(e.message); } finally { setLocating(false); }
  };

  const onFiles = async (list) => {
    const files = [...(list || [])].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    setError(null);
    for (const file of files) {
      if (file.size > 8 * 1048576) { setError(t('account.verify.tooLarge', { name: file.name })); continue; }
      try {
        const p = await position(t);
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
    <TokenPage>
      <TokenCard>
        <TokenEyebrow>{t('account.verify.eyebrow')}</TokenEyebrow>
        <h1 className="mt-3 font-display text-2xl font-medium leading-tight text-navy-900 sm:text-3xl">{s.listing.title}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-navy-500"><MapPin className="h-4 w-4 text-gold-700" aria-hidden />{[s.listing.locality, s.listing.city].filter(Boolean).join(', ')} · {s.listing.listingNo}</p>
        <p className="mt-3 text-xs leading-relaxed text-navy-500">{t('account.verify.intro', { date: dateTime(s.expiresAt) })}</p>

        <ol className="mt-7 space-y-3">
          <Step n={1} title={t('account.verify.step1')} done={located} active={!located}>
            {located ? (
              <p className="text-sm text-success-700">{distance != null ? t('account.verify.checkedDistance', { m: distance }) : t('account.verify.checked')}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-navy-500">{t('account.verify.within', { m: s.maxDistanceM })}</p>
                <Button icon={LocateFixed} variant="gold" size="lg" className="!rounded-full font-semibold" loading={locating} onClick={shareLocation} block>{t('account.verify.share')}</Button>
              </>
            )}
          </Step>
          <Step n={2} title={t('account.verify.step2', { count: s.minPhotos })} done={enough} active={located && !enough}>
            <p className="mb-3 text-sm text-navy-500">{t('account.verify.taken', { count, min: s.minPhotos })}</p>
            {previews.length > 0 && <div className="mb-3 grid grid-cols-4 gap-1.5">{previews.map((u) => <img key={u} src={u} alt="" className="aspect-square w-full rounded-lg object-cover" />)}</div>}
            <Button icon={Camera} variant={enough ? 'outline' : 'gold'} size="lg" className="!rounded-full font-semibold" block disabled={!located || progress !== null || count >= 12} loading={progress !== null} onClick={() => input.current && input.current.click()}>
              {progress !== null ? t('account.verify.uploading', { pct: progress }) : enough ? t('account.verify.another') : t('account.verify.camera')}
            </Button>
            <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => onFiles(e.target.files)} />
          </Step>
          <Step n={3} title={t('account.verify.step3')} done={false} active={enough}>
            <Checkbox label={t('account.verify.gallery')} checked={gallery} onChange={(e) => setGallery(e.target.checked)} />
            <Button icon={Send} variant="navy" size="lg" className="mt-4 !rounded-full font-semibold" block loading={sending} onClick={send}>{t('account.verify.send')}</Button>
          </Step>
        </ol>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </TokenCard>
    </TokenPage>
  );
}
