// Pieces shared by the list and map search pages: active filter chips, the
// compare tray, the remembered city and the save-search action.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellPlus, GitCompareArrows, X } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { BUDGETS, csvList, toggleCsv, useCompareIds, usePublicSettings } from '@/modules/search/api';
import { shortRupees } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { SaveSearchModal } from './SmallModals';
import { enumLabel } from './useSearchFilters';

import { lastCity, rememberCity } from '@/modules/search/prefs';

// The remembered city lives in modules/search/prefs (shared with the header selector).
export { lastCity, rememberCity };

// Fills a missing city from the last choice or the default city (RE-S-PUB-01 city field).
export function useDefaultCity(filters, update) {
  const settings = usePublicSettings();
  const defaultCity = settings.data && settings.data.defaultCity;
  const missing = !filters.city && !filters.q && !filters.localities;
  useEffect(() => {
    if (!missing) return;
    const c = lastCity() || defaultCity;
    if (c) update({ city: c }, { keepPage: true, replace: true });
  }, [missing, defaultCity]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rememberCity(filters.city); }, [filters.city]);
}

export function ActiveChips({ filters: f, update, clear, localityNames = {} }) {
  const t = useT();
  const chips = [];
  const add = (key, label, patch) => chips.push({ key, label, patch });
  csvList(f.localities).forEach((l) => add(`loc-${l}`, localityNames[l] || l, { localities: toggleCsv(f.localities, l) || undefined }));
  if (f.category) add('category', enumLabel(t, 'category', f.category), { category: undefined, types: undefined });
  csvList(f.types).forEach((x) => add(`type-${x}`, x.replace(/_/g, ' '), { types: toggleCsv(f.types, x) || undefined }));
  csvList(f.bhk).forEach((b) => add(`bhk-${b}`, t('search.card.bhk', { n: b }), { bhk: toggleCsv(f.bhk, b) || undefined }));
  if (f.minPrice) add('min', t('search.chips.from', { price: shortRupees(f.minPrice * 100) }), { minPrice: undefined });
  if (f.maxPrice) add('max', t('search.chips.upTo', { price: shortRupees(f.maxPrice * 100) }), { maxPrice: undefined });
  if (f.minArea) add('mina', t('search.chips.minArea', { n: f.minArea }), { minArea: undefined });
  if (f.maxArea) add('maxa', t('search.chips.maxArea', { n: f.maxArea }), { maxArea: undefined });
  csvList(f.furnishing).forEach((x) => add(`fur-${x}`, enumLabel(t, 'furnishing', x), { furnishing: toggleCsv(f.furnishing, x) || undefined }));
  if (f.possession) add('pos', enumLabel(t, 'possession', f.possession), { possession: undefined });
  if (f.postedBy) add('by', t('search.chips.by', { who: enumLabel(t, 'postedBy', f.postedBy) }), { postedBy: undefined });
  if (f.verified) add('ver', t('search.filters.verifiedOnly'), { verified: undefined });
  csvList(f.amenities).forEach((a) => add(`am-${a}`, a.replace(/_/g, ' '), { amenities: toggleCsv(f.amenities, a) || undefined }));
  if (f.q) add('q', `"${f.q}"`, { q: undefined });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={() => update(c.patch)} className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-navy-900 pl-3.5 pr-2.5 text-xs font-medium capitalize text-white shadow-sm transition-colors hover:bg-navy-800">
          {c.label}<X className="h-3.5 w-3.5 text-gold-300 transition-colors group-hover:text-white" aria-label={t('search.chips.remove')} />
        </button>
      ))}
      <button type="button" onClick={clear} className="px-1.5 text-xs font-semibold text-navy-600 underline decoration-gold-400 underline-offset-4 hover:text-navy-900">{t('search.chips.clearAll')}</button>
    </div>
  );
}

export function SaveSearchButton({ filters, size = 'sm', variant = 'outline', label, className = 'rounded-full' }) {
  const t = useT();
  const { isAuthed, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (isAuthed && !['buyer', 'lister'].includes(user.role)) return null;
  return (
    <>
      <Button size={size} variant={variant} icon={BellPlus} className={className}
        onClick={() => (isAuthed ? setOpen(true) : navigate('/login', { state: { from: location.pathname + location.search } }))}>{label || t('search.saveThis')}</Button>
      <SaveSearchModal open={open} onClose={() => setOpen(false)} filters={filters} />
    </>
  );
}

export function CompareTray() {
  const t = useT();
  const { ids, clear } = useCompareIds();
  if (!ids.length) return null;
  return (
    <div style={{ bottom: 'var(--cookie-bar, 0px)' }} className="fixed inset-x-0 bottom-0 z-30 bg-navy-950/95 px-4 py-3 text-white shadow-lift ring-1 ring-white/10 backdrop-blur-md sm:mb-5 sm:left-auto sm:right-6 sm:rounded-full sm:py-2 sm:pl-5 sm:pr-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-sm text-navy-100"><GitCompareArrows className="h-4 w-4 text-gold-300" aria-hidden />{t('search.tray.before')}<span className="font-display text-base font-semibold text-white">{ids.length}</span>{t('search.tray.after')}</span>
        <div className="flex gap-2">
          <button type="button" onClick={clear} className="h-8 rounded-full px-3 text-sm font-medium text-navy-200 transition-colors hover:bg-white/10 hover:text-white">{t('search.tray.clear')}</button>
          <Button size="sm" variant="gold" icon={GitCompareArrows} to="/compare" disabled={ids.length < 2} className="rounded-full px-4">{t('search.tray.compare')}</Button>
        </div>
      </div>
    </div>
  );
}

export const budgetsFor = (purpose) => BUDGETS[purpose === 'rent' ? 'rent' : 'sale'];

export function centroidOf(city) {
  const c = city && city.meta && city.meta.centroid && city.meta.centroid.coordinates;
  return c ? [c[1], c[0]] : null;
}
