// Header pieces for the public shell: the city selector (remembered in this
// browser, feeds the Buy / Rent / Projects links and the home search) and the
// shortlist icon with a live count for signed-in buyers and listers.
import { Link } from 'react-router-dom';
import { Heart, MapPin } from 'lucide-react';
import { useShortlist } from '@/modules/search/api';
import { useCanShortlist } from './ShortlistButton';

// cities: GET /api/locations/cities rows; value: chosen city code.
export function CitySelect({ cities, value, onChange, className }) {
  if (!cities.length) return null;
  return (
    <label className={className ? `relative ${className}` : 'relative'}>
      <span className="sr-only">City</span>
      <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-line-strong bg-white pl-8 pr-7 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
        <option value="">All cities</option>
        {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </label>
  );
}

export function ShortlistIcon() {
  const { enabled } = useCanShortlist();
  const q = useShortlist(enabled);
  if (!enabled) return null;
  const n = (q.data || []).length;
  return (
    <Link to="/shortlist" className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
      aria-label={`Shortlist, ${n} saved ${n === 1 ? 'property' : 'properties'}`}>
      <Heart className="h-5 w-5" aria-hidden />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-danger-600 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}
