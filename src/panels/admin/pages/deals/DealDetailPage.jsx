// RE-S-ADM-19 deal verification detail: deal data, documents through signed
// links (viewer with zoom), recomputed commission vs submitted, duplicate
// receipt / price deviation / cash 269ST checks, visits and lead timeline, the
// checklist and the decision (verify / return / reject); reversal of verified deals.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, FileText, Lock, LockOpen, RotateCcw, ShieldCheck, Undo2, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, ConfirmModal, Input, Modal, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { DEAL_CHECKLIST, PAYMENT_MODES, REJECT_REASONS, dealDocumentUrl, rejectReasonLabel, dealStatus, useClaimDeal, useDeal, useDecideDeal, useReleaseDeal, useReverseDeal } from '@/modules/deals/adminApi';

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-ink-subtle">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children || children === 0 ? children : '-'}</dd>
    </div>
  );
}

function DocViewer({ doc, onClose }) {
  const t = useT();
  const [zoom, setZoom] = useState(1);
  if (!doc) return null;
  const isImage = /^image\//.test(doc.mime || '');
  const isPdf = doc.mime === 'application/pdf';
  return (
    <Modal open onClose={onClose} size="lg" title={doc.label || titleCase(doc.kind)} description={t('admin.deals.detail.viewer.description')}
      footer={<>
        {isImage && <><Button variant="ghost" size="sm" icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>{t('admin.deals.detail.viewer.zoomOut')}</Button><Button variant="ghost" size="sm" icon={ZoomIn} onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>{t('admin.deals.detail.viewer.zoomIn')}</Button></>}
        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => window.open(doc.url, '_blank', 'noopener')}>{t('admin.deals.detail.viewer.openNewTab')}</Button>
      </>}>
      {isImage ? (
        <div className="max-h-[60vh] overflow-auto rounded border bg-surface-sunken">
          <img src={doc.url} alt={doc.label || ''} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} className="block" />
        </div>
      ) : isPdf ? (
        <iframe title={doc.label || t('admin.deals.detail.viewer.document')} src={doc.url} className="h-[60vh] w-full rounded border" />
      ) : <p className="text-sm text-ink-muted">{t('admin.deals.detail.viewer.noPreview')}</p>}
    </Modal>
  );
}

const OID = /^[a-f0-9]{24}$/;
// Assignment entries store the agent id in `to`; show the name we know, never the raw id.
const timelineText = (ev, names, t) => {
  const d = ev.data || {};
  const to = d.to && OID.test(String(d.to)) ? names[String(d.to)] || t('admin.deals.detail.timeline.anAgent') : d.to;
  const parts = [d.from && to ? `${titleCase(d.from)} → ${titleCase(to)}` : to ? (OID.test(String(d.to)) ? t('admin.deals.detail.timeline.toAgent', { name: to }) : titleCase(to)) : null, d.dealNo, d.status && titleCase(d.status), d.result && titleCase(d.result), d.outcome && titleCase(d.outcome), d.note || d.message || d.reason];
  return parts.filter(Boolean).join(' · ');
};

export default function DealDetailPage() {
  const t = useT();
  const { id } = useParams();
  const toast = useToast();
  const { user: me, hasPermission } = useAuth();
  const { data: d, isLoading, error } = useDeal(id);
  const claim = useClaimDeal(id);
  const release = useReleaseDeal(id);
  const decide = useDecideDeal(id);
  const reverse = useReverseDeal(id);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [checks, setChecks] = useState({});
  const agentNames = d && d.agent ? { [String(d.agent._id)]: d.agent.name } : {};
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOther, setRejectOther] = useState('');
  const [formError, setFormError] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [rev, setRev] = useState({ open: false, reason: '', effectiveDate: '', leadOutcome: 'negotiation', lostReason: '' });
  const [effects, setEffects] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const s = dealStatus(d.status);
  const canVerify = hasPermission('deals.verify');
  const claimActive = d.status === 'under_review' && d.review?.claimedBy && new Date(d.review.claimUntil) > new Date();
  const mine = claimActive && String(d.review.claimedBy) === String(me._id);
  const claimable = canVerify && ['submitted', 'under_review'].includes(d.status) && !(claimActive && !mine);
  const ck = d.checklist || {};
  const rc = d.recomputedCommission;
  const commissionMatch = rc && rc.commissionAmount === d.commissionAmount && rc.commissionPercent === d.commissionPercent;
  const allTicked = DEAL_CHECKLIST.every(([k]) => checks[k]);
  const lead = d.lead || {};
  const tg = d.target || {};
  const price = d.dealType === 'rent' ? d.monthlyRent : d.agreedPrice;

  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); } catch (e) { toast.error(e.message); } };
  const openDoc = async (doc) => { try { setViewer(await dealDocumentUrl(id, doc._id)); } catch (e) { toast.error(e.message); } };

  const submit = async (decision) => {
    setConfirmVerify(false);
    setFormError(null);
    const body = { decision, checklist: Object.fromEntries(DEAL_CHECKLIST.map(([k]) => [k, Boolean(checks[k])])) };
    if (note.trim()) body.note = note.trim();
    if (comment.trim()) body.comment = comment.trim();
    if (decision === 'reject') body.reason = rejectReason === 'Other' ? rejectOther.trim() : rejectReason;
    if (decision === 'verify') body.idempotencyKey = idempotencyKey;
    try {
      const r = await decide.mutateAsync(body);
      if (decision === 'verify') toast.success(`${t('admin.deals.detail.toast.verified')}${r.receivableNo ? t('admin.deals.detail.toast.receivableCreated', { no: r.receivableNo }) : ''}${r.outcome ? t('admin.deals.detail.toast.listingMarked', { outcome: r.outcome }) : ''}${t('admin.deals.detail.toast.verifiedEnd')}`, { duration: 8000 });
      else toast.success(decision === 'return' ? t('admin.deals.detail.toast.returned') : t('admin.deals.detail.toast.rejected'));
      setComment(''); setNote('');
    } catch (e) {
      const fe = e.fieldErrors || {};
      setFormError(Object.values(fe).join(' · ') || e.message);
    }
  };

  const doReverse = async () => {
    try {
      const r = await reverse.mutateAsync({
        reason: rev.reason.trim(), leadOutcome: rev.leadOutcome,
        ...(rev.effectiveDate ? { effectiveDate: rev.effectiveDate } : {}),
        ...(rev.leadOutcome === 'closed_lost' && rev.lostReason.trim() ? { lostReason: rev.lostReason.trim() } : {}),
      });
      setEffects(r.effects || []);
      setRev((x) => ({ ...x, open: false }));
      toast.success(t('admin.deals.detail.toast.reversed'));
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Link to="/admin/deals" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.deals.queue.title')}</Link>
      <PageHeader title={t('admin.deals.detail.title', { no: d.dealNo })} breadcrumb={`${titleCase(d.dealType)} · ${tg.ref || ''} ${tg.title || tg.name || ''}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {claimable && !mine && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), t('admin.deals.detail.toast.claimed'))}>{t('admin.deals.detail.claimToReview')}</Button>}
          {mine && <Button variant="secondary" icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), t('admin.deals.detail.toast.renewed'))}>{t('admin.deals.detail.renewLock')}</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), t('admin.deals.detail.toast.released'))}>{t('admin.deals.detail.release')}</Button>}
          {canVerify && d.status === 'verified' && <Button variant="danger" icon={RotateCcw} onClick={() => setRev((x) => ({ ...x, open: true }))}>{t('admin.deals.detail.reverse')}</Button>}
        </>} />

      {claimActive && !mine && <Alert tone="warning" className="mb-4">{t('admin.deals.detail.heldByOther', { date: dateTime(d.review.claimUntil) })}</Alert>}
      {mine && <Alert tone="info" className="mb-4">{t('admin.deals.detail.heldByMe', { date: dateTime(d.review.claimUntil) })}</Alert>}
      {effects && (
        <Alert tone="success" className="mb-4" title={t('admin.deals.detail.reversalApplied')}>
          {effects.length ? <ul className="list-disc pl-4">{effects.map((e) => <li key={e}>{e}</li>)}</ul> : t('admin.deals.detail.noSideEffects')}
        </Alert>
      )}
      {(ck.duplicateReceipts || []).length > 0 && <Alert tone="danger" className="mb-4" title={t('admin.deals.detail.duplicate.title')}>{t('admin.deals.detail.duplicate.body', { deals: ck.duplicateReceipts.join(', ') })}</Alert>}
      {ck.cashWarning && <Alert tone="warning" className="mb-4" title={t('admin.deals.detail.cash.title')}>{t('admin.deals.detail.cash.body')}</Alert>}
      {d.priceDeviationPercent != null && d.priceDeviationPercent > 0 && (
        <Alert tone={d.priceDeviationPercent > 30 ? 'warning' : 'info'} className="mb-4" title={t('admin.deals.detail.deviation.title', { n: d.priceDeviationPercent })}>
          {t('admin.deals.detail.deviation.body', { listed: rupees(d.listedPrice), agreed: rupees(price) })}{d.justification ? t('admin.deals.detail.deviation.justification', { text: d.justification }) : ''}
        </Alert>
      )}
      {!ck.completedVisit && <Alert tone="danger" className="mb-4">{t('admin.deals.detail.noVisit')}</Alert>}
      {d.status === 'reversed' && d.reversal && <Alert tone="danger" className="mb-4" title={t('admin.deals.detail.reversed')}>{d.reversal.reason} · {t('admin.deals.detail.reversedInfo', { date: date(d.reversal.effectiveDate), outcome: titleCase(d.reversal.leadOutcome) })}</Alert>}
      {d.status === 'returned' && d.review?.comment && <Alert tone="warning" className="mb-4" title={t('admin.deals.detail.returnedTitle')}>{d.review.comment}</Alert>}
      {d.status === 'rejected' && d.review?.rejectReason && <Alert tone="danger" className="mb-4" title={t('admin.deals.detail.rejectedTitle')}>{rejectReasonLabel(d.review.rejectReason)}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('admin.deals.detail.deal.title')} />
            <dl className="divide-y">
              <Row label={d.dealType === 'rent' ? t('admin.deals.detail.deal.monthlyRent') : t('admin.deals.detail.deal.agreedPrice')}>{rupees(price)}</Row>
              <Row label={t('admin.deals.detail.deal.listedPrice')}>{d.listedPrice ? rupees(d.listedPrice) : null}</Row>
              <Row label={t('admin.deals.detail.deal.bookingAmount')}>{rupees(d.bookingAmount)}</Row>
              <Row label={t('admin.deals.detail.deal.bookingDate')}>{date(d.bookingDate)}</Row>
              <Row label={t('admin.deals.detail.deal.payment')}>{[PAYMENT_MODES[d.paymentMode] || d.paymentMode, d.paymentReference].filter(Boolean).join(' · ')}</Row>
              <Row label={t('admin.deals.detail.deal.unit')}>{d.unitNo}</Row>
              <Row label={t('admin.deals.detail.deal.offer')}>{d.offer ? `${d.offer.offerNo} · ${titleCase(d.offer.status)}` : null}</Row>
              <Row label={t('admin.deals.detail.deal.notes')}><span className="whitespace-pre-line">{d.notes}</span></Row>
              <Row label={t('admin.deals.detail.deal.submitted')}>{d.submittedAt ? `${dateTime(d.submittedAt)}${d.resubmissionCount ? t('admin.deals.detail.deal.resubmission', { n: d.resubmissionCount }) : ''}` : null}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t('admin.deals.detail.commission.title')} description={t('admin.deals.detail.commission.description')}
              action={rc ? <Badge tone={commissionMatch ? 'success' : 'danger'} icon={commissionMatch ? CheckCircle2 : AlertTriangle}>{commissionMatch ? t('admin.deals.detail.commission.matches') : t('admin.deals.detail.commission.mismatch')}</Badge> : <Badge tone="danger">{t('admin.deals.detail.commission.noAgreement')}</Badge>} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-1 pr-4" /><th className="py-1 pr-4">{t('admin.deals.detail.commission.submitted')}</th><th className="py-1">{t('admin.deals.detail.commission.recomputed')}</th></tr></thead>
                <tbody className="divide-y">
                  <tr><td className="py-2 pr-4 text-ink-subtle">{t('admin.deals.detail.commission.percent')}</td><td className="py-2 pr-4">{d.commissionPercent != null ? `${d.commissionPercent}%` : '-'}</td><td className="py-2">{rc ? `${rc.commissionPercent}%` : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">{t('admin.deals.detail.commission.basis')}</td><td className="py-2 pr-4">{titleCase(d.commissionBasis)}</td><td className="py-2">{rc ? titleCase(rc.commissionBasis) : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">{t('admin.deals.detail.commission.commission')}</td><td className="py-2 pr-4 font-medium">{rupees(d.commissionAmount)}</td><td className="py-2 font-medium">{rc ? rupees(rc.commissionAmount) : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">GST</td><td className="py-2 pr-4">{rupees(d.gstAmount)}</td><td className="py-2">{rc ? `${rupees(rc.gstAmount)} (${rc.gst?.interState ? 'IGST' : 'CGST + SGST'} ${rc.gst?.percent}%)` : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">{t('admin.deals.detail.commission.agreement')}</td><td className="py-2 pr-4" /><td className="py-2">{rc ? rc.agreementNo || t('admin.deals.detail.commission.listingCommission') : '-'}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title={t('admin.deals.detail.docs.title', { n: (d.documents || []).length })} description={t('admin.deals.detail.docs.description', { receipts: ck.receipts || 0, agreements: ck.agreements || 0 })} />
            {(d.documents || []).length ? (
              <ul className="divide-y">
                {d.documents.map((doc) => (
                  <li key={doc._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-sm"><Badge tone={doc.kind === 'receipt' ? 'brand' : doc.kind === 'agreement' ? 'info' : 'neutral'}>{titleCase(doc.kind)}</Badge> <span className="ml-1 text-ink">{doc.label}</span>{doc.reference && <span className="text-xs text-ink-subtle"> · {t('admin.deals.detail.docs.ref', { ref: doc.reference })}</span>}<span className="block text-xs text-ink-subtle">{dateTime(doc.at)}</span></span>
                    <Button size="sm" variant="secondary" icon={FileText} onClick={() => openDoc(doc)}>{t('admin.deals.detail.docs.view')}</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-danger-700">{t('admin.deals.detail.docs.none')}</p>}
          </Card>

          <Card>
            <CardHeader title={t('admin.deals.detail.visits.title')} />
            {(d.visits || []).length ? (
              <ul className="divide-y text-sm">
                {d.visits.map((v) => (
                  <li key={v._id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-ink">{v.visitNo} · {dateTime(v.scheduledAt)}</span>
                    <span className="flex gap-2"><Badge tone={v.status === 'completed' ? 'success' : v.status === 'cancelled' || v.status === 'no_show' ? 'danger' : 'neutral'}>{titleCase(v.status)}</Badge>{v.outcome?.result && <Badge tone="info">{titleCase(v.outcome.result)}</Badge>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-subtle">{t('admin.deals.detail.visits.none')}</p>}
          </Card>

          <Card>
            <CardHeader title={t('admin.deals.detail.timeline.title')} description={`${lead.leadNo || ''} · ${titleCase(lead.stage)} · ${t('admin.deals.detail.timeline.enquiry', { date: date(lead.createdAt) })}${(lead.sources || []).length ? ` · ${lead.sources.map(titleCase).join(', ')}` : ''}`} />
            {(lead.timeline || []).length ? (
              <ol className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {[...lead.timeline].reverse().slice(0, 40).map((e, i) => (
                  <li key={i} className="flex justify-between gap-3"><span className="text-ink"><span className="font-medium">{titleCase(e.type)}</span>{timelineText(e, agentNames, t) && <span className="text-ink-muted"> · {timelineText(e, agentNames, t)}</span>}</span><span className="shrink-0 text-xs text-ink-subtle">{dateTime(e.at)}</span></li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-subtle">{t('admin.deals.detail.timeline.none')}</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('admin.deals.detail.people.title')} />
            <dl className="divide-y">
              <Row label={t('admin.deals.detail.people.property')}>{tg._id ? `${tg.ref} ${tg.title || tg.name || ''}` : null}</Row>
              <Row label={t('admin.deals.detail.people.location')}>{[tg.locality, tg.city].filter(Boolean).join(', ')}</Row>
              <Row label={t('admin.deals.detail.people.propertyStatus')}>{tg.status ? titleCase(tg.status) : null}</Row>
              <Row label={t('admin.deals.detail.people.buyer')}>{lead.buyer?.name || lead.buyerLabel}</Row>
              <Row label={t('admin.deals.detail.people.agent')}>{d.agent ? `${d.agent.name}` : null}</Row>
              <Row label={t('admin.deals.detail.people.lister')}>{d.lister ? <>{d.lister.name} <span className="text-xs text-ink-subtle">({titleCase(d.lister.listerType)} · KYC {titleCase(d.lister.kycStatus || 'not_started')})</span></> : null}</Row>
              <Row label={t('admin.deals.detail.people.billingName')}>{d.lister?.billing?.name}</Row>
            </dl>
          </Card>

          {mine ? (
            <Card>
              <CardHeader title={t('admin.deals.detail.decision.title')} description={t('admin.deals.detail.decision.description')} />
              <div className="space-y-4">
                <div className="space-y-2">
                  {DEAL_CHECKLIST.map(([k, label]) => <Checkbox key={k} label={label} checked={Boolean(checks[k])} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />)}
                </div>
                <Textarea label={t('admin.deals.detail.decision.note')} rows={2} hint={ck.cashWarning ? t('admin.deals.detail.decision.noteCashHint') : t('admin.deals.detail.decision.noteHint')} value={note} onChange={(e) => setNote(e.target.value)} />
                <Button block icon={ShieldCheck} disabled={!allTicked || (ck.cashWarning && note.trim().length < 10) || (ck.duplicateReceipts || []).length > 0 || !rc} loading={decide.isPending} onClick={() => setConfirmVerify(true)}>{t('admin.deals.detail.decision.verify')}</Button>

                <div className="border-t pt-4">
                  <Textarea label={t('admin.deals.detail.decision.comment')} rows={3} hint={t('admin.deals.detail.decision.commentHint')} value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button className="mt-2" block variant="secondary" icon={Undo2} disabled={comment.trim().length < 10} loading={decide.isPending} onClick={() => submit('return')}>{t('admin.deals.detail.decision.return')}</Button>
                </div>

                <div className="border-t pt-4">
                  <Select label={t('admin.deals.detail.decision.rejectReason')} placeholder={t('admin.deals.detail.decision.chooseReason')} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} options={REJECT_REASONS.map((r) => ({ value: r, label: rejectReasonLabel(r) }))} />
                  {rejectReason === 'Other' && <Input className="mt-2" label={t('admin.deals.detail.decision.reason')} value={rejectOther} onChange={(e) => setRejectOther(e.target.value)} />}
                  <Button className="mt-2" block variant="danger" icon={XCircle} disabled={!rejectReason || (rejectReason === 'Other' && rejectOther.trim().length < 5)} loading={decide.isPending} onClick={() => submit('reject')}>{t('admin.deals.detail.decision.reject')}</Button>
                </div>
                {formError && <Alert tone="danger" title={t('admin.deals.detail.decision.cannotDecide')}>{formError}</Alert>}
              </div>
            </Card>
          ) : claimable ? <Alert tone="info">{t('admin.deals.detail.decision.claimToDecide')}</Alert> : !canVerify ? <Alert tone="info">{t('admin.deals.detail.decision.readOnly')}</Alert> : null}

          {(d.statusHistory || []).length > 0 && (
            <Card>
              <CardHeader title={t('admin.deals.detail.history.title')} />
              <ol className="space-y-2 text-sm">
                {[...d.statusHistory].reverse().map((h, i) => (
                  <li key={i} className="flex justify-between gap-3"><span className="text-ink">{h.from ? `${titleCase(h.from)} → ` : ''}{titleCase(h.to)}{h.note ? <span className="text-ink-subtle"> · {h.note}</span> : ''}</span><span className="shrink-0 text-xs text-ink-subtle">{dateTime(h.at)}</span></li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>

      <DocViewer doc={viewer} onClose={() => setViewer(null)} />
      <ConfirmModal open={confirmVerify} onClose={() => setConfirmVerify(false)} onConfirm={() => submit('verify')} loading={decide.isPending} confirmLabel={t('admin.deals.detail.decision.verify')} title={t('admin.deals.detail.confirm.title', { no: d.dealNo })}>
        {t(d.dealType === 'rent' ? 'admin.deals.detail.confirm.bodyRent' : 'admin.deals.detail.confirm.bodySale', { amount: rupees((d.commissionAmount || 0) + (d.gstAmount || 0)) })}
      </ConfirmModal>

      <Modal open={rev.open} onClose={() => setRev((x) => ({ ...x, open: false }))} title={t('admin.deals.detail.rev.title', { no: d.dealNo })}
        description={t('admin.deals.detail.rev.description')}
        footer={<><Button variant="secondary" onClick={() => setRev((x) => ({ ...x, open: false }))}>{t('common.cancel')}</Button><Button variant="danger" icon={RotateCcw} disabled={rev.reason.trim().length < 5} loading={reverse.isPending} onClick={doReverse}>{t('admin.deals.detail.rev.submit')}</Button></>}>
        <div className="space-y-3">
          <Textarea label={t('admin.deals.detail.decision.reason')} required rows={3} value={rev.reason} onChange={(e) => setRev((x) => ({ ...x, reason: e.target.value }))} hint={t('admin.deals.detail.rev.reasonHint')} />
          <Input label={t('admin.deals.detail.rev.effectiveDate')} type="date" value={rev.effectiveDate} onChange={(e) => setRev((x) => ({ ...x, effectiveDate: e.target.value }))} hint={t('admin.deals.detail.rev.effectiveHint')} />
          <Select label={t('admin.deals.detail.rev.leadOutcome')} value={rev.leadOutcome} onChange={(e) => setRev((x) => ({ ...x, leadOutcome: e.target.value }))} options={[{ value: 'negotiation', label: t('admin.deals.detail.rev.negotiation') }, { value: 'closed_lost', label: t('admin.deals.detail.rev.closedLost') }]} />
          {rev.leadOutcome === 'closed_lost' && <Input label={t('admin.deals.detail.rev.lostReason')} placeholder="deal_reversed" value={rev.lostReason} onChange={(e) => setRev((x) => ({ ...x, lostReason: e.target.value }))} />}
        </div>
      </Modal>
    </>
  );
}
