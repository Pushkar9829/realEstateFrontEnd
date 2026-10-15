import ComingSoon from '@/shared/components/ComingSoon';
import { RequireBuilder, RequirePermission } from '@/app/guards';
import { placeholders } from './panelNav';

// Route objects for screens planned in later phases, guarded like the real ones.
export function placeholderRoutes(nav, base) {
  return placeholders(nav, base).map((p) => {
    let el = <ComingSoon title={p.title} module={p.module} phase={p.phase} />;
    if (p.perm) el = <RequirePermission permission={p.perm}>{el}</RequirePermission>;
    if (p.builder) el = <RequireBuilder>{el}</RequireBuilder>;
    return { path: p.path, element: el };
  });
}
