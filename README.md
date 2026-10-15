# Real Estate Platform - Frontend

React web app for the Real Estate Property Platform: public portal, lister panel, sales agent panel and admin panel. It is fully independent of `../backend` and talks to it only through the REST API (`VITE_API_URL`). Architecture: `../docs/ARCHITECTURE.md` (PDF: `../docs/realestate-system-architecture.pdf`).

## Run locally

```bash
cp .env.example .env        # VITE_API_URL=http://localhost:4102/api
npm install
npm run dev                 # http://localhost:5182
```

The backend must be running on port 4102 (`cd ../backend && npm run dev`). In development, OTP codes are printed in the backend console.

Demo accounts for every role: `cd ../backend && node scripts/seed-demo-users.js` (local database only; it refuses to run in production). The script prints the emails and the shared test password. In development the login page lists every demo account with one-click fill (`src/panels/public/pages/auth/DemoAccounts.jsx`); production builds leave it out entirely.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5182 |
| `npm run build` | Production build into `dist/` |
| `npm test` | Vitest + Testing Library suites in `tests/` |
| `npm run lint` | ESLint, including the layer import rules |

## Structure

```
src/
  app/          App providers, router (lazy panel trees), guards, error pages
  config/       env.js (VITE_* only - never secrets)
  design/       tokens.json (single source of the design language) + Tailwind preset
  shared/       ui/ (UI kit), layouts/, lib/ (API client, session, formatters), components/
  modules/      one folder per spec module (auth = M today; A-O added phase by phase)
  panels/       public/, lister/, agent/, admin/ - routes.jsx + pages/<module>/
  dev/          /dev/ui component gallery (development only)
```

Import direction: `panels -> modules -> shared -> design`. ESLint blocks modules importing panels and shared importing modules.

## Design system (same UI on web and app)

All colours, type sizes, radii and shadows come from `src/design/tokens.json`. Components use only token names (`bg-brand-600`, `text-ink-muted`, `rounded-lg`). The mobile app (`../mobile`, later) uses an identical copy of the tokens and the same component names and variants. Open `/dev/ui` in development to review every token and component.

## Auth

Two-step login (password, then email / SMS code or authenticator app). The access token is kept in memory and the refresh token in localStorage; the API client refreshes once on a 401 and retries. Refresh tokens rotate, and reuse signs the user out everywhere.

## Phases

| Phase | Status |
|---|---|
| F0 Foundation: tokens, UI kit, layouts, router and guards, API client, auth with 2FA, account and security, panel shells | Done |
| F1 Supply side: lister KYC, 8-step listing wizard (map pin, photos, proof, commission), my listings, builder projects (RERA, configurations, CSV units, inventory), agreements; admin KYC queue/review, approval queue/review with photo moderation, agreement registry, project review, listers, trust and safety, all listings, masters | Done |
| F2 Public portal: home, search with filters and map, property and project pages, compare, enquiry modal with guest OTP, shortlist and saved searches, city and locality pages, calculators, contact and request-a-property, my enquiries, token pages (photo capture, availability check, visit response, feedback, unsubscribe) | Done |
| F3 Leads: agent Today, leads and lead detail, pipeline board, follow-ups, visit calendar, property lookup and sales sheet, offers; lister leads, availability, offers, notifications; admin leads, SLA queue, routing, teams, visits, photo QA, reported listings, seeker flags, verification visits | Done |
| F4 Money: agent deals with documents and gates; admin deal verification and reversal, receivables and GST invoices, partners; lister invoices with payment proof and disputes | Done |
| F5 Insights and settings: dashboards, reports with CSV export, audit and logs, integrations (outbox and jobs), CMS and templates, settings, buyers and privacy, agent performance, lister listing stats | Done |

Every nav item is a real screen now; a test fails if a later-phase placeholder is left in the nav. Mobile app and deployment are out of this scope.

## Deploy (Vercel)

Import the `frontend/` folder as a Vercel project (framework: Vite). Set `VITE_API_URL` to the Render API URL plus `/api`. `vercel.json` adds the SPA rewrite and security headers. Add the Vercel domain to the backend's `CORS_ORIGINS`.
