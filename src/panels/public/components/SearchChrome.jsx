// Pieces shared by the list and map search pages: active filter chips, the
// compare tray, the remembered city and the save-search action.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellPlus, GitCompareArrows, X } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { BUDGETS, CATEGORIES, FURNISHING, POSSESSION, POSTED_BY, csvList, toggleCsv, useCompareIds, usePublicSettings } from '@/modules/search/api';
import { shortRupees } from '@/shared/lib/format';
import { SaveSearchModal } from './SmallModals';

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
  const chips = [];
  const add = (key, label, patch) => chips.push({ key, label, patch });
  csvList(f.localities).forEach((l) => add(`loc-${l}`, localityNames[l] || l, { localities: toggleCsv(f.localities, l) || undefined }));
  if (f.category) add('category', CATEGORIES[f.category], { category: undefined, types: undefined });
  csvList(f.types).forEach((t) => add(`type-${t}`, t.replace(/_/g, ' '), { types: toggleCsv(f.types, t) || undefined }));
  csvList(f.bhk).forEach((b) => add(`bhk-${b}`, `${b} BHK`, { bhk: toggleCsv(f.bhk, b) || undefined }));
  if (f.minPrice) add('min', `From ${shortRupees(f.minPrice * 100)}`, { minPrice: undefined });
  if (f.maxPrice) add('max', `Up to ${shortRupees(f.maxPrice * 100)}`, { maxPrice: undefined });
  if (f.minArea) add('mina', `${f.minArea}+ sq ft`, { minArea: undefined });
  if (f.maxArea) add('maxa', `Under ${f.maxArea} sq ft`, { maxArea: undefined });
  csvList(f.furnishing).forEach((x) => add(`fur-${x}`, FURNISHING[x] || x, { furnishing: toggleCsv(f.furnishing, x) || undefined }));
  if (f.possession) add('pos', POSSESSION[f.possession], { possession: undefined });
  if (f.postedBy) add('by', `By ${POSTED_BY[f.postedBy]}`, { postedBy: undefined });
  if (f.verified) add('ver', 'Verified only', { verified: undefined });
  csvList(f.amenities).forEach((a) => add(`am-${a}`, a.replace(/_/g, ' '), { amenities: toggleCsv(f.amenities, a) || undefined }));
  if (f.q) add('q', `"${f.q}"`, { q: undefined });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={() => update(c.patch)} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700 hover:bg-brand-100">
          {c.label}<X className="h-3 w-3" aria-label="Remove" />
        </button>
      ))}
      <button type="button" onClick={clear} className="px-1 text-xs font-medium text-ink-muted hover:text-ink hover:underline">Clear all</button>
    </div>
  );
}

export function SaveSearchButton({ filters, size = 'sm', variant = 'secondary', label = 'Save this search' }) {
  const { isAuthed, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (isAuthed && !['buyer', 'lister'].includes(user.role)) return null;
  return (
    <>
      <Button size={size} variant={variant} icon={BellPlus}
        onClick={() => (isAuthed ? setOpen(true) : navigate('/login', { state: { from: location.pathname + location.search } }))}>{label}</Button>
      <SaveSearchModal open={open} onClose={() => setOpen(false)} filters={filters} />
    </>
  );
}

export function CompareTray() {
  const { ids, clear } = useCompareIds();
  if (!ids.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:bottom-4 sm:left-auto sm:right-6 sm:rounded-lg sm:border">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink"><span className="font-semibold">{ids.length}</span> of 4 selected to compare</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          <Button size="sm" icon={GitCompareArrows} to="/compare" disabled={ids.length < 2}>Compare</Button>
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
