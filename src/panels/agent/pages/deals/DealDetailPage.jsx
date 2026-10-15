// RE-S-AGT-13 Deal editor: summary, commercial terms (draft / returned),
// server-computed commission, documents, closure checklist, submit, cancel,
// warnings, admin comments, history and the rental agreement request (rent).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, FileSignature, FileText, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState, Input, PageHeader, Skeleton, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, rupees, titleCase } from '@/shared/lib/format';
import FileDrop from '@/shared/components/FileDrop';
import { errorText } from '@/modules/leads/agentApi';
import { DEAL_EDITABLE, DOC_KINDS, PAYMENT_MODES, dealApi, dealStatus, useAgentDeal, useDealMutation } from '@/modules/deals/agentApi';
import DealForm, { dealInitial } from '../../components/DealForm';
import { RentalAgreementModal } from '../../components/ExtraModals';
import { ErrorState, ReasonModal, Section } from '../../components/common';

const idOf = (x) => (x && typeof x === 'object' ? String(x._id) : x ? String(x) : undefined);

function Check({ ok, children }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />}
      <span className={ok ? 'text-ink' : 'text-ink-muted'}>{children}</span>
    </li>
  );
}

function Documents({ deal, editable }) {
  const toast = useToast();
  const add = useDealMutation(dealApi.addDocument);
  const remove = useDealMutation(dealApi.removeDocument);
  const [labels, setLabels] = useState({});
  const [ref, setRef] = useState('');
  const docs = deal.documents || [];
  const attach = (kind) => async (file, raw) => {
    try {
      await add.mutateAsync({ id: deal._id, body: { fileId: file.id, kind, label: (labels[kind] || '').trim() || raw.name.slice(0, 120), ...(kind === 'receipt' && ref.trim() ? { reference: ref.trim() } : {}) } });
      toast.success(`${raw.name} attached`);
    } catch (e) { toast.error(errorText(e)); throw e; }
  };
  const drop = async (d) => { try { await remove.mutateAsync({ id: deal._id, docId: d._id }); toast.success('Document removed'); } catch (e) { toast.error(errorText(e)); } };
  return (
    <Section title="Documents">
      <div className="space-y-5">
        {Object.entries(DOC_KINDS).map(([kind, k]) => {
          const list = docs.filter((d) => d.kind === kind);
          return (
            <div key={kind}>
              <p className="text-sm font-medium text-ink">{k.label} <span className="text-xs font-normal text-ink-subtle">({list.length}/{k.max}) · {k.hint}</span></p>
              {list.length > 0 && (
                <ul className="mt-2 divide-y rounded-md border">
                  {list.map((d) => (
                    <li key={d._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-ink-subtle" /><span className="truncate">{d.label}</span>{d.reference && <span className="text-xs text-ink-subtle">ref {d.reference}</span>}</span>
                      {editable && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${d.label}`} loading={remove.isPending} onClick={() => drop(d)} />}
                    </li>
                  ))}
                </ul>
              )}
              {editable && list.length < k.max && (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input aria-label={`${k.label} label`} placeholder="Label (optional)" maxLength={120} value={labels[kind] || ''} onChange={(e) => setLabels((x) => ({ ...x, [kind]: e.target.value }))} />
                    {kind === 'receipt' && <Input aria-label="Receipt reference" placeholder="Receipt / UTR reference (optional)" maxLength={80} value={ref} onChange={(e) => setRef(e.target.value)} />}
                  </div>
                  <FileDrop compact purpose={k.purpose} kind="document" multiple onUploaded={attach(kind)} label={`Upload ${k.label.toLowerCase()}`} />
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-ink-subtle">Files are private: only you and the verification team can open them. The same receipt cannot be used in two deals.</p>
      </div>
    </Section>
  );
}

export default function DealDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: deal, isLoading, error, refetch } = useAgentDeal(id);
  const edit = useDealMutation(dealApi.edit);
  const submit = useDealMutation(dealApi.submit);
  const cancel = useDealMutation(dealApi.cancel);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitErrors, setSubmitErrors] = useState([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [modal, setModal] = useState('');

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (error && error.status === 404) return <EmptyState icon={FileSignature} title="Deal not found" description="It may belong to another agent." action={<Button variant="secondary" to="/agent/deals">Back to my deals</Button>} />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load the deal" />;

  const s = dealStatus(deal.status);
  const editable = DEAL_EDITABLE.includes(deal.status);
  const rent = deal.dealType === 'rent';
  const price = rent ? deal.monthlyRent : deal.agreedPrice;
  const c = deal.checklist || {};
  const t = deal.target || {};
  const checks = [
    [c.completedVisit, 'A completed site visit for this lead and property'],
    [c.receipts > 0, 'At least one payment receipt'],
    [c.agreements > 0, 'The agreement or booking form'],
    [Boolean(price), rent ? 'Agreed monthly rent' : 'Agreed price'],
    [deal.bookingAmount > 0 && (rent || !price || deal.bookingAmount <= price), 'Booking amount above 0 (and not above the price)'],
    [Boolean(deal.bookingDate), 'Booking date'],
    [Boolean(deal.paymentMode) && (deal.paymentMode === 'cash' || Boolean(deal.paymentReference)), 'Payment mode and reference'],
    [!(c.duplicateReceipts || []).length, (c.duplicateReceipts || []).length ? `Receipt already used in ${c.duplicateReceipts.join(', ')}` : 'No duplicate receipts'],
  ];
  const ready = checks.every(([ok]) => ok);
  const minDate = deal.lead && deal.lead.createdAt ? new Date(new Date(deal.lead.createdAt).getTime() + 330 * 60000).toISOString().slice(0, 10) : undefined;

  const save = async (body) => {
    try { await edit.mutateAsync({ id: deal._id, body }); toast.success('Saved; commission recalculated'); setErrors({}); setEditing(false); } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  const doSubmit = async () => {
    setConfirmSubmit(false);
    setSubmitErrors([]);
    try {
      const r = await submit.mutateAsync({ id: deal._id });
      setWarnings(r.warnings || []);
      toast.success('Submitted for verification');
    } catch (e) {
      const list = Array.isArray(e.details) ? e.details.filter((d) => d && d.message).map((d) => d.message) : [];
      setSubmitErrors(list.length ? list : [e.message]);
      toast.error(e.message);
    }
  };
  const doCancel = async (reason) => { try { await cancel.mutateAsync({ id: deal._id, reason }); toast.success('Deal cancelled'); setModal(''); } catch (e) { toast.error(errorText(e)); } };

  const terms = [
    [rent ? 'Monthly rent' : 'Agreed price', rupees(price)], [rent ? 'Deposit / first rent' : 'Booking amount', rupees(deal.bookingAmount)], ['Booking date', date(deal.bookingDate)],
    ['Payment', deal.paymentMode ? (PAYMENT_MODES.find((p) => p.value === deal.paymentMode) || {}).label : '-'], ['Reference', deal.paymentReference || '-'],
    ...(deal.unitNo ? [['Unit', deal.unitNo]] : []),
  ];

  return (
    <>
      <PageHeader breadcrumb={<Link to="/agent/deals" className="hover:text-ink">My deals</Link>} title={deal.dealNo}
        description={`${rent ? 'Rent' : 'Sale'} · ${t.ref || ''} ${t.title || t.name || ''}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {rent && !['cancelled', 'rejected', 'reversed'].includes(deal.status) && <Button variant="secondary" icon={FileSignature} onClick={() => setModal('rental')}>Rental agreement</Button>}
          {editable && <Button variant="ghost" icon={XCircle} onClick={() => setModal('cancel')}>Cancel deal</Button>}
          {editable && <Button icon={Send} disabled={!ready} loading={submit.isPending} onClick={() => setConfirmSubmit(true)} title={ready ? undefined : 'Complete the checklist first'}>{deal.status === 'returned' ? 'Resubmit' : 'Submit'}</Button>}
        </>} />

      <ConfirmModal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} onConfirm={doSubmit} loading={submit.isPending} confirmLabel="Submit for verification" title={`Submit ${deal.dealNo}?`}>
        The deal becomes read-only while the verification team checks the receipts and the agreement. You can correct it only if they return it.
      </ConfirmModal>
      {deal.status === 'returned' && <Alert tone="warning" className="mb-4" title="Returned by the verification team">{(deal.review && deal.review.comment) || 'See the comments and correct the deal.'}{deal.resubmissionCount ? ` · resubmitted ${deal.resubmissionCount} time(s) so far` : ''}</Alert>}
      {deal.status === 'rejected' && <Alert tone="danger" className="mb-4" title="Rejected">{deal.review && (deal.review.rejectReason || deal.review.comment)}</Alert>}
      {['submitted', 'under_review'].includes(deal.status) && <Alert tone="info" className="mb-4" title="Awaiting verification">The deal is read-only while the team checks it.</Alert>}
      {deal.status === 'verified' && <Alert tone="success" className="mb-4" title="Verified">Verified {dateTime(deal.review && deal.review.verifiedAt)}. The lead is closed as won.</Alert>}
      {deal.status === 'cancelled' && <Alert tone="info" className="mb-4">Cancelled: {deal.cancelReason}</Alert>}
      {deal.status === 'reversed' && <Alert tone="danger" className="mb-4" title="Reversed">{deal.reversal && deal.reversal.reason}</Alert>}
      {submitErrors.length > 0 && <Alert tone="danger" className="mb-4" title="Cannot submit yet"><ul className="list-disc pl-5">{submitErrors.map((m) => <li key={m}>{m}</li>)}</ul></Alert>}
      {warnings.length > 0 && <Alert tone="warning" className="mb-4" title="Submitted with warnings"><ul className="list-disc pl-5">{warnings.map((w) => <li key={w.code}>{w.code === 'CASH_269ST' ? 'Cash 269ST: ' : w.code === 'PRICE_DEVIATION' ? 'Price deviation: ' : ''}{w.message}</li>)}</ul></Alert>}
      {c.cashWarning && <Alert tone="warning" className="mb-4" title="Cash above the 269ST limit">Verification needs a note. Prefer a bank transfer where possible.</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Commercial terms" action={editable && !editing && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}>
            {editable && editing ? (
              <DealForm dealType={deal.dealType} initial={dealInitial(deal)} isProject={Boolean(deal.projectId)} minDate={minDate}
                previewTarget={{ leadId: idOf(deal.leadId), ...(deal.projectId ? { projectId: idOf(deal.projectId) } : { propertyId: idOf(deal.propertyId) }) }}
                offer={null} errors={errors} loading={edit.isPending} onCancel={() => setEditing(false)} onSubmit={save} />
            ) : (
              <>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{terms.map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-ink-subtle">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>)}</dl>
                {deal.justification && <p className="mt-3 text-sm text-ink-muted"><span className="font-medium text-ink">Justification:</span> {deal.justification}</p>}
                {deal.notes && <p className="mt-2 rounded-md bg-surface-muted p-2 text-sm text-ink-muted">{deal.notes}</p>}
                {editable && !deal.bookingDate && <Button className="mt-3" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Fill in the terms</Button>}
              </>
            )}
          </Section>
          <Documents deal={deal} editable={editable} />
          {(deal.statusHistory || []).length > 0 && (
            <Section title="History">
              <ol className="space-y-2 border-l-2 border-line pl-4 text-sm">
                {deal.statusHistory.slice().reverse().map((h) => (
                  <li key={`${h.to}${h.at}`}><span className="font-medium text-ink">{dealStatus(h.to).label}</span>{h.note ? ` · ${h.note}` : ''}<span className="block text-xs text-ink-subtle">{dateTime(h.at)}</span></li>
                ))}
              </ol>
            </Section>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <h3 className="text-base font-semibold text-ink">Commission</h3>
            <p className="mt-1 text-xs text-ink-subtle">Computed by the server from the agreement in force on the booking date. You cannot edit it.</p>
            {deal.commissionAmount != null ? (
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-subtle">Rate</dt><dd className="text-ink">{deal.commissionPercent}% of {deal.commissionBasis === 'annual_rent' ? '12 months rent' : 'agreed price'}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-subtle">Commission</dt><dd className="font-semibold text-ink">{rupees(deal.commissionAmount)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-subtle">GST {deal.gst && deal.gst.percent ? `${deal.gst.percent}%` : ''} {deal.gst ? (deal.gst.interState ? '(IGST)' : '(CGST + SGST)') : ''}</dt><dd className="text-ink">{rupees(deal.gstAmount)}</dd></div>
                <div className="flex justify-between border-t pt-1.5"><dt className="text-ink-subtle">Total</dt><dd className="font-semibold text-ink">{rupees((deal.commissionAmount || 0) + (deal.gstAmount || 0))}</dd></div>
              </dl>
            ) : <p className="mt-3 text-sm text-warning-700">No commission agreement found yet. Save the price and booking date; if it stays empty the listing has no agreement in force.</p>}
          </Card>
          <Card>
            <h3 className="mb-3 text-base font-semibold text-ink">Submission checklist</h3>
            <ul className="space-y-2">{checks.map(([ok, text]) => <Check key={text} ok={ok}>{text}</Check>)}</ul>
            {(deal.completedVisits || []).length > 0 && <p className="mt-3 text-xs text-ink-subtle">Visits: {deal.completedVisits.map((v) => `${v.visitNo} (${date(v.scheduledAt)})`).join(', ')}</p>}
            {editable && <p className={cn('mt-3 text-xs', ready ? 'text-success-700' : 'text-ink-subtle')}>{ready ? 'Ready to submit.' : 'Submit unlocks when every item is ticked.'}</p>}
          </Card>
          <Card className="space-y-1 text-sm">
            <h3 className="mb-2 text-base font-semibold text-ink">Parties</h3>
            {deal.lead && <p>Buyer: <Link to={`/agent/leads/${deal.lead._id}`} className="font-medium text-brand-700 hover:underline">{deal.lead.buyer && deal.lead.buyer.name}</Link> <span className="text-xs text-ink-subtle">({deal.lead.leadNo})</span></p>}
            {t.kind === 'property' && <p>Property: <Link to={`/agent/properties/${t._id}`} className="font-medium text-brand-700 hover:underline">{t.ref}</Link> · {t.title}<span className="block text-xs text-ink-subtle">{[t.locality, t.city].filter(Boolean).join(', ')} · {titleCase(t.status)}</span></p>}
            {t.kind === 'project' && <p>Project: <span className="font-medium text-ink">{t.ref}</span> · {t.name}</p>}
            {t.price && <p className="text-xs text-ink-subtle">Listed at {rupees(rent ? t.price.monthlyRent : t.price.amount)}</p>}
          </Card>
        </div>
      </div>

      <ReasonModal open={modal === 'cancel'} onClose={() => setModal('')} title="Cancel this deal" description="Only draft and returned deals can be cancelled. The lead goes back to negotiation." label="Reason" min={5} max={500} confirmLabel="Cancel deal" danger loading={cancel.isPending} onSubmit={doCancel} />
      <RentalAgreementModal open={modal === 'rental'} onClose={() => setModal('')} deal={deal} />
    </>
  );
}
