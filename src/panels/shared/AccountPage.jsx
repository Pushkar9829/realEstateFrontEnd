import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/shared/ui';
import { useT, withNamespaces } from '@/shared/i18n';
import { useAuth } from '@/modules/auth';
import AccountSettings from '@/modules/auth/components/AccountSettings';
import AgentAvailability from './AgentAvailability';

// Account and security page, mounted in every panel (and /account for buyers).
// In the agent panel it also holds availability and leave (RE-S-AGT-16).
function AccountPage() {
  const t = useT();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const showAvailability = pathname.startsWith('/agent') && ['agent', 'manager'].includes(user.role);
  return (
    <>
      <PageHeader title={showAvailability ? t('panel.account.titleAgent') : t('panel.account.title')}
        description={showAvailability ? t('panel.account.descAgent') : t('panel.account.desc')} />
      {showAvailability && <div className="mb-6"><AgentAvailability /></div>}
      <AccountSettings />
    </>
  );
}

export default withNamespaces(['panel'], AccountPage);
