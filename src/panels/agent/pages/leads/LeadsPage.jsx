// RE-S-AGT-02 My leads: quick views, filters (stage, priority, source, city,
// purpose, created from / to), search, table with the SLA countdown and a bulk
// "Add follow-up".
import { useState } from 'react';
import { Inbox, ListPlus, Plus, Search } from 'lucide-react';
import { Badge, Button, EmptyState, FiltersBox, Input, PageHeader, Pagination, Select, Table, Tabs } from '@/shared/ui';
import { timeAgo } from '@/shared/lib/format';
import { PRIORITIES, PURPOSES, SOURCES, STAGES, budgetText, useAgentLeads } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { FollowupModal } from '../../components/FollowupModals';
import { ErrorState, PriorityBadge, SlaTimer, StageBadge } from '../../components/common';

// Labels: agent.leads.view.<value>.
const VIEWS = [
  { value: 'open', params: {} },
  { value: 'new', params: { stage: 'new' } },
  { value: 'breached', params: { breached: 'true' } },
  { value: 'hot', params: { priority: 'hot' } },
  { value: 'visits', params: { stage: 'site_visit_scheduled,site_visit_done' } },
  { value: 'negotiation', params: { stage: 'negotiation,booking' } },
  { value: 'closed', params: { stage: 'closed_won,closed_lost' } },
];

export default function LeadsPage() {
  const t = useT();
  const [view, setView] = useState('open');
  const [stage, setStage] = useState('');
  const [priority, setPriority] = useState('');
  const [source, setSource] = useState('');
  const [city, setCity] = useState('');
  const [purpose, setPurpose] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('recent');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [bulk, setBulk] = useState(false);

  const base = VIEWS.find((x) => x.value === view).params;
  const params = { page, limit: 25, sort, ...base, ...(stage ? { stage } : {}), ...(priority ? { priority } : {}), ...(q.trim().length >= 2 ? { q: q.trim() } : {}),
    ...(source ? { source } : {}), ...(city.trim().length >= 2 ? { city: city.trim() } : {}), ...(purpose ? { purpose } : {}),
    ...(from ? { from: `${from}T00:00:00+05:30` } : {}), ...(to ? { to: `${to}T23:59:59.999+05:30` } : {}) };
  const filtered = Boolean(stage || priority || q || source || city || purpose || from || to);
  const { data, isLoading, error, refetch } = useAgentLeads(params);
  const rows = (data && data.items) || [];
  const reset = (fn) => (v) => { fn(v); setPage(1); setSelected([]); };
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));

  return (
    <>
      <PageHeader title={t('panel.nav.agentLeads')} description={t('agent.leads.desc')}
        actions={<>
          {selected.length > 0 && <Button variant="secondary" icon={ListPlus} onClick={() => setBulk(true)}>{t('agent.leads.addFollowup', { n: selected.length })}</Button>}
          <Button icon={Plus} to="/agent/leads/new">{t('agent.leads.newLead')}</Button>
        </>} />
      <Tabs className="mb-4" value={view} onChange={reset((v) => { setView(v); setStage(''); })} tabs={VIEWS.map((x) => { const tab = { value: x.value, label: t(`agent.leads.view.${x.value}`) }; return x.value === view && data ? { ...tab, count: data.meta.total } : tab; })} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FiltersBox count={[stage, priority, source, city, purpose, from, to].filter(Boolean).length}
          keep={<Input aria-label={t('agent.common.search')} placeholder={t('agent.leads.searchPh')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => reset(setQ)(e.target.value)} />}>
        <Select aria-label={t('agent.leads.stage')} placeholder={t('agent.leads.anyStage')} value={stage} onChange={(e) => reset(setStage)(e.target.value)} options={STAGES.map((s) => ({ value: s.value, label: s.label }))} />
        <Select aria-label={t('agent.leads.priority')} placeholder={t('agent.leads.anyPriority')} value={priority} onChange={(e) => reset(setPriority)(e.target.value)} options={PRIORITIES} />
        <Select aria-label={t('agent.leads.sort')} value={sort} onChange={(e) => reset(setSort)(e.target.value)} options={[{ value: 'recent', label: t('agent.leads.sortRecent') }, { value: 'sla', label: t('agent.leads.sortSla') }, { value: 'newest', label: t('agent.leads.sortNewest') }]} />
        <Select aria-label={t('agent.leads.source')} placeholder={t('agent.leads.anySource')} value={source} onChange={(e) => reset(setSource)(e.target.value)} options={Object.entries(SOURCES).map(([value, label]) => ({ value, label }))} />
        <Input aria-label={t('agent.req.city')} placeholder={t('agent.req.city')} value={city} onChange={(e) => reset(setCity)(e.target.value)} />
        <Select aria-label={t('agent.req.purpose')} placeholder={t('agent.leads.buyOrRent')} value={purpose} onChange={(e) => reset(setPurpose)(e.target.value)} options={PURPOSES} />
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label={t('agent.leads.createdFrom')} type="date" title={t('agent.leads.createdFrom')} value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} />
          <Input aria-label={t('agent.leads.createdTo')} type="date" title={t('agent.leads.createdTo')} value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
        </FiltersBox>
      </div>
      {filtered && <div className="-mt-2 mb-4 flex justify-end"><Button size="sm" variant="ghost" onClick={() => { [setStage, setPriority, setQ, setSource, setCity, setPurpose, setFrom, setTo].forEach((f) => f('')); setPage(1); setSelected([]); }}>{t('common.table.clear')}</Button></div>}
      {error ? <ErrorState error={error} onRetry={refetch} title={t('agent.leads.loadError')} /> : !isLoading && rows.length === 0 ? (
        <EmptyState icon={Inbox} title={view === 'open' && !filtered ? t('agent.leads.emptyTitle') : t('agent.leads.noMatch')} description={t('agent.leads.emptyDesc')}
          action={<Button variant="secondary" icon={Plus} to="/agent/leads/new">{t('agent.leads.newLead')}</Button>} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/agent/leads/${r._id}`}
          columns={[
            { key: 'sel', mobile: 'select', header: <input type="checkbox" aria-label={t('agent.leads.selectAll')} checked={allOnPage} onChange={() => setSelected(allOnPage ? [] : rows.map((r) => r._id))} />, className: 'w-8',
              render: (r) => <input type="checkbox" aria-label={t('agent.props.select', { no: r.leadNo })} checked={selected.includes(r._id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r._id)} /> },
            { key: 'lead', header: t('agent.common.lead'), render: (r) => <span><span className="block font-medium text-ink">{r.buyerName}</span><span className="text-xs text-ink-subtle">{r.leadNo} · {r.buyerPhone}</span></span> },
            { key: 'property', header: t('agent.common.property'), render: (r) => (r.property ? <span className="block max-w-[14rem] truncate text-sm">{r.property.listingNo}<span className="block truncate text-xs text-ink-subtle">{r.property.title}</span></span> : <span className="text-xs text-ink-subtle">{budgetText(r.requirement) || t('agent.req.title')}</span>) },
            { key: 'source', header: t('agent.leads.source'), render: (r) => <span className="text-xs">{(r.sources || []).map((s) => SOURCES[s] || s).join(', ')}</span> },
            { key: 'stage', header: t('agent.leads.stage'), render: (r) => <StageBadge stage={r.stage} /> },
            { key: 'priority', header: t('agent.leads.priority'), render: (r) => <span className="flex gap-1"><PriorityBadge priority={r.priority} />{r.throttled && <Badge tone="danger">{t('agent.leads.flagged')}</Badge>}</span> },
            { key: 'activity', header: t('agent.leads.lastActivity'), render: (r) => <span className="whitespace-nowrap text-xs text-ink-muted">{timeAgo(r.lastActivityAt)}</span> },
            { key: 'sla', header: 'SLA', render: (r) => (r.stage === 'new' || r.slaBreachedAt ? <SlaTimer compact lead={r} /> : <span className="text-xs text-ink-subtle">-</span>) },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <FollowupModal open={bulk} onClose={() => setBulk(false)} leadIds={selected} onDone={() => setSelected([])} />
    </>
  );
}
