// Site visit schedule / reschedule with the lister slot picker (RE-S-AGT-08)
// and the visit outcome form (RE-S-AGT-09).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Alert, Button, Checkbox, Input, Modal, Select, Skeleton, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import FileDrop from '@/shared/components/FileDrop';
import { useAuth } from '@/modules/auth';
import { OBJECTIONS, errorText, useAgentMutation, useVisitSlots, visitApi } from '@/modules/leads/agentApi';
import { dayLabel, istMidnight, timeOnly } from './common';

const idOf = (x) => (x && typeof x === 'object' ? x._id : x);

function SlotPicker({ propertyId, value, onChange, allowOverride }) {
  const [week, setWeek] = useState(0);
  const from = useMemo(() => new Date(istMidnight().getTime() + week * 7 * 86400000).toISOString(), [week]);
  const { data, isLoading, error, refetch } = useVisitSlots(propertyId, { from, days: 7 });
  const [day, setDay] = useState(0);
  useEffect(() => { setDay(0); }, [week, propertyId]);
  if (!propertyId) return <p className="text-sm text-ink-subtle">Choose the property to see the owner&apos;s visit slots.</p>;
  const days = data || [];
  const current = days[day];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Pick a slot</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={week === 0} onClick={() => setWeek((w) => w - 1)} aria-label="Previous week" />
          <Button size="sm" variant="ghost" icon={ChevronRight} disabled={week >= 8} onClick={() => setWeek((w) => w + 1)} aria-label="Next week" />
        </div>
      </div>
      {isLoading && <Skeleton className="h-28" />}
      {error && <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>}>{error.message}</Alert>}
      {!isLoading && !error && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {days.map((d, i) => {
              const free = d.slots.filter((s) => s.free).length;
              return (
                <button key={d.date} type="button" onClick={() => setDay(i)}
                  className={cn('min-w-[4.5rem] rounded-md border px-2 py-1.5 text-center text-xs', i === day ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-ink-muted hover:bg-surface-muted')}>
                  <span className="block font-medium">{dayLabel(`${d.date}T12:00:00+05:30`)}</span>
                  <span className={free ? 'text-success-700' : 'text-ink-subtle'}>{free} free</span>
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
                  <button key={s.at} type="button" disabled={!usable} title={s.reason || 'Free'} onClick={() => onChange(s.at, !s.free, s.reason)}
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
          <p className="text-xs text-ink-subtle">Green slots are inside the owner&apos;s availability. {allowOverride ? 'As a manager you may pick a greyed slot with an override reason.' : 'Greyed slots are booked or outside the owner\'s slots.'}</p>
        </>
      )}
    </div>
  );
}

const MEETING = [{ value: 'property', label: 'At the property' }, { value: 'office', label: 'At our office' }, { value: 'pickup', label: 'Pickup' }];

/**
 * Schedule a new visit for `lead` (properties to choose from), schedule a
 * requested visit (`requested`), or reschedule an existing `visit`.
 */
const NONE = [];

export function ScheduleVisitModal({ open, onClose, lead, properties = NONE, visit, requested, onDone }) {
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
    if (!v.propertyId) errs.propertyId = 'Choose the property';
    if (!v.at) errs.scheduledAt = 'Pick a slot';
    if (v.outside && v.overrideReason.trim().length < 10) errs.overrideReason = 'Give the reason (at least 10 characters)';
    if (v.outside && !v.listerAgreed) errs.listerAgreed = 'Confirm the owner agreed by phone';
    if (v.meeting === 'pickup' && v.pickupAddress.trim().length < 5) errs.pickupAddress = 'Enter the pickup address';
    const timeChanged = resched && v.at && new Date(v.at).getTime() !== new Date(visit.scheduledAt).getTime();
    if (timeChanged && (v.rescheduleReason || '').trim().length < 3) errs.rescheduleReason = 'Give the reason (at least 3 characters)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // Meeting point and the buyer's note are separate fields (the SMS reads "Meet <agent>: <place>. Note: <note>").
    const meetingPoint = v.meeting === 'office' ? 'At our office' : v.meeting === 'pickup' ? `Pickup from ${v.pickupAddress.trim()}` : 'At the property';
    const common = { meetingPoint: meetingPoint.slice(0, 200), buyerNote: (v.meetingNote || '').trim(), pickup: { needed: v.meeting === 'pickup', ...(v.meeting === 'pickup' ? { address: v.pickupAddress.trim() } : {}) }, ...(v.outside ? { overrideReason: v.overrideReason.trim() } : {}) };
    try {
      if (resched) {
        await edit.mutateAsync({ id: visit._id, body: { ...common, ...(timeChanged ? { scheduledAt: v.at, rescheduleReason: v.rescheduleReason.trim() } : {}) } });
        toast.success(timeChanged ? 'Visit rescheduled; the buyer gets a new confirmation link' : 'Visit updated');
      } else {
        const leadId = lead ? lead._id : idOf(requested.leadId);
        await sched.mutateAsync({ leadId, propertyId: v.propertyId, scheduledAt: v.at, durationMin: Number(v.duration), ...common, ...(requested ? { visitId: requested._id } : {}) });
        toast.success('Visit scheduled; the buyer gets SMS / email with a confirm link');
      }
      onDone && onDone();
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };

  const propOptions = properties.map((p) => ({ value: p._id, label: `${p.listingNo} · ${p.title}${p.status && p.status !== 'live' ? ` (${p.status})` : ''}` }));
  const fixedProp = resched || requested;
  return (
    <Modal open={open} onClose={onClose} size="lg" title={resched ? `Reschedule ${visit.visitNo}` : 'Schedule a site visit'}
      description={resched ? `Now ${dateTime(visit.scheduledAt)}. Reschedules are limited; past the limit cancel and book again.` : 'The buyer is sent a confirm / request-change link; the owner is told a visit is planned (no buyer details).'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={sched.isPending || edit.isPending} onClick={save}>{resched ? 'Save' : 'Schedule visit'}</Button></>}>
      <div className="space-y-4">
        {!fixedProp && (
          propOptions.length
            ? <Select label="Property" required placeholder="Choose" value={v.propertyId || ''} onChange={(e) => setV((x) => ({ ...x, propertyId: e.target.value, at: null, outside: false }))} options={propOptions} error={errors.propertyId} />
            : <Alert tone="warning">Link a live property to this lead first.</Alert>
        )}
        {fixedProp && (resched ? visit : requested).propertyId && typeof (resched ? visit : requested).propertyId === 'object' && (
          <p className="text-sm text-ink-muted">Property: <span className="font-medium text-ink">{(resched ? visit : requested).propertyId.listingNo} · {(resched ? visit : requested).propertyId.title}</span></p>
        )}
        <SlotPicker propertyId={v.propertyId} value={v.at} allowOverride={isManager}
          onChange={(at, outside, reason) => setV((x) => ({ ...x, at, outside, slotReason: reason || '' }))} />
        {v.at && <p className="text-sm text-ink">Selected: <span className="font-semibold">{dateTime(v.at)}</span></p>}
        {errors.scheduledAt && <p className="text-xs text-danger-600" role="alert">{errors.scheduledAt}</p>}
        {resched && v.at && new Date(v.at).getTime() !== new Date(visit.scheduledAt).getTime() && (
          <Textarea label="Reason for moving the visit" required rows={2} minLength={3} maxLength={300} value={v.rescheduleReason || ''} onChange={set('rescheduleReason')} error={errors.rescheduleReason}
            hint="The owner sees this reason. No phone numbers, emails or names." />
        )}
        {v.outside && (
          <div className="space-y-3 rounded-md border border-warning-100 bg-warning-50 p-3">
            <p className="text-sm text-warning-700">Manager override: {v.slotReason || 'outside the owner\'s visit slots'}.</p>
            <Textarea label="Override reason" required rows={2} maxLength={300} value={v.overrideReason} onChange={set('overrideReason')} error={errors.overrideReason} />
            <Checkbox label="The owner agreed to this time by phone" checked={v.listerAgreed} onChange={(e) => setV((x) => ({ ...x, listerAgreed: e.target.checked }))} error={errors.listerAgreed} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {!resched && <Select label="Duration" value={v.duration || '60'} onChange={set('duration')} options={[{ value: '30', label: '30 minutes' }, { value: '60', label: '60 minutes' }, { value: '90', label: '90 minutes' }]} />}
          <Select label="Meeting point" value={v.meeting || 'property'} onChange={set('meeting')} options={MEETING} />
        </div>
        {v.meeting === 'pickup' && <Input label="Pickup address" required value={v.pickupAddress || ''} onChange={set('pickupAddress')} error={errors.pickupAddress} maxLength={300} />}
        <Input label={v.meeting === 'pickup' ? 'Pickup time / note for the buyer' : 'Note for the buyer (optional)'} maxLength={150} value={v.meetingNote || ''} onChange={set('meetingNote')} hint="Shown in the buyer's confirmation" />
      </div>
    </Modal>
  );
}

const INTEREST = [{ value: '5', label: 'Very interested' }, { value: '4', label: 'Interested' }, { value: '3', label: 'Neutral' }, { value: '2', label: 'Lukewarm' }, { value: '1', label: 'Not interested' }];

const OUTCOME_DEFAULT = { result: 'completed', interest: '', rating: '', objections: [], feedback: '', offerMade: false, offerAmount: '', nextStep: '', share: false, listerSummary: '', photos: [] };
const MAX_PHOTOS = 10;

export function VisitOutcomeModal({ open, onClose, visit, onDone }) {
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
    if (completed && !v.interest) errs.interest = 'Choose the interest level';
    if (v.offerMade && !(Number(v.offerAmount) > 0)) errs.offerAmount = 'Enter the offer amount';
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
      toast.success(completed ? 'Outcome saved; the buyer gets a feedback request' : 'No-show recorded; a call-back follow-up was added');
      onDone && onDone({ ...body });
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); toast.error(errorText(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Outcome of ${visit.visitNo}`} description={`Scheduled ${dateTime(visit.scheduledAt)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={future} onClick={save}>Save outcome</Button></>}>
      <div className="space-y-4">
        {future && <Alert tone="warning">The outcome can be recorded once the visit time has passed. To call it off, cancel the visit instead.</Alert>}
        <Select label="Result" required value={v.result || 'completed'} onChange={set('result')} options={[{ value: 'completed', label: 'Completed' }, { value: 'no_show', label: 'Buyer did not show up' }]} />
        {completed && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Interest level" required placeholder="Choose" value={v.interest} onChange={set('interest')} options={INTEREST} error={errors.interest} />
              <Select label="Buyer rating of the property" placeholder="Not given" value={v.rating} onChange={set('rating')} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} of 5` }))} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Objections</legend>
              <div className="flex flex-wrap gap-2">
                {OBJECTIONS.map((o) => (
                  <button key={o} type="button" onClick={() => toggle(o)} aria-pressed={v.objections.includes(o)}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize', v.objections.includes(o) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-ink-muted')}>{o}</button>
                ))}
              </div>
            </fieldset>
            <Checkbox label="The buyer made an offer" checked={v.offerMade} onChange={(e) => setV((x) => ({ ...x, offerMade: e.target.checked }))} />
            {v.offerMade && <Input label="Offer amount" leading="₹" type="number" min={1} value={v.offerAmount} onChange={set('offerAmount')} error={errors.offerAmount} hint="After saving, you confirm it as a formal offer to the owner." />}
          </>
        )}
        <Textarea label="Internal feedback" rows={3} maxLength={1000} value={v.feedback || ''} onChange={set('feedback')} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Photos ({v.photos.length}/{MAX_PHOTOS}, optional)</p>
          {v.photos.length < MAX_PHOTOS && <FileDrop purpose="verification_photo" kind="image" multiple onUploaded={(f, raw) => setV((x) => (x.photos.length >= MAX_PHOTOS ? x : { ...x, photos: [...x.photos, { id: f.id, url: f.thumbUrl || f.url, name: raw.name }] }))} label="Upload photos" />}
          {v.photos.length > 0 && (
            <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {v.photos.map((ph) => (
                <li key={ph.id} className="relative overflow-hidden rounded-md border bg-surface-sunken">
                  {ph.url ? <img src={ph.url} alt={ph.name} className="h-16 w-full object-cover" /> : <span className="block h-16 truncate p-2 text-xs text-ink-subtle">{ph.name}</span>}
                  <button type="button" className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-ink-subtle shadow hover:text-ink" aria-label={`Remove ${ph.name}`} onClick={() => setV((x) => ({ ...x, photos: x.photos.filter((y) => y.id !== ph.id) }))}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          {errors.photoFileIds && <p className="mt-1 text-xs text-danger-600" role="alert">{errors.photoFileIds}</p>}
        </div>
        <Select label="Next step" placeholder="Choose" value={v.nextStep || ''} onChange={set('nextStep')}
          options={['Follow-up call', 'Second visit', 'Negotiation', 'Close as lost'].map((x) => ({ value: x, label: x }))} />
        {completed && (
          <>
            <Checkbox label="Share a summary with the owner" description="Masked: the owner sees only the buyer label." checked={v.share} onChange={(e) => setV((x) => ({ ...x, share: e.target.checked }))} />
            {v.share && <Textarea label="Summary for the owner" rows={2} maxLength={500} value={v.listerSummary} onChange={set('listerSummary')} hint="No phone numbers, emails or names" />}
          </>
        )}
      </div>
    </Modal>
  );
}
