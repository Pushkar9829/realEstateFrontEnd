// Public portal shell: header (search links for the chosen city, city
// selector, shortlist count, list your property, sign in or the account link),
// a closing call-to-action band, footer (CMS links, hotline, WhatsApp, help,
// the platform's RERA agent registrations per state (RE-L-10), grievance
// officer (RE-M-10), cookie settings (RE-L-11)) and the cookie consent banner.
// `settings` is GET /api/settings/public; the panel shell passes it in.
// Visual language: navy + gold, serif display headings (design/tokens.json).
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { HelpCircle, Mail, Menu, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react';
import env from '@/config/env';
import { cn } from '@/shared/lib/cn';
import { date } from '@/shared/lib/format';
import { Button } from '@/shared/ui';
import Logo from '@/shared/components/Logo';
import SkipLink from '@/shared/components/SkipLink';
import CookieBanner, { openCookieSettings } from '@/shared/components/CookieBanner';
import { useLang, useT } from '@/shared/i18n';
import LanguageSwitcher from '@/shared/i18n/LanguageSwitcher';

const CMS_LINKS = [['about', 'common.footer.about'], ['no-broker-policy', 'common.footer.noBroker'], ['terms', 'common.footer.terms'], ['privacy', 'common.footer.privacy'], ['faq', 'common.footer.faq']];

// city: { code, name } of the chosen city or null.
function navLinks(city, t) {
  const q = city ? `&city=${encodeURIComponent(city.code)}` : '';
  return [
    { to: `/search?purpose=sale${q}`, label: t('common.nav.buy') },
    { to: `/search?purpose=rent${q}`, label: t('common.nav.rent') },
    { to: `/projects${city ? `?city=${encodeURIComponent(city.name)}` : ''}`, label: t('common.nav.projects') },
    { to: '/list-your-property', label: t('common.nav.listProperty') },
  ];
}

// Buy and Rent both point at /search: only the one whose purpose matches is current.
function linkActive(to, loc) {
  const [path, query = ''] = to.split('?');
  if (loc.pathname !== path && !loc.pathname.startsWith(`${path}/`)) return false;
  const want = new URLSearchParams(query).get('purpose');
  return !want || new URLSearchParams(loc.search).get('purpose') === want;
}

const waLink = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length >= 10 ? `https://wa.me/${d}` : null; };
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);
const telHref = (n) => `tel:${String(n || '').replace(/[^\d+]/g, '')}`;
const fmtDate = (d) => { const x = date(d); return x === '-' ? '' : x; };

const FOOT_HEAD = 'mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gold-400';

function FooterContact({ settings: s }) {
  const t = useT();
  const hotline = s.hotline || env.hotline;
  const wa = waLink(s.whatsappNumber);
  const help = safeUrl(s.helpdeskUrl);
  const g = (s.privacy && s.privacy.grievanceOfficer) || {};
  return (
    <div className="space-y-2.5">
      <p className={FOOT_HEAD}>{t('common.footer.talkToUs')}</p>
      <a href={telHref(hotline)} className="flex items-center gap-2 font-display text-lg text-white"><Phone className="h-4 w-4 text-gold-400" aria-hidden /> {hotline}</a>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-white"><MessageCircle className="h-4 w-4" aria-hidden /> {t('common.footer.whatsapp')}</a>}
      {s.supportEmail && <a href={`mailto:${s.supportEmail}`} className="flex items-center gap-2 transition-colors hover:text-white"><Mail className="h-4 w-4" aria-hidden /> {s.supportEmail}</a>}
      {help && <a href={help} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-white"><HelpCircle className="h-4 w-4" aria-hidden /> {t('common.footer.help')}</a>}
      <p className="text-navy-300">{t('common.footer.hours')}</p>
      {(g.name || g.email) && (
        <p className="text-xs text-navy-300">{t('common.footer.grievance')} {g.name}{g.name && g.email ? ', ' : ''}{g.email && <a href={`mailto:${g.email}`} className="underline hover:text-white">{g.email}</a>}</p>
      )}
    </div>
  );
}

// RE-L-10: [{ state, number, validTill }] entered by the super admin.
function AgentRegistrations({ list }) {
  const t = useT();
  const { lang } = useLang();
  const rows = (Array.isArray(list) ? list : []).filter((r) => r && r.number);
  if (!rows.length) return null;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-300">
        <span className="inline-flex items-center gap-1 font-semibold text-navy-200"><ShieldCheck className="h-3.5 w-3.5 text-gold-400" aria-hidden />{t('common.footer.reraAgent')}</span>
        {rows.map((r) => <span key={`${r.state}-${r.number}`}>{r.state ? `${r.state}: ` : ''}<span className="font-medium text-navy-200">{r.number}</span>{r.validTill && fmtDate(r.validTill, lang) ? ` ${t('common.footer.validTill', { date: fmtDate(r.validTill, lang) })}` : ''}</span>)}
      </p>
    </div>
  );
}

// Closing call-to-action band above the footer on every public page.
function CtaBand({ hotline }) {
  const t = useT();
  return (
    <section className="relative overflow-hidden bg-navy-900">
      <img src="/images/stock/towers-night.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-900/40" aria-hidden />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-16">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-medium text-white sm:text-4xl">{t('marketing.band.title')}</h2>
          <p className="mt-3 text-navy-200">{t('marketing.band.text')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="gold" size="xl" to="/search?purpose=sale" className="rounded-full">{t('marketing.band.browse')}</Button>
          <a href={telHref(hotline)} className="inline-flex h-14 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 font-medium text-white backdrop-blur transition-colors hover:bg-white/20">
            <Phone className="h-4 w-4" aria-hidden />{t('marketing.band.call', { phone: hotline })}
          </a>
        </div>
      </div>
    </section>
  );
}

// onConsentChoice(choice): forwarded to the cookie banner (consent ledger for signed-in users).
export default function PublicLayout({ account, settings, settingsReady = true, city = null, cityPicker = null, shortlist = null, onConsentChoice }) {
  const t = useT();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const s = settings || {};
  const consent = s.consent || {};
  const LINKS = navLinks(city, t);
  const bannerOn = consent.bannerEnabled !== false;
  const hotline = s.hotline || env.hotline;
  const listLink = LINKS[3];
  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-navy-900/5 bg-white/90 backdrop-blur-md">
        <div className="h-0.5 bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600" aria-hidden />
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo luxe />
          <nav className="hidden items-center gap-1 md:flex" aria-label={t('common.nav.main')}>
            {LINKS.slice(0, 3).map((l) => (
              <Link key={l.to} to={l.to} aria-current={linkActive(l.to, loc) ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-sm font-medium transition-colors', linkActive(l.to, loc) ? 'bg-navy-900/5 text-navy-900' : 'text-navy-600 hover:bg-navy-900/5 hover:text-navy-900')}>{l.label}</Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher className="mr-1" />
            {cityPicker && <div className="hidden lg:block">{cityPicker}</div>}
            {shortlist}
            {account || <Button variant="ghost" to="/login" className="rounded-full text-navy-700">{t('common.header.login')}</Button>}
            <Button variant="navy" to={listLink.to} className="hidden rounded-full px-5 lg:inline-flex">{listLink.label}</Button>
          </div>
          <div className="flex items-center gap-1 md:hidden">
            {shortlist}
            <button type="button" className="rounded-full p-2 text-navy-700 hover:bg-navy-900/5" onClick={() => setOpen((o) => !o)} aria-label={open ? t('common.nav.closeMenu') : t('common.nav.openMenu')} aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-navy-900/5 bg-white px-4 pb-5 pt-3 md:hidden">
            <LanguageSwitcher className="mb-3" />
            {cityPicker && <div className="mb-3">{cityPicker}</div>}
            <nav className="flex flex-col" aria-label={t('common.nav.mobile')}>
              {LINKS.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="border-b border-navy-900/5 py-3 font-display text-lg text-navy-900">{l.label}</Link>)}
            </nav>
            <div className="mt-4 flex gap-2" onClick={() => setOpen(false)}>
              {account || (<><Button variant="outline" to="/login" block className="rounded-full">{t('common.header.login')}</Button><Button variant="navy" to="/register" block className="rounded-full">{t('common.header.signup')}</Button></>)}
            </div>
          </div>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none"><Outlet /></main>

      <CtaBand hotline={hotline} />
      <footer className="bg-navy-950 text-sm text-navy-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="space-y-4">
            <Logo luxe inverse />
            <p className="max-w-xs leading-relaxed text-navy-300">{t('common.footer.tagline')}</p>
            <p className="font-display text-lg italic text-gold-300">{t('marketing.footer.newsletterTitle')}</p>
          </div>
          <div>
            <p className={FOOT_HEAD}>{t('common.footer.explore')}</p>
            <ul className="space-y-2.5">{LINKS.map((l) => <li key={l.to}><Link to={l.to} className="transition-colors hover:text-white">{l.label}</Link></li>)}</ul>
          </div>
          <div>
            <p className={FOOT_HEAD}>{t('common.footer.company')}</p>
            <ul className="space-y-2.5">
              {CMS_LINKS.map(([slug, label]) => (
                <li key={slug}><Link to={`/p/${slug}`} className="transition-colors hover:text-white">{t(label)}</Link></li>
              ))}
              <li><Link to="/contact" className="transition-colors hover:text-white">{t('common.footer.contact')}</Link></li>
              {bannerOn && <li><button type="button" onClick={openCookieSettings} className="transition-colors hover:text-white">{t('common.footer.cookieSettings')}</button></li>}
            </ul>
          </div>
          <FooterContact settings={s} />
        </div>
        <AgentRegistrations list={s.rera && s.rera.agentRegistrations} />
        <div className="border-t border-white/5">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-navy-300 sm:flex-row sm:px-6">
            <span>{t('common.footer.rights', { year: new Date().getFullYear(), company: s.companyName || env.appName })}</span>
            <span>{t('marketing.footer.madeIn')}</span>
          </div>
        </div>
      </footer>
      <CookieBanner ready={settingsReady} enabled={bannerOn} cookieDays={consent.cookieDays} ga4Id={consent.ga4MeasurementId} onChoice={onConsentChoice} />
    </div>
  );
}
