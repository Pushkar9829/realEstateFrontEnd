// Admin panel sales and trust screens (frontend phases F2 / F3): leads, queue
// and SLA, routing, teams, site visits, photo verification QA, reported
// listings, seeker flags and verification visits. Child routes of /admin;
// each permission key matches its ADMIN_NAV item.
import { lazy } from 'react';
import { RequirePermission } from '@/app/guards';

const AllLeads = lazy(() => import('./pages/leads/AllLeadsPage'));
const LeadDetail = lazy(() => import('./pages/leads/LeadDetailPage'));
const LeadQueue = lazy(() => import('./pages/sla/LeadQueuePage'));
const RoutingRules = lazy(() => import('./pages/routing/RoutingRulesPage'));
const Teams = lazy(() => import('./pages/teams/TeamsPage'));
const TeamEditor = lazy(() => import('./pages/teams/TeamEditorPage'));
const SiteVisits = lazy(() => import('./pages/visits/SiteVisitsPage'));
const PhotoQueue = lazy(() => import('./pages/photo-verification/PhotoQueuePage'));
const PhotoReview = lazy(() => import('./pages/photo-verification/PhotoReviewPage'));
const ReportedListings = lazy(() => import('./pages/feedback/ReportedListingsPage'));
const SeekerFlags = lazy(() => import('./pages/seeker-flags/SeekerFlagsPage'));
const VerificationVisits = lazy(() => import('./pages/verification-visits/VerificationVisitsPage'));

const perm = (key, el) => <RequirePermission permission={key}>{el}</RequirePermission>;

export const adminSalesRoutes = [
  { path: 'leads', element: perm('leads.view_all', <AllLeads />) },
  { path: 'leads/:id', element: perm('leads.view_all', <LeadDetail />) },
  { path: 'sla', element: perm('leads.assign', <LeadQueue />) },
  { path: 'routing', element: perm('routing.manage', <RoutingRules />) },
  { path: 'teams', element: perm('teams.manage', <Teams />) },
  { path: 'teams/:id', element: perm('teams.manage', <TeamEditor />) },
  { path: 'visits', element: perm('sitevisits.view', <SiteVisits />) },
  { path: 'photo-verification', element: perm('verification.review', <PhotoQueue />) },
  { path: 'photo-verification/:id', element: perm('verification.review', <PhotoReview />) },
  { path: 'feedback', element: perm('properties.manage', <ReportedListings />) },
  { path: 'seeker-flags', element: perm('users.manage', <SeekerFlags />) },
  { path: 'verification-visits', element: perm('verification.schedule', <VerificationVisits />) },
];
