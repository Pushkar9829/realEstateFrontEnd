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

const PHOTO_STATUS = {
  none: { label: 'Not started', tone: 'neutral' }, verified: { label: 'Verified', tone: 'success' }, approved: { label: 'Approved', tone: 'success' },
  pending: { label: 'Pending review', tone: 'info' }, pending_review: { label: 'Pending review', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' }, expired: { label: 'Expired', tone: 'neutral' }, open: { label: 'Link sent', tone: 'warning' },
};
const photoStatus = (s) => PHOTO_STATUS[s] || { label: s ? titleCase(s) : 'Not started', tone: 'neutral' };

export function PhotoVerificationModal({ listing, open, onClose }) {
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
    try { await navigator.clipboard.writeText(session.link); toast.success('Link copied'); } catch { toast.error('Copy failed; select the link and copy it'); }
  };
  const msg = session ? `Please open this link on a phone at the property to take live photos for verification: ${session.link}` : '';
  const d = status.data;
  const photo = d && d.photo;
  const ps = photoStatus(photo && photo.status);

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Photo verification" description={listing ? `${listing.listingNo || ''} · ${listing.title || ''}` : undefined}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      {status.isLoading ? <Skeleton className="h-32" /> : status.isError ? <Alert tone="danger">{status.error.message}</Alert> : d && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-subtle">Badge:</span><Badge tone={ps.tone}>{ps.label}</Badge>
            {photo && photo.status === 'verified' && photo.expiresAt && <span className="text-ink-subtle">until {date(photo.expiresAt)}</span>}
          </div>
          <p className="text-sm text-ink-muted">
            Someone at the property opens a link on a phone and takes at least {d.rules.minPhotos} live photos within {d.rules.maxDistanceM} m of the map pin.
            At most {d.rules.maxAttemptsPer30Days} attempts in 30 days. The badge lasts {d.rules.validDays} days.
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          {session ? (
            <div className="space-y-3 rounded-md border bg-surface-muted p-3">
              <p className="text-sm text-ink">Link for session {session.sessionNo}, valid until {dateTime(session.expiresAt)}:</p>
              <input readOnly value={session.link} onFocus={(e) => e.target.select()} className="block h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm text-ink" aria-label="Verification link" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>Copy link</Button>
                <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')}>WhatsApp</Button>
                <Button size="sm" variant="secondary" icon={Send} onClick={() => { window.location.href = `sms:?&body=${encodeURIComponent(msg)}`; }}>SMS</Button>
              </div>
            </div>
          ) : (
            <Button icon={Camera} loading={start.isPending} onClick={begin}>Start verification</Button>
          )}
          {d.attempts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Attempts</h3>
              <ul className="divide-y rounded-md border text-sm">
                {d.attempts.map((a) => {
                  const s = photoStatus(a.status);
                  return (
                    <li key={a.sessionNo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="text-ink">{a.sessionNo} · {dateTime(a.createdAt)} · {a.photos} photo{a.photos === 1 ? '' : 's'}</span>
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
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const req = useMutation({ mutationFn: () => api.post(`/lister/properties/${listing._id}/verification/site-request`, note.trim() ? { note: note.trim() } : {}) });
  const send = async () => {
    setError('');
    try {
      const r = await req.mutateAsync();
      toast.success(`Site visit requested (${r.visitNo}). Our team will schedule it.`);
      setNote('');
      onClose();
    } catch (e) { setError(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Request a site verification visit" description="Our field team visits the property to award the Site verified badge."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={req.isPending} onClick={send}>Send request</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="danger" title="Request not sent">{error}</Alert>}
        <Textarea label="Note for our team (optional)" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint="e.g. Best on weekday mornings" />
      </div>
    </Modal>
  );
}
