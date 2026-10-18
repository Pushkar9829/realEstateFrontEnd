// RE-S-AGT-05 New lead (hotline / walk-in / referral): assigned to me; a
// duplicate on the same property within the dedupe window opens that lead.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Checkbox, Input, PageHeader, Select, Textarea, useToast } from '@/shared/ui';
import { usePropertySearch, errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';

// Labels: agent.newLead.src.<value>.
const SOURCES = ['hotline', 'walk_in', 'whatsapp', 'referral'];
const csvList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export default function NewLeadPage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const m = useAgentMutation(leadApi.create);
  const [v, setV] = useState({ source: 'hotline', name: '', phone: '', email: '', listingNo: '', referralCode: '', purpose: '', city: '', localities: '', bhk: '', budgetMin: '', budgetMax: '', notes: '', consent: false });
  const [errors, setErrors] = useState({});
  const [dup, setDup] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const listingQ = v.listingNo.trim().toUpperCase();
  const lookup = usePropertySearch({ q: listingQ }, /^RE\d{2}-\d{6}$/.test(listingQ));
  const property = lookup.data && lookup.data[0];

  const save = async () => {
    const errs = {};
    if (v.name.trim().length < 2) errs.name = t('agent.newLead.errName');
    if (v.phone.replace(/[\s()-]/g, '').length < 10) errs.phone = t('agent.newLead.errPhone');
    if (listingQ && !property) errs.listingNo = t('agent.newLead.errListing');
    if (v.referralCode && !/^[A-Z0-9]{6,12}$/i.test(v.referralCode)) errs.referralCode = t('agent.newLead.errReferral');
    if (!v.consent) errs.consent = t('agent.newLead.errConsent');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const requirement = {
      ...(v.purpose ? { purpose: v.purpose } : {}), ...(v.city.trim() ? { city: v.city.trim() } : {}), ...(csvList(v.localities).length ? { localities: csvList(v.localities) } : {}),
      ...(csvList(v.bhk).length ? { bhk: csvList(v.bhk).map(Number).filter(Number.isInteger) } : {}), ...(Number(v.budgetMin) > 0 ? { budgetMin: Number(v.budgetMin) } : {}), ...(Number(v.budgetMax) > 0 ? { budgetMax: Number(v.budgetMax) } : {}),
    };
    try {
      const lead = await m.mutateAsync({
        source: v.source, name: v.name.trim(), phone: v.phone.replace(/\s/g, ''), ...(v.email.trim() ? { email: v.email.trim() } : {}), ...(property ? { propertyId: property.id } : {}),
        ...(v.referralCode ? { referralCode: v.referralCode.toUpperCase() } : {}), ...(v.notes.trim() ? { notes: v.notes.trim() } : {}), ...(Object.keys(requirement).length ? { requirement } : {}), consent: true,
      });
      toast.success(t('agent.newLead.created', { no: lead.leadNo }));
      navigate(`/agent/leads/${lead._id}`);
    } catch (e) {
      if (e.code === 'DUPLICATE_LEAD') { setDup(e.details || {}); return; }
      setErrors(e.fieldErrors || {});
      toast.error(errorText(e));
    }
  };

  return (
    <>
      <PageHeader title={t('agent.leads.newLead')} description={t('agent.newLead.desc')} breadcrumb={<Link to="/agent/leads" className="hover:text-ink">{t('panel.nav.agentLeads')}</Link>} />
      {dup && (
        <Alert tone="warning" className="mb-4" title={t('agent.newLead.dupTitle', { no: dup.leadNo || '' })}
          action={dup.leadId && <Button size="sm" variant="secondary" to={`/agent/leads/${dup.leadId}`}>{t('agent.newLead.openIt')}</Button>}>
          {t('agent.newLead.dupText')}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('agent.leads.source')} required value={v.source} onChange={set('source')} options={SOURCES.map((value) => ({ value, label: t(`agent.newLead.src.${value}`) }))} />
            <Input label={t('agent.newLead.name')} required maxLength={80} value={v.name} onChange={set('name')} error={errors.name} />
            <Input label={t('agent.newLead.phone')} required type="tel" placeholder="98765 43210" value={v.phone} onChange={set('phone')} error={errors.phone} />
            <Input label={t('agent.newLead.email')} type="email" value={v.email} onChange={set('email')} error={errors.email} />
            <Input label={t('agent.newLead.listingId')} placeholder="RE26-000123" value={v.listingNo} onChange={set('listingNo')} error={errors.listingNo}
              hint={property ? `${property.title} · ${property.locality || ''}` : lookup.isFetching ? t('agent.newLead.lookingUp') : t('agent.common.optional')} />
            <Input label={t('agent.newLead.referralCode')} placeholder={t('agent.common.optional')} value={v.referralCode} onChange={set('referralCode')} error={errors.referralCode} />
          </div>
          <h3 className="pt-2 text-sm font-semibold text-ink">{t('agent.req.title')}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label={t('agent.req.purpose')} placeholder={t('agent.common.any')} value={v.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: t('agent.purpose.sale') }, { value: 'rent', label: t('agent.purpose.rent') }]} />
            <Input label={t('agent.req.city')} value={v.city} onChange={set('city')} />
            <Input label="BHK" placeholder="2, 3" value={v.bhk} onChange={set('bhk')} />
            <Input label={t('agent.req.localitiesShort')} placeholder={t('agent.req.commaSeparated')} className="sm:col-span-3" value={v.localities} onChange={set('localities')} />
            <Input label={t('agent.newLead.budgetFrom')} leading="₹" type="number" min={0} value={v.budgetMin} onChange={set('budgetMin')} />
            <Input label={t('agent.newLead.budgetTo')} leading="₹" type="number" min={0} value={v.budgetMax} onChange={set('budgetMax')} />
          </div>
          <Textarea label={t('agent.common.note')} rows={3} maxLength={1000} value={v.notes} onChange={set('notes')} />
          <Checkbox label={t('agent.newLead.consent')} checked={v.consent} onChange={(e) => setV((x) => ({ ...x, consent: e.target.checked }))} error={errors.consent} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" to="/agent/leads">{t('common.cancel')}</Button>
            <Button loading={m.isPending} onClick={save}>{t('agent.newLead.create')}</Button>
          </div>
        </Card>
        <Card className="h-fit text-sm text-ink-muted">
          <h3 className="mb-2 font-semibold text-ink">{t('agent.newLead.goodToKnow')}</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('agent.newLead.tip1')}</li>
            <li>{t('agent.newLead.tip2')}</li>
            <li>{t('agent.newLead.tip3')}</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
