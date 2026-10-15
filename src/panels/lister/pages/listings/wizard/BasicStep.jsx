// Step 1: purpose, category, property type, title and description (RE-A-01/02/03).
import { useState } from 'react';
import { Field, Input, Select, Textarea } from '@/shared/ui';
import { useMasters } from '@/modules/listings/api';
import { Segmented, StepFooter, StepMessages, useStepSave } from './common';

const CATEGORIES = [{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }, { value: 'land', label: 'Land / plot' }];

export default function BasicStep({ listing, next }) {
  const masters = useMasters();
  const done = (listing.wizard?.stepsDone || []).includes(1);
  const [v, setV] = useState({
    purpose: listing.purpose || 'sale', category: listing.category || 'residential', type: done ? listing.type : '',
    title: listing.title || '', description: listing.description || '',
  });
  const s = useStepSave(listing, 1, { onSaved: next });
  const types = ((masters.data && masters.data.propertyTypes) || []).filter((t) => !t.meta || !t.meta.category || t.meta.category === v.category);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} />
      <Field label="I want to">{() => <div><Segmented options={[{ value: 'sale', label: 'Sell' }, { value: 'rent', label: 'Rent out' }]} value={v.purpose} onChange={set('purpose')} /></div>}</Field>
      <Field label="Category">{() => <div><Segmented options={CATEGORIES} value={v.category} onChange={(c) => setV((x) => ({ ...x, category: c, type: '' }))} /></div>}</Field>
      <Select label="Property type" required placeholder="Choose a type" value={v.type} onChange={(e) => set('type')(e.target.value)}
        options={types.map((t) => ({ value: t.code, label: t.name }))} error={s.errors.type} />
      <Input label="Title" required maxLength={100} placeholder="e.g. 2 BHK apartment in Baner with park view" value={v.title} onChange={(e) => set('title')(e.target.value)}
        hint={`${v.title.length}/100 · at least 10 characters. No phone numbers or names.`} error={s.errors.title} />
      <Textarea label="Description" required rows={6} maxLength={5000} value={v.description} onChange={(e) => set('description')(e.target.value)}
        hint={`${v.description.length}/5000 · at least 50 characters. Describe the layout, condition and surroundings. Contact details are blocked.`} error={s.errors.description} />
      <StepFooter saving={s.saving} onSave={() => s.run(v)} />
    </div>
  );
}
