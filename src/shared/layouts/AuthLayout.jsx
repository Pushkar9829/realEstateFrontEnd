// Sign-in, sign-up and recovery pages (public "modern premium" look, see
// docs/PUBLIC_DESIGN.md): on desktop a full-height photo panel with the value
// proposition beside the form; on mobile a slim photo header above the form.
import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, ShieldCheck, Users } from 'lucide-react';
import SkipLink from '@/shared/components/SkipLink';
import Logo from '@/shared/components/Logo';
import { useT } from '@/shared/i18n';
import LanguageSwitcher from '@/shared/i18n/LanguageSwitcher';

const POINTS = [
  [BadgeCheck, 'common.authLayout.point1'],
  [ShieldCheck, 'common.authLayout.point2'],
  [Users, 'common.authLayout.point3'],
];

// Restyles the shared form controls (Input, PasswordInput, Select, Textarea,
// Checkbox, OtpInput) inside a wrapper without touching shared/ui: sand
// background, rounded-xl, gold focus ring. Public pages put it on a wrapper.
export const PUBLIC_FORM_SKIN = [
  '[&_label]:text-navy-800',
  '[&_input:where(:not([type=checkbox]):not([type=radio]))]:h-12',
  '[&_input:where(:not([type=checkbox]):not([type=radio]))]:rounded-xl',
  '[&_input:where(:not([type=checkbox]):not([type=radio]))]:border-navy-900/10',
  '[&_input:where(:not([type=checkbox]):not([type=radio]))]:bg-sand-100',
  '[&_input:where(:not([type=checkbox]):not([type=radio]))]:text-navy-900',
  '[&_input:where(:not([type=checkbox]):not([type=radio]))]:shadow-none',
  '[&_select]:h-12 [&_select]:rounded-xl [&_select]:border-navy-900/10 [&_select]:bg-sand-100 [&_select]:text-navy-900 [&_select]:shadow-none',
  '[&_textarea]:rounded-xl [&_textarea]:border-navy-900/10 [&_textarea]:bg-sand-100 [&_textarea]:text-navy-900 [&_textarea]:shadow-none',
  '[&_input:focus]:border-gold-500 [&_input:focus]:bg-white [&_input:focus]:ring-gold-500/30',
  '[&_select:focus]:border-gold-500 [&_select:focus]:bg-white [&_select:focus]:ring-gold-500/30',
  '[&_textarea:focus]:border-gold-500 [&_textarea:focus]:bg-white [&_textarea:focus]:ring-gold-500/30',
  '[&_[aria-invalid=true]]:border-danger-600 [&_[aria-invalid=true]:focus]:border-danger-600',
  '[&_input[type=checkbox]]:border-navy-300 [&_input[type=checkbox]]:text-navy-900 [&_input[type=checkbox]:focus]:ring-gold-500',
  '[&_[role=group]]:gap-1.5 sm:[&_[role=group]]:gap-2',
].join(' ');

const PHOTO = '/images/stock/living-warm.webp';

export default function AuthLayout() {
  const t = useT();
  return (
    <div className="grid min-h-screen bg-sand-50 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <SkipLink />
      {/* Photo panel (desktop) */}
      <aside className="relative isolate hidden overflow-hidden bg-navy-950 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src={PHOTO} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/95 via-navy-950/60 to-navy-950/40" aria-hidden />
        <div className="absolute inset-y-0 right-0 -z-10 w-px bg-gradient-to-b from-gold-500/0 via-gold-400/50 to-gold-500/0" aria-hidden />
        <div className="flex items-center justify-between gap-4">
          <Logo luxe inverse />
          <LanguageSwitcher inverse />
        </div>
        <div className="max-w-lg">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
            <span className="h-px w-8 bg-current" aria-hidden />{t('marketing.hero.eyebrow')}
          </p>
          <h2 className="mt-5 font-display text-4xl font-medium leading-[1.1] tracking-tight text-white xl:text-5xl">
            {t('common.authLayout.headline1')}{' '}
            <span className="italic text-gold-300">{t('common.authLayout.headline2')}</span>
          </h2>
          <ul className="mt-10 space-y-4">
            {POINTS.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-4 text-navy-100">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-300/30 bg-white/5 text-gold-300 backdrop-blur">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {t(text)}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-navy-300"><ShieldCheck className="h-4 w-4 text-gold-400" aria-hidden />{t('common.authLayout.secured')}</p>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        {/* Slim photo header (mobile and tablet) */}
        <div className="relative isolate overflow-hidden bg-navy-950 lg:hidden">
          <img src={PHOTO} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_60%] opacity-70" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/40" aria-hidden />
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 pb-5 pt-4 sm:px-6">
            <Logo luxe inverse />
            <LanguageSwitcher inverse />
          </div>
          <p className="mx-auto max-w-xl px-4 pb-6 font-display text-xl font-medium leading-snug text-white sm:px-6">
            {t('common.authLayout.headline1')} <span className="italic text-gold-300">{t('common.authLayout.headline2')}</span>
          </p>
          <div className="h-0.5 bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600" aria-hidden />
        </div>

        <div className="hidden justify-end px-10 pt-8 lg:flex">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-navy-500 transition-colors hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" aria-hidden />{t('account.cms.backHome')}
          </Link>
        </div>
        <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-8 focus:outline-none sm:px-6 sm:py-12 lg:items-center lg:px-10">
          <div className={`w-full max-w-md ${PUBLIC_FORM_SKIN}`}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
