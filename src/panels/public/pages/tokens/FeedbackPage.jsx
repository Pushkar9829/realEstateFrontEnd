// RE-S-PUB-22 post-visit feedback (token link, no login): interest stars,
// likes / dislikes chips, comments, second visit and call-back.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Link2Off, MapPin, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, titleCase } from '@/shared/lib/format';
import { Alert, Button, Checkbox, Skeleton, Textarea } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import env from '@/config/env';
import { FEEDBACK_CHIPS, useFeedbackForm, useSubmitFeedback } from '@/modules/leads/publicApi';
import { hotlineHref } from '../../components/States';
import { TokenCard, TokenEyebrow, TokenHotline, TokenNotice, TokenPage } from './TokenFrame';

function chipLabel(t, c) {
  const key = `account.feedback.chips.${c}`;
  const v = t(key);
  return v === key ? titleCase(c) : v;
}

function Chips({ label, value, onChange }) {
  const t = useT();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-navy-800">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_CHIPS.map((c) => {
          const on = value.includes(c);
          return <button key={c} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])} className={cn('min-h-[36px] rounded-full border px-3.5 py-1.5 text-sm transition-colors', on ? 'border-navy-900 bg-navy-900 font-medium text-white' : 'border-navy-900/15 bg-white text-navy-600 hover:border-navy-900/40')}>{chipLabel(t, c)}</button>;
        })}
      </div>
    </fieldset>
  );
}

export default function FeedbackPage() {
  const { token } = useParams();
  const t = useT();
  const q = useFeedbackForm(token);
  const submit = useSubmitFeedback(token);
  const [interest, setInterest] = useState(0);
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [comments, setComments] = useState('');
  const [secondVisit, setSecondVisit] = useState(false);
  const [callBack, setCallBack] = useState(false);
  const [error, setError] = useState(null);
  useDocumentMeta({ title: t('account.meta.feedback'), noindex: true });

  if (q.isLoading) return <TokenPage><Skeleton className="h-96 w-full" /></TokenPage>;
  if (q.isError) {
    return <TokenNotice icon={Link2Off} title={t('account.feedback.expiredTitle')} description={q.error.code === 'LINK_EXPIRED' ? t('account.feedback.expiredText') : t('account.feedback.invalidText')} action={<TokenHotline />} />;
  }
  const f = q.data;
  const thanks = submit.isSuccess || f.submitted || (submit.error && submit.error.code === 'ALREADY_SUBMITTED');
  if (thanks) {
    return (
      <TokenPage>
        <TokenCard className="text-center sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-600 ring-1 ring-success-100"><CheckCircle2 className="h-7 w-7" aria-hidden /></span>
          <h1 className="mt-6 font-display text-3xl font-medium text-navy-900">{t('account.feedback.thanksTitle')}</h1>
          <p className="mt-3 leading-relaxed text-navy-500">{callBack && submit.isSuccess ? t('account.feedback.callBackNote') : t('account.feedback.helpsNote')}</p>
          <p className="mt-6 text-sm text-navy-500">{t('account.feedback.needHelp')} <a className="font-semibold text-navy-900 underline decoration-gold-400 underline-offset-4" href={hotlineHref()}>{env.hotline}</a></p>
        </TokenCard>
      </TokenPage>
    );
  }

  const send = (e) => {
    e.preventDefault();
    if (!interest) { setError(t('account.feedback.errStar')); return; }
    setError(null);
    submit.mutate({ interest, likes, dislikes, ...(comments.trim() ? { comments: comments.trim() } : {}), secondVisit, callBack });
  };

  return (
    <TokenPage>
      <TokenCard>
        <TokenEyebrow>{t('account.feedback.eyebrow')}</TokenEyebrow>
        {f.property && (
          <div className="mt-5 flex items-center gap-4">
            {f.property.cover ? <img src={f.property.cover} alt="" className="h-20 w-24 shrink-0 rounded-2xl object-cover" /> : <span className="h-20 w-24 shrink-0 rounded-2xl bg-sand-200" />}
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-medium text-navy-900">{f.property.title}</h1>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-navy-400"><MapPin className="h-3 w-3 text-gold-600" aria-hidden />{[f.property.locality, f.property.city].filter(Boolean).join(', ')}</p>
              <p className="text-xs text-navy-400">{t('account.feedback.visited', { date: date(f.visitedAt), no: f.visitNo })}</p>
            </div>
          </div>
        )}
        <form onSubmit={send} className="mt-7 space-y-6 border-t border-navy-900/10 pt-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-navy-800">{t('account.feedback.interest')}<span className="text-danger-600"> *</span></legend>
            <div className="flex gap-1" role="radiogroup" aria-label={t('account.feedback.interestAria')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={interest === n} aria-label={t('account.feedback.stars', { count: n })} onClick={() => setInterest(n)} className="rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40">
                  <Star className={cn('h-8 w-8', n <= interest ? 'fill-gold-500 text-gold-500' : 'text-navy-200')} />
                </button>
              ))}
            </div>
          </fieldset>
          <Chips label={t('account.feedback.liked')} value={likes} onChange={setLikes} />
          <Chips label={t('account.feedback.disliked')} value={dislikes} onChange={setDislikes} />
          <Textarea label={t('account.feedback.comments')} rows={3} maxLength={500} value={comments} onChange={(e) => setComments(e.target.value)} hint={`${comments.length}/500`} />
          <div className="space-y-3 rounded-2xl bg-sand-100 p-4 ring-1 ring-inset ring-navy-900/5">
            <Checkbox label={t('account.feedback.secondVisit')} checked={secondVisit} onChange={(e) => setSecondVisit(e.target.checked)} />
            <Checkbox label={t('account.feedback.callBack')} checked={callBack} onChange={(e) => setCallBack(e.target.checked)} />
          </div>
          {(error || submit.error) && <Alert tone="danger">{error || submit.error.message}</Alert>}
          <Button type="submit" block variant="gold" size="lg" className="!rounded-full font-semibold" loading={submit.isPending}>{t('account.feedback.send')}</Button>
        </form>
      </TokenCard>
    </TokenPage>
  );
}
