// RE-S-AGT-15 (and the admin equivalent): the notification centre of
// RE-S-LIS-15 for the agent and admin panels. Unread / category filter, mark
// read, mark all read; links open in-app routes only. Account links
// (/account?tab=...) open the account page of the current panel.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, Pagination, Select, Skeleton, Tabs, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime, timeAgo } from '@/shared/lib/format';
import { NOTIFICATION_FILTERS, notificationCategoryLabel, useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '@/modules/notifications/api';

const internal = (link) => typeof link === 'string' && link.startsWith('/') && !link.startsWith('//');

// "/account?tab=privacy" -> "/agent/account?tab=privacy" inside a panel.
export function panelLink(link, base) {
  if (!internal(link)) return null;
  if (base && (link === '/account' || link.startsWith('/account?') || link.startsWith('/account#'))) return `${base}${link}`;
  return link;
}

export default function NotificationsPage({ base, description = 'Updates on your work. Kept for 180 days.' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useNotifications({ page, limit: 20, ...(tab === 'unread' ? { unread: 'true' } : {}) });
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const rows = ((data && data.items) || []).filter((n) => !category || n.category === category || (category === 'finance' && n.category === 'invoices'));

  const open = async (n) => {
    if (!n.readAt) { try { await markRead.mutateAsync(n._id); } catch (e) { toast.error(e.message); } }
    const to = panelLink(n.link, base);
    if (to) navigate(to);
  };
  const readAll = async () => {
    try { const r = await markAll.mutateAsync(); toast.success(r.updated ? `${r.updated} marked as read` : 'Nothing unread'); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Notifications" description={description}
        actions={<Button variant="secondary" icon={CheckCheck} loading={markAll.isPending} disabled={!unread.data} onClick={readAll}>Mark all read</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: unread.data || undefined }]} />
        <Select className="sm:w-56" label="Category" placeholder="All categories" options={NOTIFICATION_FILTERS} value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      {isError ? <Alert tone="danger" title="Could not load notifications" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />
        : isLoading ? <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          : rows.length === 0 ? <EmptyState icon={Bell} title="You are all caught up" description={category ? 'Nothing in this category on this page.' : undefined} />
            : (
              <ul className="divide-y overflow-hidden rounded-lg border bg-white shadow-sm">
                {rows.map((n) => (
                  <li key={n._id}>
                    <button type="button" onClick={() => open(n)} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted', !n.readAt && 'bg-brand-50/40')}>
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-600')} aria-label={n.readAt ? undefined : 'Unread'} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={cn('text-sm text-ink', !n.readAt && 'font-semibold')}>{n.title || 'Notification'}</span>
                          <Badge>{notificationCategoryLabel(n.category)}</Badge>
                        </span>
                        {n.body && <span className="mt-0.5 block text-sm text-ink-muted">{n.body}</span>}
                      </span>
                      <time className="shrink-0 text-xs text-ink-subtle" dateTime={n.createdAt} title={dateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}
