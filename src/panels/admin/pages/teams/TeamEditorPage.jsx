// RE-S-ADM-15 team editor (/admin/teams/new and /admin/teams/:id): name,
// managers, members with capacity and availability, territories, working
// hours and distribution mode. Delete is refused by the API while the team
// has open leads or active routing rules; the message is shown as is.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarOff, Plus, Save, Trash2, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, Modal, PageHeader, PageSpinner, Select, Table, useToast } from '@/shared/ui';
import { date } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useCities } from '@/modules/listings/api';
import { TEAM_MODES, WEEKDAYS, useCreateTeam, useDeleteTeam, useEditTeam, usePatchMember, useStaff, useTeams } from '@/modules/teams/api';

const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const idOf = (v) => String((v && v._id) || v || '');
const OID = /^[a-f0-9]{24}$/;

function fromTeam(t) {
  return {
    name: t.name || '',
    managers: (t.managerIds || []).map((m) => ({ id: idOf(m), name: (m && m.name) || 'Manager' })),
    members: (t.members || []).map((m) => ({ agentId: idOf(m.agentId), name: (m.agentId && m.agentId.name) || 'Agent', status: m.agentId && m.agentId.status, capacity: m.capacity ?? 50, available: m.available !== false, leaveFrom: m.leaveFrom, leaveTo: m.leaveTo, openLeads: m.openLeads || 0 })),
    cities: (t.territories?.cities || []).join(', '),
    localities: (t.territories?.localities || []).join(', '),
    start: t.workingHours?.start || '09:00',
    end: t.workingHours?.end || '20:00',
    days: t.workingHours?.days || [1, 2, 3, 4, 5, 6],
    mode: t.mode || 'round_robin',
    active: t.active !== false,
  };
}

// Pick a staff member from the staff list (staff.manage) or by user id.
function StaffPicker({ label, staff, exclude, onPick, canList }) {
  const [value, setValue] = useState('');
  const opts = staff.filter((s) => !exclude.includes(String(s._id))).map((s) => ({ value: String(s._id), label: `${s.name} · ${s.role}${s.email ? ` · ${s.email}` : ''}` }));
  const pick = () => {
    const s = staff.find((x) => String(x._id) === value);
    if (s) onPick({ id: String(s._id), name: s.name });
    else if (OID.test(value.trim())) onPick({ id: value.trim(), name: `User ${value.trim().slice(-6)}` });
    setValue('');
  };
  return (
    <div className="flex items-end gap-2">
      {canList
        ? <Select className="flex-1" label={label} placeholder="Choose" value={value} onChange={(e) => setValue(e.target.value)} options={opts} />
        : <Input className="flex-1" label={label} placeholder="User id (24 characters)" hint="Staff lookup needs the staff.manage permission." value={value} onChange={(e) => setValue(e.target.value)} />}
      <Button variant="secondary" icon={Plus} disabled={!value} onClick={pick}>Add</Button>
    </div>
  );
}

function LeaveModal({ teamId, member, onClose, onSaved }) {
  const toast = useToast();
  const patch = usePatchMember();
  const [from, setFrom] = useState(member.leaveFrom ? String(member.leaveFrom).slice(0, 10) : '');
  const [to, setTo] = useState(member.leaveTo ? String(member.leaveTo).slice(0, 10) : '');
  const save = async (clear) => {
    try {
      const leave = clear ? { leaveFrom: null, leaveTo: null } : { leaveFrom: `${from}T00:00:00+05:30`, leaveTo: `${to}T23:59:59+05:30` };
      await patch.mutateAsync({ teamId, agentId: member.agentId, body: leave });
      onSaved(leave);
      toast.success(clear ? 'Leave cleared' : 'Leave saved');
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={`Leave for ${member.name}`} description="No new leads are routed to the agent during leave."
      footer={<>{(member.leaveFrom || member.leaveTo) && <Button variant="ghost" onClick={() => save(true)}>Clear leave</Button>}<Button disabled={!from || !to || to < from} loading={patch.isPending} onClick={() => save(false)}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={from && to && to < from ? 'Must be after the start' : undefined} />
      </div>
    </Modal>
  );
}

function TeamEditor({ id }) {
  const isNew = id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('teams.manage');
  const canListStaff = hasPermission('staff.manage');
  const teams = useTeams();
  const staffQ = useStaff({ status: 'active' }, { enabled: canListStaff && canManage });
  const citiesQ = useCities();
  const create = useCreateTeam();
  const edit = useEditTeam();
  const remove = useDeleteTeam();
  const patchMember = usePatchMember();
  const team = isNew ? null : (teams.data || []).find((t) => String(t._id) === id);
  const [f, setF] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [leaveFor, setLeaveFor] = useState(null);
  const [showAdmins, setShowAdmins] = useState(false);

  useEffect(() => {
    if (isNew && !f) setF(fromTeam({}));
    else if (team && !f) setF(fromTeam(team));
  }, [isNew, team, f]);

  if (teams.isLoading || (!f && (isNew || team))) return <PageSpinner />;
  if (teams.error) return <Alert tone="danger">{teams.error.message}</Alert>;
  if (!isNew && !team) return teams.isFetching ? <PageSpinner /> : <Alert tone="danger">Team not found, or it is not one of your teams.</Alert>;

  const staff = (staffQ.data && staffQ.data.items) || [];
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setMember = (agentId, patch) => setF((x) => ({ ...x, members: x.members.map((m) => (m.agentId === agentId ? { ...m, ...patch } : m)) }));
  const readOnly = !canManage;

  const body = () => ({
    name: f.name.trim(),
    managerIds: f.managers.map((m) => m.id),
    members: f.members.map((m) => ({ agentId: m.agentId, capacity: Number(m.capacity) || 50, available: m.available })),
    territories: { cities: list(f.cities), localities: list(f.localities) },
    workingHours: { start: f.start, end: f.end, days: [...f.days].sort() },
    mode: f.mode,
    active: f.active,
  });

  const save = async () => {
    setErrors({}); setFormError(null);
    if (f.name.trim().length < 2) { setErrors({ name: 'Team name is required (2-60 characters)' }); return; }
    if (!f.days.length) { setErrors({ days: 'Pick at least one working day' }); return; }
    if (f.end <= f.start) { setErrors({ end: 'End must be after the start' }); return; }
    try {
      if (isNew) {
        const t = await create.mutateAsync(body());
        toast.success('Team created');
        navigate(`/admin/teams/${t._id}`, { replace: true });
      } else {
        await edit.mutateAsync({ id, body: body() });
        toast.success('Team saved');
      }
    } catch (e) { setErrors(e.fieldErrors || {}); setFormError(e.message); }
  };

  const saveMember = async (m) => {
    try { await patchMember.mutateAsync({ teamId: id, agentId: m.agentId, body: { capacity: Number(m.capacity) || 50, available: m.available } }); toast.success(`${m.name} updated`); } catch (e) { toast.error(e.message); }
  };

  const doDelete = async () => {
    setDeleteError(null);
    try { await remove.mutateAsync(id); toast.success('Team deleted'); navigate('/admin/teams', { replace: true }); } catch (e) { setDeleteError(e.message); }
  };

  const memberIds = f.members.map((m) => m.agentId);
  // Agent picker: agents and managers only. Manager picker: managers only;
  // admins are listed only when "Show admins" is ticked.
  const agentsStaff = staff.filter((s) => ['agent', 'manager'].includes(s.role));
  const managerStaff = staff.filter((s) => s.role === 'manager' || (showAdmins && ['admin', 'superadmin'].includes(s.role)));

  return (
    <>
      <Link to="/admin/teams" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Teams</Link>
      <PageHeader title={isNew ? 'New team' : f.name || 'Team'} description={readOnly ? 'Read only. You can change member capacity and availability.' : undefined}
        actions={<>
          {!isNew && canManage && <Button variant="secondary" icon={Trash2} onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>Delete</Button>}
          {canManage && <Button icon={Save} loading={create.isPending || edit.isPending} onClick={save}>{isNew ? 'Create team' : 'Save team'}</Button>}
        </>} />
      {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={`Members (${f.members.length})`} description="Capacity is the most open leads an agent can hold (1-500). Away agents get no new leads." />
            <Table rows={f.members} rowKey={(m) => m.agentId} empty="No members yet."
              columns={[
                { key: 'name', header: 'Agent', render: (m) => <span className="text-sm font-medium text-ink">{m.name}{m.status && m.status !== 'active' && <Badge className="ml-2" tone="danger">{m.status}</Badge>}</span> },
                { key: 'open', header: 'Open', render: (m) => m.openLeads },
                { key: 'capacity', header: 'Capacity', render: (m) => <input type="number" min={1} max={500} aria-label={`Capacity of ${m.name}`} className="h-9 w-20 rounded-md border border-line-strong px-2 text-sm" value={m.capacity} onChange={(e) => setMember(m.agentId, { capacity: e.target.value })} /> },
                { key: 'available', header: 'Available', render: (m) => <Checkbox label={m.available ? 'Yes' : 'Away'} checked={m.available} onChange={(e) => setMember(m.agentId, { available: e.target.checked })} /> },
                { key: 'leave', header: 'Leave', render: (m) => <span className="text-xs text-ink-subtle">{m.leaveFrom && m.leaveTo ? `${date(m.leaveFrom)} - ${date(m.leaveTo)}` : '-'}</span> },
                { key: 'act', header: '', render: (m) => (
                  <span className="flex justify-end gap-1">
                    {!isNew && team.members.some((x) => idOf(x.agentId) === m.agentId) && <>
                      <Button size="sm" variant="ghost" icon={CalendarOff} aria-label={`Leave for ${m.name}`} onClick={() => setLeaveFor(m)} />
                      {readOnly && <Button size="sm" variant="secondary" loading={patchMember.isPending} onClick={() => saveMember(m)}>Save</Button>}
                    </>}
                    {canManage && <Button size="sm" variant="ghost" icon={X} aria-label={`Remove ${m.name}`} onClick={() => setF((x) => ({ ...x, members: x.members.filter((y) => y.agentId !== m.agentId) }))} />}
                  </span>
                ) },
              ]} />
            {canManage && <div className="mt-4"><StaffPicker label="Add an agent" staff={agentsStaff} exclude={memberIds} canList={canListStaff} onPick={(s) => setF((x) => ({ ...x, members: [...x.members, { agentId: s.id, name: s.name, capacity: 50, available: true, openLeads: 0 }] }))} /></div>}
            {errors.members && <p className="mt-2 text-xs text-danger-600">{errors.members}</p>}
          </Card>

          <Card>
            <CardHeader title="Territory" description="Cities and optional localities this team covers. Routing rules decide which leads reach it." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Cities" list="team-cities" disabled={readOnly} hint="Comma separated" value={f.cities} onChange={set('cities')} />
              <Input label="Localities" disabled={readOnly} hint="Comma separated, optional" value={f.localities} onChange={set('localities')} />
            </div>
            <datalist id="team-cities">{(citiesQ.data || []).map((c) => <option key={c._id} value={c.name} />)}</datalist>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Team" />
            <div className="space-y-4">
              <Input label="Name" required maxLength={60} disabled={readOnly} value={f.name} onChange={set('name')} error={errors.name} />
              <Select label="Distribution mode" disabled={readOnly} value={f.mode} onChange={set('mode')} options={TEAM_MODES} />
              <Checkbox label="Active" description="Inactive teams get no routed leads." disabled={readOnly} checked={f.active} onChange={set('active')} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Managers" description="Managers see this team's leads and visits." />
            <ul className="mb-3 space-y-2">
              {f.managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{m.name}</span>
                  {canManage && <Button size="sm" variant="ghost" icon={X} aria-label={`Remove ${m.name}`} onClick={() => setF((x) => ({ ...x, managers: x.managers.filter((y) => y.id !== m.id) }))} />}
                </li>
              ))}
              {!f.managers.length && <li className="text-sm text-warning-700">No manager yet.</li>}
            </ul>
            {canManage && <Checkbox className="mb-2" label="Show admins" description="Admins rarely manage a team; tick to list them too." checked={showAdmins} onChange={(e) => setShowAdmins(e.target.checked)} />}
            {canManage && <StaffPicker label="Add a manager" staff={managerStaff} exclude={f.managers.map((m) => m.id)} canList={canListStaff} onPick={(s) => setF((x) => ({ ...x, managers: [...x.managers, s] }))} />}
            {errors.managerIds && <p className="mt-2 text-xs text-danger-600">{errors.managerIds}</p>}
          </Card>

          <Card>
            <CardHeader title="Working hours" description="IST. First-contact SLA counts only working time." />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start" type="time" disabled={readOnly} value={f.start} onChange={set('start')} />
              <Input label="End" type="time" disabled={readOnly} value={f.end} onChange={set('end')} error={errors.end} />
            </div>
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-sm font-medium text-ink">Working days</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                {WEEKDAYS.map((d, i) => <Checkbox key={d} label={d} disabled={readOnly} checked={f.days.includes(i)} onChange={(e) => setF((x) => ({ ...x, days: e.target.checked ? [...x.days, i] : x.days.filter((y) => y !== i) }))} />)}
              </div>
              {errors.days && <p className="mt-1 text-xs text-danger-600">{errors.days}</p>}
            </fieldset>
          </Card>
        </div>
      </div>

      {leaveFor && <LeaveModal teamId={id} member={leaveFor} onClose={() => setLeaveFor(null)} onSaved={(leave) => setMember(leaveFor.agentId, leave)} />}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} size="sm" title={`Delete ${f.name}?`} description="Allowed only when the team has no open leads and no active routing rules."
        footer={<><Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={remove.isPending} onClick={doDelete}>Delete team</Button></>}>
        {deleteError ? <Alert tone="danger" title="Cannot delete">{deleteError}</Alert> : <p className="text-sm text-ink-muted">This cannot be undone.</p>}
      </Modal>
    </>
  );
}

// Keyed by id so moving between teams (or from "new" to the created team) starts a fresh form.
export default function TeamEditorPage() {
  const { id } = useParams();
  return <TeamEditor key={id} id={id} />;
}
