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
import { errorText, setAvailability, useAgentMutation } from '@/modules/leads/agentApi';

// Calendar days are IST (yyyy-mm-dd).
const istDay = (v) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10);
const toInput = (v) => (v ? istDay(v) : '');
const today = () => istDay(Date.now());

export default function AgentAvailability() {
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
    if (!from || !to) { setError('Choose both the first and the last day of your leave'); return; }
    if (to < from) { setError('The last day must be on or after the first day'); return; }
    // the last day counts in full (IST end of day)
    run({ leaveFrom: `${from}T00:00:00+05:30`, leaveTo: `${to}T23:59:59+05:30` }, 'Leave saved. New leads skip you on those days.');
  };
  const onLeave = a && a.leaveFrom && a.leaveTo && new Date(a.leaveFrom) <= new Date() && new Date(a.leaveTo) >= new Date();
  const away = a && a.available === false;

  return (
    <Card>
      <CardHeader title="Availability and leave" description="New leads are routed only to available agents. Going away does not move your existing leads; your manager reassigns them if needed." />
      {q.isLoading ? <Skeleton className="h-24" />
        : q.isError ? <Alert tone="danger">{q.error.message}</Alert>
          : !a ? <Alert tone="info" title="You are not in a team yet">Your manager adds you to a team before leads are routed to you.</Alert>
            : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={away || onLeave ? 'warning' : 'success'}>{onLeave ? 'On leave' : away ? 'Away' : 'Available'}</Badge>
                  <span className="text-sm text-ink-muted">{a.team} · capacity {a.capacity} open leads</span>
                  {away
                    ? <Button size="sm" icon={UserCheck} loading={save.isPending} onClick={() => run({ available: true }, 'You are available for new leads')}>Set available</Button>
                    : <Button size="sm" variant="secondary" icon={UserMinus} loading={save.isPending} onClick={() => run({ available: false }, 'You are away; new leads skip you')}>Set away</Button>}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Leave</p>
                  {a.leaveFrom && a.leaveTo && <p className="mb-3 text-sm text-ink-muted">Planned leave: {date(a.leaveFrom)} to {date(a.leaveTo)}</p>}
                  <div className="grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Input label="First day" type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} />
                    <Input label="Last day" type="date" min={from || today()} value={to} onChange={(e) => setTo(e.target.value)} />
                    <Button onClick={saveLeave} loading={save.isPending}>Save leave</Button>
                  </div>
                  {a.leaveFrom && <Button className="mt-3" size="sm" variant="ghost" icon={CalendarOff} onClick={() => run({ leaveFrom: null, leaveTo: null }, 'Leave removed')}>Remove leave</Button>}
                  {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
                </div>
              </div>
            )}
    </Card>
  );
}
