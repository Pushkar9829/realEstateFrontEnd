// Follow-up create / edit / bulk and complete modals (RE-S-AGT-06).
import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { FOLLOWUP_TYPES, errorText, followupApi, useAgentMutation } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { LeadPicker, fromLocalInput, toLocalInput } from './common';

const REMINDERS = ['0', '15', '30', '60'];
const inHours = (h) => { const d = new Date(Date.now() + h * 3600000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };

/**
 * mode: create (lead given or picked) | bulk (leadIds) | edit (followup).
 */
export function FollowupModal({ open, onClose, lead, leadIds, followup, onDone }) {
  const t = useT();
  const toast = useToast();
  const mode = followup ? 'edit' : leadIds ? 'bulk' : 'create';
  const fn = mode === 'edit' ? followupApi.edit : mode === 'bulk' ? followupApi.bulk : followupApi.create;
  const m = useAgentMutation(fn);
  const [picked, setPicked] = useState(null);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setErrors({});
    setV(followup ? { type: followup.type, dueAt: toLocalInput(followup.dueAt), remind: '15', note: followup.note || '' } : { type: 'call', dueAt: toLocalInput(inHours(2)), remind: '15', note: '' });
  }, [open, followup]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const target = lead || picked;

  const save = async () => {
    const errs = {};
    if (mode === 'create' && !target) errs.leadId = t('agent.followup.errLead');
    if (!v.dueAt) errs.dueAt = t('agent.followup.errDue');
    else if (mode !== 'edit' && new Date(v.dueAt) < new Date(Date.now() - 60000)) errs.dueAt = t('agent.followup.errPast');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = { type: v.type, dueAt: fromLocalInput(v.dueAt), remindBeforeMin: Number(v.remind), ...(v.note.trim() ? { note: v.note.trim() } : {}) };
    try {
      if (mode === 'edit') await m.mutateAsync({ id: followup._id, body });
      else if (mode === 'bulk') await m.mutateAsync({ ...body, leadIds });
      else await m.mutateAsync({ ...body, leadId: target._id });
      toast.success(mode === 'edit' ? t('agent.followup.updated') : mode === 'bulk' ? t('agent.followup.addedBulk', { count: leadIds.length }) : t('agent.followup.added'));
      onDone && onDone();
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };

  const title = mode === 'edit' ? t('agent.followup.edit') : mode === 'bulk' ? t('agent.followup.addBulk', { count: leadIds.length }) : t('agent.followup.add');
  return (
    <Modal open={open} onClose={onClose} title={title} description={lead ? `${lead.leadNo} · ${lead.buyerName || ''}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{t('common.save')}</Button></>}>
      <div className="space-y-4">
        {mode === 'create' && !lead && <LeadPicker required value={picked} onChange={setPicked} error={errors.leadId} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('agent.followup.type')} required value={v.type || 'call'} onChange={set('type')} options={FOLLOWUP_TYPES} />
          <Input label={t('agent.followup.due')} type="datetime-local" required value={v.dueAt || ''} onChange={set('dueAt')} error={errors.dueAt} />
        </div>
        <Select label={t('agent.followup.reminder')} value={v.remind || '15'} onChange={set('remind')} options={REMINDERS.map((r) => ({ value: r, label: t(`agent.followup.remind${r}`) }))} />
        <Textarea label={t('agent.common.note')} rows={2} maxLength={500} value={v.note || ''} onChange={set('note')} error={errors.note} />
      </div>
    </Modal>
  );
}

// Values are saved as the outcome text (kept in English); labels are translated.
const OUTCOMES = [['Done', 'done'], ['Not reachable', 'notReachable'], ['Rescheduled', 'rescheduled'], ['Cancelled', 'cancelled']];

// Complete one follow-up, or several (followups array) with the same outcome.
export function CompleteFollowupModal({ open, onClose, followups = [], onDone }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(followupApi.complete);
  const [v, setV] = useState({ outcome: 'Done', note: '', next: false, dueAt: '', type: 'call' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setV({ outcome: 'Done', note: '', next: false, dueAt: toLocalInput(inHours(24)), type: 'call' }); }, [open]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const outcome = `${v.outcome}${v.note.trim() ? `: ${v.note.trim()}` : ''}`.slice(0, 300);
    const body = { outcome, ...(v.next && v.dueAt ? { next: { dueAt: fromLocalInput(v.dueAt), type: v.type } } : {}) };
    setBusy(true);
    let ok = 0;
    const failed = [];
    for (const f of followups) {
      try { await m.mutateAsync({ id: f._id, body }); ok += 1; } catch (e) { failed.push(errorText(e)); }
    }
    setBusy(false);
    if (ok) toast.success(ok === 1 ? t('agent.followup.completedOne') : t('agent.followup.completedMany', { n: ok }));
    if (failed.length) toast.error(t('agent.followup.completeFailed', { n: failed.length, error: failed[0] }));
    onDone && onDone();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={followups.length > 1 ? t('agent.followup.completeMany', { n: followups.length }) : t('agent.followup.completeOne')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} onClick={save}>{t('agent.followup.complete')}</Button></>}>
      <div className="space-y-4">
        <Select label={t('agent.followup.outcome')} required value={v.outcome} onChange={set('outcome')} options={OUTCOMES.map(([value, k]) => ({ value, label: t(`agent.followup.outcomes.${k}`) }))} />
        <Textarea label={t('agent.followup.outcomeNote')} rows={2} maxLength={280} value={v.note} onChange={set('note')} />
        <Checkbox label={t('agent.followup.createNext')} checked={v.next} onChange={(e) => setV((x) => ({ ...x, next: e.target.checked }))} />
        {v.next && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('agent.followup.type')} value={v.type} onChange={set('type')} options={FOLLOWUP_TYPES} />
            <Input label={t('agent.followup.due')} type="datetime-local" value={v.dueAt} onChange={set('dueAt')} />
          </div>
        )}
      </div>
    </Modal>
  );
}
