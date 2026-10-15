// RE-S-PUB-21 request a property (RE-E-20): a requirement lead with no
// property, prefilled from the current search. Guests verify the phone by OTP.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Button, Checkbox, Input, Select, Textarea } from '@/shared/ui';
import env from '@/config/env';
import { useCities, useLocalities, useMasters } from '@/modules/listings/api';
import { CATEGORIES, csvList } from '@/modules/search/api';
import { TIMELINES, useRequestProperty } from '@/modules/leads/publicApi';
import { ConsentFields, ContactFields, OtpStep, contactBody, emptyContact, leadErrorText, useBuyerIdentity, validateContact } from './GuestVerify';
import { hotlineHref } from './States';

const BHKS = [1, 2, 3, 4, 5];

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
  const types = ((masters.data && masters.data.propertyTypes) || []).filter((t) => !v.category || !t.meta || !t.meta.category || t.meta.category === v.category);

  const submit = async (otpToken) => {
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
    if (!v.city) er.city = 'Choose a city';
    if (!(Number(v.budgetMax) > 0)) er.budgetMax = 'Enter your maximum budget';
    if (v.budgetMin && Number(v.budgetMin) > Number(v.budgetMax)) er.budgetMax = 'Maximum must be at least the minimum';
    if (!v.timeline) er.timeline = 'Choose a timeline';
    if (v.notes.length > 500) er.notes = 'Up to 500 characters';
    if (!consent) er.consent = 'Please agree to be contacted';
    setErrors(er);
    if (Object.keys(er).length) return;
    if (isGuest) setStage('otp'); else submit();
  };

  if (stage === 'done' && result) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" aria-hidden />
        <p className="mt-3 text-lg font-semibold text-ink">Reference {result.leadNo}</p>
        <p className="mt-1 text-sm text-ink-muted">{result.merged ? 'We updated your open request.' : 'Our team will call you with matching options.'}</p>
        {result.savedSearchId && <p className="mt-1 text-sm text-ink-muted">We will also alert you daily when matching properties go live.</p>}
        <p className="mt-4 text-sm text-ink-muted">Call us any time on <a className="font-semibold text-brand-700" href={hotlineHref()}>{env.hotline}</a></p>
      </div>
    );
  }
  if (!canEnquire) return <Alert tone="info">Staff accounts cannot raise requests. Use a buyer account or call {env.hotline}.</Alert>;
  if (stage === 'otp') {
    return (
      <div>
        <OtpStep phone={contact.phone} email={contact.email} busy={req.isPending} onVerified={submit} onBack={() => setStage('form')} />
        {req.error && <Alert tone="danger" className="mt-3">{leadErrorText(req.error)}</Alert>}
      </div>
    );
  }

  return (
    <form onSubmit={onContinue} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Looking to" required value={v.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: 'Buy' }, { value: 'rent', label: 'Rent' }]} />
        <Select label="City" required placeholder="Choose a city" value={city ? city.code : ''} error={errors.city}
          onChange={(e) => setV((s) => ({ ...s, city: e.target.value, localities: [] }))} options={(cities.data || []).map((c) => ({ value: c.code, label: c.name }))} />
      </div>
      {city && (localities.data || []).length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">Localities <span className="font-normal text-ink-subtle">(up to 5)</span></legend>
          <div className={cn('flex flex-wrap gap-1.5 overflow-y-auto', compact ? 'max-h-28' : 'max-h-40')}>
            {localities.data.map((l) => {
              const on = v.localities.includes(l.name);
              return <button key={l._id} type="button" aria-pressed={on} onClick={() => toggle('localities', l.name, 5)} className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-line-strong bg-white text-ink-muted')}>{l.name}</button>;
            })}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Category" placeholder="Any" value={v.category} onChange={(e) => setV((s) => ({ ...s, category: e.target.value, types: [] }))} options={Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))} />
        <Select label="Type" placeholder="Any type" value={v.types[0] || ''} onChange={(e) => setV((s) => ({ ...s, types: e.target.value ? [e.target.value] : [] }))} options={types.map((t) => ({ value: t.code, label: t.name }))} />
      </div>
      {v.category !== 'commercial' && v.category !== 'land' && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">BHK</legend>
          <div className="flex flex-wrap gap-1.5">
            {BHKS.map((b) => { const on = v.bhk.includes(b); return <button key={b} type="button" aria-pressed={on} onClick={() => toggle('bhk', b, 6)} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-line-strong bg-white text-ink-muted')}>{b === 5 ? '5+' : b} BHK</button>; })}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={`Budget min (₹${v.purpose === 'rent' ? '/month' : ''})`} type="number" min="0" inputMode="numeric" value={v.budgetMin} onChange={set('budgetMin')} />
        <Input label={`Budget max (₹${v.purpose === 'rent' ? '/month' : ''})`} required type="number" min="0" inputMode="numeric" value={v.budgetMax} onChange={set('budgetMax')} error={errors.budgetMax} />
        <Input label="Min area (sq ft)" type="number" min="0" inputMode="numeric" value={v.areaMin} onChange={set('areaMin')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={v.purpose === 'rent' ? 'Move-in timeline' : 'Purchase timeline'} required placeholder="Choose" value={v.timeline} onChange={set('timeline')} options={TIMELINES} error={errors.timeline} />
        <div className="flex items-end pb-2"><Checkbox label="Home loan needed" checked={v.loanNeeded} onChange={set('loanNeeded')} /></div>
      </div>
      <Textarea label="Anything else? (optional)" rows={3} maxLength={500} value={v.notes} onChange={set('notes')} error={errors.notes} hint={`${v.notes.length}/500`} />
      <ContactFields value={contact} onChange={setContact} errors={errors} isGuest={isGuest} />
      <ConsentFields consent={consent} onConsent={setConsent} error={errors.consent} />
      {!isGuest && <Checkbox label="Also alert me when matching properties are listed" checked={v.alertMe} onChange={set('alertMe')} />}
      {req.error && <Alert tone="danger">{leadErrorText(req.error)}</Alert>}
      <div className="flex justify-end"><Button type="submit" loading={req.isPending}>{isGuest ? 'Continue' : 'Send request'}</Button></div>
    </form>
  );
}
