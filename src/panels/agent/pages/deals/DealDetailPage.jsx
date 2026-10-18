// RE-S-AGT-13 Deal editor: summary, commercial terms (draft / returned),
// server-computed commission, documents, closure checklist, submit, cancel,
// warnings, admin comments, history and the rental agreement request (rent).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, FileSignature, FileText, Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, ConfirmModal, EmptyState, Input, PageHeader, Skeleton, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, rupees } from '@/shared/lib/format';
import FileDrop from '@/shared/components/FileDrop';
import { useT } from '@/shared/i18n';
import { errorText } from '@/modules/leads/agentApi';
import { DEAL_EDITABLE, DOC_KINDS, PAYMENT_MODES, dealApi, dealStatus, useAgentDeal, useDealMutation } from '@/modules/deals/agentApi';
import DealForm, { dealInitial } from '../../components/DealForm';
import { RentalAgreementModal } from '../../components/ExtraModals';
import { ErrorState, ReasonModal, Section, listingStatus } from '../../components/common';

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
  const t = useT();
  const toast = useToast();
  const add = useDealMutation(dealApi.addDocument);
  const remove = useDealMutation(dealApi.removeDocument);
  const [labels, setLabels] = useState({});
  const [ref, setRef] = useState('');
  const docs = deal.documents || [];
  const attach = (kind) => async (file, raw) => {
    try {
      await add.mutateAsync({ id: deal._id, body: { fileId: file.id, kind, label: (labels[kind] || '').trim() || raw.name.slice(0, 120), ...(kind === 'receipt' && ref.trim() ? { reference: ref.trim() } : {}) } });
      toast.success(t('agent.deal.attached', { name: raw.name }));
    } catch (e) { toast.error(errorText(e)); throw e; }
  };
  const drop = async (d) => { try { await remove.mutateAsync({ id: deal._id, docId: d._id }); toast.success(t('agent.deal.docRemoved')); } catch (e) { toast.error(errorText(e)); } };
  return (
    <Section title={t('agent.deal.documents')}>
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
                      <span className="inline-flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-ink-subtle" /><span className="truncate">{d.label}</span>{d.reference && <span className="text-xs text-ink-subtle">{t('agent.deal.ref', { ref: d.reference })}</span>}</span>
                      {editable && <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('agent.outcome.removePhoto', { name: d.label })} loading={remove.isPending} onClick={() => drop(d)} />}
                    </li>
                  ))}
                </ul>
              )}
              {editable && list.length < k.max && (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input aria-label={t('agent.deal.labelAria', { kind: k.label })} placeholder={t('agent.deal.labelPh')} maxLength={120} value={labels[kind] || ''} onChange={(e) => setLabels((x) => ({ ...x, [kind]: e.target.value }))} />
                    {kind === 'receipt' && <Input aria-label={t('agent.deal.receiptRef')} placeholder={t('agent.deal.receiptRefPh')} maxLength={80} value={ref} onChange={(e) => setRef(e.target.value)} />}
                  </div>
                  <FileDrop compact purpose={k.purpose} kind="document" multiple onUploaded={attach(kind)} label={t('agent.deal.upload', { kind: k.label.toLowerCase() })} />
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-ink-subtle">{t('agent.deal.filesPrivate')}</p>
      </div>
    </Section>
  );
}

export default function DealDetailPage() {
  const t = useT();
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
  if (error && error.status === 404) return <EmptyState icon={FileSignature} title={t('agent.deal.notFound')} description={t('agent.deal.notFoundDesc')} action={<Button variant="secondary" to="/agent/deals">{t('agent.deal.back')}</Button>} />;
  if (error) return <ErrorState error={error} onRetry={refetch} title={t('agent.deal.loadError')} />;

  const s = dealStatus(deal.status);
  const editable = DEAL_EDITABLE.includes(deal.status);
  const rent = deal.dealType === 'rent';
  const price = rent ? deal.monthlyRent : deal.agreedPrice;
  const c = deal.checklist || {};
  const tg = deal.target || {};
  const checks = [
    [c.completedVisit, t('agent.deal.check.visit')],
    [c.receipts > 0, t('agent.deal.check.receipt')],
    [c.agreements > 0, t('agent.deal.check.agreement')],
    [Boolean(price), rent ? t('agent.dealForm.rent') : t('agent.dealForm.price')],
    [deal.bookingAmount > 0 && (rent || !price || deal.bookingAmount <= price), t('agent.deal.check.booking')],
    [Boolean(deal.bookingDate), t('agent.dealForm.bookingDate')],
    [Boolean(deal.paymentMode) && (deal.paymentMode === 'cash' || Boolean(deal.paymentReference)), t('agent.deal.check.payment')],
    [!(c.duplicateReceipts || []).length, (c.duplicateReceipts || []).length ? t('agent.deal.check.duplicate', { list: c.duplicateReceipts.join(', ') }) : t('agent.deal.check.noDuplicate')],
  ];
  const ready = checks.every(([ok]) => ok);
  const minDate = deal.lead && deal.lead.createdAt ? new Date(new Date(deal.lead.createdAt).getTime() + 330 * 60000).toISOString().slice(0, 10) : undefined;

  const save = async (body) => {
    try { await edit.mutateAsync({ id: deal._id, body }); toast.success(t('agent.deal.saved')); setErrors({}); setEditing(false); } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  const doSubmit = async () => {
    setConfirmSubmit(false);
    setSubmitErrors([]);
    try {
      const r = await submit.mutateAsync({ id: deal._id });
      setWarnings(r.warnings || []);
      toast.success(t('agent.deal.submitted'));
    } catch (e) {
      const list = Array.isArray(e.details) ? e.details.filter((d) => d && d.message).map((d) => d.message) : [];
      setSubmitErrors(list.length ? list : [e.message]);
      toast.error(e.message);
    }
  };
  const doCancel = async (reason) => { try { await cancel.mutateAsync({ id: deal._id, reason }); toast.success(t('agent.deal.cancelled')); setModal(''); } catch (e) { toast.error(errorText(e)); } };

  const terms = [
    [rent ? t('agent.deal.monthlyRent') : t('agent.dealForm.price'), rupees(price)], [rent ? t('agent.deal.depositFirst') : t('agent.deal.bookingAmount'), rupees(deal.bookingAmount)], [t('agent.dealForm.bookingDate'), date(deal.bookingDate)],
    [t('agent.deal.payment'), deal.paymentMode ? (PAYMENT_MODES.find((p) => p.value === deal.paymentMode) || {}).label : '-'], [t('agent.deal.reference'), deal.paymentReference || '-'],
    ...(deal.unitNo ? [[t('agent.deal.unit'), deal.unitNo]] : []),
  ];

  return (
    <>
      <PageHeader breadcrumb={<Link to="/agent/deals" className="hover:text-ink">{t('panel.nav.agentDeals')}</Link>} title={deal.dealNo}
        description={`${rent ? t('common.rent') : t('common.sale')} · ${tg.ref || ''} ${tg.title || tg.name || ''}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {rent && !['cancelled', 'rejected', 'reversed'].includes(deal.status) && <Button variant="secondary" icon={FileSignature} onClick={() => setModal('rental')}>{t('agent.deal.rental')}</Button>}
          {editable && <Button variant="ghost" icon={XCircle} onClick={() => setModal('cancel')}>{t('agent.deal.cancelDeal')}</Button>}
          {editable && <Button icon={Send} disabled={!ready} loading={submit.isPending} onClick={() => setConfirmSubmit(true)} title={ready ? undefined : t('agent.deal.checklistFirst')}>{deal.status === 'returned' ? t('agent.deal.resubmit') : t('common.submit')}</Button>}
        </>} />

      <ConfirmModal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} onConfirm={doSubmit} loading={submit.isPending} confirmLabel={t('agent.deal.submitConfirm')} title={t('agent.deal.submitTitle', { no: deal.dealNo })}>
        {t('agent.deal.submitText')}
      </ConfirmModal>
      {deal.status === 'returned' && <Alert tone="warning" className="mb-4" title={t('agent.deal.returnedTitle')}>{(deal.review && deal.review.comment) || t('agent.deal.returnedText')}{deal.resubmissionCount ? ` · ${t('agent.deal.resubmitted', { n: deal.resubmissionCount })}` : ''}</Alert>}
      {deal.status === 'rejected' && <Alert tone="danger" className="mb-4" title={t('agent.dealStatus.rejected')}>{deal.review && (deal.review.rejectReason || deal.review.comment)}</Alert>}
      {['submitted', 'under_review'].includes(deal.status) && <Alert tone="info" className="mb-4" title={t('agent.deal.awaitingTitle')}>{t('agent.deal.awaitingText')}</Alert>}
      {deal.status === 'verified' && <Alert tone="success" className="mb-4" title={t('agent.dealStatus.verified')}>{t('agent.deal.verifiedText', { at: dateTime(deal.review && deal.review.verifiedAt) })}</Alert>}
      {deal.status === 'cancelled' && <Alert tone="info" className="mb-4">{t('agent.visits.cancelled', { reason: deal.cancelReason })}</Alert>}
      {deal.status === 'reversed' && <Alert tone="danger" className="mb-4" title={t('agent.dealStatus.reversed')}>{deal.reversal && deal.reversal.reason}</Alert>}
      {submitErrors.length > 0 && <Alert tone="danger" className="mb-4" title={t('agent.deal.cannotSubmit')}><ul className="list-disc pl-5">{submitErrors.map((m) => <li key={m}>{m}</li>)}</ul></Alert>}
      {warnings.length > 0 && <Alert tone="warning" className="mb-4" title={t('agent.deal.withWarnings')}><ul className="list-disc pl-5">{warnings.map((w) => <li key={w.code}>{w.code === 'CASH_269ST' ? t('agent.deal.warnCash') : w.code === 'PRICE_DEVIATION' ? t('agent.deal.warnPrice') : ''}{w.message}</li>)}</ul></Alert>}
      {c.cashWarning && <Alert tone="warning" className="mb-4" title={t('agent.deal.cashTitle')}>{t('agent.deal.cashText')}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title={t('agent.deal.terms')} action={editable && !editing && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>{t('agent.activity.edit')}</Button>}>
            {editable && editing ? (
              <DealForm dealType={deal.dealType} initial={dealInitial(deal)} isProject={Boolean(deal.projectId)} minDate={minDate}
                previewTarget={{ leadId: idOf(deal.leadId), ...(deal.projectId ? { projectId: idOf(deal.projectId) } : { propertyId: idOf(deal.propertyId) }) }}
                offer={null} errors={errors} loading={edit.isPending} onCancel={() => setEditing(false)} onSubmit={save} />
            ) : (
              <>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{terms.map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-ink-subtle">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>)}</dl>
                {deal.justification && <p className="mt-3 text-sm text-ink-muted"><span className="font-medium text-ink">{t('agent.deal.justification')}</span> {deal.justification}</p>}
                {deal.notes && <p className="mt-2 rounded-md bg-surface-muted p-2 text-sm text-ink-muted">{deal.notes}</p>}
                {editable && !deal.bookingDate && <Button className="mt-3" size="sm" icon={Pencil} onClick={() => setEditing(true)}>{t('agent.deal.fillTerms')}</Button>}
              </>
            )}
          </Section>
          <Documents deal={deal} editable={editable} />
          {(deal.statusHistory || []).length > 0 && (
            <Section title={t('agent.deal.history')}>
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
            <h3 className="text-base font-semibold text-ink">{t('agent.dealForm.commission')}</h3>
            <p className="mt-1 text-xs text-ink-subtle">{t('agent.deal.commissionHint')}</p>
            {deal.commissionAmount != null ? (
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-subtle">{t('agent.deal.rate')}</dt><dd className="text-ink">{t(deal.commissionBasis === 'annual_rent' ? 'agent.deal.rateRent' : 'agent.deal.rateSale', { percent: deal.commissionPercent })}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-subtle">{t('agent.dealForm.commission')}</dt><dd className="font-semibold text-ink">{rupees(deal.commissionAmount)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-subtle">GST {deal.gst && deal.gst.percent ? `${deal.gst.percent}%` : ''} {deal.gst ? (deal.gst.interState ? '(IGST)' : '(CGST + SGST)') : ''}</dt><dd className="text-ink">{rupees(deal.gstAmount)}</dd></div>
                <div className="flex justify-between border-t pt-1.5"><dt className="text-ink-subtle">{t('agent.deal.total')}</dt><dd className="font-semibold text-ink">{rupees((deal.commissionAmount || 0) + (deal.gstAmount || 0))}</dd></div>
              </dl>
            ) : <p className="mt-3 text-sm text-warning-700">{t('agent.deal.noAgreement')}</p>}
          </Card>
          <Card>
            <h3 className="mb-3 text-base font-semibold text-ink">{t('agent.deal.checklist')}</h3>
            <ul className="space-y-2">{checks.map(([ok, text]) => <Check key={text} ok={ok}>{text}</Check>)}</ul>
            {(deal.completedVisits || []).length > 0 && <p className="mt-3 text-xs text-ink-subtle">{t('agent.deal.visits', { list: deal.completedVisits.map((v) => `${v.visitNo} (${date(v.scheduledAt)})`).join(', ') })}</p>}
            {editable && <p className={cn('mt-3 text-xs', ready ? 'text-success-700' : 'text-ink-subtle')}>{ready ? t('agent.deal.ready') : t('agent.deal.notReady')}</p>}
          </Card>
          <Card className="space-y-1 text-sm">
            <h3 className="mb-2 text-base font-semibold text-ink">{t('agent.deal.parties')}</h3>
            {deal.lead && <p>{t('agent.visits.buyer')} <Link to={`/agent/leads/${deal.lead._id}`} className="font-medium text-brand-700 hover:underline">{deal.lead.buyer && deal.lead.buyer.name}</Link> <span className="text-xs text-ink-subtle">({deal.lead.leadNo})</span></p>}
            {tg.kind === 'property' && <p>{t('agent.schedule.propertyLabel')} <Link to={`/agent/properties/${tg._id}`} className="font-medium text-brand-700 hover:underline">{tg.ref}</Link> · {tg.title}<span className="block text-xs text-ink-subtle">{[tg.locality, tg.city].filter(Boolean).join(', ')} · {listingStatus(tg.status)}</span></p>}
            {tg.kind === 'project' && <p>{t('agent.deal.project')} <span className="font-medium text-ink">{tg.ref}</span> · {tg.name}</p>}
            {tg.price && <p className="text-xs text-ink-subtle">{t('agent.deal.listedAt', { amount: rupees(rent ? tg.price.monthlyRent : tg.price.amount) })}</p>}
          </Card>
        </div>
      </div>

      <ReasonModal open={modal === 'cancel'} onClose={() => setModal('')} title={t('agent.deal.cancelTitle')} description={t('agent.deal.cancelDesc')} label={t('agent.common.reason')} min={5} max={500} confirmLabel={t('agent.deal.cancelDeal')} danger loading={cancel.isPending} onSubmit={doCancel} />
      <RentalAgreementModal open={modal === 'rental'} onClose={() => setModal('')} deal={deal} />
    </>
  );
}
