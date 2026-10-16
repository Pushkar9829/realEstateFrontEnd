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
    <Link to={`/projects/${p.slug}`} className="group flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-surface-sunken">
        {cover ? <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-ink-subtle"><Building2 className="h-8 w-8" aria-hidden /></span>}
        <span className="absolute left-2 top-2 flex gap-1">
          {p.status === 'sold_out' ? <Badge>{t('search.project.soldOut')}</Badge> : p.possession && p.possession.status === 'ready' ? <Badge tone="success">{t('search.project.ready')}</Badge> : <Badge tone="info">{t('search.project.underConstruction')}</Badge>}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-ink group-hover:text-brand-700">{p.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle"><MapPin className="h-3.5 w-3.5" aria-hidden />{[p.location && p.location.locality, p.location && p.location.city].filter(Boolean).join(', ')}</p>
        {range && <p className="mt-2 font-semibold text-ink">{shortRupees(range[0])}{range[1] !== range[0] && ` - ${shortRupees(range[1])}`}</p>}
        {bhks.length > 0 && <p className="text-xs text-ink-muted">{t('search.project.bhk', { list: bhks.join(', ') })}</p>}
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-subtle">
          <span className="inline-flex items-center gap-1 text-success-700">{t('search.project.verifiedBuilder')}</span>
          {p.possession && p.possession.date && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden />{date(p.possession.date)}</span>}
        </div>
      </div>
    </Link>
  );
}
