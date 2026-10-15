// RE-S-ADM-15 teams and territories (RE-J-01/02): team list with managers,
// members, cities, open leads and distribution mode. Managers see their own
// teams only.
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, Table } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { WEEKDAYS, modeLabel, useTeams } from '@/modules/teams/api';

export default function TeamsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data, isLoading, error } = useTeams();
  const canManage = hasPermission('teams.manage');
  const rows = data || [];

  return (
    <>
      <PageHeader title="Teams and staff" description="Each agent belongs to exactly one team. Teams own territories, working hours and the distribution mode."
        actions={canManage && <Button icon={Plus} onClick={() => navigate('/admin/teams/new')}>New team</Button>} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {!isLoading && rows.length === 0 && !error ? (
        <EmptyState icon={Users} title="No teams yet" description="Create a team, add its manager and agents, then point routing rules at it."
          action={canManage && <Button icon={Plus} onClick={() => navigate('/admin/teams/new')}>Create a team</Button>} />
      ) : (
        <Table loading={isLoading} rows={rows} onRowClick={(t) => navigate(`/admin/teams/${t._id}`)}
          columns={[
            { key: 'name', header: 'Team', render: (t) => <span className="font-medium text-ink">{t.name}{t.active === false && <Badge className="ml-2">Inactive</Badge>}</span> },
            { key: 'managers', header: 'Managers', render: (t) => (t.managerIds || []).map((m) => m && m.name).filter(Boolean).join(', ') || <span className="text-xs text-warning-700">No manager</span> },
            { key: 'members', header: 'Members', render: (t) => { const away = (t.members || []).filter((m) => m.available === false).length; return <span>{(t.members || []).length}{away ? <span className="text-xs text-ink-subtle"> · {away} away</span> : ''}</span>; } },
            { key: 'cities', header: 'Territory', render: (t) => <span className="text-sm">{(t.territories?.cities || []).join(', ') || '-'}{(t.territories?.localities || []).length ? <span className="block text-xs text-ink-subtle">{t.territories.localities.length} localities</span> : null}</span> },
            { key: 'open', header: 'Open leads', render: (t) => { const open = (t.members || []).reduce((n, m) => n + (m.openLeads || 0), 0); const cap = (t.members || []).reduce((n, m) => n + (m.capacity || 0), 0); return <span>{open}{cap ? <span className="text-xs text-ink-subtle"> / {cap}</span> : ''}</span>; } },
            { key: 'hours', header: 'Hours', render: (t) => <span className="text-sm">{t.workingHours?.start || '09:00'}-{t.workingHours?.end || '20:00'}<span className="block text-xs text-ink-subtle">{(t.workingHours?.days || [1, 2, 3, 4, 5, 6]).map((d) => WEEKDAYS[d]).join(' ')}</span></span> },
            { key: 'mode', header: 'Mode', render: (t) => <Badge tone="info">{modeLabel(t.mode)}</Badge> },
          ]} />
      )}
    </>
  );
}
