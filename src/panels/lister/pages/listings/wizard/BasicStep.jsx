// Step 1: purpose, category, property type, title and description (RE-A-01/02/03).
// Builders may link the listing to one of their live projects and a
// configuration (RE-G-07); location, amenities and RERA then come from the project.
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Alert, Field, Input, Select, Textarea } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { useMasters } from '@/modules/listings/api';
import { useOwnProjects } from '@/modules/projects/api';
import { Segmented, StepFooter, StepMessages, useStepSave } from './common';

const CATEGORIES = [{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }, { value: 'land', label: 'Land / plot' }];

function ProjectPicker({ value, onChange, errors, lockedTo }) {
  const projects = useOwnProjects({ status: 'live', limit: 100 });
  const list = (projects.data && projects.data.items) || [];
  const project = list.find((p) => p._id === value.projectId);
  if (lockedTo) {
    return <Alert tone="info">Part of {lockedTo.name}{lockedTo.config ? ` · ${lockedTo.config.name}` : ''}. Location, amenities and RERA come from the project.</Alert>;
  }
  return (
    <div className="rounded-lg border bg-surface-muted p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink"><Building2 className="h-4 w-4 text-brand-600" aria-hidden /> Unit in one of your projects (optional)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Project" placeholder={list.length ? 'Not part of a project' : 'No live projects'} disabled={!list.length} value={value.projectId}
          onChange={(e) => onChange({ projectId: e.target.value, unitConfigId: '' })} options={list.map((p) => ({ value: p._id, label: `${p.name} (${p.projectNo})` }))} error={errors.projectId} />
        {project && (
          <Select label="Configuration" required placeholder="Choose a configuration" value={value.unitConfigId}
            onChange={(e) => onChange({ ...value, unitConfigId: e.target.value })} options={(project.configurations || []).map((c) => ({ value: c._id, label: c.name }))} error={errors.unitConfigId} />
        )}
      </div>
      <p className="mt-2 text-xs text-ink-subtle">A linked listing takes its location, amenities and RERA from the project; you add the unit's details, price and photos.</p>
    </div>
  );
}

export default function BasicStep({ listing, next }) {
  const masters = useMasters();
  const { user } = useAuth();
  const builder = user.listerType === 'builder';
  const done = (listing.wizard?.stepsDone || []).includes(1);
  const [v, setV] = useState({
    purpose: listing.purpose || 'sale', category: listing.category || 'residential', type: done ? listing.type : '',
    title: listing.title || '', description: listing.description || '',
  });
  const [link, setLink] = useState({ projectId: '', unitConfigId: '' });
  const linkedTo = listing.projectId ? listing.project || { name: 'a project' } : null;
  const body = () => ({ ...v, ...(!linkedTo && link.projectId ? link : {}) });
  const s = useStepSave(listing, 1, { onSaved: next, value: { v, link }, build: body });
  const types = ((masters.data && masters.data.propertyTypes) || []).filter((t) => !t.meta || !t.meta.category || t.meta.category === v.category);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} />
      {builder && <ProjectPicker value={link} onChange={setLink} errors={s.errors} lockedTo={linkedTo} />}
      <Field label="I want to">{() => <div><Segmented options={[{ value: 'sale', label: 'Sell' }, { value: 'rent', label: 'Rent out' }]} value={v.purpose} onChange={set('purpose')} /></div>}</Field>
      <Field label="Category">{() => <div><Segmented options={CATEGORIES} value={v.category} onChange={(c) => setV((x) => ({ ...x, category: c, type: '' }))} /></div>}</Field>
      <Select label="Property type" required placeholder="Choose a type" value={v.type} onChange={(e) => set('type')(e.target.value)}
        options={types.map((t) => ({ value: t.code, label: t.name }))} error={s.errors.type} />
      <Input label="Title" required maxLength={100} placeholder="e.g. 2 BHK apartment in Baner with park view" value={v.title} onChange={(e) => set('title')(e.target.value)}
        hint={`${v.title.length}/100 · at least 10 characters. No phone numbers or names.`} error={s.errors.title} />
      <Textarea label="Description" required rows={6} maxLength={5000} value={v.description} onChange={(e) => set('description')(e.target.value)}
        hint={`${v.description.length}/5000 · at least 50 characters. Describe the layout, condition and surroundings. Contact details are blocked.`} error={s.errors.description} />
      <StepFooter saving={s.saving} onSave={() => s.run(body())} />
    </div>
  );
}
