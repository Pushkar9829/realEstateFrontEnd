// RE-S-ADM-13 lead queue and SLA board (RE-C-06): unassigned leads, first
// contact SLA breaches, reassignment requests from agents and stale leads,
// with the agent load bar. Refreshes every 60 seconds.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { Link } from 'react-router-dom';
import { AlarmClock, CheckCircle2, Hourglass, Inbox, RefreshCw, Repeat, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, Skeleton, Stat } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime, sinceText, timeAgo, titleCase } from '@/shared/lib/format';
import { useAgentOptions } from '@/modules/teams/api';
import { leadStage, useLeadQueue } from '@/modules/leads/adminApi';
import AssignModal from '../leads/AssignModal';
import ReassignRequest from '../leads/ReassignRequestCard';

const idOf = (v) => (v && v._id) || v;

// as: 'li' inside a list, 'div' when nested in another list item (valid HTML).
function LeadLine({ l, extra, onAssign, as: Tag = 'li' }) {
  const t = useT();
  const s = leadStage(l.stage);
  return (
    <Tag className="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <Link to={`/admin/leads/${l._id}`} className="text-sm font-medium text-brand-700 hover:underline">{l.leadNo}</Link>
        <span className="text-sm text-ink"> · {l.buyerName}</span>
        {l.throttled && <Badge className="ml-1" tone="warning">{t('admin.leads.throttled')}</Badge>}
        <p className="truncate text-xs text-ink-subtle">
          {[s.label, l.property ? `${l.property.listingNo} ${l.property.locality || ''}` : l.requirement?.city, (l.sources || []).map(titleCase).join(', '), l.agent && t('admin.sla.agentName', { name: l.agent })].filter(Boolean).join(' · ')}
        </p>
        {extra}
      </div>
      {onAssign && <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => onAssign(l)}>{l.agent ? t('admin.leads.reassignBtn') : t('admin.leads.assignBtn')}</Button>}
    </Tag>
  );
}

function Panel({ title, description, icon: Icon, tone, items, loading, children }) {
  const t = useT();
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden />{title}{!loading && <Badge tone={items.length ? tone : 'success'}>{items.length}</Badge>}</span>} description={description} />
      {loading ? <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        : items.length === 0 ? <p className="flex items-center gap-2 py-4 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" /> {t('admin.sla.allClear')}</p>
          : children}
    </Card>
  );
}

export default function LeadQueuePage() {
  const t = useT();
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useLeadQueue();
  const { agents, options } = useAgentOptions();
  const [target, setTarget] = useState(null);
  const q = data || { unassigned: [], breached: [], reassignRequests: [], stale: [], agentLoad: [] };
  const capacity = Object.fromEntries(agents.map((a) => [String(a.agentId), a]));
  const load = q.agentLoad.map((a) => ({ ...a, ...(capacity[String(a.agentId)] ? { capacity: capacity[String(a.agentId)].capacity, available: capacity[String(a.agentId)].available, team: capacity[String(a.agentId)].team } : {}) }));
  agents.filter((a) => !load.some((x) => String(x.agentId) === String(a.agentId))).forEach((a) => load.push({ agentId: a.agentId, name: a.name, open: 0, breached: 0, capacity: a.capacity, available: a.available, team: a.team }));

  return (
    <>
      <PageHeader title={t('panel.nav.adminSla')} description={t('admin.sla.description')}
        actions={<Button variant="secondary" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>{t('admin.sla.refresh')}</Button>} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('admin.leads.unassigned')} value={isLoading ? '…' : q.unassigned.length} icon={Inbox} tone="warning" />
        <Stat label={t('admin.sla.breached')} value={isLoading ? '…' : q.breached.length} icon={AlarmClock} tone="danger" />
        <Stat label={t('admin.leads.reassignRequests')} value={isLoading ? '…' : q.reassignRequests.length} icon={Repeat} tone="info" />
        <Stat label={t('admin.sla.stale')} value={isLoading ? '…' : q.stale.length} icon={Hourglass} tone="neutral" hint={dataUpdatedAt ? t('admin.sla.updated', { time: timeAgo(dataUpdatedAt) }) : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t('admin.leads.unassigned')} icon={Inbox} tone="warning" loading={isLoading} items={q.unassigned} description={t('admin.sla.unassignedDescription')}>
          <ul className="divide-y">{q.unassigned.map((l) => <LeadLine key={l._id} l={l} onAssign={setTarget} extra={<p className="text-xs text-ink-subtle">{t('admin.sla.waiting', { time: sinceText(l.createdAt) })}</p>} />)}</ul>
        </Panel>
        <Panel title={t('admin.sla.breached')} icon={AlarmClock} tone="danger" loading={isLoading} items={q.breached} description={t('admin.sla.breachedDescription')}>
          <ul className="divide-y">{q.breached.map((l) => <LeadLine key={l._id} l={l} onAssign={setTarget} extra={<p className="text-xs text-danger-700">{t('admin.leads.due', { date: dateTime(l.slaDueAt) })} · {t('admin.sla.overdueBy', { time: sinceText(l.slaDueAt) })}</p>} />)}</ul>
        </Panel>
        <Panel title={t('admin.leads.reassignRequests')} icon={Repeat} tone="info" loading={isLoading} items={q.reassignRequests} description={t('admin.sla.reassignDescription')}>
          <ul className="divide-y">
            {q.reassignRequests.map((l) => (
              <li key={l._id} className="py-2.5">
                <LeadLine l={l} as="div" />
                <ul className="space-y-2">{(l.requests || []).map((r) => <ReassignRequest key={r._id} lead={l} r={r} agentOptions={options} />)}</ul>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t('admin.sla.stale')} icon={Hourglass} tone="neutral" loading={isLoading} items={q.stale} description={t('admin.sla.staleDescription')}>
          <ul className="divide-y">{q.stale.map((l) => <LeadLine key={l._id} l={l} onAssign={setTarget} extra={<p className="text-xs text-ink-subtle">{t('admin.sla.lastActivity', { time: timeAgo(l.lastActivityAt) })}</p>} />)}</ul>
        </Panel>
      </div>

      <Card className="mt-6">
        <CardHeader title={t('admin.sla.agentLoad')} description={t('admin.sla.agentLoadDescription')} />
        {load.length === 0 && !isLoading && <p className="text-sm text-ink-subtle">{t('admin.sla.noAgents')}</p>}
        <ul className="space-y-3">
          {load.map((a) => {
            const pct = a.capacity ? Math.min(100, Math.round((a.open / a.capacity) * 100)) : 0;
            return (
              <li key={String(a.agentId)}>
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-ink">{a.name || t('admin.leads.agent')}{a.team && <span className="text-ink-subtle"> · {a.team}</span>}{a.available === false && <Badge className="ml-2">{t('admin.sla.away')}</Badge>}</span>
                  <span className="text-ink-muted">{t('admin.sla.openCount', { n: `${a.open}${a.capacity ? ` / ${a.capacity}` : ''}` })}{a.breached ? <span className="text-danger-700">{t('admin.sla.breachedSuffix', { n: a.breached })}</span> : ''}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('admin.sla.loadLabel', { name: a.name })}>
                  <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-danger-600' : pct >= 70 ? 'bg-warning-600' : 'bg-brand-600')} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <AssignModal open={Boolean(target)} onClose={() => setTarget(null)} leadIds={target ? [target._id] : []} currentAgentId={target && target.assignedTo ? String(idOf(target.assignedTo)) : undefined} />
    </>
  );
}
