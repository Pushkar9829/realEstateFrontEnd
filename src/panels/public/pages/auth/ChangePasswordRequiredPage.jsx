// RE-M-08 staff first login: the API only allows /me, password change and
// logout until the temporary password is replaced.
import { useNavigate } from 'react-router-dom';
import { Alert, Button, PasswordInput } from '@/shared/ui';
import { authApi, changePasswordSchema, useApiForm, useAuth } from '@/modules/auth';
import { useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { AuthCard, AuthTitle } from './AuthCard';

export default function ChangePasswordRequiredPage() {
  const { refreshUser, home, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const f = useApiForm(changePasswordSchema, { defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const onSubmit = f.submit(async (v) => {
    await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
    const me = await refreshUser();
    toast.success(t('auth.change.updated'));
    navigate(me ? home : '/', { replace: true });
  });
  return (
    <AuthCard>
      <AuthTitle title={t('auth.change.title')} subtitle={t('auth.change.subtitle')} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
        <PasswordInput label={t('auth.change.temporary')} autoComplete="current-password" error={f.errorOf('currentPassword')} {...f.register('currentPassword')} />
        <PasswordInput label={t('auth.newPassword')} autoComplete="new-password" hint={t('auth.passwordHint')} error={f.errorOf('newPassword')} {...f.register('newPassword')} />
        <PasswordInput label={t('auth.confirmNewPassword')} autoComplete="new-password" error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
        <Button type="submit" variant="gold" block size="lg" className="!rounded-full font-semibold" loading={f.formState.isSubmitting}>{t('auth.change.save')}</Button>
        <Button variant="outline" block size="lg" className="!rounded-full" onClick={logout}>{t('auth.change.logout')}</Button>
      </form>
    </AuthCard>
  );
}
