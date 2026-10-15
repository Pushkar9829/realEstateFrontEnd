// Offers panel modals (RE-C-20): record a buyer offer, buyer counter / accept.
import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { rupees } from '@/shared/lib/format';
import { errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';

export function RecordOfferModal({ open, onClose, lead, properties = [], initialAmount, initialPropertyId }) {
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
    if (!v.propertyId) errs.propertyId = 'Choose the property';
    if (!(Number(v.amount) > 0)) errs.amount = 'Enter the offer amount';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const terms = { ...(Number(v.token) > 0 ? { token: Number(v.token) } : {}), ...(v.possessionDate ? { possessionDate: v.possessionDate } : {}), ...(v.inclusions.trim() ? { inclusions: v.inclusions.trim() } : {}) };
    try {
      await m.mutateAsync({ id: lead._id, body: { propertyId: v.propertyId, amount: Number(v.amount), terms, validityDays: Number(v.validityDays), ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      toast.success('Offer sent to the owner\'s Offers inbox');
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Record buyer offer" description="The owner sees the buyer label only. One open offer per lead and property."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>Send offer</Button></>}>
      <div className="space-y-4">
        <Select label="Property" required placeholder="Choose" value={v.propertyId || ''} onChange={set('propertyId')} error={errors.propertyId}
          options={properties.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}` }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Offer amount" required leading="₹" type="number" min={1} value={v.amount || ''} onChange={set('amount')} error={errors.amount} />
          <Input label="Token amount" leading="₹" type="number" min={0} value={v.token || ''} onChange={set('token')} />
          <Input label="Possession / move-in date" type="date" value={v.possessionDate || ''} onChange={set('possessionDate')} />
          <Select label="Valid for" value={v.validityDays || '7'} onChange={set('validityDays')} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n} day${n > 1 ? 's' : ''}` }))} />
        </div>
        <Input label="Inclusions" maxLength={300} placeholder="e.g. modular kitchen, 2 ACs, covered parking" value={v.inclusions || ''} onChange={set('inclusions')} />
        <Textarea label="Note to the owner" rows={2} maxLength={500} value={v.note || ''} onChange={set('note')} hint="No phone numbers, emails or names" error={errors.note} />
      </div>
    </Modal>
  );
}

// kind: accept (buyer accepts the owner's counter) | counter (buyer's new amount).
export function BuyerRoundModal({ open, onClose, offer, kind }) {
  const toast = useToast();
  const m = useAgentMutation(leadApi.offerRound);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setAmount(''); setNote(''); setError(''); } }, [open]);
  if (!offer) return null;
  const last = offer.rounds[offer.rounds.length - 1];
  const save = async () => {
    if (kind === 'counter' && !(Number(amount) > 0)) { setError('Enter the buyer\'s new amount'); return; }
    try {
      await m.mutateAsync({ offerId: offer._id, body: { kind, ...(kind === 'counter' ? { amount: Number(amount) } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success(kind === 'accept' ? 'Accepted. You can now create the deal.' : 'Counter sent to the owner');
      onClose();
    } catch (e) { setError(errorText(e)); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" title={kind === 'accept' ? 'Buyer accepts the counter' : 'Buyer counter-offer'}
      description={`${offer.offerNo} · owner's last amount ${rupees(last && last.amount)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>{kind === 'accept' ? 'Accept' : 'Send counter'}</Button></>}>
      <div className="space-y-4">
        {kind === 'counter' && <Input label="Buyer's new amount" required leading="₹" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} error={error} />}
        {kind === 'accept' && error && <p className="text-xs text-danger-600">{error}</p>}
        <Textarea label="Note to the owner" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
