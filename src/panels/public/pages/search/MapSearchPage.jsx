// RE-S-PUB-03 map search: price pins or clusters for the visible box (public
// approximate points only), "search as I move the map", near me with a
// radius, the same filters in a drawer and a synced side list.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crosshair, List, LocateFixed, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button, Checkbox, Drawer, Spinner, useToast } from '@/shared/ui';
import { useCities } from '@/modules/listings/api';
import { useMapSearch, useNear } from '@/modules/search/api';
import PropertyCard from '../../components/PropertyCard';
import FilterPanel, { useCityCode } from '../../components/FilterPanel';
import { SearchMap } from '../../components/PublicMap';
import { ErrorState } from '../../components/States';
import { ActiveChips, SaveSearchButton, centroidOf, useDefaultCity } from '../../components/SearchChrome';
import useSearchFilters from '../../components/useSearchFilters';
import { t as tNow, useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { filtersSummary, track } from '@/shared/lib/analytics';

const RADII = [1, 2, 5, 10, 25, 50];
const EXTRA = ['lat', 'lng', 'radius'];

export function locate(toast, onPoint) {
  if (!navigator.geolocation) { toast.error(tNow('search.map.locUnavailable')); return; }
  navigator.geolocation.getCurrentPosition(
    (p) => onPoint({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
    () => toast.error(tNow('search.map.locDenied')),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

export default function MapSearchPage() {
  const t = useT();
  const toast = useToast();
  const { filters, query, extra, update, clear, qs } = useSearchFilters({ extraKeys: EXTRA });
  const nearMode = Boolean(extra.lat && extra.lng);
  useDefaultCity(nearMode ? { ...filters, q: filters.q || 'near-me' } : filters, update);
  const cities = useCities();
  const cityCode = useCityCode(filters.city);
  const city = (cities.data || []).find((c) => c.code === cityCode);
  const point = nearMode ? { lat: Number(extra.lat), lng: Number(extra.lng), radiusKm: Math.min(50, Number(extra.radius) || 5) } : null;
  // Near me searches around the point, not inside the chosen city.
  const nearQuery = useMemo(() => { const { city: _c, localities: _l, ...rest } = query; return rest; }, [query]);

  const [bbox, setBbox] = useState(null);
  const [zoom, setZoom] = useState(12);
  const [follow, setFollow] = useState(true);
  const [pending, setPending] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [showList, setShowList] = useState(false);
  const [zoomTarget, setZoomTarget] = useState(null);

  const mapQ = useMapSearch(query, nearMode ? null : bbox);
  const nearQ = useNear(nearQuery, point, nearMode);
  const q = nearMode ? nearQ : mapQ;
  const pins = nearMode ? (nearQ.data || []) : ((mapQ.data && mapQ.data.pins) || []);
  const clusters = nearMode ? [] : ((mapQ.data && mapQ.data.clusters) || []);
  const total = nearMode ? pins.length : (mapQ.data && mapQ.data.total) || 0;

  const center = nearMode ? [point.lat, point.lng] : centroidOf(city);

  const purpose = filters.purpose === 'rent' ? 'rent' : 'sale';
  const cityName = city ? city.name : filters.city;
  const listTitle = cityName ? t(`search.meta.${purpose}In`, { city: cityName }) : t(`search.meta.${purpose}`);
  useDocumentMeta({
    title: t('search.meta.mapTitle', { title: listTitle }),
    description: cityName ? t(`search.meta.${purpose === 'rent' ? 'descRentIn' : 'descSaleIn'}`, { city: cityName }) : t(`search.meta.${purpose === 'rent' ? 'descRent' : 'descSale'}`),
    path: `/search?purpose=${purpose}${cityCode ? `&city=${encodeURIComponent(cityCode)}` : ''}`,
  });

  // One "search" event per distinct applied filter set (not per map pan), once results have loaded.
  const radiusKm = point ? point.radiusKm : undefined;
  const searchKey = useMemo(() => JSON.stringify(nearMode ? { ...nearQuery, near: radiusKm } : query), [nearMode, nearQuery, query, radiusKm]);
  const loaded = q.isSuccess && !q.isFetching;
  const tracked = useRef('');
  useEffect(() => {
    if (!loaded || tracked.current === searchKey) return;
    tracked.current = searchKey;
    const { near, ...f } = JSON.parse(searchKey);
    track('search', { purpose: f.purpose || 'sale', city: f.city, filters: filtersSummary(f), results: total, view: 'map', radiusKm: near });
  }, [loaded, searchKey, total]);
  const onBounds = useCallback((b, z) => {
    setZoom(z);
    if (follow) setBbox(b); else setPending(b);
  }, [follow]);

  const nearMe = () => locate(toast, (p) => update({ lat: p.lat, lng: p.lng, radius: 5 }));

  const list = (
    <div className="space-y-3">
      {pins.map((c) => (
        <div key={c.id} onMouseEnter={() => setActiveId(c.id)} onMouseLeave={() => setActiveId(null)}>
          <PropertyCard card={c} compact distanceKm={c.distanceKm} className={cn(activeId === c.id && 'border-brand-500 ring-2 ring-brand-500/20')} />
        </div>
      ))}
      {!q.isLoading && !pins.length && clusters.length > 0 && <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{t('search.map.inArea', { n: total.toLocaleString('en-IN') })}</p>}
      {!q.isLoading && !pins.length && !clusters.length && <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{nearMode ? t('search.map.noneRadius') : t('search.map.noneHere')}</p>}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b bg-white px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={SlidersHorizontal} onClick={() => setDrawer(true)}>{t('search.list.filters')}</Button>
          {nearMode ? (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('search.map.radius')}>
              <span className="mr-1 inline-flex items-center gap-1 text-sm text-ink-muted"><LocateFixed className="h-4 w-4 text-brand-600" aria-hidden />{t('search.map.nearMe')}</span>
              {RADII.map((r) => (
                <button key={r} type="button" aria-pressed={point.radiusKm === r} onClick={() => update({ radius: r })}
                  className={cn('rounded-full border px-2.5 py-0.5 text-xs', point.radiusKm === r ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink-muted')}>{t('search.map.km', { n: r })}</button>
              ))}
              <button type="button" onClick={() => update({ lat: undefined, lng: undefined, radius: undefined })} className="ml-1 rounded p-1 text-ink-subtle hover:text-ink" aria-label={t('search.map.stopNearMe')}><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" icon={Crosshair} onClick={nearMe}>{t('search.map.nearMe')}</Button>
          )}
          {!nearMode && <Checkbox className="ml-1" label={t('search.map.follow')} checked={follow} onChange={(e) => { setFollow(e.target.checked); if (e.target.checked && pending) { setBbox(pending); setPending(null); } }} />}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-ink-subtle sm:inline" aria-live="polite">{q.isFetching ? t('common.loading') : t('search.map.count', { n: total.toLocaleString('en-IN') })}</span>
            <SaveSearchButton filters={query} label={t('search.map.saveSearch')} />
            <Link to={`/search?${new URLSearchParams([...new URLSearchParams(qs)].filter(([k]) => !EXTRA.includes(k)))}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted"><List className="h-4 w-4" aria-hidden />{t('search.list.list')}</Link>
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-7xl empty:hidden"><ActiveChips filters={filters} update={update} clear={clear} /></div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-r bg-surface-muted p-3 lg:block" aria-label={t('search.map.onMap')}>
          {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list}
        </aside>
        <div className="relative min-w-0 flex-1">
          <SearchMap pins={pins} clusters={clusters} center={center} zoom={nearMode ? 13 : 12} onBoundsChange={onBounds} activeId={activeId}
            onPinClick={(c) => setActiveId(c.id)} radius={nearMode ? point.radiusKm : null} zoomTarget={zoomTarget} onClusterClick={(c) => setZoomTarget({ ...c })} />
          {q.isFetching && <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center"><span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm shadow"><Spinner size="sm" />{t('search.map.loading')}</span></div>}
          {!follow && pending && (
            <div className="absolute inset-x-0 top-3 z-[500] flex justify-center">
              <Button size="sm" onClick={() => { setBbox(pending); setPending(null); }}>{t('search.map.searchArea')}</Button>
            </div>
          )}
          {!nearMode && clusters.length > 0 && zoom < 11 && <div className="pointer-events-none absolute inset-x-0 bottom-16 z-[500] flex justify-center lg:bottom-4"><span className="rounded-full bg-ink/80 px-3 py-1.5 text-sm text-white">{t('search.map.zoomIn')}</span></div>}
          {q.isError && <div className="absolute inset-x-3 top-3 z-[500] lg:hidden"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>}
          <button type="button" onClick={() => setShowList(true)} className="absolute bottom-4 left-1/2 z-[500] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-lg lg:hidden">
            <List className="h-4 w-4" aria-hidden />{t('search.map.showN', { n: total })}
          </button>
        </div>
      </div>

      <Drawer open={showList} onClose={() => setShowList(false)} title={t('search.map.count', { n: total })} side="right">
        <div className="p-3">{list}</div>
        <div className="sticky bottom-0 border-t bg-white p-3"><Button block icon={MapIcon} onClick={() => setShowList(false)}>{t('search.map.backToMap')}</Button></div>
      </Drawer>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t('search.list.filters')} side="right">
        <div className="p-4"><FilterPanel filters={filters} onChange={update} /></div>
        <div className="sticky bottom-0 border-t bg-white p-3"><Button block onClick={() => setDrawer(false)}>{t('search.map.showResults')}</Button></div>
      </Drawer>
    </div>
  );
}
