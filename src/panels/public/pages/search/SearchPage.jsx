// RE-S-PUB-02 search results (list): filters in the URL, sort, pagination,
// list/map toggle, save search, compare, enquire and "tell us what you need".
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ClipboardList, List, Map as MapIcon, SearchX, SlidersHorizontal } from 'lucide-react';
import { Button, Drawer, Modal, Pagination } from '@/shared/ui';
import { useCities, useLocalities } from '@/modules/listings/api';
import { SORTS, useSearch } from '@/modules/search/api';
import PropertyCard, { enquiryTarget } from '../../components/PropertyCard';
import FilterPanel, { useCityCode } from '../../components/FilterPanel';
import SearchBox from '../../components/SearchBox';
import EnquiryModal from '../../components/EnquiryModal';
import RequestPropertyForm from '../../components/RequestPropertyForm';
import { CardGridSkeleton, ErrorState, Eyebrow, IMG, PublicEmpty } from '../../components/States';
import { ActiveChips, CompareTray, SaveSearchButton, useDefaultCity } from '../../components/SearchChrome';
import { useDebounced } from '../../components/Calculators';
import useSearchFilters from '../../components/useSearchFilters';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { filtersSummary, track } from '@/shared/lib/analytics';

export default function SearchPage() {
  const t = useT();
  const { filters, query, sort, page, update, clear, qs } = useSearchFilters();
  useDefaultCity(filters, update);
  const params = useDebounced({ ...query, sort, page, limit: 18 }, 400);
  const res = useSearch(params);
  const [drawer, setDrawer] = useState(false);
  const [enquire, setEnquire] = useState(null);
  const [request, setRequest] = useState(false);
  const cities = useCities();
  const cityCode = useCityCode(filters.city);
  const locs = useLocalities(cityCode);
  const localityNames = useMemo(() => Object.fromEntries((locs.data || []).flatMap((l) => [[l.code, l.name], [l._id, l.name]])), [locs.data]);

  const items = (res.data && res.data.items) || [];
  const meta = (res.data && res.data.meta) || {};
  const purpose = filters.purpose === 'rent' ? 'rent' : 'sale';
  const where = filters.localities ? filters.localities.split(',').map((l) => localityNames[l] || l).join(', ') : '';
  const cityRow = (cities.data || []).find((c) => c.code === cityCode);
  const cityName = cityRow ? cityRow.name : filters.city;
  const place = [where, cityName].filter(Boolean).join(', ');
  const heading = place ? t(`search.heading.${purpose}In`, { place }) : t(`search.heading.${purpose}`);

  useDocumentMeta({
    title: cityName ? t(`search.meta.${purpose}In`, { city: cityName }) : t(`search.meta.${purpose}`),
    description: cityName ? t(`search.meta.${purpose === 'rent' ? 'descRentIn' : 'descSaleIn'}`, { city: cityName }) : t(`search.meta.${purpose === 'rent' ? 'descRent' : 'descSale'}`),
    path: `/search?purpose=${purpose}${cityCode ? `&city=${encodeURIComponent(cityCode)}` : ''}`,
  });

  // One "search" event per distinct applied filter set, once its results have loaded.
  const searchKey = useMemo(() => {
    const { sort: _s, page: _p, limit: _l, ...f } = params;
    return JSON.stringify(f);
  }, [params]);
  const loaded = res.isSuccess && !res.isFetching;
  const resultCount = meta.total || 0;
  const tracked = useRef('');
  useEffect(() => {
    if (!loaded || tracked.current === searchKey) return;
    tracked.current = searchKey;
    const f = JSON.parse(searchKey);
    track('search', { purpose: f.purpose || 'sale', city: f.city, filters: filtersSummary(f), results: resultCount, view: 'list' });
  }, [loaded, searchKey, resultCount]);

  const countText = res.isLoading ? t('search.list.searching') : t('search.list.found', { count: meta.total === 1 ? 1 : 2, n: `${(meta.total || 0).toLocaleString('en-IN')}${meta.totalCapped ? '+' : ''}` });

  return (
    <div className="pb-16">
      <header className="border-b border-navy-900/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 lg:pt-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Eyebrow>{t(purpose === 'rent' ? 'discover.search.eyebrowRent' : 'discover.search.eyebrowSale')}</Eyebrow>
              <h1 id="results-h" className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-navy-900 sm:text-4xl">{heading}</h1>
              <p className="mt-2 text-sm text-navy-500" aria-live="polite">
                {countText}
                {meta.facets && meta.facets.verified > 0 && <span className="text-navy-400">{` · ${t('search.list.verifiedFacet', { n: meta.facets.verified })}`}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDrawer(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-navy-900 ring-1 ring-inset ring-navy-900/15 transition hover:ring-navy-900/40 lg:hidden">
                <SlidersHorizontal className="h-4 w-4 text-gold-600" aria-hidden />{t('search.list.filters')}
              </button>
              <div className="inline-flex rounded-full bg-sand-100 p-1 ring-1 ring-navy-900/5" role="group" aria-label={t('search.list.view')}>
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy-900 px-4 text-sm font-medium text-white shadow-sm"><List className="h-4 w-4" aria-hidden />{t('search.list.list')}</span>
                <Link to={`/search/map?${qs}`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"><MapIcon className="h-4 w-4" aria-hidden />{t('search.list.map')}</Link>
              </div>
            </div>
          </div>
          <SearchBox key={filters.q || ''} initial={filters.q || ''} city={cityCode} className="mt-6 lg:max-w-3xl" onSearch={(p) => update(p)} />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 sm:px-6 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:block" aria-label={t('search.list.filters')}>
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-900/5">
            <p className="mb-5 flex items-center gap-2 font-display text-lg font-medium text-navy-900"><SlidersHorizontal className="h-4 w-4 text-gold-600" aria-hidden />{t('discover.search.refine')}</p>
            <FilterPanel filters={filters} onChange={update} />
          </div>
        </aside>

        <section aria-labelledby="results-h" className="min-w-0">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1"><ActiveChips filters={filters} update={update} clear={clear} localityNames={localityNames} /></div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <SaveSearchButton filters={query} size="md" />
              <label className="sr-only" htmlFor="sort">{t('search.sort.label')}</label>
              <span className="relative min-w-0">
                <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'relevance' ? undefined : e.target.value })}
                  className="h-10 max-w-full appearance-none rounded-full border-0 bg-white pl-4 pr-9 text-sm font-medium text-navy-900 ring-1 ring-inset ring-navy-900/15 transition hover:ring-navy-900/30 focus:outline-none focus:ring-2 focus:ring-gold-500">
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{t(`search.sort.${s.value}`)}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
              </span>
            </div>
          </div>
          {meta.facets && meta.facets.bhk && meta.facets.bhk.length > 1 && !filters.bhk && (
            <div className="mb-6 flex flex-wrap gap-2 text-xs">
              {meta.facets.bhk.filter((b) => b.bhk > 0).map((b) => (
                <button key={b.bhk} type="button" onClick={() => update({ bhk: b.bhk >= 4 ? '4+' : String(b.bhk) })} className="h-8 rounded-full bg-white px-3.5 font-medium text-navy-600 ring-1 ring-inset ring-navy-900/10 transition hover:text-navy-900 hover:ring-gold-500">{t('search.list.bhkFacet', { bhk: b.bhk, n: b.count })}</button>
              ))}
            </div>
          )}

          {res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} />
            : res.isLoading ? <CardGridSkeleton />
            : items.length === 0 ? (
              <PublicEmpty icon={SearchX} title={t('search.list.emptyTitle')} description={t('search.list.emptyDesc')}
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="gold" size="lg" icon={ClipboardList} onClick={() => setRequest(true)} className="rounded-full">{t('search.list.request')}</Button>
                    <Button variant="outline" size="lg" onClick={clear} className="rounded-full">{t('search.list.clearFilters')}</Button>
                    <Button variant="outline" size="lg" to={`/search/map?${qs}`} className="rounded-full">{t('search.list.widen')}</Button>
                    <SaveSearchButton filters={query} size="lg" label={t('search.list.saveAlerts')} />
                  </div>
                )} />
            ) : (
              <>
                <div className={`grid gap-6 sm:grid-cols-2 xl:grid-cols-3 ${res.isFetching ? 'opacity-70 transition-opacity' : ''}`}>
                  {items.map((c) => <PropertyCard key={c.id} card={c} onEnquire={(x) => setEnquire(enquiryTarget(x))} />)}
                </div>
                <div className="mt-4"><Pagination page={meta.page || page} pages={meta.pages} onChange={(p) => { update({ page: p > 1 ? p : undefined }, { keepPage: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /></div>
              </>
            )}

          {!res.isLoading && items.length > 0 && (
            <div className="relative isolate mt-12 overflow-hidden rounded-3xl bg-navy-900 p-6 sm:p-8">
              <img src={IMG('living-light')} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-900/60" aria-hidden />
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm leading-relaxed text-navy-200"><span className="block font-display text-2xl font-medium text-white">{t('search.list.notFinding')}</span> {t('search.list.notFindingBody')}</p>
                <Button variant="gold" size="lg" icon={ClipboardList} onClick={() => setRequest(true)} className="rounded-full">{t('search.list.tellUs')}</Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t('search.list.filters')} side="right">
        <div className="p-4"><FilterPanel filters={filters} onChange={update} /></div>
        <div className="sticky bottom-0 border-t border-navy-900/5 bg-white p-3"><Button variant="navy" size="lg" block onClick={() => setDrawer(false)} className="rounded-full">{t('search.list.showResults', { n: meta.total != null ? meta.total : '' })}</Button></div>
      </Drawer>
      <EnquiryModal open={Boolean(enquire)} target={enquire} onClose={() => setEnquire(null)} />
      <Modal open={request} onClose={() => setRequest(false)} title={t('search.list.request')} description={t('search.list.requestDesc')} size="lg">
        <RequestPropertyForm prefill={filters} compact />
      </Modal>
      <CompareTray />
    </div>
  );
}
