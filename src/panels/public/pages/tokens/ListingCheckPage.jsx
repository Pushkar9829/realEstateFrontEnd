// "Is your property still available?" token link for listers (RE-A-17):
// available, sold / rented elsewhere (date and optional price) or pause.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Link2Off, PauseCircle, BadgeIndianRupee, Home } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date } from '@/shared/lib/format';
import { Alert, Button, Input, Skeleton, Textarea } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { useAnswerListingCheck, useListingCheck } from '@/modules/search/api';
import { TokenCard, TokenEyebrow, TokenHotline, TokenNotice, TokenPage } from './TokenFrame';

const CHOICES = [
  { value: 'available', label: 'account.listingCheck.availableLabel', icon: CheckCircle2, text: 'account.listingCheck.availableText' },
  { value: 'sold_elsewhere', label: 'account.listingCheck.soldLabel', icon: BadgeIndianRupee, text: 'account.listingCheck.soldText' },
  { value: 'pause', label: 'account.listingCheck.pauseLabel', icon: PauseCircle, text: 'account.listingCheck.pauseText' },
];
const ANSWER_TEXT = { available: 'account.listingCheck.doneAvailable', sold_elsewhere: 'account.listingCheck.doneSold', pause: 'account.listingCheck.donePause' };

export default function ListingCheckPage() {
  const { token } = useParams();
  const t = useT();
  const q = useListingCheck(token);
  const answer = useAnswerListingCheck(token);
  const [choice, setChoice] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  useDocumentMeta({ title: t('account.meta.listingCheck'), noindex: true });

  if (q.isLoading) return <TokenPage><Skeleton className="h-80 w-full" /></TokenPage>;
  if (q.isError) return <TokenNotice icon={Link2Off} title={t('account.listingCheck.invalidTitle')} description={t('account.listingCheck.invalidText')} action={<TokenHotline />} />;
  const c = q.data;
  const done = answer.data || (c.answered ? { answer: c.answer, listingStatus: c.status } : null);

  const submit = (e) => {
    e.preventDefault();
    if (!choice) { setError(t('account.listingCheck.errChoose')); return; }
    if (choice === 'sold_elsewhere' && !saleDate) { setError(t('account.listingCheck.errDate')); return; }
    setError(null);
    answer.mutate({ answer: choice, ...(choice === 'sold_elsewhere' ? { saleDate, ...(Number(price) > 0 ? { price: Number(price) } : {}) } : {}), ...(choice === 'pause' && reason.trim() ? { reason: reason.trim() } : {}) },
      { onError: (err) => setError(err.message) });
  };

  return (
    <TokenPage>
      <TokenCard>
        <TokenEyebrow>{t('account.listingCheck.eyebrow')}</TokenEyebrow>
        <div className="mt-5 flex items-center gap-4">
          {c.cover ? <img src={c.cover} alt="" className="h-20 w-24 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-20 w-24 shrink-0 items-center justify-center rounded-2xl bg-sand-200 text-navy-500"><Home className="h-5 w-5" aria-hidden /></span>}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-medium text-navy-900">{c.title}</h1>
            <p className="mt-0.5 text-xs text-navy-500">{c.listingNo}{c.locality ? ` · ${c.locality}` : ''}</p>
            {c.dueBy && !done && <p className="mt-1 text-xs font-medium text-warning-700">{t('account.listingCheck.dueBy', { date: date(c.dueBy) })}</p>}
          </div>
        </div>
        {done ? (
          <Alert tone="success" className="mt-6" title={t('account.listingCheck.saved')}>{t(ANSWER_TEXT[done.answer] || 'account.listingCheck.doneDefault')}</Alert>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4 border-t border-navy-900/10 pt-6">
            <p className="font-display text-lg font-medium text-navy-900">{t('account.listingCheck.question')}</p>
            <div className="space-y-2" role="radiogroup">
              {CHOICES.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={choice === o.value} onClick={() => setChoice(o.value)}
                  className={cn('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all', choice === o.value ? 'border-navy-900 bg-navy-900/[0.03] ring-1 ring-navy-900' : 'border-navy-900/10 bg-white hover:border-navy-900/30')}>
                  <o.icon className={cn('mt-0.5 h-5 w-5 shrink-0', choice === o.value ? 'text-gold-700' : 'text-navy-300')} aria-hidden />
                  <span><span className="block text-sm font-semibold text-navy-900">{t(o.label)}</span><span className="mt-0.5 block text-xs leading-relaxed text-navy-500">{t(o.text)}</span></span>
                </button>
              ))}
            </div>
            {choice === 'sold_elsewhere' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t('account.listingCheck.saleDate')} type="date" required max={new Date().toISOString().slice(0, 10)} value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                <Input label={t('account.listingCheck.price')} type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            )}
            {choice === 'pause' && <Textarea label={t('account.listingCheck.reason')} rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" block variant="gold" size="lg" className="!rounded-full font-semibold" loading={answer.isPending}>{t('account.listingCheck.send')}</Button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-navy-500">{t('account.listingCheck.panelNote')}</p>
      </TokenCard>
    </TokenPage>
  );
}
