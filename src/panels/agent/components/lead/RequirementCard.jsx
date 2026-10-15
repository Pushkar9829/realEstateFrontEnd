// Requirement card (editable): purpose, budget, localities, BHK, timeline, loan, notes.
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, Checkbox, Input, Select, Textarea, useToast } from '@/shared/ui';
import { budgetText, errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';
import { CALLBACK_WINDOWS, TIMELINES } from '@/modules/leads/publicApi';

const timelineLabel = (v) => (TIMELINES.find((t) => t.value === v) || {}).label || v;
const windowLabel = (v) => (CALLBACK_WINDOWS.find((t) => t.value === v) || {}).label || v;
import { Section } from '../common';

const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export default function RequirementCard({ lead }) {
  const toast = useToast();
  const m = useAgentMutation(leadApi.patch);
  const r = lead.requirement || {};
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const start = () => {
    setV({ purpose: r.purpose || '', city: r.city || '', localities: (r.localities || []).join(', '), bhk: (r.bhk || []).join(', '), budgetMin: r.budgetMin || '', budgetMax: r.budgetMax || '', timeline: r.timeline || '', loanNeeded: Boolean(r.loanNeeded), notes: r.notes || '' });
    setErrors({});
    setEdit(true);
  };
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    if (v.budgetMin && v.budgetMax && Number(v.budgetMin) > Number(v.budgetMax)) { setErrors({ budgetMax: 'Must be above the minimum' }); return; }
    const requirement = {
      ...(v.purpose ? { purpose: v.purpose } : {}), city: v.city.trim(), localities: csv(v.localities), bhk: csv(v.bhk).map(Number).filter(Number.isInteger),
      ...(v.budgetMin !== '' ? { budgetMin: Number(v.budgetMin) } : {}), ...(v.budgetMax !== '' ? { budgetMax: Number(v.budgetMax) } : {}),
      timeline: v.timeline.trim(), loanNeeded: v.loanNeeded, notes: v.notes.trim(),
    };
    try { await m.mutateAsync({ id: lead._id, body: { requirement } }); toast.success('Requirement saved'); setEdit(false); } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };

  if (edit) {
    return (
      <Section title="Requirement">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Purpose" placeholder="Any" value={v.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: 'Buy' }, { value: 'rent', label: 'Rent' }]} />
            <Input label="City" value={v.city} onChange={set('city')} />
            <Input label="Budget from (₹)" type="number" min={0} value={v.budgetMin} onChange={set('budgetMin')} />
            <Input label="Budget up to (₹)" type="number" min={0} value={v.budgetMax} onChange={set('budgetMax')} error={errors.budgetMax} />
            <Input label="BHK" placeholder="2, 3" value={v.bhk} onChange={set('bhk')} />
            <Select label="Timeline" placeholder="Not sure yet" value={v.timeline} onChange={set('timeline')}
              options={[...TIMELINES, ...(v.timeline && !TIMELINES.some((t) => t.value === v.timeline) ? [{ value: v.timeline, label: v.timeline }] : [])]} />
          </div>
          <Input label="Preferred localities" placeholder="Comma separated" value={v.localities} onChange={set('localities')} />
          <Checkbox label="Needs a home loan" checked={v.loanNeeded} onChange={(e) => setV((x) => ({ ...x, loanNeeded: e.target.checked }))} />
          <Textarea label="Notes" rows={2} maxLength={1000} value={v.notes} onChange={set('notes')} />
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEdit(false)}>Cancel</Button><Button size="sm" loading={m.isPending} onClick={save}>Save</Button></div>
        </div>
      </Section>
    );
  }
  const rows = [
    ['Purpose', r.purpose === 'rent' ? 'Rent' : r.purpose === 'sale' ? 'Buy' : '-'],
    ['Budget', budgetText(r) || '-'],
    ['City', r.city || '-'],
    ['Localities', (r.localities || []).join(', ') || '-'],
    ['BHK', (r.bhk || []).join(', ') || '-'],
    ['Timeline', r.timeline ? timelineLabel(r.timeline) : '-'],
    ['Home loan', r.loanNeeded ? 'Needed' : r.loanNeeded === false ? 'No' : '-'],
  ];
  // Extras the buyer gave in the enquiry form (RE-S-PUB-06).
  const e = lead.enquiry || {};
  const extras = [
    e.callbackWindow && ['Call time', windowLabel(e.callbackWindow)],
    e.visitors && ['Visitors', String(e.visitors)],
    e.pickupNeeded !== undefined && e.pickupNeeded !== null && ['Pickup', e.pickupNeeded ? 'Needed' : 'No'],
  ].filter(Boolean);
  return (
    <Section title="Requirement" action={<Button size="sm" variant="ghost" icon={Pencil} onClick={start}>Edit</Button>}>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([k, val]) => <div key={k} className="contents"><dt className="text-ink-subtle">{k}</dt><dd className="col-span-2 text-ink">{val}</dd></div>)}
      </dl>
      {extras.length > 0 && (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-subtle">From the enquiry form</p>
          <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
            {extras.map(([k, val]) => <div key={k} className="contents"><dt className="text-ink-subtle">{k}</dt><dd className="col-span-2 text-ink">{val}</dd></div>)}
          </dl>
        </>
      )}
      {r.notes && <p className="mt-3 rounded-md bg-surface-muted p-2 text-sm text-ink-muted">{r.notes}</p>}
    </Section>
  );
}
