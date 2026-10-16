// Step 3: configuration, areas (with unit), floor, furnishing, possession and parking.
import { useState } from 'react';
import { Input, Select } from '@/shared/ui';
import { clean, num, Segmented, StepFooter, StepMessages, useStepSave } from './common';

const UNITS = [['sqft', 'sq ft'], ['sqm', 'sq m'], ['sqyd', 'sq yd'], ['acre', 'acre'], ['hectare', 'hectare'], ['bigha', 'bigha']];

export default function DetailsStep({ listing, next, back }) {
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
          <Select label="Bedrooms (BHK)" placeholder="Select" {...f('bhk')} options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n === 0 ? 'Studio / 1 RK' : `${n} BHK` }))} error={s.errors.bhk} />
          <Input label="Bathrooms" type="number" min={0} max={20} {...f('baths')} error={s.errors.baths} />
          <Input label="Balconies" type="number" min={0} max={20} {...f('balconies')} />
        </div>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">Area <span className="text-danger-600">*</span> <span className="text-xs font-normal text-ink-subtle">give at least one</span></p>
          <select className="h-9 rounded-md border border-line-strong px-2 text-sm" {...f('unit')} aria-label="Area unit">{UNITS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {!land && <Input label="Carpet" type="number" min={0} {...f('carpet')} />}
          {!land && <Input label="Built-up" type="number" min={0} {...f('builtUp')} />}
          {!land && <Input label="Super built-up" type="number" min={0} {...f('superBuiltUp')} />}
          <Input label={land ? 'Plot area' : 'Plot (if any)'} type="number" min={0} {...f('plot')} />
        </div>
        {areaErr && <p className="mt-1 text-xs text-danger-600">{areaErr}</p>}
      </div>
      {!land && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Floor" type="number" min={-3} max={200} hint="0 = ground, -1 = basement" {...f('floor')} error={s.errors.floor} />
          <Input label="Total floors" type="number" min={0} max={200} {...f('totalFloors')} />
          <Input label="Age of property (years)" type="number" min={0} max={150} {...f('ageYears')} />
          <Select label="Furnishing" placeholder="Select" {...f('furnishing')} options={[{ value: 'unfurnished', label: 'Unfurnished' }, { value: 'semi', label: 'Semi-furnished' }, { value: 'full', label: 'Fully furnished' }]} />
          <Select label="Facing" placeholder="Select" {...f('facing')} options={['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'].map((x) => ({ value: x, label: x }))} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-ink">Possession</p>
          <Segmented options={[{ value: 'ready', label: 'Ready to move' }, { value: 'under_construction', label: 'Under construction' }]} value={v.possession} onChange={(p) => setV((x) => ({ ...x, possession: p }))} />
        </div>
        {v.possession === 'under_construction' && <Input label="Expected possession" type="date" {...f('possessionDate')} />}
      </div>
      {!land && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Covered parking" type="number" min={0} max={50} {...f('covered')} />
          <Input label="Open parking" type="number" min={0} max={50} {...f('open')} />
        </div>
      )}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </div>
  );
}
