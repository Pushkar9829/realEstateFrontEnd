// Requirement card (editable): purpose, budget, localities, BHK, timeline, loan, notes.
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, Checkbox, Input, Select, Textarea, useToast } from '@/shared/ui';
import { budgetText, errorText, leadApi, useAgentMutation } from '@/modules/leads/agentApi';
import { CALLBACK_WINDOWS, TIMELINES } from '@/modules/leads/publicApi';
import { useT } from '@/shared/i18n';

const timelineLabel = (v) => (TIMELINES.find((x) => x.value === v) || {}).label || v;
const windowLabel = (v) => (CALLBACK_WINDOWS.find((x) => x.value === v) || {}).label || v;
import { Section } from '../common';

const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export default function RequirementCard({ lead }) {
  const t = useT();
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
    if (v.budgetMin && v.budgetMax && Number(v.budgetMin) > Number(v.budgetMax)) { setErrors({ budgetMax: t('agent.req.errMax') }); return; }
    const requirement = {
      ...(v.purpose ? { purpose: v.purpose } : {}), city: v.city.trim(), localities: csv(v.localities), bhk: csv(v.bhk).map(Number).filter(Number.isInteger),
      ...(v.budgetMin !== '' ? { budgetMin: Number(v.budgetMin) } : {}), ...(v.budgetMax !== '' ? { budgetMax: Number(v.budgetMax) } : {}),
      timeline: v.timeline.trim(), loanNeeded: v.loanNeeded, notes: v.notes.trim(),
    };
    try { await m.mutateAsync({ id: lead._id, body: { requirement } }); toast.success(t('agent.req.saved')); setEdit(false); } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };

  if (edit) {
    return (
      <Section title={t('agent.req.title')}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label={t('agent.req.purpose')} placeholder={t('agent.common.any')} value={v.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: t('agent.purpose.sale') }, { value: 'rent', label: t('agent.purpose.rent') }]} />
            <Input label={t('agent.req.city')} value={v.city} onChange={set('city')} />
            <Input label={t('agent.req.budgetFrom')} type="number" min={0} value={v.budgetMin} onChange={set('budgetMin')} />
            <Input label={t('agent.req.budgetTo')} type="number" min={0} value={v.budgetMax} onChange={set('budgetMax')} error={errors.budgetMax} />
            <Input label="BHK" placeholder="2, 3" value={v.bhk} onChange={set('bhk')} />
            <Select label={t('agent.req.timeline')} placeholder={t('agent.req.notSure')} value={v.timeline} onChange={set('timeline')}
              options={[...TIMELINES, ...(v.timeline && !TIMELINES.some((x) => x.value === v.timeline) ? [{ value: v.timeline, label: v.timeline }] : [])]} />
          </div>
          <Input label={t('agent.req.localities')} placeholder={t('agent.req.commaSeparated')} value={v.localities} onChange={set('localities')} />
          <Checkbox label={t('agent.req.needsLoan')} checked={v.loanNeeded} onChange={(e) => setV((x) => ({ ...x, loanNeeded: e.target.checked }))} />
          <Textarea label={t('agent.req.notes')} rows={2} maxLength={1000} value={v.notes} onChange={set('notes')} />
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEdit(false)}>{t('common.cancel')}</Button><Button size="sm" loading={m.isPending} onClick={save}>{t('common.save')}</Button></div>
        </div>
      </Section>
    );
  }
  const rows = [
    [t('agent.req.purpose'), r.purpose === 'rent' ? t('agent.purpose.rent') : r.purpose === 'sale' ? t('agent.purpose.sale') : '-'],
    [t('agent.req.budget'), budgetText(r) || '-'],
    [t('agent.req.city'), r.city || '-'],
    [t('agent.req.localitiesShort'), (r.localities || []).join(', ') || '-'],
    ['BHK', (r.bhk || []).join(', ') || '-'],
    [t('agent.req.timeline'), r.timeline ? timelineLabel(r.timeline) : '-'],
    [t('agent.req.homeLoan'), r.loanNeeded ? t('agent.req.needed') : r.loanNeeded === false ? t('common.no') : '-'],
  ];
  // Extras the buyer gave in the enquiry form (RE-S-PUB-06).
  const e = lead.enquiry || {};
  const extras = [
    e.callbackWindow && [t('agent.req.callTime'), windowLabel(e.callbackWindow)],
    e.visitors && [t('agent.req.visitors'), String(e.visitors)],
    e.pickupNeeded !== undefined && e.pickupNeeded !== null && [t('agent.schedule.meet.pickup'), e.pickupNeeded ? t('agent.req.needed') : t('common.no')],
  ].filter(Boolean);
  return (
    <Section title={t('agent.req.title')} action={<Button size="sm" variant="ghost" icon={Pencil} onClick={start}>{t('agent.activity.edit')}</Button>}>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([k, val]) => <div key={k} className="contents"><dt className="text-ink-subtle">{k}</dt><dd className="col-span-2 text-ink">{val}</dd></div>)}
      </dl>
      {extras.length > 0 && (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-subtle">{t('agent.req.fromForm')}</p>
          <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
            {extras.map(([k, val]) => <div key={k} className="contents"><dt className="text-ink-subtle">{k}</dt><dd className="col-span-2 text-ink">{val}</dd></div>)}
          </dl>
        </>
      )}
      {r.notes && <p className="mt-3 rounded-md bg-surface-muted p-2 text-sm text-ink-muted">{r.notes}</p>}
    </Section>
  );
}
