// L - CMS pages (about, no-broker policy, terms, privacy, FAQ, careers).
// Content is admin-written plain text: rendered as paragraphs, never as HTML.
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@/shared/ui';
import { date } from '@/shared/lib/format';
import { usePage } from '@/modules/cms/api';
import env from '@/config/env';

const TITLES = { about: 'About us', 'no-broker-policy': 'No-broker policy', terms: 'Terms of use', privacy: 'Privacy policy', faq: 'FAQ', careers: 'Careers' };

export default function CmsPage() {
  const { slug } = useParams();
  const { data, isLoading, error } = usePage(slug);
  const title = (data && data.title) || TITLES[slug] || 'Information';

  useEffect(() => {
    document.title = `${title} | ${env.appName}`;
    return () => { document.title = `${env.appName} - Verified, broker-free property`; };
  }, [title]);

  return (
    <div className="bg-white">
      <div className="border-b bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{env.appName}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{title}</h1>
          {data && data.publishedAt && <p className="mt-2 text-sm text-ink-subtle">Last updated {date(data.updatedAt || data.publishedAt)}</p>}
        </div>
      </div>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {isLoading && <div className="space-y-3">{[90, 100, 80, 95, 60].map((w) => <Skeleton key={w} className="h-4" style={{ width: `${w}%` }} />)}</div>}
        {error && (
          <EmptyState icon={FileText} title={error.status === 404 ? 'This page is being written' : 'Could not load this page'}
            description={error.status === 404 ? 'Our team has not published this page yet. Please check back soon.' : error.message}
            action={<Button variant="secondary" to="/">Back to home</Button>} />
        )}
        {data && (
          <div className="space-y-4 text-base leading-relaxed text-ink-muted">
            {String(data.content || '').split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
          </div>
        )}
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t pt-6 text-sm" aria-label="Information pages">
          {Object.entries(TITLES).filter(([s]) => s !== slug).map(([s, t]) => <Link key={s} to={`/p/${s}`} className="text-brand-700 hover:underline">{t}</Link>)}
        </nav>
      </article>
    </div>
  );
}
