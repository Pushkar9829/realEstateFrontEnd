// RE-S-LIS-18 offer detail: full round history and the lister's answer
// (accept / counter / decline). Buyers are shown only as "Buyer N".
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, CornerUpLeft, Handshake, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, rupees, titleCase } from '@/shared/lib/format';
import { lastRound, offerStatus, timeLeft, useListerOffer, useRespondOffer } from '@/modules/leads/listerApi';

const DECLINE_REASONS = [
  { value: 'Price too low', label: 'Price too low' },
  { value: 'Terms not acceptable', label: 'Terms not acceptable' },
  { value: 'Property no longer available', label: 'Property no longer available' },
  { value: 'other', label: 'Other' },
];
const KIND = { offer: 'Offer', counter: 'Counter offer', accept: 'Accepted', decline: 'Declined', withdraw: 'Withdrawn' };

function Rounds({ rounds }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {rounds.map((r) => {
        const mine = r.by === 'You';
        return (
          <li key={r.n} className="relative">
            <span className={cn('absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white', mine ? 'bg-brand-600' : 'bg-accent-500')} aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              <span className="font-semibold text-ink">Round {r.n}</span><span>·</span><span>{r.by}</span><span>·</span><span>{dateTime(r.at)}</span>
            </div>
            <p className="mt-1 text-sm text-ink"><span className="font-medium">{KIND[r.kind] || titleCase(r.kind)}</span>{r.amount ? <> · <span className="font-semibold">{rupees(r.amount)}</span></> : null}</p>
            {r.terms && (r.terms.token || r.terms.possessionDate || r.terms.inclusions) && (
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                {r.terms.token ? <div><dt className="inline">Token: </dt><dd className="inline">{rupees(r.terms.token)}</dd></div> : null}
                {r.terms.possessionDate ? <div><dt className="inline">Possession / move-in: </dt><dd className="inline">{date(r.terms.possessionDate)}</dd></div> : null}
                {r.terms.inclusions ? <div><dt className="inline">Inclusions: </dt><dd className="inline">{r.terms.inclusions}</dd></div> : null}
              </dl>
            )}
            {r.note && <p className="mt-1 rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">{r.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function RespondCard({ offer }) {
  const toast = useToast();
  const respond = useRespondOffer(offer.id);
  const [action, setAction] = useState('counter');
  const [form, setForm] = useState({ amount: '', token: '', possessionDate: '', inclusions: '', note: '', reason: '', reasonText: '' });
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [stale, setStale] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const send = async () => {
    setErrors({}); setStale('');
    const body = { action };
    if (action === 'counter') {
      const amount = Number(form.amount);
      if (!amount || amount <= 0) { setErrors({ amount: 'Enter your counter amount' }); return; }
      body.amount = amount;
      if (form.note.trim()) body.note = form.note.trim();
      const terms = {};
      if (Number(form.token) > 0) terms.token = Number(form.token);
      if (form.possessionDate) terms.possessionDate = form.possessionDate;
      if (form.inclusions.trim()) terms.inclusions = form.inclusions.trim();
      if (Object.keys(terms).length) body.terms = terms;
    }
    if (action === 'accept' && form.note.trim()) body.note = form.note.trim();
    if (action === 'decline') {
      const reason = form.reason === 'other' ? form.reasonText.trim() : form.reason;
      if (!reason) { setErrors({ reason: 'Give a short reason' }); return; }
      body.reason = reason;
    }
    try {
      await respond.mutateAsync(body);
      setConfirm(false);
      toast.success({ accept: 'Offer accepted. Our agent will prepare the booking.', counter: 'Counter offer sent', decline: 'Offer declined' }[action]);
    } catch (e) {
      setConfirm(false);
      if (e.status === 409) setStale(e.code === 'INVALID_TRANSITION' ? 'This offer has changed, refresh to see the latest round.' : e.message);
      else { setErrors(e.fieldErrors); toast.error(e.message); }
    }
  };

  const choices = [['accept', 'Accept', Check], ['counter', 'Counter', CornerUpLeft], ['decline', 'Decline', X]];
  return (
    <Card>
      <CardHeader title="Your answer" description={offer.validUntil ? `Respond by ${dateTime(offer.validUntil)}` : undefined} />
      {stale && <Alert tone="warning" className="mb-4">{stale}</Alert>}
      <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Action">
        {choices.map(([v, label, Icon]) => (
          <button key={v} type="button" role="radio" aria-checked={action === v} onClick={() => setAction(v)}
            className={cn('flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium', action === v ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line-strong bg-white text-ink-muted hover:bg-surface-muted')}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {action === 'counter' && (
          <>
            <Input label="Counter amount" required leading="₹" type="number" min={1} value={form.amount} onChange={set('amount')} error={errors.amount} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Token amount (optional)" leading="₹" type="number" min={0} value={form.token} onChange={set('token')} />
              <Input label="Possession / move-in date (optional)" type="date" value={form.possessionDate} onChange={set('possessionDate')} />
            </div>
            <Input label="Inclusions (optional)" maxLength={200} placeholder="e.g. Modular kitchen, 2 ACs" value={form.inclusions} onChange={set('inclusions')} />
          </>
        )}
        {action === 'decline' && (
          <>
            <Select label="Reason" required placeholder="Choose a reason" options={DECLINE_REASONS} value={form.reason} onChange={set('reason')} error={!form.reason || form.reason !== 'other' ? errors.reason : undefined} />
            {form.reason === 'other' && <Input label="Reason" maxLength={300} value={form.reasonText} onChange={set('reasonText')} error={errors.reason} />}
            {form.reason === 'Property no longer available' && (
              <Alert tone="info">If it was sold or rented, also take it off the market from <Link className="font-semibold underline" to="/lister/listings">My listings</Link>.</Alert>
            )}
          </>
        )}
        {action !== 'decline' && <Textarea label="Note to the agent (optional)" rows={3} maxLength={500} value={form.note} onChange={set('note')} error={errors.note} hint="Do not share phone numbers or emails." />}
        <Button block variant={action === 'decline' ? 'danger' : 'primary'} loading={respond.isPending && !confirm} onClick={() => (action === 'accept' ? setConfirm(true) : send())}>
          {{ accept: 'Accept offer', counter: 'Send counter offer', decline: 'Decline offer' }[action]}
        </Button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Accept this offer?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button loading={respond.isPending} onClick={send}>Accept</Button></>}>
        <p className="text-sm text-ink-muted">Accepting tells our agent to prepare the booking. The deal is final only after the token is paid and our team verifies it.</p>
      </Modal>
    </Card>
  );
}

export default function OfferDetailPage() {
  const { id } = useParams();
  const { data: o, isLoading, isError, error, refetch } = useListerOffer(id);
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) {
    return error && error.status === 404
      ? <EmptyState icon={Handshake} title="Offer not found" action={<Button variant="secondary" to="/lister/offers">Back to offers</Button>} />
      : <Alert tone="danger" title="Could not load the offer" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />;
  }
  const s = offerStatus(o.status);
  const r = lastRound(o);
  const left = o.canRespond ? timeLeft(o.validUntil) : null;
  const expired = left === 'expired';
  return (
    <>
      <PageHeader breadcrumb={<Link to="/lister/offers" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />Offers</Link>}
        title={`${o.offerNo} · ${o.buyer}`}
        description={o.property ? `${o.property.listingNo} · ${o.property.title}` : undefined}
        actions={<span className="flex flex-wrap items-center gap-2"><Badge tone={s.tone}>{s.label}</Badge>{left && <Badge tone={expired ? 'danger' : 'warning'} icon={Clock}>{left}</Badge>}</span>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-subtle">Amount on the table</p>
                <p className="text-3xl font-semibold text-ink">{r ? rupees(r.amount) : '-'}</p>
              </div>
              <p className="text-sm text-ink-subtle">Round {o.rounds.length} · last by {r ? r.by : '-'}</p>
            </div>
            {o.otherOpenOffers > 0 && <Alert tone="info" className="mt-4">{o.otherOpenOffers} other open offer{o.otherOpenOffers > 1 ? 's' : ''} on this listing.</Alert>}
          </Card>
          <Card>
            <CardHeader title="Rounds" description="Every offer and counter offer, oldest first." />
            <Rounds rounds={o.rounds} />
          </Card>
        </div>
        <div>
          {o.canRespond && !expired ? <RespondCard key={o.rounds.length} offer={o} /> : (
            <Card>
              <CardHeader title="No action needed" />
              <p className="text-sm text-ink-muted">
                {expired ? 'This offer has expired.' : o.status === 'awaiting_buyer' ? 'Waiting for the buyer to answer your last round.' : o.status === 'accepted' ? 'You accepted this offer. Our agent is preparing the booking; the deal is final after verification.' : `This offer is ${s.label.toLowerCase()}.`}
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
