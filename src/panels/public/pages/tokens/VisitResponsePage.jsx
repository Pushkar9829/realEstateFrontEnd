// Site-visit token link from SMS / email (/visit/:token): confirm, cancel or
// ask for another time without logging in.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck, CalendarClock, CheckCircle2, Link2Off, MapPin, UserRound, Info } from 'lucide-react';
import { dateTime } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Skeleton, Textarea } from '@/shared/ui';
import env from '@/config/env';
import { useVisitToken, useVisitTokenAction, visitStatus } from '@/modules/leads/publicApi';
import { HotlineButton, NarrowPage, NotAvailable, hotlineHref } from '../../components/States';

const DONE = { confirm: 'Visit confirmed. Our agent will meet you there.', cancel: 'Visit cancelled. Call us any time to book again.', change: 'Request sent. Your agent will call you with a new time.' };

export default function VisitResponsePage() {
  const { token } = useParams();
  const q = useVisitToken(token);
  const act = useVisitTokenAction(token);
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(null);

  if (q.isLoading) return <NarrowPage><Skeleton className="h-64 w-full" /></NarrowPage>;
  if (q.isError) {
    return <NotAvailable icon={Link2Off} title="This link is not valid" description={`It may have expired or been replaced by a newer message. Call ${env.hotline} for help.`} action={<HotlineButton />} />;
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
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Site visit {v.visitNo}</p>
            {v.property && <h1 className="mt-1 text-lg font-semibold text-ink">{v.property.title}</h1>}
            {v.property && <p className="flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden />{[v.property.locality, v.property.city].filter(Boolean).join(', ')} · {v.property.listingNo}</p>}
          </div>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <dl className="mt-4 space-y-2 rounded-md bg-surface-muted p-3 text-sm">
          <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">When</dt><dd className="font-medium text-ink">{dateTime(v.scheduledAt)}</dd></div>
          {v.meetingPoint && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">Meeting point</dt><dd>{v.meetingPoint}</dd></div>}
          {v.buyerNote && <div className="flex items-center gap-2"><Info className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">Note from your agent</dt><dd>{v.buyerNote}</dd></div>}
          {v.agent && <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-600" aria-hidden /><dt className="sr-only">Agent</dt><dd>Your agent: {v.agent}</dd></div>}
        </dl>

        {done && <Alert tone="success" className="mt-4" title="Done">{DONE[done]}</Alert>}
        {act.error && <Alert tone="danger" className="mt-4">{act.error.code === 'CANCEL_CUTOFF' ? `Too close to the visit to cancel online. Please call ${env.hotline}.` : act.error.message}</Alert>}
        {v.passed && !done && <Alert tone="info" className="mt-4">This visit time has passed.</Alert>}

        {open && !done && (
          mode === 'change' ? (
            <div className="mt-4 space-y-3">
              <Textarea label="When suits you better? (optional)" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: Saturday after 4 pm" />
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode(null)}>Back</Button><Button loading={act.isPending} onClick={() => run('change')}>Send request</Button></div>
            </div>
          ) : mode === 'cancel' ? (
            <div className="mt-4 rounded-md border border-danger-100 bg-danger-50 p-3">
              <p className="text-sm text-danger-700">Cancel this visit?</p>
              <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode(null)}>Keep it</Button><Button variant="danger" loading={act.isPending} onClick={() => run('cancel')}>Cancel visit</Button></div>
            </div>
          ) : (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {v.status === 'scheduled' && <Button icon={CalendarCheck} loading={act.isPending} onClick={() => run('confirm')}>Confirm</Button>}
              {v.status === 'confirmed' && <span className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-success-700"><CheckCircle2 className="h-4 w-4" aria-hidden />Confirmed</span>}
              <Button variant="secondary" onClick={() => setMode('change')}>Change time</Button>
              <Button variant="ghost" onClick={() => setMode('cancel')}>Cancel</Button>
            </div>
          )
        )}
        <p className="mt-5 text-center text-sm text-ink-muted">Questions? Call <a className="font-semibold text-brand-700" href={hotlineHref()}>{env.hotline}</a></p>
      </Card>
    </NarrowPage>
  );
}
