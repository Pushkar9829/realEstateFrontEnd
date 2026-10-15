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

const IST = 330 * 60000;
const todayIst = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const DISPUTE_REASONS = [
  { value: 'Amount is wrong', label: 'Amount is wrong' },
  { value: 'Deal not closed through the platform', label: 'Deal not closed through the platform' },
  { value: 'Deal cancelled', label: 'Deal cancelled' },
  { value: 'Already paid', label: 'Already paid' },
  { value: 'Other', label: 'Other' },
];

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className={strong ? 'font-semibold text-ink' : 'text-ink'}>{value}</dd>
    </div>
  );
}

function ProofModal({ inv, open, onClose }) {
  const toast = useToast();
  const upload = useUploadProof(inv._id);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ amount: inv.outstanding ? String(Math.round(inv.outstanding / 100)) : '', tds: '', date: todayIst(), mode: 'bank_transfer', reference: '' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const errs = {};
    const amount = Number(form.amount);
    if (!amount || amount <= 0) errs.amount = 'Enter the amount paid';
    else if (inv.outstanding && amount * 100 > inv.outstanding) errs.amount = `At most ${rupees(inv.outstanding)} is outstanding`;
    if (!form.date || form.date > todayIst()) errs.date = 'The payment date cannot be in the future';
    const ref = form.reference.trim();
    if (ref.length < 4 || ref.length > 40) errs.reference = 'Enter the UTR / reference (4-40 characters)';
    if (!file) errs.fileId = 'Upload the payment proof';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await upload.mutateAsync({ fileId: file.id, amount, ...(form.tds ? { tds: Number(form.tds) } : {}), date: `${form.date}T12:00:00+05:30`, mode: form.mode, reference: ref });
      toast.success('Payment proof sent. Our finance team will confirm it.');
      onClose();
    } catch (e) { setErrors(e.fieldErrors); toast.error(e.message); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload payment proof" description={`Invoice ${inv.invoiceNo} · outstanding ${rupees(inv.outstanding)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={upload.isPending} onClick={submit}>Submit proof</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Amount paid" required leading="₹" type="number" min={1} value={form.amount} onChange={set('amount')} error={errors.amount} />
          <Input label="TDS deducted (optional)" leading="₹" type="number" min={0} value={form.tds} onChange={set('tds')} error={errors.tds} />
          <Input label="Payment date" required type="date" max={todayIst()} value={form.date} onChange={set('date')} error={errors.date} />
          <Select label="Mode" required options={PAYMENT_MODES} value={form.mode} onChange={set('mode')} error={errors.mode} />
        </div>
        <Input label="UTR / reference" required maxLength={40} value={form.reference} onChange={set('reference')} error={errors.reference} />
        {file ? (
          <div className="flex items-center justify-between rounded-md border bg-surface-muted px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 text-ink"><Paperclip className="h-4 w-4" />{file.name || 'Proof uploaded'}</span>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>Replace</Button>
          </div>
        ) : (
          <div>
            <FileDrop compact purpose="payment_proof" kind="document" label="Upload the proof (bank slip, UPI screenshot or PDF)" onUploaded={(saved, raw) => setFile({ id: saved.id || saved._id, name: raw && raw.name })} />
            {errors.fileId && <p className="mt-1 text-xs text-danger-600">{errors.fileId}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function DisputeModal({ inv, open, onClose }) {
  const toast = useToast();
  const dispute = useRaiseDispute(inv._id);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState({});
  const submit = async () => {
    const errs = {};
    if (!reason) errs.reason = 'Choose a reason';
    if (details.trim().length < 20) errs.details = 'Explain in at least 20 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await dispute.mutateAsync({ reason: `${reason}: ${details.trim()}`.slice(0, 1000) });
      toast.success('Dispute raised. Reminders are paused while our finance team reviews it.');
      onClose();
    } catch (e) { setErrors({ details: e.fieldErrors.reason }); toast.error(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Raise a dispute" description="Collection and reminders pause until our finance team resolves it. One open dispute per receivable."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={dispute.isPending} onClick={submit}>Raise dispute</Button></>}>
      <div className="space-y-4">
        <Select label="Reason" required placeholder="Choose a reason" options={DISPUTE_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
        <Textarea label="Details" required rows={4} maxLength={950} value={details} onChange={(e) => setDetails(e.target.value)} error={errors.details} hint={`${details.trim().length}/950, at least 20`} />
      </div>
    </Modal>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: inv, isLoading, isError, error, refetch } = useListerInvoice(id);
  const [dialog, setDialog] = useState(null);
  const [opening, setOpening] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) {
    return error && error.status === 404
      ? <EmptyState icon={FileText} title="Invoice not found" action={<Button variant="secondary" to="/lister/invoices">Back to invoices</Button>} />
      : <Alert tone="danger" title="Could not load the invoice" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />;
  }
  const pdf = async () => {
    setOpening(true);
    try { await openInvoicePdf(inv._id, inv.invoiceNo); } catch (e) { toast.error(e.message); } finally { setOpening(false); }
  };
  const igst = Boolean(inv.igst);
  const issued = inv.status === 'issued';

  return (
    <>
      <PageHeader breadcrumb={<Link to="/lister/invoices" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />Invoices</Link>}
        title={`Invoice ${inv.invoiceNo}`} description={`Deal ${inv.dealNo || '-'} · receivable ${inv.receivableNo || '-'} · issued ${date(inv.date)}`}
        actions={<>
          <InvoiceStatusBadge inv={inv} />
          <Button variant="secondary" icon={FileText} loading={opening} onClick={pdf}>Open PDF</Button>
          {issued && inv.canUploadProof && <Button icon={Upload} onClick={() => setDialog('proof')}>Upload payment proof</Button>}
          {issued && inv.canDispute && <Button variant="ghost" icon={Flag} onClick={() => setDialog('dispute')}>Raise dispute</Button>}
        </>} />

      {inv.dispute && <Alert tone="warning" className="mb-6" title={`Disputed on ${date(inv.dispute.raisedAt)}`}>{inv.dispute.reason}. Collection is paused while our finance team reviews it.</Alert>}
      {inv.status === 'cancelled' && inv.creditNote && <Alert tone="info" className="mb-6" title={`Cancelled · credit note ${inv.creditNote.no}`}>{inv.creditNote.reason} ({date(inv.creditNote.date)})</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Amount" description={`SAC ${inv.sacCode || '-'} · place of supply ${inv.placeOfSupply || '-'}`} />
            <dl className="divide-y">
              <Row label="Commission (taxable value)" value={rupees(inv.taxable)} />
              {igst ? <Row label="IGST" value={rupees(inv.igst)} /> : <><Row label="CGST" value={rupees(inv.cgst)} /><Row label="SGST" value={rupees(inv.sgst)} /></>}
              <Row label="Invoice total" value={rupees(inv.total)} strong />
              <Row label="Due date" value={date(inv.dueDate)} />
              <Row label="Outstanding on this receivable" value={rupees(inv.outstanding)} strong />
            </dl>
          </Card>
          <Card padded={false}>
            <div className="p-5 pb-0"><CardHeader title="Payments" description="Proofs you upload stay under review until our finance team confirms them." /></div>
            <Table rows={inv.payments || []} empty="No payments recorded yet" columns={[
              { key: 'date', header: 'Date', render: (p) => date(p.date) },
              { key: 'amount', header: 'Amount', render: (p) => rupees(p.amount) },
              { key: 'tds', header: 'TDS', render: (p) => (p.tds ? rupees(p.tds) : '-') },
              { key: 'mode', header: 'Mode', render: (p) => titleCase(p.mode) },
              { key: 'reference', header: 'Reference', render: (p) => p.reference || '-' },
              { key: 'source', header: 'By', render: (p) => (p.source === 'lister' ? 'You' : 'Finance') },
              { key: 'status', header: 'Status', render: (p) => { const s = paymentStatus(p.status); return <span><Badge tone={s.tone}>{s.label}</Badge>{p.rejectReason && <span className="block text-xs text-danger-700">{p.rejectReason}</span>}</span>; } },
            ]} />
          </Card>
        </div>
        <Card>
          <CardHeader title="Billed to" />
          {inv.billing ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-ink-subtle">Name</dt><dd className="text-ink">{inv.billing.name || '-'}</dd></div>
              <div><dt className="text-ink-subtle">Address</dt><dd className="whitespace-pre-line text-ink">{inv.billing.address || '-'}</dd></div>
              <div><dt className="text-ink-subtle">GSTIN</dt><dd className="text-ink">{inv.billing.gstin || 'Unregistered'}</dd></div>
            </dl>
          ) : <p className="text-sm text-ink-subtle">No billing details on this invoice.</p>}
        </Card>
      </div>

      {dialog === 'proof' && <ProofModal inv={inv} open onClose={() => setDialog(null)} />}
      {dialog === 'dispute' && <DisputeModal inv={inv} open onClose={() => setDialog(null)} />}
    </>
  );
}
