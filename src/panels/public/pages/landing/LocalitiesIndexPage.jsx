// RE-S-PUB-19 localities index: purpose toggle, average price per sq ft or
// monthly rent, live listings, sort and search, link to each locality page.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { EmptyState, PageHeader, Select, Table } from '@/shared/ui';
import { useCitySummary, useLocalitiesIndex } from '@/modules/search/api';
import { ErrorState, NotAvailable } from '../../components/States';
import { PurposeToggle, avgFor, avgText } from './CityPage';

const SORTS = [{ value: 'listings', label: 'Most listings' }, { value: 'name', label: 'Name' }, { value: 'asc', label: 'Price: low to high' }, { value: 'desc', label: 'Price: high to low' }];

export default function LocalitiesIndexPage() {
  const { city } = useParams();
  const [purpose, setPurpose] = useState('sale');
  const [sort, setSort] = useState('listings');
  const [term, setTerm] = useState('');
  const summary = useCitySummary(city);
  const q = useLocalitiesIndex(city);
  const c = summary.data && summary.data.city;

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

  if (q.isError && q.error.status === 404) return <NotAvailable icon={MapPin} title="City not found" action={null} />;
  const code = c ? c.code : city;
  const hasData = (q.data || []).some((l) => avgFor(l, purpose));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader breadcrumb={<><Link to="/" className="hover:text-ink">Home</Link> / <Link to={`/city/${code}`} className="hover:text-ink">{c ? c.name : city}</Link> / Localities</>}
        title={`Localities in ${c ? c.name : city}`} description="Compare average prices and rents. Figures are indicative, based on listings and deals on this platform."
        actions={<PurposeToggle value={purpose} onChange={setPurpose} />} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search localities</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search localities" className="h-10 w-full rounded-md border border-line-strong bg-white pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} className="sm:w-56" />
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          {!q.isLoading && !hasData && (q.data || []).length > 0 && <p className="mb-3 rounded-md bg-surface-muted p-3 text-sm text-ink-muted">Trends appear once enough listings are live. Localities with fewer than 5 listings show "-".</p>}
          {!q.isLoading && !(q.data || []).length ? <EmptyState icon={MapPin} title="No localities yet" description="Trends appear once enough listings are live." /> : (
            <Table loading={q.isLoading} rows={rows} rowKey={(r) => r.id} empty="No locality matches your search"
              columns={[
                { key: 'name', header: 'Locality', render: (r) => <Link to={`/city/${code}/${r.code}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link> },
                { key: 'avg', header: purpose === 'rent' ? 'Average rent' : 'Average price', render: (r) => avgText(avgFor(r, purpose), purpose) },
                { key: 'n', header: 'Live listings', className: 'text-right', render: (r) => (purpose === 'rent' ? r.rentListings : r.saleListings) },
              ]} />
          )}
        </>
      )}
    </div>
  );
}
