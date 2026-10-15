// RE-S-PUB-18 contact us: form (guest phone OTP), hotline, WhatsApp and the
// grievance officer. Creates a contact_form lead.
import { useState } from 'react';
import { CheckCircle2, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { Alert, Button, Card, PageHeader, Select, Textarea } from '@/shared/ui';
import env from '@/config/env';
import { usePublicSettings } from '@/modules/search/api';
import { useContactForm } from '@/modules/leads/publicApi';
import { ConsentFields, ContactFields, OtpStep, contactBody, emptyContact, leadErrorText, useBuyerIdentity, validateContact } from '../../components/GuestVerify';
import { hotlineHref } from '../../components/States';

const TOPICS = [
  { value: 'buying', label: 'Buying a property' }, { value: 'renting', label: 'Renting a property' }, { value: 'listing', label: 'Listing my property' },
  { value: 'complaint', label: 'Complaint' }, { value: 'other', label: 'Something else' },
];

export default function ContactPage() {
  const { isGuest, user, canEnquire } = useBuyerIdentity();
  const settings = usePublicSettings();
  const s = settings.data || {};
  const [contact, setContact] = useState(() => emptyContact(user));
  const [topic, setTopic] = useState('buying');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState('form');
  const form = useContactForm();
  const hotline = s.hotline || env.hotline;
  const wa = String(s.whatsappNumber || '').replace(/\D/g, '');
  const officer = s.privacy && s.privacy.grievanceOfficer;

  const submit = async (otpToken) => {
    const t = TOPICS.find((x) => x.value === topic).label;
    try {
      await form.mutateAsync({ ...contactBody(contact, isGuest), ...(otpToken ? { otpToken } : {}), message: `[${t}] ${message.trim()}`.slice(0, 2000), consent: true });
      setStage('done');
    } catch (err) { setErrors(err.fieldErrors || {}); setStage('form'); }
  };
  const onContinue = (e) => {
    e.preventDefault();
    const er = validateContact(contact, { isGuest });
    if (message.trim().length < 10 || message.length > 1000) er.message = 'Write 10 to 1000 characters';
    if (!consent) er.consent = 'Please agree to be contacted';
    setErrors(er);
    if (Object.keys(er).length) return;
    if (isGuest) setStage('otp'); else submit();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="Contact us" description="Our sales and support team answers every message. Your number stays private." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          {stage === 'done' ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" aria-hidden />
              <p className="mt-3 text-lg font-semibold text-ink">Message received</p>
              {form.data && form.data.leadNo && <p className="text-sm font-medium text-ink">Reference {form.data.leadNo}</p>}
              <p className="mt-1 text-sm text-ink-muted">We will get back to you within 2 working hours.</p>
            </div>
          ) : !canEnquire ? (
            <Alert tone="info">Staff accounts use the internal tools. Log out to send a message as a visitor.</Alert>
          ) : stage === 'otp' ? (
            <>
              <OtpStep phone={contact.phone} email={contact.email} busy={form.isPending} onVerified={submit} onBack={() => setStage('form')} />
              {form.error && <Alert tone="danger" className="mt-3">{leadErrorText(form.error)}</Alert>}
            </>
          ) : (
            <form onSubmit={onContinue} className="space-y-4" noValidate>
              <ContactFields value={contact} onChange={setContact} errors={errors} isGuest={isGuest} />
              <Select label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} options={TOPICS} />
              {topic === 'complaint' && <p className="text-xs text-ink-subtle">Complaints open a ticket with our helpdesk. Invoice disputes for listers are raised from the lister panel.</p>}
              <Textarea label="Message" required rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} error={errors.message} hint={`${message.length}/1000`} />
              <ConsentFields consent={consent} onConsent={setConsent} error={errors.consent} />
              {form.error && <Alert tone="danger">{leadErrorText(form.error)}</Alert>}
              <div className="flex justify-end"><Button type="submit" loading={form.isPending}>{isGuest ? 'Continue' : 'Send message'}</Button></div>
            </form>
          )}
        </Card>
        <div className="space-y-3">
          <Card>
            <p className="text-sm font-semibold text-ink">Talk to us</p>
            <a href={hotlineHref(hotline)} className="mt-3 flex items-center gap-2 text-lg font-semibold text-brand-700"><Phone className="h-5 w-5" aria-hidden />{hotline}</a>
            <p className="text-xs text-ink-subtle">Mon-Sat, 9 am to 8 pm</p>
            {wa && <Button className="mt-3" variant="secondary" icon={MessageCircle} block onClick={() => window.open(`https://wa.me/${wa}`, '_blank', 'noopener')}>WhatsApp us</Button>}
            {s.supportEmail && <a href={`mailto:${s.supportEmail}`} className="mt-3 flex items-center gap-2 text-sm text-ink-muted hover:text-brand-700"><Mail className="h-4 w-4" aria-hidden />{s.supportEmail}</a>}
          </Card>
          {officer && (officer.name || officer.email) && (
            <Card>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden />Grievance officer</p>
              <p className="mt-2 text-sm text-ink-muted">{officer.name}</p>
              {officer.email && <a href={`mailto:${officer.email}`} className="text-sm text-brand-700 hover:underline">{officer.email}</a>}
            </Card>
          )}
          {s.helpdeskUrl && <a href={s.helpdeskUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-medium text-brand-700 hover:underline">Visit our help centre</a>}
        </div>
      </div>
    </div>
  );
}
