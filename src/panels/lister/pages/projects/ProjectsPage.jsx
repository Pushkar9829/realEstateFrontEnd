// RE-G-01 builder projects list (builders only) and "new project".
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Pagination, Table, useToast } from '@/shared/ui';
import { date } from '@/shared/lib/format';
import { projectStatus, useCreateProject, useOwnProjects } from '@/modules/projects/api';

export default function ProjectsPage() {
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
      <PageHeader title="Builder projects" description="Projects show configurations, RERA details and live availability. Unit numbers and exact counts stay private."
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>New project</Button>} />
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={Building2} title="No projects yet" description="Create a project, add configurations and RERA details, then submit it for approval." action={<Button icon={Plus} onClick={() => setOpen(true)}>New project</Button>} />
      ) : (
        <Table loading={isLoading} rows={rows} rowHref={(r) => `/lister/projects/${r._id}`}
          columns={[
            { key: 'name', header: 'Project', render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.projectNo}</span></span> },
            { key: 'loc', header: 'Location', render: (r) => [r.location?.locality, r.location?.city].filter(Boolean).join(', ') || '-' },
            { key: 'configs', header: 'Configurations', render: (r) => (r.configurations || []).length },
            { key: 'avail', header: 'Available units', render: (r) => (r.configurations || []).reduce((n, c) => n + (c.availableUnits || 0), 0) },
            { key: 'status', header: 'Status', render: (r) => { const s = projectStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
            { key: 'updatedAt', header: 'Updated', render: (r) => date(r.updatedAt) },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={open} onClose={() => setOpen(false)} title="New project" size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} disabled={name.trim().length < 3} onClick={onCreate}>Create</Button></>}>
        <Input label="Project name" placeholder="e.g. Skyline Heights" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}
