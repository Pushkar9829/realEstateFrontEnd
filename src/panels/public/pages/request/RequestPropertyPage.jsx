// RE-S-PUB-21 request a property page (also opened as a modal from search).
// Query-string filters (purpose, city, localities, bhk, minPrice, maxPrice) prefill the form.
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card, PageHeader } from '@/shared/ui';
import { filtersFromParams } from '@/modules/search/api';
import RequestPropertyForm from '../../components/RequestPropertyForm';

export default function RequestPropertyPage() {
  const [sp] = useSearchParams();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Request a property" description="Tell us what you need. Our team searches for you and calls with matching options, free and broker-free." />
      <Card>
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-muted"><ClipboardList className="h-4 w-4 text-brand-600" aria-hidden />Takes about a minute.</div>
        <RequestPropertyForm prefill={filtersFromParams(sp)} />
      </Card>
    </div>
  );
}
