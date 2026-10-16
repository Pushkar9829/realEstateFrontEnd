// RE-M-03/04/06 account and security, reused by every panel: profile,
// password, two-step method (email / SMS / authenticator), sessions and
// login history, notification preferences and RE-M-10 privacy. Tabs deep
// link with ?tab= (billing, security, sessions, notifications, privacy).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCircle2, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, OtpInput, PasswordInput, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, authKeys, useLoginHistory, useSessions, useUpdateMe } from '../api';
import { useAuth } from '../AuthProvider';
import { changePasswordSchema } from '../schemas';
import { useApiForm } from '../useApiForm';
import NotificationPrefs from './NotificationPrefs';
import PrivacySettings from './PrivacySettings';

function Profile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const update = useUpdateMe();
  const form = useForm({ defaultValues: { name: user.name } });
  const [error, setError] = useState(null);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try { await update.mutateAsync({ name: v.name }); await refreshUser(); toast.success('Profile saved'); } catch (e) { setError(e.message); }
  });
  return (
    <Card>
      <CardHeader title="Profile" description="Your name is shown to our team. It is never shown on public pages." />
      <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Full name" {...form.register('name', { required: true })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" value={user.email} disabled hint={user.emailVerified ? 'Verified' : 'Not verified'} readOnly />
          <Input label="Mobile" value={user.phone} disabled hint={user.phoneVerified ? 'Verified' : undefined} readOnly />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-ink-muted">
          <Badge tone="brand">{titleCase(user.role)}{user.listerType ? ` · ${titleCase(user.listerType)}` : ''}</Badge>
          {user.referralCode && <Badge tone="accent">Referral code {user.referralCode}</Badge>}
        </div>
        <div><Button type="submit" loading={update.isPending}>Save</Button></div>
      </form>
    </Card>
  );
}

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry'];

// Listers only: the invoice recipient for commission GST invoices (RE-S-LIS-16).
function Billing() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const update = useUpdateMe();
  const b = user.billing || {};
  const [v, setV] = useState({ name: b.name || '', gstin: b.gstin || '', address: b.address || '', state: b.state || '' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: k === 'gstin' ? e.target.value.toUpperCase().trim() : e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (v.name.trim().length < 2) errs.name = 'Enter the name to print on invoices';
    if (v.gstin && !/^[0-9A-Z]{15}$/.test(v.gstin)) errs.gstin = 'A GSTIN has 15 letters and digits';
    if (v.address.trim().length < 10) errs.address = 'Enter the full billing address';
    if (!v.state) errs.state = 'Choose the state (it decides CGST + SGST or IGST)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await update.mutateAsync({ billing: { name: v.name.trim(), gstin: v.gstin, address: v.address.trim(), state: v.state } });
      await refreshUser();
      toast.success('Billing details saved');
    } catch (err) { setErrors(err.fieldErrors || {}); toast.error(err.message); }
  };
  const missing = !b.name;
  return (
    <Card>
      <CardHeader title="Billing details" description="Printed on the commission invoices we raise after a verified deal. The state decides CGST + SGST or IGST." />
      {missing && <Alert tone="warning" className="mb-4">Add your billing details so we can issue your commission invoice.</Alert>}
      <form onSubmit={save} className="grid max-w-xl gap-4" noValidate>
        <Input label="Billing name" required value={v.name} onChange={set('name')} error={errors.name} hint="Your legal name or company name" />
        <Input label="GSTIN (optional)" value={v.gstin} onChange={set('gstin')} error={errors.gstin} maxLength={15} placeholder="27ABCDE1234F1Z5" />
        <Textarea label="Billing address" required rows={3} value={v.address} onChange={set('address')} error={errors.address} />
        <Select label="State" required placeholder="Choose" value={v.state} onChange={set('state')} error={errors.state} options={STATES.map((x) => ({ value: x, label: x }))} />
        <div><Button type="submit" loading={update.isPending}>Save billing details</Button></div>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const toast = useToast();
  const f = useApiForm(changePasswordSchema, { defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const onSubmit = f.submit(async (v) => {
    await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
    f.reset();
    toast.success('Password changed. Other devices were signed out.');
  });
  return (
    <Card>
      <CardHeader title="Password" description="Changing it signs out every other device." />
      <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
        {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
        <PasswordInput label="Current password" autoComplete="current-password" error={f.errorOf('currentPassword')} {...f.register('currentPassword')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput label="New password" autoComplete="new-password" error={f.errorOf('newPassword')} {...f.register('newPassword')} />
          <PasswordInput label="Confirm new password" autoComplete="new-password" error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
        </div>
        <div><Button type="submit" loading={f.formState.isSubmitting}>Change password</Button></div>
      </form>
    </Card>
  );
}

function TwoStep() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const method = (user.twoFactor && user.twoFactor.method) || 'email';

  const start = async () => {
    setError(null);
    try { setSetup(await authApi.totpSetup()); setCode(''); } catch (e) { toast.error(e.message); }
  };
  const enable = async () => {
    setBusy(true); setError(null);
    try { const r = await authApi.totpEnable({ code }); setSetup(null); setCodes(r.recoveryCodes); await refreshUser(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setError(null);
    try { await authApi.totpDisable({ code }); setDisabling(false); await refreshUser(); toast.success('Authenticator app removed. Codes now come by email.'); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Two-step verification" description="Required on every account. Choose how you receive your sign-in code." />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-success-50 p-2.5 text-success-700"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold text-ink">{method === 'totp' ? 'Authenticator app' : method === 'sms' ? 'SMS code' : 'Email code'}</p>
            <p className="text-xs text-ink-subtle">Current method</p>
          </div>
        </div>
        {method === 'totp'
          ? <Button variant="secondary" onClick={() => { setDisabling(true); setCode(''); setError(null); }}>Remove authenticator app</Button>
          : <Button variant="secondary" icon={Smartphone} onClick={start}>Use an authenticator app</Button>}
      </div>

      <Modal open={Boolean(setup)} onClose={() => setSetup(null)} title="Set up authenticator app"
        description="Scan the QR code with Google Authenticator, Microsoft Authenticator or similar, then enter the 6-digit code."
        footer={<><Button variant="ghost" onClick={() => setSetup(null)}>Cancel</Button><Button onClick={enable} loading={busy}>Turn on</Button></>}>
        {setup && (
          <div className="space-y-4">
            <img src={setup.qrDataUrl} alt="Authenticator QR code" className="mx-auto h-44 w-44 rounded-md border" />
            <p className="text-center text-xs text-ink-subtle">Cannot scan? Enter this key: <code className="break-all rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-ink">{setup.secret}</code></p>
            <div className="flex justify-center"><OtpInput value={code} onChange={setCode} error={error} /></div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(codes)} onClose={() => setCodes(null)} title="Save your recovery codes"
        description="Each code works once if you lose your phone. They will not be shown again."
        footer={<Button onClick={() => setCodes(null)} icon={CheckCircle2}>I have saved them</Button>}>
        {codes && <ul className="grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded bg-surface-sunken px-3 py-1.5 text-center">{c}</li>)}</ul>}
      </Modal>

      <Modal open={disabling} onClose={() => setDisabling(false)} title="Remove authenticator app" size="sm"
        description="Enter a current code from the app. Sign-in codes will then come by email."
        footer={<><Button variant="ghost" onClick={() => setDisabling(false)}>Cancel</Button><Button variant="danger" onClick={disable} loading={busy}>Remove</Button></>}>
        <div className="flex justify-center"><OtpInput value={code} onChange={setCode} error={error} /></div>
      </Modal>
    </Card>
  );
}

function Sessions() {
  const sessions = useSessions();
  const history = useLoginHistory();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const logoutAll = async () => {
    try { await authApi.logoutAll(); qc.invalidateQueries({ queryKey: authKeys.sessions }); toast.success('Signed out of all devices'); await logout(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Active sessions" description="Devices currently signed in to your account."
          action={<Button variant="secondary" size="sm" icon={LogOut} onClick={logoutAll}>Log out everywhere</Button>} />
        <ul className="divide-y">
          {(sessions.data || []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <MonitorSmartphone className="h-5 w-5 text-ink-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{s.device || 'Unknown device'}</p>
                <p className="text-xs text-ink-subtle">{s.ip} · active {timeAgo(s.lastUsedAt)}</p>
              </div>
              {s.current && <Badge tone="success">This device</Badge>}
            </li>
          ))}
          {sessions.isLoading && <li className="py-3 text-sm text-ink-subtle">Loading…</li>}
        </ul>
      </Card>
      <div>
        <h3 className="mb-3 text-base font-semibold text-ink">Recent sign-ins</h3>
        <Table loading={history.isLoading} rows={history.data || []} empty="No sign-ins yet"
          columns={[
            { key: 'at', header: 'When', render: (r) => dateTime(r.at) },
            { key: 'success', header: 'Result', render: (r) => <Badge tone={r.success ? 'success' : 'danger'}>{r.success ? 'Success' : titleCase(r.reason || 'failed')}</Badge> },
            { key: 'method', header: 'Method', render: (r) => titleCase(r.method || '-') },
            { key: 'ip', header: 'IP address' },
          ]} />
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isLister = user.role === 'lister';
  const tabs = [{ value: 'profile', label: 'Profile' }, ...(isLister ? [{ value: 'billing', label: 'Billing' }] : []), { value: 'security', label: 'Security' }, { value: 'sessions', label: 'Sessions and history' },
    { value: 'notifications', label: 'Notifications' }, { value: 'privacy', label: 'Privacy' }];
  const initial = tabs.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'profile';
  const [tab, setTab] = useState(initial);
  useEffect(() => { if (params.get('tab') && params.get('tab') !== tab && tabs.some((t) => t.value === params.get('tab'))) setTab(params.get('tab')); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (t) => { setTab(t); setParams(t === 'profile' ? {} : { tab: t }, { replace: true }); };
  return (
    <div className="space-y-6">
      <Tabs value={tab} onChange={choose} tabs={tabs} />
      {tab === 'profile' && <Profile />}
      {tab === 'billing' && isLister && <Billing />}
      {tab === 'security' && <div className="space-y-6"><TwoStep /><ChangePassword /></div>}
      {tab === 'sessions' && <Sessions />}
      {tab === 'notifications' && <NotificationPrefs />}
      {tab === 'privacy' && <PrivacySettings />}
    </div>
  );
}
