// Per-page SEO meta for the SPA (RE-L-09): <title>, description, canonical,
// robots and Open Graph / Twitter tags. The tags are created once in <head>
// and updated on every change; on unmount the title and description go back
// to the index.html defaults so a page never leaks its meta to the next one.
//   useDocumentMeta({ title, description, path: '/property/x', image, type: 'article' })
import { useEffect } from 'react';
import env from '@/config/env';

const DEFAULT_TITLE = `${env.appName} - Verified, broker-free property`;
const DEFAULT_DESC = 'Broker-free property marketplace: verified owners, builders and landlords.';

const clip = (s, n) => { const v = String(s || '').replace(/\s+/g, ' ').trim(); return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v; };

function tag(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  return el;
}
function setMeta(attr, key, content) {
  const el = tag(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; });
  if (content) el.setAttribute('content', content); else el.remove();
}
function setCanonical(href) {
  const el = tag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; });
  if (href) el.setAttribute('href', href); else el.remove();
}

// Absolute URL on this site for `path` ('/property/x' or a full URL); query strings are kept only when asked.
export function absoluteUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  try { return new URL(path, window.location.origin).toString(); } catch { return ''; }
}

/**
 * title: page title (the app name is appended); description: plain text, clipped to 160 chars;
 * path: canonical path (defaults to the current path without the query); image: absolute og:image;
 * type: og:type ('website' | 'article'); noindex: true for pages that must not be indexed.
 */
export default function useDocumentMeta({ title, description, path, image, type = 'website', noindex = false } = {}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const fullTitle = title ? `${clip(title, 70)} | ${env.appName}` : DEFAULT_TITLE;
    const desc = clip(description || DEFAULT_DESC, 160);
    const canonical = absoluteUrl(path || window.location.pathname);
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : '');
    setCanonical(noindex ? '' : canonical);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:site_name', env.appName);
    setMeta('property', 'og:image', image && /^https?:\/\//i.test(image) ? image : '');
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('name', 'description', DEFAULT_DESC);
      setMeta('name', 'robots', '');
    };
  }, [title, description, path, image, type, noindex]);
}
