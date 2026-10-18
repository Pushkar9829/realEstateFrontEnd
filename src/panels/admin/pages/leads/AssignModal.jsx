// Shared assign / reassign dialog for one or many leads. Agents come from the
// teams the user can see (own teams for managers).
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { Alert, Button, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { useAgentOptions } from '@/modules/teams/api';
import { useAssignLead, useBulkAssign } from '@/modules/leads/adminApi';

export default function AssignModal({ open, onClose, leadIds = [], title, currentAgentId, onDone }) {
  const t = useT();
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
        toast.success(t('admin.leads.assign.bulkDone', { n: r.assigned, total: leadIds.length }));
      } else {
        await assign.mutateAsync({ id: leadIds[0], agentId, reason: reason.trim() || undefined });
        toast.success(currentAgentId ? t('admin.leads.assign.reassigned') : t('admin.leads.assign.assigned'));
      }
      if (onDone) onDone();
      close();
    } catch (e) { setFormError((e.fieldErrors || {}).agentId || e.message); }
  };

  return (
    <Modal open={open} onClose={close} title={title || (many ? t('admin.leads.assign.titleMany', { n: leadIds.length }) : currentAgentId ? t('admin.leads.assign.titleReassign') : t('admin.leads.assign.titleAssign'))}
      description={t('admin.leads.assign.description')}
      footer={<><Button variant="ghost" onClick={close}>{t('common.cancel')}</Button><Button disabled={!agentId || agentId === currentAgentId} loading={assign.isPending || bulk.isPending} onClick={submit}>{t('admin.leads.assignBtn')}</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error.message}</Alert>}
        <Select label={t('admin.leads.agent')} required placeholder={isLoading ? t('admin.leads.assign.loadingAgents') : t('admin.leads.assign.chooseAgent')} value={agentId} onChange={(e) => setAgentId(e.target.value)}
          options={options.filter((o) => o.value !== currentAgentId)} hint={t('admin.leads.assign.agentHint')} />
        <Textarea label={t('admin.leads.assign.reason')} rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} hint={t('admin.leads.assign.reasonHint')} />
        {formError && <Alert tone="danger">{formError}</Alert>}
      </div>
    </Modal>
  );
}
