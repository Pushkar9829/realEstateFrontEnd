// RE-D-13 verification visit outcome: GPS on arrival (navigator.geolocation),
// the checklist, 4-20 photos (purpose verification_photo) and the result.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, LocateFixed, MapPin, X } from 'lucide-react';
import { Alert, Button, Card, Checkbox, EmptyState, PageHeader, Select, Skeleton, Textarea, useToast } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import FileDrop from '@/shared/components/FileDrop';
import { useAuth } from '@/modules/auth';
import { VERIFICATION_CHECKLIST, VERIFICATION_STATUS, errorText, useAgentMutation, useVerificationVisits, verificationApi } from '@/modules/leads/agentApi';
import { ErrorState, StatusBadge } from '../../components/common';
import { NoFieldAccess } from './VerificationVisitsPage';

const RESULTS = [
  { value: 'verified', label: 'Verified: everything matches' },
  { value: 'not_verified', label: 'Not verified: does not match' },
  { value: 'lister_absent', label: 'Lister absent' },
  { value: 'cancelled', label: 'Cancelled on site' },
];

export default function VerificationOutcomePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('verification.field');
  const { data, isLoading, error, refetch } = useVerificationVisits({ limit: 100 }, allowed);
  const m = useAgentMutation(verificationApi.outcome);
  const [gps, setGps] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [checklist, setChecklist] = useState({});
  const [photos, setPhotos] = useState([]);
  const [result, setResult] = useState('verified');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});

  if (!allowed) return <NoFieldAccess />;
  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const visit = ((data && data.items) || []).find((v) => v._id === id);
  if (!visit) return <EmptyState title="Visit not found" description="It may not be assigned to you." action={<Button variant="secondary" to="/agent/verification-visits">Back</Button>} />;

  const p = visit.propertyId || {};
  const addr = p.location ? [p.location.addressLine, p.location.locality, p.location.city].filter(Boolean).join(', ') : '';
  const open = visit.status === 'scheduled';
  const notStarted = visit.scheduledAt && new Date(visit.scheduledAt) > new Date();
  const needsEvidence = ['verified', 'not_verified'].includes(result);

  const locate = () => {
    if (!navigator.geolocation) { setGpsError('This device cannot share its location.'); return; }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }); setLocating(false); },
      (err) => { setGpsError(err.code === 1 ? 'Location permission was denied. Allow it in the browser and try again.' : 'Could not get your location. Move to open sky and retry.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const save = async () => {
    const e = {};
    if (needsEvidence && !gps) e.gps = 'Capture GPS on arrival';
    if (needsEvidence && photos.length < 4) e.photoFileIds = 'Upload at least 4 photos';
    if (photos.length > 20) e.photoFileIds = 'Up to 20 photos';
    if (result === 'verified' && VERIFICATION_CHECKLIST.some((c) => checklist[c.key] !== true)) e.checklist = 'Every checklist item must pass for a verified result';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      result, checklist: Object.fromEntries(VERIFICATION_CHECKLIST.map((c) => [c.key, Boolean(checklist[c.key])])),
      photoFileIds: photos.map((x) => x.id), ...(gps ? { gps } : {}), ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
    };
    try { await m.mutateAsync({ id: visit._id, body }); toast.success('Outcome recorded'); navigate('/agent/verification-visits'); } catch (err) { setErrors(err.fieldErrors || {}); toast.error(errorText(err)); }
  };

  return (
    <>
      <PageHeader breadcrumb={<Link to="/agent/verification-visits" className="hover:text-ink">Verification visits</Link>} title={visit.visitNo}
        description={`${p.listingNo || ''} · ${p.title || ''} · ${dateTime(visit.scheduledAt)}`} actions={<StatusBadge map={VERIFICATION_STATUS} status={visit.status} />} />
      <Card className="mb-6 text-sm">
        <p className="flex items-start gap-2 text-ink"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />{addr || 'Address not available'}</p>
        {addr && <a className="mt-2 inline-flex items-center gap-1 text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}>Directions <ExternalLink className="h-3.5 w-3.5" /></a>}
        {visit.notes && <p className="mt-2 text-ink-muted">Notes: {visit.notes}</p>}
      </Card>
      {!open ? (
        <Alert tone="info" title="Outcome recorded">{visit.result ? `Result: ${VERIFICATION_STATUS[visit.result] ? VERIFICATION_STATUS[visit.result].label : visit.result}.` : ''} {visit.remarks || ''}</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {notStarted && <Alert tone="warning">The outcome can be recorded once the visit has started ({dateTime(visit.scheduledAt)}).</Alert>}
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">1. GPS on arrival</h2>
              <Button variant={gps ? 'secondary' : 'primary'} icon={LocateFixed} loading={locating} onClick={locate}>{gps ? 'Capture again' : 'Capture my location'}</Button>
              {gps && <p className="mt-2 text-sm text-ink">{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} <span className="text-ink-subtle">· accurate to {gps.accuracy} m</span></p>}
              {(gpsError || errors.gps) && <p className="mt-2 text-xs text-danger-600" role="alert">{gpsError || errors.gps}</p>}
              <p className="mt-2 text-xs text-ink-subtle">A verified result must be captured near the listing pin.</p>
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">2. Checklist</h2>
              <div className="space-y-3">{VERIFICATION_CHECKLIST.map((c) => <Checkbox key={c.key} label={c.label} checked={Boolean(checklist[c.key])} onChange={(e) => setChecklist((x) => ({ ...x, [c.key]: e.target.checked }))} />)}</div>
              {errors.checklist && <p className="mt-2 text-xs text-danger-600" role="alert">{errors.checklist}</p>}
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">3. Photos ({photos.length}/20, at least 4)</h2>
              {photos.length < 20 && <FileDrop purpose="verification_photo" kind="image" multiple onUploaded={(f, raw) => setPhotos((x) => (x.length >= 20 ? x : [...x, { id: f.id, url: f.thumbUrl || f.url, name: raw.name }]))} label="Upload photos" />}
              {photos.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {photos.map((ph) => (
                    <li key={ph.id} className="relative overflow-hidden rounded-md border bg-surface-sunken">
                      {ph.url ? <img src={ph.url} alt={ph.name} className="h-20 w-full object-cover" /> : <span className="block h-20 truncate p-2 text-xs text-ink-subtle">{ph.name}</span>}
                      <button type="button" className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-ink-subtle shadow hover:text-ink" aria-label={`Remove ${ph.name}`} onClick={() => setPhotos((x) => x.filter((y) => y.id !== ph.id))}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              {errors.photoFileIds && <p className="mt-2 text-xs text-danger-600" role="alert">{errors.photoFileIds}</p>}
            </Card>
          </div>
          <Card className="h-fit space-y-4">
            <h2 className="text-base font-semibold text-ink">4. Result</h2>
            <Select label="Result" required value={result} onChange={(e) => setResult(e.target.value)} options={RESULTS} />
            {result === 'not_verified' && <Alert tone="warning">If the property does not exist or does not match, the listing is paused for review.</Alert>}
            <Textarea label="Remarks" rows={3} maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <Button block loading={m.isPending} disabled={notStarted} onClick={save}>Submit outcome</Button>
          </Card>
        </div>
      )}
    </>
  );
}
