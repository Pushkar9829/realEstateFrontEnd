// L - CMS pages (about, no-broker policy, terms, privacy, FAQ, careers).
// Content is admin-written plain text: rendered as paragraphs, never as HTML.
// Editorial layout: navy header band with a photo, reading column and a
// contact side card on desktop.
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, FileText, Mail, Phone } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button, EmptyState, Skeleton } from '@/shared/ui';
import { date } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { usePage } from '@/modules/cms/api';
import { usePublicSettings } from '@/modules/search/api';
import env from '@/config/env';
import { hotlineHref } from '../../components/States';

const SLUGS = ['about', 'no-broker-policy', 'terms', 'privacy', 'faq', 'careers'];

// Decorative header photo per page (local stock, never presented as a listing).
const PHOTO = { about: 'towers-green', 'no-broker-policy': 'villa-white', terms: 'office-glass', privacy: 'living-minimal', faq: 'living-light', careers: 'office-lounge' };

export default function CmsPage() {
  const { slug } = useParams();
  const t = useT();
  const { data, isLoading, error } = usePage(slug);
  const settings = usePublicSettings();
  const s = settings.data || {};
  const hotline = s.hotline || env.hotline;
  const known = SLUGS.includes(slug);
  const title = (data && data.title) || (known ? t(`account.cms.titles.${slug}`) : t('account.cms.information'));
  const meta = (data && data.meta) || {};
  const firstPara = data ? String(data.content || '').split(/\n{2,}/)[0] : '';
  useDocumentMeta({ title: meta.title || title, description: meta.description || firstPara || undefined, path: `/p/${slug}` });
  const paras = data ? String(data.content || '').split(/\n{2,}/) : [];

  return (
    <div className="bg-sand-50">
      <header className="relative isolate overflow-hidden bg-navy-950">
        <img src={`/images/stock/${PHOTO[slug] || 'pune-aerial'}.webp`} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/40" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <nav aria-label={t('pages.common.breadcrumb')} className="flex items-center gap-1.5 text-sm text-navy-300">
            <Link to="/" className="transition-colors hover:text-white">{t('pages.common.home')}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate text-navy-200">{title}</span>
          </nav>
          <p className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
            <span className="h-px w-8 bg-current" aria-hidden />{env.appName}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl">{title}</h1>
          {data && data.publishedAt && <p className="mt-4 text-sm text-navy-200">{t('account.cms.updated', { date: date(data.updatedAt || data.publishedAt) })}</p>}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16 lg:py-16">
        <article className="min-w-0 max-w-3xl">
          {isLoading && <div className="space-y-3">{[90, 100, 80, 95, 60].map((w) => <Skeleton key={w} className="h-4" style={{ width: `${w}%` }} />)}</div>}
          {error && (
            <EmptyState icon={FileText} title={error.status === 404 ? t('account.cms.writingTitle') : t('account.cms.loadError')}
              description={error.status === 404 ? t('account.cms.writingText') : error.message}
              className="!rounded-3xl border-navy-900/10"
              action={<Button variant="navy" className="!rounded-full px-6" to="/">{t('account.cms.backHome')}</Button>} />
          )}
          {data && (
            <div className="space-y-6 text-lg leading-relaxed text-navy-600">
              {paras.map((para, i) => (
                <p key={i} className={cn('whitespace-pre-line', i === 0 && 'font-display text-xl leading-relaxed text-navy-800 sm:text-2xl sm:leading-relaxed')}>{para}</p>
              ))}
            </div>
          )}
          <nav className="mt-14 border-t border-navy-900/10 pt-8" aria-label={t('account.cms.nav')}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">{t('pages.cms.more')}</p>
            <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {SLUGS.filter((x) => x !== slug).map((x) => (
                <li key={x}>
                  <Link to={`/p/${x}`} className="group flex items-center justify-between gap-3 border-b border-navy-900/10 py-3.5 font-medium text-navy-900 transition-colors hover:border-gold-500 hover:text-gold-700">
                    {t(`account.cms.titles.${x}`)}
                    <ArrowRight className="h-4 w-4 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-gold-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>

        <aside className="lg:pt-1">
          <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-900/5 lg:sticky lg:top-28">
            <p className="font-display text-xl font-medium text-navy-900">{t('pages.cms.sideTitle')}</p>
            <p className="mt-2 text-sm leading-relaxed text-navy-500">{t('pages.cms.sideText')}</p>
            <a href={hotlineHref(hotline)} className="mt-5 flex items-center gap-3 rounded-2xl bg-sand-100 p-4 transition-colors hover:bg-sand-200">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-gold-300"><Phone className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-medium text-navy-900">{hotline}</span>
                <span className="block text-xs text-navy-500">{t('account.contact.hours')}</span>
              </span>
            </a>
            {s.supportEmail && (
              <a href={`mailto:${s.supportEmail}`} className="mt-3 flex items-center gap-2 break-all px-1 text-sm text-navy-600 transition-colors hover:text-gold-700">
                <Mail className="h-4 w-4 shrink-0 text-gold-700" aria-hidden />{s.supportEmail}
              </a>
            )}
            <Button variant="gold" block size="lg" to="/contact" iconRight={ArrowRight} className="mt-5 !rounded-full font-semibold">{t('account.contact.title')}</Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
