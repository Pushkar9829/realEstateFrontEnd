// RE-S-PUB-02 filter sidebar (a drawer on mobile). Every change is a patch
// applied to the URL by the page.
import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { shortRupees } from '@/shared/lib/format';
import { useCities, useLocalities, useMasters } from '@/modules/listings/api';
import { BHK_OPTIONS, BUDGETS, CATEGORIES, FURNISHING, POSSESSION, POSTED_BY, csvList, toggleCsv } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import { enumLabel } from './useSearchFilters';

// Sand inputs, rounded-xl, gold focus ring (docs/PUBLIC_DESIGN.md).
export const FIELD = 'w-full rounded-xl border-0 bg-sand-100 text-sm text-navy-900 ring-1 ring-inset ring-navy-900/10 placeholder:text-navy-500 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500';

function Group({ title, children, className }) {
  return (
    <fieldset className={cn('border-b border-navy-900/5 pb-5 last:border-0 last:pb-0 [&:first-child>legend]:pt-0', className)}>
      <legend className="mb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn('min-h-[36px] rounded-full px-3.5 py-1.5 text-sm transition-all', on ? 'bg-navy-900 font-medium text-white shadow-sm' : 'bg-white text-navy-600 ring-1 ring-inset ring-navy-900/10 hover:text-navy-900 hover:ring-navy-900/30')}>
      {children}
    </button>
  );
}

// Native select in the public skin (same API as the shared Select used before).
function Select({ options = [], placeholder, className, ...rest }) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(FIELD, 'h-11 appearance-none pl-3.5 pr-9')} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-500" aria-hidden />
    </div>
  );
}

// Checkbox with a navy box and a gold focus ring (same props as the shared Checkbox).
function Checkbox({ label, description, checked, disabled, onChange }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('group flex cursor-pointer items-start gap-3 rounded-lg py-1', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0">
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={onChange}
          className="peer absolute inset-0 h-full w-full cursor-[inherit] appearance-none rounded-[5px] border-0 bg-white ring-1 ring-inset ring-navy-900/25 transition checked:bg-navy-900 checked:ring-navy-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500" />
        <Check className="pointer-events-none relative m-auto hidden h-3 w-3 text-white peer-checked:block" strokeWidth={3} aria-hidden />
      </span>
      <span className="text-sm">
        <span className="text-navy-700 group-hover:text-navy-900">{label}</span>
        {description && <span className="block text-xs leading-relaxed text-navy-500">{description}</span>}
      </span>
    </label>
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
              className={cn(FIELD, 'h-10 px-3.5')} />
            <div className="mt-3 max-h-48 space-y-0.5 overflow-y-auto pr-1">
              {localities.isLoading && <p className="text-xs text-navy-500">{t('search.filters.loadingLocalities')}</p>}
              {locs.map((l) => {
                const on = selectedLocs.includes(l.code) || selectedLocs.includes(l._id);
                const next = on ? selectedLocs.filter((x) => x !== l.code && x !== l._id) : [...selectedLocs, l.code];
                return (
                  <Checkbox key={l._id} label={l.name} checked={on} disabled={!on && selectedLocs.length >= 10}
                    onChange={() => onChange({ localities: next.join(',') || undefined })} />
                );
              })}
              {!localities.isLoading && !locs.length && <p className="text-xs text-navy-500">{t('search.filters.noLocalities')}</p>}
            </div>
            {selectedLocs.length >= 10 && <p className="mt-1 text-xs text-navy-500">{t('search.filters.upTo10')}</p>}
          </div>
        )}
      </Group>
      <Group title={t('search.filters.propertyType')}>
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip on={!f.category} onClick={() => onChange({ category: undefined, types: undefined })}>{t('search.filters.all')}</Chip>
          {Object.keys(CATEGORIES).map((v) => <Chip key={v} on={f.category === v} onClick={() => onChange({ category: v, types: undefined, ...(v !== 'residential' ? { bhk: undefined, furnishing: undefined } : {}) })}>{enumLabel(t, 'category', v)}</Chip>)}
        </div>
        <div className="space-y-0.5">
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
              className={cn(FIELD, 'h-11 px-3.5')} />
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
            <button type="button" className="text-navy-500 hover:text-navy-900" aria-label={t('search.filters.whatVerified')}><Info className="h-4 w-4" /></button>
            <span role="tooltip" className="absolute right-0 top-6 z-20 hidden w-64 rounded-xl bg-navy-900 px-3.5 py-2.5 text-xs leading-relaxed text-navy-100 shadow-lift group-focus-within:block group-hover:block">
              {t('search.filters.verifiedTip')}
            </span>
          </span>
        </div>
      </Group>
      {amenities.length > 0 && (
        <Group title={t('search.filters.amenities')}>
          <div className="space-y-0.5">
            {(showAllAmenities ? amenities : amenities.slice(0, 8)).map((a) => <Checkbox key={a.code} label={a.name} checked={csvList(f.amenities).includes(a.code)} onChange={() => onChange({ amenities: toggleCsv(f.amenities, a.code) || undefined })} />)}
          </div>
          {amenities.length > 8 && <button type="button" className="mt-3 text-xs font-semibold text-navy-900 underline decoration-gold-400 underline-offset-4 hover:text-gold-700" onClick={() => setShowAllAmenities((s) => !s)}>{showAllAmenities ? t('search.filters.showFewer') : t('search.filters.showAll', { n: amenities.length })}</button>}
        </Group>
      )}
    </div>
  );
}
