// Follow-up create / edit / bulk and complete modals (RE-S-AGT-06).
import { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { FOLLOWUP_TYPES, errorText, followupApi, useAgentMutation } from '@/modules/leads/agentApi';
import { LeadPicker, fromLocalInput, toLocalInput } from './common';

const REMINDERS = [{ value: '0', label: 'No reminder' }, { value: '15', label: '15 minutes before' }, { value: '30', label: '30 minutes before' }, { value: '60', label: '1 hour before' }];
const inHours = (h) => { const d = new Date(Date.now() + h * 3600000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };

/**
 * mode: create (lead given or picked) | bulk (leadIds) | edit (followup).
 */
export function FollowupModal({ open, onClose, lead, leadIds, followup, onDone }) {
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
    if (mode === 'create' && !target) errs.leadId = 'Choose the lead';
    if (!v.dueAt) errs.dueAt = 'Pick the date and time';
    else if (mode !== 'edit' && new Date(v.dueAt) < new Date(Date.now() - 60000)) errs.dueAt = 'Pick a time from now on';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = { type: v.type, dueAt: fromLocalInput(v.dueAt), remindBeforeMin: Number(v.remind), ...(v.note.trim() ? { note: v.note.trim() } : {}) };
    try {
      if (mode === 'edit') await m.mutateAsync({ id: followup._id, body });
      else if (mode === 'bulk') await m.mutateAsync({ ...body, leadIds });
      else await m.mutateAsync({ ...body, leadId: target._id });
      toast.success(mode === 'edit' ? 'Follow-up updated' : mode === 'bulk' ? `Follow-up added to ${leadIds.length} leads` : 'Follow-up added');
      onDone && onDone();
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };

  const title = mode === 'edit' ? 'Edit follow-up' : mode === 'bulk' ? `Add follow-up to ${leadIds.length} leads` : 'Add follow-up';
  return (
    <Modal open={open} onClose={onClose} title={title} description={lead ? `${lead.leadNo} · ${lead.buyerName || ''}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        {mode === 'create' && !lead && <LeadPicker required value={picked} onChange={setPicked} error={errors.leadId} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Type" required value={v.type || 'call'} onChange={set('type')} options={FOLLOWUP_TYPES} />
          <Input label="Due" type="datetime-local" required value={v.dueAt || ''} onChange={set('dueAt')} error={errors.dueAt} />
        </div>
        <Select label="Reminder" value={v.remind || '15'} onChange={set('remind')} options={REMINDERS} />
        <Textarea label="Note" rows={2} maxLength={500} value={v.note || ''} onChange={set('note')} error={errors.note} />
      </div>
    </Modal>
  );
}

const OUTCOMES = [{ value: 'Done', label: 'Done' }, { value: 'Not reachable', label: 'Not reachable' }, { value: 'Rescheduled', label: 'Rescheduled' }, { value: 'Cancelled', label: 'Cancelled' }];

// Complete one follow-up, or several (followups array) with the same outcome.
export function CompleteFollowupModal({ open, onClose, followups = [], onDone }) {
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
    if (ok) toast.success(ok === 1 ? 'Follow-up completed' : `${ok} follow-ups completed`);
    if (failed.length) toast.error(`${failed.length} could not be completed: ${failed[0]}`);
    onDone && onDone();
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={followups.length > 1 ? `Complete ${followups.length} follow-ups` : 'Complete follow-up'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Complete</Button></>}>
      <div className="space-y-4">
        <Select label="Outcome" required value={v.outcome} onChange={set('outcome')} options={OUTCOMES} />
        <Textarea label="Outcome note" rows={2} maxLength={280} value={v.note} onChange={set('note')} />
        <Checkbox label="Create the next follow-up" checked={v.next} onChange={(e) => setV((x) => ({ ...x, next: e.target.checked }))} />
        {v.next && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type" value={v.type} onChange={set('type')} options={FOLLOWUP_TYPES} />
            <Input label="Due" type="datetime-local" value={v.dueAt} onChange={set('dueAt')} />
          </div>
        )}
      </div>
    </Modal>
  );
}
