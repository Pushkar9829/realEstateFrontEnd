// RE-S-PUB-18 contact us: form (guest phone OTP), hotline, WhatsApp and the
// grievance officer. Creates a contact_form lead.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronRight, Clock, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { Alert, Button, Select, Textarea } from '@/shared/ui';
import { PUBLIC_FORM_SKIN } from '@/shared/layouts/AuthLayout';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { track } from '@/shared/lib/analytics';
import env from '@/config/env';
import { usePublicSettings } from '@/modules/search/api';
import { useContactForm } from '@/modules/leads/publicApi';
import { ConsentFields, ContactFields, OtpStep, contactBody, emptyContact, leadErrorText, useBuyerIdentity, validateContact } from '../../components/GuestVerify';
import { hotlineHref } from '../../components/States';

// `label` is the English topic prefixed to the message for our sales team;
// the visitor sees the translated label.
const TOPICS = [
  { value: 'buying', label: 'Buying a property' }, { value: 'renting', label: 'Renting a property' }, { value: 'listing', label: 'Listing my property' },
  { value: 'complaint', label: 'Complaint' }, { value: 'other', label: 'Something else' },
];

export default function ContactPage() {
  const t = useT();
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
  useDocumentMeta({ title: t('account.meta.contactTitle'), description: t('account.meta.contactDesc'), path: '/contact' });

  const submit = async (otpToken) => {
    const topicLabel = TOPICS.find((x) => x.value === topic).label;
    try {
      await form.mutateAsync({ ...contactBody(contact, isGuest), ...(otpToken ? { otpToken } : {}), message: `[${topicLabel}] ${message.trim()}`.slice(0, 2000), consent: true });
      setStage('done');
    } catch (err) { setErrors(err.fieldErrors || {}); setStage('form'); }
  };
  const onContinue = (e) => {
    e.preventDefault();
    const er = validateContact(contact, { isGuest });
    if (message.trim().length < 10 || message.length > 1000) er.message = t('account.contact.errMessage');
    if (!consent) er.consent = t('account.contact.errConsent');
    setErrors(er);
    if (Object.keys(er).length) return;
    if (isGuest) setStage('otp'); else submit();
  };
  const openWhatsApp = () => {
    track('whatsapp_click', { source: 'contact' });
    window.open(`https://wa.me/${wa}`, '_blank', 'noopener');
  };

  const methods = [
    { key: 'call', icon: Phone, title: t('pages.contact.call'), value: hotline, text: t('pages.contact.callText'), href: hotlineHref(hotline) },
    wa && { key: 'wa', icon: MessageCircle, title: t('account.contact.whatsapp'), value: `+${wa}`, text: t('pages.contact.whatsappText'), onClick: openWhatsApp },
    s.supportEmail && { key: 'email', icon: Mail, title: t('pages.contact.email'), value: s.supportEmail, text: t('pages.contact.emailText'), href: `mailto:${s.supportEmail}` },
    { key: 'office', icon: Clock, title: t('pages.contact.office'), value: t('account.contact.hours'), text: s.companyName || env.appName },
  ].filter(Boolean);
  const methodCls = 'group relative flex h-full w-full flex-col rounded-2xl bg-white p-6 text-left shadow-card ring-1 ring-navy-900/5 transition duration-300';
  const methodBody = (m) => (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-gold-300"><m.icon className="h-5 w-5" aria-hidden /></span>
      <span className="mt-5 block text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">{m.title}</span>
      <span className="mt-1.5 block break-words font-display text-xl font-medium text-navy-900">{m.value}</span>
      <span className="mt-1 block text-sm text-navy-400">{m.text}</span>
      {(m.href || m.onClick) && <ArrowUpRight className="absolute right-5 top-6 h-5 w-5 text-navy-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-600" aria-hidden />}
    </>
  );

  return (
    <div className="bg-sand-50">
      <header className="relative isolate overflow-hidden bg-navy-950">
        <img src="/images/stock/office-lounge.webp" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/40" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:pb-28 lg:pt-16">
          <nav aria-label={t('pages.common.breadcrumb')} className="flex items-center gap-1.5 text-sm text-navy-300">
            <Link to="/" className="transition-colors hover:text-white">{t('pages.common.home')}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-navy-200">{t('account.contact.title')}</span>
          </nav>
          <p className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300"><span className="h-px w-8 bg-current" aria-hidden />{t('pages.contact.eyebrow')}</p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl">{t('account.contact.title')}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-navy-200">{t('account.contact.description')}</p>
        </div>
      </header>

      <div className="mx-auto -mt-14 max-w-7xl px-4 pb-16 sm:px-6 lg:pb-24">
        <ul className={`grid gap-4 sm:grid-cols-2 ${methods.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {methods.map((m) => (
            <li key={m.key}>
              {m.href ? <a href={m.href} className={`${methodCls} hover:-translate-y-1 hover:shadow-lift`}>{methodBody(m)}</a>
                : m.onClick ? <button type="button" onClick={m.onClick} className={`${methodCls} hover:-translate-y-1 hover:shadow-lift`}>{methodBody(m)}</button>
                : <div className={methodCls}>{methodBody(m)}</div>}
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          <section className={`min-w-0 rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-900/5 sm:p-10 ${PUBLIC_FORM_SKIN}`} aria-labelledby="contact-form-h">
            <h2 id="contact-form-h" className="font-display text-3xl font-medium text-navy-900">{t('pages.contact.formTitle')}</h2>
            <p className="mb-8 mt-2 text-sm text-navy-500">{t('account.contact.replyTime')}</p>
            {stage === 'done' ? (
              <div className="rounded-2xl bg-sand-100 px-6 py-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600 ring-1 ring-success-100"><CheckCircle2 className="h-7 w-7" aria-hidden /></span>
                <p className="mt-4 font-display text-2xl font-medium text-navy-900">{t('account.contact.received')}</p>
                {form.data && form.data.leadNo && <p className="mt-1 text-sm font-semibold text-navy-700">{t('account.contact.reference', { no: form.data.leadNo })}</p>}
                <p className="mt-1 text-sm text-navy-500">{t('account.contact.replyTime')}</p>
              </div>
            ) : !canEnquire ? (
              <Alert tone="info">{t('account.contact.staff')}</Alert>
            ) : stage === 'otp' ? (
              <>
                <OtpStep phone={contact.phone} email={contact.email} busy={form.isPending} onVerified={submit} onBack={() => setStage('form')} />
                {form.error && <Alert tone="danger" className="mt-3">{leadErrorText(form.error)}</Alert>}
              </>
            ) : (
              <form onSubmit={onContinue} className="space-y-5" noValidate>
                <ContactFields value={contact} onChange={setContact} errors={errors} isGuest={isGuest} />
                <Select label={t('account.contact.topic')} value={topic} onChange={(e) => setTopic(e.target.value)} options={TOPICS.map((o) => ({ value: o.value, label: t(`account.contact.topics.${o.value}`) }))} />
                {topic === 'complaint' && <p className="text-xs text-navy-400">{t('account.contact.complaintNote')}</p>}
                <Textarea label={t('account.contact.message')} required rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} error={errors.message} hint={`${message.length}/1000`} />
                <div className="rounded-2xl bg-sand-100 p-4 ring-1 ring-inset ring-navy-900/5"><ConsentFields consent={consent} onConsent={setConsent} error={errors.consent} /></div>
                {form.error && <Alert tone="danger">{leadErrorText(form.error)}</Alert>}
                <div className="flex justify-end"><Button type="submit" variant="gold" size="lg" iconRight={ArrowRight} className="w-full !rounded-full px-8 font-semibold sm:w-auto" loading={form.isPending}>{isGuest ? t('account.contact.continue') : t('account.contact.send')}</Button></div>
              </form>
            )}
          </section>

          <aside className="space-y-4">
            <div className="relative isolate overflow-hidden rounded-3xl bg-navy-900 p-6 text-white">
              <img src="/images/stock/towers-night.webp" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/80 to-navy-900/60" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">{t('account.contact.talk')}</p>
              <a href={hotlineHref(hotline)} className="mt-3 flex items-center gap-2 font-display text-2xl font-medium text-white hover:text-gold-200"><Phone className="h-5 w-5 text-gold-400" aria-hidden />{hotline}</a>
              <p className="mt-1 text-sm text-navy-200">{t('account.contact.hours')}</p>
              {wa && <Button className="mt-5 !rounded-full" variant="glass" icon={MessageCircle} block onClick={openWhatsApp}>{t('account.contact.whatsapp')}</Button>}
            </div>
            {officer && (officer.name || officer.email) && (
              <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-900/5">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><ShieldCheck className="h-4 w-4 text-gold-600" aria-hidden />{t('account.contact.grievance')}</p>
                <p className="mt-2 text-sm text-navy-600">{officer.name}</p>
                {officer.email && <a href={`mailto:${officer.email}`} className="break-all text-sm font-medium text-navy-900 underline decoration-gold-400 underline-offset-4 hover:text-gold-700">{officer.email}</a>}
              </div>
            )}
            {s.helpdeskUrl && <a href={s.helpdeskUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-navy-900/15 bg-white px-5 py-3 text-sm font-semibold text-navy-900 transition-colors hover:border-navy-900/40">{t('account.contact.helpCentre')}<ArrowUpRight className="h-4 w-4" aria-hidden /></a>}
          </aside>
        </div>
      </div>
    </div>
  );
}
