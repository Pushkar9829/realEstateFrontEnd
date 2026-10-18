// RE-S-ADM-12 all leads (RE-C-07): filters, table, bulk assign and CSV export.
// Managers see the leads of their teams only (the API scopes the query).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Inbox, Search, UserPlus, X } from 'lucide-react';
import { Badge, Button, Card, FiltersBox, Input, PageHeader, Pagination, Select, Table, useToast } from '@/shared/ui';
import { dateTime, shortRupees, timeAgo, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useAuth } from '@/modules/auth';
import { useAgentOptions, useTeams } from '@/modules/teams/api';
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STAGES, exportLeadsCsv, leadSla, leadStage, useAdminLeads } from '@/modules/leads/adminApi';
import AssignModal from './AssignModal';

const FILTER_KEYS = ['q', 'stage', 'agentId', 'teamId', 'source', 'priority', 'breached', 'from', 'to'];
const istStart = (d) => (d ? `${d}T00:00:00+05:30` : undefined);
const istEnd = (d) => (d ? `${d}T23:59:59+05:30` : undefined);

export default function AllLeadsPage() {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || '']));
  const page = Number(sp.get('page')) || 1;
  const [q, setQ] = useState(f.q);
  const [selected, setSelected] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const teams = useTeams();
  const { options: agentOptions } = useAgentOptions();

  const params = { page, limit: 25 };
  ['q', 'stage', 'agentId', 'teamId', 'source', 'priority'].forEach((k) => { if (f[k]) params[k] = f[k]; });
  if (f.breached) params.breached = 'true';
  if (f.from) params.from = istStart(f.from);
  if (f.to) params.to = istEnd(f.to);
  const { data, isLoading, error } = useAdminLeads(params);
  const rows = (data && data.items) || [];

  const setFilter = (k, v) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('page');
    setSp(next, { replace: true });
    setSelected([]);
  };
  const setPage = (n) => { const next = new URLSearchParams(sp); next.set('page', String(n)); setSp(next, { replace: true }); };
  const clearAll = () => { setQ(''); setSp(new URLSearchParams(), { replace: true }); setSelected([]); };
  const active = FILTER_KEYS.some((k) => f[k]);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected((s) => (allOnPage ? s.filter((id) => !rows.some((r) => r._id === id)) : [...new Set([...s, ...rows.map((r) => r._id)])]));

  const doExport = async () => {
    setExporting(true);
    try {
      await exportLeadsCsv({ stage: f.stage, from: istStart(f.from), to: istEnd(f.to) });
      toast.success(t('admin.leads.list.exported'));
    } catch (e) { toast.error(e.message); } finally { setExporting(false); }
  };

  return (
    <>
      <PageHeader title={t('panel.nav.adminLeads')} description={t('admin.leads.list.description')}
        actions={<>
          {selected.length > 0 && <Button icon={UserPlus} onClick={() => setAssignOpen(true)}>{t('admin.leads.list.assignSelected', { n: selected.length })}</Button>}
          {hasPermission('leads.export') && <Button variant="secondary" icon={Download} loading={exporting} onClick={doExport}>{t('admin.leads.list.exportCsv')}</Button>}
        </>} />

      <Card className="mb-4">
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setFilter('q', q.trim()); }}>
          <Input className="flex-1" aria-label={t('admin.leads.search')} leading={<Search className="h-4 w-4" />} placeholder={t('admin.leads.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="secondary">{t('admin.leads.search')}</Button>
        </form>
        <FiltersBox count={FILTER_KEYS.filter((k) => k !== 'q' && f[k]).length} onClear={clearAll}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Select label={t('admin.leads.list.stage')} placeholder={t('admin.leads.list.anyStage')} value={f.stage} onChange={(e) => setFilter('stage', e.target.value)} options={Object.entries(LEAD_STAGES).map(([value, s]) => ({ value, label: s.label }))} />
          <Select label={t('admin.leads.agent')} placeholder={t('admin.leads.list.anyAgent')} value={f.agentId} onChange={(e) => setFilter('agentId', e.target.value)} options={[{ value: 'none', label: t('admin.leads.unassigned') }, ...agentOptions]} />
          <Select label={t('admin.leads.list.team')} placeholder={t('admin.leads.list.anyTeam')} value={f.teamId} onChange={(e) => setFilter('teamId', e.target.value)} options={(teams.data || []).map((t) => ({ value: t._id, label: t.name }))} />
          <Select label={t('admin.leads.list.source')} placeholder={t('admin.leads.list.anySource')} value={f.source} onChange={(e) => setFilter('source', e.target.value)} options={LEAD_SOURCES.map((s) => ({ value: s, label: titleCase(s) }))} />
          <Select label={t('admin.leads.list.priority')} placeholder={t('admin.leads.any')} value={f.priority} onChange={(e) => setFilter('priority', e.target.value)} options={Object.keys(LEAD_PRIORITIES).map((p) => ({ value: p, label: titleCase(p) }))} />
          <Select label="SLA" placeholder={t('admin.leads.any')} value={f.breached} onChange={(e) => setFilter('breached', e.target.value)} options={[{ value: 'true', label: t('admin.leads.list.breachedOnly') }]} />
          <Input label={t('admin.leads.list.createdFrom')} type="date" value={f.from} onChange={(e) => setFilter('from', e.target.value)} />
          <Input label={t('admin.leads.list.createdTo')} type="date" value={f.to} onChange={(e) => setFilter('to', e.target.value)} />
        </div>
        </FiltersBox>
        {active && <Button className="mt-3 hidden sm:inline-flex" size="sm" variant="ghost" icon={X} onClick={clearAll}>{t('admin.leads.list.clearFilters')}</Button>}
        {hasPermission('leads.export') && <p className="mt-2 text-xs text-ink-subtle">{t('admin.leads.list.exportNote')}</p>}
      </Card>

      {error && <Card className="mb-4 text-sm text-danger-700">{error.message}</Card>}
      <Table loading={isLoading} rows={rows} rowHref={(r) => `/admin/leads/${r._id}`} empty={active ? t('admin.leads.list.emptyFiltered') : t('admin.leads.list.empty')}
        columns={[
          { key: 'sel', mobile: 'select', header: <input type="checkbox" aria-label={t('admin.leads.list.selectAll')} className="h-4 w-4 rounded border-line-strong" checked={allOnPage} onChange={toggleAll} />, className: 'w-8',
            render: (r) => <input type="checkbox" aria-label={t('admin.leads.list.selectOne', { no: r.leadNo })} className="h-4 w-4 rounded border-line-strong" checked={selected.includes(r._id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r._id)} /> },
          { key: 'lead', header: t('admin.leads.list.colLead'), render: (r) => <span><span className="block font-medium text-ink">{r.leadNo}</span><span className="text-xs text-ink-subtle">{r.buyerName} · {r.buyerPhone}</span>{r.throttled && <Badge className="ml-1" tone="warning">{t('admin.leads.throttled')}</Badge>}</span> },
          { key: 'property', header: t('admin.leads.list.colProperty'), render: (r) => (r.property ? <span className="block max-w-[14rem]"><span className="block truncate text-sm">{r.property.title}</span><span className="text-xs text-ink-subtle">{r.property.listingNo} · {r.property.locality} · {shortRupees(r.property.price)}</span></span> : <span className="text-xs text-ink-subtle">{r.requirement?.city ? t('admin.leads.list.requirementCity', { city: r.requirement.city }) : '-'}</span>) },
          { key: 'source', header: t('admin.leads.list.source'), render: (r) => <span className="text-sm">{(r.sources || []).map(titleCase).join(', ') || '-'}</span> },
          { key: 'stage', header: t('admin.leads.list.stage'), render: (r) => { const s = leadStage(r.stage); return <span className="space-x-1"><Badge tone={s.tone}>{s.label}</Badge>{r.priority && <Badge tone={LEAD_PRIORITIES[r.priority]}>{titleCase(r.priority)}</Badge>}</span>; } },
          { key: 'agent', header: t('admin.leads.list.colAgentTeam'), render: (r) => (r.agent ? <span className="text-sm">{r.agent}<span className="block text-xs text-ink-subtle">{r.team || '-'}</span></span> : <Badge tone="warning" icon={Inbox}>{t('admin.leads.unassigned')}</Badge>) },
          { key: 'sla', header: 'SLA', render: (r) => { const s = leadSla(r); return <span title={r.slaDueAt ? t('admin.leads.due', { date: dateTime(r.slaDueAt) }) : undefined}><Badge tone={s.tone}>{s.label}</Badge></span>; } },
          { key: 'created', header: t('admin.leads.created'), render: (r) => <span className="whitespace-nowrap text-sm" title={dateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span> },
          { key: 'activity', header: t('admin.leads.lastActivity'), render: (r) => <span className="whitespace-nowrap text-sm">{timeAgo(r.lastActivityAt)}</span> },
        ]} />
      {data && <div className="mt-2 flex items-center justify-between text-xs text-ink-subtle"><span>{t('admin.leads.list.total', { count: data.meta.total })}{selected.length ? t('admin.leads.list.selectedSuffix', { n: selected.length }) : ''}</span></div>}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} leadIds={selected} onDone={() => setSelected([])} />
    </>
  );
}
