// Views per day as a plain SVG bar chart (no chart library). Missing days in
// the range are filled with zero so gaps are visible.
import { useMemo } from 'react';

const DAY = 86_400_000;
const fmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

export function fillDays(points, from, to) {
  const map = Object.fromEntries((points || []).map((p) => [p.day, p.views]));
  const start = new Date(`${new Date(from).toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${new Date(to).toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const out = [];
  for (let t = start; t <= end && out.length < 800; t += DAY) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, views: map[day] || 0 });
  }
  return out;
}

export default function ViewsChart({ points, from, to, height = 200 }) {
  const days = useMemo(() => fillDays(points, from, to), [points, from, to]);
  const max = Math.max(1, ...days.map((d) => d.views));
  const total = days.reduce((a, d) => a + d.views, 0);
  const W = 720;
  const H = height;
  const pad = { l: 32, r: 8, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = iw / Math.max(1, days.length);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Views per day: ${total} views over ${days.length} days`}>
        {ticks.map((v) => {
          const y = pad.t + ih - (v / max) * ih;
          return (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="stroke-line" strokeDasharray={v ? '3 3' : undefined} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" className="fill-ink-subtle text-[10px]">{v}</text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const h = (d.views / max) * ih;
          return (
            <g key={d.day}>
              <rect x={pad.l + i * bw + bw * 0.15} y={pad.t + ih - h} width={Math.max(1, bw * 0.7)} height={h} rx={Math.min(3, bw * 0.2)} className="fill-brand-500">
                <title>{`${fmt.format(new Date(`${d.day}T00:00:00Z`))}: ${d.views} view${d.views === 1 ? '' : 's'}`}</title>
              </rect>
              {i % labelEvery === 0 && <text x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-ink-subtle text-[10px]">{fmt.format(new Date(`${d.day}T00:00:00Z`))}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{total} views in the selected range</figcaption>
    </figure>
  );
}
