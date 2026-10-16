// Panel navigation, defined module-wise. `phase` marks screens built in a
// later frontend phase (they route to a placeholder until then); `perm` is
// the admin permission key; `builder` limits an item to builder accounts.
import {
  BadgeCheck, BarChart3, Bell, Building2, CalendarDays, ClipboardCheck, FileSignature, FileText, Flag, Gauge, Handshake,
  Home, Inbox, KanbanSquare, LayoutDashboard, ListChecks, MapPin, MessageSquareQuote, Receipt, Route, ScrollText,
  Search, Settings, ShieldAlert, ShieldCheck, Store, Timer, UserCog, Users, Wallet, Clock, Camera, Database, Plug,
} from 'lucide-react';

export const LISTER_NAV = [
  { items: [
    { to: '/lister', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/lister/verification', label: 'Verification (KYC)', icon: ShieldCheck, module: 'F KYC & no-broker' },
  ] },
  { title: 'Properties', items: [
    { to: '/lister/listings', label: 'My listings', icon: Home, module: 'A Listings' },
    { to: '/lister/projects', label: 'Builder projects', icon: Building2, module: 'G Builder projects', builder: true },
    { to: '/lister/agreements', label: 'Agreements', icon: FileSignature, module: 'D Agreements' },
  ] },
  { title: 'Buyers', items: [
    { to: '/lister/leads', label: 'Leads and visits', icon: Users, module: 'C Lead management' },
    { to: '/lister/availability', label: 'Visit availability', icon: CalendarDays, module: 'C Lead management' },
    { to: '/lister/offers', label: 'Offers', icon: Handshake, module: 'C Lead management' },
  ] },
  { title: 'Money', items: [
    { to: '/lister/invoices', label: 'Invoices', icon: Receipt, module: 'I Receivables' },
  ] },
  { title: 'Account', items: [
    { to: '/lister/notifications', label: 'Notifications', icon: Bell, module: 'K Notifications' },
    { to: '/lister/account', label: 'Account and security', icon: UserCog },
  ] },
];

export const AGENT_NAV = [
  { items: [
    { to: '/agent', label: 'Today', icon: Timer, end: true, module: 'C Lead management' },
  ] },
  { title: 'Leads', items: [
    { to: '/agent/leads', label: 'My leads', icon: Inbox, module: 'C Lead management' },
    { to: '/agent/pipeline', label: 'Pipeline board', icon: KanbanSquare, module: 'C Lead management' },
    { to: '/agent/follow-ups', label: 'Follow-ups', icon: ListChecks, module: 'C Lead management' },
    { to: '/agent/visits', label: 'Site visits', icon: CalendarDays, module: 'C Lead management' },
  ] },
  { title: 'Sales', items: [
    { to: '/agent/properties', label: 'Property lookup', icon: Search, module: 'A Listings / B Masking' },
    { to: '/agent/deals', label: 'My deals', icon: Handshake, module: 'H Deals' },
    { to: '/agent/performance', label: 'Performance', icon: BarChart3, module: 'O Reports' },
    { to: '/agent/verification-visits', label: 'Verification visits', icon: MapPin, perm: 'verification.field', module: 'D Site verification' },
  ] },
  { title: 'Account', items: [
    { to: '/agent/notifications', label: 'Notifications', icon: Bell, module: 'K Notifications' },
    { to: '/agent/account', label: 'Profile and availability', icon: UserCog, module: 'J Teams' },
  ] },
];

export const ADMIN_NAV = [
  { items: [
    { to: '/admin', label: 'Dashboard', icon: Gauge, end: true },
  ] },
  { title: 'Supply', items: [
    { to: '/admin/kyc', label: 'KYC queue', icon: ShieldCheck, perm: 'listers.verify', module: 'F KYC' },
    { to: '/admin/listers', label: 'Listers', icon: Store, perm: 'listers.manage', module: 'F KYC' },
    { to: '/admin/trust', label: 'Trust and safety', icon: ShieldAlert, perm: 'listers.manage', module: 'F No-broker' },
    { to: '/admin/seeker-flags', label: 'Seeker flags', icon: Flag, perm: 'users.manage', module: 'F No-broker' },
    { to: '/admin/approvals', label: 'Approval queue', icon: ClipboardCheck, perm: 'properties.approve', module: 'D Approvals' },
    { to: '/admin/listings', label: 'All listings', icon: Home, perm: 'properties.manage', module: 'A Listings' },
    { to: '/admin/projects', label: 'Builder projects', icon: Building2, perm: 'projects.approve', module: 'G Projects' },
    { to: '/admin/photo-verification', label: 'Photo verification', icon: Camera, perm: 'verification.review', module: 'A Listings' },
    { to: '/admin/verification-visits', label: 'Verification visits', icon: MapPin, perm: 'verification.schedule', module: 'D Approvals' },
    { to: '/admin/agreements', label: 'Agreement registry', icon: FileSignature, perm: 'agreements.view', module: 'D Agreements' },
  ] },
  { title: 'Sales', items: [
    { to: '/admin/leads', label: 'All leads', icon: Inbox, perm: 'leads.view_all', module: 'C Leads' },
    { to: '/admin/sla', label: 'Lead queue and SLA', icon: Clock, perm: 'leads.assign', module: 'C Leads' },
    { to: '/admin/routing', label: 'Routing rules', icon: Route, perm: 'routing.manage', module: 'C Leads' },
    { to: '/admin/teams', label: 'Teams', icon: Users, perm: 'teams.manage', module: 'J Teams' },
    { to: '/admin/staff', label: 'Staff users', icon: UserCog, perm: 'staff.manage', module: 'M Accounts' },
    { to: '/admin/visits', label: 'Site visits', icon: MapPin, perm: 'sitevisits.view', module: 'C Leads' },
  ] },
  { title: 'Finance', items: [
    { to: '/admin/deals', label: 'Deal verification', icon: BadgeCheck, perm: 'deals.verify', module: 'H Deals' },
    { to: '/admin/receivables', label: 'Receivables', icon: Wallet, perm: 'receivables.manage', module: 'I Receivables' },
    { to: '/admin/partners', label: 'Partners and referrals', icon: Handshake, perm: 'partners.manage', module: 'H Partners' },
  ] },
  { title: 'Content and settings', items: [
    { to: '/admin/buyers', label: 'Buyers and privacy', icon: Flag, perm: 'users.manage', module: 'M Accounts' },
    { to: '/admin/masters', label: 'Masters', icon: Database, perm: 'masters.manage', module: 'L Masters' },
    { to: '/admin/cms', label: 'CMS and templates', icon: FileText, perm: 'cms.manage', module: 'L CMS' },
    { to: '/admin/settings', label: 'Settings', icon: Settings, perm: 'settings.manage', module: 'L Settings' },
  ] },
  { title: 'Insights', items: [
    { to: '/admin/reports', label: 'Reports', icon: BarChart3, perm: 'reports.view', module: 'O Reports' },
    { to: '/admin/audit', label: 'Audit and logs', icon: ScrollText, perm: 'logs.view', module: 'O Audit' },
    { to: '/admin/integrations', label: 'Integrations', icon: Plug, perm: 'integrations.manage', module: 'N MLM outbox' },
    { to: '/admin/feedback', label: 'Reported listings', icon: MessageSquareQuote, perm: 'properties.manage', module: 'E Search' },
  ] },
  { title: 'Account', items: [
    { to: '/admin/notifications', label: 'Notifications', icon: Bell, module: 'K Notifications' },
    { to: '/admin/account', label: 'Account and security', icon: UserCog },
  ] },
];

// Filter by permission / builder flag and add the "soon" badge for later phases.
export function visibleNav(nav, { hasPermission, user }) {
  return nav
    .map((s) => ({
      ...s,
      items: s.items
        .filter((it) => (!it.perm || hasPermission(it.perm)) && (!it.builder || user.listerType === 'builder'))
        .map((it) => ({ ...it, soon: it.phase ? it.phase : undefined })),
    }))
    .filter((s) => s.items.length);
}

// Placeholder routes for every nav item that is not built yet.
export const placeholders = (nav, base) => nav.flatMap((s) => s.items).filter((it) => it.phase && it.to !== base)
  .map((it) => ({ path: it.to.slice(base.length + 1), title: it.label, module: it.module, phase: it.phase, perm: it.perm, builder: it.builder }));
