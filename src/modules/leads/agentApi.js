// Module C (plus the agent-panel pieces of B masking, D verification visits,
// F seeker flags and J availability): agent API calls and query hooks.
// Endpoints: backend/src/modules/{leads,masking,kyc,approvals,teams}/routes/agent.routes.js
// Money: request bodies take rupees; the API answers in paise. Lead
// requirement budgets (requirement.budgetMin / budgetMax) are plain rupees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';
import { number } from '@/shared/lib/format';

// ---------------------------------------------------------------- labels
// Labels are getters that call t() when read, so they follow the chosen
// language (agent.* keys in shared/i18n/locales/<lang>/agent.js).

// { value, label (getter), ...extra } for option lists.
const opt = (value, key, extra) => Object.defineProperty({ value, ...extra }, 'label', { get: () => t(key), enumerable: true });
// { [value]: label (getter) } maps.
const labelMap = (prefix, values) => Object.defineProperties({}, Object.fromEntries(values.map((v) => [v, { get: () => t(`${prefix}.${v}`), enumerable: true }])));
// { [value]: { label (getter), tone } } maps.
const toneMap = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([v, tone]) => [v, Object.defineProperty({ tone }, 'label', { get: () => t(`${prefix}.${v}`), enumerable: true })]));

export const STAGES = [
  opt('new', 'agent.stage.new', { tone: 'info' }),
  opt('contacted', 'agent.stage.contacted', { tone: 'brand' }),
  opt('qualified', 'agent.stage.qualified', { tone: 'brand' }),
  opt('site_visit_scheduled', 'agent.stage.site_visit_scheduled', { tone: 'accent' }),
  opt('site_visit_done', 'agent.stage.site_visit_done', { tone: 'accent' }),
  opt('negotiation', 'agent.stage.negotiation', { tone: 'warning' }),
  opt('booking', 'agent.stage.booking', { tone: 'success' }),
  opt('closed_won', 'agent.stage.closed_won', { tone: 'success' }),
  opt('closed_lost', 'agent.stage.closed_lost', { tone: 'danger' }),
];
export const OPEN_STAGES = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booking'];
export const STAGE_ORDER = [...OPEN_STAGES, 'closed_won'];
export const stageInfo = (s) => STAGES.find((x) => x.value === s) || { value: s, label: s, tone: 'neutral' };
// Moving to an earlier stage needs a note and may only go back to contacted / qualified.
export const isBackMove = (from, to) => to !== 'closed_lost' && STAGE_ORDER.indexOf(to) < STAGE_ORDER.indexOf(from);

export const PRIORITIES = [
  opt('hot', 'agent.priority.hot', { tone: 'danger' }),
  opt('warm', 'agent.priority.warm', { tone: 'warning' }),
  opt('cold', 'agent.priority.cold', { tone: 'info' }),
];
export const priorityInfo = (p) => PRIORITIES.find((x) => x.value === p) || { value: p, label: p || '-', tone: 'neutral' };

export const LOST_REASONS = ['not_responding', 'budget_mismatch', 'bought_elsewhere', 'not_interested', 'duplicate', 'spam', 'property_sold', 'other']
  .map((v) => opt(v, `agent.lostReason.${v}`));

export const CALL_OUTCOMES = ['connected', 'no_answer', 'busy', 'switched_off', 'wrong_number', 'call_back_later']
  .map((v) => opt(v, `agent.callOutcome.${v}`));

export const FOLLOWUP_TYPES = ['call', 'whatsapp', 'meeting', 'email', 'other'].map((v) => opt(v, `agent.followupType.${v}`));

export const SOURCES = labelMap('agent.source', ['enquiry', 'callback', 'site_visit', 'best_price', 'contact_form', 'whatsapp', 'hotline', 'walk_in', 'referral', 'requirement', 'recycled']);

export const VISIT_STATUS = toneMap('agent.visitStatus', { requested: 'info', scheduled: 'brand', confirmed: 'success', completed: 'success', no_show: 'warning', cancelled: 'neutral' });
export const visitStatus = (s) => VISIT_STATUS[s] || { label: s, tone: 'neutral' };

export const OFFER_STATUS = toneMap('agent.offerStatus', { awaiting_lister: 'info', awaiting_buyer: 'warning', accepted: 'success', declined: 'danger', withdrawn: 'neutral', expired: 'neutral' });
export const offerStatus = (s) => OFFER_STATUS[s] || { label: s, tone: 'neutral' };

export const WHATSAPP_TEMPLATES = ['share_listing', 'visit_confirmation'].map((v) => opt(v, `agent.whatsappTemplate.${v}`));

// Lead list filters (GET /agent/leads ?source&city&purpose&from&to).
export const PURPOSES = [opt('sale', 'agent.purpose.sale'), opt('rent', 'agent.purpose.rent')];

export const OBJECTIONS = ['price', 'location', 'size', 'condition', 'legal', 'other'];
export const objectionLabel = (o) => t(`agent.objection.${o}`);
export const SHARE_TAGS = ['interest', 'visit_outcome', 'negotiation', 'general'].map((v) => opt(v, `agent.shareTag.${v}`));

export const VERIFICATION_CHECKLIST = ['existsAtPin', 'matchesPhotos', 'matchesDetails', 'ownerPresentWithId', 'noBrokerBoard']
  .map((key) => Object.defineProperty({ key }, 'label', { get: () => t(`agent.verification.check.${key}`), enumerable: true }));
export const VERIFICATION_STATUS = toneMap('agent.verificationStatus', { requested: 'info', scheduled: 'brand', verified: 'success', not_verified: 'danger', lister_absent: 'warning', cancelled: 'neutral' });

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

export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || t('agent.common.buyer');
export const leadPrice = (p) => (p ? (p.purpose === 'rent' ? p.price && p.price.monthlyRent : p.price && p.price.amount) : null);
export function budgetText(r) {
  if (!r || (!r.budgetMin && !r.budgetMax)) return '';
  const f = (v) => { if (v >= 1e7) return `${+(v / 1e7).toFixed(2)} Cr`; if (v >= 1e5) return `${+(v / 1e5).toFixed(2)} L`; return number(v); };
  if (r.budgetMin && r.budgetMax) return `₹${f(r.budgetMin)} - ${f(r.budgetMax)}`;
  return r.budgetMax ? t('agent.common.budgetUpTo', { amount: `₹${f(r.budgetMax)}` }) : t('agent.common.budgetFrom', { amount: `₹${f(r.budgetMin)}` });
}
