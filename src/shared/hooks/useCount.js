import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

// Total of a paginated list endpoint (asks for one row and reads meta.total).
// Dashboards use it for counters; `enabled` skips calls the user cannot make.
export function useCount(url, params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['count', url, params],
    queryFn: () => api.page(url, { ...params, limit: 1 }).then((r) => r.meta.total || 0),
    enabled,
    staleTime: 60_000,
  });
}
