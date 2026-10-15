// RE-S-ADM-17 site visits overview (RE-C-13, sitevisits.view): every buyer
// site visit across agents with filters, counters, agent reassignment and
// cancel. Managers see the visits of their teams only.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarClock, CalendarX, UserCog, X } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Modal, PageHeader, Pagination, Select, Stat, Table, Textarea, useToast } from '@/shared/ui';
import { useCount } from '@/shared/hooks/useCount';
import { dateTime } from '@/shared/lib/format';
import { useAgentOptions } from '@/modules/teams/api';
import { VISIT_STATUS, usePatchSiteVisit, useAdminSiteVisits, visitStatus } from '@/modules/leads/adminApi';

const OPEN = ['requested', 'scheduled', 'confirmed'];
const istStart = (d) => (d ? `${d}T00:00:00+05:30` : undefined);
const istEnd = (d) => (d ? `${d}T23:59:59+05:30` : undefined);
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export default function SiteVisitsPage() {
  const toast = useToast();
  const [f, setF] = useState({ status: '', agentId: '', from: '', to: '', sort: '' });
  const [page, setPage] = useState(1);
  const { options: agentOptions } = useAgentOptions();
  const params = { page, limit: 25, ...(f.status ? { status: f.status } : {}), ...(f.agentId ? { agentId: f.agentId } : {}), ...(f.from ? { from: istStart(f.from) } : {}), ...(f.to ? { to: istEnd(f.to) } : {}), ...(f.sort ? { sort: f.sort } : {}) };
  const { data, isLoading, error } = useAdminSiteVisits(params);
  const patch = usePatchSiteVisit();
  const today = todayIst();
  const todayCount = useCount('/admin/site-visits', { status: 'scheduled,confirmed', from: istStart(today), to: istEnd(today) });
  const doneCount = useCount('/admin/site-visits', { status: 'completed' });
  const noShowCount = useCount('/admin/site-visits', { status: 'no_show' });
  const [target, setTarget] = useState(null); // { visit, mode: 'agent' | 'cancel' }
  const [agentId, setAgentId] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState(null);

  const setFilter = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const open = (visit, mode) => { setTarget({ visit, mode }); setAgentId(''); setReason(''); setFormError(null); };
  const submit = async () => {
    setFormError(null);
    try {
      await patch.mutateAsync({ id: target.visit._id, body: target.mode === 'agent' ? { agentId } : { cancelReason: reason.trim() } });
      toast.success(target.mode === 'agent' ? 'Visit reassigned' : 'Visit cancelled');
      setTarget(null);
    } catch (e) { setFormError(e.message); }
  };
  const done = (doneCount.data || 0);
  const noShow = (noShowCount.data || 0);

  return (
    <>
      <PageHeader title="Site visits" description="Buyer site visits across agents. Reassign the agent or cancel an open visit." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Scheduled today" value={todayCount.data ?? '…'} icon={CalendarClock} />
        <Stat label="Completed" value={doneCount.data ?? '…'} icon={CalendarCheck} tone="success" />
        <Stat label="No-shows" value={noShowCount.data ?? '…'} icon={CalendarX} tone="danger" hint={done + noShow ? `No-show rate ${Math.round((noShow / (done + noShow)) * 100)}%` : undefined} />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Status" placeholder="Any status" value={f.status} onChange={setFilter('status')} options={[{ value: OPEN.join(','), label: 'Open (requested, scheduled, confirmed)' }, ...Object.entries(VISIT_STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
          <Select label="Agent" placeholder="Any agent" value={f.agentId} onChange={setFilter('agentId')} options={agentOptions} />
          <Input label="From" type="date" value={f.from} onChange={setFilter('from')} />
          <Input label="To" type="date" value={f.to} onChange={setFilter('to')} />
          <Select label="Order" value={f.sort} onChange={setFilter('sort')} options={[{ value: '', label: 'Latest first' }, { value: 'oldest', label: 'Earliest first' }]} />
        </div>
        {Object.values(f).some(Boolean) && <Button className="mt-3" size="sm" variant="ghost" icon={X} onClick={() => { setF({ status: '', agentId: '', from: '', to: '', sort: '' }); setPage(1); }}>Clear filters</Button>}
      </Card>

      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No visits match."
        columns={[
          { key: 'visit', header: 'Visit', render: (v) => <span><span className="block font-medium text-ink">{v.visitNo}</span><span className="text-xs text-ink-subtle">{dateTime(v.scheduledAt)} · {v.durationMin || 30} min</span></span> },
          { key: 'lead', header: 'Lead', render: (v) => (v.leadId ? <Link className="text-sm text-brand-700 hover:underline" to={`/admin/leads/${v.leadId._id}`}>{v.leadId.leadNo}<span className="block text-xs text-ink-subtle">{v.leadId.buyer?.name}</span></Link> : '-') },
          { key: 'property', header: 'Property', render: (v) => (v.propertyId ? <span className="block max-w-[14rem] text-sm"><span className="block truncate">{v.propertyId.title}</span><span className="text-xs text-ink-subtle">{v.propertyId.listingNo} · {v.propertyId.location?.locality}</span></span> : '-') },
          { key: 'agent', header: 'Agent', render: (v) => v.agentId?.name || <Badge tone="warning">None</Badge> },
          { key: 'status', header: 'Status', render: (v) => { const s = visitStatus(v.status); return <span className="space-x-1"><Badge tone={s.tone}>{s.label}</Badge>{v.outsideListerSlots && <Badge tone="warning">Outside lister slots</Badge>}</span>; } },
          { key: 'outcome', header: 'Outcome', render: (v) => <span className="text-xs text-ink-muted">{v.outcome?.result ? `${v.outcome.result}${v.outcome.interest ? ` · interest ${v.outcome.interest}/5` : ''}` : v.cancelReason || '-'}</span> },
          { key: 'act', header: '', render: (v) => (OPEN.includes(v.status) ? (
            <span className="flex justify-end gap-1">
              <Button size="sm" variant="secondary" icon={UserCog} onClick={() => open(v, 'agent')}>Reassign</Button>
              <Button size="sm" variant="ghost" onClick={() => open(v, 'cancel')}>Cancel</Button>
            </span>
          ) : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={target ? `${target.mode === 'agent' ? 'Reassign' : 'Cancel'} ${target.visit.visitNo}` : ''}
        description={target && target.mode === 'agent' ? `Current agent: ${target.visit.agentId?.name || 'none'}` : 'The buyer and agent are told the visit is off.'}
        footer={<><Button variant="ghost" onClick={() => setTarget(null)}>Close</Button>
          {target && target.mode === 'agent'
            ? <Button disabled={!agentId} loading={patch.isPending} onClick={submit}>Reassign</Button>
            : <Button variant="danger" disabled={reason.trim().length < 3} loading={patch.isPending} onClick={submit}>Cancel visit</Button>}</>}>
        {target && target.mode === 'agent'
          ? <Select label="New agent" required placeholder="Choose an agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} options={agentOptions.filter((o) => o.value !== String(target.visit.agentId?._id || ''))} />
          : <Textarea label="Reason" required rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}
        {formError && <Alert tone="danger" className="mt-3">{formError}</Alert>}
      </Modal>
    </>
  );
}
