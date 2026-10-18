// RE-S-LIS-14 commission invoices: outstanding summary and the invoice table.
import { useState } from 'react';
import { AlertTriangle, FileText, IndianRupee, Receipt } from 'lucide-react';
import { Alert, Button, PageHeader, Stat, Table, Tabs, useToast } from '@/shared/ui';
import { date, rupees } from '@/shared/lib/format';
import { openInvoicePdf, useListerInvoices } from '@/modules/receivables/listerApi';
import InvoiceStatusBadge from '../../components/InvoiceStatusBadge';
import { useT } from '@/shared/i18n';

// Tab labels: lister.invoices.receivableStatus.<value> ('' = All).
const TABS = ['', 'invoiced', 'partially_paid', 'overdue', 'paid', 'disputed', 'cancelled'];

export default function InvoicesPage() {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, isLoading, isError, refetch } = useListerInvoices(status ? { status } : {});
  const all = useListerInvoices({});
  const summary = (all.data && all.data.meta) || {};
  const rows = (data && data.items) || [];

  return (
    <>
      <PageHeader title={t('lister.invoices.title')} description={t('lister.invoices.desc')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t('lister.invoices.totalDue')} icon={IndianRupee} tone="brand" value={all.isLoading ? '...' : rupees(summary.outstanding || 0)} />
        <Stat label={t('lister.invoices.overdueReceivables')} icon={AlertTriangle} tone={summary.overdue ? 'danger' : 'success'} value={all.isLoading ? '...' : summary.overdue || 0} />
        <Stat label={t('panel.nav.listerInvoices')} icon={Receipt} tone="info" value={all.isLoading ? '...' : ((all.data && all.data.items) || []).length} />
      </div>
      <Tabs className="mb-4" value={status} onChange={setStatus} tabs={TABS.map((value) => ({ value, label: value ? t(`lister.invoices.receivableStatus.${value}`) : t('lister.listings.tabs.all'), ...(value === status && data ? { count: rows.length } : {}) }))} />
      {isError ? <Alert tone="danger" title={t('lister.invoices.loadError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} /> : (
        <Table loading={isLoading} rows={rows} empty={t('lister.invoices.none')} rowHref={(r) => `/lister/invoices/${r._id}`} columns={[
          { key: 'invoiceNo', header: t('lister.invoices.col.invoice'), render: (r) => <span><span className="block font-medium text-ink">{r.invoiceNo}</span><span className="text-xs text-ink-subtle">{date(r.date)}</span></span> },
          { key: 'dealNo', header: t('lister.invoices.col.deal'), render: (r) => r.dealNo || '-' },
          { key: 'taxable', header: t('lister.wizard.steps.commission'), render: (r) => rupees(r.taxable) },
          { key: 'gst', header: 'GST', render: (r) => rupees((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0)) },
          { key: 'total', header: t('lister.invoices.col.total'), render: (r) => <span className="font-semibold">{rupees(r.total)}</span> },
          { key: 'dueDate', header: t('lister.invoices.col.due'), render: (r) => date(r.dueDate) },
          { key: 'status', header: t('lister.leads.col.status'), render: (r) => <InvoiceStatusBadge inv={r} /> },
          { key: 'pdf', header: '', render: (r) => <Button size="sm" variant="ghost" icon={FileText} aria-label={t('lister.invoices.openPdfFor', { no: r.invoiceNo })} onClick={(e) => { e.stopPropagation(); openInvoicePdf(r._id, r.invoiceNo).catch((err) => toast.error(err.message)); }} /> },
        ]} />
      )}
    </>
  );
}
