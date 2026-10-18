// Site visit schedule / reschedule with the lister slot picker (RE-S-AGT-08)
// and the visit outcome form (RE-S-AGT-09).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Alert, Button, Checkbox, Input, Modal, Select, Skeleton, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import FileDrop from '@/shared/components/FileDrop';
import { useAuth } from '@/modules/auth';
import { OBJECTIONS, errorText, objectionLabel, useAgentMutation, useVisitSlots, visitApi } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { dayLabel, istMidnight, timeOnly } from './common';

const idOf = (x) => (x && typeof x === 'object' ? x._id : x);

function SlotPicker({ propertyId, value, onChange, allowOverride }) {
  const t = useT();
  const [week, setWeek] = useState(0);
  const from = useMemo(() => new Date(istMidnight().getTime() + week * 7 * 86400000).toISOString(), [week]);
  const { data, isLoading, error, refetch } = useVisitSlots(propertyId, { from, days: 7 });
  const [day, setDay] = useState(0);
  useEffect(() => { setDay(0); }, [week, propertyId]);
  if (!propertyId) return <p className="text-sm text-ink-subtle">{t('agent.slots.chooseProperty')}</p>;
  const days = data || [];
  const current = days[day];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{t('agent.slots.pick')}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={week === 0} onClick={() => setWeek((w) => w - 1)} aria-label={t('agent.slots.prevWeek')} />
          <Button size="sm" variant="ghost" icon={ChevronRight} disabled={week >= 8} onClick={() => setWeek((w) => w + 1)} aria-label={t('agent.slots.nextWeek')} />
        </div>
      </div>
      {isLoading && <Skeleton className="h-28" />}
      {error && <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}>{error.message}</Alert>}
      {!isLoading && !error && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {days.map((d, i) => {
              const free = d.slots.filter((s) => s.free).length;
              return (
                <button key={d.date} type="button" onClick={() => setDay(i)}
                  className={cn('min-w-[4.5rem] rounded-md border px-2 py-1.5 text-center text-xs', i === day ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-ink-muted hover:bg-surface-muted')}>
                  <span className="block font-medium">{dayLabel(`${d.date}T12:00:00+05:30`)}</span>
                  <span className={free ? 'text-success-700' : 'text-ink-subtle'}>{t('agent.slots.free', { n: free })}</span>
                </button>
              );
            })}
          </div>
          {current && (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {current.slots.map((s) => {
                const selected = value && new Date(value).getTime() === new Date(s.at).getTime();
                const usable = s.free || allowOverride;
                return (
                  <button key={s.at} type="button" disabled={!usable} title={s.reason || t('agent.slots.freeOne')} onClick={() => onChange(s.at, !s.free, s.reason)}
                    className={cn('rounded-md border px-1 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed',
                      selected ? 'border-brand-600 bg-brand-600 text-white'
                        : s.free ? 'border-success-100 bg-success-50 text-success-700 hover:border-success-600'
                          : 'border-line bg-surface-sunken text-ink-subtle line-through', !s.free && usable && !selected && 'hover:border-warning-600')}>
                    {timeOnly(s.at)}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-ink-subtle">{t('agent.slots.legend')} {allowOverride ? t('agent.slots.legendManager') : t('agent.slots.legendAgent')}</p>
        </>
      )}
    </div>
  );
}

const MEETING = ['property', 'office', 'pickup'];

/**
 * Schedule a new visit for `lead` (properties to choose from), schedule a
 * requested visit (`requested`), or reschedule an existing `visit`.
 */
const NONE = [];

export function ScheduleVisitModal({ open, onClose, lead, properties = NONE, visit, requested, onDone }) {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const isManager = ['manager', 'admin', 'superadmin'].includes(user.role);
  const resched = Boolean(visit);
  const sched = useAgentMutation(visitApi.schedule);
  const edit = useAgentMutation(visitApi.reschedule);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const init = useRef(null);
  init.current = { visit, requested, properties };
  useEffect(() => {
    if (!open) return;
    setErrors({});
    const { visit: vi, requested: rq, properties: props } = init.current;
    const base = vi || rq;
    const pid = base ? idOf(base.propertyId) : (props.find((p) => p.status === 'live') || props[0] || {})._id;
    const mp = base && base.meetingPoint;
    setV({
      propertyId: pid || '', at: vi ? vi.scheduledAt : (rq && rq.requestedSlot) || null, outside: false, slotReason: '',
      duration: '60', meeting: base && base.pickup && base.pickup.needed ? 'pickup' : mp === 'At our office' ? 'office' : 'property',
      pickupAddress: (base && base.pickup && base.pickup.address) || '', rescheduleReason: '', meetingNote: (base && base.buyerNote) || (mp && !['At the property', 'At our office'].includes(mp) && !mp.startsWith('Pickup') ? mp : ''), overrideReason: '', listerAgreed: false,
    });
  }, [open]);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    const errs = {};
    if (!v.propertyId) errs.propertyId = t('agent.offer.errProperty');
    if (!v.at) errs.scheduledAt = t('agent.slots.pick');
    if (v.outside && v.overrideReason.trim().length < 10) errs.overrideReason = t('agent.schedule.errReason10');
    if (v.outside && !v.listerAgreed) errs.listerAgreed = t('agent.schedule.errAgreed');
    if (v.meeting === 'pickup' && v.pickupAddress.trim().length < 5) errs.pickupAddress = t('agent.schedule.errPickup');
    const timeChanged = resched && v.at && new Date(v.at).getTime() !== new Date(visit.scheduledAt).getTime();
    if (timeChanged && (v.rescheduleReason || '').trim().length < 3) errs.rescheduleReason = t('agent.schedule.errReason3');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // Meeting point and the buyer's note are separate fields (the SMS reads "Meet <agent>: <place>. Note: <note>").
    const meetingPoint = v.meeting === 'office' ? 'At our office' : v.meeting === 'pickup' ? `Pickup from ${v.pickupAddress.trim()}` : 'At the property';
    const common = { meetingPoint: meetingPoint.slice(0, 200), buyerNote: (v.meetingNote || '').trim(), pickup: { needed: v.meeting === 'pickup', ...(v.meeting === 'pickup' ? { address: v.pickupAddress.trim() } : {}) }, ...(v.outside ? { overrideReason: v.overrideReason.trim() } : {}) };
    try {
      if (resched) {
        await edit.mutateAsync({ id: visit._id, body: { ...common, ...(timeChanged ? { scheduledAt: v.at, rescheduleReason: v.rescheduleReason.trim() } : {}) } });
        toast.success(timeChanged ? t('agent.schedule.rescheduled') : t('agent.schedule.updated'));
      } else {
        const leadId = lead ? lead._id : idOf(requested.leadId);
        await sched.mutateAsync({ leadId, propertyId: v.propertyId, scheduledAt: v.at, durationMin: Number(v.duration), ...common, ...(requested ? { visitId: requested._id } : {}) });
        toast.success(t('agent.schedule.scheduled'));
      }
      onDone && onDone();
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };

  const propOptions = properties.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}${p.status && p.status !== 'live' ? ` (${p.status})` : ''}` }));
  const fixedProp = resched || requested;
  return (
    <Modal open={open} onClose={onClose} size="lg" title={resched ? t('agent.schedule.rescheduleTitle', { no: visit.visitNo }) : t('agent.schedule.title')}
      description={resched ? t('agent.schedule.rescheduleDesc', { at: dateTime(visit.scheduledAt) }) : t('agent.schedule.desc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={sched.isPending || edit.isPending} onClick={save}>{resched ? t('common.save') : t('agent.schedule.submit')}</Button></>}>
      <div className="space-y-4">
        {!fixedProp && (
          propOptions.length
            ? <Select label={t('agent.common.property')} required placeholder={t('agent.common.choose')} value={v.propertyId || ''} onChange={(e) => setV((x) => ({ ...x, propertyId: e.target.value, at: null, outside: false }))} options={propOptions} error={errors.propertyId} />
            : <Alert tone="warning">{t('agent.schedule.noProperty')}</Alert>
        )}
        {fixedProp && (resched ? visit : requested).propertyId && typeof (resched ? visit : requested).propertyId === 'object' && (
          <p className="text-sm text-ink-muted">{t('agent.schedule.propertyLabel')} <span className="font-medium text-ink">{(resched ? visit : requested).propertyId.listingNo} · {(resched ? visit : requested).propertyId.title}</span></p>
        )}
        <SlotPicker propertyId={v.propertyId} value={v.at} allowOverride={isManager}
          onChange={(at, outside, reason) => setV((x) => ({ ...x, at, outside, slotReason: reason || '' }))} />
        {v.at && <p className="text-sm text-ink">{t('agent.schedule.selected')} <span className="font-semibold">{dateTime(v.at)}</span></p>}
        {errors.scheduledAt && <p className="text-xs text-danger-600" role="alert">{errors.scheduledAt}</p>}
        {resched && v.at && new Date(v.at).getTime() !== new Date(visit.scheduledAt).getTime() && (
          <Textarea label={t('agent.schedule.moveReason')} required rows={2} minLength={3} maxLength={300} value={v.rescheduleReason || ''} onChange={set('rescheduleReason')} error={errors.rescheduleReason}
            hint={t('agent.schedule.moveReasonHint')} />
        )}
        {v.outside && (
          <div className="space-y-3 rounded-md border border-warning-100 bg-warning-50 p-3">
            <p className="text-sm text-warning-700">{t('agent.schedule.override', { reason: v.slotReason || t('agent.schedule.outsideSlots') })}</p>
            <Textarea label={t('agent.schedule.overrideReason')} required rows={2} maxLength={300} value={v.overrideReason} onChange={set('overrideReason')} error={errors.overrideReason} />
            <Checkbox label={t('agent.schedule.ownerAgreed')} checked={v.listerAgreed} onChange={(e) => setV((x) => ({ ...x, listerAgreed: e.target.checked }))} error={errors.listerAgreed} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {!resched && <Select label={t('agent.schedule.duration')} value={v.duration || '60'} onChange={set('duration')} options={['30', '60', '90'].map((n) => ({ value: n, label: t('agent.schedule.minutes', { n }) }))} />}
          <Select label={t('agent.schedule.meeting')} value={v.meeting || 'property'} onChange={set('meeting')} options={MEETING.map((value) => ({ value, label: t(`agent.schedule.meet.${value}`) }))} />
        </div>
        {v.meeting === 'pickup' && <Input label={t('agent.schedule.pickupAddress')} required value={v.pickupAddress || ''} onChange={set('pickupAddress')} error={errors.pickupAddress} maxLength={300} />}
        <Input label={v.meeting === 'pickup' ? t('agent.schedule.pickupNote') : t('agent.schedule.buyerNote')} maxLength={150} value={v.meetingNote || ''} onChange={set('meetingNote')} hint={t('agent.schedule.buyerNoteHint')} />
      </div>
    </Modal>
  );
}

const INTEREST = ['5', '4', '3', '2', '1'];
// Next step values are saved as text (kept in English); labels are translated.
const NEXT_STEPS = [['Follow-up call', 'followupCall'], ['Second visit', 'secondVisit'], ['Negotiation', 'negotiation'], ['Close as lost', 'closeLost']];

const OUTCOME_DEFAULT = { result: 'completed', interest: '', rating: '', objections: [], feedback: '', offerMade: false, offerAmount: '', nextStep: '', share: false, listerSummary: '', photos: [] };
const MAX_PHOTOS = 10;

export function VisitOutcomeModal({ open, onClose, visit, onDone }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(visitApi.outcome);
  const [v, setV] = useState(OUTCOME_DEFAULT);
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setErrors({}); setV(OUTCOME_DEFAULT); } }, [open]);
  if (!visit) return null;
  const future = new Date(visit.scheduledAt) > new Date();
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const toggle = (o) => setV((x) => ({ ...x, objections: x.objections.includes(o) ? x.objections.filter((y) => y !== o) : [...x.objections, o] }));
  const completed = v.result === 'completed';
  const save = async () => {
    const errs = {};
    if (completed && !v.interest) errs.interest = t('agent.outcome.errInterest');
    if (v.offerMade && !(Number(v.offerAmount) > 0)) errs.offerAmount = t('agent.offer.errAmount');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = {
      result: v.result, objections: v.objections,
      ...(v.interest ? { interest: Number(v.interest) } : {}), ...(v.rating ? { rating: Number(v.rating) } : {}),
      ...(v.feedback.trim() ? { feedback: v.feedback.trim() } : {}), ...(v.offerMade ? { offerAmount: Number(v.offerAmount) } : {}),
      ...(v.nextStep ? { nextStep: v.nextStep } : {}), ...(v.photos.length ? { photoFileIds: v.photos.map((p) => p.id) } : {}), shareWithLister: completed && v.share, ...(completed && v.share && v.listerSummary.trim() ? { listerSummary: v.listerSummary.trim() } : {}),
    };
    try {
      await m.mutateAsync({ id: visit._id, body });
      toast.success(completed ? t('agent.outcome.saved') : t('agent.outcome.noShowSaved'));
      onDone && onDone({ ...body });
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('agent.outcome.title', { no: visit.visitNo })} description={t('agent.outcome.scheduled', { at: dateTime(visit.scheduledAt) })}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} disabled={future} onClick={save}>{t('agent.outcome.save')}</Button></>}>
      <div className="space-y-4">
        {future && <Alert tone="warning">{t('agent.outcome.future')}</Alert>}
        <Select label={t('agent.outcome.result')} required value={v.result || 'completed'} onChange={set('result')} options={[{ value: 'completed', label: t('agent.visitStatus.completed') }, { value: 'no_show', label: t('agent.outcome.noShow') }]} />
        {completed && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label={t('agent.outcome.interest')} required placeholder={t('agent.common.choose')} value={v.interest} onChange={set('interest')} options={INTEREST.map((value) => ({ value, label: t(`agent.outcome.interestLevel.${value}`) }))} error={errors.interest} />
              <Select label={t('agent.outcome.rating')} placeholder={t('agent.outcome.notGiven')} value={v.rating} onChange={set('rating')} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: t('agent.outcome.ofFive', { n }) }))} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">{t('agent.outcome.objections')}</legend>
              <div className="flex flex-wrap gap-2">
                {OBJECTIONS.map((o) => (
                  <button key={o} type="button" onClick={() => toggle(o)} aria-pressed={v.objections.includes(o)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium ', v.objections.includes(o) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-ink-muted')}>{objectionLabel(o)}</button>
                ))}
              </div>
            </fieldset>
            <Checkbox label={t('agent.outcome.offerMade')} checked={v.offerMade} onChange={(e) => setV((x) => ({ ...x, offerMade: e.target.checked }))} />
            {v.offerMade && <Input label={t('agent.offer.amount')} leading="₹" type="number" min={1} value={v.offerAmount} onChange={set('offerAmount')} error={errors.offerAmount} hint={t('agent.outcome.offerHint')} />}
          </>
        )}
        <Textarea label={t('agent.outcome.feedback')} rows={3} maxLength={1000} value={v.feedback || ''} onChange={set('feedback')} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t('agent.outcome.photos', { n: v.photos.length, max: MAX_PHOTOS })}</p>
          {v.photos.length < MAX_PHOTOS && <FileDrop purpose="verification_photo" kind="image" multiple onUploaded={(f, raw) => setV((x) => (x.photos.length >= MAX_PHOTOS ? x : { ...x, photos: [...x.photos, { id: f.id, url: f.thumbUrl || f.url, name: raw.name }] }))} label={t('agent.outcome.uploadPhotos')} />}
          {v.photos.length > 0 && (
            <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {v.photos.map((ph) => (
                <li key={ph.id} className="relative overflow-hidden rounded-md border bg-surface-sunken">
                  {ph.url ? <img src={ph.url} alt={ph.name} className="h-16 w-full object-cover" /> : <span className="block h-16 truncate p-2 text-xs text-ink-subtle">{ph.name}</span>}
                  <button type="button" className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-ink-subtle shadow hover:text-ink" aria-label={t('agent.outcome.removePhoto', { name: ph.name })} onClick={() => setV((x) => ({ ...x, photos: x.photos.filter((y) => y.id !== ph.id) }))}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          {errors.photoFileIds && <p className="mt-1 text-xs text-danger-600" role="alert">{errors.photoFileIds}</p>}
        </div>
        <Select label={t('agent.outcome.nextStep')} placeholder={t('agent.common.choose')} value={v.nextStep || ''} onChange={set('nextStep')}
          options={NEXT_STEPS.map(([value, k]) => ({ value, label: t(`agent.outcome.next.${k}`) }))} />
        {completed && (
          <>
            <Checkbox label={t('agent.outcome.shareSummary')} description={t('agent.outcome.shareHint')} checked={v.share} onChange={(e) => setV((x) => ({ ...x, share: e.target.checked }))} />
            {v.share && <Textarea label={t('agent.outcome.summaryOwner')} rows={2} maxLength={500} value={v.listerSummary} onChange={set('listerSummary')} hint={t('agent.offer.noteHint')} />}
          </>
        )}
      </div>
    </Modal>
  );
}
