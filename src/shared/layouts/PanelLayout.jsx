// Shell for the lister, agent and admin panels: sidebar (drawer on mobile)
// with a user card, top bar with breadcrumb, help and account menu, and the
// page outlet. Panel data (nav, user, logout) is passed in so this stays
// module-agnostic.
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, ChevronRight, ExternalLink, LifeBuoy, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Avatar, Drawer } from '@/shared/ui';
import Logo from '@/shared/components/Logo';
import SkipLink from '@/shared/components/SkipLink';
import { useT } from '@/shared/i18n';
import LanguageSwitcher from '@/shared/i18n/LanguageSwitcher';
import env from '@/config/env';

const ACCENT = { lister: 'bg-accent-500', agent: 'bg-success-600', admin: 'bg-brand-600' };

const readCollapsed = (panel) => { try { return JSON.parse(localStorage.getItem(`pd.nav.collapsed.${panel}`) || '[]'); } catch { return []; } };
const saveCollapsed = (panel, v) => { try { localStorage.setItem(`pd.nav.collapsed.${panel}`, JSON.stringify(v)); } catch { /* storage blocked */ } };

function NavItem({ it, onNavigate }) {
  return (
    <li>
      <NavLink to={it.to} end={it.end} onClick={onNavigate}
        className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink')}>
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brand-600" aria-hidden />}
            {it.icon && <it.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-600' : 'text-ink-subtle group-hover:text-ink-muted')} aria-hidden />}
            <span className="flex-1 truncate">{it.label}</span>
            {it.soon && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-ink-subtle ring-1 ring-line-strong">{it.soon}</span>}
          </>
        )}
      </NavLink>
    </li>
  );
}

// Long menus (the super admin sees 31 items) get collapsible groups, remembered
// per panel, and a "Jump to" filter. The group holding the current page stays open.
function NavList({ sections, onNavigate, panel }) {
  const t = useT();
  const { pathname } = useLocation();
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const long = total > 12;
  const [collapsed, setCollapsed] = useState(() => (long ? readCollapsed(panel) : []));
  const [q, setQ] = useState('');
  const toggle = (id) => setCollapsed((c) => { const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id]; saveCollapsed(panel, next); return next; });
  const query = q.trim().toLowerCase();
  const matches = (s, it) => it.label.toLowerCase().includes(query) || (s.title || '').toLowerCase().includes(query);
  const holds = (s) => s.items.some((it) => pathname === it.to || (!it.end && pathname.startsWith(`${it.to}/`)));
  const anyMatch = !query || sections.some((s) => s.items.some((it) => matches(s, it)));
  return (
    <nav className="space-y-4 px-3 py-4" aria-label={t('panel.layout.navLabel')}>
      {long && (
        <div className="relative px-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('panel.layout.jumpTo')} aria-label={t('panel.layout.jumpTo')}
            className="h-9 w-full rounded-md border border-line bg-surface-muted pl-8 pr-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
        </div>
      )}
      {sections.map((s) => {
        const id = s.id || s.title || 'main';
        const items = query ? s.items.filter((it) => matches(s, it)) : s.items;
        if (!items.length) return null;
        const canCollapse = long && s.title && !query;
        const isOpen = !canCollapse || !collapsed.includes(id) || holds(s);
        const listId = `nav-${panel}-${id}`.replace(/\W+/g, '-');
        return (
          <div key={id}>
            {s.title && (canCollapse ? (
              <button type="button" onClick={() => toggle(id)} aria-expanded={isOpen} aria-controls={listId}
                className="mb-1 flex w-full items-center justify-between rounded px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle hover:bg-surface-sunken hover:text-ink">
                <span>{s.title}</span>
                <span className="flex items-center gap-1 normal-case tracking-normal">
                  {!isOpen && <span className="text-[11px] font-medium">{items.length}</span>}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                </span>
              </button>
            ) : <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{s.title}</p>)}
            {isOpen && <ul id={listId} className="space-y-0.5">{items.map((it) => <NavItem key={it.to} it={it} onNavigate={onNavigate} />)}</ul>}
          </div>
        );
      })}
      {!anyMatch && <p className="px-3 text-sm text-ink-subtle">{t('panel.layout.noMatch')}</p>}
    </nav>
  );
}

function useOutsideClose(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);
  return ref;
}

function UserMenu({ user, panelLabel, accountTo, onLogout }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const ref = useOutsideClose(open, setOpen);
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-sunken" aria-expanded={open} aria-haspopup="menu" aria-label={t('panel.layout.userMenu', { name: user.name })}>
        <Avatar name={user.name} src={user.avatar} size="sm" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:block">{user.name}</span>
        <ChevronDown className="h-4 w-4 text-ink-subtle" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="flex items-center gap-3 border-b bg-surface-muted px-4 py-3">
            <Avatar name={user.name} src={user.avatar} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-subtle">{user.email}</p>
            </div>
          </div>
          <div className="py-1">
            <Link role="menuitem" to={accountTo} className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-surface-muted"><UserRound className="h-4 w-4 text-ink-subtle" aria-hidden /> {t('panel.layout.account')}</Link>
            <Link role="menuitem" to="/" className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-surface-muted"><ExternalLink className="h-4 w-4 text-ink-subtle" aria-hidden /> {t('panel.layout.publicSite')}</Link>
          </div>
          <div className="border-t py-1">
            <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-700 hover:bg-danger-50"><LogOut className="h-4 w-4" aria-hidden /> {t('panel.layout.logout')}</button>
          </div>
          <p className="border-t px-4 py-2 text-[11px] text-ink-subtle">{panelLabel}</p>
        </div>
      )}
    </div>
  );
}

// Breadcrumb from the nav item that matches the current path.
function useCrumb(sections, base) {
  const { pathname } = useLocation();
  return useMemo(() => {
    const items = sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })));
    const match = items.filter((it) => pathname === it.to || (!it.end && pathname.startsWith(`${it.to}/`)))
      .sort((a, b) => b.to.length - a.to.length)[0];
    return match || items.find((it) => it.to === base);
  }, [sections, pathname, base]);
}

export default function PanelLayout({ panel = 'admin', panelLabel, base, sections, user, onLogout, accountTo, notificationsTo, notificationsCount, banner }) {
  const t = useT();
  const [drawer, setDrawer] = useState(false);
  const crumb = useCrumb(sections, base);
  return (
    <div className="flex min-h-screen bg-surface-muted">
      <SkipLink />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Logo />
        </div>
        <div className="px-5 pt-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
            <span className={cn('h-2 w-2 rounded-full', ACCENT[panel])} aria-hidden /> {panelLabel}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto"><NavList sections={sections} panel={panel} /></div>
        <Link to={accountTo} className="flex items-center gap-3 border-t px-5 py-3 hover:bg-surface-muted">
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
            <span className="block truncate text-xs text-ink-subtle">{user.email}</span>
          </span>
        </Link>
      </aside>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={panelLabel}>
        <div className="border-b px-4 py-2 sm:hidden"><LanguageSwitcher /></div>
        <NavList sections={sections} panel={panel} onNavigate={() => setDrawer(false)} />
      </Drawer>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken lg:hidden" onClick={() => setDrawer(true)} aria-label={t('panel.layout.openMenu')}><Menu className="h-5 w-5" /></button>
            <span className="lg:hidden"><Logo compact /></span>
            {crumb && (
              <nav className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex" aria-label={t('panel.layout.breadcrumb')}>
                <span className="text-ink-subtle">{panelLabel}</span>
                {crumb.section && <><ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden /><span className="text-ink-subtle">{crumb.section}</span></>}
                <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden />
                <span className="truncate font-medium text-ink">{crumb.label}</span>
              </nav>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitcher className="mr-1 hidden sm:inline-flex" />
            <a href={`tel:${env.hotline.replace(/\s/g, '')}`} className="hidden items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink md:flex" title={t('panel.layout.hotline')}>
              <LifeBuoy className="h-4 w-4" aria-hidden /> {t('panel.layout.help')}
            </a>
            {notificationsTo && (
              <Link to={notificationsTo} className="relative rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label={notificationsCount ? t('panel.layout.notificationsUnread', { count: notificationsCount }) : t('panel.layout.notifications')}>
                <Bell className="h-5 w-5" />
                {notificationsCount > 0 && <span className="absolute right-0.5 top-0.5 min-w-[1.1rem] rounded-full bg-danger-600 px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white" aria-hidden>{notificationsCount > 9 ? '9+' : notificationsCount}</span>}
              </Link>
            )}
            <UserMenu user={user} panelLabel={panelLabel} accountTo={accountTo} onLogout={onLogout} />
          </div>
        </header>
        {banner}
        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
