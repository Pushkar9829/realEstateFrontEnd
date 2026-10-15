// RE-B-13 badges with an info tooltip (hover, keyboard focus or tap). The
// detail API sends the tooltip text; cards get a generic text per badge code.
import { useId, useState } from 'react';
import { BadgeCheck, Camera, FileCheck2, MapPinned } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const META = {
  verified_lister: { icon: BadgeCheck, cls: 'bg-success-50 text-success-700', text: 'Our team checked the lister\'s ID and ownership documents before this listing went live.' },
  photo_verified: { icon: Camera, cls: 'bg-info-50 text-info-700', text: 'Photos were taken at the property with a location check and reviewed by our team.' },
  site_verified: { icon: MapPinned, cls: 'bg-brand-50 text-brand-700', text: 'Our field team visited this property.' },
  rera: { icon: FileCheck2, cls: 'bg-accent-50 text-accent-700', text: 'This project is registered with RERA. Check the number on the official RERA website.' },
};

export function VerificationBadge({ badge, size = 'sm' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const m = META[badge.code] || { icon: BadgeCheck, cls: 'bg-surface-sunken text-ink-muted', text: badge.label };
  const Icon = m.icon;
  return (
    <span className="relative inline-flex">
      <button type="button" aria-describedby={id}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className={cn('inline-flex items-center gap-1 rounded-full font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40', m.cls, size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm')}>
        <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />{badge.label}
      </button>
      <span id={id} role="tooltip" className={cn('absolute bottom-full left-0 z-30 mb-1.5 w-60 rounded-md bg-ink px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg', open ? 'block' : 'hidden')}>
        {badge.tooltip || m.text}
      </span>
    </span>
  );
}

export default function VerificationBadges({ badges = [], size = 'sm', className, skip = [] }) {
  const list = badges.filter((b) => !skip.includes(b.code));
  if (!list.length) return null;
  return <div className={cn('flex flex-wrap gap-1.5', className)}>{list.map((b) => <VerificationBadge key={b.code} badge={b} size={size} />)}</div>;
}
