// Sales agent LMS (/agent): agents and managers. API: /api/agent.
import { lazy } from 'react';
import { RequireAuth, RequireRole } from '@/app/guards';
import PanelShell from '../PanelShell';
import { AGENT_NAV } from '../panelNav';
import { placeholderRoutes } from '../placeholderRoutes';
import { agentExtraRoutes } from './routes.extra';

const Today = lazy(() => import('./pages/today/TodayPage'));
const Account = lazy(() => import('../shared/AccountPage'));

export const agentRoutes = {
  path: '/agent',
  element: <RequireAuth><RequireRole roles={['agent', 'manager']}><PanelShell panel="agent" nav={AGENT_NAV} label="Sales agent panel" base="/agent" /></RequireRole></RequireAuth>,
  children: [
    { index: true, element: <Today /> },
    { path: 'account', element: <Account /> },
    ...agentExtraRoutes,
    ...placeholderRoutes(AGENT_NAV, '/agent'),
  ],
};
