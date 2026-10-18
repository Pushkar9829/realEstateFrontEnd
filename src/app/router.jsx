// Panel route trees (docs/ARCHITECTURE.md 7). Each panel is lazy-loaded, so a
// buyer never downloads lister, agent or admin code.
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { PageSpinner } from '@/shared/ui';
import { publicRoutes } from '@/panels/public/routes';
import { listerRoutes } from '@/panels/lister/routes';
import { agentRoutes } from '@/panels/agent/routes';
import { adminRoutes } from '@/panels/admin/routes';
import RouteError from './RouteError';
import NotFound from './NotFound';
import MaintenanceBanner from '@/shared/components/MaintenanceBanner';

const UiGallery = lazy(() => import('@/dev/UiGallery'));
const SsoCc = lazy(() => import('@/modules/auth/SsoCc'));

function Root() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MaintenanceBanner />
      <Outlet />
    </Suspense>
  );
}

export const routes = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      ...publicRoutes,
      listerRoutes,
      agentRoutes,
      adminRoutes,
      { path: 'sso/cc', element: <SsoCc /> }, // Control Center single sign-on hand-off
      ...(import.meta.env.DEV ? [{ path: 'dev/ui', element: <UiGallery /> }] : []),
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const routerFuture = { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true };
export const router = createBrowserRouter(routes, { future: routerFuture });
