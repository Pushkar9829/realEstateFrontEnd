// RE-S-PUB-21 request a property (RE-E-20): a requirement lead with no
// property, prefilled from the current search. Guests verify the phone by OTP.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Button, Checkbox, Input, Select, Textarea } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { useCities, useLocalities, useMasters } from '@/modules/listings/api';
import { CATEGORIES, csvList } from '@/modules/search/api';
import { TIMELINES, useRequestProperty } from '@/modules/leads/publicApi';
import { ConsentFields, ContactFields, OtpStep, contactBody, emptyContact, leadErrorText, useBuyerIdentity, validateContact } from './GuestVerify';
import { FORM_SKIN, currentHotline, hotlineHref } from './States';

const BHKS = [1, 2, 3, 4, 5];

// Translated label for a fixed option (falls back to the module's English label).
function optionLabel(t, key, fallback) {
  const v = t(key);
  return v === key ? fallback : v;
}

function fromFilters(f = {}) {
  return {
    purpose: f.purpose === 'rent' ? 'rent' : 'sale',
    city: f.city || '',
    localities: csvList(f.localities),
    category: f.category || '',
    types: csvList(f.types),
    bhk: csvList(f.bhk).map((b) => parseInt(b, 10)).filter((n) => n > 0 && n <= 5),
    budgetMin: f.minPrice || '',
    budgetMax: f.maxPrice || '',
    areaMin: f.minArea || '',
    timeline: '',
    loanNeeded: false,
    notes: '',
    alertMe: true,
  };
}

export default function RequestPropertyForm({ prefill, onDone, compact }) {
  const t = useT();
  const { isGuest, user, canEnquire } = useBuyerIdentity();
  const cities = useCities();
  const masters = useMasters();
  const [v, setV] = useState(() => fromFilters(prefill));
  const [contact, setContact] = useState(() => emptyContact(user));
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState('form');
  const [result, setResult] = useState(null);
  const req = useRequestProperty();

  const city = useMemo(() => (cities.data || []).find((c) => [c.code, c.slug, c.name && c.name.toLowerCase()].includes(String(v.city).toLowerCase())), [cities.data, v.city]);
  const localities = useLocalities(city && city.code);
  // Prefilled locality codes become names once the master list arrives.
  useEffect(() => {
    if (!localities.data) return;
    setV((s) => ({ ...s, localities: s.localities.map((x) => { const l = localities.data.find((y) => y.code === x || y._id === x); return l ? l.name : x; }) }));
  }, [localities.data]);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggle = (k, x, max) => setV((s) => ({ ...s, [k]: s[k].includes(x) ? s[k].filter((y) => y !== x) : (s[k].length >= max ? s[k] : [...s[k], x]) }));
  const types = ((masters.data && masters.data.propertyTypes) || []).filter((pt) => !v.category || !pt.meta || !pt.meta.category || pt.meta.category === v.category);
  const timelines = TIMELINES.map((o) => ({ value: o.value, label: optionLabel(t, `account.request.timeline.${o.value}`, o.label) }));
  const categories = Object.entries(CATEGORIES).map(([value, label]) => ({ value, label: optionLabel(t, `account.request.categories.${value}`, label) }));

  const submit = async (otpToken) => {
    // Notes are read by our sales team, so the area line stays in English.
    const notes = [v.areaMin ? `Minimum area ${v.areaMin} sq ft` : '', v.notes.trim()].filter(Boolean).join('. ');
    const body = {
      purpose: v.purpose, city: city ? city.name : v.city, localities: v.localities, ...(v.category ? { category: v.category } : {}), types: v.types, bhk: v.bhk,
      ...(v.budgetMin ? { budgetMin: Number(v.budgetMin) } : {}), budgetMax: Number(v.budgetMax), timeline: v.timeline, loanNeeded: v.loanNeeded,
      ...(notes ? { notes: notes.slice(0, 1000) } : {}), ...contactBody(contact, isGuest), ...(otpToken ? { otpToken } : {}), consent: true, alertMe: !isGuest && v.alertMe,
    };
    try {
      const r = await req.mutateAsync(body);
      setResult(r); setStage('done'); if (onDone) onDone(r);
    } catch (err) { setErrors(err.fieldErrors || {}); setStage('form'); }
  };

  const onContinue = (e) => {
    e.preventDefault();
    const er = validateContact(contact, { isGuest });
    if (!v.city) er.city = t('account.request.errCity');
    if (!(Number(v.budgetMax) > 0)) er.budgetMax = t('account.request.errBudget');
    if (v.budgetMin && Number(v.budgetMin) > Number(v.budgetMax)) er.budgetMax = t('account.request.errBudgetMin');
    if (!v.timeline) er.timeline = t('account.request.errTimeline');
    if (v.notes.length > 500) er.notes = t('account.request.errNotes');
    if (!consent) er.consent = t('account.request.errConsent');
    setErrors(er);
    if (Object.keys(er).length) return;
    if (isGuest) setStage('otp'); else submit();
  };

  if (stage === 'done' && result) {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-300 ring-offset-4 ring-offset-white"><CheckCircle2 className="h-7 w-7" aria-hidden /></span>
        <p className="mt-6 font-display text-2xl font-medium text-navy-900">{t('account.request.reference', { no: result.leadNo })}</p>
        <p className="mt-2 text-sm text-navy-500">{result.merged ? t('account.request.merged') : t('account.request.willCall')}</p>
        {result.savedSearchId && <p className="mt-1 text-sm text-navy-500">{t('account.request.alertDaily')}</p>}
        <p className="mt-5 text-sm text-navy-500">{t('account.request.callAny')} <a className="font-semibold text-navy-900 underline decoration-gold-400 underline-offset-4" href={hotlineHref()}>{currentHotline()}</a></p>
      </div>
    );
  }
  if (!canEnquire) return <Alert tone="info">{t('account.request.staff', { hotline: currentHotline() })}</Alert>;
  if (stage === 'otp') {
    return (
      <div>
        <OtpStep phone={contact.phone} email={contact.email} busy={req.isPending} onVerified={submit} onBack={() => setStage('form')} />
        {req.error && <Alert tone="danger" className="mt-3">{leadErrorText(req.error)}</Alert>}
      </div>
    );
  }

  const rent = v.purpose === 'rent';
  return (
    <form onSubmit={onContinue} className={cn('space-y-5', FORM_SKIN)} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t('account.request.lookingTo')} required value={v.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: t('account.request.buy') }, { value: 'rent', label: t('account.request.rent') }]} />
        <Select label={t('common.city')} required placeholder={t('account.request.chooseCity')} value={city ? city.code : ''} error={errors.city}
          onChange={(e) => setV((s) => ({ ...s, city: e.target.value, localities: [] }))} options={(cities.data || []).map((c) => ({ value: c.code, label: c.name }))} />
      </div>
      {city && (localities.data || []).length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-800">{t('account.request.localities')} <span className="font-normal text-navy-500">{t('account.request.upTo5')}</span></legend>
          <div className={cn('flex flex-wrap gap-2 overflow-y-auto p-0.5', compact ? 'max-h-28' : 'max-h-40')}>
            {localities.data.map((l) => {
              const on = v.localities.includes(l.name);
              return <button key={l._id} type="button" aria-pressed={on} onClick={() => toggle('localities', l.name, 5)} className={cn('min-h-[32px] rounded-full px-3 py-1 text-xs transition-all', on ? 'bg-navy-900 font-medium text-white shadow-sm' : 'bg-white text-navy-600 ring-1 ring-inset ring-navy-900/10 hover:text-navy-900 hover:ring-navy-900/30')}>{l.name}</button>;
            })}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t('account.request.category')} placeholder={t('account.request.any')} value={v.category} onChange={(e) => setV((s) => ({ ...s, category: e.target.value, types: [] }))} options={categories} />
        <Select label={t('account.request.type')} placeholder={t('account.request.anyType')} value={v.types[0] || ''} onChange={(e) => setV((s) => ({ ...s, types: e.target.value ? [e.target.value] : [] }))} options={types.map((pt) => ({ value: pt.code, label: pt.name }))} />
      </div>
      {v.category !== 'commercial' && v.category !== 'land' && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-800">BHK</legend>
          <div className="flex flex-wrap gap-2 p-0.5">
            {BHKS.map((b) => { const on = v.bhk.includes(b); return <button key={b} type="button" aria-pressed={on} onClick={() => toggle('bhk', b, 6)} className={cn('min-h-[36px] rounded-full px-3.5 py-1.5 text-sm transition-all', on ? 'bg-navy-900 font-medium text-white shadow-sm' : 'bg-white text-navy-600 ring-1 ring-inset ring-navy-900/10 hover:text-navy-900 hover:ring-navy-900/30')}>{t('account.request.bhk', { n: b === 5 ? '5+' : b })}</button>; })}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={t(rent ? 'account.request.budgetMinRent' : 'account.request.budgetMin')} type="number" min="0" inputMode="numeric" value={v.budgetMin} onChange={set('budgetMin')} />
        <Input label={t(rent ? 'account.request.budgetMaxRent' : 'account.request.budgetMax')} required type="number" min="0" inputMode="numeric" value={v.budgetMax} onChange={set('budgetMax')} error={errors.budgetMax} />
        <Input label={t('account.request.minArea')} type="number" min="0" inputMode="numeric" value={v.areaMin} onChange={set('areaMin')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t(rent ? 'account.request.moveIn' : 'account.request.purchase')} required placeholder={t('account.request.choose')} value={v.timeline} onChange={set('timeline')} options={timelines} error={errors.timeline} />
        <div className="flex items-end pb-2"><Checkbox label={t('account.request.loan')} checked={v.loanNeeded} onChange={set('loanNeeded')} /></div>
      </div>
      <Textarea label={t('account.request.notes')} rows={3} maxLength={500} value={v.notes} onChange={set('notes')} error={errors.notes} hint={`${v.notes.length}/500`} />
      <ContactFields value={contact} onChange={setContact} errors={errors} isGuest={isGuest} />
      <ConsentFields consent={consent} onConsent={setConsent} error={errors.consent} />
      {!isGuest && <Checkbox label={t('account.request.alertMe')} checked={v.alertMe} onChange={set('alertMe')} />}
      {req.error && <Alert tone="danger">{leadErrorText(req.error)}</Alert>}
      <div className="flex justify-end pt-2"><Button type="submit" variant="gold" size="lg" className="rounded-full px-8 font-semibold" loading={req.isPending}>{isGuest ? t('account.request.continue') : t('account.request.send')}</Button></div>
    </form>
  );
}
