// Module J - Teams & Territory Management: teams, members, routing rules and
// the routing simulator (RE-S-ADM-14, 15). Staff lookups use /admin/staff
// (staff.manage). Endpoints: backend/src/modules/teams/routes/admin.routes.js
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters).
export const TEAM_MODES = ['round_robin', 'least_open_leads'].map((value) => ({ value, get label() { return t(`admin.enum.teamMode.${value}`); } }));
export const modeLabel = (m) => (TEAM_MODES.find((x) => x.value === m) || { label: m || t('admin.enum.teamMode.inherit') }).label;
// Short day names, Sunday first (index = Date#getDay()).
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const WEEKDAYS = DAY_KEYS.reduce((a, k, i) => Object.defineProperty(a, i, { get: () => t(`admin.enum.weekday.${k}`), enumerable: true }), new Array(7));
export const LISTER_TYPES = ['owner', 'builder', 'landlord'];

export const teamKeys = {
  list: ['admin', 'teams'],
  rules: ['admin', 'routing-rules'],
  staff: (p) => ['admin', 'staff', p],
};

// ---------------------------------------------------------------- teams

export const useTeams = () => useQuery({ queryKey: teamKeys.list, queryFn: () => api.get('/admin/teams'), staleTime: 30_000 });

function useTeamMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list });
      qc.invalidateQueries({ queryKey: teamKeys.rules });
    },
  });
}

export const useCreateTeam = () => useTeamMutation((body) => api.post('/admin/teams', body));
export const useEditTeam = () => useTeamMutation(({ id, body }) => api.patch(`/admin/teams/${id}`, body));
export const useDeleteTeam = () => useTeamMutation((id) => api.del(`/admin/teams/${id}`));
export const usePatchMember = () => useTeamMutation(({ teamId, agentId, body }) => api.patch(`/admin/teams/${teamId}/members/${agentId}`, body));

// Agents the current user can assign leads to: members of the teams the API
// returns (every team for admins, own teams for managers).
export function useAgentOptions() {
  const teams = useTeams();
  const agents = useMemo(() => (teams.data || []).flatMap((t) => (t.members || []).filter((m) => m.agentId && m.agentId._id).map((m) => ({
    agentId: m.agentId._id, name: m.agentId.name, team: t.name, teamId: t._id, openLeads: m.openLeads || 0, capacity: m.capacity, available: m.available !== false,
    status: m.agentId.status,
  }))), [teams.data]);
  const options = useMemo(() => agents.map((a) => ({
    value: a.agentId, label: `${a.name} · ${a.team} · ${a.openLeads}/${a.capacity}${a.available ? '' : ` · ${t('admin.enum.agentAway')}`}`,
  })), [agents]);
  return { agents, options, isLoading: teams.isLoading, error: teams.error };
}

// ---------------------------------------------------------------- staff lookup (staff.manage)

export const useStaff = (params, { enabled = true } = {}) => useQuery({
  queryKey: teamKeys.staff(params), queryFn: () => api.page('/admin/staff', { limit: 100, ...params }), enabled, staleTime: 60_000,
});

// ---------------------------------------------------------------- routing rules

export const useRoutingRules = () => useQuery({ queryKey: teamKeys.rules, queryFn: () => api.get('/admin/routing-rules') });

function useRuleMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.rules }) });
}

export const useCreateRule = () => useRuleMutation((body) => api.post('/admin/routing-rules', body));
export const useEditRule = () => useRuleMutation(({ id, body }) => api.patch(`/admin/routing-rules/${id}`, body));
export const useDeleteRule = () => useRuleMutation((id) => api.del(`/admin/routing-rules/${id}`));
export function useReorderRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => api.patch('/admin/routing-rules/reorder', { ids }),
    onSuccess: (rules) => qc.setQueryData(teamKeys.rules, rules),
  });
}
export const useSimulateRouting = () => useMutation({ mutationFn: (body) => api.post('/admin/routing-rules/simulate', body) });
