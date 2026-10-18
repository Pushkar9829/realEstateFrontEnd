// Open reassignment request from the assigned agent: approve with a new agent
// or reject (RE-C-06). Used on the lead detail and the queue board.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { Button, Select, useToast } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import { useDecideReassign } from '@/modules/leads/adminApi';

export default function ReassignRequest({ lead, r, agentOptions }) {
  const t = useT();
  const toast = useToast();
  const decide = useDecideReassign();
  const [agentId, setAgentId] = useState('');
  const [note, setNote] = useState('');
  const run = async (decision) => {
    try {
      await decide.mutateAsync({ id: lead._id, reqId: r._id, body: { decision, ...(decision === 'approve' ? { agentId } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success(decision === 'approve' ? t('admin.leads.reassign.approved') : t('admin.leads.reassign.rejected'));
    } catch (e) { toast.error(e.message); }
  };
  return (
    <li className="space-y-2 rounded-md border p-3">
      <p className="text-sm text-ink">{r.reason}</p>
      <p className="text-xs text-ink-subtle">{t('admin.leads.reassign.asked', { date: dateTime(r.at) })}</p>
      <Select aria-label={t('admin.leads.reassign.newAgent')} placeholder={t('admin.leads.reassign.newAgentPlaceholder')} value={agentId} onChange={(e) => setAgentId(e.target.value)} options={agentOptions.filter((o) => o.value !== String((lead.assignedTo && lead.assignedTo._id) || lead.assignedTo))} />
      <input className="h-9 w-full rounded-md border border-line-strong px-3 text-sm" placeholder={t('admin.leads.reassign.notePlaceholder')} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} aria-label={t('admin.leads.reassign.decisionNote')} />
      <div className="flex gap-2">
        <Button size="sm" disabled={!agentId} loading={decide.isPending} onClick={() => run('approve')}>{t('admin.leads.reassign.approve')}</Button>
        <Button size="sm" variant="secondary" loading={decide.isPending} onClick={() => run('reject')}>{t('admin.leads.reassign.reject')}</Button>
      </div>
    </li>
  );
}
