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
import { useT } from '@/shared/i18n';
import {
  MANAGER_DEFAULT_PERMISSIONS, STAFF_PERMISSIONS, STAFF_ROLES, useCreateStaff, useDisableStaff, useEditStaff, useEnableStaff, useForceLogoutStaff, useResetStaff2fa, useStaffUsers,
} from '@/modules/auth/adminApi';
import { useTeams } from '@/modules/teams/api';

const ROLE_LABEL = (t) => ({ agent: t('admin.staff.roles.agent'), manager: t('admin.staff.roles.manager'), admin: t('admin.staff.roles.admin'), superadmin: t('admin.staff.roles.superadmin') });
const TWO_FA = (t) => ({ email: t('admin.staff.twoFa.email'), sms: t('admin.staff.twoFa.sms'), totp: t('admin.staff.twoFa.totp') });
const STATUS_KEYS = ['active', 'disabled', 'locked'];
const STATUS_TONE = { active: 'success', disabled: 'neutral', locked: 'danger' };

// Which permission boxes a role may tick (backend: auth/services/staff.service.js).
function permissionOptions(role) {
  if (role === 'agent') return STAFF_PERMISSIONS.filter((p) => p.value === 'verification.field');
  return STAFF_PERMISSIONS;
}

function PermissionChecklist({ role, value, onChange, error }) {
  const t = useT();
  const opts = permissionOptions(role);
  const fixed = role === 'manager' ? MANAGER_DEFAULT_PERMISSIONS : [];
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink">{t('admin.staff.permissions')}</legend>
      <p className="mb-2 text-xs text-ink-subtle">
        {role === 'agent' ? t('admin.staff.permHint.agent') : role === 'manager' ? t('admin.staff.permHint.manager') : t('admin.staff.permHint.admin')}
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
  const t = useT();
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
  const teamOptions = ((teams.data || [])).map((tm) => ({ value: String(tm._id), label: tm.name }));
  const allowed = new Set(permissionOptions(v.role).map((p) => p.value));
  const permissions = v.permissions.filter((k) => allowed.has(k) && !(v.role === 'manager' && MANAGER_DEFAULT_PERMISSIONS.includes(k)));

  const submit = async () => {
    const errs = {};
    if (v.name.trim().length < 2) errs.name = t('admin.staff.errors.name');
    if (!editing && !/^\S+@\S+\.\S+$/.test(v.email.trim())) errs.email = t('admin.staff.errors.email');
    if (!editing && !/^(\+91)?[6-9]\d{9}$/.test(v.phone.replace(/\s/g, ''))) errs.phone = t('admin.staff.errors.phone');
    if (v.role === 'admin' && !permissions.length) errs.permissions = t('admin.staff.errors.permissions');
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
        toast.success(v.role !== staff.role ? t('admin.staff.savedRoleChange') : t('admin.staff.saved'));
      } else {
        await create.mutateAsync({ role: v.role, name: v.name.trim(), email: v.email.trim(), phone: v.phone.replace(/\s/g, ''), permissions, ...(team ? { teamId: team } : {}) });
        toast.success(t('admin.staff.created'));
      }
      onClose();
    } catch (e) {
      setErrors(e.fieldErrors || {});
      if (!Object.keys(e.fieldErrors || {}).length) setFormError(e.message);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? t('admin.staff.editTitle', { name: staff.name }) : t('admin.staff.addTitle')}
      description={editing ? `${staff.email} · ${staff.phone}` : t('admin.staff.addDesc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={create.isPending || edit.isPending} onClick={submit}>{editing ? t('common.save') : t('admin.staff.createAccount')}</Button></>}>
      <div className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('admin.staff.role')} required value={v.role} onChange={set('role')} options={roles} error={errors.role}
            hint={editing && v.role !== staff.role ? t('admin.staff.roleChangeHint') : undefined} />
          <Input label={t('admin.staff.fullName')} required value={v.name} onChange={set('name')} error={errors.name} maxLength={60} />
          {!editing && <Input label={t('admin.staff.email')} type="email" required value={v.email} onChange={set('email')} error={errors.email} />}
          {!editing && <Input label={t('admin.staff.mobile')} required value={v.phone} onChange={set('phone')} error={errors.phone} placeholder="98765 43210" hint={t('admin.staff.mobileHint')} />}
          {['agent', 'manager'].includes(v.role) && (
            <Select label={t('admin.staff.team')} placeholder={t('admin.staff.noTeam')} value={v.teamId} onChange={set('teamId')} options={teamOptions} error={errors.teamId}
              hint={t('admin.staff.teamHint')} />
          )}
        </div>
        <PermissionChecklist role={v.role} value={v.permissions} onChange={(permissions) => setV((x) => ({ ...x, permissions }))} error={errors.permissions} />
      </div>
    </Modal>
  );
}

// Disable with the open-lead reassignment choice (RE-J-04).
function DisableDialog({ staff, onClose }) {
  const t = useT();
  const toast = useToast();
  const roleLabel = ROLE_LABEL(t);
  const disable = useDisableStaff();
  const targets = useStaffUsers({ status: 'active', limit: 100 });
  const [reason, setReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const options = ((targets.data && targets.data.items) || []).filter((s) => ['agent', 'manager'].includes(s.role) && s._id !== staff._id)
    .map((s) => ({ value: s._id, label: `${s.name} · ${roleLabel[s.role]}` }));
  const submit = async () => {
    try {
      const r = await disable.mutateAsync({ id: staff._id, body: { reason: reason.trim(), ...(reassignTo ? { reassignTo } : {}) } });
      toast.success(t(reassignTo ? 'admin.staff.disabledReassigned' : 'admin.staff.disabledReturned', { name: staff.name, count: r.leadsMoved }));
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={t('admin.staff.disableTitle', { name: staff.name })} description={t('admin.staff.disableDesc')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={disable.isPending} onClick={submit}>{t('admin.staff.disable')}</Button></>}>
      <div className="space-y-4">
        <Textarea label={t('admin.staff.reason')} required rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} hint={t('admin.staff.reasonHint')} />
        {['agent', 'manager'].includes(staff.role) && (
          <Select label={t('admin.staff.leadsGoTo')} placeholder={t('admin.staff.managerQueue')} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} options={options}
            hint={t('admin.staff.closedLeadsHint')} />
        )}
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const t = useT();
  const toast = useToast();
  const roleLabel = ROLE_LABEL(t);
  const twoFa = TWO_FA(t);
  const statusLabel = (s) => (STATUS_KEYS.includes(s) ? t(`admin.staff.statuses.${s}`) : titleCase(s));
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
  const teamName = (id) => ((teams.data || []).find((tm) => String(tm._id) === String(id)) || {}).name;
  const enable = useEnableStaff();
  const reset = useResetStaff2fa();
  const logout = useForceLogoutStaff();

  const CONFIRM = {
    enable: { title: t('admin.staff.confirm.enable.title'), label: t('admin.staff.enable'), tone: 'primary', text: t('admin.staff.confirm.enable.text'), run: (s) => enable.mutateAsync(s._id), done: t('admin.staff.confirm.enable.done'), busy: enable.isPending },
    reset: { title: t('admin.staff.confirm.reset.title'), label: t('admin.staff.reset2fa'), tone: 'danger', text: t('admin.staff.confirm.reset.text'), run: (s) => reset.mutateAsync(s._id), done: t('admin.staff.confirm.reset.done'), busy: reset.isPending },
    logout: { title: t('admin.staff.confirm.logout.title'), label: t('admin.staff.forceLogout'), tone: 'danger', text: t('admin.staff.confirm.logout.text'), run: (s) => logout.mutateAsync(s._id), done: t('admin.staff.confirm.logout.done'), busy: logout.isPending },
  };
  const c = confirm && CONFIRM[confirm.kind];
  const runConfirm = async () => {
    try { await c.run(confirm.staff); toast.success(c.done); setConfirm(null); } catch (e) { toast.error(e.message); }
  };

  const isSelf = (s) => String(s._id) === String(user._id);
  const locked = (s) => s.role === 'superadmin' && user.role !== 'superadmin';

  return (
    <>
      <PageHeader title={t('admin.staff.title')} description={t('admin.staff.description')}
        actions={<Button icon={Plus} onClick={() => setForm('new')}>{t('admin.staff.addStaff')}</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,18rem)_12rem_12rem]">
        <Input aria-label={t('admin.staff.searchStaff')} placeholder={t('admin.staff.searchPlaceholder')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select aria-label={t('admin.staff.role')} placeholder={t('admin.staff.allRoles')} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} options={[...STAFF_ROLES, { value: 'superadmin', label: roleLabel.superadmin }]} />
        <Select aria-label={t('admin.staff.status')} placeholder={t('admin.staff.anyStatus')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_KEYS.map((value) => ({ value, label: statusLabel(value) }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('admin.staff.empty')}
        columns={[
          { key: 'name', header: t('admin.staff.cols.name'), render: (s) => <span><span className="block font-medium text-ink">{s.name}{isSelf(s) ? t('admin.staff.you') : ''}</span><span className="block text-xs text-ink-subtle">{s.email}</span></span> },
          { key: 'role', header: t('admin.staff.role'), render: (s) => <span><span className="block text-sm">{roleLabel[s.role] || titleCase(s.role)}</span>{s.role === 'admin' && <span className="block text-xs text-ink-subtle">{t('admin.staff.permissionCount', { n: (s.permissions || []).length })}</span>}</span> },
          { key: 'team', header: t('admin.staff.team'), render: (s) => (s.teamId ? teamName(s.teamId) || '-' : '-') },
          { key: 'phone', header: t('admin.staff.cols.phone'), render: (s) => <span className="font-mono text-xs">{s.phone}</span> },
          { key: 'status', header: t('admin.staff.status'), render: (s) => <span className="flex flex-wrap gap-1"><Badge tone={STATUS_TONE[s.status] || 'neutral'}>{statusLabel(s.status)}</Badge>{s.mustChangePassword && <Badge tone="warning">{t('admin.staff.tempPassword')}</Badge>}</span> },
          { key: '2fa', header: '2FA', render: (s) => <span className="text-xs">{twoFa[s.twoFactor && s.twoFactor.method] || twoFa.email}</span> },
          { key: 'last', header: t('admin.staff.cols.lastLogin'), render: (s) => (s.lastLoginAt ? <span className="whitespace-nowrap text-xs" title={dateTime(s.lastLoginAt)}>{timeAgo(s.lastLoginAt)}</span> : <span className="text-xs text-ink-subtle">{t('admin.staff.never')}</span>) },
          { key: 'act', header: '', render: (s) => (isSelf(s) || locked(s) ? null : (
            <span className="flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setForm(s)} aria-label={t('admin.staff.editAria', { name: s.name })}>{t('admin.staff.edit')}</Button>
              {s.status === 'disabled'
                ? <Button size="sm" variant="ghost" icon={UserCheck} onClick={() => setConfirm({ kind: 'enable', staff: s })}>{t('admin.staff.enable')}</Button>
                : <Button size="sm" variant="ghost" icon={UserX} onClick={() => setDisabling(s)}>{t('admin.staff.disable')}</Button>}
              <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setConfirm({ kind: 'reset', staff: s })}>{t('admin.staff.reset2fa')}</Button>
              <Button size="sm" variant="ghost" icon={LogOut} onClick={() => setConfirm({ kind: 'logout', staff: s })}>{t('admin.staff.forceLogout')}</Button>
            </span>
          )) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {form && <StaffForm staff={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {disabling && <DisableDialog staff={disabling} onClose={() => setDisabling(null)} />}
      <ConfirmModal open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={runConfirm} title={c ? `${c.title}` : ''} confirmLabel={c ? c.label : t('common.confirm')} tone={c ? c.tone : 'primary'} loading={c ? c.busy : false}>
        {confirm && <><p className="mb-2 font-medium text-ink">{confirm.staff.name} · {roleLabel[confirm.staff.role]}</p><p>{c.text}</p></>}
      </ConfirmModal>
    </>
  );
}
