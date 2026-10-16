// RE-S-PUB-19 localities index: purpose toggle, average price per sq ft or
// monthly rent, live listings, sort and search, link to each locality page.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { EmptyState, PageHeader, Select, Table } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useCitySummary, useLocalitiesIndex } from '@/modules/search/api';
import { ErrorState, NotAvailable } from '../../components/States';
import { PurposeToggle, avgFor, avgText } from './CityPage';

const SORTS = ['listings', 'name', 'asc', 'desc'];

export default function LocalitiesIndexPage() {
  const t = useT();
  const { city } = useParams();
  const [purpose, setPurpose] = useState('sale');
  const [sort, setSort] = useState('listings');
  const [term, setTerm] = useState('');
  const summary = useCitySummary(city);
  const q = useLocalitiesIndex(city);
  const c = summary.data && summary.data.city;
  const cityName = c ? c.name : city;
  useDocumentMeta({
    title: c ? t('home.localities.meta.title', { city: c.name }) : undefined,
    description: c ? t('home.localities.meta.description', { city: c.name }) : undefined,
    path: `/city/${city}/localities`,
  });

  const rows = useMemo(() => {
    const list = (q.data || []).filter((l) => !term || l.name.toLowerCase().includes(term.toLowerCase()));
    const n = (l) => (purpose === 'rent' ? l.rentListings : l.saleListings);
    const v = (l) => avgFor(l, purpose);
    const by = {
      listings: (a, b) => n(b) - n(a),
      name: (a, b) => a.name.localeCompare(b.name),
      asc: (a, b) => (v(a) == null) - (v(b) == null) || (v(a) || 0) - (v(b) || 0),
      desc: (a, b) => (v(a) == null) - (v(b) == null) || (v(b) || 0) - (v(a) || 0),
    }[sort];
    return [...list].sort(by);
  }, [q.data, term, sort, purpose]);

  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title={t('home.city.notFound')} action={null} />;
  const code = c ? c.code : city;
  const hasData = (q.data || []).some((l) => avgFor(l, purpose));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader breadcrumb={<><Link to="/" className="hover:text-ink">{t('home.place.home')}</Link> / <Link to={`/city/${code}`} className="hover:text-ink">{cityName}</Link> / {t('home.localities.crumb')}</>}
        title={t('home.localities.title', { city: cityName })} description={t('home.localities.description')}
        actions={<PurposeToggle value={purpose} onChange={setPurpose} />} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t('home.localities.searchLabel')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('home.localities.searchLabel')} className="h-10 w-full rounded-md border border-line-strong bg-white pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <Select aria-label={t('home.localities.sortAria')} value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS.map((v) => ({ value: v, label: t(`home.localities.sorts.${v}`) }))} className="sm:w-56" />
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          {!q.isLoading && !hasData && (q.data || []).length > 0 && <p className="mb-3 rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{t('home.localities.trendsNote')}</p>}
          {!q.isLoading && !(q.data || []).length ? <EmptyState icon={MapPin} title={t('home.localities.emptyTitle')} description={t('home.localities.emptyText')} /> : (
            <Table loading={q.isLoading} rows={rows} rowKey={(r) => r.id} empty={t('home.localities.noMatch')}
              columns={[
                { key: 'name', header: t('home.localities.colLocality'), render: (r) => <Link to={`/city/${code}/${r.code}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link> },
                { key: 'avg', header: purpose === 'rent' ? t('home.localities.colAvgRent') : t('home.localities.colAvgPrice'), render: (r) => avgText(t, avgFor(r, purpose), purpose) },
                { key: 'n', header: t('home.localities.colListings'), className: 'text-right', render: (r) => (purpose === 'rent' ? r.rentListings : r.saleListings) },
              ]} />
          )}
        </>
      )}
    </div>
  );
}
