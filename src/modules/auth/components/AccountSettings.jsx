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
import { useT } from '@/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, authKeys, useLoginHistory, useSessions, useUpdateMe } from '../api';
import { useAuth } from '../AuthProvider';
import { changePasswordSchema } from '../schemas';
import { useApiForm } from '../useApiForm';
import NotificationPrefs from './NotificationPrefs';
import PrivacySettings from './PrivacySettings';

function Profile() {
  const t = useT();
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const update = useUpdateMe();
  const form = useForm({ defaultValues: { name: user.name } });
  const [error, setError] = useState(null);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try { await update.mutateAsync({ name: v.name }); await refreshUser(); toast.success(t('account.settings.profile.saved')); } catch (e) { setError(e.message); }
  });
  return (
    <Card>
      <CardHeader title={t('account.settings.profile.title')} description={t('account.settings.profile.description')} />
      <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label={t('account.settings.profile.fullName')} {...form.register('name', { required: true })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('account.settings.profile.email')} value={user.email} disabled hint={user.emailVerified ? t('account.settings.profile.verified') : t('account.settings.profile.notVerified')} readOnly />
          <Input label={t('account.settings.profile.mobile')} value={user.phone} disabled hint={user.phoneVerified ? t('account.settings.profile.verified') : undefined} readOnly />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-ink-muted">
          <Badge tone="brand">{titleCase(user.role)}{user.listerType ? ` · ${titleCase(user.listerType)}` : ''}</Badge>
          {user.referralCode && <Badge tone="accent">{t('account.settings.profile.referralCode', { code: user.referralCode })}</Badge>}
        </div>
        <div><Button type="submit" loading={update.isPending}>{t('common.save')}</Button></div>
      </form>
    </Card>
  );
}

// State names are stored as typed in the billing record (and decide CGST + SGST
// or IGST on the API), so they stay in English.
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry'];

// Listers only: the invoice recipient for commission GST invoices (RE-S-LIS-16).
function Billing() {
  const t = useT();
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
    if (v.name.trim().length < 2) errs.name = t('account.settings.billing.errName');
    if (v.gstin && !/^[0-9A-Z]{15}$/.test(v.gstin)) errs.gstin = t('account.settings.billing.errGstin');
    if (v.address.trim().length < 10) errs.address = t('account.settings.billing.errAddress');
    if (!v.state) errs.state = t('account.settings.billing.errState');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await update.mutateAsync({ billing: { name: v.name.trim(), gstin: v.gstin, address: v.address.trim(), state: v.state } });
      await refreshUser();
      toast.success(t('account.settings.billing.saved'));
    } catch (err) { setErrors(err.fieldErrors || {}); toast.error(err.message); }
  };
  const missing = !b.name;
  return (
    <Card>
      <CardHeader title={t('account.settings.billing.title')} description={t('account.settings.billing.description')} />
      {missing && <Alert tone="warning" className="mb-4">{t('account.settings.billing.missing')}</Alert>}
      <form onSubmit={save} className="grid max-w-xl gap-4" noValidate>
        <Input label={t('account.settings.billing.name')} required value={v.name} onChange={set('name')} error={errors.name} hint={t('account.settings.billing.nameHint')} />
        <Input label={t('account.settings.billing.gstin')} value={v.gstin} onChange={set('gstin')} error={errors.gstin} maxLength={15} placeholder="27ABCDE1234F1Z5" />
        <Textarea label={t('account.settings.billing.address')} required rows={3} value={v.address} onChange={set('address')} error={errors.address} />
        <Select label={t('account.settings.billing.state')} required placeholder={t('account.request.choose')} value={v.state} onChange={set('state')} error={errors.state} options={STATES.map((x) => ({ value: x, label: x }))} />
        <div><Button type="submit" loading={update.isPending}>{t('account.settings.billing.save')}</Button></div>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const t = useT();
  const toast = useToast();
  const f = useApiForm(changePasswordSchema, { defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const onSubmit = f.submit(async (v) => {
    await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
    f.reset();
    toast.success(t('account.settings.password.changed'));
  });
  return (
    <Card>
      <CardHeader title={t('account.settings.password.title')} description={t('account.settings.password.description')} />
      <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
        {f.formError && <Alert tone="danger">{f.formError.message}</Alert>}
        <PasswordInput label={t('account.settings.password.current')} autoComplete="current-password" error={f.errorOf('currentPassword')} {...f.register('currentPassword')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput label={t('account.settings.password.new')} autoComplete="new-password" error={f.errorOf('newPassword')} {...f.register('newPassword')} />
          <PasswordInput label={t('account.settings.password.confirm')} autoComplete="new-password" error={f.errorOf('confirmPassword')} {...f.register('confirmPassword')} />
        </div>
        <div><Button type="submit" loading={f.formState.isSubmitting}>{t('account.settings.password.submit')}</Button></div>
      </form>
    </Card>
  );
}

function TwoStep() {
  const t = useT();
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
    try { await authApi.totpDisable({ code }); setDisabling(false); await refreshUser(); toast.success(t('account.settings.twoStep.removed')); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title={t('account.settings.twoStep.title')} description={t('account.settings.twoStep.description')} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-success-50 p-2.5 text-success-700"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold text-ink">{method === 'totp' ? t('account.settings.twoStep.methodTotp') : method === 'sms' ? t('account.settings.twoStep.methodSms') : t('account.settings.twoStep.methodEmail')}</p>
            <p className="text-xs text-ink-subtle">{t('account.settings.twoStep.current')}</p>
          </div>
        </div>
        {method === 'totp'
          ? <Button variant="secondary" onClick={() => { setDisabling(true); setCode(''); setError(null); }}>{t('account.settings.twoStep.removeApp')}</Button>
          : <Button variant="secondary" icon={Smartphone} onClick={start}>{t('account.settings.twoStep.useApp')}</Button>}
      </div>

      <Modal open={Boolean(setup)} onClose={() => setSetup(null)} title={t('account.settings.twoStep.setupTitle')}
        description={t('account.settings.twoStep.setupText')}
        footer={<><Button variant="ghost" onClick={() => setSetup(null)}>{t('common.cancel')}</Button><Button onClick={enable} loading={busy}>{t('account.settings.twoStep.turnOn')}</Button></>}>
        {setup && (
          <div className="space-y-4">
            <img src={setup.qrDataUrl} alt={t('account.settings.twoStep.qrAlt')} className="mx-auto h-44 w-44 rounded-md border" />
            <p className="text-center text-xs text-ink-subtle">{t('account.settings.twoStep.cannotScan')}{' '}<code className="break-all rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-ink">{setup.secret}</code></p>
            <div className="flex justify-center"><OtpInput value={code} onChange={setCode} error={error} /></div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(codes)} onClose={() => setCodes(null)} title={t('account.settings.twoStep.codesTitle')}
        description={t('account.settings.twoStep.codesText')}
        footer={<Button onClick={() => setCodes(null)} icon={CheckCircle2}>{t('account.settings.twoStep.codesSaved')}</Button>}>
        {codes && <ul className="grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded bg-surface-sunken px-3 py-1.5 text-center">{c}</li>)}</ul>}
      </Modal>

      <Modal open={disabling} onClose={() => setDisabling(false)} title={t('account.settings.twoStep.removeApp')} size="sm"
        description={t('account.settings.twoStep.removeText')}
        footer={<><Button variant="ghost" onClick={() => setDisabling(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={disable} loading={busy}>{t('account.settings.twoStep.remove')}</Button></>}>
        <div className="flex justify-center"><OtpInput value={code} onChange={setCode} error={error} /></div>
      </Modal>
    </Card>
  );
}

function Sessions() {
  const t = useT();
  const sessions = useSessions();
  const history = useLoginHistory();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const logoutAll = async () => {
    try { await authApi.logoutAll(); qc.invalidateQueries({ queryKey: authKeys.sessions }); toast.success(t('account.settings.sessions.signedOutAll')); await logout(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t('account.settings.sessions.title')} description={t('account.settings.sessions.description')}
          action={<Button variant="secondary" size="sm" icon={LogOut} onClick={logoutAll}>{t('account.settings.sessions.logoutAll')}</Button>} />
        <ul className="divide-y">
          {(sessions.data || []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <MonitorSmartphone className="h-5 w-5 text-ink-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{s.device || t('account.settings.sessions.unknownDevice')}</p>
                <p className="text-xs text-ink-subtle">{t('account.settings.sessions.active', { ip: s.ip, ago: timeAgo(s.lastUsedAt) })}</p>
              </div>
              {s.current && <Badge tone="success">{t('account.settings.sessions.thisDevice')}</Badge>}
            </li>
          ))}
          {sessions.isLoading && <li className="py-3 text-sm text-ink-subtle">{t('common.loading')}</li>}
        </ul>
      </Card>
      <div>
        <h3 className="mb-3 text-base font-semibold text-ink">{t('account.settings.sessions.recent')}</h3>
        <Table loading={history.isLoading} rows={history.data || []} empty={t('account.settings.sessions.empty')}
          columns={[
            { key: 'at', header: t('account.settings.sessions.when'), render: (r) => dateTime(r.at) },
            { key: 'success', header: t('account.settings.sessions.result'), render: (r) => <Badge tone={r.success ? 'success' : 'danger'}>{r.success ? t('account.settings.sessions.success') : titleCase(r.reason || 'failed')}</Badge> },
            { key: 'method', header: t('account.settings.sessions.method'), render: (r) => titleCase(r.method || '-') },
            { key: 'ip', header: t('account.settings.sessions.ip') },
          ]} />
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const t = useT();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isLister = user.role === 'lister';
  const tabs = [{ value: 'profile', label: t('account.settings.tabs.profile') }, ...(isLister ? [{ value: 'billing', label: t('account.settings.tabs.billing') }] : []),
    { value: 'security', label: t('account.settings.tabs.security') }, { value: 'sessions', label: t('account.settings.tabs.sessions') },
    { value: 'notifications', label: t('account.settings.tabs.notifications') }, { value: 'privacy', label: t('account.settings.tabs.privacy') }];
  const initial = tabs.some((x) => x.value === params.get('tab')) ? params.get('tab') : 'profile';
  const [tab, setTab] = useState(initial);
  useEffect(() => { if (params.get('tab') && params.get('tab') !== tab && tabs.some((x) => x.value === params.get('tab'))) setTab(params.get('tab')); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (v) => { setTab(v); setParams(v === 'profile' ? {} : { tab: v }, { replace: true }); };
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
