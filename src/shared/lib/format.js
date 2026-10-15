// Money is stored by the API in integer paise; dates are UTC and shown in IST.
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

const dt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
const dtt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const date = (v) => (v ? dt.format(new Date(v)) : '-');
export const dateTime = (v) => (v ? dtt.format(new Date(v)) : '-');

export function timeAgo(v) {
  if (!v) return '-';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (s >= n) { const k = Math.floor(s / n); return `${k} ${u}${k > 1 ? 's' : ''} ago`; }
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
export const sinceText = (v) => timeAgo(v).replace(/ ago$/, '');
