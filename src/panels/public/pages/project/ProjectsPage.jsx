// New builder projects list (public side of module G): city and name search.
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Search, SearchX } from 'lucide-react';
import { Pagination } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useCities } from '@/modules/listings/api';
import { useProjectSearch } from '@/modules/search/api';
import { CardGridSkeleton, ErrorState, PageBand, PublicEmpty } from '../../components/States';
import { FIELD } from '../../components/FilterPanel';
import ProjectCard from '../../components/ProjectCard';

export default function ProjectsPage() {
  const t = useT();
  useDocumentMeta({ title: t('property.projects.title'), description: t('property.projects.subtitle'), path: '/projects' });
  const [sp, setSp] = useSearchParams();
  const cities = useCities();
  const city = sp.get('city') || '';
  const q = sp.get('q') || '';
  const page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
  const res = useProjectSearch({ ...(city ? { city } : {}), ...(q ? { q } : {}), page, limit: 12 });
  const set = (k, v) => setSp((prev) => { const n = new URLSearchParams(prev); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); return n; });
  const items = (res.data && res.data.items) || [];
  const meta = (res.data && res.data.meta) || {};

  return (
    <>
      <PageBand image="towers-green" crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { label: t('property.projects.title') }]}
        eyebrow={t('discover.projects.eyebrow')} title={t('property.projects.title')} text={t('property.projects.subtitle')}
        stats={res.isSuccess ? [{ label: t('discover.projects.stat'), value: (meta.total || 0).toLocaleString('en-IN') }, ...(city ? [{ label: t('common.city'), value: city }] : [])] : null}>
        <div className="mt-8 grid gap-2 rounded-2xl bg-white p-2 shadow-lift sm:grid-cols-[220px_1fr] lg:max-w-2xl">
          <span className="relative">
            <select aria-label={t('common.city')} value={city} onChange={(e) => set('city', e.target.value)} className={`${FIELD} h-12 appearance-none pl-4 pr-9`}>
              <option value="">{t('common.allCities')}</option>
              {(cities.data || []).map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
          </span>
          <form onSubmit={(e) => { e.preventDefault(); set('q', new FormData(e.currentTarget).get('q')); }} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <input name="q" defaultValue={q} key={q} placeholder={t('property.projects.projectName')} aria-label={t('property.projects.projectName')} className={`${FIELD} h-12 pl-10 pr-4`} />
          </form>
        </div>
      </PageBand>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        {res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} />
          : res.isLoading ? <CardGridSkeleton />
          : !items.length ? <PublicEmpty icon={SearchX} title={t('property.projects.empty')} description={t('property.projects.emptyDesc')} />
          : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
              <div className="mt-6"><Pagination page={meta.page || page} pages={meta.pages} onChange={(n) => set('page', n > 1 ? String(n) : '')} /></div>
            </>
          )}
      </div>
    </>
  );
}
