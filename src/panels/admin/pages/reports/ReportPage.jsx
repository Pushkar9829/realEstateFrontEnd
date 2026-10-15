// RE-S-ADM-28 one report: date range, summary stats, charts (plain CSS / SVG)
// and the table, plus CSV export. A 202 export runs as a job: poll
// GET /api/admin/exports/:id and offer the download link when ready.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { Alert, Button, Card, CardHeader, Input, PageHeader, Skeleton, Spinner, Table, useToast } from '@/shared/ui';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { reportMeta, useExportJob, useReport, useReportExport } from '@/modules/reports/adminApi';
import { Columns, Funnel, HBars } from './charts';

// Human labels for report fields; anything unlisted falls back to a title-cased key.
const FIELD_LABELS = {
  leadsAssigned: 'Leads', contacted: 'Contacted', slaMetPercent: 'SLA met', visitsScheduled: 'Visits booked', visitsCompleted: 'Visits done',
  dealsSubmitted: 'Deals submitted', dealsVerified: 'Deals verified', conversionPercent: 'Conversion', commission: 'Commission', agents: 'Agents',
  avgFirstContactMinutes: 'Avg first contact (min)', slaMet: 'Within SLA', leads: 'Leads', breached: 'Breached', ofPrevious: 'Of previous stage',
  avgApprovalHours: 'Avg approval (h)', maxApprovalHours: 'Slowest approval (h)', slaHours: 'Approval SLA (h)', approved: 'Approved', live: 'Live',
  receivables: 'Receivables', uninvoiced: 'Not yet invoiced', disputed: 'Disputed', tds: 'TDS', gst: 'GST',
};
const fieldLabel = (k) => FIELD_LABELS[k] || titleCase(k.replace(/([a-z])([A-Z])/g, '$1 $2'));

const MONEY = new Set(['commission', 'gst', 'invoiced', 'received', 'tds', 'amount']);
// In the finance reports these summary figures are money too (elsewhere `total` is a count).
const FINANCE_MONEY = new Set(['outstanding', 'uninvoiced', 'disputed', 'total']);
const FINANCE = ['commission', 'ageing'];
const PERCENT = /percent$|^conversion$|^ofPrevious$/i;
const isoDay = (d) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);

function fmt(key, v, report) {
  if (v == null) return '-';
  if (MONEY.has(key) || (FINANCE.includes(report) && FINANCE_MONEY.has(key))) return rupees(v);
  if (PERCENT.test(key)) return `${v}%`;
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return titleCase(String(v));
}

function Summary({ summary, report }) {
  const entries = Object.entries(summary || {});
  if (!entries.length) return null;
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-subtle">{fieldLabel(k)}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{fmt(k, v, report)}</p>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows, title, report }) {
  const cols = rows.length ? Object.keys(rows[0]).filter((k) => k !== 'agentId') : [];
  return (
    <Card padded={false}>
      <div className="px-5 pt-5"><CardHeader title={title || 'Table'} description={`${rows.length} row${rows.length === 1 ? '' : 's'}`} /></div>
      <Table rows={rows} rowKey={(r) => JSON.stringify(r)} empty="No data in this period"
        columns={cols.map((k) => ({ key: k, header: fieldLabel(k), render: (r) => <span className="whitespace-nowrap">{fmt(k, r[k], report)}</span> }))} />
    </Card>
  );
}

function Charts({ k, data }) {
  const top = (xs, n = 12) => xs.slice(0, n);
  if (k === 'agents') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Deals verified" /><HBars rows={top(data.rows).map((r) => ({ label: r.agent || 'Unknown', value: r.dealsVerified, hint: `${r.conversionPercent}%` }))} tone="success" /></Card>
        <Card><CardHeader title="Leads assigned" /><HBars rows={top(data.rows).map((r) => ({ label: r.agent || 'Unknown', value: r.leadsAssigned }))} /></Card>
      </div>
    );
  }
  if (k === 'leads') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="By source" /><HBars rows={(data.bySource || []).map((r) => ({ label: titleCase(r.source), value: r.count, hint: `${r.conversion}% won` }))} /></Card>
        <Card><CardHeader title="By stage" /><HBars rows={(data.byStage || []).map((r) => ({ label: titleCase(r.stage), value: r.count }))} tone="info" /></Card>
        <Card><CardHeader title="By team" /><HBars rows={(data.byTeam || []).map((r) => ({ label: r.team, value: r.count }))} tone="accent" /></Card>
        <Card><CardHeader title="By city" /><HBars rows={top(data.byCity || []).map((r) => ({ label: r.city, value: r.count }))} tone="neutral" /></Card>
      </div>
    );
  }
  if (k === 'funnel') {
    return <Card><CardHeader title="Pipeline funnel" description="Leads created in the period that reached each stage." /><Funnel rows={data.rows.map((r) => ({ label: titleCase(r.stage), value: r.leads, hint: `${r.ofPrevious}%` }))} /></Card>;
  }
  if (k === 'sla') {
    return <Card><CardHeader title="First contact within SLA" /><HBars format={(v) => `${v}%`} rows={top(data.rows).map((r) => ({ label: r.agent, value: r.slaMetPercent, hint: `(${r.slaMet}/${r.leads})`, tone: r.slaMetPercent >= 90 ? 'success' : r.slaMetPercent >= 70 ? 'warning' : 'danger' }))} /></Card>;
  }
  if (k === 'commission') {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="By month" />
          <Columns format={rupees} rows={data.rows.map((r) => ({ label: r.month, values: r }))} series={[{ key: 'commission', label: 'Commission verified', tone: 'brand' }, { key: 'invoiced', label: 'Invoiced', tone: 'info' }, { key: 'received', label: 'Received', tone: 'success' }]} />
        </Card>
        {data.ageing && <Card><CardHeader title="Ageing" description={`Uninvoiced ${rupees(data.ageing.uninvoiced)} · disputed ${rupees(data.ageing.disputed)}`} /><HBars format={rupees} rows={Object.entries(data.ageing.buckets).map(([b, v]) => ({ label: b === 'current' ? 'Not yet due' : `${b} days`, value: v, hint: `(${data.ageing.counts[b]})`, tone: b === 'current' ? 'success' : b === '0-30' ? 'warning' : 'danger' }))} /></Card>}
      </div>
    );
  }
  if (k === 'listings') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="All listings by status" /><HBars rows={(data.byStatus || []).map((r) => ({ label: titleCase(r.status), value: r.count }))} /></Card>
        <Card><CardHeader title="New listings by city" /><HBars rows={top(data.byCity || []).map((r) => ({ label: r.city, value: r.count, hint: `${r.live} live` }))} tone="info" /></Card>
        <Card className="lg:col-span-2"><CardHeader title="New listings by purpose and type" /><HBars rows={top(data.byType || [], 20).map((r) => ({ label: `${titleCase(r.purpose)} · ${titleCase(r.type)}`, value: r.count }))} tone="accent" /></Card>
      </div>
    );
  }
  if (k === 'ageing') {
    return <Card><CardHeader title="Outstanding by bucket" /><HBars format={rupees} rows={data.rows.map((r) => ({ label: r.bucket === 'current' ? 'Not yet due' : `${r.bucket} days`, value: r.amount, hint: `(${r.receivables})`, tone: r.bucket === 'current' ? 'success' : r.bucket === '0-30' ? 'warning' : 'danger' }))} /></Card>;
  }
  return null;
}

function ExportStatus({ id, onDone }) {
  const { data, error } = useExportJob(id);
  if (error) return <Alert tone="danger" className="mb-4">{error.message}</Alert>;
  const st = data && data.status;
  if (st === 'ready') return <Alert tone="success" className="mb-4" title="Export ready" action={<Button size="sm" variant="ghost" onClick={onDone}>Dismiss</Button>}>{data.rows} rows. <a className="font-medium underline" href={data.url} target="_blank" rel="noreferrer">Download CSV</a> (link valid 10 minutes; the export is kept until {dateTime(data.expiresAt)}).</Alert>;
  if (st === 'failed' || st === 'expired') return <Alert tone="danger" className="mb-4" title={`Export ${st}`} action={<Button size="sm" variant="ghost" onClick={onDone}>Dismiss</Button>}>{data.error || 'Run the export again.'}</Alert>;
  return <Alert tone="info" className="mb-4" title="Preparing export"><span className="inline-flex items-center gap-2"><Spinner size="sm" /> The report is large, so it is built in the background ({st || 'queued'}). You will also get a notification.</span></Alert>;
}

export default function ReportPage() {
  const { key } = useParams();
  const toast = useToast();
  const meta = reportMeta(key);
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(isoDay(new Date(now.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(now));
  const [exportId, setExportId] = useState(null);
  const params = { from: `${from}T00:00:00+05:30`, to: `${to}T23:59:59+05:30` };
  const { data, isLoading, isFetching, error, refetch } = useReport(key, params, Boolean(meta));
  const exp = useReportExport(key);

  const doExport = async (async) => {
    try {
      const r = await exp.mutateAsync({ ...params, ...(async ? { async: 'true' } : {}) });
      if (r.accepted) setExportId(r.exportId);
    } catch (e) { toast.error(e.message); }
  };

  if (!meta) return <Alert tone="danger">Unknown report "{key}". <Link className="underline" to="/admin/reports">Back to reports</Link></Alert>;

  return (
    <>
      <Link to="/admin/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Reports</Link>
      <PageHeader title={meta.label} description={meta.description}
        actions={<>
          <Button variant="secondary" icon={Download} loading={exp.isPending} onClick={() => doExport(false)}>Export CSV</Button>
          <Button variant="ghost" onClick={() => doExport(true)} disabled={exp.isPending}>Export in background</Button>
        </>} />

      {key !== 'ageing' && (
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          <Button variant="ghost" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Refresh</Button>
        </div>
      )}
      {key === 'ageing' && <p className="mb-4 text-sm text-ink-subtle">Ageing is a snapshot as of now; the date range does not apply.</p>}

      {exportId && <ExportStatus id={exportId} onDone={() => setExportId(null)} />}
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : data ? (
        <>
          <Summary summary={data.summary} report={key} />
          <div className="mb-6"><Charts k={key} data={data} /></div>
          <DataTable report={key} rows={data.rows || []} title={key === 'commission' ? 'By month' : key === 'listings' ? 'By city' : 'Rows'} />
        </>
      ) : null}
    </>
  );
}
