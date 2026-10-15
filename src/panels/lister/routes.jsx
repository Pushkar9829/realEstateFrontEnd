// Lister panel (/lister): owners, builders and landlords. API: /api/lister.
import { lazy } from 'react';
import { RequireAuth, RequireBuilder, RequireRole } from '@/app/guards';
import PanelShell from '../PanelShell';
import { LISTER_NAV } from '../panelNav';
import { placeholderRoutes } from '../placeholderRoutes';
import { listerExtraRoutes } from './routes.extra';

const Dashboard = lazy(() => import('./pages/dashboard/DashboardPage'));
const Account = lazy(() => import('../shared/AccountPage'));
const Verification = lazy(() => import('./pages/kyc/VerificationPage'));
const MyListings = lazy(() => import('./pages/listings/MyListingsPage'));
const Wizard = lazy(() => import('./pages/listings/WizardPage'));
const Agreements = lazy(() => import('./pages/agreements/AgreementsPage'));
const Projects = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectEditor = lazy(() => import('./pages/projects/ProjectEditorPage'));

export const listerRoutes = {
  path: '/lister',
  element: <RequireAuth><RequireRole roles={['lister']}><PanelShell panel="lister" nav={LISTER_NAV} label="Lister panel" base="/lister" /></RequireRole></RequireAuth>,
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'account', element: <Account /> },
    { path: 'verification', element: <Verification /> },
    { path: 'listings', element: <MyListings /> },
    { path: 'listings/:id/edit', element: <Wizard /> },
    { path: 'projects', element: <RequireBuilder><Projects /></RequireBuilder> },
    { path: 'projects/:id', element: <RequireBuilder><ProjectEditor /></RequireBuilder> },
    { path: 'agreements', element: <Agreements /> },
    { path: 'agreements/:id', element: <Agreements /> },
    ...listerExtraRoutes,
    ...placeholderRoutes(LISTER_NAV, '/lister'),
  ],
};
