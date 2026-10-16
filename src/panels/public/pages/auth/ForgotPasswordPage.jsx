// RE-M-05 password reset by OTP. The API never reveals whether an account
// exists, so the second step is shown either way.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, OtpInput, PasswordInput } from '@/shared/ui';
import { authApi, forgotSchema, resetSchema, useApiForm } from '@/modules/auth';
import { useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { AuthCard, AuthTitle, authLink } from './AuthCard';

function Request({ onSent }) {
  const t = useT();
  const f = useApiForm(forgotSchema, { defaultValues: { identifier: '' } });
  const onSubmit = f.submit(async (v) => { await authApi.forgot(v); onSent(v.identifier); });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
      <Input label={t('auth.identifier')} autoFocus error={f.errorOf('identifier')} {...f.register('identifier')} />
      <Button type="submit" variant="gold" block size="lg" className="!rounded-full font-semibold" loading={f.formState.isSubmitting}>{t('auth.forgot.sendCode')}</Button>
    </form>
  );
}

function Reset({ identifier }) {
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const f = useApiForm(resetSchema, { defaultValues: { code: '', newPassword: '', confirmPassword: '' } });
  const code = f.watch('code');
  const onSubmit = f.submit(async (v) => {
    await authApi.reset({ identifier, code: v.code, newPassword: v.newPassword });
    toast.success(t('auth.forgot.changed'));
    navigate('/login', { replace: true });
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert tone="info">{t('auth.forgot.sentInfo', { identifier })}</Alert>
      {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
      <div>
        <p className="mb-2 text-sm font-medium text-navy-800">{t('auth.forgot.resetCode')}</p>
        <OtpInput value={code} onChange={(v) => f.setValue('code', v, { shouldValidate: f.formState.isSubmitted })} error={f.errorOf('code')} autoFocus />
      </div>
      <PasswordInput label={t('auth.newPassword')} autoComplete="new-password" hint={t('auth.passwordHint')} error={f.errorOf('newPassword')} {...f.register('newPassword')} />
      <PasswordInput label={t('auth.confirmNewPassword')} autoComplete="new-password" error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
      <Button type="submit" variant="gold" block size="lg" className="!rounded-full font-semibold" loading={f.formState.isSubmitting}>{t('auth.forgot.changePassword')}</Button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  const t = useT();
  const [identifier, setIdentifier] = useState(null);
  return (
    <AuthCard>
      <AuthTitle title={t('auth.forgot.title')} subtitle={identifier ? t('auth.forgot.subtitleReset') : t('auth.forgot.subtitleRequest')} />
      {identifier ? <Reset identifier={identifier} /> : <Request onSent={setIdentifier} />}
      <p className="mt-7 border-t border-navy-900/10 pt-6 text-center text-sm"><Link to="/login" className={authLink}>{t('auth.backToLogin')}</Link></p>
    </AuthCard>
  );
}
