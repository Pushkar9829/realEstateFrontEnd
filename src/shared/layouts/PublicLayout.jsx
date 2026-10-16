// Public portal shell: header (search links for the chosen city, city
// selector, shortlist count, list your property, sign in or the account link),
// footer (CMS links, hotline, WhatsApp, help, the platform's RERA agent
// registrations per state (RE-L-10), grievance officer (RE-M-10), cookie
// settings (RE-L-11)) and the cookie consent banner.
// `settings` is GET /api/settings/public; the panel shell passes it in.
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { HelpCircle, Mail, Menu, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react';
import env from '@/config/env';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';
import Logo from '@/shared/components/Logo';
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

const waLink = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length >= 10 ? `https://wa.me/${d}` : null; };
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);
const fmtDate = (d, lang = 'en') => { const x = d ? new Date(d) : null; return x && !Number.isNaN(x.getTime()) ? x.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };

function FooterContact({ settings: s }) {
  const t = useT();
  const hotline = s.hotline || env.hotline;
  const wa = waLink(s.whatsappNumber);
  const help = safeUrl(s.helpdeskUrl);
  const g = (s.privacy && s.privacy.grievanceOfficer) || {};
  return (
    <div className="space-y-2">
      <p className="mb-2 font-semibold text-white">{t('common.footer.talkToUs')}</p>
      <a href={`tel:${hotline.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 text-white"><Phone className="h-4 w-4" aria-hidden /> {hotline}</a>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white"><MessageCircle className="h-4 w-4" aria-hidden /> {t('common.footer.whatsapp')}</a>}
      {s.supportEmail && <a href={`mailto:${s.supportEmail}`} className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4" aria-hidden /> {s.supportEmail}</a>}
      {help && <a href={help} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white"><HelpCircle className="h-4 w-4" aria-hidden /> {t('common.footer.help')}</a>}
      <p className="text-brand-200">{t('common.footer.hours')}</p>
      {(g.name || g.email) && (
        <p className="text-xs text-brand-300">{t('common.footer.grievance')} {g.name}{g.name && g.email ? ', ' : ''}{g.email && <a href={`mailto:${g.email}`} className="underline hover:text-white">{g.email}</a>}</p>
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
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-300">
        <span className="inline-flex items-center gap-1 font-semibold text-brand-100"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t('common.footer.reraAgent')}</span>
        {rows.map((r) => <span key={`${r.state}-${r.number}`}>{r.state ? `${r.state}: ` : ''}<span className="font-medium text-brand-100">{r.number}</span>{r.validTill && fmtDate(r.validTill, lang) ? ` ${t('common.footer.validTill', { date: fmtDate(r.validTill, lang) })}` : ''}</span>)}
      </p>
    </div>
  );
}

// onConsentChoice(choice): forwarded to the cookie banner (consent ledger for signed-in users).
export default function PublicLayout({ account, settings, settingsReady = true, city = null, cityPicker = null, shortlist = null, onConsentChoice }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const s = settings || {};
  const consent = s.consent || {};
  const LINKS = navLinks(city, t);
  const bannerOn = consent.bannerEnabled !== false;
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label={t('common.nav.main')}>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cn('text-sm font-medium', isActive ? 'text-brand-700' : 'text-ink-muted hover:text-ink')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher className="mr-1" />
            {cityPicker && <div className="hidden lg:block">{cityPicker}</div>}
            {shortlist}
            {account || (
              <>
                <Button variant="ghost" to="/login">{t('common.header.login')}</Button>
                <Button to="/register">{t('common.header.signup')}</Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 md:hidden">
            {shortlist}
            <button type="button" className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken" onClick={() => setOpen((o) => !o)} aria-label={open ? t('common.nav.closeMenu') : t('common.nav.openMenu')} aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t bg-white px-4 py-3 md:hidden">
            <LanguageSwitcher className="mb-2" />
            {cityPicker && <div className="mb-2">{cityPicker}</div>}
            <nav className="flex flex-col gap-1" aria-label={t('common.nav.mobile')}>
              {LINKS.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted">{l.label}</Link>)}
            </nav>
            <div className="mt-3 flex gap-2" onClick={() => setOpen(false)}>
              {account || (<><Button variant="secondary" to="/login" block>{t('common.header.login')}</Button><Button to="/register" block>{t('common.header.signup')}</Button></>)}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t bg-brand-900 text-sm text-brand-100">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo inverse />
            <p className="text-brand-200">{t('common.footer.tagline')}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">{t('common.footer.explore')}</p>
            <ul className="space-y-1.5">{LINKS.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-white">{l.label}</Link></li>)}</ul>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">{t('common.footer.company')}</p>
            <ul className="space-y-1.5">
              {CMS_LINKS.map(([slug, label]) => (
                <li key={slug}><Link to={`/p/${slug}`} className="hover:text-white">{t(label)}</Link></li>
              ))}
              <li><Link to="/contact" className="hover:text-white">{t('common.footer.contact')}</Link></li>
              {bannerOn && <li><button type="button" onClick={openCookieSettings} className="hover:text-white">{t('common.footer.cookieSettings')}</button></li>}
            </ul>
          </div>
          <FooterContact settings={s} />
        </div>
        <AgentRegistrations list={s.rera && s.rera.agentRegistrations} />
        <div className="border-t border-brand-800 py-4 text-center text-xs text-brand-300">{t('common.footer.rights', { year: new Date().getFullYear(), company: s.companyName || env.appName })}</div>
      </footer>
      <CookieBanner ready={settingsReady} enabled={bannerOn} cookieDays={consent.cookieDays} ga4Id={consent.ga4MeasurementId} onChoice={onConsentChoice} />
    </div>
  );
}
