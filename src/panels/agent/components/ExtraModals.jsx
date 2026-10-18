// Lead side actions: masked update to the owner, share listings, home-loan
// referral (RE-H-10), the rental agreement request on rent deals (RE-H-11) and
// approved WhatsApp templates to an opted-in buyer (RE-K-08).
import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { dateTime } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { SHARE_TAGS, WHATSAPP_TEMPLATES, errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';
import { FEE_PAYERS, dealApi, partnerDisclaimer, useDealMutation, usePartners } from '@/modules/deals/agentApi';

export function ShareUpdateModal({ open, onClose, lead, properties = [] }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(leadApi.shareUpdate);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const primary = lead && lead.propertyId;
  useEffect(() => { if (open) { setErrors({}); setV({ propertyId: primary || '', tag: 'interest', text: '' }); } }, [open, primary]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    if ((v.text || '').trim().length < 5) { setErrors({ text: t('agent.share.errText') }); return; }
    try {
      await m.mutateAsync({ id: lead._id, body: { propertyId: v.propertyId || undefined, tag: v.tag, text: v.text.trim() } });
      toast.success(t('agent.share.done'));
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('agent.share.title')} description={t('agent.share.desc', { label: (lead && lead.buyerLabel) || t('agent.common.aBuyer') })}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{t('agent.share.share')}</Button></>}>
      <div className="space-y-4">
        <Select label={t('agent.common.property')} required value={v.propertyId || ''} onChange={set('propertyId')} placeholder={t('agent.common.choose')} error={errors.propertyId}
          options={properties.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}` }))} />
        <Select label={t('agent.share.tag')} value={v.tag || 'interest'} onChange={set('tag')} options={SHARE_TAGS} />
        <Textarea label={t('agent.share.summary')} required rows={3} maxLength={500} value={v.text || ''} onChange={set('text')} error={errors.text} hint={t('agent.common.contactBlocked')} />
      </div>
    </Modal>
  );
}

// Active partners of the right type (GET /api/agent/partners).
function PartnerField({ types, value, onChange, error }) {
  const t = useT();
  const { data, isError } = usePartners();
  const list = (data || []).filter((p) => types.includes(p.type));
  if (isError) return <Input label={t('agent.loan.partner')} required value={value} disabled error={t('agent.loan.partnersError')} />;
  return <Select label={t('agent.loan.partner')} required placeholder={data ? (list.length ? t('agent.common.choose') : t('agent.loan.noPartner')) : t('common.loading')} value={value} onChange={(e) => onChange(e.target.value)} error={error}
    options={list.map((p) => ({ value: p._id, label: `${p.name}${(p.cities || []).length ? ` · ${p.cities.slice(0, 3).join(', ')}` : ''}` }))} />;
}

export function LoanReferralModal({ open, onClose, lead }) {
  const t = useT();
  const toast = useToast();
  const m = useDealMutation(dealApi.loanReferral);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  useEffect(() => { if (open) { setErrors({}); setDone(null); setV({ partnerId: '', loanAmount: '', consent: false, note: '' }); } }, [open]);
  const save = async () => {
    const errs = {};
    if (!/^[a-f0-9]{24}$/.test(v.partnerId)) errs.partnerId = t('agent.loan.errPartner');
    if (!(Number(v.loanAmount) > 0)) errs.loanAmount = t('agent.loan.errAmount');
    if (!v.consent) errs.consent = t('agent.loan.errConsent');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const r = await m.mutateAsync({ leadId: lead._id, body: { partnerId: v.partnerId, loanAmount: Number(v.loanAmount), consent: true, ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      setDone(r);
      toast.success(t('agent.loan.sent', { no: r.refNo }));
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('agent.loan.title')} description={t('agent.loan.desc')}
      footer={done ? <Button onClick={onClose}>{t('common.close')}</Button> : <><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} disabled={!v.consent} onClick={save}>{t('agent.loan.refer')}</Button></>}>
      {done ? (
        <div className="space-y-3">
          <Alert tone="success" title={t('agent.loan.created', { no: done.refNo })}>{t('agent.loan.createdText', { status: done.status })}</Alert>
          <p className="text-xs text-ink-subtle">{done.disclaimer || partnerDisclaimer()}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PartnerField types={['bank', 'nbfc']} value={v.partnerId || ''} onChange={(x) => setV((s) => ({ ...s, partnerId: x }))} error={errors.partnerId} />
          <Input label={t('agent.loan.amount')} required leading="₹" type="number" min={1} value={v.loanAmount || ''} onChange={(e) => setV((s) => ({ ...s, loanAmount: e.target.value }))} error={errors.loanAmount} />
          <Textarea label={t('agent.common.note')} rows={2} maxLength={500} value={v.note || ''} onChange={(e) => setV((s) => ({ ...s, note: e.target.value }))} />
          <Checkbox label={t('agent.loan.consent')} description={t('agent.loan.consentHint')}
            checked={Boolean(v.consent)} onChange={(e) => setV((s) => ({ ...s, consent: e.target.checked }))} error={errors.consent} />
          <Alert tone="info">{partnerDisclaimer()}</Alert>
        </div>
      )}
    </Modal>
  );
}

export function RentalAgreementModal({ open, onClose, deal }) {
  const t = useT();
  const toast = useToast();
  const m = useDealMutation(dealApi.rentalAgreement);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  useEffect(() => { if (open) { setErrors({}); setDone(null); setV({ partnerId: '', fee: '', payer: 'split', tenantConsent: false, landlordConsent: false, note: '' }); } }, [open]);
  const save = async () => {
    const errs = {};
    if (!/^[a-f0-9]{24}$/.test(v.partnerId)) errs.partnerId = t('agent.loan.errPartner');
    if (!v.tenantConsent) errs.tenantConsent = t('agent.rental.errTenant');
    if (!v.landlordConsent) errs.landlordConsent = t('agent.rental.errLandlord');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const r = await m.mutateAsync({ id: deal._id, body: { partnerId: v.partnerId, fee: Number(v.fee) || 0, payer: v.payer, tenantConsent: true, landlordConsent: true, ...(v.note.trim() ? { note: v.note.trim() } : {}) } });
      setDone(r);
      toast.success(t('agent.rental.sent', { no: r.refNo }));
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open={open} onClose={onClose} title={t('agent.rental.title')} description={t('agent.rental.desc')}
      footer={done ? <Button onClick={onClose}>{t('common.close')}</Button> : <><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{t('agent.rental.send')}</Button></>}>
      {done ? (
        <div className="space-y-3">
          <Alert tone="success" title={t('agent.rental.created', { no: done.refNo })}>{t('agent.rental.createdText', { status: done.status })}</Alert>
          <p className="text-xs text-ink-subtle">{done.disclaimer || partnerDisclaimer()}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <PartnerField types={['rental_agreement']} value={v.partnerId || ''} onChange={(x) => setV((s) => ({ ...s, partnerId: x }))} error={errors.partnerId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('agent.rental.fee')} leading="₹" type="number" min={0} value={v.fee || ''} onChange={set('fee')} />
            <Select label={t('agent.rental.payer')} value={v.payer || 'split'} onChange={set('payer')} options={FEE_PAYERS} />
          </div>
          <Textarea label={t('agent.common.note')} rows={2} maxLength={500} value={v.note || ''} onChange={set('note')} />
          <Checkbox label={t('agent.rental.tenantConsent')} checked={Boolean(v.tenantConsent)} onChange={(e) => setV((s) => ({ ...s, tenantConsent: e.target.checked }))} error={errors.tenantConsent} />
          <Checkbox label={t('agent.rental.landlordConsent')} checked={Boolean(v.landlordConsent)} onChange={(e) => setV((s) => ({ ...s, landlordConsent: e.target.checked }))} error={errors.landlordConsent} />
          <Alert tone="info">{partnerDisclaimer()}</Alert>
        </div>
      )}
    </Modal>
  );
}

// RE-K-08: send an approved WhatsApp template (share a listing / visit confirmation).
export function WhatsAppTemplateModal({ open, onClose, lead }) {
  const t = useT();
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
    if (share && !v.propertyId) errs.propertyId = t('agent.wa.errListing');
    if (!share && !v.visitId) errs.visitId = t('agent.wa.errVisit');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await m.mutateAsync({ id: lead._id, body: { template: v.template, ...(share ? { propertyId: v.propertyId } : { visitId: v.visitId }) } });
      toast.success(t('agent.wa.sent'));
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('agent.wa.title')} description={t('agent.wa.desc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={save}>{t('agent.wa.send')}</Button></>}>
      <div className="space-y-4">
        <Select label={t('agent.wa.template')} required value={v.template || 'share_listing'} onChange={set('template')} options={WHATSAPP_TEMPLATES} />
        {share ? (
          live.length
            ? <Select label={t('agent.wa.listing')} required placeholder={t('agent.common.choose')} value={v.propertyId || ''} onChange={set('propertyId')} error={errors.propertyId} options={live.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}` }))} />
            : <Alert tone="warning">{t('agent.wa.noListing')}</Alert>
        ) : (
          visits.length
            ? <Select label={t('agent.wa.visit')} required placeholder={t('agent.common.choose')} value={v.visitId || ''} onChange={set('visitId')} error={errors.visitId} options={visits.map((x) => ({ value: x._id, label: `${x.visitNo} · ${dateTime(x.scheduledAt)}` }))} />
            : <Alert tone="warning">{t('agent.wa.noVisit')}</Alert>
        )}
      </div>
    </Modal>
  );
}
