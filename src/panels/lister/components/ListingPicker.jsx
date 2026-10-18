// Select one of the lister's own listings ("All listings" by default).
import { Select } from '@/shared/ui';
import { useOwnListings } from '@/modules/listings/api';
import { useT } from '@/shared/i18n';

export function useListingOptions() {
  const t = useT();
  const q = useOwnListings({ limit: 100, sort: '-updatedAt' });
  const items = (q.data && q.data.items) || [];
  return items.filter((l) => l.status !== 'draft').map((l) => ({ value: l._id, label: `${l.listingNo || t('lister.status.draft')} · ${l.title || t('lister.common.untitled')}` }));
}

export default function ListingPicker({ value, onChange, label, allLabel, className }) {
  const t = useT();
  const options = useListingOptions();
  return <Select className={className} label={label || t('lister.leads.col.listing')} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={allLabel || t('lister.common.allListings')} options={options} />;
}
