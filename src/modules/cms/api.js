// Module L - CMS & Masters: query hooks.
// Endpoints: backend/src/modules/cms/routes/public.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const usePage = (slug) => useQuery({ queryKey: ['cms', 'page', slug], queryFn: () => api.get(`/pages/${slug}`), retry: false });

// ---------------------------------------------------------------- admin masters (RE-L-01..04)

export const MASTER_TYPES = [
  { path: 'cities', label: 'Cities' },
  { path: 'localities', label: 'Localities' },
  { path: 'property-types', label: 'Property types' },
  { path: 'amenities', label: 'Amenities' },
  { path: 'landmark-types', label: 'Landmark types' },
  { path: 'doc-types', label: 'KYC document types' },
  { path: 'reasons', label: 'Reasons' },
];

export const useMasterList = (path, params) => useQuery({ queryKey: ['admin', 'masters', path, params], queryFn: () => api.page(`/admin/masters/${path}`, params), enabled: Boolean(path) });

function useMasterMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'masters'] }); qc.invalidateQueries({ queryKey: ['masters', 'public'] }); qc.invalidateQueries({ queryKey: ['locations'] }); } });
}
export const useCreateMaster = () => useMasterMutation(({ path, body }) => api.post(`/admin/masters/${path}`, body));
export const useEditMaster = () => useMasterMutation(({ path, id, body }) => api.patch(`/admin/masters/${path}/${id}`, body));
export const useDecideLocalityRequest = () => useMasterMutation(({ id, body }) => api.post(`/admin/masters/locality-requests/${id}/decision`, body));
