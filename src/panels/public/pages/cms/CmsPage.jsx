// L - CMS pages (about, no-broker policy, terms, privacy, FAQ, careers).
// Content is admin-written plain text: rendered as paragraphs, never as HTML.
import { Link, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@/shared/ui';
import { date } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { usePage } from '@/modules/cms/api';
import env from '@/config/env';

const SLUGS = ['about', 'no-broker-policy', 'terms', 'privacy', 'faq', 'careers'];

export default function CmsPage() {
  const { slug } = useParams();
  const t = useT();
  const { data, isLoading, error } = usePage(slug);
  const known = SLUGS.includes(slug);
  const title = (data && data.title) || (known ? t(`account.cms.titles.${slug}`) : t('account.cms.information'));
  const meta = (data && data.meta) || {};
  const firstPara = data ? String(data.content || '').split(/\n{2,}/)[0] : '';
  useDocumentMeta({ title: meta.title || title, description: meta.description || firstPara || undefined, path: `/p/${slug}` });

  return (
    <div className="bg-white">
      <div className="border-b bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{env.appName}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{title}</h1>
          {data && data.publishedAt && <p className="mt-2 text-sm text-ink-subtle">{t('account.cms.updated', { date: date(data.updatedAt || data.publishedAt) })}</p>}
        </div>
      </div>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {isLoading && <div className="space-y-3">{[90, 100, 80, 95, 60].map((w) => <Skeleton key={w} className="h-4" style={{ width: `${w}%` }} />)}</div>}
        {error && (
          <EmptyState icon={FileText} title={error.status === 404 ? t('account.cms.writingTitle') : t('account.cms.loadError')}
            description={error.status === 404 ? t('account.cms.writingText') : error.message}
            action={<Button variant="secondary" to="/">{t('account.cms.backHome')}</Button>} />
        )}
        {data && (
          <div className="space-y-4 text-base leading-relaxed text-ink-muted">
            {String(data.content || '').split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
          </div>
        )}
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t pt-6 text-sm" aria-label={t('account.cms.nav')}>
          {SLUGS.filter((s) => s !== slug).map((s) => <Link key={s} to={`/p/${s}`} className="text-brand-700 hover:underline">{t(`account.cms.titles.${s}`)}</Link>)}
        </nav>
      </article>
    </div>
  );
}
