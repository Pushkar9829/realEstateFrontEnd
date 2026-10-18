// RE-S-LIS-19 photo verification (in-panel part) and RE-D-13 site visit request,
// opened from My listings. Calls:
//   GET  /api/lister/properties/:id/verification               badge status + attempts
//   POST /api/lister/properties/:id/verification/photo-session  new capture link
//   POST /api/lister/properties/:id/verification/site-request   ask for a site visit (Could)
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Copy, MessageCircle, Send } from 'lucide-react';
import { Alert, Badge, Button, Modal, Skeleton, Textarea, useToast } from '@/shared/ui';
import { api } from '@/shared/lib/api';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';

// Labels: lister.verify.status.<code>.
const PHOTO_STATUS = { none: 'neutral', verified: 'success', approved: 'success', pending: 'info', pending_review: 'info', rejected: 'danger', expired: 'neutral', open: 'warning' };
const photoStatus = (s, t) => (PHOTO_STATUS[s || 'none'] ? { label: t(`lister.verify.status.${s || 'none'}`), tone: PHOTO_STATUS[s || 'none'] } : { label: titleCase(s), tone: 'neutral' });

export function PhotoVerificationModal({ listing, open, onClose }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const key = ['lister', 'verification', listing && listing._id];
  const status = useQuery({ queryKey: key, queryFn: () => api.get(`/lister/properties/${listing._id}/verification`), enabled: Boolean(open && listing) });
  const start = useMutation({ mutationFn: () => api.post(`/lister/properties/${listing._id}/verification/photo-session`), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  const begin = async () => {
    setError('');
    try { setSession(await start.mutateAsync()); } catch (e) { setError(e.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(session.link); toast.success(t('lister.verify.copied')); } catch { toast.error(t('lister.verify.copyFailed')); }
  };
  const msg = session ? t('lister.verify.message', { link: session.link }) : '';
  const d = status.data;
  const photo = d && d.photo;
  const ps = photoStatus(photo && photo.status, t);

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('lister.listings.actions.photo')} description={listing ? `${listing.listingNo || ''} · ${listing.title || ''}` : undefined}
      footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}>
      {status.isLoading ? <Skeleton className="h-32" /> : status.isError ? <Alert tone="danger">{status.error.message}</Alert> : d && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-subtle">{t('lister.verify.badge')}</span><Badge tone={ps.tone}>{ps.label}</Badge>
            {photo && photo.status === 'verified' && photo.expiresAt && <span className="text-ink-subtle">{t('lister.listingStatus.until', { date: date(photo.expiresAt) })}</span>}
          </div>
          <p className="text-sm text-ink-muted">
            {t('lister.verify.rules', { min: d.rules.minPhotos, distance: d.rules.maxDistanceM, attempts: d.rules.maxAttemptsPer30Days, days: d.rules.validDays })}
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          {session ? (
            <div className="space-y-3 rounded-md border bg-surface-muted p-3">
              <p className="text-sm text-ink">{t('lister.verify.linkFor', { no: session.sessionNo, date: dateTime(session.expiresAt) })}</p>
              <input readOnly value={session.link} onFocus={(e) => e.target.select()} className="block h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm text-ink" aria-label={t('lister.verify.link')} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>{t('lister.verify.copy')}</Button>
                <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')}>WhatsApp</Button>
                <Button size="sm" variant="secondary" icon={Send} onClick={() => { window.location.href = `sms:?&body=${encodeURIComponent(msg)}`; }}>SMS</Button>
              </div>
            </div>
          ) : (
            <Button icon={Camera} loading={start.isPending} onClick={begin}>{t('lister.verify.start')}</Button>
          )}
          {d.attempts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t('lister.verify.attempts')}</h3>
              <ul className="divide-y rounded-md border text-sm">
                {d.attempts.map((a) => {
                  const s = photoStatus(a.status, t);
                  return (
                    <li key={a.sessionNo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="text-ink">{a.sessionNo} · {dateTime(a.createdAt)} · {t('lister.verify.photos', { count: a.photos })}</span>
                      <span className="flex items-center gap-2"><Badge tone={s.tone}>{s.label}</Badge>{a.reason && <span className="text-xs text-danger-700">{a.reason}</span>}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function SiteVisitRequestModal({ listing, open, onClose }) {
  const t = useT();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const req = useMutation({ mutationFn: () => api.post(`/lister/properties/${listing._id}/verification/site-request`, note.trim() ? { note: note.trim() } : {}) });
  const send = async () => {
    setError('');
    try {
      const r = await req.mutateAsync();
      toast.success(t('lister.verify.siteRequested', { no: r.visitNo }));
      setNote('');
      onClose();
    } catch (e) { setError(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('lister.verify.siteTitle')} description={t('lister.verify.siteDesc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={req.isPending} onClick={send}>{t('lister.verify.send')}</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="danger" title={t('lister.verify.notSent')}>{error}</Alert>}
        <Textarea label={t('lister.verify.note')} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint={t('lister.verify.noteHint')} />
      </div>
    </Modal>
  );
}
