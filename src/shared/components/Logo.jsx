import { Link } from 'react-router-dom';
import env from '@/config/env';
import { cn } from '@/shared/lib/cn';

// `luxe` is the public marketing look (gold mark, serif wordmark); panels keep the default.
export default function Logo({ compact = false, to = '/', inverse = false, luxe = false, className }) {
  if (luxe) {
    return (
      <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label={`${env.appName} home`}>
        <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" aria-hidden>
          <rect width="36" height="36" rx="10" className={inverse ? 'fill-white/10' : 'fill-navy-900'} />
          <path d="M9 18.5 18 10l9 8.5" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-gold-400" />
          <path d="M12.5 17v9h11v-9" fill="none" strokeWidth="2.2" strokeLinejoin="round" className="stroke-white" />
          <path d="M16.5 26v-4.5h3V26" fill="none" strokeWidth="2" strokeLinejoin="round" className="stroke-gold-400" />
        </svg>
        {!compact && (
          <span className={cn('font-display text-xl font-semibold tracking-tight', inverse ? 'text-white' : 'text-navy-900')}>
            {env.appName}
          </span>
        )}
      </Link>
    );
  }
  return (
    <Link to={to} className={cn('flex items-center gap-2', className)} aria-label={`${env.appName} home`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className={inverse ? 'fill-white' : 'fill-brand-600'} />
        <path d="M8 16 16 9l8 7v8h-5v-5h-6v5H8z" className={inverse ? 'fill-brand-600' : 'fill-white'} />
      </svg>
      {!compact && <span className={inverse ? 'text-lg font-bold text-white' : 'text-lg font-bold text-ink'}>{env.appName}</span>}
    </Link>
  );
}
