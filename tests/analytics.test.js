// RE-L-11 funnel analytics: nothing is sent before consent or without GA4,
// and only allow-listed, non-personal parameters reach gtag.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { filtersSummary, sanitize, track } from '@/shared/lib/analytics';

const consent = (choice) => localStorage.setItem('pd.consent', JSON.stringify({ choice, at: Date.now(), until: Date.now() + 86400000 }));

describe('track()', () => {
  beforeEach(() => { window.gtag = vi.fn(); });
  afterEach(() => { delete window.gtag; document.cookie = 'pd_consent=; Max-Age=0; Path=/'; });

  test('sends nothing before "Accept analytics"', () => {
    expect(track('property_view', { listingNo: 'PD-1' })).toBe(false);
    consent('essential');
    expect(track('property_view', { listingNo: 'PD-1' })).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
  });

  test('sends only non-personal, allow-listed parameters after consent', () => {
    consent('analytics');
    expect(track('enquiry_submit', { type: 'visit', listingNo: 'PD-12', city: 'pune', name: 'Asha', phone: '9876543210', email: 'a@b.com', addressLine: 'Flat 5' })).toBe(true);
    expect(window.gtag).toHaveBeenCalledWith('event', 'enquiry_submit', { enquiry_type: 'visit', listing_no: 'PD-12', city: 'pune' });
  });

  test('without the GA4 script nothing breaks', () => {
    consent('analytics');
    delete window.gtag;
    expect(track('search', {})).toBe(false);
  });
});

describe('sanitize() and filtersSummary()', () => {
  test('drops values that look like an email or a phone number', () => {
    expect(sanitize({ source: 'me@x.in', city: '+91 98765 43210', purpose: 'rent' })).toEqual({ purpose: 'rent' });
  });
  test('summarises filters without free text or exact budgets', () => {
    expect(filtersSummary({ purpose: 'sale', bhk: [2, 3], minPrice: 5000000, keyword: 'near my office', page: 2 })).toBe('purpose:sale|bhk:2,3|minPrice:yes|keyword:yes');
  });
});
