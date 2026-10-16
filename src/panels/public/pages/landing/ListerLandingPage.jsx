// RE-S-PUB-14 list your property (lister landing): value proposition, how it
// works, no-broker policy, commission explanation (minimum % from settings),
// lister FAQ from the CMS and "Start listing". A signed-in buyer can convert
// to a lister here (POST /me/become-lister, then a fresh login).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Building2, ClipboardCheck, FileSignature, Handshake, Home, ShieldCheck, Store, UserPlus } from 'lucide-react';
import { Accordion, Alert, Button, Card, Input, Modal, Select } from '@/shared/ui';
import { api } from '@/shared/lib/api';
import { useAuth } from '@/modules/auth';
import { usePage } from '@/modules/cms/api';
import { usePublicSettings } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { SectionTitle } from '../../components/States';

const STEPS = [
  { icon: UserPlus, key: 'register' },
  { icon: ShieldCheck, key: 'kyc' },
  { icon: ClipboardCheck, key: 'add' },
  { icon: BadgeCheck, key: 'approval' },
  { icon: Handshake, key: 'sell' },
];

const DEFAULT_FAQ = ['q1', 'q2', 'q3'];

// Owner / builder / landlord tiles: [key under home.listerKinds, icon].
const LISTER_KINDS = [['owners', Home], ['builders', Building2], ['landlords', Store]];

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
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} onClick={submit}>{t('home.listerPage.become.submit')}</Button></>}>
      <div className="space-y-4">
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
  const cta = role === 'lister' ? <Button size="lg" to="/lister">{t('home.listerPage.goPanel')}</Button>
    : role === 'buyer' ? <Button size="lg" onClick={() => setConvert(true)}>{t('home.listerPage.start')}</Button>
    : role ? null : <Button size="lg" to="/register?as=lister">{t('home.listerPage.start')}</Button>;
  const faq = faqFrom(faqPage.data) || DEFAULT_FAQ.map((k) => ({ q: t(`home.listerPage.faq.${k}.q`), a: t(`home.listerPage.faq.${k}.a`) }));

  return (
    <>
      <section className="bg-brand-700">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-300">{t('home.lister.eyebrow')}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold text-white sm:text-5xl">{t('home.listerPage.title')}</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">{t('home.listerPage.subtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">{cta}<Button size="lg" variant="secondary" to="/p/no-broker-policy">{t('home.listerPage.policy')}</Button></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle eyebrow={t('home.sections.howEyebrow')} title={t('home.listerPage.howTitle')} />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.key}><Card className="h-full"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white"><s.icon className="h-5 w-5" aria-hidden /></span><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t('home.sections.step', { n: i + 1 })}</p><p className="font-semibold text-ink">{t(`home.listerPage.steps.${s.key}.title`)}</p><p className="mt-1 text-sm text-ink-muted">{t(`home.listerPage.steps.${s.key}.text`)}</p></Card></li>
          ))}
        </ol>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow={t('home.listerPage.commissionEyebrow')} title={t('home.listerPage.commissionTitle')} />
            <p className="text-ink-muted">{t('home.listerPage.commissionText')}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {c.sale && c.sale.min != null && <li className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-brand-600" aria-hidden />{t('home.listerPage.saleFrom', { pct: c.sale.min })}</li>}
              {c.rent && c.rent.min != null && <li className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-brand-600" aria-hidden />{c.rent.basisMonths ? t('home.listerPage.rentFromBasis', { pct: c.rent.min, count: c.rent.basisMonths }) : t('home.listerPage.rentFrom', { pct: c.rent.min })}</li>}
            </ul>
          </div>
          <div className="grid gap-3">
            {LISTER_KINDS.map(([k, Icon]) => (
              <div key={k} className="flex items-center gap-4 rounded-lg border bg-surface-muted p-4"><span className="rounded-md bg-brand-600 p-2.5 text-white"><Icon className="h-5 w-5" aria-hidden /></span><span><span className="block font-semibold text-ink">{t(`home.listerKinds.${k}.title`)}</span><span className="block text-sm text-ink-subtle">{t(`home.listerKinds.${k}.text`)}</span></span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <SectionTitle eyebrow={t('home.listerPage.faqEyebrow')} title={t('home.listerPage.faqTitle')} />
        <Accordion items={faq} />
        <div className="mt-8 flex justify-center">{cta}</div>
      </section>
      <BecomeLister open={convert} onClose={() => setConvert(false)} />
    </>
  );
}
