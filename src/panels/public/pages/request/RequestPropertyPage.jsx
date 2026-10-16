// RE-S-PUB-21 request a property page (also opened as a modal from search).
// Query-string filters (purpose, city, localities, bhk, minPrice, maxPrice) prefill the form.
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card, PageHeader } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { filtersFromParams } from '@/modules/search/api';
import RequestPropertyForm from '../../components/RequestPropertyForm';

export default function RequestPropertyPage() {
  const t = useT();
  const [sp] = useSearchParams();
  useDocumentMeta({ title: t('account.meta.requestTitle'), description: t('account.meta.requestDesc'), path: '/request-property' });
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title={t('account.request.title')} description={t('account.request.description')} />
      <Card>
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-muted"><ClipboardList className="h-4 w-4 text-brand-600" aria-hidden />{t('account.request.minute')}</div>
        <RequestPropertyForm prefill={filtersFromParams(sp)} />
      </Card>
    </div>
  );
}
