// Public listing card (RE-S-PUB-02 notes): cover, price, price per sq ft, BHK,
// area, locality + city, posted-by and verification badges, posted N days ago.
// Never an address, unit number or lister name.
import { Link } from 'react-router-dom';
import { BedDouble, Camera, Maximize2, MapPin, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { rupees, shortRupees, timeAgo } from '@/shared/lib/format';
import { useToast } from '@/shared/ui';
import { useCompareIds } from '@/modules/search/api';
import { t as tNow, useT } from '@/shared/i18n';
import { enumLabel } from './useSearchFilters';
import ShortlistButton from './ShortlistButton';
import VerificationBadges from './VerificationBadges';

export const cardPrice = (c) => (c.purpose === 'rent' ? c.price && c.price.monthlyRent : c.price && c.price.amount);

export const enquiryTarget = (c) => ({ kind: 'property', id: c.id, title: c.title, listingNo: c.listingNo, subtitle: [c.locality, c.city].filter(Boolean).join(', '), cover: c.cover && c.cover.url, priceText: `${shortRupees(cardPrice(c))}${c.purpose === 'rent' ? tNow('search.card.perMonth') : ''}` });

export function PriceTag({ card, className }) {
  const t = useT();
  const v = cardPrice(card);
  return (
    <p className={cn('font-semibold text-ink', className)}>
      {shortRupees(v)}{card.purpose === 'rent' && <span className="text-sm font-normal text-ink-subtle">{t('search.card.perMonth')}</span>}
      {card.price && card.price.negotiable && <span className="ml-2 align-middle text-xs font-medium text-success-700">{t('search.card.negotiable')}</span>}
    </p>
  );
}

function CompareToggle({ id }) {
  const t = useT();
  const { has, toggle } = useCompareIds();
  const toast = useToast();
  const on = has(id);
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" className="h-3.5 w-3.5 rounded border-line-strong text-brand-600" checked={on}
        onChange={() => { if (!toggle(id)) toast.info(t('search.card.compareMax')); }} />
      {t('search.card.compare')}
    </label>
  );
}

export default function PropertyCard({ card, compact = false, onEnquire, className, distanceKm }) {
  const t = useT();
  const href = `/property/${card.slug}`;
  const facts = [
    card.bhk != null && card.bhk > 0 && { icon: BedDouble, text: t('search.card.bhk', { n: card.bhk }) },
    card.areaSqft && { icon: Maximize2, text: t('search.card.sqft', { n: Math.round(card.areaSqft).toLocaleString('en-IN') }) },
    card.furnishing && { text: enumLabel(t, 'furnishing', card.furnishing) },
  ].filter(Boolean);
  return (
    <article className={cn('group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md', className)}>
      <Link to={href} className="relative block aspect-[4/3] overflow-hidden bg-surface-sunken" aria-label={card.title}>
        {card.cover ? (
          <img src={card.cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center text-ink-subtle"><Camera className="h-8 w-8" aria-hidden /></span>
        )}
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-ink shadow-sm">{card.purpose === 'rent' ? t('search.card.forRent') : t('search.card.forSale')}</span>
          {card.featured && <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-xs font-semibold text-ink"><Star className="h-3 w-3" aria-hidden />{t('search.card.featured')}</span>}
        </span>
        {card.photoCount > 1 && <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-ink/70 px-1.5 py-0.5 text-xs text-white"><Camera className="h-3 w-3" aria-hidden />{card.photoCount}</span>}
      </Link>
      <div className="absolute right-2 top-2"><ShortlistButton id={card.id} listingNo={card.listingNo} purpose={card.purpose} city={card.city} /></div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <PriceTag card={card} className="text-lg" />
          {card.price && card.price.pricePerSqft && card.purpose !== 'rent' && <span className="whitespace-nowrap pt-1 text-xs text-ink-subtle">{t('search.card.perSqft', { price: rupees(card.price.pricePerSqft) })}</span>}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium text-ink"><Link to={href} className="hover:text-brand-700">{card.title}</Link></h3>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-ink-subtle">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {[card.societyName, card.locality, card.city].filter(Boolean).join(', ')}
          {distanceKm != null && <span className="ml-1 text-brand-700">· {t('search.card.kmAway', { n: distanceKm })}</span>}
        </p>
        {facts.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
            {facts.map((f) => <li key={f.text} className="inline-flex items-center gap-1">{f.icon && <f.icon className="h-3.5 w-3.5" aria-hidden />}{f.text}</li>)}
          </ul>
        )}
        {!compact && <VerificationBadges badges={card.badges} className="mt-3" />}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-ink-subtle">
          <span>{card.listingNo} · {timeAgo(card.postedAt)}</span>
          {!compact && <CompareToggle id={card.id} />}
        </div>
        {onEnquire && (
          <button type="button" onClick={() => onEnquire(card)} className="mt-3 h-9 rounded-md border border-brand-600 text-sm font-medium text-brand-700 hover:bg-brand-50">{t('search.card.enquire')}</button>
        )}
      </div>
    </article>
  );
}
