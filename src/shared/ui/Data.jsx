// Table, Tabs, Pagination and Stepper.
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import useMediaQuery from '@/shared/hooks/useMediaQuery';
import { useT } from '@/shared/i18n';
import { Skeleton, EmptyState, Alert } from './Display';

// Ignore row clicks that land on something interactive inside the row.
const INTERACTIVE = 'a,button,input,select,textarea,label,[role=button],[role=menuitem]';

/**
 * columns: [{ key, header, render?(row), className?, mobile?: 'title' | 'footer' | false, noLink? }]
 * rowHref(row): the row opens a page. The first column (or the `link: true`
 *   column) is rendered as a real <Link>, so rows work with the keyboard, screen
 *   readers, middle-click and "open in new tab"; a click elsewhere on the row
 *   follows the same link.
 * onRowClick(row): the row opens something on this page (drawer, modal). The
 *   first cell becomes a button with the same action.
 * Below 640 px the rows become labelled cards (stack={false} keeps the table).
 * A bulk-select column ({ mobile: 'select', header: <checkbox> }) shows on
 * cards as a labelled "Select" box in the title row, with "Select all on this
 * page" above the list.
 */
export function Table({ columns, rows, loading, empty, rowKey = (r) => r._id || r.id, onRowClick, rowHref, rowLabel, stack = true, error, onRetry }) {
  const narrow = useMediaQuery('(max-width: 639px)');
  const t = useT();
  const emptyText = empty || t('common.table.empty');
  const linkCol = columns.find((c) => c.link) || columns.find((c) => !c.noLink && typeof c.header === 'string' && c.header);
  const open = (r, e) => {
    if (e && e.target.closest && e.target.closest(INTERACTIVE)) return;
    if (rowHref) {
      const a = e && e.currentTarget && e.currentTarget.querySelector('a[data-row-link]');
      if (a) a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey }));
      return;
    }
    if (onRowClick) onRowClick(r);
  };
  const clickable = Boolean(rowHref || onRowClick);
  const cellOf = (c, r) => {
    const content = c.render ? c.render(r) : r[c.key];
    if (c !== linkCol || !clickable) return content;
    const label = rowLabel ? rowLabel(r) : undefined;
    if (rowHref) {
      return <Link to={rowHref(r)} data-row-link aria-label={label} className="font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{content}</Link>;
    }
    return <button type="button" data-row-link aria-label={label} onClick={() => onRowClick(r)} className="text-left font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{content}</button>;
  };
  const errorBox = error ? (
    <Alert tone="danger" className="m-3" title={t('common.table.error')} action={onRetry ? <button type="button" className="font-semibold underline" onClick={onRetry}>{t('common.retry')}</button> : null}>
      {error.message || ''}
    </Alert>
  ) : null;

  if (stack && narrow) {
    if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
    if (errorBox) return <div className="rounded-lg border bg-white">{errorBox}</div>;
    if (!rows.length) return <EmptyState title={emptyText} />;
    const select = columns.find((c) => c.mobile === 'select');
    const visible = columns.filter((c) => c.mobile !== false && c !== select);
    const title = visible.find((c) => c.mobile === 'title') || (visible.includes(linkCol) ? linkCol : visible.find((c) => c.header));
    const footer = visible.filter((c) => c !== title && (c.mobile === 'footer' || typeof c.header !== 'string' || !c.header));
    const body = visible.filter((c) => c !== title && !footer.includes(c));
    return (
      <>
      {select && select.header && typeof select.header !== 'string' && (
        <label className="mb-2 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm text-ink-muted" data-testid="select-all-mobile">{select.header}<span>{t('common.table.selectAllOnPage')}</span></label>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={rowKey(r)} onClick={clickable ? (e) => open(r, e) : undefined}
            className={cn('min-w-0 rounded-lg border bg-white p-3 text-sm shadow-sm', clickable && 'cursor-pointer hover:bg-surface-muted')}>
            {(title || select) && (
              <div className="flex items-start justify-between gap-3">
                {title ? <div className="min-w-0 break-words font-medium text-ink">{title === linkCol ? cellOf(title, r) : (title.render ? title.render(r) : r[title.key])}</div> : <span />}
                {select && <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">{cellOf(select, r)}<span aria-hidden>{t('common.table.select')}</span></label>}
              </div>
            )}
            {body.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {body.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{c.header}</dt>
                    <dd className="mt-0.5 break-words text-ink">{cellOf(c, r)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {footer.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2">{footer.map((c) => <span key={c.key}>{cellOf(c, r)}</span>)}</div>}
          </li>
        ))}
      </ul>
      </>
    );
  }
  return (
    <div className="relative max-w-full overflow-x-auto rounded-lg border bg-white shadow-sm">
      {errorBox}
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface-muted">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-subtle', c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <tr key={`s${i}`}>{columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
          ))}
          {!loading && !error && rows.map((r) => (
            <tr key={rowKey(r)} onClick={clickable ? (e) => open(r, e) : undefined} className={cn(clickable && 'cursor-pointer hover:bg-surface-muted')}>
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 text-ink', c.className)}>{cellOf(c, r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && !error && rows.length === 0 && <EmptyState className="rounded-none border-0" title={emptyText} />}
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
  const t = useT();
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-ink-muted" aria-label={t('common.pager.label')}>
      <span>{t('common.pager.page', { page, pages })}</span>
      <div className="flex gap-1">
        <button type="button" className="rounded-md border bg-white p-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('common.pager.prev')}><ChevronLeft className="h-4 w-4" aria-hidden /></button>
        <button type="button" className="rounded-md border bg-white p-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t('common.pager.next')}><ChevronRight className="h-4 w-4" aria-hidden /></button>
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
