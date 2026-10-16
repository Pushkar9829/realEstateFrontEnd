// Saved-search alert unsubscribe link (/alerts/unsubscribe/:token). Opening
// the link switches that saved search's alerts off.
import { useParams } from 'react-router-dom';
import { BellOff, Link2Off } from 'lucide-react';
import { Button, Skeleton } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useUnsubscribe } from '@/modules/search/api';
import { TokenNotice, TokenPage } from './TokenFrame';

export default function UnsubscribePage() {
  const { token } = useParams();
  const t = useT();
  const q = useUnsubscribe(token);
  useDocumentMeta({ title: t('account.meta.unsubscribe'), noindex: true });
  if (q.isLoading) return <TokenPage><Skeleton className="h-48 w-full" /></TokenPage>;
  if (q.isError) return <TokenNotice icon={Link2Off} title={t('account.unsubscribe.invalidTitle')} description={t('account.unsubscribe.invalidText')} action={<Button variant="navy" size="lg" className="!rounded-full px-6" to="/account/saved-searches">{t('account.unsubscribe.savedSearches')}</Button>} />;
  return (
    <TokenNotice tone="success" icon={BellOff} title={t('account.unsubscribe.offTitle')} description={t('account.unsubscribe.offText', { name: q.data.name })}
      action={<div className="flex flex-wrap justify-center gap-3"><Button variant="navy" size="lg" className="!rounded-full px-6" to="/account/saved-searches">{t('account.unsubscribe.manage')}</Button><Button variant="outline" size="lg" className="!rounded-full px-6" to="/search">{t('account.unsubscribe.search')}</Button></div>} />
  );
}
