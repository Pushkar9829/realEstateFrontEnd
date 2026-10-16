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
import { useT } from '@/shared/i18n';
import { track } from '@/shared/lib/analytics';

// Option labels by value, falling back to the module's English label for unknown values.
const optLabels = (t, ns, list) => list.map((o) => { const k = `property.${ns}.${o.value}`; const v = t(k); return { ...o, label: v === k ? o.label : v }; });

const dayLabel = (iso) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const timeLabel = (at) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(at));

function SlotPicker({ propertyId, value, onChange, error }) {
  const t = useT();
  const q = useVisitSlots(propertyId);
  const days = useMemo(() => (q.data || []).filter((d) => d.slots.some((s) => s.free)), [q.data]);
  const [day, setDay] = useState('');
  useEffect(() => { if (!day && days[0]) setDay(days[0].date); }, [days, day]);
  if (q.isLoading) return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>;
  if (q.isError) return <Alert tone="warning">{t('property.enquiry.slotsFail')}</Alert>;
  if (!days.length) return <Alert tone="info">{t('property.enquiry.noSlots')}</Alert>;
  const cur = days.find((d) => d.date === day) || days[0];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{t('property.enquiry.preferred')}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="listbox" aria-label={t('property.enquiry.date')}>
        {days.map((d) => (
          <button key={d.date} type="button" role="option" aria-selected={d.date === cur.date} onClick={() => { setDay(d.date); onChange(''); }}
            className={cn('shrink-0 rounded-md border px-3 py-1.5 text-sm', d.date === cur.date ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-line-strong bg-white text-ink-muted hover:bg-surface-muted')}>
            {dayLabel(d.date)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="listbox" aria-label={t('property.enquiry.timeSlot')}>
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
  const t = useT();
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

  // Funnel analytics: ids, purpose and city only (never name, phone, email, message or lead numbers).
  const ids = target ? (target.kind === 'property' ? { listingNo: target.listingNo } : { projectSlug: target.slug }) : {};
  const where = target ? { purpose: target.purpose, city: target.city } : {};
  useEffect(() => {
    if (open && target) track('enquiry_open', { type: initialType, ...ids, ...where });
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
      track('enquiry_submit', { type, ...ids, ...where });
      if (type === 'site_visit') track('visit_booked', { ...ids, ...where });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setStage('form');
      if (err.code === 'OTP_TOKEN_INVALID') setStage('otp');
    }
  };

  const onContinue = (e) => {
    e.preventDefault();
    const er = validateContact(v, { isGuest });
    if (!consent) er.consent = t('property.enquiry.errConsent');
    if (type === 'best_price' && v.budget && !(Number(v.budget) >= 0)) er.budget = t('property.enquiry.errNumber');
    if (v.message.length > 500) er.message = t('property.enquiry.errMessage');
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
    <Modal open={open} onClose={onClose} size="md" title={stage === 'done' ? t('property.enquiry.doneTitle') : t('property.enquiry.title')} description={stage === 'done' ? undefined : t('property.enquiry.description')}>
      {stage === 'done' && result ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" aria-hidden />
          <p className="mt-3 text-lg font-semibold text-ink">{t('property.enquiry.reference', { no: result.leadNo })}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {result.merged ? t('property.enquiry.merged') : t('property.enquiry.callSoon')}
            {result.visitNo && t('property.enquiry.visitReq', { no: result.visitNo })}
          </p>
          <p className="mt-4 text-sm text-ink-muted">{t('property.enquiry.soonerBefore')}<a href={hotlineHref()} className="font-semibold text-brand-700">{env.hotline}</a>{t('property.enquiry.soonerAfterHotline')}{target.listingNo && <>{t('property.enquiry.soonerQuoteBefore')}<span className="font-semibold">{target.listingNo}</span>{t('property.enquiry.soonerQuoteAfter')}</>}{t('property.enquiry.soonerEnd')}</p>
          <div className="mt-5 flex justify-center gap-2">
            {!isGuest && <Button variant="secondary" to="/my-enquiries" onClick={onClose}>{t('property.enquiry.myEnquiries')}</Button>}
            <Button onClick={onClose}>{t('property.enquiry.done')}</Button>
          </div>
        </div>
      ) : !canEnquire ? (
        <Alert tone="info">{t('property.enquiry.staff', { hotline: env.hotline })}</Alert>
      ) : stage === 'otp' ? (
        <>
          {summary}
          <OtpStep phone={v.phone} email={v.email} busy={create.isPending} onVerified={submit} onBack={() => setStage('form')} />
          {create.error && <Alert tone="danger" className="mt-3">{leadErrorText(create.error)}</Alert>}
        </>
      ) : (
        <form onSubmit={onContinue} className="space-y-4" noValidate>
          {summary}
          <Tabs tabs={optLabels(t, 'enquiryType', ENQUIRY_TYPES).map((x) => ({ value: x.value, label: x.label }))} value={type} onChange={(x) => { setType(x); setErrors({}); }} />
          {!isProperty && (target.configurations || []).length > 0 && (
            <Select label={t('property.enquiry.configuration')} placeholder={t('property.enquiry.anyConfig')} value={v.unitConfigId} onChange={set('unitConfigId')}
              options={target.configurations.filter((c) => c.availability !== 'sold_out').map((c) => ({ value: c._id, label: c.name }))} />
          )}
          {type === 'callback' && <Select label={t('property.enquiry.whenCall')} value={v.window} onChange={set('window')} options={optLabels(t, 'window', CALLBACK_WINDOWS)} />}
          {type === 'site_visit' && (
            <>
              {isProperty
                ? <SlotPicker propertyId={target.id} value={v.slot} onChange={(at) => setV((s) => ({ ...s, slot: at }))} error={errors.preferredSlot} />
                : <Alert tone="info">{t('property.enquiry.projectVisit')}</Alert>}
              <div className="grid grid-cols-2 gap-3">
                <Select label={t('property.enquiry.visitors')} value={v.visitors} onChange={set('visitors')} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                <div className="flex items-end pb-2"><Checkbox label={t('property.enquiry.pickup')} checked={v.pickup} onChange={set('pickup')} /></div>
              </div>
              {v.slot && <p className="text-xs text-ink-subtle">{t('property.enquiry.requested', { when: dateTime(v.slot) })}</p>}
            </>
          )}
          {type === 'best_price' && <Input label={t('property.enquiry.budget')} type="number" min="0" inputMode="numeric" value={v.budget} onChange={set('budget')} error={errors.budget} />}
          <ContactFields value={v} onChange={setV} errors={errors} isGuest={isGuest} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label={t('property.enquiry.timeline')} placeholder={t('property.enquiry.notSure')} value={v.timeline} onChange={set('timeline')} options={optLabels(t, 'timelines', TIMELINES)} />
            <div className="flex items-end pb-2"><Checkbox label={t('property.enquiry.loan')} checked={v.loan} onChange={set('loan')} /></div>
          </div>
          <Textarea label={t('property.enquiry.message')} rows={3} maxLength={500} value={v.message} onChange={set('message')} error={errors.message} hint={`${v.message.length}/500`} />
          <ConsentFields consent={consent} onConsent={setConsent} error={errors.consent} />
          {create.error && <Alert tone="danger">{leadErrorText(create.error)}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a href={hotlineHref()} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-700"><Phone className="h-4 w-4" aria-hidden />{env.hotline}{target.listingNo && t('property.enquiry.quoteNo', { no: target.listingNo })}</a>
            <Button type="submit" loading={create.isPending}>{isGuest ? t('property.enquiry.continue') : t('property.enquiry.submit')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
