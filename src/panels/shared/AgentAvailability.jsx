// RE-S-AGT-16 availability and leave: the agent sets "available | away" and
// leave dates (excluded from lead routing during leave). Going away does not
// reassign existing leads; SLA breaches meanwhile escalate to the manager.
// API: GET/PATCH /api/agent/availability (backend teams agent routes).
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarOff, UserCheck, UserMinus } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Skeleton, useToast } from '@/shared/ui';
import { api } from '@/shared/lib/api';
import { date } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { errorText, setAvailability, useAgentMutation } from '@/modules/leads/agentApi';

// Calendar days are IST (yyyy-mm-dd).
const istDay = (v) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10);
const toInput = (v) => (v ? istDay(v) : '');
const today = () => istDay(Date.now());

export default function AgentAvailability() {
  const t = useT();
  const toast = useToast();
  const q = useQuery({ queryKey: ['agent', 'availability'], queryFn: () => api.get('/agent/availability') });
  const save = useAgentMutation(setAvailability);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState(null);
  const a = q.data;
  useEffect(() => { if (a) { setFrom(toInput(a.leaveFrom)); setTo(toInput(a.leaveTo)); } }, [a]);

  const run = async (body, msg) => {
    setError(null);
    try { await save.mutateAsync(body); toast.success(msg); } catch (e) { setError(errorText(e)); }
  };
  const saveLeave = () => {
    if (!from || !to) { setError(t('panel.availability.errBoth')); return; }
    if (to < from) { setError(t('panel.availability.errOrder')); return; }
    // the last day counts in full (IST end of day)
    run({ leaveFrom: `${from}T00:00:00+05:30`, leaveTo: `${to}T23:59:59+05:30` }, t('panel.availability.leaveSaved'));
  };
  const onLeave = a && a.leaveFrom && a.leaveTo && new Date(a.leaveFrom) <= new Date() && new Date(a.leaveTo) >= new Date();
  const away = a && a.available === false;

  return (
    <Card>
      <CardHeader title={t('panel.availability.title')} description={t('panel.availability.desc')} />
      {q.isLoading ? <Skeleton className="h-24" />
        : q.isError ? <Alert tone="danger">{q.error.message}</Alert>
          : !a ? <Alert tone="info" title={t('panel.availability.noTeam')}>{t('panel.availability.noTeamText')}</Alert>
            : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={away || onLeave ? 'warning' : 'success'}>{onLeave ? t('panel.availability.onLeave') : away ? t('panel.availability.away') : t('panel.availability.available')}</Badge>
                  <span className="text-sm text-ink-muted">{t('panel.availability.capacity', { team: a.team, n: a.capacity })}</span>
                  {away
                    ? <Button size="sm" icon={UserCheck} loading={save.isPending} onClick={() => run({ available: true }, t('panel.availability.nowAvailable'))}>{t('panel.availability.setAvailable')}</Button>
                    : <Button size="sm" variant="secondary" icon={UserMinus} loading={save.isPending} onClick={() => run({ available: false }, t('panel.availability.nowAway'))}>{t('panel.availability.setAway')}</Button>}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">{t('panel.availability.leave')}</p>
                  {a.leaveFrom && a.leaveTo && <p className="mb-3 text-sm text-ink-muted">{t('panel.availability.planned', { from: date(a.leaveFrom), to: date(a.leaveTo) })}</p>}
                  <div className="grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Input label={t('panel.availability.firstDay')} type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} />
                    <Input label={t('panel.availability.lastDay')} type="date" min={from || today()} value={to} onChange={(e) => setTo(e.target.value)} />
                    <Button onClick={saveLeave} loading={save.isPending}>{t('panel.availability.saveLeave')}</Button>
                  </div>
                  {a.leaveFrom && <Button className="mt-3" size="sm" variant="ghost" icon={CalendarOff} onClick={() => run({ leaveFrom: null, leaveTo: null }, t('panel.availability.leaveRemoved'))}>{t('panel.availability.removeLeave')}</Button>}
                  {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
                </div>
              </div>
            )}
    </Card>
  );
}
