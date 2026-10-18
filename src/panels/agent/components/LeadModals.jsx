// Call log and stage change modals (RE-S-AGT-04 / RE-S-AGT-03 / Today).
import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { Phone } from 'lucide-react';
import { CALL_OUTCOMES, LOST_REASONS, STAGES, errorText, isBackMove, leadApi, revealBuyerContact, stageInfo, useAgentMutation } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';

export function CallLogModal({ open, onClose, lead, onLogged }) {
  const t = useT();
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
    if (min !== undefined && (Number.isNaN(min) || min < 0 || min > 180)) { setErrors({ durationSec: t('agent.call.errDuration') }); return; }
    try {
      const r = await m.mutateAsync({ id: lead._id, body: { outcome: v.outcome, direction: v.direction, ...(min !== undefined ? { durationSec: Math.round(min * 60) } : {}), ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      toast.success(v.outcome === 'connected' && lead.stage === 'new' ? t('agent.call.loggedContacted') : t('agent.call.logged'));
      onLogged && onLogged(r);
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('agent.call.title')} description={lead ? `${lead.leadNo} · ${lead.buyerName || ''}` : ''}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{t('agent.call.save')}</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
          <span className="text-ink">{phone || (lead && (lead.buyerPhone || (lead.buyer && lead.buyer.phone))) || t('agent.call.phoneHidden')}</span>
          {phone
            ? <Button size="sm" icon={Phone} to={undefined} onClick={() => { window.location.href = `tel:${phone}`; }}>{t('agent.call.callNow')}</Button>
            : <Button size="sm" variant="secondary" icon={Phone} loading={revealing} onClick={reveal}>{t('agent.call.reveal')}</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('agent.call.outcome')} required value={v.outcome} onChange={set('outcome')} options={CALL_OUTCOMES} error={errors.outcome} />
          <Select label={t('agent.call.direction')} value={v.direction} onChange={set('direction')} options={[{ value: 'outbound', label: t('agent.call.outbound') }, { value: 'inbound', label: t('agent.call.inbound') }]} />
        </div>
        <Input label={t('agent.call.duration')} type="number" min={0} max={180} value={v.minutes} onChange={set('minutes')} error={errors.durationSec} />
        <Textarea label={t('agent.common.note')} rows={3} maxLength={1000} value={v.note} onChange={set('note')} error={errors.note} />
        <p className="text-xs text-ink-subtle">{t('agent.call.unansweredHint')}</p>
      </div>
    </Modal>
  );
}

// Stage change with the rules: back moves need a note (only to contacted /
// qualified), lost needs a reason, won and booking come from the deal flow.
export function StageChangeModal({ open, onClose, lead, to: presetTo, onDone }) {
  const t = useT();
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
    if (!to) errs.stage = t('agent.stageModal.errStage');
    if (back && note.trim().length < 3) errs.note = t('agent.stageModal.errBackNote');
    if (lost && !lostReason) errs.lostReason = t('agent.stageModal.errLost');
    if (lost && lostReason === 'other' && lostNote.trim().length < 3) errs.lostNote = t('agent.stageModal.errLostNote');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await m.mutateAsync({ id: lead._id, body: { stage: to, ...(note.trim() ? { note: note.trim() } : {}), ...(lost ? { lostReason, ...(lostNote.trim() ? { lostNote: lostNote.trim() } : {}) } : {}) } });
      toast.success(t('agent.stageModal.moved', { stage: stageInfo(to).label }));
      onDone && onDone(to);
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('agent.stageModal.title')} description={t('agent.stageModal.desc', { no: lead.leadNo, stage: stageInfo(lead.stage).label.toLowerCase() })}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant={lost ? 'danger' : 'primary'} loading={m.isPending} onClick={save}>{lost ? t('agent.stageModal.markLost') : t('agent.stageModal.title')}</Button></>}>
      <div className="space-y-4">
        <Select label={t('agent.stageModal.newStage')} required placeholder={t('agent.common.choose')} value={to} onChange={(e) => setTo(e.target.value)} options={options} error={errors.stage} />
        <Alert tone="info">{t('agent.stageModal.rules')}</Alert>
        {back && <Alert tone="warning">{t('agent.stageModal.backRule')}</Alert>}
        {lost && (
          <>
            <Select label={t('agent.stageModal.lostReason')} required placeholder={t('agent.common.choose')} value={lostReason} onChange={(e) => setLostReason(e.target.value)} options={LOST_REASONS} error={errors.lostReason} />
            <Textarea label={lostReason === 'other' ? t('agent.stageModal.lostNote') : t('agent.stageModal.lostNoteOptional')} rows={2} maxLength={500} value={lostNote} onChange={(e) => setLostNote(e.target.value)} error={errors.lostNote} />
          </>
        )}
        {!lost && <Textarea label={back ? t('agent.common.note') : t('agent.common.noteOptional')} required={back} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />}
      </div>
    </Modal>
  );
}
