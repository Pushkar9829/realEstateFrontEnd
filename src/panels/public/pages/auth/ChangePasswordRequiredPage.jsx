// RE-M-08 staff first login: the API only allows /me, password change and
// logout until the temporary password is replaced.
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, PasswordInput } from '@/shared/ui';
import { authApi, changePasswordSchema, useApiForm, useAuth } from '@/modules/auth';
import { useToast } from '@/shared/ui';

export default function ChangePasswordRequiredPage() {
  const { refreshUser, home, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const f = useApiForm(changePasswordSchema, { defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const onSubmit = f.submit(async (v) => {
    await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
    const me = await refreshUser();
    toast.success('Password updated');
    navigate(me ? home : '/', { replace: true });
  });
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-ink">Set a new password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-subtle">Your account was created with a temporary password. Choose your own to continue.</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
        <PasswordInput label="Temporary password" autoComplete="current-password" error={f.errorOf('currentPassword')} {...f.register('currentPassword')} />
        <PasswordInput label="New password" autoComplete="new-password" hint="8+ characters, a letter and a digit" error={f.errorOf('newPassword')} {...f.register('newPassword')} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
        <Button type="submit" block size="lg" loading={f.formState.isSubmitting}>Save and continue</Button>
        <Button variant="ghost" block onClick={logout}>Log out</Button>
      </form>
    </Card>
  );
}
