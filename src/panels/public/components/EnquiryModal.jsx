// RE-S-PUB-06 enquiry / contact modal: type tabs (Contact, Call-back, Site
// visit, Best price), property mini summary, form, consent, guest OTP step and
// a success panel with the lead reference. The lister is never revealed.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import { Alert, Button, Checkbox, Input, Modal, Select, Skeleton, Tabs, Textarea } from '@/shared/ui';
import env from '@/config/env';
import { CALLBACK_WINDOWS, ENQUIRY_TYPES, TIMELINES, useCreateEnquiry, useVisitSlots } from '@/modules/leads/publicApi';
import { ConsentFields, ContactFields, OtpStep, contactBody, emptyContact, leadErrorText, useBuyerIdentity, validateContact } from './GuestVerify';
import { hotlineHref } from './States';
import { referralField } from '@/modules/search/prefs';

const dayLabel = (iso) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const timeLabel = (at) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(at));

function SlotPicker({ propertyId, value, onChange, error }) {
  const q = useVisitSlots(propertyId);
  const days = useMemo(() => (q.data || []).filter((d) => d.slots.some((s) => s.free)), [q.data]);
  const [day, setDay] = useState('');
  useEffect(() => { if (!day && days[0]) setDay(days[0].date); }, [days, day]);
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>;
  if (q.isError) return <Alert tone="warning">Could not load visit slots. Leave a note with your preferred time and our team will arrange it.</Alert>;
  if (!days.length) return <Alert tone="info">No open slots in the next two weeks. Send the request and our team will call you to fix a time.</Alert>;
  const cur = days.find((d) => d.date === day) || days[0];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">Preferred date and time</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="listbox" aria-label="Date">
        {days.map((d) => (
          <button key={d.date} type="button" role="option" aria-selected={d.date === cur.date} onClick={() => { setDay(d.date); onChange(''); }}
            className={cn('shrink-0 rounded-md border px-3 py-1.5 text-sm', d.date === cur.date ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-line-strong bg-white text-ink-muted hover:bg-surface-muted')}>
            {dayLabel(d.date)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="listbox" aria-label="Time slot">
        {cur.slots.map((s) => {
          const at = new Date(s.at).toISOString();
          return (
            <button key={at} type="button" role="option" aria-selected={value === at} disabled={!s.free} onClick={() => onChange(at)}
              className={cn('rounded-md border px-2 py-1.5 text-xs', !s.free ? 'cursor-not-allowed border-line bg-surface-sunken text-ink-subtle line-through opacity-60' : value === at ? 'border-brand-600 bg-brand-600 font-medium text-white' : 'border-line-strong bg-white text-ink hover:border-brand-300')}>
              {timeLabel(s.at)}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}

const initial = (user, loan) => ({ ...emptyContact(user), message: '', window: 'anytime', slot: '', visitors: '1', pickup: false, budget: '', timeline: '', loan: Boolean(loan), unitConfigId: '' });

/**
 * target: { kind: 'property' | 'project', id, title, listingNo?, subtitle?, cover?, priceText?, configurations? }
 */
export default function EnquiryModal({ open, onClose, target, initialType = 'enquiry', initialConfigId, presetLoan }) {
  const { isGuest, user, canEnquire } = useBuyerIdentity();
  const [type, setType] = useState(initialType);
  const [v, setV] = useState(() => initial(user, presetLoan));
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState('form');
  const [result, setResult] = useState(null);
  const create = useCreateEnquiry();

  useEffect(() => {
    if (open) {
      setType(initialType); setV({ ...initial(user, presetLoan), unitConfigId: initialConfigId || '' }); setConsent(false); setErrors({}); setStage('form'); setResult(null); create.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;
  const isProperty = target.kind === 'property';
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  // Form extras go as their own fields (stored on the lead for the agent), not folded into the message.
  const extras = () => ({
    ...(type === 'callback' && v.window ? { callbackWindow: v.window } : {}),
    ...(type === 'site_visit' ? { visitors: Number(v.visitors) || 1, pickupNeeded: Boolean(v.pickup) } : {}),
    ...(type === 'best_price' && v.budget !== '' && Number(v.budget) >= 0 ? { budgetMax: Number(v.budget) } : {}),
    ...(v.timeline ? { timeline: v.timeline } : {}),
    ...(v.loan ? { loanNeeded: true } : {}),
  });

  const submit = async (otpToken) => {
    const body = {
      type,
      ...(isProperty ? { propertyId: target.id } : { projectId: target.id, ...(v.unitConfigId ? { unitConfigId: v.unitConfigId } : {}) }),
      ...contactBody(v, isGuest),
      ...(otpToken ? { otpToken } : {}),
      ...(v.message.trim() ? { message: v.message.trim() } : {}),
      ...extras(),
      ...(type === 'site_visit' && v.slot ? { preferredSlot: v.slot } : {}),
      consent: true,
      ...(isGuest ? referralField() : {}), // RE-N-01: signed-in buyers carry their own referredBy
    };
    try {
      const r = await create.mutateAsync(body);
      setResult(r); setStage('done');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setStage('form');
      if (err.code === 'OTP_TOKEN_INVALID') setStage('otp');
    }
  };

  const onContinue = (e) => {
    e.preventDefault();
    const er = validateContact(v, { isGuest });
    if (!consent) er.consent = 'Please agree to be contacted';
    if (type === 'best_price' && v.budget && !(Number(v.budget) >= 0)) er.budget = 'Enter a number';
    if (v.message.length > 500) er.message = 'Up to 500 characters';
    setErrors(er);
    if (Object.keys(er).length) return;
    if (isGuest) setStage('otp'); else submit();
  };

  const summary = (
    <div className="mb-4 flex items-center gap-3 rounded-md border bg-surface-muted p-2.5">
      {target.cover ? <img src={target.cover} alt="" className="h-14 w-16 shrink-0 rounded object-cover" /> : <span className="h-14 w-16 shrink-0 rounded bg-surface-sunken" />}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-ink">{target.title}</p>
        <p className="truncate text-xs text-ink-subtle">{[target.listingNo, target.subtitle].filter(Boolean).join(' · ')}</p>
        {target.priceText && <p className="text-xs font-semibold text-ink">{target.priceText}</p>}
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} size="md" title={stage === 'done' ? 'Request received' : 'Talk to our sales team'} description={stage === 'done' ? undefined : 'Free, broker-free and your number stays private.'}>
      {stage === 'done' && result ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" aria-hidden />
          <p className="mt-3 text-lg font-semibold text-ink">Reference {result.leadNo}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {result.merged ? 'We added this to your open enquiry.' : 'Our sales team will call you within 2 working hours.'}
            {result.visitNo && ` Your visit request ${result.visitNo} is with our team; we will confirm the time with you.`}
          </p>
          <p className="mt-4 text-sm text-ink-muted">Need us sooner? Call <a href={hotlineHref()} className="font-semibold text-brand-700">{env.hotline}</a>{target.listingNo && <> and quote <span className="font-semibold">{target.listingNo}</span></>}.</p>
          <div className="mt-5 flex justify-center gap-2">
            {!isGuest && <Button variant="secondary" to="/my-enquiries" onClick={onClose}>My enquiries</Button>}
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : !canEnquire ? (
        <Alert tone="info">Staff accounts cannot enquire. Log out and use a buyer account, or call {env.hotline}.</Alert>
      ) : stage === 'otp' ? (
        <>
          {summary}
          <OtpStep phone={v.phone} email={v.email} busy={create.isPending} onVerified={submit} onBack={() => setStage('form')} />
          {create.error && <Alert tone="danger" className="mt-3">{leadErrorText(create.error)}</Alert>}
        </>
      ) : (
        <form onSubmit={onContinue} className="space-y-4" noValidate>
          {summary}
          <Tabs tabs={ENQUIRY_TYPES.map((t) => ({ value: t.value, label: t.label }))} value={type} onChange={(t) => { setType(t); setErrors({}); }} />
          {!isProperty && (target.configurations || []).length > 0 && (
            <Select label="Configuration" placeholder="Any configuration" value={v.unitConfigId} onChange={set('unitConfigId')}
              options={target.configurations.filter((c) => c.availability !== 'sold_out').map((c) => ({ value: c._id, label: c.name }))} />
          )}
          {type === 'callback' && <Select label="When should we call?" value={v.window} onChange={set('window')} options={CALLBACK_WINDOWS} />}
          {type === 'site_visit' && (
            <>
              {isProperty
                ? <SlotPicker propertyId={target.id} value={v.slot} onChange={(at) => setV((s) => ({ ...s, slot: at }))} error={errors.preferredSlot} />
                : <Alert tone="info">Our agent will call you to fix the visit date and meet you at the site office.</Alert>}
              <div className="grid grid-cols-2 gap-3">
                <Select label="Visitors" value={v.visitors} onChange={set('visitors')} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                <div className="flex items-end pb-2"><Checkbox label="Pickup needed" checked={v.pickup} onChange={set('pickup')} /></div>
              </div>
              {v.slot && <p className="text-xs text-ink-subtle">Requested for {dateTime(v.slot)}. The visit is confirmed once our agent schedules it.</p>}
            </>
          )}
          {type === 'best_price' && <Input label="Your budget (₹, optional)" type="number" min="0" inputMode="numeric" value={v.budget} onChange={set('budget')} error={errors.budget} />}
          <ContactFields value={v} onChange={setV} errors={errors} isGuest={isGuest} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Buying timeline" placeholder="Not sure yet" value={v.timeline} onChange={set('timeline')} options={TIMELINES} />
            <div className="flex items-end pb-2"><Checkbox label="Home loan needed" checked={v.loan} onChange={set('loan')} /></div>
          </div>
          <Textarea label="Message (optional)" rows={3} maxLength={500} value={v.message} onChange={set('message')} error={errors.message} hint={`${v.message.length}/500`} />
          <ConsentFields consent={consent} onConsent={setConsent} error={errors.consent} />
          {create.error && <Alert tone="danger">{leadErrorText(create.error)}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a href={hotlineHref()} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-700"><Phone className="h-4 w-4" aria-hidden />{env.hotline}{target.listingNo && ` · quote ${target.listingNo}`}</a>
            <Button type="submit" loading={create.isPending}>{isGuest ? 'Continue' : 'Submit'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
