// Module L - CMS (pages, banners, FAQs, testimonials, home sections, agreement
// templates) and Module K notification templates: admin hooks (RE-S-ADM-25, 26).
// Endpoints: backend/src/modules/cms/routes/admin.routes.js and
// backend/src/modules/notifications/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// CRUD collections under /api/admin/<path> (list is paginated).
// Labels are read from the dictionary when used (getters).
const kind = (path) => ({ path, get label() { return t(`admin.enum.cmsKind.${path}`); } });
export const CMS_KINDS = {
  pages: kind('pages'),
  banners: kind('banners'),
  faqs: kind('faqs'),
  testimonials: kind('testimonials'),
};

export const useCmsList = (kind, params) => useQuery({ queryKey: ['admin', 'cms', kind, params], queryFn: () => api.page(`/admin/${CMS_KINDS[kind].path}`, params), enabled: Boolean(CMS_KINDS[kind]) });
export const useCmsItem = (kind, id) => useQuery({ queryKey: ['admin', 'cms', kind, 'one', id], queryFn: () => api.get(`/admin/${CMS_KINDS[kind].path}/${id}`), enabled: Boolean(id) });

function useCmsMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cms'] }) });
}
export const useCmsCreate = (kind) => useCmsMutation((body) => api.post(`/admin/${CMS_KINDS[kind].path}`, body));
export const useCmsUpdate = (kind) => useCmsMutation(({ id, body }) => api.patch(`/admin/${CMS_KINDS[kind].path}/${id}`, body));

// ---------------------------------------------------------------- home sections

export const HOME_SECTIONS = ['search', 'featured_properties', 'projects', 'localities', 'how_it_works', 'testimonials', 'faqs', 'banners'];
// Current order comes from the public home endpoint (GET /api/home -> { sections }).
export const useHomeSections = () => useQuery({ queryKey: ['admin', 'cms', 'home-sections'], queryFn: () => api.get('/home').then((d) => (d && d.sections) || []) });
export const useSetHomeSections = () => useCmsMutation((sections) => api.patch('/admin/home-sections', { sections }));

// ---------------------------------------------------------------- agreement templates

export const TEMPLATE_PURPOSES = ['sale', 'rent', 'project'];
export const TEMPLATE_PLACEHOLDERS = ['{{listerName}}', '{{propertyTitle}}', '{{listingId}}', '{{commissionPercent}}', '{{basis}}', '{{date}}', '{{nonCircumventionMonths}}'];
export const useAgreementTemplates = (params) => useQuery({ queryKey: ['admin', 'cms', 'agreement-templates', params], queryFn: () => api.page('/admin/agreement-templates', params) });
export const useCreateTemplate = () => useCmsMutation((body) => api.post('/admin/agreement-templates', body));
export const usePublishTemplate = () => useCmsMutation((id) => api.post(`/admin/agreement-templates/${id}/publish`));

// ---------------------------------------------------------------- notification templates (templates.manage)

export const useNotificationTemplates = (enabled = true) => useQuery({ queryKey: ['admin', 'notification-templates'], queryFn: () => api.get('/admin/notification-templates'), enabled });
export function useEditNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ key, channel, body }) => api.patch(`/admin/notification-templates/${key}/${channel}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-templates'] }) });
}
export const useTestNotificationTemplate = () => useMutation({ mutationFn: ({ key, channel }) => api.post(`/admin/notification-templates/${key}/${channel}/test`) });
