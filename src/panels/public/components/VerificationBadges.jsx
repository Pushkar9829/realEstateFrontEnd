// RE-B-13 badges with an info tooltip (hover, keyboard focus or tap). The
// detail API sends the tooltip text; cards get a generic text per badge code.
// Labels are translated from labelCode (the API keeps English `label` for
// other consumers); a builder brand name is data and stays as sent.
import { useId, useState } from 'react';
import { BadgeCheck, Camera, FileCheck2, MapPinned } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useLang, useT } from '@/shared/i18n';
import { date as fmtDate } from '@/shared/lib/format';

const LABEL_CODES = ['verified_owner', 'verified_landlord', 'verified_builder', 'verified_lister', 'photo_verified', 'site_verified', 'rera'];

// "Verified Owner" / "सत्यापित मालिक", plus " · <brand>" for an approved builder brand.
export function badgeLabel(t, labelCode, brand, fallback) {
  if (!LABEL_CODES.includes(labelCode)) return fallback || '';
  const base = t(`property.badgeLabel.${labelCode}`);
  return brand ? `${base} · ${brand}` : base;
}

// The "posted by" line of a card or property (listerBadgeCode / listerBrand).
export const listerBadgeText = (t, p) => badgeLabel(t, p && p.listerBadgeCode, p && p.listerBrand, p && p.listerBadge);

const META = {
  verified_lister: { icon: BadgeCheck, cls: 'bg-navy-900 text-white ring-navy-900 [&_svg]:text-gold-300', text: 'property.badge.verified_lister' },
  photo_verified: { icon: Camera, cls: 'bg-gold-50 text-gold-800 ring-gold-200 [&_svg]:text-gold-700', text: 'property.badge.photo_verified' },
  site_verified: { icon: MapPinned, cls: 'bg-gold-50 text-gold-800 ring-gold-200 [&_svg]:text-gold-700', text: 'property.badge.site_verified' },
  rera: { icon: FileCheck2, cls: 'bg-white text-navy-800 ring-navy-900/15 [&_svg]:text-gold-700', text: 'property.badge.rera' },
};

export function VerificationBadge({ badge, size = 'sm' }) {
  const t = useT();
  const { lang } = useLang();
  const id = useId();
  const [open, setOpen] = useState(false);
  const m = META[badge.code] || { icon: BadgeCheck, cls: 'bg-sand-100 text-navy-700 ring-navy-900/10' };
  const Icon = m.icon;
  const label = badgeLabel(t, badge.labelCode, badge.brand, badge.label);
  // English keeps the API's dated tooltip; other languages build it from the code.
  const tip = lang === 'en' && badge.tooltip ? badge.tooltip
    : badge.code === 'rera' && badge.reraNumbers && badge.reraNumbers.length ? t('property.badgeTip.rera', { numbers: badge.reraNumbers.join(', ') })
      : badge.verifiedAt && META[badge.code] ? t(`property.badgeTip.${badge.code}`, { date: fmtDate(badge.verifiedAt) })
        : m.text ? t(m.text) : label;
  return (
    <span className="relative inline-flex">
      <button type="button" aria-describedby={id}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className={cn('inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset transition-shadow hover:shadow-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500', m.cls, size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-[13px]')}>
        <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />{label}
      </button>
      <span id={id} role="tooltip" className={cn('absolute bottom-full left-0 z-30 mb-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl bg-navy-950 px-3.5 py-2.5 text-xs font-normal leading-snug text-navy-100 shadow-lift ring-1 ring-white/10', open ? 'block' : 'hidden')}>
        {tip}
      </span>
    </span>
  );
}

export default function VerificationBadges({ badges = [], size = 'sm', className, skip = [] }) {
  const list = badges.filter((b) => !skip.includes(b.code));
  if (!list.length) return null;
  return <div className={cn('flex flex-wrap gap-1.5', className)}>{list.map((b) => <VerificationBadge key={b.code} badge={b} size={size} />)}</div>;
}
