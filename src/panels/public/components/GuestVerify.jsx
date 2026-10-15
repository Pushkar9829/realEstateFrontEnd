// Contact fields and the guest phone OTP step shared by the enquiry modal,
// request-a-property and contact forms (RE-S-PUB-06/18/21). Logged-in buyers
// skip the OTP; their name and phone come from the account.
import { useEffect, useRef, useState } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { Alert, Button, Checkbox, Input, OtpInput } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { NAME_RX, isIndian, normalisePhone, phoneError, sendGuestOtp, verifyGuestOtp } from '@/modules/leads/publicApi';
import env from '@/config/env';
import { hotlineHref } from './States';

export function useBuyerIdentity() {
  const { isAuthed, user } = useAuth();
  const canEnquire = !isAuthed || ['buyer', 'lister'].includes(user.role);
  return { isGuest: !isAuthed, user: isAuthed ? user : null, canEnquire };
}

export const emptyContact = (user) => ({ name: (user && user.name) || '', phone: (user && user.phone) || '', email: (user && user.email) || '' });

export function validateContact(c, { isGuest, requireEmail } = {}) {
  const e = {};
  if (!NAME_RX.test(String(c.name || '').trim())) e.name = 'Enter your name (2-60 letters)';
  if (isGuest) {
    const pe = phoneError(c.phone);
    if (pe) e.phone = pe;
    if ((requireEmail || (c.phone && !isIndian(c.phone) && !pe)) && !c.email) e.email = 'Email is required for an international number';
  }
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) e.email = 'Enter a valid email';
  return e;
}

// Body fields for the lead APIs; logged-in users are identified by the token.
export const contactBody = (c, isGuest) => ({
  name: c.name.trim(),
  ...(c.email ? { email: c.email.trim() } : {}),
  ...(isGuest ? { phone: normalisePhone(c.phone) } : {}),
});

export function ContactFields({ value, onChange, errors = {}, isGuest }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Your name" required value={value.name} onChange={set('name')} error={errors.name} maxLength={60} autoComplete="name" className="sm:col-span-2" />
      <Input label="Mobile number" required value={value.phone} onChange={set('phone')} error={errors.phone} disabled={!isGuest} placeholder="98765 43210"
        inputMode="tel" autoComplete="tel" hint={isGuest ? 'We send a 6-digit code to verify it' : 'From your account'} />
      <Input label="Email" type="email" value={value.email} onChange={set('email')} error={errors.email} maxLength={120} autoComplete="email" hint="Optional for Indian numbers" />
    </div>
  );
}

export function ConsentFields({ consent, onConsent, error }) {
  return (
    <Checkbox checked={consent} onChange={(e) => onConsent(e.target.checked)} error={error}
      label="I agree to be contacted by the platform's sales team"
      description="Your number is never shared with the owner or builder." />
  );
}

// Codes where the right answer is "call the hotline" (no reason disclosed).
export function leadErrorText(err) {
  if (!err) return null;
  if (err.code === 'RATE_LIMITED' || err.code === 'SEEKER_BLOCKED') return `Too many requests from this number today. Please call our hotline ${env.hotline}.`;
  if (err.code === 'SELF_ENQUIRY') return 'You cannot enquire on your own listing.';
  if (err.code === 'NOT_A_BUYER') return 'Staff accounts cannot send enquiries. Log in with a buyer account.';
  if (err.code === 'OTP_TOKEN_INVALID' || err.code === 'OTP_REQUIRED') return 'Your phone verification expired. Please verify again.';
  return err.message;
}

// Sends the code on mount, then verifies it and returns the otpToken.
export function OtpStep({ phone, email, onVerified, onBack, busy }) {
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);

  const send = async () => {
    setSending(true); setError(null);
    try {
      const r = await sendGuestOtp({ phone, email });
      setSentTo(r.sentTo); setCooldown(60);
    } catch (e) { setError(leadErrorText(e)); } finally { setSending(false); }
  };
  useEffect(() => { if (!sentOnce.current) { sentOnce.current = true; send(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cooldown <= 0) return undefined; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const verify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setVerifying(true); setError(null);
    try {
      const r = await verifyGuestOtp({ phone, code });
      await onVerified(r.otpToken);
    } catch (err) { setError(leadErrorText(err)); } finally { setVerifying(false); }
  };

  const shown = isIndian(phone) ? `+91 ${normalisePhone(phone)}` : normalisePhone(phone);
  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="flex items-start gap-3 rounded-md bg-brand-50 p-3 text-sm text-brand-800">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <p>{sending && !sentTo ? 'Sending a code…' : sentTo === 'email' ? `We emailed a 6-digit code for ${shown}.` : `We sent a 6-digit code by SMS to ${shown}.`} It is valid for 5 minutes.</p>
      </div>
      <OtpInput value={code} onChange={setCode} autoFocus disabled={verifying || busy} />
      {error && <Alert tone="danger">{error}{/hotline/.test(error) && <> <a className="font-semibold underline" href={hotlineHref()}><Phone className="inline h-3.5 w-3.5" /> Call</a></>}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {onBack && <Button variant="ghost" onClick={onBack}>Change number</Button>}
          <Button variant="link" disabled={cooldown > 0 || sending} onClick={send}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</Button>
        </div>
        <Button type="submit" loading={verifying || busy}>Verify and submit</Button>
      </div>
    </form>
  );
}
