import { useState } from 'react';
import { cn } from '@/shared/lib/cn';

// items: [{ q, a }]. One open at a time; keyboard and screen-reader friendly.
// Public-site look: display-font questions, hairline dividers, gold +/- mark.
export default function Accordion({ items, className }) {
  const [open, setOpen] = useState(0);
  return (
    <div className={cn('divide-y divide-navy-900/10 border-y border-navy-900/10', className)}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <h3>
              <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`acc-${i}`}
                className="group flex w-full items-center justify-between gap-6 py-5 text-left font-display text-lg font-medium leading-snug text-navy-900 transition-colors hover:text-gold-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 sm:text-xl">
                {it.q}
                <span className={cn('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 transition-colors',
                  isOpen ? 'bg-navy-900 ring-navy-900' : 'ring-gold-400/60 group-hover:ring-gold-500')} aria-hidden>
                  <span className={cn('absolute h-px w-3.5', isOpen ? 'bg-gold-300' : 'bg-gold-600')} />
                  <span className={cn('absolute h-3.5 w-px transition-transform duration-300', isOpen ? 'scale-y-0 bg-gold-300' : 'bg-gold-600')} />
                </span>
              </button>
            </h3>
            <div id={`acc-${i}`} hidden={!isOpen} className="max-w-3xl pb-6 pr-12 text-base leading-relaxed text-navy-500">{it.a}</div>
          </div>
        );
      })}
    </div>
  );
}
