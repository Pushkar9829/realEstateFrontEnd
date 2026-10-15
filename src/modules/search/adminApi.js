// Module E - Search & Discovery: reported listings for admins (RE-E-13,
// properties.manage). Endpoints: backend/src/modules/search/routes/admin.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const REPORT_REASONS = {
  wrong_info: 'Wrong information',
  already_sold: 'Already sold or rented',
  fraud: 'Fraud or fake listing',
  broker: 'Lister is a broker',
  duplicate: 'Duplicate listing',
  other: 'Other',
};

export const REPORT_ACTIONS = [
  { value: 'dismiss', label: 'Dismiss (no action)' },
  { value: 'ask_fix', label: 'Ask the lister to fix' },
  { value: 'pause', label: 'Pause the listing (admin review)' },
  { value: 'take_down', label: 'Take the listing down' },
  { value: 'raise_broker_flag', label: 'Raise a broker flag on the lister' },
];

// Actions that may also raise a broker flag (sent as flag: true).
export const FLAGGABLE_ACTIONS = ['ask_fix', 'pause', 'take_down'];

export const REPORT_STATUS = {
  open: { label: 'Open', tone: 'info' },
  under_review: { label: 'Under review', tone: 'warning' },
  actioned: { label: 'Actioned', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

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
