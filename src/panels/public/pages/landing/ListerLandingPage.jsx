// RE-S-PUB-14 list your property (lister landing): value proposition, how it
// works, no-broker policy, commission explanation (minimum % from settings),
// lister FAQ from the CMS and "Start listing". A signed-in buyer can convert
// to a lister here (POST /me/become-lister, then a fresh login).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Building2, ClipboardCheck, FileSignature, Handshake, Home, IndianRupee, PhoneOff, ShieldCheck, Store, UserPlus, Users } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Accordion, Alert, Button, Input, Modal, Select } from '@/shared/ui';
import { PUBLIC_FORM_SKIN } from '@/shared/layouts/AuthLayout';
import { api } from '@/shared/lib/api';
import { useAuth } from '@/modules/auth';
import { usePage } from '@/modules/cms/api';
import { usePublicSettings } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';

const STEPS = [
  { icon: UserPlus, key: 'register' },
  { icon: ShieldCheck, key: 'kyc' },
  { icon: ClipboardCheck, key: 'add' },
  { icon: BadgeCheck, key: 'approval' },
  { icon: Handshake, key: 'sell' },
];

const DEFAULT_FAQ = ['q1', 'q2', 'q3'];

// Owner / builder / landlord tiles: [key under home.listerKinds, icon, decorative photo].
const LISTER_KINDS = [['owners', Home, 'villa-garden'], ['builders', Building2, 'tower-glass'], ['landlords', Store, 'living-light']];

// Value propositions: [key under pages.lister.props, text key under home.lister, icon].
const PROPS = [['free', 'b1', IndianRupee], ['buyers', 'b2', PhoneOff], ['team', 'b3', Users], ['success', 'b4', Handshake]];

// Commission flow: [key under pages.lister.flow, icon].
const FLOW = [['c1', ClipboardCheck], ['c2', Users], ['c3', FileSignature]];

const IMG = (name) => `/images/stock/${name}.webp`;

function Title({ eyebrow, title, text, light = false, center = false }) {
  return (
    <div className={cn('mb-10', center && 'mx-auto max-w-2xl text-center')}>
      <p className={cn('flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]', center && 'justify-center', light ? 'text-gold-300' : 'text-gold-700')}>
        <span className="h-px w-8 bg-current" aria-hidden />{eyebrow}
      </p>
      <h2 className={cn('mt-3 font-display text-3xl font-medium leading-tight tracking-tight sm:text-[2.6rem] sm:leading-[1.1]', light ? 'text-white' : 'text-navy-900')}>{title}</h2>
      {text && <p className={cn('mt-4 max-w-2xl text-base leading-relaxed', center && 'mx-auto', light ? 'text-navy-200' : 'text-navy-500')}>{text}</p>}
    </div>
  );
}

function faqFrom(page) {
  const text = page && page.content;
  if (!text) return null;
  const items = String(text).split(/\n{2,}/).map((block) => { const [q, ...rest] = block.split('\n'); return { q: q.replace(/^Q:\s*/i, '').trim(), a: rest.join(' ').replace(/^A:\s*/i, '').trim() }; }).filter((x) => x.q && x.a);
  return items.length ? items : null;
}

function BecomeLister({ open, onClose }) {
  const t = useT();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState('owner');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (type === 'builder' && company.trim().length < 2) { setError(t('home.listerPage.become.companyError')); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/me/become-lister', { listerType: type, ...(type === 'builder' ? { companyName: company.trim() } : {}) });
      await logout();
      navigate('/login', { replace: true, state: { from: '/lister', notice: t('home.listerPage.become.notice') } });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('home.listerPage.become.title')} description={t('home.listerPage.become.description')}
      footer={<><Button variant="ghost" className="!rounded-full" onClick={onClose}>{t('common.cancel')}</Button><Button variant="navy" className="!rounded-full px-5" loading={busy} onClick={submit}>{t('home.listerPage.become.submit')}</Button></>}>
      <div className={`space-y-4 ${PUBLIC_FORM_SKIN}`}>
        <Select label={t('home.listerPage.become.iam')} value={type} onChange={(e) => setType(e.target.value)} options={['owner', 'builder', 'landlord'].map((v) => ({ value: v, label: t(`home.listerPage.become.${v}`) }))} />
        {type === 'builder' && <Input label={t('home.listerPage.become.company')} required value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />}
        <Alert tone="warning">{t('home.listerPage.become.warning')}</Alert>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

export default function ListerLandingPage() {
  const t = useT();
  useDocumentMeta({ title: t('home.listerPage.meta.title'), description: t('home.listerPage.meta.description'), path: '/list-your-property' });
  const { isAuthed, user } = useAuth();
  const settings = usePublicSettings();
  const faqPage = usePage('lister-faq');
  const [convert, setConvert] = useState(false);
  const c = (settings.data && settings.data.commission) || {};
  const role = isAuthed ? user.role : null;
  const ctaCls = '!rounded-full font-semibold';
  const cta = role === 'lister' ? <Button variant="gold" size="xl" className={ctaCls} iconRight={ArrowRight} to="/lister">{t('home.listerPage.goPanel')}</Button>
    : role === 'buyer' ? <Button variant="gold" size="xl" className={ctaCls} iconRight={ArrowRight} onClick={() => setConvert(true)}>{t('home.listerPage.start')}</Button>
    : role ? null : <Button variant="gold" size="xl" className={ctaCls} iconRight={ArrowRight} to="/register?as=lister">{t('home.listerPage.start')}</Button>;
  const faq = faqFrom(faqPage.data) || DEFAULT_FAQ.map((k) => ({ q: t(`home.listerPage.faq.${k}.q`), a: t(`home.listerPage.faq.${k}.a`) }));
  const stats = [['₹0', 'pages.lister.stats.fee'], ['100%', 'pages.lister.stats.verified'], ['0', 'pages.lister.stats.brokers']];
  const rates = [
    c.sale && c.sale.min != null && t('home.listerPage.saleFrom', { pct: c.sale.min }),
    c.rent && c.rent.min != null && (c.rent.basisMonths ? t('home.listerPage.rentFromBasis', { pct: c.rent.min, count: c.rent.basisMonths }) : t('home.listerPage.rentFrom', { pct: c.rent.min })),
  ].filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy-950">
        <img src={IMG('villa-white')} alt="" aria-hidden fetchpriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_center]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/20" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-navy-950/80 to-transparent" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:pb-16 lg:pt-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-gold-200 backdrop-blur">
              <BadgeCheck className="h-4 w-4 text-gold-400" aria-hidden /> {t('home.lister.eyebrow')}
            </p>
            <h1 className="mt-6 font-display text-[2.4rem] font-medium leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">{t('home.listerPage.title')}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-100/90">{t('home.listerPage.subtitle')}</p>
            <div className="mt-10 flex flex-wrap gap-3">{cta}<Button size="xl" variant="glass" className="!rounded-full" to="/p/no-broker-policy">{t('home.listerPage.policy')}</Button></div>
          </div>
          <dl className="mt-14 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md">
            {stats.map(([v, k]) => (
              <div key={k} className="bg-navy-950/40 px-4 py-5 sm:px-6">
                <dt className="sr-only">{t(k)}</dt>
                <dd className="font-display text-3xl font-medium text-white">{v}</dd>
                <dd className="mt-1 text-[11px] uppercase leading-snug tracking-[0.14em] text-navy-300 sm:text-xs">{t(k)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Value propositions */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Title eyebrow={t('pages.lister.propsEyebrow')} title={t('pages.lister.propsTitle')} text={t('home.listerPage.meta.description')} />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROPS.map(([k, b, Icon]) => (
            <li key={k} className="group rounded-2xl bg-white p-6 shadow-card ring-1 ring-navy-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><Icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-5 font-display text-xl font-medium text-navy-900">{t(`pages.lister.props.${k}`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">{t(`home.lister.${b}`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Who it is for */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <Title eyebrow={t('pages.lister.kindsEyebrow')} title={t('pages.lister.kindsTitle')} />
          <div className="grid auto-rows-[260px] gap-4 sm:grid-cols-3 lg:auto-rows-[340px]">
            {LISTER_KINDS.map(([k, Icon, img]) => (
              <div key={k} className="group relative isolate overflow-hidden rounded-3xl">
                <img src={IMG(img)} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]" />
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/85 via-navy-950/25 to-transparent" aria-hidden />
                <div className="flex h-full flex-col justify-end p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-gold-300 backdrop-blur"><Icon className="h-5 w-5" aria-hidden /></span>
                  <p className="mt-4 font-display text-2xl font-medium text-white">{t(`home.listerKinds.${k}.title`)}</p>
                  <p className="mt-1 text-sm text-navy-100/90">{t(`home.listerKinds.${k}.text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Title center eyebrow={t('home.sections.howEyebrow')} title={t('home.listerPage.howTitle')} />
        <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          <span className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-gradient-to-r from-gold-200 via-gold-400 to-gold-200 lg:block" aria-hidden />
          {STEPS.map((s, i) => (
            <li key={s.key} className="relative text-center">
              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-gold-300 shadow-card ring-8 ring-sand-50"><s.icon className="h-6 w-6" aria-hidden /></span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">{t('home.sections.step', { n: i + 1 })}</p>
              <h3 className="mt-2 font-display text-xl font-medium text-navy-900">{t(`home.listerPage.steps.${s.key}.title`)}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-navy-500">{t(`home.listerPage.steps.${s.key}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Commission */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-navy-900">
          <img src={IMG('living-warm')} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-950 via-navy-900/95 to-navy-900/70" aria-hidden />
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:p-14">
            <div>
              <Title light eyebrow={t('home.listerPage.commissionEyebrow')} title={t('home.listerPage.commissionTitle')} text={t('home.listerPage.commissionText')} />
              {rates.length > 0 && (
                <ul className="-mt-4 flex flex-wrap gap-2">
                  {rates.map((r) => (
                    <li key={r} className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-white/5 px-4 py-2 text-sm text-navy-100">
                      <FileSignature className="h-4 w-4 text-gold-400" aria-hidden />{r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ol className="space-y-4 self-center">
              {FLOW.map(([k, Icon], i) => (
                <li key={k} className="flex gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <span className="font-display text-3xl font-medium leading-none text-gold-400">0{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-lg font-semibold text-white"><Icon className="h-4 w-4 text-gold-300" aria-hidden />{t(`pages.lister.flow.${k}.title`)}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-navy-200">{t(`pages.lister.flow.${k}.text`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
          <Title center eyebrow={t('home.listerPage.faqEyebrow')} title={t('home.listerPage.faqTitle')} />
          <Accordion items={faq} />
        </div>
      </section>

      {/* Closing call to action */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] bg-white p-8 shadow-card ring-1 ring-navy-900/5 sm:p-12 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-medium leading-tight text-navy-900 sm:text-4xl">{t('pages.lister.final.title')}</h2>
            <p className="mt-3 leading-relaxed text-navy-500">{t('pages.lister.final.text')}</p>
          </div>
          <div className="flex flex-wrap gap-3">{cta}<Button size="xl" variant="outline" className="!rounded-full" to="/contact">{t('account.contact.title')}</Button></div>
        </div>
      </section>
      <BecomeLister open={convert} onClose={() => setConvert(false)} />
    </>
  );
}
