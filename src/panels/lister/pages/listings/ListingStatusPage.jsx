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
import { useT } from '@/shared/i18n';

const MAX_RESUBMISSIONS = 5; // listing.maxResubmissions
// Reason and badge labels: dictionary keys under lister.listingStatus.
const PAUSE_REASONS = ['lister', 'no_reply', 'admin_review'];
const INACTIVE_REASONS = ['sold_outside', 'rented_outside', 'no_longer_available', 'agreement_terminated', 'other'];
const BADGE_STATUS = {
  verified: 'success', pending: 'info', scheduled: 'info', rejected: 'danger', not_verified: 'danger', expired: 'neutral', none: 'neutral',
};
const EDITABLE_VIEW = ['draft', 'changes_requested', 'pending_approval', 'live', 'paused'];
const daysLeft = (d) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);

function TimelineItem({ h, last }) {
  const t = useT();
  const to = listingStatus(h.to);
  return (
    <li className="relative pl-6">
      {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-line" aria-hidden />}
      <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-brand-500 bg-white" aria-hidden />
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <Badge tone={to.tone}>{to.label}</Badge>
        {h.from && <span className="text-xs text-ink-subtle">{t('lister.listingStatus.from', { status: listingStatus(h.from).label.toLowerCase() })}</span>}
        <span className="text-xs text-ink-subtle">{dateTime(h.at)}</span>
        {h.note && <p className="w-full text-sm text-ink-muted">{h.note}</p>}
      </div>
    </li>
  );
}

function VerificationRow({ icon: Icon, label, v }) {
  const t = useT();
  const code = (v && v.status) || 'none';
  const [text, tone] = BADGE_STATUS[code] ? [t(`lister.listingStatus.badge.${code}`), BADGE_STATUS[code]] : [titleCase(v && v.status), 'neutral'];
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="inline-flex items-center gap-2 text-ink"><Icon className="h-4 w-4 text-brand-600" aria-hidden />{label}</span>
      <span className="flex items-center gap-2">
        <Badge tone={tone}>{text}</Badge>
        {v && v.verifiedAt && <span className="text-xs text-ink-subtle">{date(v.verifiedAt)}{v.expiresAt ? ` · ${t('lister.listingStatus.until', { date: date(v.expiresAt) })}` : ''}</span>}
      </span>
    </li>
  );
}

function Row({ label, children }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-subtle">{label}</dt><dd className="text-right font-medium text-ink">{children}</dd></div>;
}

export default function ListingStatusPage() {
  const t = useT();
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
  const resubmit = async () => { try { await submit.mutateAsync(); toast.success(t('lister.listingStatus.sentForReview')); } catch (e) { toast.error(e.message); } };
  const openDeactivate = () => { setForm({ reason: l.purpose === 'rent' ? 'rented_outside' : 'sold_outside' }); setDialog('deactivate'); };

  const left = daysLeft(l.expiresAt);
  const canRenew = (l.status === 'live' && left !== null && left <= 15) || l.status === 'expired';
  const history = [...(l.statusHistory || [])].reverse();
  const price = priceOf(l);
  const r = l.rera || {};
  const revision = l.pendingRevision && l.pendingRevision.changes;
  const edit = <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/lister/listings/${id}/edit?step=${l.status === 'changes_requested' ? 8 : 1}`)}>{l.status === 'changes_requested' ? t('lister.listings.actions.fix') : t('lister.listings.actions.edit')}</Button>;

  return (
    <>
      <Link to="/lister/listings" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('panel.nav.listerListings')}</Link>
      <PageHeader title={l.title || t('lister.listings.untitled')} breadcrumb={l.listingNo}
        description={[[l.location?.locality, l.location?.city].filter(Boolean).join(', '), l.purpose === 'rent' ? t('lister.listings.forRent') : t('lister.listings.forSale'), price ? `${shortRupees(price)}${l.purpose === 'rent' ? t('lister.common.perMonth') : ''}` : null].filter(Boolean).join(' · ')}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {EDITABLE_VIEW.includes(l.status) && edit}
          {['live', 'paused', 'expired', 'inactive', 'sold', 'rented'].includes(l.status) && <Button variant="ghost" icon={BarChart3} onClick={() => navigate(`/lister/listings/${id}/stats`)}>{t('lister.listings.actions.stats')}</Button>}
          {l.status === 'live' && l.slug && <a href={`/property/${l.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">{t('lister.listingStatus.publicPage')} <ExternalLink className="h-3.5 w-3.5" /></a>}
        </>} />

      {l.project && (
        <p className="-mt-3 mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted"><Building2 className="h-4 w-4 text-brand-600" aria-hidden />
          {t('lister.listingStatus.partOf', { name: l.project.name })}{l.project.config ? ` · ${l.project.config.name}` : ''}
          <Link to={`/lister/projects/${l.project._id}`} className="ml-1 font-medium text-brand-700 hover:underline">{t('lister.listingStatus.openProject')}</Link>
        </p>
      )}

      <div className="mb-6 space-y-3">
        {l.status === 'paused' && (
          <Alert tone="warning" title={t('lister.listingStatus.hiddenSince', { date: date(l.pause && l.pause.pausedAt) })}
            action={!(l.pause && l.pause.reason === 'admin_review') ? <Button size="sm" icon={Play} loading={action.isPending} onClick={() => run('resume', {}, t('lister.listings.done.resumed'))}>{t('lister.listings.actions.resume')}</Button> : null}>
            {(l.pause && (l.pause.note || (PAUSE_REASONS.includes(l.pause.reason) ? t(`lister.listingStatus.pause.${l.pause.reason}`) : ''))) || t('lister.status.paused')}. {l.pause && l.pause.reason === 'admin_review' ? t('lister.listingStatus.resumeByTeam') : t('lister.listingStatus.resumeToLive')}
          </Alert>
        )}
        {l.status === 'rejected' && <Alert tone="danger" title={t('lister.listingStatus.badge.rejected')}>{l.rejectionReason || t('lister.listingStatus.rejected')} {t('lister.listingStatus.rejectedNote')}</Alert>}
        {l.status === 'suspended' && <Alert tone="danger" title={t('lister.status.suspended')}>{t('lister.listingStatus.suspended')}</Alert>}
        {l.status === 'inactive' && <Alert tone="info" title={t('lister.listingStatus.offMarket')}>{INACTIVE_REASONS.includes(l.inactiveReason) ? t(`lister.listingStatus.inactive.${l.inactiveReason}`) : t('lister.status.inactive')}{l.soldOutsideDate ? ` ${t('lister.listingStatus.onDate', { date: date(l.soldOutsideDate) })}` : ''}.</Alert>}
        {l.status === 'pending_approval' && <Alert tone="info" title={t('lister.listings.tabs.review')}>{t('lister.listingStatus.inReview', { date: dateTime(l.submittedAt) })}</Alert>}
        {revision && <Alert tone="info" title={l.pendingRevision.submittedAt ? t('lister.listings.changesInReview') : t('lister.listingStatus.unsubmitted')}>
          {l.pendingRevision.submittedAt ? t('lister.listingStatus.revisionSent', { date: dateTime(l.pendingRevision.submittedAt) }) : t('lister.listingStatus.revisionDraft')}
          {!l.pendingRevision.submittedAt && <Button size="sm" className="ml-2" icon={Send} loading={submit.isPending} onClick={resubmit}>{t('lister.listingStatus.sendForReview')}</Button>}
        </Alert>}
        {l.openCheck && (
          <Alert tone="warning" title={t('lister.listingStatus.checkTitle')}
            action={<div className="flex flex-wrap gap-2">
              <Button size="sm" icon={CheckCircle2} loading={action.isPending} onClick={() => run('check', { answer: 'available' }, t('lister.listingStatus.checkConfirmed'))}>{t('lister.listingStatus.checkYes')}</Button>
              <Button size="sm" variant="secondary" icon={Pause} onClick={() => { setForm({}); setDialog('pause'); }}>{t('lister.listings.actions.pause')}</Button>
              <Button size="sm" variant="ghost" onClick={openDeactivate}>{t('lister.listingStatus.checkSold')}</Button>
            </div>}>
            {t('lister.listingStatus.checkText', { date: date(l.openCheck.dueBy) })}
          </Alert>
        )}
        {(l.warnings || []).includes('rera_expired') && <Alert tone="warning">{t('lister.listingStatus.reraExpired')}</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {l.status === 'changes_requested' && (
            <Card>
              <CardHeader title={t('lister.listingStatus.changesTitle')} description={t('lister.kyc.panel.resubmissions', { n: l.resubmissionCount || 0, max: MAX_RESUBMISSIONS })}
                action={<Button size="sm" icon={Send} loading={submit.isPending} disabled={(l.resubmissionCount || 0) >= MAX_RESUBMISSIONS} onClick={resubmit}>{t('lister.listingStatus.resubmit')}</Button>} />
              {(l.reviewComments || []).length ? (
                <ul className="divide-y">{l.reviewComments.map((c, i) => (
                  <li key={i} className="flex gap-3 py-2 text-sm"><MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden />
                    <span><span className="font-medium text-ink">{c.field ? titleCase(c.field) : t('lister.listingStatus.general')}</span><span className="block text-ink-muted">{c.comment}</span><span className="text-xs text-ink-subtle">{dateTime(c.at)}</span></span>
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-ink-subtle">{t('lister.listingStatus.noComments')}</p>}
            </Card>
          )}

          <Card>
            <CardHeader title={t('lister.listingStatus.history')} />
            {history.length ? <ol>{history.map((h, i) => <TimelineItem key={`${h.at}-${i}`} h={h} last={i === history.length - 1} />)}</ol>
              : <EmptyState icon={Clock} title={t('lister.listingStatus.notSubmitted')} description={t('lister.listingStatus.notSubmittedDesc')} />}
            <p className="mt-1 text-xs text-ink-subtle">{t('lister.listingStatus.created', { date: dateTime(l.createdAt) })}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('lister.listingStatus.dates')} />
            <dl>
              {l.submittedAt && <Row label={t('lister.listingStatus.submitted')}>{date(l.submittedAt)}</Row>}
              <Row label={t('lister.listingStatus.liveFrom')}>{date(l.liveAt)}</Row>
              <Row label={t('lister.listingStatus.expiresOn')}>{l.expiresAt ? `${date(l.expiresAt)}${left !== null && left >= 0 && ['live', 'paused'].includes(l.status) ? ` (${t('lister.listingStatus.days', { n: left })})` : ''}` : '-'}</Row>
              {l.availability?.lastConfirmedAt && <Row label={t('lister.listingStatus.availabilityConfirmed')}>{date(l.availability.lastConfirmedAt)}</Row>}
              {(l.revisionNo || 0) > 0 && <Row label={t('lister.listingStatus.revisions')}>{l.revisionNo}</Row>}
            </dl>
            {canRenew && <Button className="mt-3 w-full" icon={RotateCcw} loading={action.isPending} onClick={() => run('renew', {}, t('lister.listings.done.renew'))}>{t('lister.listings.actions.renew')}</Button>}
            {l.status === 'live' && !canRenew && <p className="mt-2 text-xs text-ink-subtle">{t('lister.listingStatus.renewOpens')}</p>}
          </Card>

          <Card>
            <CardHeader title={t('lister.listingStatus.verification')} action={['live', 'pending_approval', 'paused'].includes(l.status) ? <Button size="sm" variant="secondary" icon={Camera} onClick={() => setDialog('photo')}>{t('lister.listings.actions.photo')}</Button> : null} />
            <ul className="divide-y">
              <VerificationRow icon={Camera} label={t('lister.common.photoVerified')} v={l.verification && l.verification.photo} />
              <VerificationRow icon={BadgeCheck} label={t('lister.common.siteVerified')} v={l.verification && l.verification.site} />
            </ul>
          </Card>

          {builder && (
            <Card>
              <CardHeader title="RERA" description={r.inheritedFromProject ? t('lister.listingStatus.fromProject') : undefined} />
              {(r.numbers || []).length ? <p className="text-sm text-ink"><ShieldCheck className="mr-1 inline h-4 w-4 text-success-600" aria-hidden />{r.numbers.join(', ')}{r.state ? ` (${r.state})` : ''}</p>
                : r.exempt && r.exempt.reason ? <p className="text-sm text-ink">{t('lister.listingStatus.exempt', { reason: titleCase(r.exempt.reason) })}</p>
                  : <p className="text-sm text-warning-700">{t('lister.listingStatus.reraMissing')}</p>}
            </Card>
          )}

          <Card>
            <CardHeader title={t('lister.listingStatus.agreement')} />
            {l.commission && l.commission.percent ? (
              <dl>
                <Row label={t('lister.wizard.steps.commission')}>{l.commission.percent}%</Row>
                <Row label={t('lister.agreements.status.accepted')}>{date(l.commission.acceptedAt)}</Row>
              </dl>
            ) : <p className="text-sm text-ink-subtle">{t('lister.listingStatus.notAccepted')}</p>}
            <Link to="/lister/agreements" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><FileText className="h-4 w-4" /> {t('lister.listingStatus.allAgreements')}</Link>
          </Card>

          {(l.warnings || []).length > 0 && (
            <Card>
              <CardHeader title={t('lister.listingStatus.checks')} />
              <ul className="list-disc pl-4 text-sm text-ink-muted">{l.warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || titleCase(w)}</li>)}</ul>
            </Card>
          )}

          <Card>
            <CardHeader title={t('lister.listingStatus.actions')} />
            <div className="flex flex-col gap-2">
              {l.status === 'pending_approval' && <Button variant="secondary" icon={Undo2} loading={action.isPending} onClick={() => run('withdraw', {}, t('lister.listings.done.withdraw'))}>{t('lister.listings.actions.withdraw')}</Button>}
              {l.status === 'live' && <Button variant="secondary" icon={Pause} onClick={() => { setForm({}); setDialog('pause'); }}>{t('lister.listings.actions.pause')}</Button>}
              {['live', 'paused'].includes(l.status) && <Button variant="secondary" icon={XCircle} onClick={openDeactivate}>{t('lister.listings.actions.deactivate')}</Button>}
              {l.status === 'inactive' && <Button variant="secondary" icon={RotateCcw} loading={action.isPending} onClick={() => run('reactivate', {}, t('lister.listings.done.reactivate'))}>{t('lister.listings.actions.reactivate')}</Button>}
              {['rejected', 'sold', 'rented'].includes(l.status) && <Button variant="secondary" onClick={async () => { const c = await run('duplicate', {}, t('lister.listings.done.duplicate')); if (c && c._id) navigate(`/lister/listings/${c._id}/edit?step=1`); }}>{t('lister.listingStatus.newFromThis')}</Button>}
              {l.expiresAt && l.status === 'live' && <p className="inline-flex items-center gap-1 text-xs text-ink-subtle"><CalendarClock className="h-3.5 w-3.5" /> {t('lister.listingStatus.soldNote')}</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={dialog === 'pause'} onClose={() => setDialog(null)} title={t('lister.listings.pauseTitle')} size="sm" description={t('lister.listings.pauseDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button loading={action.isPending} disabled={!form.reason || form.reason.length < 3}
          onClick={() => (l.openCheck ? run('check', { answer: 'pause', reason: form.reason }, t('lister.listings.done.pause')) : run('pause', { reason: form.reason }, t('lister.listings.done.pause')))}>{t('lister.listings.actions.pause')}</Button></>}>
        <Input label={t('lister.listings.reason')} placeholder={t('lister.listingStatus.pausePh')} value={form.reason || ''} onChange={(e) => setForm({ reason: e.target.value })} />
      </Modal>

      <Modal open={dialog === 'deactivate'} onClose={() => setDialog(null)} title={t('lister.listings.actions.deactivate')} description={t('lister.listingStatus.deactivateDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={action.isPending}
          onClick={() => (l.openCheck && ['sold_outside', 'rented_outside'].includes(form.reason)
            ? run('check', { answer: 'sold_elsewhere', ...(form.saleDate ? { saleDate: form.saleDate } : {}), ...(form.price ? { price: Number(form.price) } : {}) }, t('lister.listingStatus.saleNoted'))
            : run('deactivate', { reason: form.reason, ...(form.note ? { note: form.note } : {}), ...(form.saleDate ? { saleDate: form.saleDate } : {}), ...(form.price ? { price: Number(form.price) } : {}) }, t('lister.listings.done.deactivate')))}>{t('lister.listings.actions.deactivate')}</Button></>}>
        <div className="space-y-4">
          <Select label={t('lister.listings.reason')} value={form.reason || ''} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            options={['sold_outside', 'rented_outside', 'no_longer_available', 'other'].map((value) => ({ value, label: t(`lister.listings.offReasons.${value}`) }))} />
          {['sold_outside', 'rented_outside'].includes(form.reason) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={form.reason === 'rented_outside' ? t('lister.listings.moveIn') : t('lister.listings.saleDate')} type="date" required value={form.saleDate || ''} onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))} />
              <Input label={t('lister.listings.priceOptional')} leading="₹" type="number" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
          )}
          <Textarea label={t('lister.listings.note')} rows={2} value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
      </Modal>

      {dialog === 'photo' && <PhotoVerificationModal open listing={l} onClose={() => setDialog(null)} />}
    </>
  );
}
