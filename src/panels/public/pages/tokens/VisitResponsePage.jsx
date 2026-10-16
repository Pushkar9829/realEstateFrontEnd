// Site-visit token link from SMS / email (/visit/:token): confirm, cancel or
// ask for another time without logging in.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, CalendarClock, CheckCircle2, Link2Off, MapPin, UserRound, Info } from 'lucide-react';
import { dateTime } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Skeleton, Textarea } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import env from '@/config/env';
import { useVisitToken, useVisitTokenAction, visitStatus } from '@/modules/leads/publicApi';
import { HotlineButton, NarrowPage, NotAvailable, hotlineHref } from '../../components/States';

const DONE = { confirm: 'account.visit.doneConfirm', cancel: 'account.visit.doneCancel', change: 'account.visit.doneChange' };

// Visit status label in the current language (unknown codes keep the module label).
function statusLabel(t, status) {
  const key = `account.visitStatus.${status}`;
  const v = t(key);
  return v === key ? visitStatus(status).label : v;
}

export default function VisitResponsePage() {
  const { token } = useParams();
  const t = useT();
  const q = useVisitToken(token);
  const act = useVisitTokenAction(token);
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(null);
  useDocumentMeta({ title: t('account.meta.visit'), noindex: true });

  if (q.isLoading) return <NarrowPage><Skeleton className="h-64 w-full" /></NarrowPage>;
  if (q.isError) {
    return <NotAvailable icon={Link2Off} title={t('account.visit.invalidTitle')} description={t('account.visit.invalidText', { hotline: env.hotline })} action={<HotlineButton />} />;
  }
  const v = q.data;
  const s = visitStatus(v.status);
  const open = ['requested', 'scheduled', 'confirmed'].includes(v.status) && !v.passed;
  const run = (action) => act.mutate({ action, ...(action === 'change' && note.trim() ? { note: note.trim().slice(0, 300) } : {}) }, { onSuccess: () => { setDone(action); setMode(null); } });

  return (
    <NarrowPage>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t('account.visit.eyebrow', { no: v.visitNo })}</p>
            {v.property && <h1 className="mt-1 text-lg font-semibold text-ink">{v.property.title}</h1>}
            {v.property && <p className="flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden />{[v.property.locality, v.property.city].filter(Boolean).join(', ')} · {v.property.listingNo}</p>}
          </div>
          <Badge tone={s.tone}>{statusLabel(t, v.status)}</Badge>
        </div>
        <dl className="mt-4 space-y-2 rounded-md bg-surface-muted p-3 text-sm">
          <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">{t('account.visit.when')}</dt><dd className="font-medium text-ink">{dateTime(v.scheduledAt)}</dd></div>
          {v.meetingPoint && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">{t('account.visit.meetingPoint')}</dt><dd>{v.meetingPoint}</dd></div>}
          {v.buyerNote && <div className="flex items-center gap-2"><Info className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">{t('account.visit.agentNote')}</dt><dd>{v.buyerNote}</dd></div>}
          {v.agent && <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">{t('account.visit.agent')}</dt><dd>{t('account.visit.yourAgent', { name: v.agent })}</dd></div>}
        </dl>

        {done && <Alert tone="success" className="mt-4" title={t('account.visit.done')}>{t(DONE[done])}</Alert>}
        {act.error && <Alert tone="danger" className="mt-4">{act.error.code === 'CANCEL_CUTOFF' ? t('account.visit.cutoff', { hotline: env.hotline }) : act.error.message}</Alert>}
        {v.passed && !done && <Alert tone="info" className="mt-4">{t('account.visit.passed')}</Alert>}

        {open && !done && (
          mode === 'change' ? (
            <div className="mt-4 space-y-3">
              <Textarea label={t('account.visit.suits')} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('account.visit.suitsPlaceholder')} />
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode(null)}>{t('common.back')}</Button><Button loading={act.isPending} onClick={() => run('change')}>{t('account.visit.sendRequest')}</Button></div>
            </div>
          ) : mode === 'cancel' ? (
            <div className="mt-4 rounded-md border border-danger-100 bg-danger-50 p-3">
              <p className="text-sm text-danger-700">{t('account.visit.cancelQ')}</p>
              <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode(null)}>{t('account.visit.keepIt')}</Button><Button variant="danger" loading={act.isPending} onClick={() => run('cancel')}>{t('account.visit.cancelVisit')}</Button></div>
            </div>
          ) : (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {v.status === 'scheduled' && <Button icon={CalendarCheck} loading={act.isPending} onClick={() => run('confirm')}>{t('account.visit.confirm')}</Button>}
              {v.status === 'confirmed' && <span className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-success-700"><CheckCircle2 className="h-4 w-4" aria-hidden />{t('account.visit.confirmed')}</span>}
              <Button variant="secondary" onClick={() => setMode('change')}>{t('account.visit.changeTime')}</Button>
              <Button variant="ghost" onClick={() => setMode('cancel')}>{t('common.cancel')}</Button>
            </div>
          )
        )}
        <p className="mt-5 text-center text-sm text-ink-muted">{t('account.visit.questions')} <a className="font-semibold text-brand-700" href={hotlineHref()}>{env.hotline}</a></p>
      </Card>
    </NarrowPage>
  );
}
