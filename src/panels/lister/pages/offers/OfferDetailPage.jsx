// RE-S-LIS-18 offer detail: full round history and the lister's answer
// (accept / counter / decline). Buyers are shown only as "Buyer N".
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, CornerUpLeft, Handshake, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, rupees, titleCase } from '@/shared/lib/format';
import { lastRound, offerStatus, timeLeft, useListerOffer, useRespondOffer } from '@/modules/leads/listerApi';
import { useT } from '@/shared/i18n';
import { buyerText } from '@/panels/lister/components/buyerLabel';

// The reason value is sent to the API as typed (English); only the label is translated.
const DECLINE_REASONS = [['Price too low', 'priceLow'], ['Terms not acceptable', 'terms'], ['Property no longer available', 'unavailable'], ['other', 'other']];
const KIND = ['offer', 'counter', 'accept', 'decline', 'withdraw'];

function Rounds({ rounds }) {
  const t = useT();
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {rounds.map((r) => {
        const mine = r.by === 'You';
        return (
          <li key={r.n} className="relative">
            <span className={cn('absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white', mine ? 'bg-brand-600' : 'bg-accent-500')} aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              <span className="font-semibold text-ink">{t('lister.offers.roundN', { n: r.n })}</span><span>·</span><span>{mine ? t('lister.offers.you') : r.by}</span><span>·</span><span>{dateTime(r.at)}</span>
            </div>
            <p className="mt-1 text-sm text-ink"><span className="font-medium">{KIND.includes(r.kind) ? t(`lister.offers.kind.${r.kind}`) : titleCase(r.kind)}</span>{r.amount ? <> · <span className="font-semibold">{rupees(r.amount)}</span></> : null}</p>
            {r.terms && (r.terms.token || r.terms.possessionDate || r.terms.inclusions) && (
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                {r.terms.token ? <div><dt className="inline">{t('lister.offers.tokenLabel')} </dt><dd className="inline">{rupees(r.terms.token)}</dd></div> : null}
                {r.terms.possessionDate ? <div><dt className="inline">{t('lister.offers.possessionLabel')} </dt><dd className="inline">{date(r.terms.possessionDate)}</dd></div> : null}
                {r.terms.inclusions ? <div><dt className="inline">{t('lister.offers.inclusionsLabel')} </dt><dd className="inline">{r.terms.inclusions}</dd></div> : null}
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
  const t = useT();
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
      if (!amount || amount <= 0) { setErrors({ amount: t('lister.offers.errAmount') }); return; }
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
      if (!reason) { setErrors({ reason: t('lister.offers.errReason') }); return; }
      body.reason = reason;
    }
    try {
      await respond.mutateAsync(body);
      setConfirm(false);
      toast.success(t(`lister.offers.done.${action}`));
    } catch (e) {
      setConfirm(false);
      if (e.status === 409) setStale(e.code === 'INVALID_TRANSITION' ? t('lister.offers.stale') : e.message);
      else { setErrors(e.fieldErrors); toast.error(e.message); }
    }
  };

  const choices = [['accept', t('lister.offers.accept'), Check], ['counter', t('lister.offers.counter'), CornerUpLeft], ['decline', t('lister.offers.decline'), X]];
  return (
    <Card>
      <CardHeader title={t('lister.offers.yourAnswer')} description={offer.validUntil ? t('lister.offers.respondBy', { date: dateTime(offer.validUntil) }) : undefined} />
      {stale && <Alert tone="warning" className="mb-4">{stale}</Alert>}
      <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('lister.offers.action')}>
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
            <Input label={t('lister.offers.counterAmount')} required leading="₹" type="number" min={1} value={form.amount} onChange={set('amount')} error={errors.amount} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('lister.offers.tokenOptional')} leading="₹" type="number" min={0} value={form.token} onChange={set('token')} />
              <Input label={t('lister.offers.possessionOptional')} type="date" value={form.possessionDate} onChange={set('possessionDate')} />
            </div>
            <Input label={t('lister.offers.inclusionsOptional')} maxLength={200} placeholder={t('lister.offers.inclusionsPh')} value={form.inclusions} onChange={set('inclusions')} />
          </>
        )}
        {action === 'decline' && (
          <>
            <Select label={t('lister.listings.reason')} required placeholder={t('lister.offers.chooseReason')} options={DECLINE_REASONS.map(([value, key]) => ({ value, label: t(`lister.offers.declineReasons.${key}`) }))} value={form.reason} onChange={set('reason')} error={!form.reason || form.reason !== 'other' ? errors.reason : undefined} />
            {form.reason === 'other' && <Input label={t('lister.listings.reason')} maxLength={300} value={form.reasonText} onChange={set('reasonText')} error={errors.reason} />}
            {form.reason === 'Property no longer available' && (
              <Alert tone="info">{t('lister.offers.alsoTakeOff')} <Link className="font-semibold underline" to="/lister/listings">{t('panel.nav.listerListings')}</Link>.</Alert>
            )}
          </>
        )}
        {action !== 'decline' && <Textarea label={t('lister.offers.noteOptional')} rows={3} maxLength={500} value={form.note} onChange={set('note')} error={errors.note} hint={t('lister.offers.noteHint')} />}
        <Button block variant={action === 'decline' ? 'danger' : 'primary'} loading={respond.isPending && !confirm} onClick={() => (action === 'accept' ? setConfirm(true) : send())}>
          {t(`lister.offers.submit.${action}`)}
        </Button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('lister.offers.confirmTitle')} size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button><Button loading={respond.isPending} onClick={send}>{t('lister.offers.accept')}</Button></>}>
        <p className="text-sm text-ink-muted">{t('lister.offers.confirmText')}</p>
      </Modal>
    </Card>
  );
}

export default function OfferDetailPage() {
  const t = useT();
  const { id } = useParams();
  const { data: o, isLoading, isError, error, refetch } = useListerOffer(id);
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) {
    return error && error.status === 404
      ? <EmptyState icon={Handshake} title={t('lister.offers.notFound')} action={<Button variant="secondary" to="/lister/offers">{t('lister.offers.back')}</Button>} />
      : <Alert tone="danger" title={t('lister.offers.loadOne')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />;
  }
  const s = offerStatus(o.status);
  const r = lastRound(o);
  const left = o.canRespond ? timeLeft(o.validUntil) : null;
  const expired = left === 'expired';
  return (
    <>
      <PageHeader breadcrumb={<Link to="/lister/offers" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />{t('panel.nav.listerOffers')}</Link>}
        title={`${o.offerNo} · ${buyerText(t, o.buyer)}`}
        description={o.property ? `${o.property.listingNo} · ${o.property.title}` : undefined}
        actions={<span className="flex flex-wrap items-center gap-2"><Badge tone={s.tone}>{s.label}</Badge>{left && <Badge tone={expired ? 'danger' : 'warning'} icon={Clock}>{expired ? t('lister.offers.expired') : left}</Badge>}</span>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-subtle">{t('lister.offers.onTable')}</p>
                <p className="text-3xl font-semibold text-ink">{r ? rupees(r.amount) : '-'}</p>
              </div>
              <p className="text-sm text-ink-subtle">{t('lister.offers.roundN', { n: o.rounds.length })} · {t('lister.offers.lastBy', { by: r ? (r.by === 'You' ? t('lister.offers.you') : r.by) : '-' })}</p>
            </div>
            {o.otherOpenOffers > 0 && <Alert tone="info" className="mt-4">{t('lister.offers.otherOpen', { count: o.otherOpenOffers })}</Alert>}
          </Card>
          <Card>
            <CardHeader title={t('lister.offers.rounds')} description={t('lister.offers.roundsDesc')} />
            <Rounds rounds={o.rounds} />
          </Card>
        </div>
        <div>
          {o.canRespond && !expired ? <RespondCard key={o.rounds.length} offer={o} /> : (
            <Card>
              <CardHeader title={t('lister.offers.noAction')} />
              <p className="text-sm text-ink-muted">
                {expired ? t('lister.offers.isExpired') : o.status === 'awaiting_buyer' ? t('lister.offers.waitingBuyer') : o.status === 'accepted' ? t('lister.offers.youAccepted') : t('lister.offers.isStatus', { status: s.label.toLowerCase() })}
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
