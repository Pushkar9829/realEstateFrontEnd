// RE-S-PUB-06 enquiry / contact modal: type tabs (Contact, Call-back, Site
// visit, Best price), property mini summary, form, consent, guest OTP step and
// a success panel with the lead reference. The lister is never revealed.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import { Alert, Button, Checkbox, Input, Select, Skeleton, Textarea } from '@/shared/ui';
import { CALLBACK_WINDOWS, ENQUIRY_TYPES, TIMELINES, useCreateEnquiry, useVisitSlots } from '@/modules/leads/publicApi';
import { ConsentFields, ContactFields, OtpStep, contactBody, emptyContact, leadErrorText, useBuyerIdentity, validateContact } from './GuestVerify';
import { currentHotline, hotlineHref } from './States';
import { PublicModal } from './SmallModals';
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
      <p className="text-sm font-medium text-navy-800">{t('property.enquiry.preferred')}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="listbox" aria-label={t('property.enquiry.date')}>
        {days.map((d) => (
          <button key={d.date} type="button" role="option" aria-selected={d.date === cur.date} onClick={() => { setDay(d.date); onChange(''); }}
            className={cn('h-10 shrink-0 rounded-full px-4 text-sm transition-colors', d.date === cur.date ? 'bg-navy-900 font-medium text-white' : 'bg-sand-100 text-navy-600 ring-1 ring-inset ring-navy-900/10 hover:text-navy-900')}>
            {dayLabel(d.date)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="listbox" aria-label={t('property.enquiry.timeSlot')}>
        {cur.slots.map((s) => {
          const at = new Date(s.at).toISOString();
          return (
            <button key={at} type="button" role="option" aria-selected={value === at} disabled={!s.free} onClick={() => onChange(at)}
              className={cn('h-10 rounded-xl px-2 text-xs transition-colors', !s.free ? 'cursor-not-allowed bg-sand-100 text-navy-300 line-through' : value === at ? 'bg-gold-500 font-semibold text-navy-950 shadow-sm' : 'bg-white text-navy-800 ring-1 ring-inset ring-navy-900/15 hover:ring-gold-500')}>
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
    <div className="mb-5 flex items-center gap-4 rounded-2xl bg-sand-50 p-3 ring-1 ring-inset ring-navy-900/5">
      {target.cover ? <img src={target.cover} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" /> : <span className="h-16 w-20 shrink-0 rounded-xl bg-gradient-to-br from-sand-200 to-sand-300" />}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-navy-900">{target.title}</p>
        <p className="truncate text-xs text-navy-400">{[target.listingNo, target.subtitle].filter(Boolean).join(' · ')}</p>
        {target.priceText && <p className="mt-0.5 font-display text-base font-semibold text-navy-900">{target.priceText}</p>}
      </div>
    </div>
  );

  return (
    <PublicModal open={open} onClose={onClose} size="md" title={stage === 'done' ? t('property.enquiry.doneTitle') : t('property.enquiry.title')} description={stage === 'done' ? undefined : t('property.enquiry.description')}>
      {stage === 'done' && result ? (
        <div className="text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold-50 ring-1 ring-gold-200"><CheckCircle2 className="h-10 w-10 text-gold-700" aria-hidden /></span>
          <p className="mt-5 font-display text-2xl font-medium text-navy-900">{t('property.enquiry.reference', { no: result.leadNo })}</p>
          <p className="mt-2 text-sm leading-relaxed text-navy-500">
            {result.merged ? t('property.enquiry.merged') : t('property.enquiry.callSoon')}
            {result.visitNo && t('property.enquiry.visitReq', { no: result.visitNo })}
          </p>
          <p className="mt-5 rounded-2xl bg-sand-50 p-4 text-sm leading-relaxed text-navy-600 ring-1 ring-inset ring-navy-900/5">{t('property.enquiry.soonerBefore')}<a href={hotlineHref()} className="font-semibold text-gold-700 underline-offset-4 hover:underline">{currentHotline()}</a>{t('property.enquiry.soonerAfterHotline')}{target.listingNo && <>{t('property.enquiry.soonerQuoteBefore')}<span className="font-semibold text-navy-900">{target.listingNo}</span>{t('property.enquiry.soonerQuoteAfter')}</>}{t('property.enquiry.soonerEnd')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {!isGuest && <Button variant="outline" size="lg" to="/my-enquiries" onClick={onClose} className="rounded-full">{t('property.enquiry.myEnquiries')}</Button>}
            <Button variant="gold" size="lg" onClick={onClose} className="rounded-full px-8 font-semibold">{t('property.enquiry.done')}</Button>
          </div>
        </div>
      ) : !canEnquire ? (
        <Alert tone="info">{t('property.enquiry.staff', { hotline: currentHotline() })}</Alert>
      ) : stage === 'otp' ? (
        <>
          {summary}
          <OtpStep phone={v.phone} email={v.email} busy={create.isPending} onVerified={submit} onBack={() => setStage('form')} />
          {create.error && <Alert tone="danger" className="mt-3">{leadErrorText(create.error)}</Alert>}
        </>
      ) : (
        <form onSubmit={onContinue} className="space-y-4" noValidate>
          {summary}
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sand-100 p-1 sm:grid-cols-4" role="tablist">
            {optLabels(t, 'enquiryType', ENQUIRY_TYPES).map((x) => (
              <button key={x.value} type="button" role="tab" aria-selected={type === x.value} onClick={() => { setType(x.value); setErrors({}); }}
                className={cn('h-10 whitespace-nowrap rounded-xl px-2 text-sm font-medium transition-all', type === x.value ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-600 hover:text-navy-900')}>{x.label}</button>
            ))}
          </div>
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
              {v.slot && <p className="text-xs text-navy-500">{t('property.enquiry.requested', { when: dateTime(v.slot) })}</p>}
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
          <div className="flex flex-col-reverse gap-3 border-t border-sand-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <a href={hotlineHref()} className="inline-flex items-center gap-2 text-sm text-navy-500 transition-colors hover:text-gold-700"><Phone className="h-4 w-4 text-gold-600" aria-hidden />{currentHotline()}{target.listingNo && t('property.enquiry.quoteNo', { no: target.listingNo })}</a>
            <Button variant="gold" size="lg" type="submit" loading={create.isPending} className="rounded-full px-8 font-semibold">{isGuest ? t('property.enquiry.continue') : t('property.enquiry.submit')}</Button>
          </div>
          <p className="flex items-center gap-2 text-xs text-navy-400"><ShieldCheck className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />{t('property.freePrivate')}</p>
        </form>
      )}
    </PublicModal>
  );
}
