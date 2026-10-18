// RE-S-ADM-20 commission receivables (receivables.manage; managers read-only
// for their teams): summary tiles, ageing buckets, filters, CSV export, bulk
// reminders, and the sold-elsewhere checks tab (RE-A-19, RE-D-09).
import { useState } from 'react';
import { AlertTriangle, BellRing, Download, Search, Wallet } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, Pagination, Select, Stat, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useAdminDashboard, useReport } from '@/modules/reports/adminApi';
import { CHECK_STATUS, RECEIVABLE_STATUS, exportReceivablesCsv, receivableStatus, useBulkRemind, useDecideSoldElsewhere, useReceivables, useSoldElsewhereChecks } from '@/modules/receivables/adminApi';
import { HBars } from '../reports/charts';

function SoldElsewhereTab({ canManage }) {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ status: 'no_claim', note: '', claimAmount: '' });
  const { data, isLoading, error } = useSoldElsewhereChecks({ page, limit: 20, ...(status ? { status } : {}) });
  const decide = useDecideSoldElsewhere();

  const save = async () => {
    try {
      await decide.mutateAsync({ id: open._id, body: { status: form.status, note: form.note.trim(), ...(form.status === 'claim_raised' && form.claimAmount ? { claimAmount: Number(form.claimAmount) } : {}) } });
      toast.success(`${open.checkNo} updated`);
      setOpen(null);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select aria-label="Check status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="All statuses"
          options={Object.entries(CHECK_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No sold-elsewhere checks" onRowClick={canManage ? (r) => { setOpen(r); setForm({ status: r.status === 'open' ? 'no_claim' : r.status, note: r.note || '', claimAmount: r.claimAmount ? String(r.claimAmount / 100) : '' }); } : undefined}
        columns={[
          { key: 'checkNo', header: 'Check', render: (r) => <span className="font-medium text-ink">{r.checkNo}</span> },
          { key: 'listing', header: 'Listing', render: (r) => (r.propertyId ? <span className="block max-w-[14rem] truncate">{r.propertyId.listingNo} {r.propertyId.title}</span> : '-') },
          { key: 'lister', header: 'Lister', render: (r) => (r.listerId ? r.listerId.name : '-') },
          { key: 'saleDate', header: 'Reported sale', render: (r) => <span className="whitespace-nowrap">{date(r.saleDate)}{r.price ? ` · ${rupees(r.price)}` : ''}</span> },
          { key: 'source', header: 'Source', render: (r) => titleCase(r.source) },
          { key: 'matches', header: 'Platform activity', render: (r) => <span className="text-xs text-ink-muted">{(r.matches?.leads || []).length} leads · {(r.matches?.visits || []).length} visits · {(r.matches?.offers || []).length} offers</span> },
          { key: 'priority', header: 'Inside window', render: (r) => (r.priority ? <Badge tone="danger" icon={AlertTriangle}>Yes</Badge> : <Badge>No</Badge>) },
          { key: 'status', header: 'Status', render: (r) => { const s = CHECK_STATUS[r.status] || { label: r.status, tone: 'neutral' }; return <Badge tone={s.tone}>{s.label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `Check ${open.checkNo}` : ''} description="A claim is pursued manually with the lister under their agreement; no receivable is created from a check."
        footer={<><Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button><Button loading={decide.isPending} disabled={form.status !== 'closed' && form.note.trim().length < 10} onClick={save}>Save decision</Button></>}>
        <div className="space-y-3">
          <Select label="Outcome" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={[{ value: 'no_claim', label: 'No claim' }, { value: 'claim_raised', label: 'Claim raised' }, { value: 'closed', label: 'Closed' }]} />
          <Textarea label="Note" rows={3} hint="10-1000 characters; required for no claim / claim raised." value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          {form.status === 'claim_raised' && <Input label="Claim amount (INR)" type="number" min="0" value={form.claimAmount} onChange={(e) => setForm((f) => ({ ...f, claimAmount: e.target.value }))} />}
        </div>
      </Modal>
    </>
  );
}

export default function ReceivablesPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('receivables.manage');
  const [tab, setTab] = useState('receivables');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const [remindOpen, setRemindOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const filters = { ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}), ...(city.trim() ? { city: city.trim() } : {}) };
  const { data, isLoading, error } = useReceivables({ page, limit: 20, sort: '-createdAt', ...filters });
  const dash = useAdminDashboard();
  const ageing = useReport('ageing', {}, hasPermission('reports.view'));
  const commission = useReport('commission', {}, hasPermission('reports.view'));
  const remind = useBulkRemind();
  const rec = dash.data && dash.data.receivables;
  const cs = commission.data && commission.data.summary;

  const doExport = async () => {
    setExporting(true);
    try { await exportReceivablesCsv(filters); } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };
  const doRemind = async () => {
    try {
      const r = await remind.mutateAsync({});
      toast.success(`Reminders sent to ${r.sent} of ${r.considered} receivables in collection`);
      setRemindOpen(false);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Commission receivables" description="Invoices, payments, disputes and write-offs for commission on verified deals."
        actions={tab === 'receivables' && <>
          <Button variant="secondary" icon={Download} loading={exporting} onClick={doExport}>Export CSV</Button>
          {canManage && <Button icon={BellRing} onClick={() => setRemindOpen(true)}>Send reminders</Button>}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Outstanding" value={rec ? rupees(rec.outstanding) : '-'} hint={rec ? `${rec.open} open receivables` : undefined} />
        <Stat icon={AlertTriangle} tone="danger" label="Overdue" value={rec ? rec.overdue : '-'} hint="Past the invoice due date" />
        <Stat tone="success" label="Commission verified (30 days)" value={cs ? rupees(cs.commission) : '-'} hint={cs ? `Invoiced ${rupees(cs.invoiced)}` : 'Needs reports.view'} />
        <Stat tone="info" label="Received (30 days)" value={cs ? rupees(cs.received) : '-'} />
      </div>

      {ageing.data && (
        <Card className="mb-6">
          <CardHeader title="Ageing" description={`Outstanding on issued invoices by days past due. Uninvoiced ${rupees(ageing.data.summary.uninvoiced)} · disputed ${rupees(ageing.data.summary.disputed)}.`} />
          <HBars format={rupees} rows={ageing.data.rows.map((r) => ({ label: r.bucket === 'current' ? 'Not yet due' : `${r.bucket} days`, value: r.amount, hint: `(${r.receivables})`, tone: r.bucket === 'current' ? 'success' : r.bucket === '0-30' ? 'warning' : 'danger' }))} />
        </Card>
      )}

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'receivables', label: 'Receivables', ...(data && tab === 'receivables' ? { count: data.meta.total } : {}) }, ...(canManage ? [{ value: 'sold', label: 'Sold-elsewhere checks' }] : [])]} />

      {tab === 'sold' ? <SoldElsewhereTab canManage={canManage} /> : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[16rem_14rem]">
            <Input aria-label="Search" placeholder="Receivable, deal or invoice no." leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <Input aria-label="City" placeholder="City" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} />
            <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="All statuses"
              options={Object.entries(RECEIVABLE_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          </div>
          {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
          <Table loading={isLoading} rows={(data && data.items) || []} rowHref={(r) => `/admin/receivables/${r._id}`} empty="No receivables match these filters"
            columns={[
              { key: 'receivableNo', header: 'Receivable', render: (r) => <span><span className="block font-medium text-ink">{r.receivableNo}</span><span className="text-xs text-ink-subtle">Deal {r.dealNo}</span></span> },
              { key: 'lister', header: 'Lister', render: (r) => (r.listerId ? (r.listerId.billing?.name || r.listerId.name) : '-') },
              { key: 'commission', header: 'Commission', render: (r) => <span className="whitespace-nowrap">{rupees(r.commissionAmount)}</span> },
              { key: 'gst', header: 'GST', render: (r) => <span className="whitespace-nowrap">{rupees(r.gstAmount)}</span> },
              { key: 'invoiced', header: 'Invoiced', render: (r) => <span className="whitespace-nowrap">{rupees(r.invoicedTotal)}</span> },
              { key: 'paid', header: 'Received', render: (r) => <span className="whitespace-nowrap">{rupees(r.paidTotal)}</span> },
              { key: 'outstanding', header: 'Outstanding', render: (r) => <span className="whitespace-nowrap font-medium">{rupees(r.outstanding)}</span> },
              { key: 'dueDate', header: 'Due', render: (r) => <span className="whitespace-nowrap">{date(r.dueDate)}</span> },
              { key: 'status', header: 'Status', render: (r) => { const s = receivableStatus(r.status); return <span className="flex flex-wrap gap-1"><Badge tone={s.tone}>{s.label}</Badge>{r.pendingProofs > 0 && <Badge tone="info">{r.pendingProofs} proof{r.pendingProofs > 1 ? 's' : ''}</Badge>}</span>; } },
            ]} />
          {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
        </>
      )}

      <Modal open={remindOpen} onClose={() => setRemindOpen(false)} title="Send payment reminders" description="Emails and SMS every lister with an issued, unpaid invoice (invoiced, partially paid or overdue). Disputed receivables are skipped."
        footer={<><Button variant="secondary" onClick={() => setRemindOpen(false)}>Cancel</Button><Button icon={BellRing} loading={remind.isPending} onClick={doRemind}>Send reminders</Button></>}>
        <p className="text-sm text-ink-muted">Each reminder states the outstanding amount and the due date of the oldest issued invoice.</p>
      </Modal>
    </>
  );
}
