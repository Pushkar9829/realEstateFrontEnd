// RE-S-ADM-20 commission receivables (receivables.manage; managers read-only
// for their teams): summary tiles, ageing buckets, filters, CSV export, bulk
// reminders, and the sold-elsewhere checks tab (RE-A-19, RE-D-09).
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { AlertTriangle, BellRing, Download, Search, Wallet } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, Pagination, Select, Stat, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useAdminDashboard, useReport } from '@/modules/reports/adminApi';
import { CHECK_STATUS, RECEIVABLE_STATUS, exportReceivablesCsv, receivableStatus, useBulkRemind, useDecideSoldElsewhere, useReceivables, useSoldElsewhereChecks } from '@/modules/receivables/adminApi';
import { HBars } from '../reports/charts';

function SoldElsewhereTab({ canManage }) {
  const t = useT();
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
      toast.success(t('admin.receivables.list.sold.updated', { no: open.checkNo }));
      setOpen(null);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select aria-label={t('admin.receivables.list.sold.checkStatus')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('admin.receivables.list.allStatuses')}
          options={Object.entries(CHECK_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('admin.receivables.list.sold.empty')} onRowClick={canManage ? (r) => { setOpen(r); setForm({ status: r.status === 'open' ? 'no_claim' : r.status, note: r.note || '', claimAmount: r.claimAmount ? String(r.claimAmount / 100) : '' }); } : undefined}
        columns={[
          { key: 'checkNo', header: t('admin.receivables.list.sold.col.check'), render: (r) => <span className="font-medium text-ink">{r.checkNo}</span> },
          { key: 'listing', header: t('admin.receivables.list.sold.col.listing'), render: (r) => (r.propertyId ? <span className="block max-w-[14rem] truncate">{r.propertyId.listingNo} {r.propertyId.title}</span> : '-') },
          { key: 'lister', header: t('admin.receivables.list.col.lister'), render: (r) => (r.listerId ? r.listerId.name : '-') },
          { key: 'saleDate', header: t('admin.receivables.list.sold.col.saleDate'), render: (r) => <span className="whitespace-nowrap">{date(r.saleDate)}{r.price ? ` · ${rupees(r.price)}` : ''}</span> },
          { key: 'source', header: t('admin.receivables.list.sold.col.source'), render: (r) => titleCase(r.source) },
          { key: 'matches', header: t('admin.receivables.list.sold.col.matches'), render: (r) => <span className="text-xs text-ink-muted">{t('admin.receivables.list.sold.matches', { leads: (r.matches?.leads || []).length, visits: (r.matches?.visits || []).length, offers: (r.matches?.offers || []).length })}</span> },
          { key: 'priority', header: t('admin.receivables.list.sold.col.priority'), render: (r) => (r.priority ? <Badge tone="danger" icon={AlertTriangle}>{t('common.yes')}</Badge> : <Badge>{t('common.no')}</Badge>) },
          { key: 'status', header: t('admin.receivables.list.col.status'), render: (r) => { const s = CHECK_STATUS[r.status] || { label: r.status, tone: 'neutral' }; return <Badge tone={s.tone}>{s.label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? t('admin.receivables.list.sold.modalTitle', { no: open.checkNo }) : ''} description={t('admin.receivables.list.sold.modalDescription')}
        footer={<><Button variant="secondary" onClick={() => setOpen(null)}>{t('common.cancel')}</Button><Button loading={decide.isPending} disabled={form.status !== 'closed' && form.note.trim().length < 10} onClick={save}>{t('admin.receivables.list.sold.saveDecision')}</Button></>}>
        <div className="space-y-3">
          <Select label={t('admin.receivables.list.sold.outcome')} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={['no_claim', 'claim_raised', 'closed'].map((value) => ({ value, label: CHECK_STATUS[value].label }))} />
          <Textarea label={t('admin.receivables.list.sold.note')} rows={3} hint={t('admin.receivables.list.sold.noteHint')} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          {form.status === 'claim_raised' && <Input label={t('admin.receivables.list.sold.claimAmount')} type="number" min="0" value={form.claimAmount} onChange={(e) => setForm((f) => ({ ...f, claimAmount: e.target.value }))} />}
        </div>
      </Modal>
    </>
  );
}

export default function ReceivablesPage() {
  const t = useT();
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
      toast.success(t('admin.receivables.list.remindersSent', { sent: r.sent, considered: r.considered }));
      setRemindOpen(false);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title={t('admin.receivables.list.title')} description={t('admin.receivables.list.description')}
        actions={tab === 'receivables' && <>
          <Button variant="secondary" icon={Download} loading={exporting} onClick={doExport}>{t('admin.receivables.list.exportCsv')}</Button>
          {canManage && <Button icon={BellRing} onClick={() => setRemindOpen(true)}>{t('admin.receivables.list.sendReminders')}</Button>}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label={t('admin.receivables.list.stat.outstanding')} value={rec ? rupees(rec.outstanding) : '-'} hint={rec ? t('admin.receivables.list.stat.open', { n: rec.open }) : undefined} />
        <Stat icon={AlertTriangle} tone="danger" label={t('admin.receivables.list.stat.overdue')} value={rec ? rec.overdue : '-'} hint={t('admin.receivables.list.stat.overdueHint')} />
        <Stat tone="success" label={t('admin.receivables.list.stat.commission')} value={cs ? rupees(cs.commission) : '-'} hint={cs ? t('admin.receivables.list.stat.invoiced', { amount: rupees(cs.invoiced) }) : t('admin.receivables.list.stat.needsReports')} />
        <Stat tone="info" label={t('admin.receivables.list.stat.received')} value={cs ? rupees(cs.received) : '-'} />
      </div>

      {ageing.data && (
        <Card className="mb-6">
          <CardHeader title={t('admin.receivables.list.ageing.title')} description={t('admin.receivables.list.ageing.description', { uninvoiced: rupees(ageing.data.summary.uninvoiced), disputed: rupees(ageing.data.summary.disputed) })} />
          <HBars format={rupees} rows={ageing.data.rows.map((r) => ({ label: r.bucket === 'current' ? t('admin.receivables.list.ageing.notDue') : t('admin.receivables.list.ageing.days', { bucket: r.bucket }), value: r.amount, hint: `(${r.receivables})`, tone: r.bucket === 'current' ? 'success' : r.bucket === '0-30' ? 'warning' : 'danger' }))} />
        </Card>
      )}

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'receivables', label: t('admin.receivables.list.tabs.receivables'), ...(data && tab === 'receivables' ? { count: data.meta.total } : {}) }, ...(canManage ? [{ value: 'sold', label: t('admin.receivables.list.tabs.sold') }] : [])]} />

      {tab === 'sold' ? <SoldElsewhereTab canManage={canManage} /> : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[16rem_14rem]">
            <Input aria-label={t('admin.receivables.list.search')} placeholder={t('admin.receivables.list.searchPlaceholder')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <Input aria-label={t('common.city')} placeholder={t('common.city')} value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} />
            <Select aria-label={t('admin.receivables.list.col.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('admin.receivables.list.allStatuses')}
              options={Object.entries(RECEIVABLE_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          </div>
          {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
          <Table loading={isLoading} rows={(data && data.items) || []} rowHref={(r) => `/admin/receivables/${r._id}`} empty={t('admin.receivables.list.empty')}
            columns={[
              { key: 'receivableNo', header: t('admin.receivables.list.col.receivable'), render: (r) => <span><span className="block font-medium text-ink">{r.receivableNo}</span><span className="text-xs text-ink-subtle">{t('admin.receivables.list.dealNo', { no: r.dealNo })}</span></span> },
              { key: 'lister', header: t('admin.receivables.list.col.lister'), render: (r) => (r.listerId ? (r.listerId.billing?.name || r.listerId.name) : '-') },
              { key: 'commission', header: t('admin.receivables.list.col.commission'), render: (r) => <span className="whitespace-nowrap">{rupees(r.commissionAmount)}</span> },
              { key: 'gst', header: t('admin.receivables.list.col.gst'), render: (r) => <span className="whitespace-nowrap">{rupees(r.gstAmount)}</span> },
              { key: 'invoiced', header: t('admin.receivables.list.col.invoiced'), render: (r) => <span className="whitespace-nowrap">{rupees(r.invoicedTotal)}</span> },
              { key: 'paid', header: t('admin.receivables.list.col.received'), render: (r) => <span className="whitespace-nowrap">{rupees(r.paidTotal)}</span> },
              { key: 'outstanding', header: t('admin.receivables.list.col.outstanding'), render: (r) => <span className="whitespace-nowrap font-medium">{rupees(r.outstanding)}</span> },
              { key: 'dueDate', header: t('admin.receivables.list.col.due'), render: (r) => <span className="whitespace-nowrap">{date(r.dueDate)}</span> },
              { key: 'status', header: t('admin.receivables.list.col.status'), render: (r) => { const s = receivableStatus(r.status); return <span className="flex flex-wrap gap-1"><Badge tone={s.tone}>{s.label}</Badge>{r.pendingProofs > 0 && <Badge tone="info">{t('admin.receivables.list.proofs', { count: r.pendingProofs })}</Badge>}</span>; } },
            ]} />
          {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
        </>
      )}

      <Modal open={remindOpen} onClose={() => setRemindOpen(false)} title={t('admin.receivables.list.remind.title')} description={t('admin.receivables.list.remind.description')}
        footer={<><Button variant="secondary" onClick={() => setRemindOpen(false)}>{t('common.cancel')}</Button><Button icon={BellRing} loading={remind.isPending} onClick={doRemind}>{t('admin.receivables.list.sendReminders')}</Button></>}>
        <p className="text-sm text-ink-muted">{t('admin.receivables.list.remind.body')}</p>
      </Modal>
    </>
  );
}
