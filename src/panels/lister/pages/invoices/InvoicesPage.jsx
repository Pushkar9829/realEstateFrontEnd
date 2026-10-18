// RE-S-LIS-14 commission invoices: outstanding summary and the invoice table.
import { useState } from 'react';
import { AlertTriangle, FileText, IndianRupee, Receipt } from 'lucide-react';
import { Alert, Button, PageHeader, Stat, Table, Tabs, useToast } from '@/shared/ui';
import { date, rupees } from '@/shared/lib/format';
import { openInvoicePdf, useListerInvoices } from '@/modules/receivables/listerApi';
import InvoiceStatusBadge from '../../components/InvoiceStatusBadge';

const TABS = [
  { value: '', label: 'All' }, { value: 'invoiced', label: 'Due' }, { value: 'partially_paid', label: 'Partly paid' }, { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' }, { value: 'disputed', label: 'Disputed' }, { value: 'cancelled', label: 'Cancelled' },
];

export default function InvoicesPage() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, isLoading, isError, refetch } = useListerInvoices(status ? { status } : {});
  const all = useListerInvoices({});
  const summary = (all.data && all.data.meta) || {};
  const rows = (data && data.items) || [];

  return (
    <>
      <PageHeader title="Commission invoices" description="Invoices for the commission on deals closed through the platform. Upload your payment proof on the invoice; our finance team confirms it." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total due" icon={IndianRupee} tone="brand" value={all.isLoading ? '...' : rupees(summary.outstanding || 0)} />
        <Stat label="Overdue receivables" icon={AlertTriangle} tone={summary.overdue ? 'danger' : 'success'} value={all.isLoading ? '...' : summary.overdue || 0} />
        <Stat label="Invoices" icon={Receipt} tone="info" value={all.isLoading ? '...' : ((all.data && all.data.items) || []).length} />
      </div>
      <Tabs className="mb-4" value={status} onChange={setStatus} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: rows.length } : t))} />
      {isError ? <Alert tone="danger" title="Could not load invoices" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} /> : (
        <Table loading={isLoading} rows={rows} empty="No invoices" rowHref={(r) => `/lister/invoices/${r._id}`} columns={[
          { key: 'invoiceNo', header: 'Invoice', render: (r) => <span><span className="block font-medium text-ink">{r.invoiceNo}</span><span className="text-xs text-ink-subtle">{date(r.date)}</span></span> },
          { key: 'dealNo', header: 'Deal', render: (r) => r.dealNo || '-' },
          { key: 'taxable', header: 'Commission', render: (r) => rupees(r.taxable) },
          { key: 'gst', header: 'GST', render: (r) => rupees((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0)) },
          { key: 'total', header: 'Total', render: (r) => <span className="font-semibold">{rupees(r.total)}</span> },
          { key: 'dueDate', header: 'Due', render: (r) => date(r.dueDate) },
          { key: 'status', header: 'Status', render: (r) => <InvoiceStatusBadge inv={r} /> },
          { key: 'pdf', header: '', render: (r) => <Button size="sm" variant="ghost" icon={FileText} aria-label={`Open ${r.invoiceNo} PDF`} onClick={(e) => { e.stopPropagation(); openInvoicePdf(r._id, r.invoiceNo).catch((err) => toast.error(err.message)); }} /> },
        ]} />
      )}
    </>
  );
}
