import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

// items: [{ q, a }]. One open at a time; keyboard and screen-reader friendly.
export default function Accordion({ items, className }) {
  const [open, setOpen] = useState(0);
  return (
    <div className={cn('divide-y rounded-lg border bg-white', className)}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <h3>
              <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`acc-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink hover:bg-surface-muted">
                {it.q}
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </button>
            </h3>
            <div id={`acc-${i}`} hidden={!isOpen} className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">{it.a}</div>
          </div>
        );
      })}
    </div>
  );
}
