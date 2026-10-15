import { PageHeader } from '@/shared/ui';
import { AccountSettings } from '@/modules/auth';

// Account and security page, mounted in every panel (and /account for buyers).
export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account and security" description="Profile, password, two-step verification and signed-in devices." />
      <AccountSettings />
    </>
  );
}
