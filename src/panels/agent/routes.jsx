// Sales agent LMS (/agent): agents and managers. API: /api/agent.
import { lazy } from 'react';
import { RequireAuth, RequireRole } from '@/app/guards';
const PanelShell = lazy(() => import('../PanelShell'));
import { agentExtraRoutes } from './routes.extra';

const Today = lazy(() => import('./pages/today/TodayPage'));
const Account = lazy(() => import('../shared/AccountPage'));

export const agentRoutes = {
  path: '/agent',
  element: <RequireAuth><RequireRole roles={['agent', 'manager']}><PanelShell panel="agent" base="/agent" /></RequireRole></RequireAuth>,
  children: [
    { index: true, element: <Today /> },
    { path: 'account', element: <Account /> },
    ...agentExtraRoutes,
  ],
};
