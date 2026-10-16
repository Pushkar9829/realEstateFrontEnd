// Admin panel (/admin): super admin, admin staff and managers. API: /api/admin.
import { lazy } from 'react';
import { RequireAuth, RequirePermission, RequireRole } from '@/app/guards';
import PanelShell from '../PanelShell';
import { ADMIN_NAV } from '../panelNav';
import { placeholderRoutes } from '../placeholderRoutes';
import { adminSalesRoutes } from './routes.sales';
import { adminFinanceRoutes } from './routes.finance';

const Dashboard = lazy(() => import('./pages/dashboard/DashboardPage'));
const Account = lazy(() => import('../shared/AccountPage'));
const KycQueue = lazy(() => import('./pages/kyc/KycQueuePage'));
const KycReview = lazy(() => import('./pages/kyc/KycReviewPage'));
const ApprovalQueue = lazy(() => import('./pages/approvals/ApprovalQueuePage'));
const ListingReview = lazy(() => import('./pages/approvals/ListingReviewPage'));
const Registry = lazy(() => import('./pages/agreements/AgreementRegistryPage'));
const ProjectQueue = lazy(() => import('./pages/projects/ProjectQueuePage'));
const ProjectReview = lazy(() => import('./pages/projects/ProjectReviewPage'));
const Listers = lazy(() => import('./pages/listers/ListersPage'));
const Trust = lazy(() => import('./pages/trust/TrustPage'));
const AllListings = lazy(() => import('./pages/listings/AllListingsPage'));
const Masters = lazy(() => import('./pages/masters/MastersPage'));
const Staff = lazy(() => import('./pages/staff/StaffPage'));
const Notifications = lazy(() => import('../shared/NotificationsPage'));

const perm = (key, el) => <RequirePermission permission={key}>{el}</RequirePermission>;

export const adminRoutes = {
  path: '/admin',
  element: <RequireAuth><RequireRole roles={['admin', 'superadmin', 'manager']}><PanelShell panel="admin" nav={ADMIN_NAV} label="Admin panel" base="/admin" /></RequireRole></RequireAuth>,
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'account', element: <Account /> },
    { path: 'notifications', element: <Notifications base="/admin" description="Review queues, escalations, security and system notices. Kept for 180 days." /> },
    { path: 'staff', element: perm('staff.manage', <Staff />) },
    { path: 'kyc', element: perm('listers.verify', <KycQueue />) },
    { path: 'kyc/:userId', element: perm('listers.verify', <KycReview />) },
    { path: 'approvals', element: perm('properties.approve', <ApprovalQueue />) },
    { path: 'approvals/:id', element: perm('properties.approve', <ListingReview />) },
    { path: 'agreements', element: perm('agreements.view', <Registry />) },
    { path: 'projects', element: perm('projects.approve', <ProjectQueue />) },
    { path: 'projects/:id', element: perm('projects.approve', <ProjectReview />) },
    { path: 'listers', element: perm('listers.manage', <Listers />) },
    { path: 'listers/:id', element: perm('listers.manage', <Listers />) },
    { path: 'trust', element: perm('listers.manage', <Trust />) },
    { path: 'listings', element: perm('properties.manage', <AllListings />) },
    { path: 'masters', element: perm('masters.manage', <Masters />) },
    { path: 'agreements/:id', element: perm('agreements.view', <Registry />) },
    ...adminSalesRoutes,
    ...adminFinanceRoutes,
    ...placeholderRoutes(ADMIN_NAV, '/admin'),
  ],
};
