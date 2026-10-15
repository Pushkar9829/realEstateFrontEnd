// Lister panel screens from frontend phases F3-F5 (leads, visits, availability,
// offers, invoices, notifications, listing stats). Child routes of /lister;
// paths match LISTER_NAV in panels/panelNav.js.
import { lazy } from 'react';

const Leads = lazy(() => import('./pages/leads/LeadsPage'));
const Availability = lazy(() => import('./pages/availability/AvailabilityPage'));
const Offers = lazy(() => import('./pages/offers/OffersPage'));
const OfferDetail = lazy(() => import('./pages/offers/OfferDetailPage'));
const Invoices = lazy(() => import('./pages/invoices/InvoicesPage'));
const InvoiceDetail = lazy(() => import('./pages/invoices/InvoiceDetailPage'));
const Notifications = lazy(() => import('./pages/notifications/NotificationsPage'));
const ListingStats = lazy(() => import('./pages/stats/ListingStatsPage'));

export const listerExtraRoutes = [
  { path: 'leads', element: <Leads key="leads" /> },
  // Notification deep links use /lister/visits; it opens the Visits tab.
  { path: 'visits', element: <Leads key="visits" /> },
  { path: 'availability', element: <Availability /> },
  { path: 'offers', element: <Offers /> },
  { path: 'offers/:id', element: <OfferDetail /> },
  { path: 'invoices', element: <Invoices /> },
  { path: 'invoices/:id', element: <InvoiceDetail /> },
  { path: 'notifications', element: <Notifications /> },
  { path: 'listings/:id/stats', element: <ListingStats /> },
];
