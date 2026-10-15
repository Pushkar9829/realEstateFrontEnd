// RE-S-LIS-18 offers inbox: offers relayed by our agents, grouped by status.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Handshake } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, Skeleton, Tabs } from '@/shared/ui';
import { dateTime, rupees } from '@/shared/lib/format';
import { lastRound, offerStatus, timeLeft, useListerOffers } from '@/modules/leads/listerApi';

const TABS = [
  { value: 'awaiting_lister', label: 'Awaiting my response' },
  { value: 'awaiting_buyer', label: 'Awaiting buyer' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined,expired,withdrawn', label: 'Declined / expired' },
];

function OfferCard({ o }) {
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
            {left && <Badge tone={left === 'expired' ? 'danger' : 'warning'} icon={Clock}>{left}</Badge>}
          </div>
          <p className="mt-1 truncate text-base font-semibold text-ink">{o.property ? `${o.property.listingNo} · ${o.property.title}` : 'Listing'}</p>
          <p className="text-sm text-ink-subtle">{o.buyer} · round {o.rounds.length}{r ? ` · ${r.by} · ${dateTime(r.at)}` : ''}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xl font-semibold text-ink">{r ? rupees(r.amount) : '-'}</p>
          {r && r.terms && r.terms.token ? <p className="text-xs text-ink-subtle">Token {rupees(r.terms.token)}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export default function OffersPage() {
  const [status, setStatus] = useState('awaiting_lister');
  const { data, isLoading, isError, refetch } = useListerOffers({ status });
  const rows = data || [];
  return (
    <>
      <PageHeader title="Offers" description="Offers from buyers, relayed by our agents. Every round is logged. Accepting tells the agent to prepare the booking; the deal is final only after our team verifies it." />
      <Tabs className="mb-4" value={status} onChange={setStatus} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: rows.length } : t))} />
      {isError ? (
        <Alert tone="danger" title="Could not load offers" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />
      ) : isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Handshake} title="No offers yet" description={status === 'awaiting_lister' ? 'Nothing is waiting for your answer.' : 'Nothing in this tab.'} />
      ) : (
        <ul className="space-y-3">{rows.map((o) => <OfferCard key={o.id} o={o} />)}</ul>
      )}
    </>
  );
}
