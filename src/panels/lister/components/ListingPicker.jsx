// Select one of the lister's own listings ("All listings" by default).
import { Select } from '@/shared/ui';
import { useOwnListings } from '@/modules/listings/api';

export function useListingOptions() {
  const q = useOwnListings({ limit: 100, sort: '-updatedAt' });
  const items = (q.data && q.data.items) || [];
  return items.filter((l) => l.status !== 'draft').map((l) => ({ value: l._id, label: `${l.listingNo || 'Draft'} · ${l.title || 'Untitled'}` }));
}

export default function ListingPicker({ value, onChange, label = 'Listing', allLabel = 'All listings', className }) {
  const options = useListingOptions();
  return <Select className={className} label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={allLabel} options={options} />;
}
