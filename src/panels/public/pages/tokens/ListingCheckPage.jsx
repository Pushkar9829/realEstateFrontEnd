// "Is your property still available?" token link for listers (RE-A-17):
// available, sold / rented elsewhere (date and optional price) or pause.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Link2Off, PauseCircle, BadgeIndianRupee, Home } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date } from '@/shared/lib/format';
import { Alert, Button, Card, Input, Skeleton, Textarea } from '@/shared/ui';
import { useAnswerListingCheck, useListingCheck } from '@/modules/search/api';
import { HotlineButton, NarrowPage, NotAvailable } from '../../components/States';

const CHOICES = [
  { value: 'available', label: 'Yes, still available', icon: CheckCircle2, text: 'Keeps the listing live and marks it as confirmed today.' },
  { value: 'sold_elsewhere', label: 'Sold or rented elsewhere', icon: BadgeIndianRupee, text: 'Takes the listing off the market. Our team may check the deal against the agreement.' },
  { value: 'pause', label: 'Pause for now', icon: PauseCircle, text: 'Hides the listing until you resume it from your panel.' },
];
const ANSWER_TEXT = { available: 'Thanks. Your listing stays live and is marked as confirmed.', sold_elsewhere: 'Thanks. The listing is now off the market.', pause: 'Thanks. The listing is paused; resume it any time from your panel.' };

export default function ListingCheckPage() {
  const { token } = useParams();
  const q = useListingCheck(token);
  const answer = useAnswerListingCheck(token);
  const [choice, setChoice] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  if (q.isLoading) return <NarrowPage><Skeleton className="h-80 w-full" /></NarrowPage>;
  if (q.isError) return <NotAvailable icon={Link2Off} title="This link is not valid" description="Open the latest message from us, or update the listing from your panel." action={<HotlineButton />} />;
  const c = q.data;
  const done = answer.data || (c.answered ? { answer: c.answer, listingStatus: c.status } : null);

  const submit = (e) => {
    e.preventDefault();
    if (!choice) { setError('Choose an answer'); return; }
    if (choice === 'sold_elsewhere' && !saleDate) { setError('Give the sale or move-in date'); return; }
    setError(null);
    answer.mutate({ answer: choice, ...(choice === 'sold_elsewhere' ? { saleDate, ...(Number(price) > 0 ? { price: Number(price) } : {}) } : {}), ...(choice === 'pause' && reason.trim() ? { reason: reason.trim() } : {}) },
      { onError: (err) => setError(err.message) });
  };

  return (
    <NarrowPage>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Availability check</p>
        <div className="mt-3 flex items-center gap-3">
          {c.cover ? <img src={c.cover} alt="" className="h-16 w-20 shrink-0 rounded object-cover" /> : <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded bg-surface-sunken text-ink-subtle"><Home className="h-5 w-5" aria-hidden /></span>}
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-ink">{c.title}</h1>
            <p className="text-xs text-ink-subtle">{c.listingNo}{c.locality ? ` · ${c.locality}` : ''}</p>
            {c.dueBy && !done && <p className="text-xs text-warning-700">Please answer by {date(c.dueBy)}, or the listing is paused automatically.</p>}
          </div>
        </div>
        {done ? (
          <Alert tone="success" className="mt-5" title="Answer saved">{ANSWER_TEXT[done.answer] || 'Thanks, we have your answer.'}</Alert>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm font-medium text-ink">Is this property still available?</p>
            <div className="space-y-2" role="radiogroup">
              {CHOICES.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={choice === o.value} onClick={() => setChoice(o.value)}
                  className={cn('flex w-full items-start gap-3 rounded-lg border p-3 text-left', choice === o.value ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-white hover:border-brand-300')}>
                  <o.icon className={cn('mt-0.5 h-5 w-5 shrink-0', choice === o.value ? 'text-brand-600' : 'text-ink-subtle')} aria-hidden />
                  <span><span className="block text-sm font-medium text-ink">{o.label}</span><span className="block text-xs text-ink-subtle">{o.text}</span></span>
                </button>
              ))}
            </div>
            {choice === 'sold_elsewhere' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Sale or move-in date" type="date" required max={new Date().toISOString().slice(0, 10)} value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                <Input label="Price (₹, optional)" type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            )}
            {choice === 'pause' && <Textarea label="Reason (optional)" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" block loading={answer.isPending}>Send answer</Button>
          </form>
        )}
        <p className="mt-4 text-center text-xs text-ink-subtle">You can also manage the listing from your lister panel.</p>
      </Card>
    </NarrowPage>
  );
}
