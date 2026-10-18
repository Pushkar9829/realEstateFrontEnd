// RE-M-01 verify email (always) and Indian mobile by OTP. When both are
// done the API activates the account and starts the first session.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, MessageSquare } from 'lucide-react';
import { Alert, Badge, Button, OtpInput } from '@/shared/ui';
import { authApi, useAuth } from '@/modules/auth';
import { useT } from '@/shared/i18n';
import { AuthCard, AuthSteps, AuthTitle } from './AuthCard';

function Channel({ channel, label, target, done, token, onDone }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const Icon = channel === 'email' ? Mail : MessageSquare;

  const verify = async () => {
    setError(null);
    if (code.length !== 6) { setError(t('auth.enterCode')); return; }
    setBusy(true);
    try { onDone(await authApi.verifyContact({ verificationToken: token, channel, code })); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const resend = async () => {
    setError(null);
    try { const r = await authApi.resendOtp({ verificationToken: token, channel }); setNotice(t('auth.verify.newCodeSent', { to: r.sentTo })); } catch (e) { setError(e.message); }
  };

  return (
    <div className="rounded-2xl border border-navy-900/10 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><Icon className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy-900">{label}</p>
            {target && <p className="truncate text-xs text-navy-500">{target}</p>}
          </div>
        </div>
        {done && <Badge tone="success" icon={CheckCircle2}>{t('auth.verify.verified')}</Badge>}
      </div>
      {!done && (
        <div className="space-y-3">
          {notice && <Alert tone="success">{notice}</Alert>}
          <OtpInput value={code} onChange={setCode} error={error} autoSubmit />
          <div className="flex gap-2">
            <Button variant="gold" className="!rounded-full px-6 font-semibold" onClick={verify} loading={busy}>{t('auth.verify.verify')}</Button>
            <Button variant="outline" className="!rounded-full" onClick={resend}>{t('auth.resendCode')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyContactPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { startSession } = useAuth();
  const t = useT();
  const [status, setStatus] = useState({ emailVerified: Boolean(state && state.emailVerified), phoneVerified: Boolean(state && state.phoneVerified) });

  if (!state || !state.verificationToken) return <Navigate to="/register" replace />;
  const smsNeeded = state.phoneVerification !== 'not_required';

  const onDone = async (res) => {
    setStatus({ emailVerified: res.emailVerified, phoneVerified: res.phoneVerified });
    if (res.status === 'active' && res.accessToken) {
      const s = await startSession(res);
      navigate(s.home, { replace: true });
    }
  };

  return (
    <AuthCard>
      <AuthSteps steps={[t('auth.steps.details'), t('auth.steps.verify'), t('auth.steps.start')]} current={1} />
      <AuthTitle title={t('auth.verify.title')} subtitle={smsNeeded ? t('auth.verify.subtitleBoth') : t('auth.verify.subtitleEmail')} />
      <div className="space-y-3">
        <Channel channel="email" label={t('auth.verify.email')} target={state.pending && state.pending.email} done={status.emailVerified} token={state.verificationToken} onDone={onDone} />
        {smsNeeded && <Channel channel="sms" label={t('auth.verify.mobile')} target={state.pending && state.pending.phone} done={status.phoneVerified} token={state.verificationToken} onDone={onDone} />}
      </div>
    </AuthCard>
  );
}
