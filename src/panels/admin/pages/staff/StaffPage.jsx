// RE-S-ADM-16 staff users (staff.manage): agents, managers and admin staff.
// Create (a temporary password is emailed; first login forces a password
// change), edit role / team / permissions, disable with open-lead
// reassignment or enable again, reset 2FA and force logout. Every action is
// audited. API: /api/admin/staff (backend teams admin routes).
import { useMemo, useState } from 'react';
import { KeyRound, LogOut, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, ConfirmModal, Input, Modal, PageHeader, Pagination, Select, Table, Textarea, useToast } from '@/shared/ui';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import {
  MANAGER_DEFAULT_PERMISSIONS, STAFF_PERMISSIONS, STAFF_ROLES, useCreateStaff, useDisableStaff, useEditStaff, useEnableStaff, useForceLogoutStaff, useResetStaff2fa, useStaffUsers,
} from '@/modules/auth/adminApi';
import { useTeams } from '@/modules/teams/api';

const ROLE_LABEL = { agent: 'Sales agent', manager: 'Sales manager', admin: 'Admin staff', superadmin: 'Super admin' };
const TWO_FA = { email: 'Email code', sms: 'SMS code', totp: 'Authenticator app' };
const STATUS_TONE = { active: 'success', disabled: 'neutral', locked: 'danger' };

// Which permission boxes a role may tick (backend: auth/services/staff.service.js).
function permissionOptions(role) {
  if (role === 'agent') return STAFF_PERMISSIONS.filter((p) => p.value === 'verification.field');
  return STAFF_PERMISSIONS;
}

function PermissionChecklist({ role, value, onChange, error }) {
  const opts = permissionOptions(role);
  const fixed = role === 'manager' ? MANAGER_DEFAULT_PERMISSIONS : [];
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink">Permissions</legend>
      <p className="mb-2 text-xs text-ink-subtle">
        {role === 'agent' ? 'Agents can only be given field verification visits.' : role === 'manager' ? 'Managers always have the default sales permissions (ticked and locked), scoped to their teams.' : 'Admin staff need at least one permission.'}
      </p>
      <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
        {opts.map((p) => (
          <Checkbox key={p.value} label={p.label} description={p.value} checked={fixed.includes(p.value) || value.includes(p.value)} disabled={fixed.includes(p.value)} onChange={() => toggle(p.value)} />
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </fieldset>
  );
}

function StaffForm({ staff, onClose }) {
  const toast = useToast();
  const { user } = useAuth();
  const isSuper = user.role === 'superadmin';
  const create = useCreateStaff();
  const edit = useEditStaff();
  const teams = useTeams();
  const editing = Boolean(staff);
  const [v, setV] = useState({
    role: staff ? staff.role : 'agent', name: staff ? staff.name : '', email: staff ? staff.email : '', phone: staff ? staff.phone : '',
    teamId: staff && staff.teamId ? String(staff.teamId) : '', permissions: staff ? (staff.extraPermissions || []) : [],
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const roles = STAFF_ROLES.filter((r) => r.value !== 'admin' || isSuper || (staff && staff.role === 'admin'));
  const teamOptions = ((teams.data || [])).map((t) => ({ value: String(t._id), label: t.name }));
  const allowed = new Set(permissionOptions(v.role).map((p) => p.value));
  const permissions = v.permissions.filter((k) => allowed.has(k) && !(v.role === 'manager' && MANAGER_DEFAULT_PERMISSIONS.includes(k)));

  const submit = async () => {
    const errs = {};
    if (v.name.trim().length < 2) errs.name = 'Enter the full name (2-60 characters)';
    if (!editing && !/^\S+@\S+\.\S+$/.test(v.email.trim())) errs.email = 'Enter a valid email';
    if (!editing && !/^(\+91)?[6-9]\d{9}$/.test(v.phone.replace(/\s/g, ''))) errs.phone = 'Enter a 10-digit Indian mobile number';
    if (v.role === 'admin' && !permissions.length) errs.permissions = 'Choose at least one permission';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setFormError(null);
    const team = ['agent', 'manager'].includes(v.role) ? v.teamId || undefined : undefined;
    try {
      if (editing) {
        const before = [...(staff.extraPermissions || [])].sort().join(',');
        const permsChanged = v.role !== staff.role || [...permissions].sort().join(',') !== before;
        const body = { name: v.name.trim(), ...(permsChanged ? { permissions } : {}), ...(v.role !== staff.role ? { role: v.role } : {}), teamId: team || null };
        await edit.mutateAsync({ id: staff._id, body });
        toast.success(v.role !== staff.role ? 'Saved. The new role applies at their next sign-in.' : 'Staff member saved');
      } else {
        await create.mutateAsync({ role: v.role, name: v.name.trim(), email: v.email.trim(), phone: v.phone.replace(/\s/g, ''), permissions, ...(team ? { teamId: team } : {}) });
        toast.success('Staff account created. A temporary password was emailed.');
      }
      onClose();
    } catch (e) {
      setErrors(e.fieldErrors || {});
      if (!Object.keys(e.fieldErrors || {}).length) setFormError(e.message);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? `Edit ${staff.name}` : 'Add staff member'}
      description={editing ? `${staff.email} · ${staff.phone}` : 'A temporary password is emailed. At first sign-in they must change it and confirm two-step verification.'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending || edit.isPending} onClick={submit}>{editing ? 'Save' : 'Create account'}</Button></>}>
      <div className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Role" required value={v.role} onChange={set('role')} options={roles} error={errors.role}
            hint={editing && v.role !== staff.role ? 'Changing the role signs them out of every device.' : undefined} />
          <Input label="Full name" required value={v.name} onChange={set('name')} error={errors.name} maxLength={60} />
          {!editing && <Input label="Email" type="email" required value={v.email} onChange={set('email')} error={errors.email} />}
          {!editing && <Input label="Mobile" required value={v.phone} onChange={set('phone')} error={errors.phone} placeholder="98765 43210" hint="Indian mobile number" />}
          {['agent', 'manager'].includes(v.role) && (
            <Select label="Team" placeholder="No team" value={v.teamId} onChange={set('teamId')} options={teamOptions} error={errors.teamId}
              hint="Routing uses team membership set on the Teams page." />
          )}
        </div>
        <PermissionChecklist role={v.role} value={v.permissions} onChange={(permissions) => setV((x) => ({ ...x, permissions }))} error={errors.permissions} />
      </div>
    </Modal>
  );
}

// Disable with the open-lead reassignment choice (RE-J-04).
function DisableDialog({ staff, onClose }) {
  const toast = useToast();
  const disable = useDisableStaff();
  const targets = useStaffUsers({ status: 'active', limit: 100 });
  const [reason, setReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const options = ((targets.data && targets.data.items) || []).filter((s) => ['agent', 'manager'].includes(s.role) && s._id !== staff._id)
    .map((s) => ({ value: s._id, label: `${s.name} · ${ROLE_LABEL[s.role]}` }));
  const submit = async () => {
    try {
      const r = await disable.mutateAsync({ id: staff._id, body: { reason: reason.trim(), ...(reassignTo ? { reassignTo } : {}) } });
      toast.success(`${staff.name} disabled. ${r.leadsMoved} open lead${r.leadsMoved === 1 ? '' : 's'} ${reassignTo ? 'reassigned' : 'returned to the manager queue'}.`);
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={`Disable ${staff.name}?`} description="They are signed out of every device and cannot sign in until enabled again."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={disable.isPending} onClick={submit}>Disable</Button></>}>
      <div className="space-y-4">
        <Textarea label="Reason" required rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} hint="Recorded in the audit log and emailed to them." />
        {['agent', 'manager'].includes(staff.role) && (
          <Select label="Open leads go to" placeholder="Manager queue (unassigned)" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} options={options}
            hint="Closed leads stay with them for reporting." />
        )}
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); // null | 'new' | staff row
  const [disabling, setDisabling] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'enable' | 'reset' | 'logout', staff }
  const params = useMemo(() => ({ page, limit: 20, sort: 'name', ...(q.trim() ? { q: q.trim() } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) }), [page, q, role, status]);
  const { data, isLoading, error } = useStaffUsers(params);
  const teams = useTeams();
  const teamName = (id) => ((teams.data || []).find((t) => String(t._id) === String(id)) || {}).name;
  const enable = useEnableStaff();
  const reset = useResetStaff2fa();
  const logout = useForceLogoutStaff();

  const CONFIRM = {
    enable: { title: 'Enable this account?', label: 'Enable', tone: 'primary', text: 'They can sign in again with their current password. Leads moved away when they were disabled stay where they are.', run: (s) => enable.mutateAsync(s._id), done: 'Account enabled', busy: enable.isPending },
    reset: { title: 'Reset two-step verification?', label: 'Reset 2FA', tone: 'danger', text: 'Check their identity first (call them on the registered number). Their authenticator app and recovery codes are removed and sign-in codes go to their email.', run: (s) => reset.mutateAsync(s._id), done: '2FA reset. Codes now go by email.', busy: reset.isPending },
    logout: { title: 'Sign out of every device?', label: 'Force logout', tone: 'danger', text: 'All their sessions end now. They can sign in again straight away.', run: (s) => logout.mutateAsync(s._id), done: 'Signed out everywhere', busy: logout.isPending },
  };
  const c = confirm && CONFIRM[confirm.kind];
  const runConfirm = async () => {
    try { await c.run(confirm.staff); toast.success(c.done); setConfirm(null); } catch (e) { toast.error(e.message); }
  };

  const isSelf = (s) => String(s._id) === String(user._id);
  const locked = (s) => s.role === 'superadmin' && user.role !== 'superadmin';

  return (
    <>
      <PageHeader title="Staff users" description="Agents, managers and admin staff. Accounts are created here only; every change is audited."
        actions={<Button icon={Plus} onClick={() => setForm('new')}>Add staff</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,18rem)_12rem_12rem]">
        <Input aria-label="Search staff" placeholder="Name, email or phone" leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select aria-label="Role" placeholder="All roles" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} options={[...STAFF_ROLES, { value: 'superadmin', label: 'Super admin' }]} />
        <Select aria-label="Status" placeholder="Any status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }, { value: 'locked', label: 'Locked' }]} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No staff match these filters."
        columns={[
          { key: 'name', header: 'Name', render: (s) => <span><span className="block font-medium text-ink">{s.name}{isSelf(s) ? ' (you)' : ''}</span><span className="block text-xs text-ink-subtle">{s.email}</span></span> },
          { key: 'role', header: 'Role', render: (s) => <span><span className="block text-sm">{ROLE_LABEL[s.role] || titleCase(s.role)}</span>{s.role === 'admin' && <span className="block text-xs text-ink-subtle">{(s.permissions || []).length} permissions</span>}</span> },
          { key: 'team', header: 'Team', render: (s) => (s.teamId ? teamName(s.teamId) || '-' : '-') },
          { key: 'phone', header: 'Phone', render: (s) => <span className="font-mono text-xs">{s.phone}</span> },
          { key: 'status', header: 'Status', render: (s) => <span className="flex flex-wrap gap-1"><Badge tone={STATUS_TONE[s.status] || 'neutral'}>{titleCase(s.status)}</Badge>{s.mustChangePassword && <Badge tone="warning">Temp password</Badge>}</span> },
          { key: '2fa', header: '2FA', render: (s) => <span className="text-xs">{TWO_FA[s.twoFactor && s.twoFactor.method] || 'Email code'}</span> },
          { key: 'last', header: 'Last login', render: (s) => (s.lastLoginAt ? <span className="whitespace-nowrap text-xs" title={dateTime(s.lastLoginAt)}>{timeAgo(s.lastLoginAt)}</span> : <span className="text-xs text-ink-subtle">Never</span>) },
          { key: 'act', header: '', render: (s) => (isSelf(s) || locked(s) ? null : (
            <span className="flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setForm(s)} aria-label={`Edit ${s.name}`}>Edit</Button>
              {s.status === 'disabled'
                ? <Button size="sm" variant="ghost" icon={UserCheck} onClick={() => setConfirm({ kind: 'enable', staff: s })}>Enable</Button>
                : <Button size="sm" variant="ghost" icon={UserX} onClick={() => setDisabling(s)}>Disable</Button>}
              <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setConfirm({ kind: 'reset', staff: s })}>Reset 2FA</Button>
              <Button size="sm" variant="ghost" icon={LogOut} onClick={() => setConfirm({ kind: 'logout', staff: s })}>Force logout</Button>
            </span>
          )) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {form && <StaffForm staff={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {disabling && <DisableDialog staff={disabling} onClose={() => setDisabling(null)} />}
      <ConfirmModal open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={runConfirm} title={c ? `${c.title}` : ''} confirmLabel={c ? c.label : 'Confirm'} tone={c ? c.tone : 'primary'} loading={c ? c.busy : false}>
        {confirm && <><p className="mb-2 font-medium text-ink">{confirm.staff.name} · {ROLE_LABEL[confirm.staff.role]}</p><p>{c.text}</p></>}
      </ConfirmModal>
    </>
  );
}
