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
import { SectionTitle } from '../../components/States';

const STEPS = [
  { icon: UserPlus, title: 'Register', text: 'Create a free lister account as an owner, builder or landlord.' },
  { icon: ShieldCheck, title: 'Complete KYC', text: 'Verify your ID and sign the no-broker declaration.' },
  { icon: ClipboardCheck, title: 'Add your listing', text: 'Photos, price and ownership proof. Your address and number stay private.' },
  { icon: BadgeCheck, title: 'Approval', text: 'Our team reviews every listing before it goes live.' },
  { icon: Handshake, title: 'We sell for you', text: 'Our sales team handles enquiries, visits and offers.' },
];

const DEFAULT_FAQ = [
  { q: 'Is listing really free?', a: 'Yes. You pay a pre-agreed commission only when a deal with a buyer we introduced is closed and verified.' },
  { q: 'Will buyers call me directly?', a: 'No. Your phone and email are never shown. Our sales team speaks to buyers, arranges visits and relays offers to you.' },
  { q: 'Can brokers list here?', a: 'No. Every lister passes KYC and signs a no-broker declaration. Accounts found brokering are suspended.' },
];

function faqFrom(page) {
  const text = page && page.content;
  if (!text) return null;
  const items = String(text).split(/\n{2,}/).map((block) => { const [q, ...rest] = block.split('\n'); return { q: q.replace(/^Q:\s*/i, '').trim(), a: rest.join(' ').replace(/^A:\s*/i, '').trim() }; }).filter((x) => x.q && x.a);
  return items.length ? items : null;
}

function BecomeLister({ open, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState('owner');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (type === 'builder' && company.trim().length < 2) { setError('Enter your company name'); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/me/become-lister', { listerType: type, ...(type === 'builder' ? { companyName: company.trim() } : {}) });
      await logout();
      navigate('/login', { replace: true, state: { from: '/lister', notice: 'Your account is now a lister account. Log in again to continue.' } });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Switch to a lister account" description="Your enquiries and shortlist stay with your account."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Switch and log in again</Button></>}>
      <div className="space-y-4">
        <Select label="I am" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'owner', label: 'An owner' }, { value: 'builder', label: 'A builder' }, { value: 'landlord', label: 'A landlord' }]} />
        {type === 'builder' && <Input label="Company name" required value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />}
        <Alert tone="warning">You will be logged out of all devices and need to log in again.</Alert>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

export default function ListerLandingPage() {
  const { isAuthed, user } = useAuth();
  const settings = usePublicSettings();
  const faqPage = usePage('lister-faq');
  const [convert, setConvert] = useState(false);
  const c = (settings.data && settings.data.commission) || {};
  const role = isAuthed ? user.role : null;
  const cta = role === 'lister' ? <Button size="lg" to="/lister">Go to my lister panel</Button>
    : role === 'buyer' ? <Button size="lg" onClick={() => setConvert(true)}>Start listing</Button>
    : role ? null : <Button size="lg" to="/register?as=lister">Start listing</Button>;
  const faq = faqFrom(faqPage.data) || DEFAULT_FAQ;

  return (
    <>
      <section className="bg-brand-700">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-300">For owners, builders and landlords</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold text-white sm:text-5xl">List free. Our team sells for you. Pay only when a deal closes.</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">Serious, phone-verified buyers only. No broker calls, and your number is never shown.</p>
          <div className="mt-8 flex flex-wrap gap-3">{cta}<Button size="lg" variant="secondary" to="/p/no-broker-policy">No-broker policy</Button></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle eyebrow="How it works" title="From sign-up to a closed deal" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title}><Card className="h-full"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white"><s.icon className="h-5 w-5" aria-hidden /></span><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Step {i + 1}</p><p className="font-semibold text-ink">{s.title}</p><p className="mt-1 text-sm text-ink-muted">{s.text}</p></Card></li>
          ))}
        </ol>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Commission" title="You pay only on success" />
            <p className="text-ink-muted">You agree a commission percentage when you list. It is charged only after a buyer or tenant introduced by our team closes the deal and our team verifies it.</p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {c.sale && c.sale.min != null && <li className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-brand-600" aria-hidden />Sale: from {c.sale.min}% of the sale price</li>}
              {c.rent && c.rent.min != null && <li className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-brand-600" aria-hidden />Rent: from {c.rent.min}%{c.rent.basisMonths ? ` of ${c.rent.basisMonths} month${c.rent.basisMonths > 1 ? 's' : ''} rent` : ''}</li>}
            </ul>
          </div>
          <div className="grid gap-3">
            {[['Owners', 'Sell or rent your home', Home], ['Builders', 'Projects with RERA details and unit inventory', Building2], ['Landlords', 'Rent out flats, shops and offices', Store]].map(([t, d, Icon]) => (
              <div key={t} className="flex items-center gap-4 rounded-lg border bg-surface-muted p-4"><span className="rounded-md bg-brand-600 p-2.5 text-white"><Icon className="h-5 w-5" aria-hidden /></span><span><span className="block font-semibold text-ink">{t}</span><span className="block text-sm text-ink-subtle">{d}</span></span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <SectionTitle eyebrow="Questions" title="Lister FAQ" />
        <Accordion items={faq} />
        <div className="mt-8 flex justify-center">{cta}</div>
      </section>
      <BecomeLister open={convert} onClose={() => setConvert(false)} />
    </>
  );
}
