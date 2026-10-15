// Admin panel routes for finance, insights and content (frontend phases F4, F5).
// Child routes of /admin; each page is lazy and guarded by its nav permission.
import { lazy } from 'react';
import { RequirePermission } from '@/app/guards';

const DealQueue = lazy(() => import('./pages/deals/DealQueuePage'));
const DealDetail = lazy(() => import('./pages/deals/DealDetailPage'));
const Receivables = lazy(() => import('./pages/receivables/ReceivablesPage'));
const ReceivableDetail = lazy(() => import('./pages/receivables/ReceivableDetailPage'));
const Partners = lazy(() => import('./pages/partners/PartnersPage'));
const ReportsIndex = lazy(() => import('./pages/reports/ReportsIndexPage'));
const Report = lazy(() => import('./pages/reports/ReportPage'));
const AuditLogs = lazy(() => import('./pages/audit/AuditLogsPage'));
const Integrations = lazy(() => import('./pages/integrations/IntegrationsPage'));
const Cms = lazy(() => import('./pages/cms/CmsPage'));
const Settings = lazy(() => import('./pages/settings/SettingsPage'));
const Buyers = lazy(() => import('./pages/buyers/BuyersPage'));

const perm = (key, el) => <RequirePermission permission={key}>{el}</RequirePermission>;

export const adminFinanceRoutes = [
  { path: 'deals', element: perm('deals.verify', <DealQueue />) },
  { path: 'deals/:id', element: perm('deals.verify', <DealDetail />) },
  { path: 'receivables', element: perm('receivables.manage', <Receivables />) },
  { path: 'receivables/:id', element: perm('receivables.manage', <ReceivableDetail />) },
  { path: 'partners', element: perm('partners.manage', <Partners />) },
  { path: 'reports', element: perm('reports.view', <ReportsIndex />) },
  { path: 'reports/:key', element: perm('reports.view', <Report />) },
  { path: 'audit', element: perm('logs.view', <AuditLogs />) },
  { path: 'integrations', element: perm('integrations.manage', <Integrations />) },
  { path: 'cms', element: perm('cms.manage', <Cms />) },
  { path: 'settings', element: perm('settings.manage', <Settings />) },
  { path: 'buyers', element: perm('users.manage', <Buyers />) },
];
