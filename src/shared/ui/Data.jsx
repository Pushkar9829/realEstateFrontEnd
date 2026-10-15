// Table, Tabs, Pagination and Stepper.
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Skeleton, EmptyState } from './Display';

/**
 * columns: [{ key, header, render?(row), className? }]
 */
export function Table({ columns, rows, loading, empty, rowKey = (r) => r._id || r.id, onRowClick }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface-muted">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-subtle', c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <tr key={`s${i}`}>{columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
          ))}
          {!loading && rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn(onRowClick && 'cursor-pointer hover:bg-surface-muted')}>
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 text-ink', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <EmptyState className="rounded-none border-0" title={empty || 'Nothing here yet'} />}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-subtle hover:text-ink')}>
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-surface-sunken px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-ink-muted" aria-label="Pagination">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-1">
        <button type="button" className="rounded-md border bg-white p-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className="rounded-md border bg-white p-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

// steps: [{ label }], current: index. Used by the listing wizard and signup.
export function Stepper({ steps, current, done = [] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const complete = done.includes(i) || i < current;
        return (
          <li key={s.label} className="flex items-center gap-2">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              i === current ? 'bg-brand-600 text-white' : complete ? 'bg-success-100 text-success-700' : 'bg-surface-sunken text-ink-subtle')}>
              {complete && i !== current ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn(i === current ? 'font-medium text-ink' : 'text-ink-subtle')}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line-strong" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
