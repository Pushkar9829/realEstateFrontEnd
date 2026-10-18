// One formatter for the whole app (public site and every panel).
// Money is stored by the API in integer paise and shown as Indian rupees;
// dates are UTC and shown in IST as dd/mm/yyyy (dd/mm/yyyy, hh:mm am with time).
import { t } from '@/shared/i18n';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const rupees = (paise) => (paise == null ? '-' : inr.format(Math.round(paise / 100)));

// 8500000 rupees -> "85 L", 12500000 -> "1.25 Cr" (price tags on cards).
export function shortRupees(paise) {
  if (paise == null) return '-';
  const r = paise / 100;
  if (r >= 1e7) return `₹${+(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${+(r / 1e5).toFixed(2)} L`;
  return inr.format(Math.round(r));
}

// Plain numbers in Indian grouping: 1234567 -> "12,34,567".
const num = new Intl.NumberFormat('en-IN');
export const number = (n) => (n == null || Number.isNaN(Number(n)) ? '-' : num.format(Number(n)));

const IST = 'Asia/Kolkata';
const dt = new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: '2-digit', month: '2-digit', year: 'numeric' });
const tm = new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true });
const valid = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// "17/10/2026"
export const date = (v) => { const d = valid(v); return d ? dt.format(d) : '-'; };
// "17/10/2026, 11:02 am"
export const dateTime = (v) => { const d = valid(v); return d ? `${dt.format(d)}, ${tm.format(d)}` : '-'; };
// "11:02 am"
export const time = (v) => { const d = valid(v); return d ? tm.format(d) : '-'; };

export function timeAgo(v) {
  if (!v) return '-';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return t('common.time.justNow');
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (s >= n) { const k = Math.floor(s / n); return t('common.time.ago', { n: k, unit: t(`common.time.${u}`, { count: k }) }); }
  return '-';
}

// Words that keep their brand or acronym casing after title-casing.
const SPECIAL = {
  Whatsapp: 'WhatsApp', Sla: 'SLA', Gst: 'GST', Gstin: 'GSTIN', Tds: 'TDS', Kyc: 'KYC', Rera: 'RERA', Upi: 'UPI', Utr: 'UTR', Pdf: 'PDF', Bhk: 'BHK',
  Emi: 'EMI', Nri: 'NRI', Otp: 'OTP', Id: 'ID', Mlm: 'MLM', Nbfc: 'NBFC', Pan: 'PAN', Cgst: 'CGST', Sgst: 'SGST', Igst: 'IGST',
};
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b[A-Z][a-z]+\b/g, (w) => SPECIAL[w] || w);

// "1 lead", "3 leads"; pass the plural form when it is irregular.
export const plural = (n, one, many = `${one}s`) => `${n} ${Number(n) === 1 ? one : many}`;

// "23 minutes" (a duration), unlike timeAgo's "23 minutes ago".
export const sinceText = (v) => timeAgo(v).replace(/ (ago|पहले)$/, '');
