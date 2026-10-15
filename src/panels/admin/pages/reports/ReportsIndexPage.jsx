// RE-S-ADM-28 report catalogue (reports.view). Managers get team-scoped numbers.
import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import { Badge, PageHeader } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { REPORTS } from '@/modules/reports/adminApi';

export default function ReportsIndexPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Reports" description="Pick a report, set the date range and export the table as CSV. Large exports run in the background and stay downloadable for 24 hours."
        actions={user.role === 'manager' ? <Badge tone="info">Your teams only</Badge> : null} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <li key={r.key}>
            <Link to={`/admin/reports/${r.key}`} className="group flex h-full items-start gap-4 rounded-lg border bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
              <span className="rounded-md bg-brand-50 p-2.5 text-brand-700"><BarChart3 className="h-5 w-5" aria-hidden /></span>
              <span className="flex-1">
                <span className="block font-semibold text-ink">{r.label}</span>
                <span className="mt-1 block text-sm text-ink-subtle">{r.description}</span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 text-ink-subtle group-hover:text-brand-700" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
