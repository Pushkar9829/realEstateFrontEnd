// Auth pages (login, register, recovery) with the cookie consent banner, so the
// banner also appears when a visitor lands straight on /login or /register.
import AuthLayout from '@/shared/layouts/AuthLayout';
import CookieBanner from '@/shared/components/CookieBanner';
import { usePublicSettings } from '@/modules/search/api';

export default function AuthShell() {
  const settings = usePublicSettings();
  const consent = (settings.data && settings.data.consent) || {};
  return (
    <>
      <AuthLayout />
      <CookieBanner ready={!settings.isLoading} enabled={consent.bannerEnabled !== false} cookieDays={consent.cookieDays} ga4Id={consent.ga4MeasurementId} />
    </>
  );
}
