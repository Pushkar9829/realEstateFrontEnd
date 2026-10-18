// RE-S-ADM-21 receivable and invoice detail: figures, invoices (draft with an
// optional partial amount, issue, cancel with a credit note, PDF), payments
// (record with TDS and UTR; confirm or reject lister proofs), dispute,
// full or partial write-off and the timeline. Bodies take rupees; the API returns paise.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, ExternalLink, FilePlus2, FileText, Gavel, HandCoins, Scale, Send, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import {
  INVOICE_TONE, PAYMENT_MODES, openInvoicePdf, receivableStatus, useCancelInvoice, useDecideProof, useDraftInvoice, useIssueInvoice,
  useRaiseDispute, useReceivable, useRecordPayment, useResolveDispute, useWriteOff,
} from '@/modules/receivables/adminApi';

const OPEN = ['pending_invoice', 'invoiced', 'overdue', 'partially_paid'];
const COLLECTING = ['invoiced', 'overdue', 'partially_paid'];
const today = () => new Date().toISOString().slice(0, 10);

function Figure({ label, value, strong }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs text-ink-subtle">{label}</p>
      <p className={strong ? 'mt-0.5 text-lg font-semibold text-ink' : 'mt-0.5 text-base font-medium text-ink'}>{value}</p>
    </div>
  );
}

function ProofActions({ p, onDecide, busy }) {
  const t = useT();
  const [amount, setAmount] = useState(String((p.amount || 0) / 100));
  const [tds, setTds] = useState(String((p.tds || 0) / 100));
  const [reason, setReason] = useState('');
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-2">
      <Input label={t('admin.receivables.detail.proof.actualAmount')} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input label={t('admin.receivables.detail.proof.tds')} type="number" min="0" value={tds} onChange={(e) => setTds(e.target.value)} />
      <Button icon={CheckCircle2} loading={busy} disabled={!(Number(amount) + Number(tds) > 0)} onClick={() => onDecide({ decision: 'confirm', amount: Number(amount), tds: Number(tds) || 0 })}>{t('common.confirm')}</Button>
      <div className="flex gap-2">
        <input className="h-10 min-w-0 flex-1 rounded-md border border-line-strong px-3 text-sm" placeholder={t('admin.receivables.detail.proof.reasonPlaceholder')} aria-label={t('admin.receivables.detail.proof.reasonLabel')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="danger" icon={XCircle} loading={busy} disabled={reason.trim().length < 5} onClick={() => onDecide({ decision: 'reject', reason: reason.trim() })}>{t('admin.receivables.detail.proof.reject')}</Button>
      </div>
    </div>
  );
}

export default function ReceivableDetailPage() {
  const t = useT();
  const { id } = useParams();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data: r, isLoading, error } = useReceivable(id);
  const draft = useDraftInvoice(id);
  const issue = useIssueInvoice(id);
  const cancel = useCancelInvoice(id);
  const pay = useRecordPayment(id);
  const proof = useDecideProof(id);
  const dispute = useRaiseDispute(id);
  const resolve = useResolveDispute(id);
  const writeOff = useWriteOff(id);
  const [draftForm, setDraftForm] = useState({ amount: '', note: '' });
  const [billingMissing, setBillingMissing] = useState(false);
  const [issueFor, setIssueFor] = useState(null);
  const [dueDays, setDueDays] = useState('');
  const [cancelFor, setCancelFor] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', tds: '', date: today(), mode: 'bank_transfer', reference: '' });
  const [payError, setPayError] = useState(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [woOpen, setWoOpen] = useState(false);
  const [woReason, setWoReason] = useState('');
  const [woAmount, setWoAmount] = useState('');
  const [woError, setWoError] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const s = receivableStatus(r.status);
  const canIssue = hasPermission('invoices.issue');
  const canManage = hasPermission('receivables.manage');
  const deal = r.deal || {};
  const lister = r.lister || {};
  const noBilling = !(lister.billing && lister.billing.name);
  const canDraft = canIssue && !['cancelled', 'written_off', 'disputed', 'paid'].includes(r.status) && r.uninvoicedCommission > 0;
  const proofs = (r.payments || []).filter((p) => p.source === 'lister');
  const payments = (r.payments || []).filter((p) => p.source !== 'lister');

  const woPaise = Math.round(Number(woAmount) * 100);
  const woValid = woAmount !== '' && woPaise > 0 && woPaise <= (r.outstanding || 0);
  const woPartial = woValid && woPaise < r.outstanding;
  const doWriteOff = async () => {
    setWoError(null);
    try {
      const out = await writeOff.mutateAsync({ reason: woReason.trim(), ...(woPartial ? { amount: Number(woAmount) } : {}) });
      toast.success(out.partial ? t('admin.receivables.detail.toast.partialWriteOff', { amount: rupees(out.outstanding) }) : t('admin.receivables.detail.toast.writtenOff'));
      setWoOpen(false); setWoReason('');
    } catch (e) { setWoError(e.fieldErrors.amount || e.message); }
  };

  const act = async (fn, msg, after) => { try { const out = await fn(); if (msg) toast.success(typeof msg === 'function' ? msg(out) : msg); if (after) after(); } catch (e) { toast.error(e.message); } };

  const doDraft = async () => {
    setBillingMissing(false);
    try {
      await draft.mutateAsync({ ...(draftForm.amount ? { amount: Number(draftForm.amount) } : {}), ...(draftForm.note.trim() ? { note: draftForm.note.trim() } : {}) });
      toast.success(t('admin.receivables.detail.toast.draftCreated'));
      setDraftForm({ amount: '', note: '' });
    } catch (e) {
      if (e.fieldErrors.billing) { setBillingMissing(true); toast.error(t('admin.receivables.detail.toast.noBilling')); }
      else toast.error(e.fieldErrors.amount || e.message);
    }
  };

  const doPay = async () => {
    setPayError(null);
    try {
      await pay.mutateAsync({ amount: Number(payForm.amount) || 0, tds: Number(payForm.tds) || 0, date: payForm.date, mode: payForm.mode, reference: payForm.reference.trim() });
      toast.success(t('admin.receivables.detail.toast.paymentRecorded'));
      setPayOpen(false);
      setPayForm({ amount: '', tds: '', date: today(), mode: 'bank_transfer', reference: '' });
    } catch (e) { setPayError(Object.values(e.fieldErrors).join(' · ') || e.message); }
  };

  return (
    <>
      <Link to="/admin/receivables" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.receivables.detail.back')}</Link>
      <PageHeader title={t('admin.receivables.detail.title', { no: r.receivableNo })} breadcrumb={`${t('admin.receivables.detail.dealNo', { no: r.dealNo })} · ${lister.billing?.name || lister.name || ''}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {canManage && COLLECTING.includes(r.status) && <Button icon={HandCoins} onClick={() => setPayOpen(true)}>{t('admin.receivables.detail.recordPayment')}</Button>}
          {canManage && OPEN.includes(r.status) && <Button variant="secondary" icon={Scale} onClick={() => setDisputeOpen(true)}>{t('admin.receivables.detail.raiseDispute')}</Button>}
          {canManage && [...OPEN, 'disputed'].includes(r.status) && <Button variant="danger" icon={Ban} onClick={() => { setWoAmount(String((r.outstanding || 0) / 100)); setWoError(null); setWoOpen(true); }}>{t('admin.receivables.detail.writeOff')}</Button>}
        </>} />

      {r.status === 'disputed' && r.dispute && (
        <Alert tone="warning" className="mb-4" title={t(r.dispute.raisedByRole === 'lister' ? 'admin.receivables.detail.dispute.byLister' : r.dispute.raisedByRole === 'system' ? 'admin.receivables.detail.dispute.bySystem' : 'admin.receivables.detail.dispute.byFinance', { date: dateTime(r.dispute.raisedAt) })}
          action={null}>
          <p>{r.dispute.reason}</p>
          <p className="mt-1 text-xs">{t('admin.receivables.detail.dispute.paused')}</p>
          {canManage && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3 text-sm text-ink" placeholder={t('admin.receivables.detail.dispute.notePlaceholder')} aria-label={t('admin.receivables.detail.dispute.noteLabel')} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
              <Button size="sm" icon={Gavel} disabled={resolveNote.trim().length < 5} loading={resolve.isPending} onClick={() => act(() => resolve.mutateAsync({ note: resolveNote.trim() }), (o) => t('admin.receivables.detail.dispute.resolvedToast', { status: titleCase(o.status) }), () => setResolveNote(''))}>{t('admin.receivables.detail.dispute.resolve')}</Button>
            </div>
          )}
        </Alert>
      )}
      {r.dispute?.resolvedAt && r.status !== 'disputed' && <Alert tone="info" className="mb-4" title={t('admin.receivables.detail.dispute.resolvedAt', { date: dateTime(r.dispute.resolvedAt) })}>{r.dispute.resolvedNote}</Alert>}
      {r.status !== 'written_off' && r.writtenOffAmount > 0 && r.writeOff && <Alert tone="info" className="mb-4" title={t('admin.receivables.detail.wo.partialAt', { date: dateTime(r.writeOff.at) })}>{t('admin.receivables.detail.wo.inAll', { amount: rupees(r.writtenOffAmount) })} · {r.writeOff.reason}</Alert>}
      {r.status === 'written_off' && r.writeOff && <Alert tone="info" className="mb-4" title={t('admin.receivables.detail.wo.at', { date: dateTime(r.writeOff.at) })}>{rupees(r.writtenOffAmount)} · {r.writeOff.reason}</Alert>}

      <Card className="mb-6">
        <CardHeader title={t('admin.receivables.detail.fig.title')} />
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Figure label={t('admin.receivables.detail.fig.commission')} value={rupees(r.commissionAmount)} />
          <Figure label={r.interState ? t('admin.receivables.detail.fig.gstIgst') : t('admin.receivables.detail.fig.gstCgst')} value={rupees(r.gstAmount)} />
          <Figure label={t('admin.receivables.detail.fig.totalDue')} value={rupees(r.totalDue)} />
          <Figure label={t('admin.receivables.detail.fig.invoiced')} value={rupees(r.invoicedTotal)} />
          <Figure label={t('admin.receivables.detail.fig.paid')} value={rupees(r.paidTotal)} />
          <Figure label={t('admin.receivables.detail.fig.outstanding')} value={rupees(r.outstanding)} strong />
        </div>
        <p className="mt-3 text-xs text-ink-subtle">{t('admin.receivables.detail.fig.summary', { received: rupees(r.receivedAmount), tds: rupees(r.tdsAmount), writtenOff: rupees(r.writtenOffAmount), uninvoiced: rupees(r.uninvoicedCommission) })}{r.dueDate ? t('admin.receivables.detail.fig.earliestDue', { date: date(r.dueDate) }) : ''}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('admin.receivables.detail.inv.title')} description={t('admin.receivables.detail.inv.description')} />
            {(noBilling || billingMissing) && <Alert tone="warning" className="mb-3" title={t('admin.receivables.detail.inv.billingRequired')}>{t('admin.receivables.detail.inv.billingBody')}</Alert>}
            {(r.invoices || []).length ? (
              <ul className="divide-y">
                {r.invoices.map((inv) => (
                  <li key={inv._id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium text-ink">{inv.status === 'draft' ? t('admin.receivables.detail.inv.draftInvoice') : inv.invoiceNo} <Badge tone={INVOICE_TONE[inv.status]} className="ml-1">{titleCase(inv.status)}</Badge></p>
                        <p className="text-xs text-ink-subtle">{inv.billing?.name}{inv.billing?.gstin ? ` · GSTIN ${inv.billing.gstin}` : ` · ${t('admin.receivables.detail.inv.unregistered')}`} · {t('admin.receivables.detail.inv.supply', { place: inv.placeOfSupply || '-' })} · SAC {inv.sacCode || '-'}</p>
                        <p className="mt-1 text-ink-muted">{t('admin.receivables.detail.inv.taxable', { amount: rupees(inv.taxable) })} · {inv.igst ? `IGST ${rupees(inv.igst)}` : `CGST ${rupees(inv.cgst)} + SGST ${rupees(inv.sgst)}`} · <span className="font-medium text-ink">{t('admin.receivables.detail.inv.total', { amount: rupees(inv.total) })}</span></p>
                        <p className="text-xs text-ink-subtle">{t('admin.receivables.detail.inv.dated', { date: date(inv.date) })}{inv.dueDate ? t('admin.receivables.detail.inv.due', { date: date(inv.dueDate) }) : ''}</p>
                        {inv.creditNote?.no && <p className="mt-1 text-xs text-danger-700">{t('admin.receivables.detail.inv.creditNote', { no: inv.creditNote.no, date: date(inv.creditNote.date) })} {inv.creditNote.reason}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" icon={FileText} onClick={() => act(() => openInvoicePdf(inv._id))}>PDF</Button>
                        {canIssue && inv.status === 'draft' && <Button size="sm" icon={Send} onClick={() => { setIssueFor(inv); setDueDays(''); }}>{t('admin.receivables.detail.inv.issue')}</Button>}
                        {canIssue && inv.status !== 'cancelled' && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => { setCancelFor(inv); setCancelReason(''); }}>{inv.status === 'draft' ? t('admin.receivables.detail.inv.discard') : t('common.cancel')}</Button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-subtle">{t('admin.receivables.detail.inv.none')}</p>}
            {canDraft && (
              <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <Input label={t('admin.receivables.detail.inv.taxableAmount')} type="number" min="0" placeholder={String(Math.round((r.uninvoicedCommission || 0) / 100))} hint={t('admin.receivables.detail.inv.taxableHint')} value={draftForm.amount} onChange={(e) => setDraftForm((f) => ({ ...f, amount: e.target.value }))} />
                <Input label={t('admin.receivables.detail.note')} value={draftForm.note} onChange={(e) => setDraftForm((f) => ({ ...f, note: e.target.value }))} />
                <Button icon={FilePlus2} loading={draft.isPending} onClick={doDraft}>{t('admin.receivables.detail.inv.draft')}</Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={t('admin.receivables.detail.pay.title')} />
            {payments.length ? (
              <ul className="divide-y text-sm">
                {payments.map((p) => (
                  <li key={p._id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span><span className="font-medium text-ink">{rupees(p.amount)}</span>{p.tds ? <span className="text-ink-muted"> + TDS {rupees(p.tds)}</span> : ''} <span className="text-ink-subtle">· {PAYMENT_MODES[p.mode] || p.mode} · UTR {p.reference || '-'}</span></span>
                    <span className="flex items-center gap-2 text-xs text-ink-subtle">{date(p.date)}{p.proofUrl && <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={p.proofUrl} target="_blank" rel="noreferrer">{t('admin.receivables.detail.pay.proof')} <ExternalLink className="h-3 w-3" /></a>}<Badge tone="success">{t('admin.receivables.detail.pay.confirmed')}</Badge></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-subtle">{t('admin.receivables.detail.pay.none')}</p>}
          </Card>

          <Card>
            <CardHeader title={t('admin.receivables.detail.proof.title')} description={t('admin.receivables.detail.proof.description')} />
            {proofs.length ? (
              <ul className="divide-y text-sm">
                {proofs.map((p) => (
                  <li key={p._id} className="py-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span><span className="font-medium text-ink">{rupees(p.amount)}</span>{p.tds ? <span className="text-ink-muted"> + TDS {rupees(p.tds)}</span> : ''} <span className="text-ink-subtle">· {PAYMENT_MODES[p.mode] || p.mode} · {t('admin.receivables.detail.proof.meta', { ref: p.reference || '-', date: date(p.date) })}</span></span>
                      <span className="flex items-center gap-2">
                        {p.proofUrl && <a className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline" href={p.proofUrl} target="_blank" rel="noreferrer">{t('admin.receivables.detail.proof.view')} <ExternalLink className="h-3 w-3" /></a>}
                        <Badge tone={p.status === 'confirmed' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}>{titleCase(p.status)}</Badge>
                      </span>
                    </div>
                    {p.rejectReason && <p className="mt-1 text-xs text-danger-700">{p.rejectReason}</p>}
                    {canManage && p.status === 'pending' && <ProofActions p={p} busy={proof.isPending} onDecide={(body) => act(() => proof.mutateAsync({ proofId: p._id, ...body }), body.decision === 'confirm' ? t('admin.receivables.detail.toast.paymentConfirmed') : t('admin.receivables.detail.toast.proofRejected'))} />}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-subtle">{t('admin.receivables.detail.proof.none')}</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('admin.receivables.detail.deal.title')} action={deal._id ? <Link className="text-sm text-brand-700 hover:underline" to={`/admin/deals/${deal._id}`}>{t('admin.receivables.detail.deal.open')}</Link> : null} />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.deal.title')}</dt><dd className="text-ink">{deal.dealNo} · {titleCase(deal.status)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.deal.property')}</dt><dd className="text-right text-ink">{deal.propertyId ? `${deal.propertyId.listingNo} ${deal.propertyId.title}` : deal.projectId ? `${deal.projectId.projectNo} ${deal.projectId.name}` : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{deal.dealType === 'rent' ? t('admin.receivables.detail.deal.monthlyRent') : t('admin.receivables.detail.deal.agreedPrice')}</dt><dd className="text-ink">{rupees(deal.dealType === 'rent' ? deal.monthlyRent : deal.agreedPrice)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.fig.commission')}</dt><dd className="text-ink">{deal.commissionPercent != null ? t('admin.receivables.detail.deal.percentOf', { n: deal.commissionPercent, basis: titleCase(deal.commissionBasis) }) : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.deal.bookingDate')}</dt><dd className="text-ink">{date(deal.bookingDate)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.deal.agent')}</dt><dd className="text-ink">{deal.agentId?.name || '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.deal.lister')}</dt><dd className="text-right text-ink">{lister.name} <span className="text-xs text-ink-subtle">({titleCase(lister.listerType)})</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('admin.receivables.detail.deal.billing')}</dt><dd className="text-right text-ink">{lister.billing?.name ? `${lister.billing.name}${lister.billing.gstin ? ` · ${lister.billing.gstin}` : ''}${lister.billing.state ? ` · ${lister.billing.state}` : ''}` : <span className="text-danger-700">{t('admin.receivables.detail.inv.billingRequired')}</span>}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t('admin.receivables.detail.timeline')} />
            <ol className="space-y-2 text-sm">
              {[...(r.timeline || [])].reverse().map((ev, i) => (
                <li key={i} className="flex justify-between gap-3"><span className="text-ink"><span className="font-medium">{titleCase(ev.type)}</span>{ev.note && <span className="text-ink-muted"> · {ev.note}</span>}</span><span className="shrink-0 text-xs text-ink-subtle">{dateTime(ev.at)}</span></li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal open={Boolean(issueFor)} onClose={() => setIssueFor(null)} title={t('admin.receivables.detail.issue.title')} description={t('admin.receivables.detail.issue.description')}
        footer={<><Button variant="secondary" onClick={() => setIssueFor(null)}>{t('common.cancel')}</Button><Button icon={Send} loading={issue.isPending} onClick={() => act(() => issue.mutateAsync({ invoiceId: issueFor._id, ...(dueDays ? { dueDays: Number(dueDays) } : {}) }), (o) => t('admin.receivables.detail.issue.toast', { no: o.invoice.invoiceNo }), () => setIssueFor(null))}>{t('admin.receivables.detail.issue.submit')}</Button></>}>
        {issueFor && <p className="mb-3 text-sm text-ink-muted">{t('admin.receivables.detail.issue.body', { amount: rupees(issueFor.total), name: issueFor.billing?.name })}</p>}
        <Input label={t('admin.receivables.detail.issue.dueDays')} type="number" min="1" max="180" placeholder={t('admin.receivables.detail.issue.dueDaysPlaceholder')} value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
      </Modal>

      <Modal open={Boolean(cancelFor)} onClose={() => setCancelFor(null)} title={cancelFor?.status === 'draft' ? t('admin.receivables.detail.cancel.discardTitle') : t('admin.receivables.detail.cancel.title', { no: cancelFor?.invoiceNo || '' })}
        description={cancelFor?.status === 'draft' ? t('admin.receivables.detail.cancel.discardDescription') : t('admin.receivables.detail.cancel.description')}
        footer={<><Button variant="secondary" onClick={() => setCancelFor(null)}>{t('admin.receivables.detail.cancel.keep')}</Button><Button variant="danger" disabled={cancelReason.trim().length < 5} loading={cancel.isPending} onClick={() => act(() => cancel.mutateAsync({ invoiceId: cancelFor._id, reason: cancelReason.trim() }), cancelFor.status === 'draft' ? t('admin.receivables.detail.toast.draftDiscarded') : t('admin.receivables.detail.toast.invoiceCancelled'), () => setCancelFor(null))}>{cancelFor?.status === 'draft' ? t('admin.receivables.detail.inv.discard') : t('admin.receivables.detail.cancel.submit')}</Button></>}>
        <Textarea label={t('admin.receivables.detail.reason')} required rows={3} hint={t('admin.receivables.detail.hint5to500')} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={t('admin.receivables.detail.recordPayment')} description={t('admin.receivables.detail.pay.collectible', { amount: rupees(r.collectible) })}
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>{t('common.cancel')}</Button><Button icon={HandCoins} loading={pay.isPending} disabled={!(Number(payForm.amount) + Number(payForm.tds) > 0) || !payForm.reference.trim()} onClick={doPay}>{t('admin.receivables.detail.recordPayment')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('admin.receivables.detail.pay.amount')} type="number" min="0" required value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label={t('admin.receivables.detail.pay.tds')} type="number" min="0" value={payForm.tds} onChange={(e) => setPayForm((f) => ({ ...f, tds: e.target.value }))} />
          <Input label={t('admin.receivables.detail.pay.date')} type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} />
          <Select label={t('admin.receivables.detail.pay.mode')} value={payForm.mode} onChange={(e) => setPayForm((f) => ({ ...f, mode: e.target.value }))} options={Object.entries(PAYMENT_MODES).map(([value, label]) => ({ value, label }))} />
          <Input className="sm:col-span-2" label={t('admin.receivables.detail.pay.reference')} required value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
        </div>
        {payError && <Alert tone="danger" className="mt-3">{payError}</Alert>}
      </Modal>

      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title={t('admin.receivables.detail.raiseDispute')} description={t('admin.receivables.detail.dispute.description')}
        footer={<><Button variant="secondary" onClick={() => setDisputeOpen(false)}>{t('common.cancel')}</Button><Button icon={Scale} disabled={disputeReason.trim().length < 10} loading={dispute.isPending} onClick={() => act(() => dispute.mutateAsync({ reason: disputeReason.trim() }), t('admin.receivables.detail.toast.disputeRaised'), () => { setDisputeOpen(false); setDisputeReason(''); })}>{t('admin.receivables.detail.raiseDispute')}</Button></>}>
        <Textarea label={t('admin.receivables.detail.reason')} required rows={4} hint={t('admin.receivables.detail.hint10to1000')} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
      </Modal>

      <Modal open={woOpen} onClose={() => setWoOpen(false)} title={t('admin.receivables.detail.wo.title')} description={t('admin.receivables.detail.wo.description', { amount: rupees(r.outstanding) })}
        footer={<><Button variant="secondary" onClick={() => setWoOpen(false)}>{t('common.cancel')}</Button><Button variant="danger" icon={Ban} disabled={woReason.trim().length < 10 || !woValid} loading={writeOff.isPending} onClick={doWriteOff}>{t('admin.receivables.detail.writeOff')} {woValid ? rupees(Math.round(Number(woAmount) * 100)) : ''}</Button></>}>
        <div className="space-y-4">
          <Input label={t('admin.receivables.detail.wo.amount')} type="number" min="0" step="0.01" max={(r.outstanding || 0) / 100} value={woAmount} onChange={(e) => setWoAmount(e.target.value)} hint={woPartial ? t('admin.receivables.detail.wo.partialHint') : t('admin.receivables.detail.wo.fullHint')} />
          <Textarea label={t('admin.receivables.detail.reason')} required rows={3} hint={t('admin.receivables.detail.hint10to1000')} value={woReason} onChange={(e) => setWoReason(e.target.value)} />
          {woError && <Alert tone="danger">{woError}</Alert>}
        </div>
      </Modal>
    </>
  );
}
