// Contact fields and the guest phone OTP step shared by the enquiry modal,
// request-a-property and contact forms (RE-S-PUB-06/18/21). Logged-in buyers
// skip the OTP; their name and phone come from the account.
import { useEffect, useRef, useState } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { Alert, Button, Checkbox, Input, OtpInput } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { NAME_RX, isIndian, normalisePhone, phoneError, sendGuestOtp, verifyGuestOtp } from '@/modules/leads/publicApi';
import { t as tr, useT } from '@/shared/i18n';
import { currentHotline, hotlineHref } from './States';

export function useBuyerIdentity() {
  const { isAuthed, user } = useAuth();
  const canEnquire = !isAuthed || ['buyer', 'lister'].includes(user.role);
  return { isGuest: !isAuthed, user: isAuthed ? user : null, canEnquire };
}

export const emptyContact = (user) => ({ name: (user && user.name) || '', phone: (user && user.phone) || '', email: (user && user.email) || '' });

export function validateContact(c, { isGuest, requireEmail } = {}) {
  const e = {};
  if (!NAME_RX.test(String(c.name || '').trim())) e.name = tr('property.guest.errName');
  if (isGuest) {
    const pe = phoneError(c.phone);
    if (pe) e.phone = pe;
    if ((requireEmail || (c.phone && !isIndian(c.phone) && !pe)) && !c.email) e.email = tr('property.guest.errEmailIntl');
  }
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) e.email = tr('property.guest.errEmail');
  return e;
}

// Body fields for the lead APIs; logged-in users are identified by the token.
export const contactBody = (c, isGuest) => ({
  name: c.name.trim(),
  ...(c.email ? { email: c.email.trim() } : {}),
  ...(isGuest ? { phone: normalisePhone(c.phone) } : {}),
});

export function ContactFields({ value, onChange, errors = {}, isGuest }) {
  const t = useT();
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label={t('property.guest.name')} required value={value.name} onChange={set('name')} error={errors.name} maxLength={60} autoComplete="name" className="sm:col-span-2" />
      <Input label={t('property.guest.mobile')} required value={value.phone} onChange={set('phone')} error={errors.phone} disabled={!isGuest} placeholder="98765 43210"
        inputMode="tel" autoComplete="tel" hint={isGuest ? t('property.guest.hintOtp') : t('property.guest.hintAccount')} />
      <Input label={t('property.guest.email')} type="email" value={value.email} onChange={set('email')} error={errors.email} maxLength={120} autoComplete="email" hint={t('property.guest.hintEmail')} />
    </div>
  );
}

export function ConsentFields({ consent, onConsent, error }) {
  const t = useT();
  return (
    <Checkbox checked={consent} onChange={(e) => onConsent(e.target.checked)} error={error}
      label={t('property.guest.consent')}
      description={t('property.guest.consentDesc')} />
  );
}

// Codes where the right answer is "call the hotline" (no reason disclosed).
export function leadErrorText(err) {
  if (!err) return null;
  if (err.code === 'RATE_LIMITED' || err.code === 'SEEKER_BLOCKED') return tr('property.guest.errRate', { hotline: currentHotline() });
  if (err.code === 'SELF_ENQUIRY') return tr('property.guest.errSelf');
  if (err.code === 'NOT_A_BUYER') return tr('property.guest.errNotBuyer');
  if (err.code === 'OTP_TOKEN_INVALID' || err.code === 'OTP_REQUIRED') return tr('property.guest.errOtp');
  return err.message;
}

// Sends the code on mount, then verifies it and returns the otpToken.
export function OtpStep({ phone, email, onVerified, onBack, busy }) {
  const t = useT();
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
  useEffect(() => { if (cooldown <= 0) return undefined; const id = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(id); }, [cooldown]);

  const verify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError(t('property.guest.enterCode')); return; }
    setVerifying(true); setError(null);
    try {
      const r = await verifyGuestOtp({ phone, code });
      await onVerified(r.otpToken);
    } catch (err) { setError(leadErrorText(err)); } finally { setVerifying(false); }
  };

  const shown = isIndian(phone) ? `+91 ${normalisePhone(phone)}` : normalisePhone(phone);
  return (
    <form onSubmit={verify} className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl bg-gold-50 p-4 text-sm leading-relaxed text-navy-800 ring-1 ring-inset ring-gold-200">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gold-700 ring-1 ring-gold-300"><ShieldCheck className="h-[18px] w-[18px]" aria-hidden /></span>
        <p>{sending && !sentTo ? t('property.guest.sending') : sentTo === 'email' ? t('property.guest.emailed', { phone: shown }) : t('property.guest.sms', { phone: shown })}{t('property.guest.validFor')}</p>
      </div>
      <OtpInput value={code} onChange={setCode} autoFocus disabled={verifying || busy} />
      {error && <Alert tone="danger">{error}{(/hotline/.test(error) || (currentHotline() && error.includes(currentHotline()))) && <> <a className="font-semibold underline" href={hotlineHref()}><Phone className="inline h-3.5 w-3.5" /> {t('property.call')}</a></>}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-5">
        <div className="flex flex-wrap items-center gap-1">
          {onBack && <Button variant="ghost" onClick={onBack} className="rounded-full text-navy-600 hover:bg-sand-100 hover:text-navy-900">{t('property.guest.changeNumber')}</Button>}
          <Button variant="ghost" disabled={cooldown > 0 || sending} onClick={send} className="rounded-full font-semibold text-gold-700 hover:bg-gold-50 hover:text-gold-800">{cooldown > 0 ? t('property.guest.resendIn', { n: cooldown }) : t('property.guest.resend')}</Button>
        </div>
        <Button variant="gold" size="lg" type="submit" loading={verifying || busy} className="rounded-full px-8 font-semibold">{t('property.guest.verifySubmit')}</Button>
      </div>
    </form>
  );
}
