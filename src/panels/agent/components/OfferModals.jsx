// Offers panel modals (RE-C-20): record a buyer offer, buyer counter / accept.
import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { rupees } from '@/shared/lib/format';
import { errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';

export function RecordOfferModal({ open, onClose, lead, properties = [], initialAmount, initialPropertyId }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(leadApi.recordOffer);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const idOf = (x) => (x && typeof x === 'object' ? x._id : x);
  const props = (lead && lead.properties) || [];
  // Preselect the lead's own property, or the only linked one.
  const primary = (lead && idOf(lead.propertyId)) || (props.length === 1 ? idOf(props[0]._id || props[0].propertyId || props[0]) : '');
  useEffect(() => { if (open) { setErrors({}); setV({ propertyId: idOf(initialPropertyId) || primary || '', amount: initialAmount ? String(initialAmount) : '', token: '', possessionDate: '', inclusions: '', validityDays: '7', note: '' }); } }, [open, primary, initialAmount, initialPropertyId]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const errs = {};
    if (!v.propertyId) errs.propertyId = t('agent.offer.errProperty');
    if (!(Number(v.amount) > 0)) errs.amount = t('agent.offer.errAmount');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const terms = { ...(Number(v.token) > 0 ? { token: Number(v.token) } : {}), ...(v.possessionDate ? { possessionDate: v.possessionDate } : {}), ...(v.inclusions.trim() ? { inclusions: v.inclusions.trim() } : {}) };
    try {
      await m.mutateAsync({ id: lead._id, body: { propertyId: v.propertyId, amount: Number(v.amount), terms, validityDays: Number(v.validityDays), ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      toast.success(t('agent.offer.sent'));
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('agent.offer.title')} description={t('agent.offer.desc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{t('agent.offer.send')}</Button></>}>
      <div className="space-y-4">
        <Select label={t('agent.common.property')} required placeholder={t('agent.common.choose')} value={v.propertyId || ''} onChange={set('propertyId')} error={errors.propertyId}
          options={properties.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}` }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('agent.offer.amount')} required leading="₹" type="number" min={1} value={v.amount || ''} onChange={set('amount')} error={errors.amount} />
          <Input label={t('agent.offer.token')} leading="₹" type="number" min={0} value={v.token || ''} onChange={set('token')} />
          <Input label={t('agent.offer.possession')} type="date" value={v.possessionDate || ''} onChange={set('possessionDate')} />
          <Select label={t('agent.offer.validFor')} value={v.validityDays || '7'} onChange={set('validityDays')} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: t('agent.offer.days', { count: n }) }))} />
        </div>
        <Input label={t('agent.offer.inclusions')} maxLength={300} placeholder={t('agent.offer.inclusionsPh')} value={v.inclusions || ''} onChange={set('inclusions')} />
        <Textarea label={t('agent.offer.noteOwner')} rows={2} maxLength={500} value={v.note || ''} onChange={set('note')} hint={t('agent.offer.noteHint')} error={errors.note} />
      </div>
    </Modal>
  );
}

// kind: accept (buyer accepts the owner's counter) | counter (buyer's new amount).
export function BuyerRoundModal({ open, onClose, offer, kind }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(leadApi.offerRound);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setAmount(''); setNote(''); setError(''); } }, [open]);
  if (!offer) return null;
  const last = offer.rounds[offer.rounds.length - 1];
  const save = async () => {
    if (kind === 'counter' && !(Number(amount) > 0)) { setError(t('agent.offer.errNewAmount')); return; }
    try {
      await m.mutateAsync({ offerId: offer._id, body: { kind, ...(kind === 'counter' ? { amount: Number(amount) } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success(kind === 'accept' ? t('agent.offer.accepted') : t('agent.offer.counterSent'));
      onClose();
    } catch (e) { setError(errorText(e)); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title={kind === 'accept' ? t('agent.offer.acceptTitle') : t('agent.offer.counterTitle')}
      description={`${offer.offerNo} · ${t('agent.offer.ownerLast', { amount: rupees(last && last.amount) })}`}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{kind === 'accept' ? t('agent.offer.accept') : t('agent.offer.sendCounter')}</Button></>}>
      <div className="space-y-4">
        {kind === 'counter' && <Input label={t('agent.offer.newAmount')} required leading="₹" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} error={error} />}
        {kind === 'accept' && error && <p className="text-xs text-danger-600">{error}</p>}
        <Textarea label={t('agent.offer.noteOwner')} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
