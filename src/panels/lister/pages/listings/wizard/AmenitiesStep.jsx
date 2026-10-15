// Step 5: amenities from the admin-managed master list.
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui';
import { useMasters } from '@/modules/listings/api';
import { StepFooter, StepMessages, useStepSave } from './common';

export default function AmenitiesStep({ listing, next, back }) {
  const masters = useMasters();
  const [sel, setSel] = useState(new Set(listing.amenities || []));
  const [q, setQ] = useState('');
  const s = useStepSave(listing, 5, { onSaved: next });
  const all = useMemo(() => ((masters.data && masters.data.amenities) || []).filter((a) => a.name.toLowerCase().includes(q.toLowerCase())), [masters.data, q]);
  const toggle = (code) => setSel((x) => { const n = new Set(x); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  return (
    <div className="space-y-5">
      <StepMessages formError={s.formError} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{sel.size} selected</p>
        <input className="h-9 w-56 rounded-md border border-line-strong px-3 text-sm" placeholder="Filter amenities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter amenities" />
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
