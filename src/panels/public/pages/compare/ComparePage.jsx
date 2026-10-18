// RE-S-PUB-16 compare up to 4 properties side by side (selection kept in
// localStorage); non-live properties are dropped with a notice.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, GitCompareArrows, Minus, X } from 'lucide-react';
import { date, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { Button } from '@/shared/ui';
import { useMasters } from '@/modules/listings/api';
import { useCompare, useCompareIds } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { enumLabel } from '../../components/useSearchFilters';
import EnquiryModal from '../../components/EnquiryModal';
import { enquiryTarget } from '../../components/PropertyCard';
import { ErrorState, PageBand, PublicEmpty, Shimmer } from '../../components/States';
import { badgeLabel, listerBadgeText } from '@/panels/public/components/VerificationBadges';

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
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <PublicEmpty icon={GitCompareArrows} title={t('search.compare.emptyTitle')} description={t('search.compare.emptyDesc')} action={<Button variant="gold" size="lg" className="rounded-full" to="/search">{t('search.compare.browse')}</Button>} />
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
    ['postedBy', (p) => listerBadgeText(t, p)],
    ['verification', (p) => (p.badges || []).filter((b) => b.code !== 'verified_lister').map((b) => badgeLabel(t, b.labelCode, b.brand, b.label)).join(', ') || '-'],
  ];

  const ROW_HEAD = 'sticky left-0 z-10 w-32 bg-sand-50 p-4 text-left align-top text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-500 shadow-[1px_0_0_rgba(13,21,38,0.06)] sm:w-40';

  return (
    <>
      <PageBand image="living-minimal" crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { label: t('search.compare.title') }]}
        eyebrow={t('discover.compare.eyebrow')} title={t('search.compare.title')} text={t('search.compare.selected', { n: items.length })} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        {dropped.length > 0 && <p role="status" className="mb-6 rounded-2xl bg-gold-50 p-4 text-sm text-navy-700 ring-1 ring-gold-200">{t('search.compare.dropped', { count: dropped.length === 1 ? 1 : 2, n: dropped.length })}</p>}
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <Shimmer className="h-96 w-full rounded-3xl bg-sand-200" /> : items.length < 2 ? (
          <PublicEmpty icon={GitCompareArrows} title={t('search.compare.oneMoreTitle')} description={t('search.compare.oneMoreDesc')} action={<Button variant="gold" size="lg" className="rounded-full" to="/search">{t('search.compare.browse')}</Button>} />
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-white shadow-card ring-1 ring-navy-900/5">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <thead>
                <tr>
                  <th className={ROW_HEAD}>{t('search.compare.property')}</th>
                  {items.map((p) => (
                    <th key={p.id} className="p-4 text-left align-top font-normal">
                      <div className="relative">
                        <button type="button" onClick={() => remove(p.id)} className="absolute right-2 top-2 z-[1] rounded-full bg-white/95 p-1.5 text-navy-500 shadow-card transition hover:text-navy-900" aria-label={t('search.compare.removeAria', { title: p.title })}><X className="h-4 w-4" /></button>
                        {p.cover ? <img src={p.cover.url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="aspect-[4/3] w-full rounded-xl bg-sand-200" />}
                        <Link to={`/property/${p.slug}`} className="mt-3 line-clamp-2 block font-display text-base font-medium leading-snug text-navy-900 transition-colors hover:text-gold-700">{p.title}</Link>
                        <p className="mt-0.5 text-xs text-navy-500">{p.listingNo}</p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-900/5">
                {rows.map(([key, fn]) => (
                  <tr key={key}><th scope="row" className={ROW_HEAD}>{t(`search.compare.rows.${key}`)}</th>
                    {items.map((p) => <td key={p.id} className={key === 'price' ? 'p-4 font-display text-xl font-semibold tracking-tight text-navy-900' : 'p-4 text-navy-700'}>{fn(p)}</td>)}
                  </tr>
                ))}
                {allAmenities.map((a) => (
                  <tr key={a}><th scope="row" className={ROW_HEAD}>{amenityNames[a] || titleCase(a)}</th>
                    {items.map((p) => <td key={p.id} className="p-4">{(p.amenities || []).includes(a) ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><Check className="h-4 w-4" aria-label={t('common.yes')} /></span> : <Minus className="ml-1.5 h-4 w-4 text-navy-300" aria-label={t('common.no')} />}</td>)}
                  </tr>
                ))}
                <tr><th scope="row" className={ROW_HEAD} />{items.map((p) => <td key={p.id} className="p-4"><Button variant="navy" size="md" block className="rounded-full" onClick={() => setEnquire(enquiryTarget(p))}>{t('search.compare.enquire')}</Button></td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <EnquiryModal open={Boolean(enquire)} target={enquire} onClose={() => setEnquire(null)} />
    </>
  );
}
