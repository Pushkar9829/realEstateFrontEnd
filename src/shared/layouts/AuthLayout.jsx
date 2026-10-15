// Sign-in, sign-up and recovery pages: a brand panel beside the form card.
import { Outlet } from 'react-router-dom';
import { BadgeCheck, ShieldCheck, Users } from 'lucide-react';
import Logo from '@/shared/components/Logo';

const POINTS = [
  [BadgeCheck, 'Only verified owners, builders and landlords'],
  [ShieldCheck, 'Your number stays private, every account uses 2-step login'],
  [Users, 'Our own sales team arranges visits and negotiations'],
];

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
        <Logo inverse />
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Property without brokers.<br />Verified, direct and safe.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-brand-100"><Icon className="h-5 w-5 text-accent-300" aria-hidden /> {text}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">Secured with two-step verification on every account.</p>
      </div>
      <div className="flex flex-col bg-surface-muted">
        <div className="p-4 lg:hidden"><Logo /></div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md"><Outlet /></div>
        </div>
      </div>
    </div>
  );
}
