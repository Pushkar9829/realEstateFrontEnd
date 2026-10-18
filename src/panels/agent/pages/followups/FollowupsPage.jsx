// RE-S-AGT-06 Follow-ups: Overdue / Today / Upcoming / Done buckets, create
// and edit, complete with an outcome, and bulk complete or reschedule.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, ListChecks, Mail, MessageCircle, Pencil, Phone, Plus, Users } from 'lucide-react';
import { Button, EmptyState, Input, Modal, PageHeader, Skeleton, Tabs, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { FOLLOWUP_TYPES, errorText, firstName, followupApi, useAgentMutation, useFollowups } from '@/modules/leads/agentApi';
import { CompleteFollowupModal, FollowupModal } from '../../components/FollowupModals';
import { ErrorState, StageBadge, fromLocalInput, toLocalInput } from '../../components/common';

const ICON = { call: Phone, whatsapp: MessageCircle, meeting: Users, email: Mail, other: ListChecks };
// Labels: agent.followups.tab.<value>, empty states agent.followups.empty.<value>.
const TABS = ['overdue', 'today', 'upcoming', 'done'];
const typeLabel = (v) => (FOLLOWUP_TYPES.find((x) => x.value === v) || { label: titleCase(v) }).label;

function RescheduleModal({ open, onClose, items, onDone }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(followupApi.edit);
  const [at, setAt] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setAt(''); }, [open]);
  const save = async () => {
    if (!at) return;
    setBusy(true);
    let ok = 0;
    let fail = '';
    for (const f of items) {
      try { await m.mutateAsync({ id: f._id, body: { dueAt: fromLocalInput(at) } }); ok += 1; } catch (e) { fail = errorText(e); }
    }
    setBusy(false);
    if (ok) toast.success(t('agent.followups.rescheduled', { count: ok }));
    if (fail) toast.error(fail);
    onDone();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title={t('agent.followups.rescheduleTitle', { count: items.length })}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} disabled={!at} onClick={save}>{t('agent.activity.reschedule')}</Button></>}>
      <Input label={t('agent.followups.newDue')} type="datetime-local" min={toLocalInput(new Date())} value={at} onChange={(e) => setAt(e.target.value)} />
    </Modal>
  );
}

export default function FollowupsPage() {
  const t = useT();
  const { data, isLoading, error, refetch } = useFollowups();
  const [tab, setTab] = useState('today');
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null); // { kind, items | followup }

  const items = (data && data[tab]) || [];
  const chosen = items.filter((f) => selected.includes(f._id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const change = (v) => { setTab(v); setSelected([]); };
  const done = tab === 'done';

  return (
    <>
      <PageHeader title={t('panel.nav.agentFollowUps')} description={t('agent.followups.desc')}
        actions={<Button icon={Plus} onClick={() => setModal({ kind: 'create' })}>{t('agent.followup.add')}</Button>} />
      <Tabs className="mb-4" value={tab} onChange={change} tabs={TABS.map((value) => ({ value, label: t(`agent.followups.tab.${value}`), count: data ? (data[value] || []).length : undefined }))} />
      {!done && chosen.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm">
          <span className="font-medium text-brand-700">{t('agent.followups.selected', { n: chosen.length })}</span>
          <Button size="sm" icon={CheckCircle2} onClick={() => setModal({ kind: 'complete', items: chosen })}>{t('agent.followup.complete')}</Button>
          <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => setModal({ kind: 'reschedule', items: chosen })}>{t('agent.activity.reschedule')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>{t('agent.followups.clear')}</Button>
        </div>
      )}
      {isLoading ? <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        : error ? <ErrorState error={error} onRetry={refetch} title={t('agent.followups.loadError')} />
          : !items.length ? <EmptyState icon={ListChecks} title={t(`agent.followups.empty.${tab}`)} />
            : (
              <ul className="divide-y rounded-lg border bg-white shadow-sm">
                {!done && (
                  <li className="flex items-center gap-3 bg-surface-muted px-4 py-2 text-xs text-ink-subtle">
                    <input type="checkbox" aria-label={t('agent.followups.selectAll')} checked={chosen.length === items.length} onChange={() => setSelected(chosen.length === items.length ? [] : items.map((f) => f._id))} />
                    {t('agent.followups.selectAll')}
                  </li>
                )}
                {items.map((f) => {
                  const Icon = ICON[f.type] || ListChecks;
                  const lead = f.leadId || {};
                  return (
                    <li key={f._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      {!done && <input type="checkbox" aria-label={t('agent.followups.select')} checked={selected.includes(f._id)} onChange={() => toggle(f._id)} />}
                      <span className={cn('rounded-md p-2', tab === 'overdue' ? 'bg-danger-50 text-danger-700' : 'bg-brand-50 text-brand-700')}><Icon className="h-4 w-4" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">
                          {done ? dateTime(f.doneAt) : dateTime(f.dueAt)} · {typeLabel(f.type)}
                          {tab === 'overdue' && <span className="ml-2 text-xs font-normal text-danger-700">{t('agent.followups.dueAgo', { ago: timeAgo(f.dueAt) })}</span>}
                        </p>
                        <p className="truncate text-xs text-ink-subtle">
                          <Link to={`/agent/leads/${lead._id}`} className="hover:text-brand-700">{lead.leadNo} · {firstName(lead.buyer && lead.buyer.name)}</Link>
                          {done ? ` · ${f.outcome || ''}` : f.note ? ` · ${f.note}` : ''}
                        </p>
                      </div>
                      {lead.stage && <StageBadge stage={lead.stage} />}
                      {!done && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="ghost" icon={Pencil} aria-label={t('agent.activity.edit')} onClick={() => setModal({ kind: 'edit', followup: f })} />
                          <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'complete', items: [f] })}>{t('agent.followup.outcomes.done')}</Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

      <FollowupModal open={Boolean(modal && modal.kind === 'create')} onClose={() => setModal(null)} />
      <FollowupModal open={Boolean(modal && modal.kind === 'edit')} onClose={() => setModal(null)} followup={modal && modal.followup}
        lead={modal && modal.followup && modal.followup.leadId ? { _id: modal.followup.leadId._id, leadNo: modal.followup.leadId.leadNo, buyerName: modal.followup.leadId.buyer && modal.followup.leadId.buyer.name } : undefined} />
      <CompleteFollowupModal open={Boolean(modal && modal.kind === 'complete')} onClose={() => setModal(null)} followups={(modal && modal.items) || []} onDone={() => setSelected([])} />
      <RescheduleModal open={Boolean(modal && modal.kind === 'reschedule')} onClose={() => setModal(null)} items={(modal && modal.items) || []} onDone={() => setSelected([])} />
    </>
  );
}
