// Public portal (/) and auth pages. API: /api (public panel).
import { lazy } from 'react';
import AuthShell from './AuthShell';
import { GuestOnly, RequireAuth } from '@/app/guards';
import PublicShell from './PublicShell';

const Home = lazy(() => import('./pages/home/HomePage'));
const Login = lazy(() => import('./pages/auth/LoginPage'));
const Register = lazy(() => import('./pages/auth/RegisterPage'));
const Verify = lazy(() => import('./pages/auth/VerifyContactPage'));
const Forgot = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ChangePassword = lazy(() => import('./pages/auth/ChangePasswordRequiredPage'));
const Account = lazy(() => import('../shared/AccountPage'));
const CmsPage = lazy(() => import('./pages/cms/CmsPage'));

// Phase F2: search and discovery, detail pages, buyer account areas, landing pages, tools and token links.
const Search = lazy(() => import('./pages/search/SearchPage'));
const MapSearch = lazy(() => import('./pages/search/MapSearchPage'));
const Property = lazy(() => import('./pages/property/PropertyPage'));
const Projects = lazy(() => import('./pages/project/ProjectsPage'));
const Project = lazy(() => import('./pages/project/ProjectPage'));
const Compare = lazy(() => import('./pages/compare/ComparePage'));
const Shortlist = lazy(() => import('./pages/shortlist/ShortlistPage'));
const MyEnquiries = lazy(() => import('./pages/enquiries/MyEnquiriesPage'));
const City = lazy(() => import('./pages/landing/CityPage'));
const Locality = lazy(() => import('./pages/landing/LocalityPage'));
const LocalitiesIndex = lazy(() => import('./pages/landing/LocalitiesIndexPage'));
const ListerLanding = lazy(() => import('./pages/landing/ListerLandingPage'));
const Calculators = lazy(() => import('./pages/tools/CalculatorsPage'));
const Contact = lazy(() => import('./pages/contact/ContactPage'));
const RequestProperty = lazy(() => import('./pages/request/RequestPropertyPage'));
const VisitResponse = lazy(() => import('./pages/tokens/VisitResponsePage'));
const Feedback = lazy(() => import('./pages/tokens/FeedbackPage'));
const ListingCheck = lazy(() => import('./pages/tokens/ListingCheckPage'));
const VerifyPhotos = lazy(() => import('./pages/tokens/VerifyPhotosPage'));
const Unsubscribe = lazy(() => import('./pages/tokens/UnsubscribePage'));

const wrap = (el) => <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{el}</div>;

export const publicRoutes = [
  {
    element: <PublicShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'search', element: <Search /> },
      { path: 'search/map', element: <MapSearch /> },
      { path: 'property/:slug', element: <Property /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:slug', element: <Project /> },
      { path: 'compare', element: <Compare /> },
      { path: 'city/:city', element: <City /> },
      { path: 'city/:city/localities', element: <LocalitiesIndex /> },
      { path: 'city/:city/:locality', element: <Locality /> },
      { path: 'tools/calculators', element: <Calculators /> },
      { path: 'contact', element: <Contact /> },
      { path: 'request-property', element: <RequestProperty /> },
      { path: 'list-your-property', element: <ListerLanding /> },
      { path: 'p/:slug', element: <CmsPage /> },
      // Token links from SMS / email (no login).
      { path: 'visit/:token', element: <VisitResponse /> },
      { path: 'feedback/:token', element: <Feedback /> },
      { path: 'visit-feedback/:token', element: <Feedback /> },
      { path: 'listing-check/:token', element: <ListingCheck /> },
      { path: 'verify-photos/:token', element: <VerifyPhotos /> },
      { path: 'alerts/unsubscribe/:token', element: <Unsubscribe /> },
      // Signed-in buyer areas.
      { path: 'shortlist', element: <RequireAuth><Shortlist /></RequireAuth> },
      { path: 'account/shortlist', element: <RequireAuth><Shortlist /></RequireAuth> },
      { path: 'account/saved-searches', element: <RequireAuth><Shortlist /></RequireAuth> },
      { path: 'my-enquiries', element: <RequireAuth><MyEnquiries /></RequireAuth> },
      { path: 'my-enquiries/:id', element: <RequireAuth><MyEnquiries /></RequireAuth> },
      { path: 'account/enquiries', element: <RequireAuth><MyEnquiries /></RequireAuth> },
      { path: 'account/enquiries/:id', element: <RequireAuth><MyEnquiries /></RequireAuth> },
      { path: 'account', element: <RequireAuth>{wrap(<Account />)}</RequireAuth> },
    ],
  },
  {
    element: <AuthShell />,
    children: [
      { path: 'login', element: <GuestOnly><Login /></GuestOnly> },
      { path: 'register', element: <GuestOnly><Register /></GuestOnly> },
      { path: 'verify', element: <GuestOnly><Verify /></GuestOnly> },
      { path: 'forgot-password', element: <GuestOnly><Forgot /></GuestOnly> },
      { path: 'account/change-password', element: <RequireAuth><ChangePassword /></RequireAuth> },
    ],
  },
];
