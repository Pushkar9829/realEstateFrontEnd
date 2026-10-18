// Module E - Search & Discovery: reported listings for admins (RE-E-13,
// properties.manage). Endpoints: backend/src/modules/search/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { t } from '@/shared/i18n';

// Labels are read from the dictionary when used (getters), so they follow the
// chosen language; the exported names and shapes stay the same.
const toned = (prefix, tones) => Object.fromEntries(Object.entries(tones).map(([k, tone]) => [k, { get label() { return t(`${prefix}.${k}`); }, tone }]));
const labels = (prefix, keys) => Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { get: () => t(`${prefix}.${k}`), enumerable: true }])));
const options = (prefix, values) => values.map((value) => ({ value, get label() { return t(`${prefix}.${value}`); } }));

export const REPORT_REASONS = labels('admin.enum.reportReason', ['wrong_info', 'already_sold', 'fraud', 'broker', 'duplicate', 'other']);

export const REPORT_ACTIONS = options('admin.enum.reportAction', ['dismiss', 'ask_fix', 'pause', 'take_down', 'raise_broker_flag']);

// Actions that may also raise a broker flag (sent as flag: true).
export const FLAGGABLE_ACTIONS = ['ask_fix', 'pause', 'take_down'];

export const REPORT_STATUS = toned('admin.enum.reportStatus', {
  open: 'info',
  under_review: 'warning',
  actioned: 'success',
  dismissed: 'neutral',
});

export const useListingReports = (params) => useQuery({ queryKey: ['admin', 'listing-reports', params], queryFn: () => api.page('/admin/listing-reports', params) });

export function useActionReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api.patch(`/admin/listing-reports/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'listing-reports'] });
      qc.invalidateQueries({ queryKey: ['count', '/admin/listing-reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'broker-flags'] });
    },
  });
}
