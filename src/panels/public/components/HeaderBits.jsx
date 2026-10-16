// Header pieces for the public shell: the city selector (remembered in this
// browser, feeds the Buy / Rent / Projects links and the home search) and the
// shortlist icon with a live count for signed-in buyers and listers.
import { Link } from 'react-router-dom';
import { Bell, Heart, MapPin } from 'lucide-react';
import { useAuth } from '@/modules/auth';
import { useUnreadCount } from '@/modules/notifications/api';
import { useShortlist } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import { useCanShortlist } from './ShortlistButton';

// cities: GET /api/locations/cities rows; value: chosen city code.
export function CitySelect({ cities, value, onChange, className }) {
  const t = useT();
  if (!cities.length) return null;
  return (
    <label className={className ? `relative ${className}` : 'relative'}>
      <span className="sr-only">{t('common.city')}</span>
      <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-600" aria-hidden />
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-full border-0 bg-sand-100 pl-8 pr-7 text-sm font-medium text-navy-800 ring-1 ring-inset ring-navy-900/10 transition hover:ring-navy-900/20 focus:outline-none focus:ring-2 focus:ring-gold-500">
        <option value="">{t('common.allCities')}</option>
        {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </label>
  );
}

// Signed-in visitors (buyers) see their in-app notifications.
export function NotificationsBell() {
  const t = useT();
  const { isAuthed } = useAuth();
  if (!isAuthed) return null;
  return <BellLink label={t} />;
}

function BellLink({ label: t }) {
  const q = useUnreadCount({ poll: true });
  const n = q.data || 0;
  return (
    <Link to="/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-600 transition-colors hover:bg-navy-900/5 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
      aria-label={t('common.header.notifications', { count: n })}>
      <Bell className="h-5 w-5" aria-hidden />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-gold-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-navy-950 ring-2 ring-white">{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}

export function ShortlistIcon() {
  const t = useT();
  const { enabled } = useCanShortlist();
  const q = useShortlist(enabled);
  if (!enabled) return null;
  const n = (q.data || []).length;
  return (
    <Link to="/shortlist" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-600 transition-colors hover:bg-navy-900/5 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
      aria-label={t('common.header.shortlist', { count: n })}>
      <Heart className="h-5 w-5" aria-hidden />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-gold-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-navy-950 ring-2 ring-white">{n > 99 ? '99+' : n}</span>}
    </Link>
  );
}
