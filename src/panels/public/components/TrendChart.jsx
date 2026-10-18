// RE-E-17 price trend line (plain SVG). series: [{ month: 'YYYY-MM', avgPerSqft (paise), dataPoints }]
import { useId } from 'react';
import { rupees } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';

const monthLabel = (m, months) => { const [y, mm] = String(m).split('-'); return `${months[Number(mm) - 1] || mm} ${String(y).slice(2)}`; };

export default function TrendChart({ series = [], unit, height = 180 }) {
  const t = useT();
  const gid = useId().replace(/:/g, '');
  const pts = series.filter((s) => s.avgPerSqft > 0);
  if (pts.length < 2) return null;
  const u = unit || t('home.trend.perSqft');
  const months = t('home.trend.months');
  const W = 600; const H = height; const P = { l: 64, r: 12, t: 12, b: 26 };
  const vals = pts.map((p) => p.avgPerSqft);
  const min = Math.min(...vals) * 0.97; const max = Math.max(...vals) * 1.03;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (pts.length - 1);
  const y = (v) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.avgPerSqft).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`;
  const ticks = [min, (min + max) / 2, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('home.trend.aria', { unit: u, n: pts.length, from: rupees(vals[0]), to: rupees(vals[vals.length - 1]) })}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#C8A24A" stopOpacity="0.28" /><stop offset="100%" stopColor="#C8A24A" stopOpacity="0" /></linearGradient>
      </defs>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={P.l} x2={W - P.r} y1={y(tk)} y2={y(tk)} stroke="#E3E9F2" strokeDasharray="3 4" />
          <text x={P.l - 6} y={y(tk) + 4} textAnchor="end" fontSize="11" fill="#6B7C99">{rupees(tk)}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="#152036" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={p.month}>
          <circle cx={x(i)} cy={y(p.avgPerSqft)} r={i === pts.length - 1 ? 5.5 : 3.5} fill={i === pts.length - 1 ? '#C8A24A' : '#fff'} stroke={i === pts.length - 1 ? '#fff' : '#152036'} strokeWidth="2"><title>{t('home.trend.point', { month: monthLabel(p.month, months), price: rupees(p.avgPerSqft), unit: u, n: p.dataPoints })}</title></circle>
          {(i === 0 || i === pts.length - 1 || pts.length <= 6 || i % 3 === 0) && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#6B7C99">{monthLabel(p.month, months)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function ChangePill({ pct }) {
  if (pct == null) return <span className="text-navy-500">-</span>;
  const up = pct >= 0;
  return <span className={up ? 'font-medium text-success-700' : 'font-medium text-danger-700'}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}
