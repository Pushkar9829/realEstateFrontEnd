// RE-M-01 registration as a buyer or a lister (owner, builder, landlord).
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Home, KeyRound, Search } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Button, Card, Checkbox, Input, PasswordInput, Stepper } from '@/shared/ui';
import { authApi, PasswordStrength, registerSchema, useApiForm } from '@/modules/auth';
import { usePublicSettings } from '@/modules/search/api';
import { captureReferral, referralCode } from '@/modules/search/prefs';

const SIGNUP_STEPS = [{ label: 'Your details' }, { label: 'Verify' }, { label: 'Start' }];

const LISTER_TYPES = [
  { value: 'owner', label: 'Owner', icon: Home, hint: 'Selling your own property' },
  { value: 'builder', label: 'Builder', icon: Building2, hint: 'Projects and units' },
  { value: 'landlord', label: 'Landlord', icon: KeyRound, hint: 'Renting out property' },
];

function Choice({ active, onClick, icon: Icon, title, hint }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('flex flex-1 flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-line-strong bg-white hover:bg-surface-muted')}>
      <Icon className={cn('h-5 w-5', active ? 'text-brand-600' : 'text-ink-subtle')} aria-hidden />
      <span className="text-sm font-semibold text-ink">{title}</span>
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </button>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const settings = usePublicSettings();
  const refDays = (settings.data && settings.data.referral && settings.data.referral.captureDays) || 30;
  // RE-N-01: a ?ref=CODE landing on this page is captured like any public URL; the code prefills the field.
  useEffect(() => { captureReferral(params.toString(), refDays); }, [params, refDays]);
  const f = useApiForm(registerSchema, {
    defaultValues: {
      role: params.get('as') === 'lister' ? 'lister' : 'buyer', listerType: undefined, name: '', email: '', phone: '', password: '', confirmPassword: '',
      companyName: '', referralCode: params.get('ref') || referralCode(), acceptTerms: false, noBrokerDeclaration: false, marketingOptIn: false,
    },
  });
  const role = f.watch('role');
  const listerType = f.watch('listerType');
  const pw = f.watch('password');

  const onSubmit = f.submit(async (v) => {
    const body = { ...v, listerType: v.role === 'lister' ? v.listerType : undefined, companyName: v.listerType === 'builder' ? v.companyName : undefined, noBrokerDeclaration: v.role === 'lister' ? v.noBrokerDeclaration : undefined };
    const res = await authApi.register(body);
    navigate('/verify', { state: { verificationToken: res.verificationToken, pending: res.pending, phoneVerification: res.phoneVerification } });
  });

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-5"><Stepper steps={SIGNUP_STEPS} current={0} /></div>
      <h1 className="text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-ink-subtle">Free for buyers, tenants, owners, builders and landlords.</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">I want to</p>
          <div className="flex gap-2">
            <Choice active={role === 'buyer'} onClick={() => f.setValue('role', 'buyer')} icon={Search} title="Buy or rent" hint="Find verified properties" />
            <Choice active={role === 'lister'} onClick={() => f.setValue('role', 'lister')} icon={Home} title="List property" hint="Sell or rent out directly" />
          </div>
        </div>
        {role === 'lister' && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">I am a</p>
            <div className="grid grid-cols-3 gap-2">
              {LISTER_TYPES.map((t) => <Choice key={t.value} active={listerType === t.value} onClick={() => f.setValue('listerType', t.value, { shouldValidate: true })} icon={t.icon} title={t.label} hint={t.hint} />)}
            </div>
            {f.errorOf('listerType') && <p className="mt-1 text-xs text-danger-600">{f.errorOf('listerType')}</p>}
          </div>
        )}
        <Input label="Full name" autoComplete="name" required error={f.errorOf('name')} {...f.register('name')} />
        {listerType === 'builder' && role === 'lister' && <Input label="Company name" required error={f.errorOf('companyName')} {...f.register('companyName')} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" autoComplete="email" required error={f.errorOf('email')} {...f.register('email')} />
          <Input label="Mobile number" type="tel" autoComplete="tel" required placeholder="98765 43210" hint="Indian mobile, or +country code" error={f.errorOf('phone')} {...f.register('phone')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <PasswordInput autoComplete="new-password" required hint={pw ? undefined : '8+ characters, a letter and a digit'} error={f.errorOf('password')} {...f.register('password')} />
            <PasswordStrength value={pw} />
          </div>
          <PasswordInput label="Confirm password" autoComplete="new-password" required error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
        </div>
        <Input label="Referral code (optional)" error={f.errorOf('referralCode')} {...f.register('referralCode')} />
        <div className="space-y-3 rounded-md bg-surface-muted p-3">
          {role === 'lister' && <Checkbox label="I am not a broker or property agent" description="Brokers cannot list on this platform. Accounts found brokering are banned." error={f.errorOf('noBrokerDeclaration')} {...f.register('noBrokerDeclaration')} />}
          <Checkbox label={<>I accept the <Link to="/p/terms" className="text-brand-600 underline">terms</Link> and <Link to="/p/privacy" className="text-brand-600 underline">privacy notice</Link></>} error={f.errorOf('acceptTerms')} {...f.register('acceptTerms')} />
          <Checkbox label="Send me property alerts and offers" {...f.register('marketingOptIn')} />
        </div>
        <Button type="submit" block size="lg" loading={f.formState.isSubmitting}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-subtle">Already registered? <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Log in</Link></p>
    </Card>
  );
}
