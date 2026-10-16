// RE-S-PUB-21 request a property page (also opened as a modal from search).
// Query-string filters (purpose, city, localities, bhk, minPrice, maxPrice) prefill the form.
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, ClipboardList, Search } from 'lucide-react';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { filtersFromParams } from '@/modules/search/api';
import RequestPropertyForm from '../../components/RequestPropertyForm';
import { IMG, PageBand } from '../../components/States';

const STEPS = [[ClipboardList, 's1'], [Search, 's2'], [CalendarCheck, 's3']];

export default function RequestPropertyPage() {
  const t = useT();
  const [sp] = useSearchParams();
  useDocumentMeta({ title: t('account.meta.requestTitle'), description: t('account.meta.requestDesc'), path: '/request-property' });
  return (
    <>
      <PageBand image="living-warm" crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { label: t('account.request.title') }]}
        eyebrow={t('discover.request.eyebrow')} title={t('account.request.title')} text={t('account.request.description')} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:py-16">
        <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy-900/5 sm:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-navy-900/5 pb-5 text-sm text-navy-600">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><ClipboardList className="h-5 w-5" aria-hidden /></span>
            {t('account.request.minute')}
          </div>
          <RequestPropertyForm prefill={filtersFromParams(sp)} />
        </div>
        <aside className="relative isolate self-start overflow-hidden rounded-3xl bg-navy-900 p-7 lg:sticky lg:top-24">
          <img src={IMG('kitchen-open')} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/70 via-navy-950/90 to-navy-950" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">{t('discover.request.how')}</p>
          <ol className="mt-6 space-y-6">
            {STEPS.map(([Icon, k], i) => (
              <li key={k} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-300 ring-1 ring-white/15"><Icon className="h-5 w-5" aria-hidden /></span>
                <span>
                  <span className="block font-display text-lg font-medium text-white"><span className="mr-2 text-gold-400">0{i + 1}</span>{t(`discover.request.${k}Title`)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-navy-200">{t(`discover.request.${k}Text`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
