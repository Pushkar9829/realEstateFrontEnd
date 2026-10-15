// Module C (plus the agent-panel pieces of B masking, D verification visits,
// F seeker flags and J availability): agent API calls and query hooks.
// Endpoints: backend/src/modules/{leads,masking,kyc,approvals,teams}/routes/agent.routes.js
// Money: request bodies take rupees; the API answers in paise. Lead
// requirement budgets (requirement.budgetMin / budgetMax) are plain rupees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

// ---------------------------------------------------------------- labels

export const STAGES = [
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'contacted', label: 'Contacted', tone: 'brand' },
  { value: 'qualified', label: 'Qualified', tone: 'brand' },
  { value: 'site_visit_scheduled', label: 'Visit scheduled', tone: 'accent' },
  { value: 'site_visit_done', label: 'Visit done', tone: 'accent' },
  { value: 'negotiation', label: 'Negotiation', tone: 'warning' },
  { value: 'booking', label: 'Booking', tone: 'success' },
  { value: 'closed_won', label: 'Won', tone: 'success' },
  { value: 'closed_lost', label: 'Lost', tone: 'danger' },
];
export const OPEN_STAGES = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booking'];
export const STAGE_ORDER = [...OPEN_STAGES, 'closed_won'];
export const stageInfo = (s) => STAGES.find((x) => x.value === s) || { value: s, label: s, tone: 'neutral' };
// Moving to an earlier stage needs a note and may only go back to contacted / qualified.
export const isBackMove = (from, to) => to !== 'closed_lost' && STAGE_ORDER.indexOf(to) < STAGE_ORDER.indexOf(from);

export const PRIORITIES = [
  { value: 'hot', label: 'Hot', tone: 'danger' },
  { value: 'warm', label: 'Warm', tone: 'warning' },
  { value: 'cold', label: 'Cold', tone: 'info' },
];
export const priorityInfo = (p) => PRIORITIES.find((x) => x.value === p) || { value: p, label: p || '-', tone: 'neutral' };

export const LOST_REASONS = [
  { value: 'not_responding', label: 'Not responding' },
  { value: 'budget_mismatch', label: 'Budget mismatch' },
  { value: 'bought_elsewhere', label: 'Bought elsewhere' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'spam', label: 'Spam / not genuine' },
  { value: 'property_sold', label: 'Property sold' },
  { value: 'other', label: 'Other' },
];

export const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'switched_off', label: 'Switched off' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'call_back_later', label: 'Call back later' },
];

export const FOLLOWUP_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export const SOURCES = {
  enquiry: 'Enquiry', callback: 'Callback', site_visit: 'Visit request', best_price: 'Best price', contact_form: 'Contact form', whatsapp: 'WhatsApp',
  hotline: 'Hotline', walk_in: 'Walk-in', referral: 'Referral', requirement: 'Requirement', recycled: 'Recycled',
};

export const VISIT_STATUS = {
  requested: { label: 'Requested', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  no_show: { label: 'No-show', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const visitStatus = (s) => VISIT_STATUS[s] || { label: s, tone: 'neutral' };

export const OFFER_STATUS = {
  awaiting_lister: { label: 'Awaiting owner', tone: 'info' },
  awaiting_buyer: { label: 'Owner replied', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};
export const offerStatus = (s) => OFFER_STATUS[s] || { label: s, tone: 'neutral' };

export const WHATSAPP_TEMPLATES = [
  { value: 'share_listing', label: 'Share a listing' },
  { value: 'visit_confirmation', label: 'Visit confirmation' },
];

// Lead list filters (GET /agent/leads ?source&city&purpose&from&to).
export const PURPOSES = [{ value: 'sale', label: 'Buy' }, { value: 'rent', label: 'Rent' }];

export const OBJECTIONS = ['price', 'location', 'size', 'condition', 'legal', 'other'];
export const SHARE_TAGS = [
  { value: 'interest', label: 'Interest' },
  { value: 'visit_outcome', label: 'Visit outcome' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'general', label: 'General' },
];

export const VERIFICATION_CHECKLIST = [
  { key: 'existsAtPin', label: 'Property exists at the map pin' },
  { key: 'matchesPhotos', label: 'Matches the listing photos' },
  { key: 'matchesDetails', label: 'Matches the listed details (BHK, area, floor)' },
  { key: 'ownerPresentWithId', label: 'Owner present with ID' },
  { key: 'noBrokerBoard', label: 'No broker board or third-party signage' },
];
export const VERIFICATION_STATUS = {
  requested: { label: 'Requested', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  verified: { label: 'Verified', tone: 'success' },
  not_verified: { label: 'Not verified', tone: 'danger' },
  lister_absent: { label: 'Lister absent', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

// ---------------------------------------------------------------- keys and queries

export const agentKeys = {
  all: ['agent'],
  dashboard: ['agent', 'dashboard'],
  leads: (p) => ['agent', 'leads', p],
  board: ['agent', 'board'],
  lead: (id) => ['agent', 'lead', id],
  matches: (id) => ['agent', 'lead', id, 'matches'],
  followups: ['agent', 'followups'],
  visits: (p) => ['agent', 'visits', p],
  slots: (id, p) => ['agent', 'slots', id, p],
  propertySearch: (p) => ['agent', 'property-search', p],
  property: (id) => ['agent', 'property', id],
  verification: (p) => ['agent', 'verification-visits', p],
};

export const useAgentDashboard = () => useQuery({ queryKey: agentKeys.dashboard, queryFn: () => api.get('/agent/dashboard'), refetchInterval: 60_000 });
export const useAgentLeads = (params = {}, opts = {}) => useQuery({ queryKey: agentKeys.leads(params), queryFn: () => api.page('/agent/leads', params), placeholderData: (prev) => prev, ...opts });
export const useLeadBoard = () => useQuery({ queryKey: agentKeys.board, queryFn: () => api.get('/agent/leads/board') });
export const useAgentLead = (id) => useQuery({ queryKey: agentKeys.lead(id), queryFn: () => api.get(`/agent/leads/${id}`), enabled: Boolean(id), retry: (n, e) => e.status !== 403 && e.status !== 404 && n < 2 });
export const useLeadMatches = (id, enabled) => useQuery({ queryKey: agentKeys.matches(id), queryFn: () => api.get(`/agent/leads/${id}/matches`), enabled: Boolean(id && enabled) });
export const useFollowups = () => useQuery({ queryKey: agentKeys.followups, queryFn: () => api.get('/agent/followups') });
export const useVisitCalendar = (params) => useQuery({ queryKey: agentKeys.visits(params), queryFn: () => api.get('/agent/site-visits', params), placeholderData: (prev) => prev });
export const useVisitSlots = (propertyId, params) => useQuery({ queryKey: agentKeys.slots(propertyId, params), queryFn: () => api.get(`/agent/properties/${propertyId}/visit-slots`, params), enabled: Boolean(propertyId) });
export const usePropertySearch = (params, enabled = true) => useQuery({ queryKey: agentKeys.propertySearch(params), queryFn: () => api.get('/agent/properties/search', params), enabled, placeholderData: (prev) => prev });
export const useSalesSheet = (id) => useQuery({ queryKey: agentKeys.property(id), queryFn: () => api.get(`/agent/properties/${id}`), enabled: Boolean(id), retry: (n, e) => e.status !== 403 && e.status !== 404 && n < 2 });
export const useVerificationVisits = (params = {}, enabled = true) => useQuery({ queryKey: agentKeys.verification(params), queryFn: () => api.page('/agent/verification-visits', params), enabled });

// ---------------------------------------------------------------- calls (each takes one object)

export const leadApi = {
  create: (body) => api.post('/agent/leads', body),
  patch: ({ id, body }) => api.patch(`/agent/leads/${id}`, body),
  stage: ({ id, body }) => api.patch(`/agent/leads/${id}/stage`, body),
  call: ({ id, body }) => api.post(`/agent/leads/${id}/calls`, body),
  note: ({ id, text }) => api.post(`/agent/leads/${id}/notes`, { text }),
  link: ({ id, propertyId }) => api.post(`/agent/leads/${id}/properties`, { propertyId }),
  unlink: ({ id, propertyId }) => api.del(`/agent/leads/${id}/properties/${propertyId}`),
  shareUpdate: ({ id, body }) => api.post(`/agent/leads/${id}/share-update`, body),
  reassign: ({ id, reason }) => api.post(`/agent/leads/${id}/reassign-request`, { reason }),
  shareListings: ({ id, body }) => api.post(`/agent/leads/${id}/share-listings`, body),
  recordOffer: ({ id, body }) => api.post(`/agent/leads/${id}/offers`, body),
  offerRound: ({ offerId, body }) => api.post(`/agent/offers/${offerId}/rounds`, body),
  relay: ({ offerId }) => api.post(`/agent/offers/${offerId}/relay`),
  withdrawOffer: ({ offerId, note }) => api.post(`/agent/offers/${offerId}/withdraw`, note ? { note } : {}),
  seekerFlag: ({ id, note }) => api.post(`/agent/leads/${id}/seeker-flag`, { note }),
  maskedCall: ({ id }) => api.post(`/agent/leads/${id}/masked-call`),
  // RE-K-08 body: { template: share_listing | visit_confirmation, propertyId?, visitId? }; 409 WHATSAPP_DISABLED / WHATSAPP_NOT_OPTED_IN
  whatsappTemplate: ({ id, body }) => api.post(`/agent/leads/${id}/whatsapp-template`, body),
};

// Audited reveals (RE-B-10): call directly, never cache.
export const revealBuyerContact = (leadId, field = 'phone') => api.post(`/agent/leads/${leadId}/reveal-contact`, { field });
export const revealListerContact = (propertyId, field = 'phone') => api.post(`/agent/properties/${propertyId}/reveal-contact`, { field });
export const maskedCallToLister = (propertyId) => api.post(`/agent/properties/${propertyId}/masked-call`);

export const followupApi = {
  create: (body) => api.post('/agent/followups', body),
  bulk: (body) => api.post('/agent/followups/bulk', body),
  edit: ({ id, body }) => api.patch(`/agent/followups/${id}`, body),
  complete: ({ id, body }) => api.post(`/agent/followups/${id}/complete`, body),
};

export const visitApi = {
  schedule: (body) => api.post('/agent/site-visits', body),
  // body.rescheduleReason (3-300) is required when scheduledAt changes; the owner sees it.
  reschedule: ({ id, body }) => api.patch(`/agent/site-visits/${id}`, body),
  confirm: ({ id }) => api.post(`/agent/site-visits/${id}/confirm`),
  cancel: ({ id, reason }) => api.post(`/agent/site-visits/${id}/cancel`, { reason }),
  // body: { result, interest?, ..., photoFileIds?: up to 10 ids uploaded with purpose verification_photo }
  outcome: ({ id, body }) => api.post(`/agent/site-visits/${id}/outcome`, body),
};

export const verificationApi = {
  outcome: ({ id, body }) => api.post(`/agent/verification-visits/${id}/outcome`, body),
};

export const setAvailability = (body) => api.patch('/agent/availability', body);

// Any agent write refreshes every agent query (lists, board, Today, detail).
export function useAgentMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.all }) });
}

// ---------------------------------------------------------------- helpers

// Short text for a failed call: field messages first, else the API message.
export function errorText(e) {
  if (!e) return '';
  const fields = e.fieldErrors ? Object.values(e.fieldErrors) : [];
  return fields.length ? fields.join('. ') : e.message;
}

export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Buyer';
export const leadPrice = (p) => (p ? (p.purpose === 'rent' ? p.price && p.price.monthlyRent : p.price && p.price.amount) : null);
export function budgetText(r) {
  if (!r || (!r.budgetMin && !r.budgetMax)) return '';
  const f = (v) => { if (v >= 1e7) return `${+(v / 1e7).toFixed(2)} Cr`; if (v >= 1e5) return `${+(v / 1e5).toFixed(2)} L`; return Number(v).toLocaleString('en-IN'); };
  if (r.budgetMin && r.budgetMax) return `₹${f(r.budgetMin)} - ${f(r.budgetMax)}`;
  return r.budgetMax ? `Up to ₹${f(r.budgetMax)}` : `From ₹${f(r.budgetMin)}`;
}
