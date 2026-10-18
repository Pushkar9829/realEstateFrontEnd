// Connects the module-agnostic PanelLayout to the signed-in user, shows the
// notification bell with the unread count in every panel (RE-S-AGT-15) and
// account banners (lister KYC, suspended account). Loaded lazily with the
// panel, together with its menu (icons) and the panel dictionaries, so none of
// that is in the public site's first download.
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import PanelLayout from '@/shared/layouts/PanelLayout';
import ControlBar, { useControlContext } from '@/shared/components/ControlBar';
import { PageSpinner, useToast } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { useMarkAllRead, useUnreadCount } from '@/modules/notifications/api';
import { useNamespaces, useT } from '@/shared/i18n';
import { PANEL_NAMESPACES } from '@/shared/i18n/locales';
import { ADMIN_NAV, AGENT_NAV, LISTER_NAV, navKey, visibleNav } from './panelNav';

const NAVS = { lister: LISTER_NAV, agent: AGENT_NAV, admin: ADMIN_NAV };

function ListerBanner({ user }) {
  const t = useT();
  const kyc = user.kyc && user.kyc.status;
  if (kyc === 'verified') return null;
  const text = kyc === 'submitted' || kyc === 'under_review' ? t('panel.kycBanner.review')
    : kyc === 'resubmission_required' ? t('panel.kycBanner.changes') : t('panel.kycBanner.start');
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning-100 bg-warning-50 px-4 py-2.5 text-sm text-warning-700 sm:px-6">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{text}</span>
      <Link to="/lister/verification" className="whitespace-nowrap font-semibold underline underline-offset-4">{t('panel.kycBanner.open')}</Link>
    </div>
  );
}

const labelled = (nav, t) => nav.map((s) => ({
  ...s,
  id: s.title || 'main',
  title: s.title ? t(`panel.section.${navKey(s.title)}`) : undefined,
  items: s.items.map((it) => ({ ...it, label: t(`panel.nav.${navKey(it.to)}`) })),
}));

function Shell({ panel, base, controlBar }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT();
  const unread = useUnreadCount({ poll: true });
  const markAll = useMarkAllRead();
  const onMarkAllRead = async () => {
    try { const r = await markAll.mutateAsync(); toast.success(r && r.updated ? t('panel.notifications.marked', { count: r.updated }) : t('panel.notifications.nothingUnread')); } catch (e) { toast.error(e.message); }
  };
  const raw = visibleNav(NAVS[panel], auth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sections = useMemo(() => labelled(raw, t), [JSON.stringify(raw.map((s) => s.items.map((i) => i.to))), t]);
  const allSections = useMemo(() => labelled(NAVS[panel], t), [panel, t]);
  const cc = useControlContext();
  const label = t(`panel.label.${panel}`);
  const onLogout = async () => {
    await auth.logout();
    toast.info(t('panel.layout.loggedOut'));
    navigate('/login', { replace: true });
  };
  return (
    <PanelLayout panel={panel} panelLabel={label} base={base} sections={sections} user={auth.user} onLogout={onLogout}
      accountTo={`${base}/account`} notificationsTo={`${base}/notifications`} notificationsCount={unread.data || 0} onMarkAllRead={onMarkAllRead}
      banner={panel === 'lister' ? <ListerBanner user={auth.user} /> : null} crumbSections={allSections}
      topBar={controlBar && cc ? <ControlBar current={controlBar} ctx={cc} /> : null} />
  );
}

// controlBar: this platform's code; the Control bar shows only for sessions
// handed off by the Control Center.
export default function PanelShell({ panel, base, controlBar }) {
  // All panel dictionaries: label helpers in modules/* are shared between panels
  // (e.g. listing status on the lister and admin screens). One chunk each, per language.
  const ready = useNamespaces(PANEL_NAMESPACES);
  if (!ready) return <PageSpinner />;
  return <Shell panel={panel} base={base} controlBar={controlBar} />;
}
