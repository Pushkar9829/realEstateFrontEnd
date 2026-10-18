// RE-S-ADM-15 teams and territories (RE-J-01/02): team list with managers,
// members, cities, open leads and distribution mode. Managers see their own
// teams only.
import { useNavigate } from 'react-router-dom';
import { useT } from '@/shared/i18n';
import { Plus, Users } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, Table } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { WEEKDAYS, modeLabel, useTeams } from '@/modules/teams/api';

export default function TeamsPage() {
  const t = useT();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data, isLoading, error } = useTeams();
  const canManage = hasPermission('teams.manage');
  const rows = data || [];

  return (
    <>
      <PageHeader title={t('admin.teams.list.title')} description={t('admin.teams.list.description')}
        actions={canManage && <Button icon={Plus} onClick={() => navigate('/admin/teams/new')}>{t('admin.teams.newTeam')}</Button>} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {!isLoading && rows.length === 0 && !error ? (
        <EmptyState icon={Users} title={t('admin.teams.list.emptyTitle')} description={t('admin.teams.list.emptyDescription')}
          action={canManage && <Button icon={Plus} onClick={() => navigate('/admin/teams/new')}>{t('admin.teams.list.createTeam')}</Button>} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(tm) => `/admin/teams/${tm._id}`}
          columns={[
            { key: 'name', header: t('admin.teams.team'), render: (tm) => <span className="font-medium text-ink">{tm.name}{tm.active === false && <Badge className="ml-2">{t('admin.teams.inactive')}</Badge>}</span> },
            { key: 'managers', header: t('admin.teams.managers'), render: (tm) => (tm.managerIds || []).map((m) => m && m.name).filter(Boolean).join(', ') || <span className="text-xs text-warning-700">{t('admin.teams.list.noManager')}</span> },
            { key: 'members', header: t('admin.teams.list.members'), render: (tm) => { const away = (tm.members || []).filter((m) => m.available === false).length; return <span>{(tm.members || []).length}{away ? <span className="text-xs text-ink-subtle">{t('admin.teams.list.awaySuffix', { n: away })}</span> : ''}</span>; } },
            { key: 'cities', header: t('admin.teams.territory'), render: (tm) => <span className="text-sm">{(tm.territories?.cities || []).join(', ') || '-'}{(tm.territories?.localities || []).length ? <span className="block text-xs text-ink-subtle">{t('admin.teams.list.localities', { count: tm.territories.localities.length })}</span> : null}</span> },
            { key: 'open', header: t('admin.teams.list.openLeads'), render: (tm) => { const open = (tm.members || []).reduce((n, m) => n + (m.openLeads || 0), 0); const cap = (tm.members || []).reduce((n, m) => n + (m.capacity || 0), 0); return <span>{open}{cap ? <span className="text-xs text-ink-subtle"> / {cap}</span> : ''}</span>; } },
            { key: 'hours', header: t('admin.teams.list.hours'), render: (tm) => <span className="text-sm">{tm.workingHours?.start || '09:00'}-{tm.workingHours?.end || '20:00'}<span className="block text-xs text-ink-subtle">{(tm.workingHours?.days || [1, 2, 3, 4, 5, 6]).map((d) => WEEKDAYS[d]).join(' ')}</span></span> },
            { key: 'mode', header: t('admin.teams.list.mode'), render: (tm) => <Badge tone="info">{modeLabel(tm.mode)}</Badge> },
          ]} />
      )}
    </>
  );
}
