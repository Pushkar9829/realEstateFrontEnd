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
import { useT } from '@/shared/i18n';

const CATEGORIES = ['residential', 'commercial', 'land'];

function ProjectPicker({ value, onChange, errors, lockedTo }) {
  const t = useT();
  const projects = useOwnProjects({ status: 'live', limit: 100 });
  const list = (projects.data && projects.data.items) || [];
  const project = list.find((p) => p._id === value.projectId);
  if (lockedTo) {
    return <Alert tone="info">{t('lister.listingStatus.partOf', { name: lockedTo.name })}{lockedTo.config ? ` · ${lockedTo.config.name}` : ''}. {t('lister.wizard.basic.fromProject')}</Alert>;
  }
  return (
    <div className="rounded-lg border bg-surface-muted p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink"><Building2 className="h-4 w-4 text-brand-600" aria-hidden /> {t('lister.wizard.basic.unitInProject')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('lister.wizard.basic.project')} placeholder={list.length ? t('lister.wizard.basic.notInProject') : t('lister.wizard.basic.noProjects')} disabled={!list.length} value={value.projectId}
          onChange={(e) => onChange({ projectId: e.target.value, unitConfigId: '' })} options={list.map((p) => ({ value: p._id, label: `${p.name} (${p.projectNo})` }))} error={errors.projectId} />
        {project && (
          <Select label={t('lister.wizard.basic.config')} required placeholder={t('lister.wizard.basic.chooseConfig')} value={value.unitConfigId}
            onChange={(e) => onChange({ ...value, unitConfigId: e.target.value })} options={(project.configurations || []).map((c) => ({ value: c._id, label: c.name }))} error={errors.unitConfigId} />
        )}
      </div>
      <p className="mt-2 text-xs text-ink-subtle">{t('lister.wizard.basic.linkedHint')}</p>
    </div>
  );
}

export default function BasicStep({ listing, next }) {
  const t = useT();
  const masters = useMasters();
  const { user } = useAuth();
  const builder = user.listerType === 'builder';
  const done = (listing.wizard?.stepsDone || []).includes(1);
  const [v, setV] = useState({
    purpose: listing.purpose || 'sale', category: listing.category || 'residential', type: done ? listing.type : '',
    title: listing.title || '', description: listing.description || '',
  });
  const [link, setLink] = useState({ projectId: '', unitConfigId: '' });
  const linkedTo = listing.projectId ? listing.project || { name: t('lister.wizard.basic.aProject') } : null;
  const body = () => ({ ...v, ...(!linkedTo && link.projectId ? link : {}) });
  const s = useStepSave(listing, 1, { onSaved: next, value: { v, link }, build: body });
  const types = ((masters.data && masters.data.propertyTypes) || []).filter((pt) => !pt.meta || !pt.meta.category || pt.meta.category === v.category);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} />
      {builder && <ProjectPicker value={link} onChange={setLink} errors={s.errors} lockedTo={linkedTo} />}
      <Field label={t('lister.wizard.basic.iWant')}>{() => <div><Segmented options={[{ value: 'sale', label: t('lister.wizard.basic.sell') }, { value: 'rent', label: t('lister.wizard.basic.rentOut') }]} value={v.purpose} onChange={set('purpose')} /></div>}</Field>
      <Field label={t('lister.wizard.basic.category')}>{() => <div><Segmented options={CATEGORIES.map((c) => ({ value: c, label: t(`lister.wizard.basic.categories.${c}`) }))} value={v.category} onChange={(c) => setV((x) => ({ ...x, category: c, type: '' }))} /></div>}</Field>
      <Select label={t('lister.wizard.basic.type')} required placeholder={t('lister.wizard.basic.chooseType')} value={v.type} onChange={(e) => set('type')(e.target.value)}
        options={types.map((pt) => ({ value: pt.code, label: pt.name }))} error={s.errors.type} />
      <Input label={t('lister.wizard.basic.title')} required maxLength={100} placeholder={t('lister.wizard.basic.titlePh')} value={v.title} onChange={(e) => set('title')(e.target.value)}
        hint={t('lister.wizard.basic.titleHint', { n: v.title.length })} error={s.errors.title} />
      <Textarea label={t('lister.wizard.basic.description')} required rows={6} maxLength={5000} value={v.description} onChange={(e) => set('description')(e.target.value)}
        hint={t('lister.wizard.basic.descHint', { n: v.description.length })} error={s.errors.description} />
      <StepFooter saving={s.saving} onSave={() => s.run(body())} />
    </div>
  );
}
