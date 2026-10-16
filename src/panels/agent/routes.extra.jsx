// Agent panel screens for phases F3-F5 (lead management, deals, performance)
// and the field verification visits. Child routes of /agent; the index route
// (Today) stays in routes.jsx. Paths match AGENT_NAV in panels/panelNav.js.
import { lazy } from 'react';

const Leads = lazy(() => import('./pages/leads/LeadsPage'));
const NewLead = lazy(() => import('./pages/leads/NewLeadPage'));
const LeadDetail = lazy(() => import('./pages/leads/LeadDetailPage'));
const Pipeline = lazy(() => import('./pages/pipeline/PipelinePage'));
const Followups = lazy(() => import('./pages/followups/FollowupsPage'));
const Visits = lazy(() => import('./pages/visits/VisitsPage'));
const PropertyLookup = lazy(() => import('./pages/properties/PropertyLookupPage'));
const SalesSheet = lazy(() => import('./pages/properties/SalesSheetPage'));
const Deals = lazy(() => import('./pages/deals/DealsPage'));
const DealNew = lazy(() => import('./pages/deals/DealNewPage'));
const DealDetail = lazy(() => import('./pages/deals/DealDetailPage'));
const Performance = lazy(() => import('./pages/performance/PerformancePage'));
const VerificationVisits = lazy(() => import('./pages/verification-visits/VerificationVisitsPage'));
const VerificationOutcome = lazy(() => import('./pages/verification-visits/VerificationOutcomePage'));
const Notifications = lazy(() => import('../shared/NotificationsPage'));
const Profile = lazy(() => import('../shared/AccountPage'));

export const agentExtraRoutes = [
  { path: 'leads', element: <Leads /> },
  { path: 'leads/new', element: <NewLead /> },
  { path: 'leads/:id', element: <LeadDetail /> },
  { path: 'pipeline', element: <Pipeline /> },
  { path: 'follow-ups', element: <Followups /> },
  { path: 'visits', element: <Visits /> },
  { path: 'properties', element: <PropertyLookup /> },
  { path: 'properties/:id', element: <SalesSheet /> },
  { path: 'deals', element: <Deals /> },
  { path: 'deals/new', element: <DealNew /> },
  { path: 'deals/:id', element: <DealDetail /> },
  { path: 'performance', element: <Performance /> },
  { path: 'verification-visits', element: <VerificationVisits /> },
  { path: 'verification-visits/:id', element: <VerificationOutcome /> },
  // RE-S-AGT-15 / 16 (the account page holds availability and leave in this panel)
  { path: 'notifications', element: <Notifications base="/agent" description="New leads, follow-ups, visits, deals and system notices. Kept for 180 days." /> },
  { path: 'profile', element: <Profile /> },
];
