// Module C - lister side: masked leads ("Buyer N"), visits on own listings,
// shared updates, visit availability and the offers inbox.
// Endpoints: backend/src/modules/leads/routes/lister.routes.js
// Money comes back in paise; request bodies take rupees.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));

export const OFFER_STATUS = toned('lister.offers.status', {
  awaiting_lister: 'warning',
  awaiting_buyer: 'info',
  accepted: 'success',
  declined: 'danger',
  withdrawn: 'neutral',
  expired: 'neutral',
});
export const offerStatus = (s) => OFFER_STATUS[s] || { label: s, tone: 'neutral' };

export const VISIT_STATUS = toned('lister.leads.visitStatus', {
  requested: 'neutral',
  scheduled: 'info',
  confirmed: 'brand',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'warning',
});
export const visitStatus = (s) => VISIT_STATUS[s] || { label: s, tone: 'neutral' };

export const listerLeadKeys = {
  leads: (p) => ['lister', 'leads', p],
  visits: (p) => ['lister', 'visits', p],
  activity: (p) => ['lister', 'activity', p],
  availability: (p) => ['lister', 'availability', p],
  offers: (p) => ['lister', 'offers', p],
  offer: (id) => ['lister', 'offer', id],
};

// ---------------------------------------------------------------- leads, visits, activity

// { items: [{ id, buyer, status, property, createdAt, lastActivityAt, visits, visitsDone }], funnel: [{ stage, stages, label, count }] }
// Funnel labels are distinct: stages sharing a simplified label are merged on the server.
export const useListerLeads = (params = {}) => useQuery({ queryKey: listerLeadKeys.leads(params), queryFn: () => api.get('/lister/leads', params) });
// params: { propertyId?, upcoming?, from?, to? } (filtered on the server)
// { items: [{ id, visitNo, buyer, property, scheduledAt, status, outcome?, lastReschedule? }], feedback: [{ property, averageInterest, responses }] }
export const useListerVisits = (params = {}) => useQuery({ queryKey: listerLeadKeys.visits(params), queryFn: () => api.get('/lister/visits', params) });
// [{ id, property, buyer, text, tag, amount, response, respondedAt, createdAt }]
// params: { propertyId?, from?, to? } (filtered on the server)
export const useListerActivity = (params = {}) => useQuery({ queryKey: listerLeadKeys.activity(params), queryFn: () => api.get('/lister/activity', params) });

export function useRespondUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }) => api.post(`/lister/activity/${id}/respond`, { response }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lister', 'activity'] }),
  });
}

// ---------------------------------------------------------------- availability (RE-S-LIS-17)

// scope: { scope: 'account' | 'property' | 'project', scopeId? }
export const useAvailability = (scope) => useQuery({ queryKey: listerLeadKeys.availability(scope), queryFn: () => api.get('/lister/availability', scope) });

function useAvailabilityMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['lister', 'availability'] }) });
}
// body: { scope, scopeId?, weekly: [{ day 0-6 (Sun=0), start 'HH:MM', end 'HH:MM' }], noticeHours, note? }
export const useSaveWeekly = () => useAvailabilityMutation((body) => api.put('/lister/availability', body));
// body: { scope, scopeId?, from, to, reason? }
export const useAddBlackout = () => useAvailabilityMutation((body) => api.post('/lister/availability/blackouts', body));
// Blackouts are addressed by their stable _id.
export const useRemoveBlackout = () => useAvailabilityMutation(({ id }) => api.del(`/lister/availability/blackouts/${id}`));

// ---------------------------------------------------------------- offers (RE-S-LIS-18)

export const useListerOffers = (params = {}) => useQuery({ queryKey: listerLeadKeys.offers(params), queryFn: () => api.get('/lister/offers', params) });
export const useListerOffer = (id) => useQuery({ queryKey: listerLeadKeys.offer(id), queryFn: () => api.get(`/lister/offers/${id}`), enabled: Boolean(id) });
export const useOffersAwaitingCount = () => useQuery({ queryKey: listerLeadKeys.offers({ status: 'awaiting_lister' }), queryFn: () => api.get('/lister/offers', { status: 'awaiting_lister' }), select: (rows) => rows.length });

// body: { action: accept | counter | decline, amount? (rupees, counter), note?, reason? (decline) }
export function useRespondOffer(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/lister/offers/${id}/respond`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listerLeadKeys.offer(id) });
      qc.invalidateQueries({ queryKey: ['lister', 'offers'] });
      qc.invalidateQueries({ queryKey: ['lister', 'dashboard'] });
    },
  });
}

// Latest round of an offer (the amount on the table).
export const lastRound = (o) => (o && o.rounds && o.rounds.length ? o.rounds[o.rounds.length - 1] : null);

// "3 days left" / "5 h left" / "expired" for an offer's validUntil.
export function timeLeft(v) {
  if (!v) return null;
  const ms = new Date(v).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return t('lister.offers.daysLeft', { n: Math.floor(h / 24) });
  if (h >= 1) return t('lister.offers.hoursLeft', { n: h });
  return t('lister.offers.minutesLeft', { n: Math.max(1, Math.floor(ms / 60000)) });
}
