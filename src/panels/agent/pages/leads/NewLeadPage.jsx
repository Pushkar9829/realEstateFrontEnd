// RE-S-AGT-05 New lead (hotline / walk-in / referral): assigned to me; a
// duplicate on the same property within the dedupe window opens that lead.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Checkbox, Input, PageHeader, Select, Textarea, useToast } from '@/shared/ui';
import { usePropertySearch, errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';

const SOURCES = [{ value: 'hotline', label: 'Hotline call' }, { value: 'walk_in', label: 'Walk-in' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'referral', label: 'Referral' }];
const csvList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export default function NewLeadPage() {
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
    if (v.name.trim().length < 2) errs.name = 'Enter the buyer name';
    if (v.phone.replace(/[\s()-]/g, '').length < 10) errs.phone = 'Enter a 10-digit mobile or +country code number';
    if (listingQ && !property) errs.listingNo = 'No live listing with this ID';
    if (v.referralCode && !/^[A-Z0-9]{6,12}$/i.test(v.referralCode)) errs.referralCode = '6-12 letters or digits';
    if (!v.consent) errs.consent = 'Confirm the buyer agreed to be contacted';
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
      toast.success(`Lead ${lead.leadNo} created and assigned to you`);
      navigate(`/agent/leads/${lead._id}`);
    } catch (e) {
      if (e.code === 'DUPLICATE_LEAD') { setDup(e.details || {}); return; }
      setErrors(e.fieldErrors || {});
      toast.error(errorText(e));
    }
  };

  return (
    <>
      <PageHeader title="New lead" description="For hotline calls, walk-ins and offline referrals. The lead is assigned to you." breadcrumb={<Link to="/agent/leads" className="hover:text-ink">My leads</Link>} />
      {dup && (
        <Alert tone="warning" className="mb-4" title={`Lead ${dup.leadNo || ''} already exists for this buyer and property`}
          action={dup.leadId && <Button size="sm" variant="secondary" to={`/agent/leads/${dup.leadId}`}>Open it</Button>}>
          Add your note to the existing lead. If it belongs to another agent, ask your manager for access.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Source" required value={v.source} onChange={set('source')} options={SOURCES} />
            <Input label="Buyer name" required maxLength={80} value={v.name} onChange={set('name')} error={errors.name} />
            <Input label="Phone" required type="tel" placeholder="98765 43210" value={v.phone} onChange={set('phone')} error={errors.phone} />
            <Input label="Email" type="email" value={v.email} onChange={set('email')} error={errors.email} />
            <Input label="Listing ID" placeholder="RE26-000123" value={v.listingNo} onChange={set('listingNo')} error={errors.listingNo}
              hint={property ? `${property.title} · ${property.locality || ''}` : lookup.isFetching ? 'Looking up…' : 'Optional'} />
            <Input label="Buyer referral code" placeholder="Optional" value={v.referralCode} onChange={set('referralCode')} error={errors.referralCode} />
          </div>
          <h3 className="pt-2 text-sm font-semibold text-ink">Requirement</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Purpose" placeholder="Any" value={v.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: 'Buy' }, { value: 'rent', label: 'Rent' }]} />
            <Input label="City" value={v.city} onChange={set('city')} />
            <Input label="BHK" placeholder="2, 3" value={v.bhk} onChange={set('bhk')} />
            <Input label="Localities" placeholder="Comma separated" className="sm:col-span-3" value={v.localities} onChange={set('localities')} />
            <Input label="Budget from" leading="₹" type="number" min={0} value={v.budgetMin} onChange={set('budgetMin')} />
            <Input label="Budget up to" leading="₹" type="number" min={0} value={v.budgetMax} onChange={set('budgetMax')} />
          </div>
          <Textarea label="Note" rows={3} maxLength={1000} value={v.notes} onChange={set('notes')} />
          <Checkbox label="The buyer agreed to be contacted about properties" checked={v.consent} onChange={(e) => setV((x) => ({ ...x, consent: e.target.checked }))} error={errors.consent} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" to="/agent/leads">Cancel</Button>
            <Button loading={m.isPending} onClick={save}>Create lead</Button>
          </div>
        </Card>
        <Card className="h-fit text-sm text-ink-muted">
          <h3 className="mb-2 font-semibold text-ink">Good to know</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>The same phone on the same property within the dedupe window opens the existing lead instead.</li>
            <li>Log your first call on the lead page to stop the first-contact SLA.</li>
            <li>Referral codes credit the buyer&apos;s referrer when the deal is verified.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
