// RE-S-LIS-08 listing status and history (/lister/listings/:id): status
// badge and timeline (statusHistory), admin review comments, live / expiry
// dates and renewal, verification badges, RERA, agreement, project link
// (RE-G-07), pending revision and the lifecycle actions. Notification links
// /lister/listings/:id open this page.
// API: GET /lister/properties/:id and the action endpoints in modules/listings/api.js.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, BarChart3, Building2, CalendarClock, Camera, CheckCircle2, Clock, ExternalLink, FileText, MessageSquareWarning, Pause, Pencil, Play, RotateCcw, Send, ShieldCheck, Undo2, XCircle,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, shortRupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { listingStatus, priceOf, useListing, useListingAction, useSubmitListing, WARNING_LABELS } from '@/modules/listings/api';
import { PhotoVerificationModal } from '../../components/VerificationModal';

const MAX_RESUBMISSIONS = 5; // listing.maxResubmissions
const PAUSE_REASONS = { lister: 'Paused by you', no_reply: 'No reply to the availability check', admin_review: 'Paused by our team for review' };
const INACTIVE_REASONS = { sold_outside: 'Sold outside the platform', rented_outside: 'Rented outside the platform', no_longer_available: 'No longer available', agreement_terminated: 'Agreement terminated', other: 'Taken off market' };
const BADGE_STATUS = {
  verified: ['Verified', 'success'], pending: ['Pending review', 'info'], scheduled: ['Visit scheduled', 'info'], rejected: ['Not approved', 'danger'],
  not_verified: ['Not verified', 'danger'], expired: ['Expired', 'neutral'], none: ['Not started', 'neutral'],
};
const EDITABLE_VIEW = ['draft', 'changes_requested', 'pending_approval', 'live', 'paused'];
const daysLeft = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);

function TimelineItem({ h, last }) {
  const to = listingStatus(h.to);
  return (
    <li className="relative pl-6">
      {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-line" aria-hidden />}
      <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-brand-500 bg-white" aria-hidden />
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <Badge tone={to.tone}>{to.label}</Badge>
        {h.from && <span className="text-xs text-ink-subtle">from {listingStatus(h.from).label.toLowerCase()}</span>}
        <span className="text-xs text-ink-subtle">{dateTime(h.at)}</span>
        {h.note && <p className="w-full text-sm text-ink-muted">{h.note}</p>}
      </div>
    </li>
  );
}

function VerificationRow({ icon: Icon, label, v }) {
  const [text, tone] = BADGE_STATUS[(v && v.status) || 'none'] || [titleCase(v && v.status), 'neutral'];
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="inline-flex items-center gap-2 text-ink"><Icon className="h-4 w-4 text-brand-600" aria-hidden />{label}</span>
      <span className="flex items-center gap-2">
        <Badge tone={tone}>{text}</Badge>
        {v && v.verifiedAt && <span className="text-xs text-ink-subtle">{date(v.verifiedAt)}{v.expiresAt ? ` · until ${date(v.expiresAt)}` : ''}</span>}
      </span>
    </li>
  );
}

function Row({ label, children }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-subtle">{label}</dt><dd className="text-right font-medium text-ink">{children}</dd></div>;
}

export default function ListingStatusPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const builder = user.listerType === 'builder';
  const { data: l, isLoading, error } = useListing(id);
  const action = useListingAction();
  const submit = useSubmitListing(id);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const s = listingStatus(l.status);
  const run = async (act, body, msg) => {
    try { const r = await action.mutateAsync({ id, action: act, body }); toast.success(msg); setDialog(null); return r; } catch (e) { toast.error(e.message); return null; }
  };
  const resubmit = async () => { try { await submit.mutateAsync(); toast.success('Sent for review'); } catch (e) { toast.error(e.message); } };
  const openDeactivate = () => { setForm({ reason: l.purpose === 'rent' ? 'rented_outside' : 'sold_outside' }); setDialog('deactivate'); };

  const left = daysLeft(l.expiresAt);
  const canRenew = (l.status === 'live' && left !== null && left <= 15) || l.status === 'expired';
  const history = [...(l.statusHistory || [])].reverse();
  const price = priceOf(l);
  const r = l.rera || {};
  const revision = l.pendingRevision && l.pendingRevision.changes;
  const edit = <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/lister/listings/${id}/edit?step=${l.status === 'changes_requested' ? 8 : 1}`)}>{l.status === 'changes_requested' ? 'Fix and resubmit' : 'Edit'}</Button>;

  return (
    <>
      <Link to="/lister/listings" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> My listings</Link>
      <PageHeader title={l.title || 'Untitled draft'} breadcrumb={l.listingNo}
        description={[[l.location?.locality, l.location?.city].filter(Boolean).join(', '), l.purpose === 'rent' ? 'For rent' : 'For sale', price ? `${shortRupees(price)}${l.purpose === 'rent' ? '/mo' : ''}` : null].filter(Boolean).join(' · ')}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {EDITABLE_VIEW.includes(l.status) && edit}
          {['live', 'paused', 'expired', 'inactive', 'sold', 'rented'].includes(l.status) && <Button variant="ghost" icon={BarChart3} onClick={() => navigate(`/lister/listings/${id}/stats`)}>Stats</Button>}
          {l.status === 'live' && l.slug && <a href={`/property/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">Public page <ExternalLink className="h-3.5 w-3.5" /></a>}
        </>} />

      {l.project && (
        <p className="-mt-3 mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted"><Building2 className="h-4 w-4 text-brand-600" aria-hidden />
          Part of {l.project.name}{l.project.config ? ` · ${l.project.config.name}` : ''}
          <Link to={`/lister/projects/${l.project._id}`} className="ml-1 font-medium text-brand-700 hover:underline">Open project</Link>
        </p>
      )}

      <div className="mb-6 space-y-3">
        {l.status === 'paused' && (
          <Alert tone="warning" title={`Hidden from search since ${date(l.pause && l.pause.pausedAt)}`}
            action={!(l.pause && l.pause.reason === 'admin_review') ? <Button size="sm" icon={Play} loading={action.isPending} onClick={() => run('resume', {}, 'Listing resumed')}>Resume</Button> : null}>
            {(l.pause && (l.pause.note || PAUSE_REASONS[l.pause.reason])) || 'Paused'}. {l.pause && l.pause.reason === 'admin_review' ? 'Our team will resume it after the review.' : 'Resume to go live again.'}
          </Alert>
        )}
        {l.status === 'rejected' && <Alert tone="danger" title="Not approved">{l.rejectionReason || 'This listing was rejected.'} A rejected listing cannot be resubmitted; create a new listing instead.</Alert>}
        {l.status === 'suspended' && <Alert tone="danger" title="Suspended">Your account or this listing is suspended. Contact support.</Alert>}
        {l.status === 'inactive' && <Alert tone="info" title="Off the market">{INACTIVE_REASONS[l.inactiveReason] || 'Inactive'}{l.soldOutsideDate ? ` on ${date(l.soldOutsideDate)}` : ''}.</Alert>}
        {l.status === 'pending_approval' && <Alert tone="info" title="In review">Submitted on {dateTime(l.submittedAt)}. You will be notified when our team decides.</Alert>}
        {revision && <Alert tone="info" title={l.pendingRevision.submittedAt ? 'Changes in review' : 'Unsubmitted changes'}>
          {l.pendingRevision.submittedAt ? `Sent on ${dateTime(l.pendingRevision.submittedAt)}. Buyers see the current version until they are approved.` : 'You have edits that are not sent for review yet.'}
          {!l.pendingRevision.submittedAt && <Button size="sm" className="ml-2" icon={Send} loading={submit.isPending} onClick={resubmit}>Send for review</Button>}
        </Alert>}
        {l.openCheck && (
          <Alert tone="warning" title="Is this property still available?"
            action={<div className="flex flex-wrap gap-2">
              <Button size="sm" icon={CheckCircle2} loading={action.isPending} onClick={() => run('check', { answer: 'available' }, 'Thanks, availability confirmed')}>Yes, available</Button>
              <Button size="sm" variant="secondary" icon={Pause} onClick={() => { setForm({}); setDialog('pause'); }}>Pause</Button>
              <Button size="sm" variant="ghost" onClick={openDeactivate}>Sold / rented elsewhere</Button>
            </div>}>
            Please reply by {date(l.openCheck.dueBy)} or the listing is paused automatically.
          </Alert>
        )}
        {(l.warnings || []).includes('rera_expired') && <Alert tone="warning">The project RERA registration validity has passed. Upload the extension on the project.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {l.status === 'changes_requested' && (
            <Card>
              <CardHeader title="Changes requested by our team" description={`Resubmissions used: ${l.resubmissionCount || 0} of ${MAX_RESUBMISSIONS}`}
                action={<Button size="sm" icon={Send} loading={submit.isPending} disabled={(l.resubmissionCount || 0) >= MAX_RESUBMISSIONS} onClick={resubmit}>Resubmit</Button>} />
              {(l.reviewComments || []).length ? (
                <ul className="divide-y">{l.reviewComments.map((c, i) => (
                  <li key={i} className="flex gap-3 py-2 text-sm"><MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden />
                    <span><span className="font-medium text-ink">{titleCase(c.field || 'General')}</span><span className="block text-ink-muted">{c.comment}</span><span className="text-xs text-ink-subtle">{dateTime(c.at)}</span></span>
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-ink-subtle">No field comments.</p>}
            </Card>
          )}

          <Card>
            <CardHeader title="Status history" />
            {history.length ? <ol>{history.map((h, i) => <TimelineItem key={`${h.at}-${i}`} h={h} last={i === history.length - 1} />)}</ol>
              : <EmptyState icon={Clock} title="Not submitted yet" description="The timeline starts when you submit the listing for review." />}
            <p className="mt-1 text-xs text-ink-subtle">Created {dateTime(l.createdAt)}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Dates" />
            <dl>
              {l.submittedAt && <Row label="Submitted">{date(l.submittedAt)}</Row>}
              <Row label="Live from">{date(l.liveAt)}</Row>
              <Row label="Expires on">{l.expiresAt ? `${date(l.expiresAt)}${left !== null && left >= 0 && ['live', 'paused'].includes(l.status) ? ` (${left} days)` : ''}` : '-'}</Row>
              {l.availability?.lastConfirmedAt && <Row label="Availability confirmed">{date(l.availability.lastConfirmedAt)}</Row>}
              {(l.revisionNo || 0) > 0 && <Row label="Approved revisions">{l.revisionNo}</Row>}
            </dl>
            {canRenew && <Button className="mt-3 w-full" icon={RotateCcw} loading={action.isPending} onClick={() => run('renew', {}, 'Listing renewed')}>Renew</Button>}
            {l.status === 'live' && !canRenew && <p className="mt-2 text-xs text-ink-subtle">Renewal opens 15 days before expiry.</p>}
          </Card>

          <Card>
            <CardHeader title="Verification" action={['live', 'pending_approval', 'paused'].includes(l.status) ? <Button size="sm" variant="secondary" icon={Camera} onClick={() => setDialog('photo')}>Photo verification</Button> : null} />
            <ul className="divide-y">
              <VerificationRow icon={Camera} label="Photo verified" v={l.verification && l.verification.photo} />
              <VerificationRow icon={BadgeCheck} label="Site verified" v={l.verification && l.verification.site} />
            </ul>
          </Card>

          {builder && (
            <Card>
              <CardHeader title="RERA" description={r.inheritedFromProject ? 'From the linked project' : undefined} />
              {(r.numbers || []).length ? <p className="text-sm text-ink"><ShieldCheck className="mr-1 inline h-4 w-4 text-success-600" aria-hidden />{r.numbers.join(', ')}{r.state ? ` (${r.state})` : ''}</p>
                : r.exempt && r.exempt.reason ? <p className="text-sm text-ink">Exempt: {titleCase(r.exempt.reason)}</p>
                  : <p className="text-sm text-warning-700">RERA details missing</p>}
            </Card>
          )}

          <Card>
            <CardHeader title="Agreement" />
            {l.commission && l.commission.percent ? (
              <dl>
                <Row label="Commission">{l.commission.percent}%</Row>
                <Row label="Accepted">{date(l.commission.acceptedAt)}</Row>
              </dl>
            ) : <p className="text-sm text-ink-subtle">Not accepted yet (step 7).</p>}
            <Link to="/lister/agreements" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><FileText className="h-4 w-4" /> All agreements</Link>
          </Card>

          {(l.warnings || []).length > 0 && (
            <Card>
              <CardHeader title="Checks for the reviewer" />
              <ul className="list-disc pl-4 text-sm text-ink-muted">{l.warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || titleCase(w)}</li>)}</ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-col gap-2">
              {l.status === 'pending_approval' && <Button variant="secondary" icon={Undo2} loading={action.isPending} onClick={() => run('withdraw', {}, 'Withdrawn from review')}>Withdraw from review</Button>}
              {l.status === 'live' && <Button variant="secondary" icon={Pause} onClick={() => { setForm({}); setDialog('pause'); }}>Pause</Button>}
              {['live', 'paused'].includes(l.status) && <Button variant="secondary" icon={XCircle} onClick={openDeactivate}>Take off market</Button>}
              {l.status === 'inactive' && <Button variant="secondary" icon={RotateCcw} loading={action.isPending} onClick={() => run('reactivate', {}, 'Sent back to review')}>Send back to review</Button>}
              {['rejected', 'sold', 'rented'].includes(l.status) && <Button variant="secondary" onClick={async () => { const c = await run('duplicate', {}, 'Copied to a new draft'); if (c && c._id) navigate(`/lister/listings/${c._id}/edit?step=1`); }}>Create a new listing from this</Button>}
              {l.expiresAt && l.status === 'live' && <p className="inline-flex items-center gap-1 text-xs text-ink-subtle"><CalendarClock className="h-3.5 w-3.5" /> Sold and rented are set when a deal is verified.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={dialog === 'pause'} onClose={() => setDialog(null)} title="Pause listing" size="sm" description="Paused listings are hidden from buyers. Resume any time."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button loading={action.isPending} disabled={!form.reason || form.reason.length < 3}
          onClick={() => (l.openCheck ? run('check', { answer: 'pause', reason: form.reason }, 'Listing paused') : run('pause', { reason: form.reason }, 'Listing paused'))}>Pause</Button></>}>
        <Input label="Reason" placeholder="e.g. Under renovation" value={form.reason || ''} onChange={(e) => setForm({ reason: e.target.value })} />
      </Modal>

      <Modal open={dialog === 'deactivate'} onClose={() => setDialog(null)} title="Take off market" description="If it was sold or rented, our team follows up on the commission agreement."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" loading={action.isPending}
          onClick={() => (l.openCheck && ['sold_outside', 'rented_outside'].includes(form.reason)
            ? run('check', { answer: 'sold_elsewhere', ...(form.saleDate ? { saleDate: form.saleDate } : {}), ...(form.price ? { price: Number(form.price) } : {}) }, 'Thanks, we noted the sale')
            : run('deactivate', { reason: form.reason, ...(form.note ? { note: form.note } : {}), ...(form.saleDate ? { saleDate: form.saleDate } : {}), ...(form.price ? { price: Number(form.price) } : {}) }, 'Listing taken off the market'))}>Take off market</Button></>}>
        <div className="space-y-4">
          <Select label="Reason" value={form.reason || ''} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            options={[{ value: 'sold_outside', label: 'Sold outside the platform' }, { value: 'rented_outside', label: 'Rented outside the platform' }, { value: 'no_longer_available', label: 'No longer available' }, { value: 'other', label: 'Other' }]} />
          {['sold_outside', 'rented_outside'].includes(form.reason) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={form.reason === 'rented_outside' ? 'Move-in date' : 'Sale date'} type="date" required value={form.saleDate || ''} onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))} />
              <Input label="Price (optional)" leading="₹" type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
          )}
          <Textarea label="Note" rows={2} value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
      </Modal>

      {dialog === 'photo' && <PhotoVerificationModal open listing={l} onClose={() => setDialog(null)} />}
    </>
  );
}
