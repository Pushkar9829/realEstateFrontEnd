// RE-S-PUB-16 compare up to 4 properties side by side (selection kept in
// localStorage); non-live properties are dropped with a notice.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, GitCompareArrows, Minus, X } from 'lucide-react';
import { date, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { Alert, Button, EmptyState, PageHeader, Skeleton } from '@/shared/ui';
import { useMasters } from '@/modules/listings/api';
import { useCompare, useCompareIds } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { enumLabel } from '../../components/useSearchFilters';
import EnquiryModal from '../../components/EnquiryModal';
import { enquiryTarget } from '../../components/PropertyCard';
import { ErrorState } from '../../components/States';

export default function ComparePage() {
  const t = useT();
  useDocumentMeta({ title: t('search.meta.compare'), path: '/compare', noindex: true });
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
        <EmptyState icon={GitCompareArrows} title={t('search.compare.emptyTitle')} description={t('search.compare.emptyDesc')} action={<Button to="/search">{t('search.compare.browse')}</Button>} />
      </div>
    );
  }

  const rows = [
    ['price', (p) => `${shortRupees(p.purpose === 'rent' ? (p.price || {}).monthlyRent : (p.price || {}).amount)}${p.purpose === 'rent' ? t('search.card.perMonth') : ''}`],
    ['ppsf', (p) => (p.price && p.price.pricePerSqft ? rupees(p.price.pricePerSqft) : '-')],
    ['location', (p) => [p.locality, p.city].filter(Boolean).join(', ')],
    ['type', (p) => titleCase(p.type)],
    ['bhk', (p) => (p.bhk ? t('search.card.bhk', { n: p.bhk }) : '-')],
    ['baths', (p) => (p.details && p.details.baths) || '-'],
    ['area', (p) => (p.areaSqft ? t('search.card.sqft', { n: Math.round(p.areaSqft).toLocaleString('en-IN') }) : '-')],
    ['floor', (p) => (p.details && p.details.floor != null ? (p.details.totalFloors ? t('search.compare.floorOf', { floor: p.details.floor, total: p.details.totalFloors }) : String(p.details.floor)) : '-')],
    ['furnishing', (p) => enumLabel(t, 'furnishing', p.furnishing, '-')],
    ['possession', (p) => (p.details && p.details.possession ? `${enumLabel(t, 'possession', p.details.possession.status, '-')}${p.details.possession.date && p.details.possession.status !== 'ready' ? ` (${date(p.details.possession.date)})` : ''}` : '-')],
    ['postedBy', (p) => p.listerBadge],
    ['verification', (p) => (p.badges || []).filter((b) => b.code !== 'verified_lister').map((b) => b.label).join(', ') || '-'],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title={t('search.compare.title')} description={t('search.compare.selected', { n: items.length })} />
      {dropped.length > 0 && <Alert tone="info" className="mb-4">{t('search.compare.dropped', { count: dropped.length === 1 ? 1 : 2, n: dropped.length })}</Alert>}
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <Skeleton className="h-96 w-full" /> : items.length < 2 ? (
        <EmptyState icon={GitCompareArrows} title={t('search.compare.oneMoreTitle')} description={t('search.compare.oneMoreDesc')} action={<Button to="/search">{t('search.compare.browse')}</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[640px] table-fixed text-sm">
            <thead>
              <tr>
                <th className="w-36 bg-surface-muted p-3 text-left text-xs font-semibold uppercase text-ink-subtle">{t('search.compare.property')}</th>
                {items.map((p) => (
                  <th key={p.id} className="p-3 text-left align-top font-normal">
                    <div className="relative">
                      <button type="button" onClick={() => remove(p.id)} className="absolute right-0 top-0 rounded-full bg-white/90 p-1 text-ink-subtle shadow hover:text-ink" aria-label={t('search.compare.removeAria', { title: p.title })}><X className="h-4 w-4" /></button>
                      {p.cover ? <img src={p.cover.url} alt="" className="aspect-[4/3] w-full rounded object-cover" /> : <div className="aspect-[4/3] w-full rounded bg-surface-sunken" />}
                      <Link to={`/property/${p.slug}`} className="mt-2 line-clamp-2 block font-medium text-ink hover:text-brand-700">{p.title}</Link>
                      <p className="text-xs text-ink-subtle">{p.listingNo}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([key, fn]) => (
                <tr key={key}><th scope="row" className="bg-surface-muted p-3 text-left text-xs font-medium text-ink-muted">{t(`search.compare.rows.${key}`)}</th>{items.map((p) => <td key={p.id} className="p-3 text-ink">{fn(p)}</td>)}</tr>
              ))}
              {allAmenities.map((a) => (
                <tr key={a}><th scope="row" className="bg-surface-muted p-3 text-left text-xs font-medium text-ink-muted">{amenityNames[a] || titleCase(a)}</th>
                  {items.map((p) => <td key={p.id} className="p-3">{(p.amenities || []).includes(a) ? <Check className="h-4 w-4 text-success-600" aria-label={t('common.yes')} /> : <Minus className="h-4 w-4 text-ink-subtle" aria-label={t('common.no')} />}</td>)}
                </tr>
              ))}
              <tr><th scope="row" className="bg-surface-muted p-3" />{items.map((p) => <td key={p.id} className="p-3"><Button size="sm" block onClick={() => setEnquire(enquiryTarget(p))}>{t('search.compare.enquire')}</Button></td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
      <EnquiryModal open={Boolean(enquire)} target={enquire} onClose={() => setEnquire(null)} />
    </div>
  );
}
