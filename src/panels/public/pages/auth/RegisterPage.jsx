// RE-M-01 registration as a buyer or a lister (owner, builder, landlord).
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Home, KeyRound, Search } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Button, Card, Checkbox, Input, PasswordInput, Stepper } from '@/shared/ui';
import { authApi, PasswordStrength, registerSchema, useApiForm } from '@/modules/auth';
import { usePublicSettings } from '@/modules/search/api';
import { captureReferral, referralCode } from '@/modules/search/prefs';
import { useT } from '@/shared/i18n';

const SIGNUP_STEPS = ['auth.steps.details', 'auth.steps.verify', 'auth.steps.start'];

const LISTER_TYPES = [
  { value: 'owner', label: 'auth.register.lister.owner', icon: Home, hint: 'auth.register.lister.ownerHint' },
  { value: 'builder', label: 'auth.register.lister.builder', icon: Building2, hint: 'auth.register.lister.builderHint' },
  { value: 'landlord', label: 'auth.register.lister.landlord', icon: KeyRound, hint: 'auth.register.lister.landlordHint' },
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
  const t = useT();
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
      <div className="mb-5"><Stepper steps={SIGNUP_STEPS.map((k) => ({ label: t(k) }))} current={0} /></div>
      <h1 className="text-2xl font-semibold text-ink">{t('auth.register.title')}</h1>
      <p className="mb-6 mt-1 text-sm text-ink-subtle">{t('auth.register.subtitle')}</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t('auth.register.iWantTo')}</p>
          <div className="flex gap-2">
            <Choice active={role === 'buyer'} onClick={() => f.setValue('role', 'buyer')} icon={Search} title={t('auth.register.buyOrRent')} hint={t('auth.register.buyOrRentHint')} />
            <Choice active={role === 'lister'} onClick={() => f.setValue('role', 'lister')} icon={Home} title={t('auth.register.listProperty')} hint={t('auth.register.listPropertyHint')} />
          </div>
        </div>
        {role === 'lister' && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t('auth.register.iAmA')}</p>
            <div className="grid grid-cols-3 gap-2">
              {LISTER_TYPES.map((lt) => <Choice key={lt.value} active={listerType === lt.value} onClick={() => f.setValue('listerType', lt.value, { shouldValidate: true })} icon={lt.icon} title={t(lt.label)} hint={t(lt.hint)} />)}
            </div>
            {f.errorOf('listerType') && <p className="mt-1 text-xs text-danger-600">{f.errorOf('listerType')}</p>}
          </div>
        )}
        <Input label={t('auth.register.fullName')} autoComplete="name" required error={f.errorOf('name')} {...f.register('name')} />
        {listerType === 'builder' && role === 'lister' && <Input label={t('auth.register.companyName')} required error={f.errorOf('companyName')} {...f.register('companyName')} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('auth.register.email')} type="email" autoComplete="email" required error={f.errorOf('email')} {...f.register('email')} />
          <Input label={t('auth.register.mobile')} type="tel" autoComplete="tel" required placeholder="98765 43210" hint={t('auth.register.mobileHint')} error={f.errorOf('phone')} {...f.register('phone')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <PasswordInput label={t('auth.password')} autoComplete="new-password" required hint={pw ? undefined : t('auth.passwordHint')} error={f.errorOf('password')} {...f.register('password')} />
            <PasswordStrength value={pw} />
          </div>
          <PasswordInput label={t('auth.register.confirmPassword')} autoComplete="new-password" required error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
        </div>
        <Input label={t('auth.register.referral')} error={f.errorOf('referralCode')} {...f.register('referralCode')} />
        <div className="space-y-3 rounded-md bg-surface-muted p-3">
          {role === 'lister' && <Checkbox label={t('auth.register.noBroker')} description={t('auth.register.noBrokerHint')} error={f.errorOf('noBrokerDeclaration')} {...f.register('noBrokerDeclaration')} />}
          <Checkbox label={<>{t('auth.register.termsBefore')}<Link to="/p/terms" className="text-brand-600 underline">{t('auth.register.terms')}</Link>{t('auth.register.termsAnd')}<Link to="/p/privacy" className="text-brand-600 underline">{t('auth.register.privacy')}</Link>{t('auth.register.termsAfter')}</>} error={f.errorOf('acceptTerms')} {...f.register('acceptTerms')} />
          <Checkbox label={t('auth.register.marketing')} {...f.register('marketingOptIn')} />
        </div>
        <Button type="submit" block size="lg" loading={f.formState.isSubmitting}>{t('auth.register.submit')}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-subtle">{t('auth.register.already')} <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">{t('auth.register.login')}</Link></p>
    </Card>
  );
}
