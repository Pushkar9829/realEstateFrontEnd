// Module C - Lead management, public and buyer side: guest phone OTP,
// enquiries, contact form, requirement ("request a property"), my enquiries,
// visit actions, token links and post-visit feedback.
// Endpoints: backend/src/modules/leads/routes/public.routes.js and
// search/routes/public.routes.js (POST /leads/requirement).
// Budgets in request bodies are rupees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { referralField } from '@/modules/search/prefs';

// ---------------------------------------------------------------- phone rules (RE-M-01)

export const INDIAN_MOBILE = /^[6-9][0-9]{9}$/;
export const INTL_PHONE = /^\+[1-9][0-9]{7,14}$/;
export const NAME_RX = /^[\p{L} .'-]{2,60}$/u;

// "98765 43210", "+91 98765-43210" -> "9876543210"; international numbers keep their "+".
export function normalisePhone(v) {
  const s = String(v || '').replace(/[\s()-]/g, '');
  const indian = s.replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, '');
  if (INDIAN_MOBILE.test(indian)) return indian;
  return s;
}
export const isIndian = (v) => INDIAN_MOBILE.test(normalisePhone(v));
export const phoneError = (v) => {
  const p = normalisePhone(v);
  if (!p) return 'Enter your mobile number';
  return INDIAN_MOBILE.test(p) || (INTL_PHONE.test(p) && !p.startsWith('+91')) ? null : 'Enter a 10-digit Indian mobile or an international number starting with +';
};

// ---------------------------------------------------------------- guest OTP -> otpToken (10 min)

export const sendGuestOtp = ({ phone, email }) => api.post('/leads/otp', { phone: normalisePhone(phone), ...(email ? { email } : {}) });
export const verifyGuestOtp = ({ phone, code }) => api.post('/leads/otp/verify', { phone: normalisePhone(phone), code });

// ---------------------------------------------------------------- enquiry (RE-S-PUB-06)

export const ENQUIRY_TYPES = [
  { value: 'enquiry', label: 'Contact', action: 'contact' },
  { value: 'callback', label: 'Call-back', action: 'callback' },
  { value: 'site_visit', label: 'Site visit', action: 'visit' },
  { value: 'best_price', label: 'Best price', action: 'price' },
];
export const typeForAction = (a) => (ENQUIRY_TYPES.find((t) => t.action === a) || ENQUIRY_TYPES[0]).value;

export const CALLBACK_WINDOWS = [
  { value: 'anytime', label: 'Anytime' }, { value: 'morning', label: 'Morning 9-12' }, { value: 'afternoon', label: 'Afternoon 12-4' }, { value: 'evening', label: 'Evening 4-8' },
];
export const TIMELINES = [
  { value: 'immediate', label: 'Immediately' }, { value: '1_3_months', label: 'In 1-3 months' }, { value: '3_6_months', label: 'In 3-6 months' }, { value: 'later', label: 'Later' },
];

// body: { type, propertyId | projectId, unitConfigId?, name?, email?, phone?, otpToken?, message?, preferredSlot?, consent: true, whatsappOptIn?,
//         callbackWindow? (CALLBACK_WINDOWS), visitors? (1-10), pickupNeeded?, budgetMax? (rupees), timeline? (TIMELINES), loanNeeded? }
// -> { leadNo, merged, visitNo? }
export const useCreateEnquiry = () => useMutation({ mutationFn: (body) => api.post('/leads/enquiry', body) });

// -> { leadNo }
export const useContactForm = () => useMutation({ mutationFn: (body) => api.post('/contact', { ...referralField(), ...body }) });

// body: { purpose, city, localities[], category?, types[], bhk[] (numbers), budgetMin?, budgetMax?, timeline?, loanNeeded?, notes?, name?, phone?, email?, otpToken?, consent: true, alertMe? }
// -> { leadNo, merged, savedSearchId? }
export const useRequestProperty = () => useMutation({ mutationFn: (body) => api.post('/leads/requirement', { ...referralField(), ...body }) });

// Free / unavailable 30-minute visit slots: [{ date: 'YYYY-MM-DD', slots: [{ at, free }] }]
export const useVisitSlots = (propertyId, days = 14) => useQuery({
  queryKey: ['public', 'visit-slots', propertyId, days],
  queryFn: () => api.get(`/properties/${propertyId}/visit-slots`, { days }),
  enabled: Boolean(propertyId),
  staleTime: 60_000,
});

// ---------------------------------------------------------------- my enquiries (buyer)

export const JOURNEY = ['Received', 'In touch', 'Visit scheduled', 'Visited', 'Negotiating', 'Booked'];
export const VISIT_STATUS = {
  requested: { label: 'Requested', tone: 'info' }, scheduled: { label: 'Scheduled - please confirm', tone: 'warning' }, confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'brand' }, cancelled: { label: 'Cancelled', tone: 'neutral' }, no_show: { label: 'Missed', tone: 'danger' }, rescheduled: { label: 'Rescheduled', tone: 'info' },
};
export const visitStatus = (s) => VISIT_STATUS[s] || { label: String(s || '').replace(/_/g, ' '), tone: 'neutral' };

export const enquiryKeys = { list: ['me', 'enquiries'], one: (id) => ['me', 'enquiry', id] };
export const useMyEnquiries = (enabled = true) => useQuery({ queryKey: enquiryKeys.list, queryFn: () => api.get('/me/enquiries'), enabled });
export const useMyEnquiry = (id) => useQuery({ queryKey: enquiryKeys.one(id), queryFn: () => api.get(`/me/enquiries/${id}`), enabled: Boolean(id) });

// action: confirm | cancel ({ reason }) | reschedule ({ note })
export function useVisitAction(leadId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }) => api.post(`/me/site-visits/${id}/${action === 'reschedule' ? 'reschedule-request' : action}`, body || {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: enquiryKeys.one(leadId) });
      qc.invalidateQueries({ queryKey: enquiryKeys.list });
    },
  });
}

// ---------------------------------------------------------------- token links (no login)

// GET /site-visits/respond/:token[?action=confirm|cancel|change&note=] -> visit summary (+ result when an action ran)
export const visitByToken = (token, params) => api.get(`/site-visits/respond/${token}`, params);
export const useVisitToken = (token) => useQuery({ queryKey: ['public', 'visit-token', token], queryFn: () => visitByToken(token), enabled: Boolean(token), retry: false });
export function useVisitTokenAction(token) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (params) => visitByToken(token, params), onSuccess: (data) => qc.setQueryData(['public', 'visit-token', token], data) });
}

export const FEEDBACK_CHIPS = ['price', 'location', 'size', 'condition', 'amenities', 'other'];
export const useFeedbackForm = (token) => useQuery({ queryKey: ['public', 'feedback', token], queryFn: () => api.get(`/site-visits/feedback/${token}`), enabled: Boolean(token), retry: false });
// body: { interest 1-5, likes[], dislikes[], comments?, secondVisit, callBack }
export const useSubmitFeedback = (token) => useMutation({ mutationFn: (body) => api.post(`/site-visits/feedback/${token}`, body) });
