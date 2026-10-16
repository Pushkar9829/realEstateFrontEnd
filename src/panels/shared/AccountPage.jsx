import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/shared/ui';
import { AccountSettings, useAuth } from '@/modules/auth';
import AgentAvailability from './AgentAvailability';

// Account and security page, mounted in every panel (and /account for buyers).
// In the agent panel it also holds availability and leave (RE-S-AGT-16).
export default function AccountPage() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const showAvailability = pathname.startsWith('/agent') && ['agent', 'manager'].includes(user.role);
  return (
    <>
      <PageHeader title={showAvailability ? 'Profile and availability' : 'Account and security'}
        description={showAvailability ? 'Availability for new leads, leave, profile, password and signed-in devices.' : 'Profile, password, two-step verification, notifications and privacy.'} />
      {showAvailability && <div className="mb-6"><AgentAvailability /></div>}
      <AccountSettings />
    </>
  );
}
