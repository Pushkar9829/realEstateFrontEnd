// RE-S-LIS-14 invoice detail: GST breakdown, billing, payments and status,
// PDF (fetched with the bearer token), payment proof upload and dispute.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Flag, Paperclip, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Table, Textarea, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import { date, rupees, titleCase } from '@/shared/lib/format';
import { PAYMENT_MODES, openInvoicePdf, paymentStatus, useListerInvoice, useRaiseDispute, useUploadProof } from '@/modules/receivables/listerApi';
import InvoiceStatusBadge from '../../components/InvoiceStatusBadge';
import { useT } from '@/shared/i18n';

const IST = 330 * 60000;
const todayIst = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
// The reason value goes to the API as typed (English); only the label is translated.
const DISPUTE_REASONS = [['Amount is wrong', 'amount'], ['Deal not closed through the platform', 'notOurs'], ['Deal cancelled', 'cancelled'], ['Already paid', 'paid'], ['Other', 'other']];

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className={strong ? 'font-semibold text-ink' : 'text-ink'}>{value}</dd>
    </div>
  );
}

function ProofModal({ inv, open, onClose }) {
  const t = useT();
  const toast = useToast();
  const upload = useUploadProof(inv._id);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ amount: inv.outstanding ? String(Math.round(inv.outstanding / 100)) : '', tds: '', date: todayIst(), mode: 'bank_transfer', reference: '' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const errs = {};
    const amount = Number(form.amount);
    if (!amount || amount <= 0) errs.amount = t('lister.invoices.proof.errAmount');
    else if (inv.outstanding && amount * 100 > inv.outstanding) errs.amount = t('lister.invoices.proof.errMax', { amount: rupees(inv.outstanding) });
    if (!form.date || form.date > todayIst()) errs.date = t('lister.invoices.proof.errDate');
    const ref = form.reference.trim();
    if (ref.length < 4 || ref.length > 40) errs.reference = t('lister.invoices.proof.errRef');
    if (!file) errs.fileId = t('lister.invoices.proof.errFile');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await upload.mutateAsync({ fileId: file.id, amount, ...(form.tds ? { tds: Number(form.tds) } : {}), date: `${form.date}T12:00:00+05:30`, mode: form.mode, reference: ref });
      toast.success(t('lister.invoices.proof.sent'));
      onClose();
    } catch (e) { setErrors(e.fieldErrors); toast.error(e.message); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('lister.invoices.proof.title')} description={t('lister.invoices.proof.desc', { no: inv.invoiceNo, amount: rupees(inv.outstanding) })}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={upload.isPending} onClick={submit}>{t('lister.invoices.proof.submit')}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('lister.invoices.proof.amount')} required leading="₹" type="number" min={1} value={form.amount} onChange={set('amount')} error={errors.amount} />
          <Input label={t('lister.invoices.proof.tds')} leading="₹" type="number" min={0} value={form.tds} onChange={set('tds')} error={errors.tds} />
          <Input label={t('lister.invoices.proof.date')} required type="date" max={todayIst()} value={form.date} onChange={set('date')} error={errors.date} />
          <Select label={t('lister.invoices.col.mode')} required options={PAYMENT_MODES} value={form.mode} onChange={set('mode')} error={errors.mode} />
        </div>
        <Input label={t('lister.invoices.proof.ref')} required maxLength={40} value={form.reference} onChange={set('reference')} error={errors.reference} />
        {file ? (
          <div className="flex items-center justify-between rounded-md border bg-surface-muted px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 text-ink"><Paperclip className="h-4 w-4" />{file.name || t('lister.invoices.proof.uploaded')}</span>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>{t('lister.invoices.proof.replace')}</Button>
          </div>
        ) : (
          <div>
            <FileDrop compact purpose="payment_proof" kind="document" label={t('lister.invoices.proof.drop')} onUploaded={(saved, raw) => setFile({ id: saved.id || saved._id, name: raw && raw.name })} />
            {errors.fileId && <p className="mt-1 text-xs text-danger-600">{errors.fileId}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function DisputeModal({ inv, open, onClose }) {
  const t = useT();
  const toast = useToast();
  const dispute = useRaiseDispute(inv._id);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState({});
  const submit = async () => {
    const errs = {};
    if (!reason) errs.reason = t('lister.offers.chooseReason');
    if (details.trim().length < 20) errs.details = t('lister.invoices.dispute.errDetails');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await dispute.mutateAsync({ reason: `${reason}: ${details.trim()}`.slice(0, 1000) });
      toast.success(t('lister.invoices.dispute.raised'));
      onClose();
    } catch (e) { setErrors({ details: e.fieldErrors.reason }); toast.error(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('lister.invoices.dispute.title')} description={t('lister.invoices.dispute.desc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" loading={dispute.isPending} onClick={submit}>{t('lister.invoices.dispute.raise')}</Button></>}>
      <div className="space-y-4">
        <Select label={t('lister.listings.reason')} required placeholder={t('lister.offers.chooseReason')} options={DISPUTE_REASONS.map(([value, key]) => ({ value, label: t(`lister.invoices.dispute.reasons.${key}`) }))} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
        <Textarea label={t('lister.invoices.dispute.details')} required rows={4} maxLength={950} value={details} onChange={(e) => setDetails(e.target.value)} error={errors.details} hint={t('lister.invoices.dispute.hint', { n: details.trim().length })} />
      </div>
    </Modal>
  );
}

export default function InvoiceDetailPage() {
  const t = useT();
  const { id } = useParams();
  const toast = useToast();
  const { data: inv, isLoading, isError, error, refetch } = useListerInvoice(id);
  const [dialog, setDialog] = useState(null);
  const [opening, setOpening] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) {
    return error && error.status === 404
      ? <EmptyState icon={FileText} title={t('lister.invoices.notFound')} action={<Button variant="secondary" to="/lister/invoices">{t('lister.invoices.back')}</Button>} />
      : <Alert tone="danger" title={t('lister.invoices.loadOne')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />;
  }
  const pdf = async () => {
    setOpening(true);
    try { await openInvoicePdf(inv._id, inv.invoiceNo); } catch (e) { toast.error(e.message); } finally { setOpening(false); }
  };
  const igst = Boolean(inv.igst);
  const issued = inv.status === 'issued';

  return (
    <>
      <PageHeader breadcrumb={<Link to="/lister/invoices" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />{t('panel.nav.listerInvoices')}</Link>}
        title={t('lister.invoices.invoiceNo', { no: inv.invoiceNo })} description={t('lister.invoices.headerDesc', { deal: inv.dealNo || '-', receivable: inv.receivableNo || '-', date: date(inv.date) })}
        actions={<>
          <InvoiceStatusBadge inv={inv} />
          <Button variant="secondary" icon={FileText} loading={opening} onClick={pdf}>{t('lister.invoices.openPdf')}</Button>
          {issued && inv.canUploadProof && <Button icon={Upload} onClick={() => setDialog('proof')}>{t('lister.invoices.proof.title')}</Button>}
          {issued && inv.canDispute && <Button variant="ghost" icon={Flag} onClick={() => setDialog('dispute')}>{t('lister.invoices.dispute.raise')}</Button>}
        </>} />

      {inv.dispute && <Alert tone="warning" className="mb-6" title={t('lister.invoices.disputedOn', { date: date(inv.dispute.raisedAt) })}>{inv.dispute.reason}. {t('lister.invoices.paused')}</Alert>}
      {inv.status === 'cancelled' && inv.creditNote && <Alert tone="info" className="mb-6" title={t('lister.invoices.cancelledCn', { no: inv.creditNote.no })}>{inv.creditNote.reason} ({date(inv.creditNote.date)})</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t('lister.invoices.col.amount')} description={t('lister.invoices.sac', { sac: inv.sacCode || '-', place: inv.placeOfSupply || '-' })} />
            <dl className="divide-y">
              <Row label={t('lister.invoices.taxable')} value={rupees(inv.taxable)} />
              {igst ? <Row label="IGST" value={rupees(inv.igst)} /> : <><Row label="CGST" value={rupees(inv.cgst)} /><Row label="SGST" value={rupees(inv.sgst)} /></>}
              <Row label={t('lister.invoices.invoiceTotal')} value={rupees(inv.total)} strong />
              <Row label={t('lister.invoices.dueDate')} value={date(inv.dueDate)} />
              <Row label={t('lister.invoices.outstanding')} value={rupees(inv.outstanding)} strong />
            </dl>
          </Card>
          <Card padded={false}>
            <div className="p-5 pb-0"><CardHeader title={t('lister.invoices.payments')} description={t('lister.invoices.paymentsDesc')} /></div>
            <Table rows={inv.payments || []} empty={t('lister.invoices.noPayments')} columns={[
              { key: 'date', header: t('lister.invoices.col.date'), render: (p) => date(p.date) },
              { key: 'amount', header: t('lister.invoices.col.amount'), render: (p) => rupees(p.amount) },
              { key: 'tds', header: 'TDS', render: (p) => (p.tds ? rupees(p.tds) : '-') },
              { key: 'mode', header: t('lister.invoices.col.mode'), render: (p) => (PAYMENT_MODES.some((m) => m.value === p.mode) ? t(`lister.invoices.modes.${p.mode}`) : titleCase(p.mode)) },
              { key: 'reference', header: t('lister.invoices.col.reference'), render: (p) => p.reference || '-' },
              { key: 'source', header: t('lister.invoices.col.by'), render: (p) => (p.source === 'lister' ? t('lister.offers.you') : t('lister.invoices.finance')) },
              { key: 'status', header: t('lister.leads.col.status'), render: (p) => { const s = paymentStatus(p.status); return <span><Badge tone={s.tone}>{s.label}</Badge>{p.rejectReason && <span className="block text-xs text-danger-700">{p.rejectReason}</span>}</span>; } },
            ]} />
          </Card>
        </div>
        <Card>
          <CardHeader title={t('lister.invoices.billedTo')} />
          {inv.billing ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-ink-subtle">{t('lister.wizard.loc.name')}</dt><dd className="text-ink">{inv.billing.name || '-'}</dd></div>
              <div><dt className="text-ink-subtle">{t('lister.kyc.details.address')}</dt><dd className="whitespace-pre-line text-ink">{inv.billing.address || '-'}</dd></div>
              <div><dt className="text-ink-subtle">GSTIN</dt><dd className="text-ink">{inv.billing.gstin || t('lister.invoices.unregistered')}</dd></div>
            </dl>
          ) : <p className="text-sm text-ink-subtle">{t('lister.invoices.noBilling')}</p>}
        </Card>
      </div>

      {dialog === 'proof' && <ProofModal inv={inv} open onClose={() => setDialog(null)} />}
      {dialog === 'dispute' && <DisputeModal inv={inv} open onClose={() => setDialog(null)} />}
    </>
  );
}
