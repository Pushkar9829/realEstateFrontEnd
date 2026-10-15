// Plain CSS / SVG charts for reports and the dashboard (no chart library).
import { cn } from '@/shared/lib/cn';

const TONES = { brand: 'bg-brand-500', success: 'bg-success-600', warning: 'bg-warning-600', danger: 'bg-danger-600', info: 'bg-info-600', accent: 'bg-accent-500', neutral: 'bg-ink-subtle' };

/**
 * Horizontal bars. rows: [{ label, value, hint? }]; format(value) renders the number.
 */
export function HBars({ rows, format = (v) => v, tone = 'brand', empty = 'No data in this period' }) {
  const max = Math.max(0, ...rows.map((r) => Number(r.value) || 0));
  if (!rows.length || !max) return <p className="py-6 text-center text-sm text-ink-subtle">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink-muted" title={r.label}>{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
            <span className={cn('block h-full rounded-full', TONES[r.tone || tone])} style={{ width: `${Math.max(2, ((Number(r.value) || 0) / max) * 100)}%` }} />
          </span>
          <span className="whitespace-nowrap text-right font-medium text-ink">{format(r.value)}{r.hint && <span className="ml-1 text-xs font-normal text-ink-subtle">{r.hint}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Vertical grouped columns. rows: [{ label, values: { seriesKey: number } }],
 * series: [{ key, label, tone }].
 */
export function Columns({ rows, series, format = (v) => v, height = 160, empty = 'No data in this period' }) {
  const max = Math.max(0, ...rows.flatMap((r) => series.map((s) => Number(r.values[s.key]) || 0)));
  if (!rows.length || !max) return <p className="py-6 text-center text-sm text-ink-subtle">{empty}</p>;
  return (
    <div>
      <div className="flex items-end gap-3 overflow-x-auto pb-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center gap-0.5">
              {series.map((s) => {
                const v = Number(r.values[s.key]) || 0;
                return <span key={s.key} title={`${s.label}: ${format(v)}`} className={cn('w-full max-w-[1.25rem] rounded-t', TONES[s.tone || 'brand'])} style={{ height: `${Math.max(v ? 2 : 0, (v / max) * 100)}%` }} />;
              })}
            </div>
            <span className="whitespace-nowrap text-[11px] text-ink-subtle">{r.label}</span>
          </div>
        ))}
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-muted">
          {series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-sm', TONES[s.tone || 'brand'])} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** SVG sparkline of numbers. */
export function Sparkline({ values, width = 160, height = 40, className, label }) {
  const nums = values.map((v) => Number(v) || 0);
  if (nums.length < 2) return <span className="text-xs text-ink-subtle">Not enough history yet</span>;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const span = max - min || 1;
  const step = width / (nums.length - 1);
  const pts = nums.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn('overflow-visible text-brand-600', className)} role="img" aria-label={label || 'Trend'}>
      <polyline points={`0,${height} ${pts.join(' ')} ${width},${height}`} className="fill-current opacity-10" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Funnel: decreasing bars, each with the % of the previous step. */
export function Funnel({ rows }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!max) return <p className="py-6 text-center text-sm text-ink-subtle">No leads in this period</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate text-ink-muted">{r.label}</span>
          <span className="flex flex-1 justify-center">
            <span className="flex h-7 items-center justify-center rounded bg-brand-500 text-xs font-medium text-white" style={{ width: `${Math.max(6, (r.value / max) * 100)}%` }}>{r.value}</span>
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-ink-subtle">{r.hint}</span>
        </li>
      ))}
    </ol>
  );
}
