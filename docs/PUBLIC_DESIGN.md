# Public site design language ("modern premium")

Applies to the public marketing site only (`src/panels/public`, `src/shared/layouts/PublicLayout.jsx`,
`src/shared/layouts/AuthLayout.jsx`). The lister, agent and admin panels keep the original brand-blue look.
Reference implementation: `src/panels/public/pages/home/HomePage.jsx`, `PublicLayout.jsx`,
`components/PropertyCard.jsx`, `components/ProjectCard.jsx`.

## Tokens (src/design/tokens.json, Tailwind names)

- Ink / dark surfaces: `navy-50` ... `navy-950`. Headings `text-navy-900`, body `text-navy-500/600`, meta `text-navy-400`.
  Dark sections `bg-navy-900` / `bg-navy-950`, text on dark `text-white`, `text-navy-100/200/300`.
- Accent: `gold-50` ... `gold-800`. Eyebrows `text-gold-700` (light) / `text-gold-300` (dark), icons `text-gold-600`,
  primary call to action `Button variant="gold"`. Gold is an accent: never large gold backgrounds.
- Page background `bg-sand-50`; alternate sections `bg-white`; inputs `bg-sand-100`; image placeholders `bg-sand-200`.
- Status colours stay: `success-*`, `warning-*`, `danger-*`, `info-*`.
- Do not use `brand-*`, `accent-*`, `ink-*` or `surface-*` in public pages (those are the panel palette).

## Type

- `font-display` (Fraunces, serif) for page titles, section titles, prices, big numbers. Weight `font-medium` for
  titles, `font-semibold` for prices. Italic gold for one emphasised phrase in a hero (`italic text-gold-300`).
- Body `font-sans` (Inter). Eyebrow: `text-xs font-semibold uppercase tracking-[0.2em]` with a short rule before it
  (see `SectionTitle` in HomePage.jsx).
- Sizes: page hero h1 `text-4xl sm:text-5xl lg:text-6xl`; section h2 `text-3xl sm:text-[2.6rem] leading-tight`;
  card titles `text-xl font-display`.

## Shape and depth

- Cards: `rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5`, hover `hover:-translate-y-1 hover:shadow-lift`.
- Large media and feature panels: `rounded-[2rem]` / `rounded-3xl`. Inputs and segmented controls: `rounded-xl`.
- Pills and primary buttons: `rounded-full`. Buttons: `variant="gold" | "navy" | "outline" | "glass"` (glass only on dark/photo backgrounds), sizes `md | lg | xl`.
- Images: `object-cover`, slow zoom on hover `transition duration-700 ease-out group-hover:scale-[1.06]`,
  readable text on photos with `bg-gradient-to-t from-navy-950/85 via-navy-950/25 to-transparent`.
- Spacing: sections `py-16 lg:py-24`, container `mx-auto max-w-7xl px-4 sm:px-6`, card grids `gap-6`.

## Page headers (inner pages)

Inner pages get a compact header band instead of a full hero: `bg-navy-950` with an optional photo at low opacity
and a gradient, breadcrumb in `text-navy-300`, eyebrow + `font-display` title in white, one line of `text-navy-200`.
Height around `py-12 lg:py-16`. Search results may use a light header (`bg-white` + border) to keep focus on results.

## Photography

Local stock in `public/images/stock/*.webp` (credits in CREDITS.md): hero-tower, pune-aerial, pune-street,
tower-glass, towers-green, podium-garden, towers-night, living-warm, living-minimal, living-light, kitchen-wood,
kitchen-open, bedroom-calm, villa-pool, villa-white, villa-garden, house-dusk, office-glass, office-lounge.
Use them only as decorative backgrounds (`alt=""`, `aria-hidden` when purely decorative). Never present a
stock photo as a specific listing's photo.

## Rules

- Keep behaviour identical: same data, hooks, routes, test ids, aria attributes, form validation. Visual changes only.
- Every new user-visible string goes through `t()` with English and Hindi in your namespace file.
- Mobile first: no horizontal page scroll at 375 px, 16 px side gutter, tap targets at least 40 px.
- Accessible contrast: white text only on navy or on a photo with the dark gradient; gold text on dark only
  (`gold-300/400`), on light use `gold-700`.
