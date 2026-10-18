// RE-S-PUB-19 localities index: purpose toggle, average price per sq ft or
// monthly rent, live listings, sort and search, link to each locality page.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useCitySummary, useLocalitiesIndex } from '@/modules/search/api';
import { ErrorState, NotAvailable, PageBand, PublicEmpty, Shimmer } from '../../components/States';
import { FIELD } from '../../components/FilterPanel';
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

  const total = (q.data || []).length;
  const count = (r) => (purpose === 'rent' ? r.rentListings : r.saleListings);

  return (
    <>
      <PageBand image={code === 'pune' ? 'pune-aerial' : 'towers-night'} crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { to: `/city/${code}`, label: cityName }, { label: t('home.localities.crumb') }]}
        eyebrow={t('discover.localities.eyebrow')} title={t('home.localities.title', { city: cityName })} text={t('home.localities.description')}
        actions={<PurposeToggle dark value={purpose} onChange={setPurpose} />}
        stats={q.isSuccess ? [{ label: t('discover.localities.count'), value: total.toLocaleString('en-IN') }] : null} />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">{t('home.localities.searchLabel')}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-500" aria-hidden />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('home.localities.searchLabel')} className={`${FIELD} h-12 pl-11 pr-4`} />
          </label>
          <span className="relative sm:w-60">
            <select aria-label={t('home.localities.sortAria')} value={sort} onChange={(e) => setSort(e.target.value)} className={`${FIELD} h-12 appearance-none pl-4 pr-9`}>
              {SORTS.map((v) => <option key={v} value={v}>{t(`home.localities.sorts.${v}`)}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-500" aria-hidden />
          </span>
        </div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <>
            {!q.isLoading && !hasData && total > 0 && <p className="mb-4 rounded-2xl bg-gold-50 p-4 text-sm text-navy-700 ring-1 ring-gold-200">{t('home.localities.trendsNote')}</p>}
            {!q.isLoading && !total ? <PublicEmpty icon={MapPin} title={t('home.localities.emptyTitle')} description={t('home.localities.emptyText')} /> : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5">
                <table className="w-full text-sm">
                  <thead className="bg-navy-950 text-left">
                    <tr>
                      <th scope="col" className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-200">{t('home.localities.colLocality')}</th>
                      <th scope="col" className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-200">{purpose === 'rent' ? t('home.localities.colAvgRent') : t('home.localities.colAvgPrice')}</th>
                      <th scope="col" className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-200">{t('home.localities.colListings')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-900/5">
                    {q.isLoading && Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`s${i}`}>{[0, 1, 2].map((c) => <td key={c} className="px-5 py-4"><Shimmer className="h-4 w-full rounded-md bg-sand-200" /></td>)}</tr>
                    ))}
                    {!q.isLoading && rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-sand-50">
                        <td className="px-5 py-4"><Link to={`/city/${code}/${r.code}`} className="group inline-flex items-center gap-2 font-display text-base font-medium text-navy-900 hover:text-gold-700"><MapPin className="h-4 w-4 text-gold-700" aria-hidden />{r.name}</Link></td>
                        <td className="px-5 py-4 font-medium text-navy-700">{avgText(t, avgFor(r, purpose), purpose)}</td>
                        <td className="px-5 py-4 text-right font-display text-base font-semibold text-navy-900">{count(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!q.isLoading && rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-navy-500">{t('home.localities.noMatch')}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
