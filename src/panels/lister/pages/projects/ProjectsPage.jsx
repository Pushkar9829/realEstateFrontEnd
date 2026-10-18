// RE-G-01 builder projects list (builders only) and "new project".
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Pagination, Table, useToast } from '@/shared/ui';
import { date } from '@/shared/lib/format';
import { projectStatus, useCreateProject, useOwnProjects } from '@/modules/projects/api';
import { useT } from '@/shared/i18n';

export default function ProjectsPage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const { data, isLoading } = useOwnProjects({ page, limit: 20, sort: '-updatedAt' });
  const create = useCreateProject();
  const rows = (data && data.items) || [];

  const onCreate = async () => {
    try { const p = await create.mutateAsync({ name: name.trim() }); setOpen(false); navigate(`/lister/projects/${p._id}?tab=details`); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title={t('panel.nav.listerProjects')} description={t('lister.projects.desc')}
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>{t('lister.dashboard.newProject')}</Button>} />
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={Building2} title={t('lister.projects.none')} description={t('lister.projects.noneDesc')} action={<Button icon={Plus} onClick={() => setOpen(true)}>{t('lister.dashboard.newProject')}</Button>} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/lister/projects/${r._id}`}
          columns={[
            { key: 'name', header: t('lister.wizard.basic.project'), render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.projectNo}</span></span> },
            { key: 'loc', header: t('lister.projects.tabs.location'), render: (r) => [r.location?.locality, r.location?.city].filter(Boolean).join(', ') || '-' },
            { key: 'configs', header: t('lister.projects.tabs.configurations'), render: (r) => (r.configurations || []).length },
            { key: 'avail', header: t('lister.projects.availableUnits'), render: (r) => (r.configurations || []).reduce((n, c) => n + (c.availableUnits || 0), 0) },
            { key: 'status', header: t('lister.leads.col.status'), render: (r) => { const s = projectStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
            { key: 'updatedAt', header: t('lister.projects.updated'), render: (r) => date(r.updatedAt) },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={open} onClose={() => setOpen(false)} title={t('lister.dashboard.newProject')} size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button loading={create.isPending} disabled={name.trim().length < 3} onClick={onCreate}>{t('lister.projects.create')}</Button></>}>
        <Input label={t('lister.projects.name')} placeholder={t('lister.projects.namePh')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}
