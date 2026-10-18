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
    <p className={cn('font-display font-semibold tracking-tight text-navy-900', className)}>
      {shortRupees(v)}{card.purpose === 'rent' && <span className="font-sans text-sm font-normal text-navy-500">{t('search.card.perMonth')}</span>}
      {card.price && card.price.negotiable && <span className="ml-2 align-middle font-sans text-xs font-medium text-success-700">{t('search.card.negotiable')}</span>}
    </p>
  );
}

function CompareToggle({ id }) {
  const t = useT();
  const { has, toggle } = useCompareIds();
  const toast = useToast();
  const on = has(id);
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-navy-500" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" className="h-3.5 w-3.5 rounded border-line-strong text-navy-900" checked={on}
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
    <article className={cn('group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift', className)}>
      <Link to={href} className="relative block aspect-[4/3] overflow-hidden bg-sand-200" aria-label={card.title}>
        {card.cover ? (
          <img src={card.cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]" />
        ) : (
          <span className="flex h-full items-center justify-center text-navy-300"><Camera className="h-8 w-8" aria-hidden /></span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy-950/40 to-transparent" aria-hidden />
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-900 shadow-sm backdrop-blur">{card.purpose === 'rent' ? t('search.card.forRent') : t('search.card.forSale')}</span>
          {card.featured && <span className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-950"><Star className="h-3 w-3" aria-hidden />{t('search.card.featured')}</span>}
        </span>
        {card.photoCount > 1 && <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-navy-950/60 px-2 py-0.5 text-xs text-white backdrop-blur"><Camera className="h-3 w-3" aria-hidden />{card.photoCount}</span>}
      </Link>
      <div className="absolute right-3 top-3"><ShortlistButton id={card.id} listingNo={card.listingNo} purpose={card.purpose} city={card.city} /></div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <PriceTag card={card} className="text-xl" />
          {card.price && card.price.pricePerSqft && card.purpose !== 'rent' && <span className="whitespace-nowrap pt-1.5 text-xs text-navy-500">{t('search.card.perSqft', { price: rupees(card.price.pricePerSqft) })}</span>}
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug text-navy-800"><Link to={href} className="transition-colors hover:text-gold-700">{card.title}</Link></h3>
        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-navy-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-700" aria-hidden />
          {[card.societyName, card.locality, card.city].filter(Boolean).join(', ')}
          {distanceKm != null && <span className="ml-1 text-gold-700">· {t('search.card.kmAway', { n: distanceKm })}</span>}
        </p>
        {facts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-navy-900/5 pt-3 text-xs font-medium text-navy-600">
            {facts.map((f) => <li key={f.text} className="inline-flex items-center gap-1">{f.icon && <f.icon className="h-3.5 w-3.5" aria-hidden />}{f.text}</li>)}
          </ul>
        )}
        {!compact && <VerificationBadges badges={card.badges} className="mt-3" />}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[11px] text-navy-500">
          <span>{card.listingNo} · {timeAgo(card.postedAt)}</span>
          {!compact && <CompareToggle id={card.id} />}
        </div>
        {onEnquire && (
          <button type="button" onClick={() => onEnquire(card)} className="mt-3 h-10 rounded-full bg-navy-900 text-sm font-medium text-white transition-colors hover:bg-navy-800">{t('search.card.enquire')}</button>
        )}
      </div>
    </article>
  );
}
