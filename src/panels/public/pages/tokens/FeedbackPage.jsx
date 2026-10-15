// RE-S-PUB-22 post-visit feedback (token link, no login): interest stars,
// likes / dislikes chips, comments, second visit and call-back.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Link2Off, MapPin, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, titleCase } from '@/shared/lib/format';
import { Alert, Button, Card, Checkbox, Skeleton, Textarea } from '@/shared/ui';
import env from '@/config/env';
import { FEEDBACK_CHIPS, useFeedbackForm, useSubmitFeedback } from '@/modules/leads/publicApi';
import { HotlineButton, NarrowPage, NotAvailable, hotlineHref } from '../../components/States';

function Chips({ label, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_CHIPS.map((c) => {
          const on = value.includes(c);
          return <button key={c} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-line-strong bg-white text-ink-muted')}>{titleCase(c)}</button>;
        })}
      </div>
    </fieldset>
  );
}

export default function FeedbackPage() {
  const { token } = useParams();
  const q = useFeedbackForm(token);
  const submit = useSubmitFeedback(token);
  const [interest, setInterest] = useState(0);
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [comments, setComments] = useState('');
  const [secondVisit, setSecondVisit] = useState(false);
  const [callBack, setCallBack] = useState(false);
  const [error, setError] = useState(null);

  if (q.isLoading) return <NarrowPage><Skeleton className="h-96 w-full" /></NarrowPage>;
  if (q.isError) {
    return <NotAvailable icon={Link2Off} title="Thanks, this link has expired" description={q.error.code === 'LINK_EXPIRED' ? 'Feedback links are valid for 7 days. Call the hotline for help.' : 'This link is not valid. Call the hotline for help.'} action={<HotlineButton />} />;
  }
  const f = q.data;
  const thanks = submit.isSuccess || f.submitted || (submit.error && submit.error.code === 'ALREADY_SUBMITTED');
  if (thanks) {
    return (
      <NarrowPage>
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-ink">Thank you for your feedback</h1>
          <p className="mt-1 text-sm text-ink-muted">{callBack && submit.isSuccess ? 'Your agent will call you back within 2 working hours.' : 'It helps us find you the right home.'}</p>
          <p className="mt-4 text-sm text-ink-muted">Need help? Call <a className="font-semibold text-brand-700" href={hotlineHref()}>{env.hotline}</a></p>
        </Card>
      </NarrowPage>
    );
  }

  const send = (e) => {
    e.preventDefault();
    if (!interest) { setError('Tap a star to rate your interest'); return; }
    setError(null);
    submit.mutate({ interest, likes, dislikes, ...(comments.trim() ? { comments: comments.trim() } : {}), secondVisit, callBack });
  };

  return (
    <NarrowPage>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">How was your visit?</p>
        {f.property && (
          <div className="mt-3 flex items-center gap-3">
            {f.property.cover ? <img src={f.property.cover} alt="" className="h-16 w-20 shrink-0 rounded object-cover" /> : <span className="h-16 w-20 shrink-0 rounded bg-surface-sunken" />}
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-ink">{f.property.title}</h1>
              <p className="flex items-center gap-1 text-xs text-ink-subtle"><MapPin className="h-3 w-3" aria-hidden />{[f.property.locality, f.property.city].filter(Boolean).join(', ')}</p>
              <p className="text-xs text-ink-subtle">Visited {date(f.visitedAt)} · {f.visitNo}</p>
            </div>
          </div>
        )}
        <form onSubmit={send} className="mt-5 space-y-5">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">How interested are you?<span className="text-danger-600"> *</span></legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Interest from 1 to 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={interest === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setInterest(n)} className="rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
                  <Star className={cn('h-8 w-8', n <= interest ? 'fill-accent-500 text-accent-500' : 'text-line-strong')} />
                </button>
              ))}
            </div>
          </fieldset>
          <Chips label="What did you like?" value={likes} onChange={setLikes} />
          <Chips label="What did not work?" value={dislikes} onChange={setDislikes} />
          <Textarea label="Comments (optional)" rows={3} maxLength={500} value={comments} onChange={(e) => setComments(e.target.value)} hint={`${comments.length}/500`} />
          <div className="space-y-2">
            <Checkbox label="I would like a second visit" checked={secondVisit} onChange={(e) => setSecondVisit(e.target.checked)} />
            <Checkbox label="Please call me back" checked={callBack} onChange={(e) => setCallBack(e.target.checked)} />
          </div>
          {(error || submit.error) && <Alert tone="danger">{error || submit.error.message}</Alert>}
          <Button type="submit" block loading={submit.isPending}>Send feedback</Button>
        </form>
      </Card>
    </NarrowPage>
  );
}
