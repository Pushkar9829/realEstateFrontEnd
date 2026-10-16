// Signed-in visitor choices written back to the account (public shell only):
// - cookie banner choice -> consent ledger, purpose `analytics` (RE-L-11 step 2, RE-M-10);
// - UI language -> the profile `locale` (PATCH /api/me), so messages can follow it later.
// Both are best effort: a failure never blocks the page.
import { useEffect, useRef } from 'react';
import { api } from '@/shared/lib/api';
import { useLang } from '@/shared/i18n';

// "Accept analytics" gives the analytics consent (POST /api/me/consents); "Essential only" withdraws
// it (POST /api/me/consents/analytics/withdraw; a 404 just means there was none).
export function recordAnalyticsChoice(choice, isAuthed) {
  if (!isAuthed) return;
  if (choice === 'essential') api.post('/me/consents/analytics/withdraw').catch(() => {});
  else api.post('/me/consents', { purpose: 'analytics', source: 'banner' }).catch(() => {});
}

// Saves the language to user.locale when a signed-in visitor switches it in the header
// (only after a switch, so opening the site on a new device never overwrites the profile).
export function useLocaleSync(user, isAuthed) {
  const { lang } = useLang();
  const first = useRef(lang);
  const sent = useRef('');
  useEffect(() => {
    if (!isAuthed || !user || lang === first.current || user.locale === lang || sent.current === lang) return;
    sent.current = lang;
    api.patch('/me', { locale: lang }).catch(() => {});
  }, [isAuthed, user, lang]);
}
