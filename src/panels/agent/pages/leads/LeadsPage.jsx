// RE-S-AGT-02 My leads: quick views, filters (stage, priority, source, city,
// purpose, created from / to), search, table with the SLA countdown and a bulk
// "Add follow-up".
import { useState } from 'react';
import { Inbox, ListPlus, Plus, Search } from 'lucide-react';
import { Badge, Button, EmptyState, FiltersBox, Input, PageHeader, Pagination, Select, Table, Tabs } from '@/shared/ui';
import { timeAgo } from '@/shared/lib/format';
import { PRIORITIES, PURPOSES, SOURCES, STAGES, budgetText, useAgentLeads } from '@/modules/leads/agentApi';
import { FollowupModal } from '../../components/FollowupModals';
import { ErrorState, PriorityBadge, SlaTimer, StageBadge } from '../../components/common';

const VIEWS = [
  { value: 'open', label: 'Open', params: {} },
  { value: 'new', label: 'New', params: { stage: 'new' } },
  { value: 'breached', label: 'SLA breached', params: { breached: 'true' } },
  { value: 'hot', label: 'Hot', params: { priority: 'hot' } },
  { value: 'visits', label: 'Visits', params: { stage: 'site_visit_scheduled,site_visit_done' } },
  { value: 'negotiation', label: 'Negotiation', params: { stage: 'negotiation,booking' } },
  { value: 'closed', label: 'Closed', params: { stage: 'closed_won,closed_lost' } },
];

export default function LeadsPage() {
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
      <PageHeader title="My leads" description="Leads assigned to you. Phones are masked; reveal on the lead page (every reveal is logged)."
        actions={<>
          {selected.length > 0 && <Button variant="secondary" icon={ListPlus} onClick={() => setBulk(true)}>Add follow-up ({selected.length})</Button>}
          <Button icon={Plus} to="/agent/leads/new">New lead</Button>
        </>} />
      <Tabs className="mb-4" value={view} onChange={reset((v) => { setView(v); setStage(''); })} tabs={VIEWS.map((t) => (t.value === view && data ? { ...t, count: data.meta.total } : t))} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FiltersBox count={[stage, priority, source, city, purpose, from, to].filter(Boolean).length}
          keep={<Input aria-label="Search" placeholder="Lead no., name or phone" leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => reset(setQ)(e.target.value)} />}>
        <Select aria-label="Stage" placeholder="Any stage in this view" value={stage} onChange={(e) => reset(setStage)(e.target.value)} options={STAGES.map((s) => ({ value: s.value, label: s.label }))} />
        <Select aria-label="Priority" placeholder="Any priority" value={priority} onChange={(e) => reset(setPriority)(e.target.value)} options={PRIORITIES} />
        <Select aria-label="Sort" value={sort} onChange={(e) => reset(setSort)(e.target.value)} options={[{ value: 'recent', label: 'Recent activity' }, { value: 'sla', label: 'SLA due first' }, { value: 'newest', label: 'Newest first' }]} />
        <Select aria-label="Source" placeholder="Any source" value={source} onChange={(e) => reset(setSource)(e.target.value)} options={Object.entries(SOURCES).map(([value, label]) => ({ value, label }))} />
        <Input aria-label="City" placeholder="City" value={city} onChange={(e) => reset(setCity)(e.target.value)} />
        <Select aria-label="Purpose" placeholder="Buy or rent" value={purpose} onChange={(e) => reset(setPurpose)(e.target.value)} options={PURPOSES} />
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Created from" type="date" title="Created from" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} />
          <Input aria-label="Created to" type="date" title="Created to" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
        </FiltersBox>
      </div>
      {filtered && <div className="-mt-2 mb-4 flex justify-end"><Button size="sm" variant="ghost" onClick={() => { [setStage, setPriority, setQ, setSource, setCity, setPurpose, setFrom, setTo].forEach((f) => f('')); setPage(1); setSelected([]); }}>Clear filters</Button></div>}
      {error ? <ErrorState error={error} onRetry={refetch} title="Could not load leads" /> : !isLoading && rows.length === 0 ? (
        <EmptyState icon={Inbox} title={view === 'open' && !filtered ? 'No leads assigned yet' : 'No leads match'} description="New enquiries are routed to you automatically. Hotline and walk-in buyers can be added by hand."
          action={<Button variant="secondary" icon={Plus} to="/agent/leads/new">New lead</Button>} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/agent/leads/${r._id}`}
          columns={[
            { key: 'sel', header: <input type="checkbox" aria-label="Select all on page" checked={allOnPage} onChange={() => setSelected(allOnPage ? [] : rows.map((r) => r._id))} />, className: 'w-8',
              render: (r) => <input type="checkbox" aria-label={`Select ${r.leadNo}`} checked={selected.includes(r._id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r._id)} /> },
            { key: 'lead', header: 'Lead', render: (r) => <span><span className="block font-medium text-ink">{r.buyerName}</span><span className="text-xs text-ink-subtle">{r.leadNo} · {r.buyerPhone}</span></span> },
            { key: 'property', header: 'Property', render: (r) => (r.property ? <span className="block max-w-[14rem] truncate text-sm">{r.property.listingNo}<span className="block truncate text-xs text-ink-subtle">{r.property.title}</span></span> : <span className="text-xs text-ink-subtle">{budgetText(r.requirement) || 'Requirement'}</span>) },
            { key: 'source', header: 'Source', render: (r) => <span className="text-xs">{(r.sources || []).map((s) => SOURCES[s] || s).join(', ')}</span> },
            { key: 'stage', header: 'Stage', render: (r) => <StageBadge stage={r.stage} /> },
            { key: 'priority', header: 'Priority', render: (r) => <span className="flex gap-1"><PriorityBadge priority={r.priority} />{r.throttled && <Badge tone="danger">Flagged</Badge>}</span> },
            { key: 'activity', header: 'Last activity', render: (r) => <span className="whitespace-nowrap text-xs text-ink-muted">{timeAgo(r.lastActivityAt)}</span> },
            { key: 'sla', header: 'SLA', render: (r) => (r.stage === 'new' || r.slaBreachedAt ? <SlaTimer compact lead={r} /> : <span className="text-xs text-ink-subtle">-</span>) },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <FollowupModal open={bulk} onClose={() => setBulk(false)} leadIds={selected} onDone={() => setSelected([])} />
    </>
  );
}
