// Sign-in, sign-up and recovery pages: a brand panel beside the form card.
import { Outlet } from 'react-router-dom';
import { BadgeCheck, ShieldCheck, Users } from 'lucide-react';
import Logo from '@/shared/components/Logo';
import { useT } from '@/shared/i18n';
import LanguageSwitcher from '@/shared/i18n/LanguageSwitcher';

const POINTS = [
  [BadgeCheck, 'common.authLayout.point1'],
  [ShieldCheck, 'common.authLayout.point2'],
  [Users, 'common.authLayout.point3'],
];

export default function AuthLayout() {
  const t = useT();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
        <div className="flex items-center justify-between gap-4"><Logo inverse /><LanguageSwitcher inverse /></div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">{t('common.authLayout.headline1')}<br />{t('common.authLayout.headline2')}</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-brand-100"><Icon className="h-5 w-5 text-accent-300" aria-hidden /> {t(text)}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">{t('common.authLayout.secured')}</p>
      </div>
      <div className="flex flex-col bg-surface-muted">
        <div className="flex items-center justify-between gap-4 p-4 lg:hidden"><Logo /><LanguageSwitcher /></div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md"><Outlet /></div>
        </div>
      </div>
    </div>
  );
}
