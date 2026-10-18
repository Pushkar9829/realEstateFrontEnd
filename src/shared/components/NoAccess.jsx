// Shown instead of a silent redirect when a staff user opens a screen their
// permissions do not cover (audit D5), so a shared deep link explains itself.
import { ShieldOff } from 'lucide-react';
import { Button, EmptyState } from '@/shared/ui';
import { useT } from '@/shared/i18n';

export default function NoAccess({ permission, home = '/admin' }) {
  const t = useT();
  return (
    <EmptyState icon={ShieldOff} title={t('panel.noAccess.title', { screen: t('panel.noAccess.thisScreen') })}
      description={t('panel.noAccess.text', { perm: permission })}
      action={<Button variant="secondary" to={home}>{t('panel.noAccess.back')}</Button>} />
  );
}
