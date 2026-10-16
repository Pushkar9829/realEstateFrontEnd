// Shell for the lister, agent and admin panels: sidebar (drawer on mobile)
// with a user card, top bar with breadcrumb, help and account menu, and the
// page outlet. Panel data (nav, user, logout) is passed in so this stays
// module-agnostic.
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, ChevronRight, ExternalLink, LifeBuoy, LogOut, Menu, UserRound } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Avatar, Drawer } from '@/shared/ui';
import Logo from '@/shared/components/Logo';
import env from '@/config/env';

const ACCENT = { lister: 'bg-accent-500', agent: 'bg-success-600', admin: 'bg-brand-600' };

function NavList({ sections, onNavigate }) {
  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Panel">
      {sections.map((s) => (
        <div key={s.title || 'main'}>
          {s.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{s.title}</p>}
          <ul className="space-y-0.5">
            {s.items.map((it) => (
              <li key={it.to}>
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
            ))}
          </ul>
        </div>
      ))}
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
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const ref = useOutsideClose(open, setOpen);
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-sunken" aria-expanded={open} aria-haspopup="menu">
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
            <Link role="menuitem" to={accountTo} className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-surface-muted"><UserRound className="h-4 w-4 text-ink-subtle" /> Account and security</Link>
            <Link role="menuitem" to="/" className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-surface-muted"><ExternalLink className="h-4 w-4 text-ink-subtle" /> Open public site</Link>
          </div>
          <div className="border-t py-1">
            <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger-700 hover:bg-danger-50"><LogOut className="h-4 w-4" /> Log out</button>
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
  const [drawer, setDrawer] = useState(false);
  const crumb = useCrumb(sections, base);
  return (
    <div className="flex min-h-screen bg-surface-muted">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Logo />
        </div>
        <div className="px-5 pt-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
            <span className={cn('h-2 w-2 rounded-full', ACCENT[panel])} aria-hidden /> {panelLabel}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto"><NavList sections={sections} /></div>
        <Link to={accountTo} className="flex items-center gap-3 border-t px-5 py-3 hover:bg-surface-muted">
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
            <span className="block truncate text-xs text-ink-subtle">{user.email}</span>
          </span>
        </Link>
      </aside>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={panelLabel}>
        <NavList sections={sections} onNavigate={() => setDrawer(false)} />
      </Drawer>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <span className="lg:hidden"><Logo compact /></span>
            {crumb && (
              <nav className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex" aria-label="Breadcrumb">
                <span className="text-ink-subtle">{panelLabel}</span>
                {crumb.section && <><ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden /><span className="text-ink-subtle">{crumb.section}</span></>}
                <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" aria-hidden />
                <span className="truncate font-medium text-ink">{crumb.label}</span>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-1">
            <a href={`tel:${env.hotline.replace(/\s/g, '')}`} className="hidden items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink md:flex" title="Support hotline">
              <LifeBuoy className="h-4 w-4" aria-hidden /> Help
            </a>
            {notificationsTo && (
              <Link to={notificationsTo} className="relative rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink" aria-label={notificationsCount ? `Notifications, ${notificationsCount} unread` : 'Notifications'}>
                <Bell className="h-5 w-5" />
                {notificationsCount > 0 && <span className="absolute right-0.5 top-0.5 min-w-[1.1rem] rounded-full bg-danger-600 px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white" aria-hidden>{notificationsCount > 99 ? '99+' : notificationsCount}</span>}
              </Link>
            )}
            <UserMenu user={user} panelLabel={panelLabel} accountTo={accountTo} onLogout={onLogout} />
          </div>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
