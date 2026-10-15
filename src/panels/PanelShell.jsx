// Connects the module-agnostic PanelLayout to the signed-in user, and shows
// account banners (lister KYC, suspended account).
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import PanelLayout from '@/shared/layouts/PanelLayout';
import { useToast } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { visibleNav } from './panelNav';

function ListerBanner({ user }) {
  const kyc = user.kyc && user.kyc.status;
  if (kyc === 'verified') return null;
  const text = kyc === 'submitted' || kyc === 'under_review'
    ? 'Your verification is under review (usually within 48 hours). You can prepare listings meanwhile.'
    : kyc === 'resubmission_required' ? 'Your verification needs changes. Please update and resubmit it.'
      : 'Complete your verification (KYC) so your listings can go live.';
  return (
    <div className="flex items-center gap-3 border-b border-warning-100 bg-warning-50 px-4 py-2.5 text-sm text-warning-700 sm:px-6">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{text}</span>
      <Link to="/lister/verification" className="whitespace-nowrap font-semibold underline-offset-4 hover:underline">Open verification</Link>
    </div>
  );
}

export default function PanelShell({ nav, label, base, panel }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const onLogout = async () => {
    await auth.logout();
    toast.info('You have been logged out');
    navigate('/login', { replace: true });
  };
  return (
    <PanelLayout panel={panel} panelLabel={label} base={base} sections={visibleNav(nav, auth)} user={auth.user} onLogout={onLogout}
      accountTo={`${base}/account`} notificationsTo={panel === 'lister' ? '/lister/notifications' : undefined}
      banner={panel === 'lister' ? <ListerBanner user={auth.user} /> : null} />
  );
}
