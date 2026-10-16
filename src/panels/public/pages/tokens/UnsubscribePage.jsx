// Saved-search alert unsubscribe link (/alerts/unsubscribe/:token). Opening
// the link switches that saved search's alerts off.
import { useParams } from 'react-router-dom';
import { BellOff, Link2Off } from 'lucide-react';
import { Button, Skeleton } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useUnsubscribe } from '@/modules/search/api';
import { NarrowPage, NotAvailable } from '../../components/States';

export default function UnsubscribePage() {
  const { token } = useParams();
  const t = useT();
  const q = useUnsubscribe(token);
  useDocumentMeta({ title: t('account.meta.unsubscribe'), noindex: true });
  if (q.isLoading) return <NarrowPage><Skeleton className="h-48 w-full" /></NarrowPage>;
  if (q.isError) return <NotAvailable icon={Link2Off} title={t('account.unsubscribe.invalidTitle')} description={t('account.unsubscribe.invalidText')} action={<Button to="/account/saved-searches">{t('account.unsubscribe.savedSearches')}</Button>} />;
  return (
    <NotAvailable icon={BellOff} title={t('account.unsubscribe.offTitle')} description={t('account.unsubscribe.offText', { name: q.data.name })}
      action={<div className="flex flex-wrap justify-center gap-2"><Button to="/account/saved-searches">{t('account.unsubscribe.manage')}</Button><Button variant="secondary" to="/search">{t('account.unsubscribe.search')}</Button></div>} />
  );
}
