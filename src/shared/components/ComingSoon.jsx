import { Check, Construction } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Card, PageHeader } from '@/shared/ui';

// Placeholder for screens that are routed and guarded but built in a later
// frontend phase (docs/ARCHITECTURE.md section 11).
const PHASES = [
  ['F0', 'Foundation'], ['F1', 'Supply side'], ['F2', 'Public portal'], ['F3', 'Lead management'], ['F4', 'Deals and commission'], ['F5', 'Reports and launch'],
];
export const CURRENT_PHASE = 'F5';

export default function ComingSoon({ title, module, phase, description }) {
  const doneIdx = PHASES.findIndex(([p]) => p === CURRENT_PHASE);
  return (
    <>
      <PageHeader title={title} breadcrumb={module} />
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 rounded-full bg-accent-50 p-4 text-accent-700"><Construction className="h-7 w-7" aria-hidden /></div>
        <h2 className="text-lg font-semibold text-ink">Arrives in frontend phase {phase}</h2>
        <p className="mt-1 max-w-md text-sm text-ink-subtle">{description || 'This screen is planned, routed and protected already. Its features are built and tested in the phase shown below.'}</p>
        <ol className="mt-8 grid w-full max-w-3xl grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Build phases">
          {PHASES.map(([p, label], i) => {
            const done = i <= doneIdx;
            const target = p === phase;
            return (
              <li key={p} className={cn('rounded-lg border px-2 py-3 text-xs', target ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : done ? 'border-success-100 bg-success-50' : 'bg-white')}>
                <span className={cn('mx-auto mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                  done ? 'bg-success-600 text-white' : target ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-subtle')}>
                  {done ? <Check className="h-3.5 w-3.5" /> : p.slice(1)}
                </span>
                <span className={cn('block font-semibold', target ? 'text-brand-700' : 'text-ink')}>{p}</span>
                <span className="block text-ink-subtle">{label}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
