// Decorative skyline for the home hero (inline SVG, token colours, no image
// download). Hidden from screen readers.
export default function SkylineArt({ className }) {
  return (
    <svg viewBox="0 0 480 360" className={className} aria-hidden fill="none">
      <circle cx="380" cy="80" r="44" className="fill-accent-300/70" />
      <g className="fill-white/10">
        <rect x="20" y="150" width="70" height="210" rx="4" />
        <rect x="100" y="90" width="80" height="270" rx="4" />
        <rect x="190" y="170" width="60" height="190" rx="4" />
        <rect x="260" y="120" width="90" height="240" rx="4" />
        <rect x="360" y="190" width="100" height="170" rx="4" />
      </g>
      <g className="fill-white/25">
        {[110, 130, 150, 170, 190, 210, 230, 250].map((y) => [112, 136, 160].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="10" rx="2" />))}
        {[140, 165, 190, 215, 240, 265].map((y) => [274, 300, 326].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="14" height="12" rx="2" />))}
      </g>
      <g>
        <path d="M300 360V262l70-56 70 56v98z" className="fill-white" />
        <path d="M290 268l80-64 80 64" className="stroke-accent-500" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="350" y="300" width="40" height="60" rx="3" className="fill-brand-600" />
        <rect x="318" y="280" width="22" height="20" rx="2" className="fill-brand-200" />
        <rect x="400" y="280" width="22" height="20" rx="2" className="fill-brand-200" />
      </g>
      <g transform="translate(70 230)">
        <rect width="150" height="64" rx="12" className="fill-white" />
        <circle cx="30" cy="32" r="16" className="fill-success-100" />
        <path d="M23 32l5 5 10-11" className="stroke-success-600" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="56" y="20" width="76" height="8" rx="4" className="fill-brand-100" />
        <rect x="56" y="36" width="52" height="8" rx="4" className="fill-surface-sunken" />
      </g>
    </svg>
  );
}
