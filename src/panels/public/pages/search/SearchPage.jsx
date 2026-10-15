// RE-S-PUB-02 search results (list): filters in the URL, sort, pagination,
// list/map toggle, save search, compare, enquire and "tell us what you need".
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, List, Map as MapIcon, SearchX, SlidersHorizontal } from 'lucide-react';
import { Button, Drawer, EmptyState, Modal, Pagination } from '@/shared/ui';
import { useCities, useLocalities } from '@/modules/listings/api';
import { SORTS, useSearch } from '@/modules/search/api';
import PropertyCard, { enquiryTarget } from '../../components/PropertyCard';
import FilterPanel, { useCityCode } from '../../components/FilterPanel';
import SearchBox from '../../components/SearchBox';
import EnquiryModal from '../../components/EnquiryModal';
import RequestPropertyForm from '../../components/RequestPropertyForm';
import { CardGridSkeleton, ErrorState } from '../../components/States';
import { ActiveChips, CompareTray, SaveSearchButton, useDefaultCity } from '../../components/SearchChrome';
import { useDebounced } from '../../components/Calculators';
import useSearchFilters from '../../components/useSearchFilters';

export default function SearchPage() {
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
  const purposeLabel = filters.purpose === 'rent' ? 'for rent' : 'for sale';
  const where = filters.localities ? filters.localities.split(',').map((l) => localityNames[l] || l).join(', ') : '';
  const cityRow = (cities.data || []).find((c) => c.code === cityCode);
  const cityName = cityRow ? cityRow.name : filters.city;
  const heading = `Properties ${purposeLabel}${where ? ` in ${where}` : ''}${cityName ? `${where ? ',' : ' in'} ${cityName}` : ''}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox key={filters.q || ''} initial={filters.q || ''} city={cityCode} className="flex-1" onSearch={(p) => update(p)} />
        <div className="flex gap-2">
          <Button variant="secondary" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setDrawer(true)}>Filters</Button>
          <div className="inline-flex rounded-md border border-line-strong bg-white p-0.5" role="group" aria-label="View">
            <span className="inline-flex h-9 items-center gap-1.5 rounded bg-brand-600 px-3 text-sm font-medium text-white"><List className="h-4 w-4" aria-hidden />List</span>
            <Link to={`/search/map?${qs}`} className="inline-flex h-9 items-center gap-1.5 rounded px-3 text-sm font-medium text-ink-muted hover:text-ink"><MapIcon className="h-4 w-4" aria-hidden />Map</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border bg-white p-4 shadow-sm">
            <FilterPanel filters={filters} onChange={update} />
          </div>
        </aside>

        <section aria-labelledby="results-h">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 id="results-h" className="text-xl font-semibold text-ink">{heading}</h1>
              <p className="text-sm text-ink-subtle" aria-live="polite">
                {res.isLoading ? 'Searching…' : `${(meta.total || 0).toLocaleString('en-IN')}${meta.totalCapped ? '+' : ''} ${meta.total === 1 ? 'property' : 'properties'} found`}
                {meta.facets && meta.facets.verified > 0 && ` · ${meta.facets.verified} verified`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SaveSearchButton filters={query} />
              <label className="sr-only" htmlFor="sort">Sort by</label>
              <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'relevance' ? undefined : e.target.value })}
                className="h-8 rounded-md border border-line-strong bg-white px-2 text-sm focus:border-brand-500 focus:outline-none">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4"><ActiveChips filters={filters} update={update} clear={clear} localityNames={localityNames} /></div>
          {meta.facets && meta.facets.bhk && meta.facets.bhk.length > 1 && !filters.bhk && (
            <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
              {meta.facets.bhk.filter((b) => b.bhk > 0).map((b) => (
                <button key={b.bhk} type="button" onClick={() => update({ bhk: b.bhk >= 4 ? '4+' : String(b.bhk) })} className="rounded-full border bg-white px-2.5 py-1 text-ink-muted hover:border-brand-300">{b.bhk} BHK ({b.count})</button>
              ))}
            </div>
          )}

          {res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} />
            : res.isLoading ? <CardGridSkeleton />
            : items.length === 0 ? (
              <EmptyState icon={SearchX} title="No properties match" description="Try fewer filters or a wider area. Or tell us what you need and our team will find options for you."
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" onClick={clear}>Clear filters</Button>
                    <Button variant="secondary" to={`/search/map?${qs}`}>Widen the area on the map</Button>
                    <Button icon={ClipboardList} onClick={() => setRequest(true)}>Request a property</Button>
                    <SaveSearchButton filters={query} size="md" label="Save search and get alerts" />
                  </div>
                )} />
            ) : (
              <>
                <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${res.isFetching ? 'opacity-70' : ''}`}>
                  {items.map((c) => <PropertyCard key={c.id} card={c} onEnquire={(x) => setEnquire(enquiryTarget(x))} />)}
                </div>
                <Pagination page={meta.page || page} pages={meta.pages} onChange={(p) => { update({ page: p > 1 ? p : undefined }, { keepPage: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </>
            )}

          {!res.isLoading && items.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed bg-white p-5 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-sm text-ink-muted"><span className="font-semibold text-ink">Not finding the right home?</span> Tell us what you need and our team will call you with matching options.</p>
              <Button variant="secondary" icon={ClipboardList} onClick={() => setRequest(true)}>Tell us what you need</Button>
            </div>
          )}
        </section>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Filters" side="right">
        <div className="p-4"><FilterPanel filters={filters} onChange={update} /></div>
        <div className="sticky bottom-0 border-t bg-white p-3"><Button block onClick={() => setDrawer(false)}>Show {meta.total != null ? meta.total : ''} results</Button></div>
      </Drawer>
      <EnquiryModal open={Boolean(enquire)} target={enquire} onClose={() => setEnquire(null)} />
      <Modal open={request} onClose={() => setRequest(false)} title="Request a property" description="Tell us what you need. Our team will call you with options." size="lg">
        <RequestPropertyForm prefill={filters} compact />
      </Modal>
      <CompareTray />
    </div>
  );
}
