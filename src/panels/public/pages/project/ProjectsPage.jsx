// New builder projects list (public side of module G): city and name search.
import { useSearchParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Card, EmptyState, Pagination, Select } from '@/shared/ui';
import { useCities } from '@/modules/listings/api';
import { useProjectSearch } from '@/modules/search/api';
import { CardGridSkeleton, ErrorState } from '../../components/States';
import ProjectCard from '../../components/ProjectCard';

export default function ProjectsPage() {
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">New projects</h1>
          <p className="mt-1 text-sm text-ink-muted">RERA-registered projects from verified builders, with configurations and price ranges.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select aria-label="City" placeholder="All cities" value={city} onChange={(e) => set('city', e.target.value)} options={(cities.data || []).map((c) => ({ value: c.name, label: c.name }))} />
          <form onSubmit={(e) => { e.preventDefault(); set('q', new FormData(e.currentTarget).get('q')); }}>
            <input name="q" defaultValue={q} key={q} placeholder="Project name" aria-label="Project name" className="h-10 w-full rounded-md border border-line-strong px-3 text-sm focus:border-brand-500 focus:outline-none sm:w-56" />
          </form>
        </div>
      </div>
      {res.isError ? <ErrorState error={res.error} onRetry={() => res.refetch()} />
        : res.isLoading ? <CardGridSkeleton />
        : !items.length ? <EmptyState icon={SearchX} title="No projects found" description="Try another city or clear the search." />
        : (
          <Card padded={false} className="border-0 bg-transparent shadow-none">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
            <Pagination page={meta.page || page} pages={meta.pages} onChange={(n) => set('page', n > 1 ? String(n) : '')} />
          </Card>
        )}
    </div>
  );
}
