import { Link } from 'react-router-dom';
import env from '@/config/env';

export default function Logo({ compact = false, to = '/', inverse = false }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label={`${env.appName} home`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className={inverse ? 'fill-white' : 'fill-brand-600'} />
        <path d="M8 16 16 9l8 7v8h-5v-5h-6v5H8z" className={inverse ? 'fill-brand-600' : 'fill-white'} />
      </svg>
      {!compact && <span className={inverse ? 'text-lg font-bold text-white' : 'text-lg font-bold text-ink'}>{env.appName}</span>}
    </Link>
  );
}
