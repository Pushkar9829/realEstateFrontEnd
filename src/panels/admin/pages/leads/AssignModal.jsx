// Shared assign / reassign dialog for one or many leads. Agents come from the
// teams the user can see (own teams for managers).
import { useState } from 'react';
import { Alert, Button, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { useAgentOptions } from '@/modules/teams/api';
import { useAssignLead, useBulkAssign } from '@/modules/leads/adminApi';

export default function AssignModal({ open, onClose, leadIds = [], title, currentAgentId, onDone }) {
  const toast = useToast();
  const { options, isLoading, error } = useAgentOptions();
  const assign = useAssignLead();
  const bulk = useBulkAssign();
  const [agentId, setAgentId] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState(null);
  const many = leadIds.length > 1;

  const close = () => { setAgentId(''); setReason(''); setFormError(null); onClose(); };
  const submit = async () => {
    setFormError(null);
    try {
      if (many) {
        const r = await bulk.mutateAsync({ leadIds, agentId, ...(reason.trim() ? { reason: reason.trim() } : {}) });
        toast.success(`${r.assigned} of ${leadIds.length} leads assigned`);
      } else {
        await assign.mutateAsync({ id: leadIds[0], agentId, reason: reason.trim() || undefined });
        toast.success(currentAgentId ? 'Lead reassigned' : 'Lead assigned');
      }
      if (onDone) onDone();
      close();
    } catch (e) { setFormError((e.fieldErrors || {}).agentId || e.message); }
  };

  return (
    <Modal open={open} onClose={close} title={title || (many ? `Assign ${leadIds.length} leads` : currentAgentId ? 'Reassign lead' : 'Assign lead')}
      description="The new agent is notified; the old agent too on a reassignment. Open follow-ups, visits and offers move with the lead."
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={!agentId || agentId === currentAgentId} loading={assign.isPending || bulk.isPending} onClick={submit}>Assign</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error.message}</Alert>}
        <Select label="Agent" required placeholder={isLoading ? 'Loading agents…' : 'Choose an agent'} value={agentId} onChange={(e) => setAgentId(e.target.value)}
          options={options.filter((o) => o.value !== currentAgentId)} hint="Shown as name · team · open leads / capacity." />
        <Textarea label="Reason" rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} hint="Optional. Added to the lead timeline and the audit log." />
        {formError && <Alert tone="danger">{formError}</Alert>}
      </div>
    </Modal>
  );
}
