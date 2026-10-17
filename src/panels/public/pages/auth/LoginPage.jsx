// RE-M-02/03 two-step login: password, then a code by email / SMS or the
// authenticator app (or a recovery code).
import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Alert, Button, Input, OtpInput, PasswordInput } from '@/shared/ui';
import { authApi, loginSchema, useApiForm, useAuth } from '@/modules/auth';
import { useT } from '@/shared/i18n';
import { AuthCard, AuthTitle, authLink } from './AuthCard';

// Demo logins are loaded only in development builds.
// Demo logins: always in development; in a production build only when
// VITE_SHOW_DEMO_LOGINS=true (a demo / client-preview deployment).
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';
const DemoAccounts = SHOW_DEMO ? lazy(() => import('./DemoAccounts')) : null;

const METHOD = {
  email: { icon: Mail, label: 'auth.twoFa.method.email' },
  sms: { icon: MessageSquare, label: 'auth.twoFa.method.sms' },
  totp: { icon: Smartphone, label: 'auth.twoFa.method.totp' },
};

function PasswordStep({ onChallenge, formRef }) {
  const navigate = useNavigate();
  const t = useT();
  const f = useApiForm(loginSchema, { defaultValues: { identifier: '', password: '' } });
  if (formRef) formRef.current = f;
  const onSubmit = f.submit(async (values) => {
    try {
      const res = await authApi.login(values);
      onChallenge({ ...res, credentials: values });
    } catch (e) {
      if (e.code === 'CONTACT_NOT_VERIFIED' && e.details && e.details.verificationToken) {
        navigate('/verify', { state: { ...e.details, fromLogin: true } });
        return;
      }
      throw e;
    }
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
      <Input label={t('auth.identifier')} autoComplete="username" autoFocus error={f.errorOf('identifier')} {...f.register('identifier')} />
      <PasswordInput label={t('auth.password')} autoComplete="current-password" error={f.errorOf('password')} {...f.register('password')} />
      <div className="flex justify-end text-sm"><Link to="/forgot-password" className="font-medium text-navy-600 underline-offset-4 transition-colors hover:text-gold-700 hover:underline">{t('auth.login.forgot')}</Link></div>
      <Button type="submit" variant="gold" block size="lg" className="!rounded-full font-semibold" loading={f.formState.isSubmitting}>{t('auth.login.continue')}</Button>
    </form>
  );
}

function CodeStep({ challenge, setChallenge, onBack }) {
  const { startSession } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const verify = async (e) => {
    e && e.preventDefault();
    setError(null);
    if (!recovery && code.length !== 6) { setError(t('auth.enterCode')); return; }
    setBusy(true);
    try {
      const res = await authApi.verify2fa({ challengeToken: challenge.challengeToken, ...(recovery ? { recoveryCode: recoveryCode.trim() } : { code }) });
      const s = await startSession(res);
      if (s.mustChangePassword) navigate('/account/change-password', { replace: true });
      else navigate((location.state && location.state.from) || s.home, { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.code === 'TOKEN_INVALID') onBack();
    } finally {
      setBusy(false);
    }
  };

  // Switch channel: email/SMS re-issue a code; TOTP needs a fresh login challenge.
  const switchTo = async (m) => {
    setError(null); setNotice(null); setCode('');
    try {
      const res = m === 'totp'
        ? await authApi.login({ ...challenge.credentials, channel: 'totp' })
        : await authApi.resendOtp({ challengeToken: challenge.challengeToken, channel: m });
      setChallenge({ ...challenge, ...res, method: res.method || res.channel });
      if (m !== 'totp') setNotice(t('auth.twoFa.newCodeSent', { to: res.sentTo }));
    } catch (err) { setError(err.message); }
  };

  const method = challenge.method;
  return (
    <form onSubmit={verify} className="space-y-5" noValidate>
      <div className="rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-700 ring-1 ring-inset ring-navy-900/5">
        {method === 'totp' ? t('auth.twoFa.totpPrompt') : t('auth.twoFa.sentPrompt', { to: challenge.sentTo })}
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {recovery ? (
        <Input label={t('auth.twoFa.recoveryCode')} placeholder="ABCD-1234" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} error={error} autoFocus />
      ) : (
        <OtpInput value={code} onChange={setCode} error={error} autoFocus autoSubmit />
      )}
      <Button type="submit" variant="gold" block size="lg" className="!rounded-full font-semibold" loading={busy}>{t('auth.twoFa.verifySignIn')}</Button>

      <div className="space-y-3 border-t border-navy-900/10 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400">{t('auth.twoFa.otherWays')}</p>
        <div className="flex flex-wrap gap-2">
          {(challenge.methods || []).filter((m) => m !== method).map((m) => {
            const M = METHOD[m];
            return <Button key={m} variant="outline" size="sm" className="!rounded-full" icon={M.icon} onClick={() => switchTo(m)}>{t(M.label)}</Button>;
          })}
          {method !== 'totp' && <Button variant="outline" size="sm" className="!rounded-full" onClick={() => switchTo(method)}>{t('auth.resendCode')}</Button>}
          {method === 'totp' && (
            <Button variant="outline" size="sm" className="!rounded-full" icon={KeyRound} onClick={() => { setRecovery((r) => !r); setError(null); }}>
              {recovery ? t('auth.twoFa.useAuthenticator') : t('auth.twoFa.useRecovery')}
            </Button>
          )}
        </div>
        <button type="button" onClick={onBack} className={`text-sm ${authLink}`}>{t('auth.twoFa.backToPassword')}</button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  const t = useT();
  const [challenge, setChallenge] = useState(null);
  const formRef = useRef(null);
  const pick = (email, password) => {
    const f = formRef.current;
    if (!f) return;
    f.setValue('identifier', email, { shouldValidate: true });
    f.setValue('password', password, { shouldValidate: true });
    f.setFocus('password');
  };
  return (
    <AuthCard>
      <AuthTitle title={challenge ? t('auth.twoFa.title') : t('auth.login.title')} subtitle={challenge ? t('auth.twoFa.subtitle') : t('auth.login.subtitle')} />
      {challenge
        ? <CodeStep challenge={challenge} setChallenge={setChallenge} onBack={() => setChallenge(null)} />
        : <PasswordStep onChallenge={setChallenge} formRef={formRef} />}
      {!challenge && <p className="mt-7 border-t border-navy-900/10 pt-6 text-center text-sm text-navy-500">{t('auth.login.newHere')} <Link to="/register" className={authLink}>{t('auth.login.createAccount')}</Link></p>}
      {!challenge && DemoAccounts && <Suspense fallback={null}><DemoAccounts onPick={pick} /></Suspense>}
    </AuthCard>
  );
}
