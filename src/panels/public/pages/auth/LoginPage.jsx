// RE-M-02/03 two-step login: password, then a code by email / SMS or the
// authenticator app (or a recovery code).
import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Alert, Button, Card, Input, OtpInput, PasswordInput } from '@/shared/ui';
import { authApi, loginSchema, useApiForm, useAuth } from '@/modules/auth';

// Demo logins are loaded only in development builds.
const DemoAccounts = import.meta.env.DEV ? lazy(() => import('./DemoAccounts')) : null;

const METHOD = {
  email: { icon: Mail, label: 'Email code' },
  sms: { icon: MessageSquare, label: 'SMS code' },
  totp: { icon: Smartphone, label: 'Authenticator app' },
};

function PasswordStep({ onChallenge, formRef }) {
  const navigate = useNavigate();
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
      <Input label="Email or mobile number" autoComplete="username" autoFocus error={f.errorOf('identifier')} {...f.register('identifier')} />
      <PasswordInput autoComplete="current-password" error={f.errorOf('password')} {...f.register('password')} />
      <div className="flex justify-end text-sm"><Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">Forgot password?</Link></div>
      <Button type="submit" block size="lg" loading={f.formState.isSubmitting}>Continue</Button>
    </form>
  );
}

function CodeStep({ challenge, setChallenge, onBack }) {
  const { startSession } = useAuth();
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
    if (!recovery && code.length !== 6) { setError('Enter the 6-digit code'); return; }
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
      if (m !== 'totp') setNotice(`A new code was sent to ${res.sentTo}`);
    } catch (err) { setError(err.message); }
  };

  const method = challenge.method;
  return (
    <form onSubmit={verify} className="space-y-5" noValidate>
      <div className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">
        {method === 'totp' ? 'Enter the 6-digit code from your authenticator app.' : `We sent a 6-digit code to ${challenge.sentTo}.`}
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {recovery ? (
        <Input label="Recovery code" placeholder="ABCD-1234" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} error={error} autoFocus />
      ) : (
        <OtpInput value={code} onChange={setCode} error={error} autoFocus autoSubmit />
      )}
      <Button type="submit" block size="lg" loading={busy}>Verify and sign in</Button>

      <div className="space-y-2 border-t pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Other ways to verify</p>
        <div className="flex flex-wrap gap-2">
          {(challenge.methods || []).filter((m) => m !== method).map((m) => {
            const M = METHOD[m];
            return <Button key={m} variant="secondary" size="sm" icon={M.icon} onClick={() => switchTo(m)}>{M.label}</Button>;
          })}
          {method !== 'totp' && <Button variant="secondary" size="sm" onClick={() => switchTo(method)}>Resend code</Button>}
          {method === 'totp' && (
            <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => { setRecovery((r) => !r); setError(null); }}>
              {recovery ? 'Use authenticator code' : 'Use a recovery code'}
            </Button>
          )}
        </div>
        <button type="button" onClick={onBack} className="text-sm font-medium text-brand-600 hover:text-brand-700">Back to password</button>
      </div>
    </form>
  );
}

export default function LoginPage() {
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
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-ink">{challenge ? 'Two-step verification' : 'Log in'}</h1>
      <p className="mb-6 mt-1 text-sm text-ink-subtle">{challenge ? 'One more step to keep your account safe.' : 'Welcome back. Use your email or mobile number.'}</p>
      {challenge
        ? <CodeStep challenge={challenge} setChallenge={setChallenge} onBack={() => setChallenge(null)} />
        : <PasswordStep onChallenge={setChallenge} formRef={formRef} />}
      {!challenge && <p className="mt-6 text-center text-sm text-ink-subtle">New here? <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">Create an account</Link></p>}
      {!challenge && DemoAccounts && <Suspense fallback={null}><DemoAccounts onPick={pick} /></Suspense>}
    </Card>
  );
}
