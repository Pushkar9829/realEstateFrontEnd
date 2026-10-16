// Shared pieces of the public sign-in pages (navy + gold look): the form card,
// its heading and the sign-up progress steps.
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export const authLink = 'font-semibold text-navy-900 underline decoration-gold-400 decoration-2 underline-offset-4 transition-colors hover:text-gold-700';

export function AuthCard({ children, className }) {
  return <div className={cn('rounded-3xl bg-white p-6 shadow-lift ring-1 ring-navy-900/5 sm:p-9', className)}>{children}</div>;
}

export function AuthTitle({ title, subtitle, eyebrow }) {
  return (
    <div className="mb-7">
      {eyebrow && (
        <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
          <span className="h-px w-8 bg-current" aria-hidden />{eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl font-medium leading-tight tracking-tight text-navy-900 sm:text-[2.1rem]">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-navy-500">{subtitle}</p>}
    </div>
  );
}

// steps: [label]; current: index of the active step.
export function AuthSteps({ steps, current }) {
  return (
    <ol className="mb-7 flex items-center gap-2 text-xs">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold',
              active ? 'bg-navy-900 text-gold-300' : done ? 'bg-gold-100 text-gold-800' : 'bg-sand-100 text-navy-400 ring-1 ring-inset ring-navy-900/10')}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn('truncate', active ? 'font-semibold text-navy-900' : 'text-navy-400')}>{label}</span>
            {i < steps.length - 1 && <span className="h-px w-4 shrink-0 bg-navy-900/15 sm:w-6" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
