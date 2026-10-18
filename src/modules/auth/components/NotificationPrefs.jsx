// RE-S-PUB-10 / RE-S-LIS-16 notification preferences: one switch per
// category and channel (GET/PATCH /api/me/notification-preferences).
// Security and transactional messages (OTPs, password changes, new-device
// alerts, lead assignments) are always sent.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CardHeader, Skeleton, useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { NOTIFICATION_CHANNELS, useNotificationPrefs, useUpdateNotificationPrefs } from '@/modules/notifications/api';

// Categories with a label and hint under account.prefs.categories.<cat>.
const KNOWN = new Set(['account', 'listings', 'leads', 'visits', 'offers', 'deals', 'invoices', 'alerts', 'marketing']);

const isOn = (prefs, cat, ch) => !(prefs[cat] && prefs[cat][ch] === false);

export default function NotificationPrefs() {
  const t = useT();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useNotificationPrefs();
  const save = useUpdateNotificationPrefs();
  const [prefs, setPrefs] = useState({});
  const [dirty, setDirty] = useState({});
  useEffect(() => { if (data) { setPrefs(data.prefs || {}); setDirty({}); } }, [data]);
  const categories = useMemo(() => (data && data.categories) || [], [data]);

  const toggle = (cat, ch) => {
    setPrefs((p) => ({ ...p, [cat]: { ...(p[cat] || {}), [ch]: !isOn(p, cat, ch) } }));
    setDirty((d) => ({ ...d, [cat]: true }));
  };
  const submit = async () => {
    const body = Object.fromEntries(Object.keys(dirty).map((cat) => [cat, Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c.value, isOn(prefs, cat, c.value)]))]));
    try { await save.mutateAsync(body); toast.success(t('account.prefs.saved')); } catch (e) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader title={t('account.prefs.title')} description={t('account.prefs.description')}
        action={<Button size="sm" onClick={submit} loading={save.isPending} disabled={!Object.keys(dirty).length}>{t('common.save')}</Button>} />
      {isError ? <Alert tone="danger" title={t('account.prefs.loadError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
        : isLoading ? <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-ink-subtle">
                    <th className="py-2 pr-4 font-medium">{t('account.prefs.category')}</th>
                    {NOTIFICATION_CHANNELS.map((c) => <th key={c.value} className="px-2 py-2 text-center font-medium">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categories.map((cat) => {
                    const known = KNOWN.has(cat);
                    const label = known ? t(`account.prefs.categories.${cat}.label`) : cat;
                    const hint = known ? t(`account.prefs.categories.${cat}.hint`) : '';
                    return (
                      <tr key={cat}>
                        <td className="py-2.5 pr-4"><span className="block font-medium text-ink">{label}</span>{hint && <span className="block text-xs text-ink-subtle">{hint}</span>}</td>
                        {NOTIFICATION_CHANNELS.map((c) => (
                          <td key={c.value} className="px-2 py-2.5 text-center">
                            <input type="checkbox" className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                              checked={isOn(prefs, cat, c.value)} onChange={() => toggle(cat, c.value)} aria-label={t('account.prefs.toggleAria', { category: label, channel: c.label })} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-subtle">{t('account.prefs.footnote')}</p>
            </div>
          )}
    </Card>
  );
}
