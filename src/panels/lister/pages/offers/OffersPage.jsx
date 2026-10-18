// RE-S-LIS-18 offers inbox: offers relayed by our agents, grouped by status.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Handshake } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, Skeleton, Tabs } from '@/shared/ui';
import { dateTime, rupees } from '@/shared/lib/format';
import { lastRound, offerStatus, timeLeft, useListerOffers } from '@/modules/leads/listerApi';
import { useT } from '@/shared/i18n';

// Tab labels: lister.offers.tabs.<key>.
const TABS = [
  { value: 'awaiting_lister', key: 'mine' },
  { value: 'awaiting_buyer', key: 'buyer' },
  { value: 'accepted', key: 'accepted' },
  { value: 'declined,expired,withdrawn', key: 'closed' },
];

function OfferCard({ o }) {
  const t = useT();
  const s = offerStatus(o.status);
  const r = lastRound(o);
  const left = o.canRespond ? timeLeft(o.validUntil) : null;
  return (
    <li>
      <Link to={`/lister/offers/${o.id}`} className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.tone}>{s.label}</Badge>
            <span className="text-xs text-ink-subtle">{o.offerNo}</span>
            {left && <Badge tone={left === 'expired' ? 'danger' : 'warning'} icon={Clock}>{left === 'expired' ? t('lister.offers.expired') : left}</Badge>}
          </div>
          <p className="mt-1 truncate text-base font-semibold text-ink">{o.property ? `${o.property.listingNo} · ${o.property.title}` : t('lister.leads.col.listing')}</p>
          <p className="text-sm text-ink-subtle">{o.buyer} · {t('lister.offers.round', { n: o.rounds.length })}{r ? ` · ${r.by === 'You' ? t('lister.offers.you') : r.by} · ${dateTime(r.at)}` : ''}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xl font-semibold text-ink">{r ? rupees(r.amount) : '-'}</p>
          {r && r.terms && r.terms.token ? <p className="text-xs text-ink-subtle">{t('lister.offers.token', { amount: rupees(r.terms.token) })}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export default function OffersPage() {
  const t = useT();
  const [status, setStatus] = useState('awaiting_lister');
  const { data, isLoading, isError, refetch } = useListerOffers({ status });
  const rows = data || [];
  return (
    <>
      <PageHeader title={t('panel.nav.listerOffers')} description={t('lister.offers.desc')} />
      <Tabs className="mb-4" value={status} onChange={setStatus} tabs={TABS.map(({ key, ...tab }) => ({ ...tab, label: t(`lister.offers.tabs.${key}`), ...(tab.value === status && data ? { count: rows.length } : {}) }))} />
      {isError ? (
        <Alert tone="danger" title={t('lister.offers.loadError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
      ) : isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Handshake} title={t('lister.offers.noOffers')} description={status === 'awaiting_lister' ? t('lister.offers.nothingWaiting') : t('lister.offers.nothingTab')} />
      ) : (
        <ul className="space-y-3">{rows.map((o) => <OfferCard key={o.id} o={o} />)}</ul>
      )}
    </>
  );
}
