// Auth pages (login, register, recovery) with the cookie consent banner, so the
// banner also appears when a visitor lands straight on /login or /register.
import AuthLayout from '@/shared/layouts/AuthLayout';
import CookieBanner from '@/shared/components/CookieBanner';
import { usePublicSettings } from '@/modules/search/api';
import { useAuth } from '@/modules/auth';
import { I18nProvider } from '@/shared/i18n';
import { recordAnalyticsChoice } from './accountSync';

export default function AuthShell() {
  const settings = usePublicSettings();
  const { isAuthed } = useAuth();
  const consent = (settings.data && settings.data.consent) || {};
  return (
    <I18nProvider languages={settings.data && settings.data.languages}>
      <AuthLayout />
      <CookieBanner ready={!settings.isLoading} enabled={consent.bannerEnabled !== false} cookieDays={consent.cookieDays} ga4Id={consent.ga4MeasurementId}
        onChoice={(choice) => recordAnalyticsChoice(choice, isAuthed)} />
    </I18nProvider>
  );
}
