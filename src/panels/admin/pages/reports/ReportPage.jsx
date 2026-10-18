// RE-S-ADM-28 one report: date range, summary stats, charts (plain CSS / SVG)
// and the table, plus CSV export. The commission report can be grouped by
// month, lister, agent or city (RE-D-08). A 202 export runs as a job: poll
// GET /api/admin/exports/:id and offer the download link when ready.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { Alert, Button, Card, CardHeader, Input, PageHeader, Select, Skeleton, Spinner, Table, useToast } from '@/shared/ui';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { COMMISSION_GROUPS, reportMeta, useExportJob, useReport, useReportExport } from '@/modules/reports/adminApi';
import { useT } from '@/shared/i18n';
import { Columns, Funnel, HBars } from './charts';

// Report fields with a translated label (admin.reports.field.<key>); anything unlisted falls back to a title-cased key.
const FIELD_KEYS = new Set([
  'leadsAssigned', 'contacted', 'slaMetPercent', 'visitsScheduled', 'visitsCompleted',
  'dealsSubmitted', 'dealsVerified', 'conversionPercent', 'commission', 'agents',
  'avgFirstContactMinutes', 'slaMet', 'leads', 'breached', 'ofPrevious',
  'avgApprovalHours', 'maxApprovalHours', 'slaHours', 'approved', 'live',
  'receivables', 'uninvoiced', 'disputed', 'tds', 'gst',
  'lister', 'agent', 'city', 'outstanding',
]);
const fieldLabel = (t, k) => (FIELD_KEYS.has(k) ? t(`admin.reports.field.${k}`) : titleCase(k.replace(/([a-z])([A-Z])/g, '$1 $2')));

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
  if (['lister', 'agent', 'city'].includes(key)) return String(v);
  return titleCase(String(v));
}

function Summary({ summary, report }) {
  const t = useT();
  const entries = Object.entries(summary || {});
  if (!entries.length) return null;
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-subtle">{fieldLabel(t, k)}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{fmt(k, v, report)}</p>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows, title, report }) {
  const t = useT();
  const cols = rows.length ? Object.keys(rows[0]).filter((k) => !/Id$/.test(k)) : []; // internal ids (agentId, listerId) are not shown
  return (
    <Card padded={false}>
      <div className="px-5 pt-5"><CardHeader title={title || t('admin.reports.table')} description={t('admin.reports.rows', { count: rows.length })} /></div>
      <Table rows={rows} rowKey={(r) => JSON.stringify(r)} empty={t('admin.reports.chart.noData')}
        columns={cols.map((k) => ({ key: k, header: fieldLabel(t, k), render: (r) => <span className="whitespace-nowrap">{fmt(k, r[k], report)}</span> }))} />
    </Card>
  );
}

function Charts({ k, data, groupBy }) {
  const t = useT();
  const unknown = t('admin.reports.unknown');
  const bucketLabel = (b) => (b === 'current' ? t('admin.reports.notYetDue') : t('admin.reports.bucketDays', { bucket: b }));
  const top = (xs, n = 12) => xs.slice(0, n);
  if (k === 'agents') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title={t('admin.reports.chartDealsVerified')} /><HBars rows={top(data.rows).map((r) => ({ label: r.agent || unknown, value: r.dealsVerified, hint: `${r.conversionPercent}%` }))} tone="success" /></Card>
        <Card><CardHeader title={t('admin.reports.chartLeadsAssigned')} /><HBars rows={top(data.rows).map((r) => ({ label: r.agent || unknown, value: r.leadsAssigned }))} /></Card>
      </div>
    );
  }
  if (k === 'leads') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title={t('admin.reports.bySource')} /><HBars rows={(data.bySource || []).map((r) => ({ label: titleCase(r.source), value: r.count, hint: t('admin.reports.pctWon', { pct: r.conversion }) }))} /></Card>
        <Card><CardHeader title={t('admin.reports.byStage')} /><HBars rows={(data.byStage || []).map((r) => ({ label: titleCase(r.stage), value: r.count }))} tone="info" /></Card>
        <Card><CardHeader title={t('admin.reports.byTeam')} /><HBars rows={(data.byTeam || []).map((r) => ({ label: r.team, value: r.count }))} tone="accent" /></Card>
        <Card><CardHeader title={t('admin.reports.byCity')} /><HBars rows={top(data.byCity || []).map((r) => ({ label: r.city, value: r.count }))} tone="neutral" /></Card>
      </div>
    );
  }
  if (k === 'funnel') {
    return <Card><CardHeader title={t('admin.reports.funnelTitle')} description={t('admin.reports.funnelDesc')} /><Funnel rows={data.rows.map((r) => ({ label: titleCase(r.stage), value: r.leads, hint: `${r.ofPrevious}%` }))} /></Card>;
  }
  if (k === 'sla') {
    return <Card><CardHeader title={t('admin.reports.slaTitle')} /><HBars format={(v) => `${v}%`} rows={top(data.rows).map((r) => ({ label: r.agent, value: r.slaMetPercent, hint: `(${r.slaMet}/${r.leads})`, tone: r.slaMetPercent >= 90 ? 'success' : r.slaMetPercent >= 70 ? 'warning' : 'danger' }))} /></Card>;
  }
  if (k === 'commission' && groupBy && groupBy !== 'month') {
    const label = COMMISSION_GROUPS.find((g) => g.value === groupBy).label;
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title={t('admin.reports.commissionBy', { group: label.toLowerCase() })} /><HBars format={rupees} rows={data.rows.slice(0, 12).map((r) => ({ label: r[groupBy] || unknown, value: r.commission, hint: `(${r.deals})` }))} /></Card>
        <Card><CardHeader title={t('admin.reports.outstandingBy', { group: label.toLowerCase() })} /><HBars format={rupees} rows={[...data.rows].sort((a, b) => b.outstanding - a.outstanding).slice(0, 12).map((r) => ({ label: r[groupBy] || unknown, value: r.outstanding }))} tone="warning" /></Card>
      </div>
    );
  }
  if (k === 'commission') {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title={t('admin.reports.byMonth')} />
          <Columns format={rupees} rows={data.rows.map((r) => ({ label: r.month, values: r }))} series={[{ key: 'commission', label: t('admin.reports.seriesCommission'), tone: 'brand' }, { key: 'invoiced', label: t('admin.reports.seriesInvoiced'), tone: 'info' }, { key: 'received', label: t('admin.reports.seriesReceived'), tone: 'success' }]} />
        </Card>
        {data.ageing && <Card><CardHeader title={t('admin.reports.ageing')} description={t('admin.reports.ageingDesc', { uninvoiced: rupees(data.ageing.uninvoiced), disputed: rupees(data.ageing.disputed) })} /><HBars format={rupees} rows={Object.entries(data.ageing.buckets).map(([b, v]) => ({ label: bucketLabel(b), value: v, hint: `(${data.ageing.counts[b]})`, tone: b === 'current' ? 'success' : b === '0-30' ? 'warning' : 'danger' }))} /></Card>}
      </div>
    );
  }
  if (k === 'listings') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title={t('admin.reports.listingsByStatus')} /><HBars rows={(data.byStatus || []).map((r) => ({ label: titleCase(r.status), value: r.count }))} /></Card>
        <Card><CardHeader title={t('admin.reports.newListingsByCity')} /><HBars rows={top(data.byCity || []).map((r) => ({ label: r.city, value: r.count, hint: t('admin.reports.nLive', { n: r.live }) }))} tone="info" /></Card>
        <Card className="lg:col-span-2"><CardHeader title={t('admin.reports.newListingsByType')} /><HBars rows={top(data.byType || [], 20).map((r) => ({ label: `${titleCase(r.purpose)} · ${titleCase(r.type)}`, value: r.count }))} tone="accent" /></Card>
      </div>
    );
  }
  if (k === 'ageing') {
    return <Card><CardHeader title={t('admin.reports.outstandingByBucket')} /><HBars format={rupees} rows={data.rows.map((r) => ({ label: bucketLabel(r.bucket), value: r.amount, hint: `(${r.receivables})`, tone: r.bucket === 'current' ? 'success' : r.bucket === '0-30' ? 'warning' : 'danger' }))} /></Card>;
  }
  return null;
}

function ExportStatus({ id, onDone }) {
  const t = useT();
  const { data, error } = useExportJob(id);
  if (error) return <Alert tone="danger" className="mb-4">{error.message}</Alert>;
  const st = data && data.status;
  if (st === 'ready') return <Alert tone="success" className="mb-4" title={t('admin.reports.exportReady')} action={<Button size="sm" variant="ghost" onClick={onDone}>{t('admin.reports.dismiss')}</Button>}>{t('admin.reports.exportRows', { n: data.rows })} <a className="font-medium underline" href={data.url} target="_blank" rel="noreferrer">{t('admin.reports.downloadCsv')}</a> {t('admin.reports.exportKept', { date: dateTime(data.expiresAt) })}</Alert>;
  if (st === 'failed' || st === 'expired') return <Alert tone="danger" className="mb-4" title={st === 'failed' ? t('admin.reports.exportFailed') : t('admin.reports.exportExpired')} action={<Button size="sm" variant="ghost" onClick={onDone}>{t('admin.reports.dismiss')}</Button>}>{data.error || t('admin.reports.runAgain')}</Alert>;
  return <Alert tone="info" className="mb-4" title={t('admin.reports.preparing')}><span className="inline-flex items-center gap-2"><Spinner size="sm" /> {t('admin.reports.preparingBody', { status: st || t('admin.reports.queued') })}</span></Alert>;
}

export default function ReportPage() {
  const { key } = useParams();
  const toast = useToast();
  const t = useT();
  const meta = reportMeta(key);
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(isoDay(new Date(now.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(now));
  const [exportId, setExportId] = useState(null);
  const [groupBy, setGroupBy] = useState('month');
  const grouped = key === 'commission' && groupBy !== 'month';
  const params = { from: `${from}T00:00:00+05:30`, to: `${to}T23:59:59+05:30`, ...(grouped ? { groupBy } : {}) };
  const groupLabel = key === 'commission' ? COMMISSION_GROUPS.find((g) => g.value === groupBy).label : null;
  const { data, isLoading, isFetching, error, refetch } = useReport(key, params, Boolean(meta));
  const exp = useReportExport(key);

  const doExport = async (async) => {
    try {
      const r = await exp.mutateAsync({ ...params, ...(async ? { async: 'true' } : {}) });
      if (r.accepted) setExportId(r.exportId);
    } catch (e) { toast.error(e.message); }
  };

  if (!meta) return <Alert tone="danger">{t('admin.reports.unknownReport', { key })} <Link className="underline" to="/admin/reports">{t('admin.reports.backToReports')}</Link></Alert>;

  return (
    <>
      <Link to="/admin/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.reports.title')}</Link>
      <PageHeader title={meta.label} description={meta.description}
        actions={<>
          <Button variant="secondary" icon={Download} loading={exp.isPending} onClick={() => doExport(false)}>{t('admin.reports.exportCsv')}</Button>
          <Button variant="ghost" onClick={() => doExport(true)} disabled={exp.isPending}>{t('admin.reports.exportBackground')}</Button>
        </>} />

      {key !== 'ageing' && (
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <Input label={t('admin.reports.from')} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t('admin.reports.to')} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          {key === 'commission' && <Select label={t('admin.reports.groupBy')} value={groupBy} onChange={(e) => setGroupBy(e.target.value)} options={COMMISSION_GROUPS} />}
          <Button variant="ghost" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>{t('admin.reports.refresh')}</Button>
        </div>
      )}
      {key === 'ageing' && <p className="mb-4 text-sm text-ink-subtle">{t('admin.reports.ageingNote')}</p>}

      {exportId && <ExportStatus id={exportId} onDone={() => setExportId(null)} />}
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : data ? (
        <>
          <Summary summary={data.summary} report={key} />
          <div className="mb-6"><Charts k={key} data={data} groupBy={data.groupBy || groupBy} /></div>
          <DataTable report={key} rows={data.rows || []} title={key === 'commission' ? t('admin.reports.byGroup', { group: groupLabel.toLowerCase() }) : key === 'listings' ? t('admin.reports.byCity') : t('admin.reports.rowsTitle')} />
        </>
      ) : null}
    </>
  );
}
