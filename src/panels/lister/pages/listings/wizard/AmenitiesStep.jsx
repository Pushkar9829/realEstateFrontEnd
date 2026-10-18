// Step 5: amenities from the admin-managed master list.
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Skeleton } from '@/shared/ui';
import { useMasters } from '@/modules/listings/api';
import { StepFooter, StepMessages, useStepSave } from './common';
import { useT } from '@/shared/i18n';

export default function AmenitiesStep({ listing, next, back }) {
  const t = useT();
  const masters = useMasters();
  const [sel, setSel] = useState(new Set(listing.amenities || []));
  const [q, setQ] = useState('');
  const linked = Boolean(listing.projectId); // RE-G-07: amenities come from the project
  const s = useStepSave(listing, 5, { onSaved: next, value: linked ? undefined : [...sel].sort(), build: linked ? undefined : () => ({ amenities: [...sel] }) });
  const all = useMemo(() => ((masters.data && masters.data.amenities) || []).filter((a) => a.name.toLowerCase().includes(q.toLowerCase())), [masters.data, q]);
  const toggle = (code) => setSel((x) => { const n = new Set(x); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  if (linked) {
    const names = new Map(((masters.data && masters.data.amenities) || []).map((a) => [a.code, a.name]));
    return (
      <div className="space-y-5">
        <Alert tone="info">{t('lister.wizard.amen.fromProject', { name: listing.project ? listing.project.name : '' })}</Alert>
        <div className="flex flex-wrap gap-2">{(listing.amenities || []).map((c) => <span key={c} className="rounded-full border bg-surface-muted px-3.5 py-1.5 text-sm text-ink-muted">{names.get(c) || c}</span>)}</div>
        <StepFooter onBack={back} onSave={next} saveLabel={t('lister.wizard.continue')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepMessages formError={s.formError} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t('lister.wizard.amen.selected', { n: sel.size })}</p>
        <input className="h-9 w-56 rounded-md border border-line-strong px-3 text-sm" placeholder={t('lister.wizard.amen.filter')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('lister.wizard.amen.filter')} />
      </div>
      {masters.isLoading ? <Skeleton className="h-32" /> : (
        <div className="flex flex-wrap gap-2">
          {all.map((a) => {
            const on = sel.has(a.code);
            return (
              <button key={a.code} type="button" aria-pressed={on} onClick={() => toggle(a.code)}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors', on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-ink-muted hover:border-brand-300')}>
                {on && <Check className="h-3.5 w-3.5" />}{a.name}
              </button>
            );
          })}
        </div>
      )}
      <StepFooter onBack={back} saving={s.saving} onSave={() => s.run({ amenities: [...sel] })} />
    </div>
  );
}
