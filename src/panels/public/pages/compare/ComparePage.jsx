// RE-S-PUB-16 compare up to 4 properties side by side (selection kept in
// localStorage); non-live properties are dropped with a notice.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, GitCompareArrows, Minus, X } from 'lucide-react';
import { date, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { Alert, Button, EmptyState, PageHeader, Skeleton } from '@/shared/ui';
import { useMasters } from '@/modules/listings/api';
import { FURNISHING, POSSESSION, useCompare, useCompareIds } from '@/modules/search/api';
import EnquiryModal from '../../components/EnquiryModal';
import { enquiryTarget } from '../../components/PropertyCard';
import { ErrorState } from '../../components/States';

export default function ComparePage() {
  const { ids, remove } = useCompareIds();
  const q = useCompare(ids);
  const masters = useMasters();
  const [enquire, setEnquire] = useState(null);
  const items = (q.data && q.data.items) || [];
  const dropped = (q.data && q.data.dropped) || [];
  useEffect(() => { dropped.forEach((id) => remove(id)); }, [dropped.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const amenityNames = useMemo(() => Object.fromEntries(((masters.data && masters.data.amenities) || []).map((a) => [a.code, a.name])), [masters.data]);
  const allAmenities = [...new Set(items.flatMap((p) => p.amenities || []))];

  if (ids.length < 2 && !dropped.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState icon={GitCompareArrows} title="Add properties to compare" description="Tick Compare on 2 to 4 property cards in your search results or shortlist." action={<Button to="/search">Browse properties</Button>} />
      </div>
    );
  }

  const rows = [
    ['Price', (p) => `${shortRupees(p.purpose === 'rent' ? (p.price || {}).monthlyRent : (p.price || {}).amount)}${p.purpose === 'rent' ? ' / month' : ''}`],
    ['Price per sq ft', (p) => (p.price && p.price.pricePerSqft ? rupees(p.price.pricePerSqft) : '-')],
    ['Location', (p) => [p.locality, p.city].filter(Boolean).join(', ')],
    ['Type', (p) => titleCase(p.type)],
    ['BHK', (p) => (p.bhk ? `${p.bhk} BHK` : '-')],
    ['Bathrooms', (p) => (p.details && p.details.baths) || '-'],
    ['Area', (p) => (p.areaSqft ? `${Math.round(p.areaSqft).toLocaleString('en-IN')} sq ft` : '-')],
    ['Floor', (p) => (p.details && p.details.floor != null ? `${p.details.floor}${p.details.totalFloors ? ` of ${p.details.totalFloors}` : ''}` : '-')],
    ['Furnishing', (p) => FURNISHING[p.furnishing] || '-'],
    ['Possession', (p) => (p.details && p.details.possession ? `${POSSESSION[p.details.possession.status] || '-'}${p.details.possession.date && p.details.possession.status !== 'ready' ? ` (${date(p.details.possession.date)})` : ''}` : '-')],
    ['Posted by', (p) => p.listerBadge],
    ['Verification', (p) => (p.badges || []).filter((b) => b.code !== 'verified_lister').map((b) => b.label).join(', ') || '-'],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title="Compare properties" description={`${items.length} of 4 selected`} />
      {dropped.length > 0 && <Alert tone="info" className="mb-4">{dropped.length} {dropped.length === 1 ? 'property is' : 'properties are'} no longer available and {dropped.length === 1 ? 'was' : 'were'} removed.</Alert>}
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <Skeleton className="h-96 w-full" /> : items.length < 2 ? (
        <EmptyState icon={GitCompareArrows} title="Add one more property" description="You need at least 2 properties to compare." action={<Button to="/search">Browse properties</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[640px] table-fixed text-sm">
            <thead>
              <tr>
                <th className="w-36 bg-surface-muted p-3 text-left text-xs font-semibold uppercase text-ink-subtle">Property</th>
                {items.map((p) => (
                  <th key={p.id} className="p-3 text-left align-top font-normal">
                    <div className="relative">
                      <button type="button" onClick={() => remove(p.id)} className="absolute right-0 top-0 rounded-full bg-white/90 p-1 text-ink-subtle shadow hover:text-ink" aria-label={`Remove ${p.title}`}><X className="h-4 w-4" /></button>
                      {p.cover ? <img src={p.cover.url} alt="" className="aspect-[4/3] w-full rounded object-cover" /> : <div className="aspect-[4/3] w-full rounded bg-surface-sunken" />}
                      <Link to={`/property/${p.slug}`} className="mt-2 line-clamp-2 block font-medium text-ink hover:text-brand-700">{p.title}</Link>
                      <p className="text-xs text-ink-subtle">{p.listingNo}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([label, fn]) => (
                <tr key={label}><th scope="row" className="bg-surface-muted p-3 text-left text-xs font-medium text-ink-muted">{label}</th>{items.map((p) => <td key={p.id} className="p-3 text-ink">{fn(p)}</td>)}</tr>
              ))}
              {allAmenities.map((a) => (
                <tr key={a}><th scope="row" className="bg-surface-muted p-3 text-left text-xs font-medium text-ink-muted">{amenityNames[a] || titleCase(a)}</th>
                  {items.map((p) => <td key={p.id} className="p-3">{(p.amenities || []).includes(a) ? <Check className="h-4 w-4 text-success-600" aria-label="Yes" /> : <Minus className="h-4 w-4 text-ink-subtle" aria-label="No" />}</td>)}
                </tr>
              ))}
              <tr><th scope="row" className="bg-surface-muted p-3" />{items.map((p) => <td key={p.id} className="p-3"><Button size="sm" block onClick={() => setEnquire(enquiryTarget(p))}>Enquire</Button></td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
      <EnquiryModal open={Boolean(enquire)} target={enquire} onClose={() => setEnquire(null)} />
    </div>
  );
}
