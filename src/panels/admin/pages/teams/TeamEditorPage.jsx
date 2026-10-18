// RE-S-ADM-15 team editor (/admin/teams/new and /admin/teams/:id): name,
// managers, members with capacity and availability, territories, working
// hours and distribution mode. Delete is refused by the API while the team
// has open leads or active routing rules; the message is shown as is.
import { useEffect, useState } from 'react';
import { useT } from '@/shared/i18n';
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

function fromTeam(team, t) {
  return {
    name: team.name || '',
    managers: (team.managerIds || []).map((m) => ({ id: idOf(m), name: (m && m.name) || t('admin.teams.ed.managerFallback') })),
    members: (team.members || []).map((m) => ({ agentId: idOf(m.agentId), name: (m.agentId && m.agentId.name) || t('admin.leads.agent'), status: m.agentId && m.agentId.status, capacity: m.capacity ?? 50, available: m.available !== false, leaveFrom: m.leaveFrom, leaveTo: m.leaveTo, openLeads: m.openLeads || 0 })),
    cities: (team.territories?.cities || []).join(', '),
    localities: (team.territories?.localities || []).join(', '),
    start: team.workingHours?.start || '09:00',
    end: team.workingHours?.end || '20:00',
    days: team.workingHours?.days || [1, 2, 3, 4, 5, 6],
    mode: team.mode || 'round_robin',
    active: team.active !== false,
  };
}

// Pick a staff member from the staff list (staff.manage) or by user id.
function StaffPicker({ label, staff, exclude, onPick, canList }) {
  const t = useT();
  const [value, setValue] = useState('');
  const opts = staff.filter((s) => !exclude.includes(String(s._id))).map((s) => ({ value: String(s._id), label: `${s.name} · ${s.role}${s.email ? ` · ${s.email}` : ''}` }));
  const pick = () => {
    const s = staff.find((x) => String(x._id) === value);
    if (s) onPick({ id: String(s._id), name: s.name });
    else if (OID.test(value.trim())) onPick({ id: value.trim(), name: t('admin.teams.ed.userFallback', { id: value.trim().slice(-6) }) });
    setValue('');
  };
  return (
    <div className="flex items-end gap-2">
      {canList
        ? <Select className="flex-1" label={label} placeholder={t('admin.teams.ed.choose')} value={value} onChange={(e) => setValue(e.target.value)} options={opts} />
        : <Input className="flex-1" label={label} placeholder={t('admin.teams.ed.userIdPlaceholder')} hint={t('admin.teams.ed.staffLookupHint')} value={value} onChange={(e) => setValue(e.target.value)} />}
      <Button variant="secondary" icon={Plus} disabled={!value} onClick={pick}>{t('admin.teams.ed.add')}</Button>
    </div>
  );
}

function LeaveModal({ teamId, member, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const patch = usePatchMember();
  const [from, setFrom] = useState(member.leaveFrom ? String(member.leaveFrom).slice(0, 10) : '');
  const [to, setTo] = useState(member.leaveTo ? String(member.leaveTo).slice(0, 10) : '');
  const save = async (clear) => {
    try {
      const leave = clear ? { leaveFrom: null, leaveTo: null } : { leaveFrom: `${from}T00:00:00+05:30`, leaveTo: `${to}T23:59:59+05:30` };
      await patch.mutateAsync({ teamId, agentId: member.agentId, body: leave });
      onSaved(leave);
      toast.success(clear ? t('admin.teams.ed.leaveCleared') : t('admin.teams.ed.leaveSaved'));
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={t('admin.teams.ed.leaveFor', { name: member.name })} description={t('admin.teams.ed.leaveDescription')}
      footer={<>{(member.leaveFrom || member.leaveTo) && <Button variant="ghost" onClick={() => save(true)}>{t('admin.teams.ed.clearLeave')}</Button>}<Button disabled={!from || !to || to < from} loading={patch.isPending} onClick={() => save(false)}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('admin.teams.ed.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label={t('admin.teams.ed.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} error={from && to && to < from ? t('admin.teams.ed.afterStart') : undefined} />
      </div>
    </Modal>
  );
}

function TeamEditor({ id }) {
  const t = useT();
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
  const team = isNew ? null : (teams.data || []).find((tm) => String(tm._id) === id);
  const [f, setF] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [leaveFor, setLeaveFor] = useState(null);
  const [showAdmins, setShowAdmins] = useState(false);

  useEffect(() => {
    if (isNew && !f) setF(fromTeam({}, t));
    else if (team && !f) setF(fromTeam(team, t));
  }, [isNew, team, f, t]);

  if (teams.isLoading || (!f && (isNew || team))) return <PageSpinner />;
  if (teams.error) return <Alert tone="danger">{teams.error.message}</Alert>;
  if (!isNew && !team) return teams.isFetching ? <PageSpinner /> : <Alert tone="danger">{t('admin.teams.ed.notFound')}</Alert>;

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
    if (f.name.trim().length < 2) { setErrors({ name: t('admin.teams.ed.errName') }); return; }
    if (!f.days.length) { setErrors({ days: t('admin.teams.ed.errDays') }); return; }
    if (f.end <= f.start) { setErrors({ end: t('admin.teams.ed.errEnd') }); return; }
    try {
      if (isNew) {
        const created = await create.mutateAsync(body());
        toast.success(t('admin.teams.ed.created'));
        navigate(`/admin/teams/${created._id}`, { replace: true });
      } else {
        await edit.mutateAsync({ id, body: body() });
        toast.success(t('admin.teams.ed.saved'));
      }
    } catch (e) { setErrors(e.fieldErrors || {}); setFormError(e.message); }
  };

  const saveMember = async (m) => {
    try { await patchMember.mutateAsync({ teamId: id, agentId: m.agentId, body: { capacity: Number(m.capacity) || 50, available: m.available } }); toast.success(t('admin.teams.ed.memberUpdated', { name: m.name })); } catch (e) { toast.error(e.message); }
  };

  const doDelete = async () => {
    setDeleteError(null);
    try { await remove.mutateAsync(id); toast.success(t('admin.teams.ed.deleted')); navigate('/admin/teams', { replace: true }); } catch (e) { setDeleteError(e.message); }
  };

  const memberIds = f.members.map((m) => m.agentId);
  // Agent picker: agents and managers only. Manager picker: managers only;
  // admins are listed only when "Show admins" is ticked.
  const agentsStaff = staff.filter((s) => ['agent', 'manager'].includes(s.role));
  const managerStaff = staff.filter((s) => s.role === 'manager' || (showAdmins && ['admin', 'superadmin'].includes(s.role)));

  return (
    <>
      <Link to="/admin/teams" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('panel.nav.adminTeams')}</Link>
      <PageHeader title={isNew ? t('admin.teams.newTeam') : f.name || t('admin.teams.team')} description={readOnly ? t('admin.teams.ed.readOnly') : undefined}
        actions={<>
          {!isNew && canManage && <Button variant="secondary" icon={Trash2} onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>{t('admin.teams.ed.delete')}</Button>}
          {canManage && <Button icon={Save} loading={create.isPending || edit.isPending} onClick={save}>{isNew ? t('admin.teams.ed.createTeam') : t('admin.teams.ed.saveTeam')}</Button>}
        </>} />
      {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('admin.teams.ed.membersTitle', { n: f.members.length })} description={t('admin.teams.ed.membersDescription')} />
            <Table rows={f.members} rowKey={(m) => m.agentId} empty={t('admin.teams.ed.noMembers')}
              columns={[
                { key: 'name', header: t('admin.leads.agent'), render: (m) => <span className="text-sm font-medium text-ink">{m.name}{m.status && m.status !== 'active' && <Badge className="ml-2" tone="danger">{m.status}</Badge>}</span> },
                { key: 'open', header: t('admin.teams.ed.colOpen'), render: (m) => m.openLeads },
                { key: 'capacity', header: t('admin.teams.ed.colCapacity'), render: (m) => <input type="number" min={1} max={500} aria-label={t('admin.teams.ed.capacityOf', { name: m.name })} className="h-9 w-20 rounded-md border border-line-strong px-2 text-sm" value={m.capacity} onChange={(e) => setMember(m.agentId, { capacity: e.target.value })} /> },
                { key: 'available', header: t('admin.teams.ed.colAvailable'), render: (m) => <Checkbox label={m.available ? t('common.yes') : t('admin.teams.ed.away')} checked={m.available} onChange={(e) => setMember(m.agentId, { available: e.target.checked })} /> },
                { key: 'leave', header: t('admin.teams.ed.colLeave'), render: (m) => <span className="text-xs text-ink-subtle">{m.leaveFrom && m.leaveTo ? `${date(m.leaveFrom)} - ${date(m.leaveTo)}` : '-'}</span> },
                { key: 'act', header: '', render: (m) => (
                  <span className="flex justify-end gap-1">
                    {!isNew && team.members.some((x) => idOf(x.agentId) === m.agentId) && <>
                      <Button size="sm" variant="ghost" icon={CalendarOff} aria-label={t('admin.teams.ed.leaveFor', { name: m.name })} onClick={() => setLeaveFor(m)} />
                      {readOnly && <Button size="sm" variant="secondary" loading={patchMember.isPending} onClick={() => saveMember(m)}>{t('common.save')}</Button>}
                    </>}
                    {canManage && <Button size="sm" variant="ghost" icon={X} aria-label={t('admin.teams.ed.remove', { name: m.name })} onClick={() => setF((x) => ({ ...x, members: x.members.filter((y) => y.agentId !== m.agentId) }))} />}
                  </span>
                ) },
              ]} />
            {canManage && <div className="mt-4"><StaffPicker label={t('admin.teams.ed.addAgent')} staff={agentsStaff} exclude={memberIds} canList={canListStaff} onPick={(s) => setF((x) => ({ ...x, members: [...x.members, { agentId: s.id, name: s.name, capacity: 50, available: true, openLeads: 0 }] }))} /></div>}
            {errors.members && <p className="mt-2 text-xs text-danger-600">{errors.members}</p>}
          </Card>

          <Card>
            <CardHeader title={t('admin.teams.territory')} description={t('admin.teams.ed.territoryDescription')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('admin.teams.ed.cities')} list="team-cities" disabled={readOnly} hint={t('admin.routing.commaSeparated')} value={f.cities} onChange={set('cities')} />
              <Input label={t('admin.teams.ed.localities')} disabled={readOnly} hint={t('admin.teams.ed.commaOptional')} value={f.localities} onChange={set('localities')} />
            </div>
            <datalist id="team-cities">{(citiesQ.data || []).map((c) => <option key={c._id} value={c.name} />)}</datalist>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('admin.teams.team')} />
            <div className="space-y-4">
              <Input label={t('admin.teams.ed.name')} required maxLength={60} disabled={readOnly} value={f.name} onChange={set('name')} error={errors.name} />
              <Select label={t('admin.teams.ed.distributionMode')} disabled={readOnly} value={f.mode} onChange={set('mode')} options={TEAM_MODES} />
              <Checkbox label={t('admin.teams.ed.active')} description={t('admin.teams.ed.activeDescription')} disabled={readOnly} checked={f.active} onChange={set('active')} />
            </div>
          </Card>

          <Card>
            <CardHeader title={t('admin.teams.managers')} description={t('admin.teams.ed.managersDescription')} />
            <ul className="mb-3 space-y-2">
              {f.managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{m.name}</span>
                  {canManage && <Button size="sm" variant="ghost" icon={X} aria-label={t('admin.teams.ed.remove', { name: m.name })} onClick={() => setF((x) => ({ ...x, managers: x.managers.filter((y) => y.id !== m.id) }))} />}
                </li>
              ))}
              {!f.managers.length && <li className="text-sm text-warning-700">{t('admin.teams.ed.noManager')}</li>}
            </ul>
            {canManage && <Checkbox className="mb-2" label={t('admin.teams.ed.showAdmins')} description={t('admin.teams.ed.showAdminsDescription')} checked={showAdmins} onChange={(e) => setShowAdmins(e.target.checked)} />}
            {canManage && <StaffPicker label={t('admin.teams.ed.addManager')} staff={managerStaff} exclude={f.managers.map((m) => m.id)} canList={canListStaff} onPick={(s) => setF((x) => ({ ...x, managers: [...x.managers, s] }))} />}
            {errors.managerIds && <p className="mt-2 text-xs text-danger-600">{errors.managerIds}</p>}
          </Card>

          <Card>
            <CardHeader title={t('admin.teams.ed.workingHours')} description={t('admin.teams.ed.workingHoursDescription')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('admin.teams.ed.start')} type="time" disabled={readOnly} value={f.start} onChange={set('start')} />
              <Input label={t('admin.teams.ed.end')} type="time" disabled={readOnly} value={f.end} onChange={set('end')} error={errors.end} />
            </div>
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-sm font-medium text-ink">{t('admin.teams.ed.workingDays')}</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                {WEEKDAYS.map((d, i) => <Checkbox key={i} label={d} disabled={readOnly} checked={f.days.includes(i)} onChange={(e) => setF((x) => ({ ...x, days: e.target.checked ? [...x.days, i] : x.days.filter((y) => y !== i) }))} />)}
              </div>
              {errors.days && <p className="mt-1 text-xs text-danger-600">{errors.days}</p>}
            </fieldset>
          </Card>
        </div>
      </div>

      {leaveFor && <LeaveModal teamId={id} member={leaveFor} onClose={() => setLeaveFor(null)} onSaved={(leave) => setMember(leaveFor.agentId, leave)} />}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} size="sm" title={t('admin.teams.ed.deleteTitle', { name: f.name })} description={t('admin.teams.ed.deleteDescription')}
        footer={<><Button variant="ghost" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button><Button variant="danger" loading={remove.isPending} onClick={doDelete}>{t('admin.teams.ed.deleteTeam')}</Button></>}>
        {deleteError ? <Alert tone="danger" title={t('admin.teams.ed.cannotDelete')}>{deleteError}</Alert> : <p className="text-sm text-ink-muted">{t('admin.teams.ed.cannotUndo')}</p>}
      </Modal>
    </>
  );
}

// Keyed by id so moving between teams (or from "new" to the created team) starts a fresh form.
export default function TeamEditorPage() {
  const { id } = useParams();
  return <TeamEditor key={id} id={id} />;
}
