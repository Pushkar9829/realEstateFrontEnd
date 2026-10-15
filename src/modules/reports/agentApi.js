// Module O - Reports: the agent's own KPIs (RE-O-03).
// Endpoint: GET /api/agent/performance?from&to (backend/src/modules/reports/routes/agent.routes.js).
// Commission is paise and counts verified deals only.
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const useAgentPerformance = (params, enabled = true) => useQuery({
  queryKey: ['agent', 'performance', params],
  queryFn: () => api.get('/agent/performance', params),
  placeholderData: (prev) => prev,
  enabled,
});

// Date range presets (IST calendar days, sent as ISO strings).
export function presetRange(key, now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const day = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd) - 330 * 60000);
  if (key === 'last_month') return { from: day(y, m - 1, 1), to: new Date(day(y, m, 1).getTime() - 1) };
  if (key === 'last_30') return { from: new Date(now.getTime() - 30 * 86400000), to: now };
  if (key === 'last_90') return { from: new Date(now.getTime() - 90 * 86400000), to: now };
  if (key === 'this_year') return { from: day(y, 0, 1), to: now };
  return { from: day(y, m, 1), to: now }; // this month
}
