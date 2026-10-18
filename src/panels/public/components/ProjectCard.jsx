// Public project card and price range helper.
import { Link } from 'react-router-dom';
import { Building2, CalendarClock, MapPin } from 'lucide-react';
import { Badge } from '@/shared/ui';
import { date, shortRupees } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';

export const configRange = (configs = [], key = 'price') => {
  const mins = configs.map((c) => c[`${key}Min`]).filter(Boolean);
  const maxs = configs.map((c) => c[`${key}Max`]).filter(Boolean);
  if (!mins.length) return null;
  return [Math.min(...mins), Math.max(...maxs)];
};

export default function ProjectCard({ p }) {
  const t = useT();
  const range = configRange(p.configurations);
  const bhks = [...new Set((p.configurations || []).map((c) => c.bhk).filter(Boolean))].sort((a, b) => a - b);
  const cover = p.media && p.media.photos && p.media.photos[0];
  return (
    <Link to={`/projects/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-200">
        {cover ? <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]" /> : <span className="flex h-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950 text-gold-400"><Building2 className="h-8 w-8" aria-hidden /></span>}
        <span className="absolute left-3 top-3 flex gap-1">
          {p.status === 'sold_out' ? <Badge>{t('search.project.soldOut')}</Badge> : p.possession && p.possession.status === 'ready' ? <Badge tone="success">{t('search.project.ready')}</Badge> : <Badge tone="info">{t('search.project.underConstruction')}</Badge>}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold tracking-tight text-navy-900 transition-colors group-hover:text-gold-700">{p.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-navy-500"><MapPin className="h-3.5 w-3.5 text-gold-700" aria-hidden />{[p.location && p.location.locality, p.location && p.location.city].filter(Boolean).join(', ')}</p>
        {range && <p className="mt-3 font-display text-lg font-semibold text-navy-900">{shortRupees(range[0])}{range[1] !== range[0] && ` - ${shortRupees(range[1])}`}</p>}
        {bhks.length > 0 && <p className="text-xs font-medium text-navy-500">{t('search.project.bhk', { list: bhks.join(', ') })}</p>}
        <div className="mt-auto flex items-center justify-between border-t border-navy-900/5 pt-3 text-xs text-navy-500">
          <span className="inline-flex items-center gap-1 text-success-700">{t('search.project.verifiedBuilder')}</span>
          {p.possession && p.possession.date && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden />{date(p.possession.date)}</span>}
        </div>
      </div>
    </Link>
  );
}
