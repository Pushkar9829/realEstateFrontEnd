// RE-S-PUB-02 filter sidebar (a drawer on mobile). Every change is a patch
// applied to the URL by the page.
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { shortRupees } from '@/shared/lib/format';
import { Checkbox, Select } from '@/shared/ui';
import { useCities, useLocalities, useMasters } from '@/modules/listings/api';
import { BHK_OPTIONS, BUDGETS, CATEGORIES, FURNISHING, POSSESSION, POSTED_BY, csvList, toggleCsv } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import { enumLabel } from './useSearchFilters';

function Group({ title, children, className }) {
  return (
    <fieldset className={cn('border-b border-line py-4 first:pt-0 last:border-0', className)}>
      <legend className="mb-2 text-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-sm transition-colors', on ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-line-strong bg-white text-ink-muted hover:border-brand-300')}>
      {children}
    </button>
  );
}

export function useCityCode(city) {
  const cities = useCities();
  return useMemo(() => {
    if (!city) return '';
    const c = (cities.data || []).find((x) => [x.code, x.slug, x.name && x.name.toLowerCase()].includes(String(city).toLowerCase()));
    return c ? c.code : city;
  }, [cities.data, city]);
}

export default function FilterPanel({ filters: f, onChange }) {
  const t = useT();
  const cities = useCities();
  const masters = useMasters();
  const cityCode = useCityCode(f.city);
  const localities = useLocalities(cityCode);
  const [locQ, setLocQ] = useState('');
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const purpose = f.purpose || 'sale';
  const types = ((masters.data && masters.data.propertyTypes) || []).filter((pt) => !f.category || !pt.meta || !pt.meta.category || pt.meta.category === f.category);
  const amenities = (masters.data && masters.data.amenities) || [];
  const locs = (localities.data || []).filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase()));
  const selectedLocs = csvList(f.localities);
  const budgets = BUDGETS[purpose] || BUDGETS.sale;

  return (
    <div className="text-sm">
      <Group title={t('search.filters.lookingTo')}>
        <div className="flex gap-2">
          {[['sale', 'common.buy'], ['rent', 'common.rent']].map(([v, l]) => <Chip key={v} on={purpose === v} onClick={() => onChange({ purpose: v, minPrice: undefined, maxPrice: undefined })}>{t(l)}</Chip>)}
        </div>
      </Group>
      <Group title={t('search.filters.cityLocalities')}>
        <Select aria-label={t('common.city')} value={cityCode} onChange={(e) => onChange({ city: e.target.value || undefined, localities: undefined })}
          placeholder={t('search.filters.anyCity')} options={(cities.data || []).map((c) => ({ value: c.code, label: c.name }))} />
        {cityCode && (
          <div className="mt-3">
            <input value={locQ} onChange={(e) => setLocQ(e.target.value)} placeholder={t('search.filters.filterLocalities')} aria-label={t('search.filters.filterLocalities')}
              className="h-9 w-full rounded-md border border-line-strong px-3 text-sm focus:border-brand-500 focus:outline-none" />
            <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {localities.isLoading && <p className="text-xs text-ink-subtle">{t('search.filters.loadingLocalities')}</p>}
              {locs.map((l) => {
                const on = selectedLocs.includes(l.code) || selectedLocs.includes(l._id);
                const next = on ? selectedLocs.filter((x) => x !== l.code && x !== l._id) : [...selectedLocs, l.code];
                return (
                  <Checkbox key={l._id} label={l.name} checked={on} disabled={!on && selectedLocs.length >= 10}
                    onChange={() => onChange({ localities: next.join(',') || undefined })} />
                );
              })}
              {!localities.isLoading && !locs.length && <p className="text-xs text-ink-subtle">{t('search.filters.noLocalities')}</p>}
            </div>
            {selectedLocs.length >= 10 && <p className="mt-1 text-xs text-ink-subtle">{t('search.filters.upTo10')}</p>}
          </div>
        )}
      </Group>
      <Group title={t('search.filters.propertyType')}>
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip on={!f.category} onClick={() => onChange({ category: undefined, types: undefined })}>{t('search.filters.all')}</Chip>
          {Object.keys(CATEGORIES).map((v) => <Chip key={v} on={f.category === v} onClick={() => onChange({ category: v, types: undefined, ...(v !== 'residential' ? { bhk: undefined, furnishing: undefined } : {}) })}>{enumLabel(t, 'category', v)}</Chip>)}
        </div>
        <div className="space-y-1.5">
          {types.map((pt) => <Checkbox key={pt.code} label={pt.name} checked={csvList(f.types).includes(pt.code)} onChange={() => onChange({ types: toggleCsv(f.types, pt.code) || undefined })} />)}
        </div>
      </Group>
      {f.category !== 'commercial' && f.category !== 'land' && (
        <Group title={t('search.filters.bhk')}>
          <div className="flex flex-wrap gap-2">
            {BHK_OPTIONS.map((b) => <Chip key={b} on={csvList(f.bhk).includes(b)} onClick={() => onChange({ bhk: toggleCsv(f.bhk, b) || undefined })}>{t('search.card.bhk', { n: b })}</Chip>)}
          </div>
        </Group>
      )}
      <Group title={purpose === 'rent' ? t('search.filters.monthlyRent') : t('search.filters.budget')}>
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label={t('search.filters.minPrice')} value={f.minPrice || ''} placeholder={t('search.filters.noMin')}
            onChange={(e) => onChange({ minPrice: e.target.value || undefined, ...(f.maxPrice && Number(e.target.value) > Number(f.maxPrice) ? { maxPrice: undefined } : {}) })}
            options={budgets.map((b) => ({ value: String(b), label: shortRupees(b * 100) }))} />
          <Select aria-label={t('search.filters.maxPrice')} value={f.maxPrice || ''} placeholder={t('search.filters.noMax')}
            onChange={(e) => onChange({ maxPrice: e.target.value || undefined })}
            options={budgets.filter((b) => !f.minPrice || b >= Number(f.minPrice)).map((b) => ({ value: String(b), label: shortRupees(b * 100) }))} />
        </div>
      </Group>
      <Group title={t('search.filters.area')}>
        <div className="grid grid-cols-2 gap-2">
          {[['minArea', 'min'], ['maxArea', 'max']].map(([k, l]) => (
            <input key={`${k}-${f[k] || ''}`} type="number" min="0" inputMode="numeric" placeholder={t(`search.filters.${l}`)} aria-label={t(`search.filters.${k}`)} defaultValue={f[k] || ''}
              onBlur={(e) => onChange({ [k]: e.target.value && Number(e.target.value) >= 0 ? e.target.value : undefined })}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="h-10 w-full rounded-md border border-line-strong px-3 text-sm focus:border-brand-500 focus:outline-none" />
          ))}
        </div>
      </Group>
      {f.category !== 'land' && (
        <Group title={t('search.filters.furnishing')}>
          <div className="flex flex-wrap gap-2">{Object.keys(FURNISHING).map((v) => <Chip key={v} on={csvList(f.furnishing).includes(v)} onClick={() => onChange({ furnishing: toggleCsv(f.furnishing, v) || undefined })}>{enumLabel(t, 'furnishing', v)}</Chip>)}</div>
        </Group>
      )}
      <Group title={t('search.filters.possession')}>
        <div className="flex flex-wrap gap-2">
          <Chip on={!f.possession} onClick={() => onChange({ possession: undefined })}>{t('search.filters.any')}</Chip>
          {Object.keys(POSSESSION).map((v) => <Chip key={v} on={f.possession === v} onClick={() => onChange({ possession: v })}>{enumLabel(t, 'possession', v)}</Chip>)}
        </div>
      </Group>
      <Group title={t('search.filters.postedBy')}>
        <div className="flex flex-wrap gap-2">
          <Chip on={!f.postedBy} onClick={() => onChange({ postedBy: undefined })}>{t('search.filters.anyone')}</Chip>
          {Object.keys(POSTED_BY).map((v) => <Chip key={v} on={f.postedBy === v} onClick={() => onChange({ postedBy: v })}>{enumLabel(t, 'postedBy', v)}</Chip>)}
        </div>
      </Group>
      <Group title={t('search.filters.trust')}>
        <div className="flex items-start gap-2">
          <Checkbox label={t('search.filters.verifiedOnly')} description={t('search.filters.verifiedDesc')} checked={Boolean(f.verified)} onChange={(e) => onChange({ verified: e.target.checked ? '1' : undefined })} />
          <span className="group relative mt-0.5">
            <button type="button" className="text-ink-subtle hover:text-ink" aria-label={t('search.filters.whatVerified')}><Info className="h-4 w-4" /></button>
            <span role="tooltip" className="absolute right-0 top-6 z-20 hidden w-64 rounded-md bg-ink px-3 py-2 text-xs text-white shadow-lg group-focus-within:block group-hover:block">
              {t('search.filters.verifiedTip')}
            </span>
          </span>
        </div>
      </Group>
      {amenities.length > 0 && (
        <Group title={t('search.filters.amenities')}>
          <div className="space-y-1.5">
            {(showAllAmenities ? amenities : amenities.slice(0, 8)).map((a) => <Checkbox key={a.code} label={a.name} checked={csvList(f.amenities).includes(a.code)} onChange={() => onChange({ amenities: toggleCsv(f.amenities, a.code) || undefined })} />)}
          </div>
          {amenities.length > 8 && <button type="button" className="mt-2 text-xs font-medium text-brand-700 hover:underline" onClick={() => setShowAllAmenities((s) => !s)}>{showAllAmenities ? t('search.filters.showFewer') : t('search.filters.showAll', { n: amenities.length })}</button>}
        </Group>
      )}
    </div>
  );
}
