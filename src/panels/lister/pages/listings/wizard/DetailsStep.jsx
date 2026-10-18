// Step 3: configuration, areas (with unit), floor, furnishing, possession and parking.
import { useState } from 'react';
import { Input, Select } from '@/shared/ui';
import { clean, num, Segmented, StepFooter, StepMessages, useStepSave } from './common';
import { useT } from '@/shared/i18n';

const UNITS = ['sqft', 'sqm', 'sqyd', 'acre', 'hectare', 'bigha'];
const FACING = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];

export default function DetailsStep({ listing, next, back }) {
  const t = useT();
  const d = listing.details || {};
  const land = listing.category === 'land';
  const residential = listing.category === 'residential';
  const [v, setV] = useState({
    bhk: d.bhk ?? '', baths: d.baths ?? '', balconies: d.balconies ?? '',
    carpet: d.areas?.carpet ?? '', builtUp: d.areas?.builtUp ?? '', superBuiltUp: d.areas?.superBuiltUp ?? '', plot: d.areas?.plot ?? '', unit: d.areas?.unit || 'sqft',
    floor: d.floor ?? '', totalFloors: d.totalFloors ?? '', furnishing: d.furnishing || '', facing: d.facing || '', ageYears: d.ageYears ?? '',
    possession: d.possession?.status || 'ready', possessionDate: d.possession?.date ? String(d.possession.date).slice(0, 10) : '',
    covered: d.parking?.covered ?? 0, open: d.parking?.open ?? 0,
  });
  const body = () => clean({
    ...(residential ? { bhk: num(v.bhk), baths: num(v.baths), balconies: num(v.balconies) } : {}),
    areas: clean({ carpet: num(v.carpet), builtUp: num(v.builtUp), superBuiltUp: num(v.superBuiltUp), plot: num(v.plot), unit: v.unit }),
    ...(land ? {} : { floor: num(v.floor), totalFloors: num(v.totalFloors), furnishing: v.furnishing || undefined, facing: v.facing || undefined, ageYears: num(v.ageYears) }),
    possession: { status: v.possession, ...(v.possession === 'under_construction' && v.possessionDate ? { date: v.possessionDate } : {}) },
    ...(land ? {} : { parking: { covered: num(v.covered) || 0, open: num(v.open) || 0 } }),
  });
  const s = useStepSave(listing, 3, { onSaved: next, value: v, build: body });
  const f = (k) => ({ value: v[k], onChange: (e) => setV((x) => ({ ...x, [k]: e.target.value })) });
  const areaErr = s.errors.areas;
  const save = () => s.run(body());

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} />
      {residential && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label={t('lister.wizard.details.bhk')} placeholder={t('lister.wizard.select')} {...f('bhk')} options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n === 0 ? t('lister.wizard.details.studio') : `${n} BHK` }))} error={s.errors.bhk} />
          <Input label={t('lister.wizard.details.baths')} type="number" min={0} max={20} {...f('baths')} error={s.errors.baths} />
          <Input label={t('lister.wizard.details.balconies')} type="number" min={0} max={20} {...f('balconies')} />
        </div>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">{t('lister.wizard.details.area')} <span className="text-danger-600">*</span> <span className="text-xs font-normal text-ink-subtle">{t('lister.wizard.details.atLeastOne')}</span></p>
          <select className="h-9 rounded-md border border-line-strong px-2 text-sm" {...f('unit')} aria-label={t('lister.wizard.details.areaUnit')}>{UNITS.map((c) => <option key={c} value={c}>{t(`lister.wizard.units.${c}`)}</option>)}</select>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {!land && <Input label={t('lister.wizard.details.carpet')} type="number" min={0} {...f('carpet')} />}
          {!land && <Input label={t('lister.wizard.details.builtUp')} type="number" min={0} {...f('builtUp')} />}
          {!land && <Input label={t('lister.wizard.details.superBuiltUp')} type="number" min={0} {...f('superBuiltUp')} />}
          <Input label={land ? t('lister.wizard.details.plotArea') : t('lister.wizard.details.plotAny')} type="number" min={0} {...f('plot')} />
        </div>
        {areaErr && <p className="mt-1 text-xs text-danger-600">{areaErr}</p>}
      </div>
      {!land && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t('lister.wizard.details.floor')} type="number" min={-3} max={200} hint={t('lister.wizard.details.floorHint')} {...f('floor')} error={s.errors.floor} />
          <Input label={t('lister.wizard.details.totalFloors')} type="number" min={0} max={200} {...f('totalFloors')} />
          <Input label={t('lister.wizard.details.age')} type="number" min={0} max={150} {...f('ageYears')} />
          <Select label={t('lister.wizard.details.furnishing')} placeholder={t('lister.wizard.select')} {...f('furnishing')} options={['unfurnished', 'semi', 'full'].map((x) => ({ value: x, label: t(`lister.wizard.details.furnish.${x}`) }))} />
          <Select label={t('lister.wizard.details.facing')} placeholder={t('lister.wizard.select')} {...f('facing')} options={FACING.map((x) => ({ value: x, label: t(`lister.wizard.details.directions.${x}`) }))} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-ink">{t('lister.wizard.details.possession')}</p>
          <Segmented options={[{ value: 'ready', label: t('lister.wizard.details.ready') }, { value: 'under_construction', label: t('lister.wizard.details.underConstruction') }]} value={v.possession} onChange={(p) => setV((x) => ({ ...x, possession: p }))} />
        </div>
        {v.possession === 'under_construction' && <Input label={t('lister.wizard.details.expected')} type="date" {...f('possessionDate')} />}
      </div>
      {!land && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t('lister.wizard.details.covered')} type="number" min={0} max={50} {...f('covered')} />
          <Input label={t('lister.wizard.details.open')} type="number" min={0} max={50} {...f('open')} />
        </div>
      )}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </div>
  );
}
