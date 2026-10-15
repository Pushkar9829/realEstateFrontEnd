// Module G - Builder Projects: API calls and query hooks.
// Endpoints: backend/src/modules/projects/routes/{lister,admin,public}.routes.js
// Configuration prices are sent in rupees and read back in paise.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, http } from '@/shared/lib/api';
import { useCount } from '@/shared/hooks/useCount';

export const PROJECT_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_approval: { label: 'Pending approval', tone: 'info' },
  changes_requested: { label: 'Changes requested', tone: 'warning' },
  live: { label: 'Live', tone: 'success' },
  sold_out: { label: 'Sold out', tone: 'brand' },
  rejected: { label: 'Rejected', tone: 'danger' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};
export const projectStatus = (s) => PROJECT_STATUS[s] || { label: s, tone: 'neutral' };

export const PROJECT_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'location', label: 'Location' },
  { key: 'configurations', label: 'Configurations' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'rera', label: 'RERA' },
  { key: 'media', label: 'Photos' },
  { key: 'commission', label: 'Commission' },
  { key: 'units', label: 'Units and inventory' },
];

export const RERA_WARNINGS = { rera_number_format: 'Number does not match the state format', rera_url_host: 'Link is not on the official RERA site', rera_url_invalid: 'Link is not a valid URL', rera_number_reused: 'Number is used by another builder' };
export const reraWarning = (w) => { const [code, num] = String(w).split(':'); return `${RERA_WARNINGS[code] || code}${num ? ` (${num})` : ''}`; };

export const useOwnProjectCount = (enabled) => useCount('/lister/projects', {}, { enabled });
export const useProjectQueueCount = (enabled) => useCount('/admin/projects', {}, { enabled });

// ---------------------------------------------------------------- lister

export const useOwnProjects = (params) => useQuery({ queryKey: ['lister', 'projects', params], queryFn: () => api.page('/lister/projects', params) });
export const useProject = (id) => useQuery({ queryKey: ['lister', 'project', id], queryFn: () => api.get(`/lister/projects/${id}`), enabled: Boolean(id) });
export const useUnits = (id, params) => useQuery({ queryKey: ['lister', 'project', id, 'units', params], queryFn: () => api.page(`/lister/projects/${id}/units`, params), enabled: Boolean(id) });

function useProjectMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lister', 'project', id] });
      qc.invalidateQueries({ queryKey: ['lister', 'projects'] });
      qc.invalidateQueries({ queryKey: ['count', '/lister/projects'] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => api.post('/lister/projects', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['lister', 'projects'] }) });
}
export const useSaveProjectTab = (id) => useProjectMutation(id, ({ tab, body }) => api.patch(`/lister/projects/${id}/steps/${tab}`, body));
export const useAddProjectMedia = (id) => useProjectMutation(id, (body) => api.post(`/lister/projects/${id}/media`, body));
export const useProjectCommission = (id) => useProjectMutation(id, (body) => api.post(`/lister/projects/${id}/commission`, body));
export const useSubmitProject = (id) => useProjectMutation(id, () => api.post(`/lister/projects/${id}/submit`));
export const useUpdateInventory = (id) => useProjectMutation(id, (body) => api.patch(`/lister/projects/${id}/inventory`, body));
export const usePreviewUnits = (id) => useMutation({ mutationFn: (body) => api.post(`/lister/projects/${id}/units/import`, body) });
export const useConfirmUnits = (id) => useProjectMutation(id, (importId) => api.post(`/lister/projects/${id}/units/import/${importId}/confirm`));

export async function downloadUnitsTemplate(id) {
  const res = await http.get(`/lister/projects/${id}/units/template`, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a'); a.href = href; a.download = 'units-template.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

// What the API will ask for on submit (mirrors projects/service.js submit).
export function projectMissing(p) {
  if (!p) return [];
  const out = [];
  if (!p.description) out.push(['details', 'Project details']);
  if (!p.location || !p.location.geo) out.push(['location', 'Location and map pin']);
  if (!(p.configurations || []).length) out.push(['configurations', 'At least one configuration']);
  const r = p.rera || {};
  if (!((r.registrations || []).length || (r.exempt && r.exempt.reason))) out.push(['rera', 'RERA registration or exemption']);
  if (!p.activeAgreementId) out.push(['commission', 'Project commission agreement']);
  return out;
}

// ---------------------------------------------------------------- admin

export const useProjectQueue = (params) => useQuery({ queryKey: ['admin', 'projects', params], queryFn: () => api.page('/admin/projects', params) });
export const useAdminProject = (id) => useQuery({ queryKey: ['admin', 'project', id], queryFn: () => api.get(`/admin/projects/${id}`) });

function useAdminProjectMutation(id, fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'project', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/projects'] });
    },
  });
}
export const useClaimProject = (id) => useAdminProjectMutation(id, () => api.post(`/admin/projects/${id}/claim`));
export const useDecideProject = (id) => useAdminProjectMutation(id, (body) => api.post(`/admin/projects/${id}/decision`, body));
export const useAdminProjectAction = (id) => useAdminProjectMutation(id, (body) => api.patch(`/admin/projects/${id}`, body));
