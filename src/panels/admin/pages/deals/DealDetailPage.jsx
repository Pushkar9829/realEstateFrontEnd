// RE-S-ADM-19 deal verification detail: deal data, documents through signed
// links (viewer with zoom), recomputed commission vs submitted, duplicate
// receipt / price deviation / cash 269ST checks, visits and lead timeline, the
// checklist and the decision (verify / return / reject); reversal of verified deals.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, FileText, Lock, LockOpen, RotateCcw, ShieldCheck, Undo2, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, ConfirmModal, Input, Modal, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { DEAL_CHECKLIST, PAYMENT_MODES, REJECT_REASONS, dealDocumentUrl, dealStatus, useClaimDeal, useDeal, useDecideDeal, useReleaseDeal, useReverseDeal } from '@/modules/deals/adminApi';

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-ink-subtle">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children || children === 0 ? children : '-'}</dd>
    </div>
  );
}

function DocViewer({ doc, onClose }) {
  const [zoom, setZoom] = useState(1);
  if (!doc) return null;
  const isImage = /^image\//.test(doc.mime || '');
  const isPdf = doc.mime === 'application/pdf';
  return (
    <Modal open onClose={onClose} size="lg" title={doc.label || titleCase(doc.kind)} description="Signed link, valid for 10 minutes. This view is recorded."
      footer={<>
        {isImage && <><Button variant="ghost" size="sm" icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>Zoom out</Button><Button variant="ghost" size="sm" icon={ZoomIn} onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>Zoom in</Button></>}
        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => window.open(doc.url, '_blank', 'noopener')}>Open in new tab</Button>
      </>}>
      {isImage ? (
        <div className="max-h-[60vh] overflow-auto rounded border bg-surface-sunken">
          <img src={doc.url} alt={doc.label || ''} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} className="block" />
        </div>
      ) : isPdf ? (
        <iframe title={doc.label || 'Document'} src={doc.url} className="h-[60vh] w-full rounded border" />
      ) : <p className="text-sm text-ink-muted">This file type cannot be previewed. Open it in a new tab.</p>}
    </Modal>
  );
}

const OID = /^[a-f0-9]{24}$/;
// Assignment entries store the agent id in `to`; show the name we know, never the raw id.
const timelineText = (t, names = {}) => {
  const d = t.data || {};
  const to = d.to && OID.test(String(d.to)) ? names[String(d.to)] || 'an agent' : d.to;
  const parts = [d.from && to ? `${titleCase(d.from)} → ${titleCase(to)}` : to ? (OID.test(String(d.to)) ? `to ${to}` : titleCase(to)) : null, d.dealNo, d.status && titleCase(d.status), d.result && titleCase(d.result), d.outcome && titleCase(d.outcome), d.note || d.message || d.reason];
  return parts.filter(Boolean).join(' · ');
};

export default function DealDetailPage() {
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
  const t = d.target || {};
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
      if (decision === 'verify') toast.success(`Deal verified${r.receivableNo ? `. Receivable ${r.receivableNo} created` : ''}${r.outcome ? `, listing marked ${r.outcome}` : ''}.`, { duration: 8000 });
      else toast.success(decision === 'return' ? 'Returned to the agent for correction' : 'Deal rejected');
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
      toast.success('Deal reversed');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Link to="/admin/deals" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Deal verification</Link>
      <PageHeader title={`Deal ${d.dealNo}`} breadcrumb={`${titleCase(d.dealType)} · ${t.ref || ''} ${t.title || t.name || ''}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {claimable && !mine && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), 'Claimed for 30 minutes')}>Claim to review</Button>}
          {mine && <Button variant="secondary" icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), 'Lock renewed for 30 minutes')}>Renew lock</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), 'Released back to the queue')}>Release</Button>}
          {canVerify && d.status === 'verified' && <Button variant="danger" icon={RotateCcw} onClick={() => setRev((x) => ({ ...x, open: true }))}>Reverse</Button>}
        </>} />

      {claimActive && !mine && <Alert tone="warning" className="mb-4">Another reviewer holds this deal until {dateTime(d.review.claimUntil)}.</Alert>}
      {mine && <Alert tone="info" className="mb-4">You hold this deal until {dateTime(d.review.claimUntil)}.</Alert>}
      {effects && (
        <Alert tone="success" className="mb-4" title="Reversal applied">
          {effects.length ? <ul className="list-disc pl-4">{effects.map((e) => <li key={e}>{e}</li>)}</ul> : 'No side effects were needed.'}
        </Alert>
      )}
      {(ck.duplicateReceipts || []).length > 0 && <Alert tone="danger" className="mb-4" title="Duplicate receipt">The receipt file or payment reference is also used in deal {ck.duplicateReceipts.join(', ')}. Verification is blocked.</Alert>}
      {ck.cashWarning && <Alert tone="warning" className="mb-4" title="Cash above the section 269ST limit">The booking was paid in cash above the Income Tax Act section 269ST limit. Add a verification note before verifying.</Alert>}
      {d.priceDeviationPercent != null && d.priceDeviationPercent > 0 && (
        <Alert tone={d.priceDeviationPercent > 30 ? 'warning' : 'info'} className="mb-4" title={`Price is ${d.priceDeviationPercent}% from the listed price`}>
          Listed {rupees(d.listedPrice)}, agreed {rupees(price)}.{d.justification ? ` Agent's justification: ${d.justification}` : ''}
        </Alert>
      )}
      {!ck.completedVisit && <Alert tone="danger" className="mb-4">No completed site visit on this lead.</Alert>}
      {d.status === 'reversed' && d.reversal && <Alert tone="danger" className="mb-4" title="Reversed">{d.reversal.reason} · effective {date(d.reversal.effectiveDate)} · lead back to {titleCase(d.reversal.leadOutcome)}</Alert>}
      {d.status === 'returned' && d.review?.comment && <Alert tone="warning" className="mb-4" title="Returned for correction">{d.review.comment}</Alert>}
      {d.status === 'rejected' && d.review?.rejectReason && <Alert tone="danger" className="mb-4" title="Rejected">{d.review.rejectReason}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Deal" />
            <dl className="divide-y">
              <Row label={d.dealType === 'rent' ? 'Monthly rent' : 'Agreed price'}>{rupees(price)}</Row>
              <Row label="Listed price">{d.listedPrice ? rupees(d.listedPrice) : null}</Row>
              <Row label="Booking amount">{rupees(d.bookingAmount)}</Row>
              <Row label="Booking date">{date(d.bookingDate)}</Row>
              <Row label="Payment">{[PAYMENT_MODES[d.paymentMode] || d.paymentMode, d.paymentReference].filter(Boolean).join(' · ')}</Row>
              <Row label="Unit">{d.unitNo}</Row>
              <Row label="Offer">{d.offer ? `${d.offer.offerNo} · ${titleCase(d.offer.status)}` : null}</Row>
              <Row label="Notes"><span className="whitespace-pre-line">{d.notes}</span></Row>
              <Row label="Submitted">{d.submittedAt ? `${dateTime(d.submittedAt)}${d.resubmissionCount ? ` · resubmission ${d.resubmissionCount}` : ''}` : null}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Commission" description="Recomputed by the server from the agreement in force on the booking date."
              action={rc ? <Badge tone={commissionMatch ? 'success' : 'danger'} icon={commissionMatch ? CheckCircle2 : AlertTriangle}>{commissionMatch ? 'Matches' : 'Mismatch'}</Badge> : <Badge tone="danger">No agreement</Badge>} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-1 pr-4" /><th className="py-1 pr-4">Submitted</th><th className="py-1">Recomputed</th></tr></thead>
                <tbody className="divide-y">
                  <tr><td className="py-2 pr-4 text-ink-subtle">Percent</td><td className="py-2 pr-4">{d.commissionPercent != null ? `${d.commissionPercent}%` : '-'}</td><td className="py-2">{rc ? `${rc.commissionPercent}%` : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">Basis</td><td className="py-2 pr-4">{titleCase(d.commissionBasis)}</td><td className="py-2">{rc ? titleCase(rc.commissionBasis) : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">Commission</td><td className="py-2 pr-4 font-medium">{rupees(d.commissionAmount)}</td><td className="py-2 font-medium">{rc ? rupees(rc.commissionAmount) : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">GST</td><td className="py-2 pr-4">{rupees(d.gstAmount)}</td><td className="py-2">{rc ? `${rupees(rc.gstAmount)} (${rc.gst?.interState ? 'IGST' : 'CGST + SGST'} ${rc.gst?.percent}%)` : '-'}</td></tr>
                  <tr><td className="py-2 pr-4 text-ink-subtle">Agreement</td><td className="py-2 pr-4" /><td className="py-2">{rc ? rc.agreementNo || 'Listing commission (no registry agreement)' : '-'}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Documents (${(d.documents || []).length})`} description={`${ck.receipts || 0} receipt(s), ${ck.agreements || 0} agreement(s). Each link is valid for 10 minutes.`} />
            {(d.documents || []).length ? (
              <ul className="divide-y">
                {d.documents.map((doc) => (
                  <li key={doc._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-sm"><Badge tone={doc.kind === 'receipt' ? 'brand' : doc.kind === 'agreement' ? 'info' : 'neutral'}>{titleCase(doc.kind)}</Badge> <span className="ml-1 text-ink">{doc.label}</span>{doc.reference && <span className="text-xs text-ink-subtle"> · ref {doc.reference}</span>}<span className="block text-xs text-ink-subtle">{dateTime(doc.at)}</span></span>
                    <Button size="sm" variant="secondary" icon={FileText} onClick={() => openDoc(doc)}>View</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-danger-700">No documents uploaded.</p>}
          </Card>

          <Card>
            <CardHeader title="Site visits" />
            {(d.visits || []).length ? (
              <ul className="divide-y text-sm">
                {d.visits.map((v) => (
                  <li key={v._id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-ink">{v.visitNo} · {dateTime(v.scheduledAt)}</span>
                    <span className="flex gap-2"><Badge tone={v.status === 'completed' ? 'success' : v.status === 'cancelled' || v.status === 'no_show' ? 'danger' : 'neutral'}>{titleCase(v.status)}</Badge>{v.outcome?.result && <Badge tone="info">{titleCase(v.outcome.result)}</Badge>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-subtle">No visits on this lead.</p>}
          </Card>

          <Card>
            <CardHeader title="Lead timeline" description={`${lead.leadNo || ''} · ${titleCase(lead.stage)} · enquiry ${date(lead.createdAt)}${(lead.sources || []).length ? ` · ${lead.sources.map(titleCase).join(', ')}` : ''}`} />
            {(lead.timeline || []).length ? (
              <ol className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {[...lead.timeline].reverse().slice(0, 40).map((e, i) => (
                  <li key={i} className="flex justify-between gap-3"><span className="text-ink"><span className="font-medium">{titleCase(e.type)}</span>{timelineText(e, agentNames) && <span className="text-ink-muted"> · {timelineText(e, agentNames)}</span>}</span><span className="shrink-0 text-xs text-ink-subtle">{dateTime(e.at)}</span></li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-subtle">No activity recorded.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="People and property" />
            <dl className="divide-y">
              <Row label="Property">{t._id ? `${t.ref} ${t.title || t.name || ''}` : null}</Row>
              <Row label="Location">{[t.locality, t.city].filter(Boolean).join(', ')}</Row>
              <Row label="Property status">{t.status ? titleCase(t.status) : null}</Row>
              <Row label="Buyer">{lead.buyer?.name || lead.buyerLabel}</Row>
              <Row label="Agent">{d.agent ? `${d.agent.name}` : null}</Row>
              <Row label="Lister">{d.lister ? <>{d.lister.name} <span className="text-xs text-ink-subtle">({titleCase(d.lister.listerType)} · KYC {titleCase(d.lister.kycStatus || 'not_started')})</span></> : null}</Row>
              <Row label="Billing name">{d.lister?.billing?.name}</Row>
            </dl>
          </Card>

          {mine ? (
            <Card>
              <CardHeader title="Decision" description="Tick every check to verify." />
              <div className="space-y-4">
                <div className="space-y-2">
                  {DEAL_CHECKLIST.map(([k, label]) => <Checkbox key={k} label={label} checked={Boolean(checks[k])} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />)}
                </div>
                <Textarea label="Verification note" rows={2} hint={ck.cashWarning ? 'Required for cash above the 269ST limit (10+ characters).' : 'Optional, e.g. "Called lister on 12 Oct, confirmed token received".'} value={note} onChange={(e) => setNote(e.target.value)} />
                <Button block icon={ShieldCheck} disabled={!allTicked || (ck.cashWarning && note.trim().length < 10) || (ck.duplicateReceipts || []).length > 0 || !rc} loading={decide.isPending} onClick={() => setConfirmVerify(true)}>Verify deal</Button>

                <div className="border-t pt-4">
                  <Textarea label="Comment for the agent" rows={3} hint="Required to return (10-1000 characters)." value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button className="mt-2" block variant="secondary" icon={Undo2} disabled={comment.trim().length < 10} loading={decide.isPending} onClick={() => submit('return')}>Return for correction</Button>
                </div>

                <div className="border-t pt-4">
                  <Select label="Rejection reason" placeholder="Choose a reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />
                  {rejectReason === 'Other' && <Input className="mt-2" label="Reason" value={rejectOther} onChange={(e) => setRejectOther(e.target.value)} />}
                  <Button className="mt-2" block variant="danger" icon={XCircle} disabled={!rejectReason || (rejectReason === 'Other' && rejectOther.trim().length < 5)} loading={decide.isPending} onClick={() => submit('reject')}>Reject</Button>
                </div>
                {formError && <Alert tone="danger" title="Cannot decide">{formError}</Alert>}
              </div>
            </Card>
          ) : claimable ? <Alert tone="info">Claim this deal to decide.</Alert> : !canVerify ? <Alert tone="info">Read-only: deciding needs the deals.verify permission.</Alert> : null}

          {(d.statusHistory || []).length > 0 && (
            <Card>
              <CardHeader title="Submissions and comments" />
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
      <ConfirmModal open={confirmVerify} onClose={() => setConfirmVerify(false)} onConfirm={() => submit('verify')} loading={decide.isPending} confirmLabel="Verify deal" title={`Verify ${d.dealNo}?`}>
        This marks the lead won and the listing {d.dealType === 'rent' ? 'rented' : 'sold'}, creates the commission receivable of {rupees((d.commissionAmount || 0) + (d.gstAmount || 0))} (incl. GST) and sends the MLM deal.closed event. Only a reversal can undo it.
      </ConfirmModal>

      <Modal open={rev.open} onClose={() => setRev((x) => ({ ...x, open: false }))} title={`Reverse deal ${d.dealNo}`}
        description="The listing goes back to live (or expired), the lead leaves closed won, and the receivable is cancelled with credit notes, or disputed if payments were received. An MLM deal.reversed event is sent."
        footer={<><Button variant="secondary" onClick={() => setRev((x) => ({ ...x, open: false }))}>Cancel</Button><Button variant="danger" icon={RotateCcw} disabled={rev.reason.trim().length < 5} loading={reverse.isPending} onClick={doReverse}>Reverse deal</Button></>}>
        <div className="space-y-3">
          <Textarea label="Reason" required rows={3} value={rev.reason} onChange={(e) => setRev((x) => ({ ...x, reason: e.target.value }))} hint="5-500 characters." />
          <Input label="Effective date" type="date" value={rev.effectiveDate} onChange={(e) => setRev((x) => ({ ...x, effectiveDate: e.target.value }))} hint="Defaults to today." />
          <Select label="Lead outcome" value={rev.leadOutcome} onChange={(e) => setRev((x) => ({ ...x, leadOutcome: e.target.value }))} options={[{ value: 'negotiation', label: 'Back to negotiation' }, { value: 'closed_lost', label: 'Closed lost' }]} />
          {rev.leadOutcome === 'closed_lost' && <Input label="Lost reason code" placeholder="deal_reversed" value={rev.lostReason} onChange={(e) => setRev((x) => ({ ...x, lostReason: e.target.value }))} />}
        </div>
      </Modal>
    </>
  );
}
