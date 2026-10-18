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
import { useT } from '@/shared/i18n';
import { ErrorState, StatusBadge } from '../../components/common';
import { NoFieldAccess } from './VerificationVisitsPage';

// Labels: agent.verification.result.<value>.
const RESULTS = ['verified', 'not_verified', 'lister_absent', 'cancelled'];

export default function VerificationOutcomePage() {
  const t = useT();
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
  if (!visit) return <EmptyState title={t('agent.verification.notFound')} description={t('agent.verification.notFoundDesc')} action={<Button variant="secondary" to="/agent/verification-visits">{t('common.back')}</Button>} />;

  const p = visit.propertyId || {};
  const addr = p.location ? [p.location.addressLine, p.location.locality, p.location.city].filter(Boolean).join(', ') : '';
  const open = visit.status === 'scheduled';
  const notStarted = visit.scheduledAt && new Date(visit.scheduledAt) > new Date();
  const needsEvidence = ['verified', 'not_verified'].includes(result);

  const locate = () => {
    if (!navigator.geolocation) { setGpsError(t('agent.verification.noGeo')); return; }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }); setLocating(false); },
      (err) => { setGpsError(err.code === 1 ? t('agent.verification.geoDenied') : t('agent.verification.geoFailed')); setLocating(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const save = async () => {
    const e = {};
    if (needsEvidence && !gps) e.gps = t('agent.verification.errGps');
    if (needsEvidence && photos.length < 4) e.photoFileIds = t('agent.verification.errPhotosMin');
    if (photos.length > 20) e.photoFileIds = t('agent.verification.errPhotosMax');
    if (result === 'verified' && VERIFICATION_CHECKLIST.some((c) => checklist[c.key] !== true)) e.checklist = t('agent.verification.errChecklist');
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      result, checklist: Object.fromEntries(VERIFICATION_CHECKLIST.map((c) => [c.key, Boolean(checklist[c.key])])),
      photoFileIds: photos.map((x) => x.id), ...(gps ? { gps } : {}), ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
    };
    try { await m.mutateAsync({ id: visit._id, body }); toast.success(t('agent.verification.recorded')); navigate('/agent/verification-visits'); } catch (err) { setErrors(err.fieldErrors || {}); toast.error(errorText(err)); }
  };

  return (
    <>
      <PageHeader breadcrumb={<Link to="/agent/verification-visits" className="hover:text-ink">{t('panel.nav.agentVerificationVisits')}</Link>} title={visit.visitNo}
        description={`${p.listingNo || ''} · ${p.title || ''} · ${dateTime(visit.scheduledAt)}`} actions={<StatusBadge map={VERIFICATION_STATUS} status={visit.status} />} />
      <Card className="mb-6 text-sm">
        <p className="flex items-start gap-2 text-ink"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />{addr || t('agent.verification.noAddress')}</p>
        {addr && <a className="mt-2 inline-flex items-center gap-1 text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}>{t('agent.visits.directions')} <ExternalLink className="h-3.5 w-3.5" /></a>}
        {visit.notes && <p className="mt-2 text-ink-muted">{t('agent.verification.notes', { text: visit.notes })}</p>}
      </Card>
      {!open ? (
        <Alert tone="info" title={t('agent.verification.recorded')}>{visit.result ? t('agent.verification.resultText', { result: VERIFICATION_STATUS[visit.result] ? VERIFICATION_STATUS[visit.result].label : visit.result }) : ''} {visit.remarks || ''}</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {notStarted && <Alert tone="warning">{t('agent.verification.notStarted', { at: dateTime(visit.scheduledAt) })}</Alert>}
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">{t('agent.verification.step1')}</h2>
              <Button variant={gps ? 'secondary' : 'primary'} icon={LocateFixed} loading={locating} onClick={locate}>{gps ? t('agent.verification.captureAgain') : t('agent.verification.capture')}</Button>
              {gps && <p className="mt-2 text-sm text-ink">{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} <span className="text-ink-subtle">· {t('agent.verification.accuracy', { n: gps.accuracy })}</span></p>}
              {(gpsError || errors.gps) && <p className="mt-2 text-xs text-danger-600" role="alert">{gpsError || errors.gps}</p>}
              <p className="mt-2 text-xs text-ink-subtle">{t('agent.verification.nearPin')}</p>
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">{t('agent.verification.step2')}</h2>
              <div className="space-y-3">{VERIFICATION_CHECKLIST.map((c) => <Checkbox key={c.key} label={c.label} checked={Boolean(checklist[c.key])} onChange={(e) => setChecklist((x) => ({ ...x, [c.key]: e.target.checked }))} />)}</div>
              {errors.checklist && <p className="mt-2 text-xs text-danger-600" role="alert">{errors.checklist}</p>}
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">{t('agent.verification.step3', { n: photos.length })}</h2>
              {photos.length < 20 && <FileDrop purpose="verification_photo" kind="image" multiple onUploaded={(f, raw) => setPhotos((x) => (x.length >= 20 ? x : [...x, { id: f.id, url: f.thumbUrl || f.url, name: raw.name }]))} label={t('agent.outcome.uploadPhotos')} />}
              {photos.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {photos.map((ph) => (
                    <li key={ph.id} className="relative overflow-hidden rounded-md border bg-surface-sunken">
                      {ph.url ? <img src={ph.url} alt={ph.name} className="h-20 w-full object-cover" /> : <span className="block h-20 truncate p-2 text-xs text-ink-subtle">{ph.name}</span>}
                      <button type="button" className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-ink-subtle shadow hover:text-ink" aria-label={t('agent.outcome.removePhoto', { name: ph.name })} onClick={() => setPhotos((x) => x.filter((y) => y.id !== ph.id))}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              {errors.photoFileIds && <p className="mt-2 text-xs text-danger-600" role="alert">{errors.photoFileIds}</p>}
            </Card>
          </div>
          <Card className="h-fit space-y-4">
            <h2 className="text-base font-semibold text-ink">{t('agent.verification.step4')}</h2>
            <Select label={t('agent.outcome.result')} required value={result} onChange={(e) => setResult(e.target.value)} options={RESULTS.map((value) => ({ value, label: t(`agent.verification.result.${value}`) }))} />
            {result === 'not_verified' && <Alert tone="warning">{t('agent.verification.pausedHint')}</Alert>}
            <Textarea label={t('agent.verification.remarks')} rows={3} maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <Button block loading={m.isPending} disabled={notStarted} onClick={save}>{t('agent.verification.submit')}</Button>
          </Card>
        </div>
      )}
    </>
  );
}
