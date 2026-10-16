// RE-S-PUB-11 shortlist and RE-S-PUB-12 saved searches (signed-in buyers
// and listers). Shortlist: status, price-drop badge, remove, compare and
// "Enquire on all selected" (max 5). Saved searches: frequency, new matches,
// edit, delete and run.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle2, Heart, Pencil, Play, Search, Trash2, TrendingDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Modal, PageHeader, Skeleton, Tabs, useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { FREQUENCIES, describeFilters, useDeleteSavedSearch, useSavedSearches, useShortlist, useToggleShortlist } from '@/modules/search/api';
import { useCreateEnquiry } from '@/modules/leads/publicApi';
import PropertyCard, { cardPrice } from '../../components/PropertyCard';
import { SaveSearchModal } from '../../components/SmallModals';
import { CardGridSkeleton, ErrorState } from '../../components/States';
import { CompareTray } from '../../components/SearchChrome';
import { leadErrorText } from '../../components/GuestVerify';

const MAX_BULK = 5;

function BulkEnquiry({ open, onClose, items, onDone }) {
  const t = useT();
  const create = useCreateEnquiry();
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const out = [];
    for (const c of items) {
      try { const r = await create.mutateAsync({ type: 'enquiry', propertyId: c.id, consent: true }); out.push({ c, ok: true, leadNo: r.leadNo }); } catch (e) { out.push({ c, ok: false, error: leadErrorText(e) }); }
    }
    setResults(out); setBusy(false); onDone();
  };
  const close = () => { setResults(null); setConsent(false); onClose(); };
  return (
    <Modal open={open} onClose={close} title={t('account.shortlist.bulkTitle', { count: items.length })}
      footer={results ? <Button onClick={close}>{t('account.shortlist.done')}</Button> : <><Button variant="ghost" onClick={close}>{t('common.cancel')}</Button><Button onClick={run} loading={busy} disabled={!consent}>{t('account.shortlist.sendEnquiries')}</Button></>}>
      {results ? (
        <ul className="space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.c.id} className="flex items-start gap-2">
              {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden /> : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger-600" aria-hidden />}
              <span><span className="font-medium text-ink">{r.c.title}</span><span className="block text-xs text-ink-subtle">{r.ok ? t('account.shortlist.reference', { no: r.leadNo }) : r.error}</span></span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">{items.map((c) => <li key={c.id}>{c.title} ({c.listingNo})</li>)}</ul>
          <p className="text-sm text-ink-muted">{t('account.shortlist.bulkNote')}</p>
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t('account.shortlist.consent')} />
        </div>
      )}
    </Modal>
  );
}

function ShortlistTab() {
  const t = useT();
  const q = useShortlist();
  const toggle = useToggleShortlist();
  const toast = useToast();
  const [selected, setSelected] = useState([]);
  const [bulk, setBulk] = useState(false);
  const rows = q.data || [];
  const live = rows.filter((r) => r.available);
  const select = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_BULK ? s : [...s, id]));
  const remove = (id) => toggle.mutate({ id, saved: true }, { onSuccess: () => toast.success(t('account.shortlist.removed')), onError: (e) => toast.error(e.message) });

  if (q.isLoading) return <CardGridSkeleton count={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!rows.length) return <EmptyState icon={Heart} title={t('account.shortlist.emptyTitle')} description={t('account.shortlist.emptyText')} action={<Button to="/search" icon={Search}>{t('account.shortlist.browse')}</Button>} />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{t('account.shortlist.summary', { saved: rows.length, live: live.length })}</p>
        <Button size="sm" disabled={!selected.length} onClick={() => setBulk(true)}>{t('account.shortlist.enquireSelected', { count: selected.length, max: MAX_BULK })}</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          if (!r.available) {
            return (
              <Card key={r.id} className="flex flex-col items-start justify-between gap-3 border-dashed">
                <div><Badge>{t('account.shortlist.noLongerAvailable')}</Badge><p className="mt-2 text-sm text-ink-muted">{t('account.shortlist.goneText', { date: date(r.savedAt) })}</p></div>
                <Button size="sm" variant="secondary" icon={Trash2} onClick={() => remove(r.id)}>{t('account.shortlist.remove')}</Button>
              </Card>
            );
          }
          const now = cardPrice(r);
          const drop = r.priceAtSave && now && now < r.priceAtSave ? Math.round(((r.priceAtSave - now) / r.priceAtSave) * 100) : 0;
          return (
            <div key={r.id} className="relative">
              <PropertyCard card={r} />
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <Checkbox label={t('account.shortlist.select')} checked={selected.includes(r.id)} disabled={!selected.includes(r.id) && selected.length >= MAX_BULK} onChange={() => select(r.id)} />
                <div className="flex items-center gap-2">
                  {drop > 0 && <Badge tone="success" icon={TrendingDown}>{t('account.shortlist.priceDown', { pct: drop })}</Badge>}
                  <button type="button" onClick={() => remove(r.id)} className="text-ink-subtle hover:text-danger-700" aria-label={t('account.shortlist.removeItem', { title: r.title })}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <BulkEnquiry open={bulk} onClose={() => setBulk(false)} items={live.filter((r) => selected.includes(r.id))} onDone={() => setSelected([])} />
      <CompareTray />
    </>
  );
}

function SavedTab() {
  const t = useT();
  const q = useSavedSearches();
  const del = useDeleteSavedSearch();
  const toast = useToast();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const rows = q.data || [];
  const freq = (f) => {
    const key = `account.saved.freq.${f}`;
    const v = t(key);
    return v === key ? (FREQUENCIES.find((x) => x.value === f) || { label: f }).label : v;
  };

  if (q.isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!rows.length) return <EmptyState icon={BellRing} title={t('account.saved.emptyTitle')} description={t('account.saved.emptyText')} action={<Button to="/search" icon={Search}>{t('account.saved.start')}</Button>} />;

  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">{t('account.saved.summary', { count: rows.length })}</p>
      <ul className="space-y-3">
        {rows.map((s) => (
          <li key={s._id}>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{s.name}
                  <Badge tone={s.frequency === 'off' ? 'neutral' : 'brand'}>{freq(s.frequency)}</Badge>
                  {s.matchCountSinceVisit > 0 && <Badge tone="accent">{t('account.saved.newCount', { count: s.matchCountSinceVisit })}</Badge>}
                </p>
                <p className="mt-1 truncate text-xs text-ink-subtle">{describeFilters(s.filters).join(' · ') || t('account.saved.all')} · {t('account.saved.created', { date: date(s.createdAt) })}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" icon={Play} onClick={() => navigate(`/search?${new URLSearchParams(s.filters)}`)}>{t('account.saved.run')}</Button>
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEdit(s)}>{t('account.saved.edit')}</Button>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('account.saved.deleteItem', { name: s.name })} onClick={() => setConfirm(s)} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <SaveSearchModal open={Boolean(edit)} saved={edit} onClose={() => setEdit(null)} />
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={t('account.saved.deleteTitle')} size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={del.isPending} onClick={() => del.mutate(confirm._id, { onSuccess: () => { toast.success(t('account.saved.deleted')); setConfirm(null); }, onError: (e) => toast.error(e.message) })}>{t('account.saved.delete')}</Button></>}>
        <p className="text-sm text-ink-muted">{t('account.saved.deleteText', { name: confirm ? confirm.name : '' })}</p>
      </Modal>
    </>
  );
}

export default function ShortlistPage() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = /saved-searches/.test(location.pathname) || new URLSearchParams(location.search).get('tab') === 'saved' ? 'saved' : 'shortlist';
  useDocumentMeta({ title: t(tab === 'saved' ? 'account.meta.savedSearches' : 'account.meta.shortlist'), noindex: true });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader title={t('account.shortlist.title')} description={t('account.shortlist.description')} />
      <Tabs className="mb-6" value={tab} onChange={(next) => navigate(next === 'saved' ? '/account/saved-searches' : '/shortlist')}
        tabs={[{ value: 'shortlist', label: t('account.shortlist.tabShortlist') }, { value: 'saved', label: t('account.shortlist.tabSaved') }]} />
      <div className={cn(tab !== 'shortlist' && 'hidden')}>{tab === 'shortlist' && <ShortlistTab />}</div>
      {tab === 'saved' && <SavedTab />}
      {tab === 'shortlist' && <Alert tone="info" className="mt-8">{t('account.shortlist.dropAlert')}</Alert>}
    </div>
  );
}
