// Lead side actions: masked update to the owner, share listings, home-loan
// referral (RE-H-10), the rental agreement request on rent deals (RE-H-11) and
// approved WhatsApp templates to an opted-in buyer (RE-K-08).
import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import { SHARE_TAGS, WHATSAPP_TEMPLATES, errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';
import { FEE_PAYERS, PARTNER_DISCLAIMER, dealApi, useDealMutation, usePartners } from '@/modules/deals/agentApi';

export function ShareUpdateModal({ open, onClose, lead, properties = [] }) {
  const toast = useToast();
  const m = useAgentMutation(leadApi.shareUpdate);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const primary = lead && lead.propertyId;
  useEffect(() => { if (open) { setErrors({}); setV({ propertyId: primary || '', tag: 'interest', text: '' }); } }, [open, primary]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    if ((v.text || '').trim().length < 5) { setErrors({ text: 'Write at least 5 characters' }); return; }
    try {
      await m.mutateAsync({ id: lead._id, body: { propertyId: v.propertyId || undefined, tag: v.tag, text: v.text.trim() } });
      toast.success('Update shared with the owner');
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Update the owner" description={`The owner sees "${(lead && lead.buyerLabel) || 'A buyer'}", never the buyer's identity.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>Share</Button></>}>
      <div className="space-y-4">
        <Select label="Property" required value={v.propertyId || ''} onChange={set('propertyId')} placeholder="Choose" error={errors.propertyId}
          options={properties.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}` }))} />
        <Select label="Tag" value={v.tag || 'interest'} onChange={set('tag')} options={SHARE_TAGS} />
        <Textarea label="Summary" required rows={3} maxLength={500} value={v.text || ''} onChange={set('text')} error={errors.text} hint="Contact details are blocked and the attempt is logged" />
      </div>
    </Modal>
  );
}

// Active partners of the right type (GET /api/agent/partners).
function PartnerField({ types, value, onChange, error }) {
  const { data, isError } = usePartners();
  const list = (data || []).filter((p) => types.includes(p.type));
  if (isError) return <Input label="Partner" required value={value} disabled error="Could not load partners. Try again later." />;
  return <Select label="Partner" required placeholder={data ? (list.length ? 'Choose' : 'No active partner') : 'Loading…'} value={value} onChange={(e) => onChange(e.target.value)} error={error}
    options={list.map((p) => ({ value: p._id, label: `${p.name}${(p.cities || []).length ? ` · ${p.cities.slice(0, 3).join(', ')}` : ''}` }))} />;
}

export function LoanReferralModal({ open, onClose, lead }) {
  const toast = useToast();
  const m = useDealMutation(dealApi.loanReferral);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  useEffect(() => { if (open) { setErrors({}); setDone(null); setV({ partnerId: '', loanAmount: '', consent: false, note: '' }); } }, [open]);
  const save = async () => {
    const errs = {};
    if (!/^[a-f0-9]{24}$/.test(v.partnerId)) errs.partnerId = 'Choose the partner';
    if (!(Number(v.loanAmount) > 0)) errs.loanAmount = 'Enter the loan amount';
    if (!v.consent) errs.consent = 'Tick the buyer consent to share their details with this partner';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const r = await m.mutateAsync({ leadId: lead._id, body: { partnerId: v.partnerId, loanAmount: Number(v.loanAmount), consent: true, ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      setDone(r);
      toast.success(`Referral ${r.refNo} sent`);
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Home-loan referral" description="Only the buyer's name, phone, loan amount, city and a price band go to the partner. Never the owner's details."
      footer={done ? <Button onClick={onClose}>Close</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!v.consent} onClick={save}>Refer</Button></>}>
      {done ? (
        <div className="space-y-3">
          <Alert tone="success" title={`Referral ${done.refNo} created`}>Status: {done.status}. The buyer gets an SMS with the reference.</Alert>
          <p className="text-xs text-ink-subtle">{done.disclaimer || PARTNER_DISCLAIMER}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PartnerField types={['bank', 'nbfc']} value={v.partnerId || ''} onChange={(x) => setV((s) => ({ ...s, partnerId: x }))} error={errors.partnerId} />
          <Input label="Loan amount" required leading="₹" type="number" min={1} value={v.loanAmount || ''} onChange={(e) => setV((s) => ({ ...s, loanAmount: e.target.value }))} error={errors.loanAmount} />
          <Textarea label="Note" rows={2} maxLength={500} value={v.note || ''} onChange={(e) => setV((s) => ({ ...s, note: e.target.value }))} />
          <Checkbox label="The buyer agreed to share their name and phone with this partner" description="Recorded in the consent ledger (purpose: partner sharing)."
            checked={Boolean(v.consent)} onChange={(e) => setV((s) => ({ ...s, consent: e.target.checked }))} error={errors.consent} />
          <Alert tone="info">{PARTNER_DISCLAIMER}</Alert>
        </div>
      )}
    </Modal>
  );
}

export function RentalAgreementModal({ open, onClose, deal }) {
  const toast = useToast();
  const m = useDealMutation(dealApi.rentalAgreement);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  useEffect(() => { if (open) { setErrors({}); setDone(null); setV({ partnerId: '', fee: '', payer: 'split', tenantConsent: false, landlordConsent: false, note: '' }); } }, [open]);
  const save = async () => {
    const errs = {};
    if (!/^[a-f0-9]{24}$/.test(v.partnerId)) errs.partnerId = 'Choose the partner';
    if (!v.tenantConsent) errs.tenantConsent = 'The tenant must consent';
    if (!v.landlordConsent) errs.landlordConsent = 'The landlord must consent';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const r = await m.mutateAsync({ id: deal._id, body: { partnerId: v.partnerId, fee: Number(v.fee) || 0, payer: v.payer, tenantConsent: true, landlordConsent: true, ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      setDone(r);
      toast.success(`Request ${r.refNo} sent`);
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open={open} onClose={onClose} title="Request a rental agreement" description="A partner drafts and registers the rent agreement. Both parties' details go to this partner only."
      footer={done ? <Button onClick={onClose}>Close</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>Send request</Button></>}>
      {done ? (
        <div className="space-y-3">
          <Alert tone="success" title={`Request ${done.refNo} created`}>Status: {done.status}. You will be notified as the partner updates it.</Alert>
          <p className="text-xs text-ink-subtle">{done.disclaimer || PARTNER_DISCLAIMER}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PartnerField types={['rental_agreement']} value={v.partnerId || ''} onChange={(x) => setV((s) => ({ ...s, partnerId: x }))} error={errors.partnerId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Fee" leading="₹" type="number" min={0} value={v.fee || ''} onChange={set('fee')} />
            <Select label="Fee paid by" value={v.payer || 'split'} onChange={set('payer')} options={FEE_PAYERS} />
          </div>
          <Textarea label="Note" rows={2} maxLength={500} value={v.note || ''} onChange={set('note')} />
          <Checkbox label="The tenant agreed to share their details with this partner" checked={Boolean(v.tenantConsent)} onChange={(e) => setV((s) => ({ ...s, tenantConsent: e.target.checked }))} error={errors.tenantConsent} />
          <Checkbox label="The landlord agreed to share their details with this partner" checked={Boolean(v.landlordConsent)} onChange={(e) => setV((s) => ({ ...s, landlordConsent: e.target.checked }))} error={errors.landlordConsent} />
          <Alert tone="info">{PARTNER_DISCLAIMER}</Alert>
        </div>
      )}
    </Modal>
  );
}

// RE-K-08: send an approved WhatsApp template (share a listing / visit confirmation).
export function WhatsAppTemplateModal({ open, onClose, lead }) {
  const toast = useToast();
  const m = useAgentMutation(leadApi.whatsappTemplate);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const live = ((lead && lead.properties) || []).filter((p) => p.status === 'live');
  const visits = ((lead && lead.visits) || []).filter((x) => ['scheduled', 'confirmed'].includes(x.status) && new Date(x.scheduledAt) > new Date());
  const primary = lead && lead.propertyId;
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setV({ template: 'share_listing', propertyId: primary || '', visitId: '' });
  }, [open, primary]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const share = v.template === 'share_listing';
  const save = async () => {
    const errs = {};
    if (share && !v.propertyId) errs.propertyId = 'Choose a live listing';
    if (!share && !v.visitId) errs.visitId = 'Choose a scheduled visit';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await m.mutateAsync({ id: lead._id, body: { template: v.template, ...(share ? { propertyId: v.propertyId } : { visitId: v.visitId }) } });
      toast.success('WhatsApp message sent');
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Send on WhatsApp" description="Approved templates only. The message is logged on the lead timeline."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={save}>Send</Button></>}>
      <div className="space-y-4">
        <Select label="Template" required value={v.template || 'share_listing'} onChange={set('template')} options={WHATSAPP_TEMPLATES} />
        {share ? (
          live.length
            ? <Select label="Listing" required placeholder="Choose" value={v.propertyId || ''} onChange={set('propertyId')} error={errors.propertyId} options={live.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}` }))} />
            : <Alert tone="warning">Link a live listing to this lead first.</Alert>
        ) : (
          visits.length
            ? <Select label="Visit" required placeholder="Choose" value={v.visitId || ''} onChange={set('visitId')} error={errors.visitId} options={visits.map((x) => ({ value: x._id, label: `${x.visitNo} · ${dateTime(x.scheduledAt)}` }))} />
            : <Alert tone="warning">There is no upcoming scheduled visit to confirm.</Alert>
        )}
      </div>
    </Modal>
  );
}
