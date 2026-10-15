// RE-M-01 verify email (always) and Indian mobile by OTP. When both are
// done the API activates the account and starts the first session.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, MessageSquare } from 'lucide-react';
import { Alert, Badge, Button, Card, OtpInput, Stepper } from '@/shared/ui';
import { authApi, useAuth } from '@/modules/auth';

function Channel({ channel, label, target, done, token, onDone }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const Icon = channel === 'email' ? Mail : MessageSquare;

  const verify = async () => {
    setError(null);
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setBusy(true);
    try { onDone(await authApi.verifyContact({ verificationToken: token, channel, code })); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const resend = async () => {
    setError(null);
    try { const r = await authApi.resendOtp({ verificationToken: token, channel }); setNotice(`New code sent to ${r.sentTo}`); } catch (e) { setError(e.message); }
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-brand-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">{label}</p>
            {target && <p className="text-xs text-ink-subtle">{target}</p>}
          </div>
        </div>
        {done && <Badge tone="success" icon={CheckCircle2}>Verified</Badge>}
      </div>
      {!done && (
        <div className="space-y-3">
          {notice && <Alert tone="success">{notice}</Alert>}
          <OtpInput value={code} onChange={setCode} error={error} autoSubmit />
          <div className="flex gap-2">
            <Button onClick={verify} loading={busy}>Verify</Button>
            <Button variant="ghost" onClick={resend}>Resend code</Button>
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
    <Card className="p-6 sm:p-8">
      <div className="mb-5"><Stepper steps={[{ label: 'Your details' }, { label: 'Verify' }, { label: 'Start' }]} current={1} /></div>
      <h1 className="text-2xl font-semibold text-ink">Verify your contact details</h1>
      <p className="mb-6 mt-1 text-sm text-ink-subtle">We sent a code to your email{smsNeeded ? ' and mobile' : ''}. Your account opens as soon as both are verified.</p>
      <div className="space-y-3">
        <Channel channel="email" label="Email" target={state.pending && state.pending.email} done={status.emailVerified} token={state.verificationToken} onDone={onDone} />
        {smsNeeded && <Channel channel="sms" label="Mobile number" target={state.pending && state.pending.phone} done={status.phoneVerified} token={state.verificationToken} onDone={onDone} />}
      </div>
    </Card>
  );
}
