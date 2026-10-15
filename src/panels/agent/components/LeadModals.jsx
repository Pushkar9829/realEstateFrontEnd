// Call log and stage change modals (RE-S-AGT-04 / RE-S-AGT-03 / Today).
import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { Phone } from 'lucide-react';
import { CALL_OUTCOMES, LOST_REASONS, STAGES, errorText, isBackMove, leadApi, revealBuyerContact, stageInfo, useAgentMutation } from '@/modules/leads/agentApi';

export function CallLogModal({ open, onClose, lead, onLogged }) {
  const toast = useToast();
  const m = useAgentMutation(leadApi.call);
  const [v, setV] = useState({ outcome: 'connected', direction: 'outbound', minutes: '', note: '' });
  const [errors, setErrors] = useState({});
  const [phone, setPhone] = useState(null); // revealed number for this call (the reveal is audited)
  const [revealing, setRevealing] = useState(false);
  useEffect(() => { if (open) { setV({ outcome: 'connected', direction: 'outbound', minutes: '', note: '' }); setErrors({}); setPhone(null); } }, [open]);
  const reveal = async () => {
    setRevealing(true);
    try { const r = await revealBuyerContact(lead._id, 'phone'); setPhone(r.value); } catch (e) { toast.error(errorText(e)); } finally { setRevealing(false); }
  };
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const min = v.minutes === '' ? undefined : Number(v.minutes);
    if (min !== undefined && (Number.isNaN(min) || min < 0 || min > 180)) { setErrors({ durationSec: 'Duration is 0-180 minutes' }); return; }
    try {
      const r = await m.mutateAsync({ id: lead._id, body: { outcome: v.outcome, direction: v.direction, ...(min !== undefined ? { durationSec: Math.round(min * 60) } : {}), ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      toast.success(v.outcome === 'connected' && lead.stage === 'new' ? 'Call logged; lead moved to contacted' : 'Call logged');
      onLogged && onLogged(r);
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Log a call" description={lead ? `${lead.leadNo} · ${lead.buyerName || ''}` : ''}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>Save call</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
          <span className="text-ink">{phone || (lead && (lead.buyerPhone || (lead.buyer && lead.buyer.phone))) || 'Phone hidden'}</span>
          {phone
            ? <Button size="sm" icon={Phone} to={undefined} onClick={() => { window.location.href = `tel:${phone}`; }}>Call now</Button>
            : <Button size="sm" variant="secondary" icon={Phone} loading={revealing} onClick={reveal}>Reveal and call</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Outcome" required value={v.outcome} onChange={set('outcome')} options={CALL_OUTCOMES} error={errors.outcome} />
          <Select label="Direction" value={v.direction} onChange={set('direction')} options={[{ value: 'outbound', label: 'Outbound' }, { value: 'inbound', label: 'Inbound' }]} />
        </div>
        <Input label="Duration (minutes)" type="number" min={0} max={180} value={v.minutes} onChange={set('minutes')} error={errors.durationSec} />
        <Textarea label="Note" rows={3} maxLength={1000} value={v.note} onChange={set('note')} error={errors.note} />
        <p className="text-xs text-ink-subtle">Three unanswered calls in a row create a &quot;not reachable&quot; follow-up for the next working day.</p>
      </div>
    </Modal>
  );
}

// Stage change with the rules: back moves need a note (only to contacted /
// qualified), lost needs a reason, won and booking come from the deal flow.
export function StageChangeModal({ open, onClose, lead, to: presetTo, onDone }) {
  const toast = useToast();
  const m = useAgentMutation(leadApi.stage);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [lostNote, setLostNote] = useState('');
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setTo(presetTo || ''); setNote(''); setLostReason(''); setLostNote(''); setErrors({}); } }, [open, presetTo]);
  if (!lead) return null;
  const back = Boolean(to) && isBackMove(lead.stage, to);
  const lost = to === 'closed_lost';
  const options = STAGES.filter((s) => !['closed_won', 'booking', 'site_visit_scheduled', lead.stage].includes(s.value)).map((s) => ({ value: s.value, label: s.label }));
  const save = async () => {
    const errs = {};
    if (!to) errs.stage = 'Choose a stage';
    if (back && note.trim().length < 3) errs.note = 'Add a note when moving a lead back';
    if (lost && !lostReason) errs.lostReason = 'A lost reason is required';
    if (lost && lostReason === 'other' && lostNote.trim().length < 3) errs.lostNote = 'Describe the reason';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await m.mutateAsync({ id: lead._id, body: { stage: to, ...(note.trim() ? { note: note.trim() } : {}), ...(lost ? { lostReason, ...(lostNote.trim() ? { lostNote: lostNote.trim() } : {}) } : {}) } });
      toast.success(`Moved to ${stageInfo(to).label}`);
      onDone && onDone(to);
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change stage" description={`${lead.leadNo} is ${stageInfo(lead.stage).label.toLowerCase()}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={lost ? 'danger' : 'primary'} loading={m.isPending} onClick={save}>{lost ? 'Mark as lost' : 'Change stage'}</Button></>}>
      <div className="space-y-4">
        <Select label="New stage" required placeholder="Choose" value={to} onChange={(e) => setTo(e.target.value)} options={options} error={errors.stage} />
        <Alert tone="info">Site visit scheduled is set by scheduling a visit; booking by submitting a deal; won only when the deal is verified.</Alert>
        {back && <Alert tone="warning">Moving back is allowed only to contacted or qualified, with a note.</Alert>}
        {lost && (
          <>
            <Select label="Lost reason" required placeholder="Choose" value={lostReason} onChange={(e) => setLostReason(e.target.value)} options={LOST_REASONS} error={errors.lostReason} />
            <Textarea label={lostReason === 'other' ? 'Lost note' : 'Lost note (optional)'} rows={2} maxLength={500} value={lostNote} onChange={(e) => setLostNote(e.target.value)} error={errors.lostNote} />
          </>
        )}
        {!lost && <Textarea label={back ? 'Note' : 'Note (optional)'} required={back} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />}
      </div>
    </Modal>
  );
}
