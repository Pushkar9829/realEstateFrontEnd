// RE-G-01/02 project editor shell: tab navigation, submit checklist and status.
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Badge, Button, Card, PageHeader, PageSpinner, useToast } from '@/shared/ui';
import { titleCase } from '@/shared/lib/format';
import { PROJECT_TABS, projectMissing, projectStatus, useProject, useSubmitProject } from '@/modules/projects/api';
import { AmenitiesTab, ConfigurationsTab, DetailsTab, LocationTab, ReraTab } from './ProjectTabs';
import { CommissionTab, MediaTab, UnitsTab } from './ProjectTabs2';

const TAB_COMPONENTS = { details: DetailsTab, location: LocationTab, configurations: ConfigurationsTab, amenities: AmenitiesTab, rera: ReraTab, media: MediaTab, commission: CommissionTab, units: UnitsTab };
const EDITABLE = ['draft', 'changes_requested', 'live', 'sold_out'];

export default function ProjectEditorPage() {
  const { id } = useParams();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: p, isLoading, error } = useProject(id);
  const submit = useSubmitProject(id);
  const tab = TAB_COMPONENTS[params.get('tab')] ? params.get('tab') : 'details';

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const s = projectStatus(p.status);
  const missing = projectMissing(p);
  const canSubmit = ['draft', 'changes_requested'].includes(p.status);
  const editable = EDITABLE.includes(p.status);
  const idx = PROJECT_TABS.findIndex((t) => t.key === tab);
  const next = () => setParams({ tab: PROJECT_TABS[Math.min(PROJECT_TABS.length - 1, idx + 1)].key });
  const Tab = TAB_COMPONENTS[tab];

  const onSubmit = async () => {
    try { const r = await submit.mutateAsync(); toast.success('Submitted for approval'); if ((r.warnings || []).length) toast.info('Our reviewer will check the RERA notes on your project.'); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Link to="/lister/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Builder projects</Link>
      <PageHeader title={p.name} breadcrumb={p.projectNo}
        actions={<><Badge tone={s.tone}>{s.label}</Badge>{canSubmit && <Button icon={Send} disabled={missing.length > 0} loading={submit.isPending} onClick={onSubmit}>{p.status === 'changes_requested' ? 'Resubmit' : 'Submit for approval'}</Button>}</>} />
      {p.status === 'changes_requested' && (p.reviewComments || []).length > 0 && (
        <Alert tone="warning" className="mb-4" title="Changes requested"><ul className="list-disc pl-4">{p.reviewComments.map((c, i) => <li key={i}><strong>{titleCase(c.field)}:</strong> {c.comment}</li>)}</ul></Alert>
      )}
      {p.status === 'rejected' && <Alert tone="danger" className="mb-4">Rejected: {p.rejectionReason}</Alert>}
      {p.reraExpiry && ['expiring', 'expired'].includes(p.reraExpiry.status) && <Alert tone={p.reraExpiry.status === 'expired' ? 'danger' : 'warning'} className="mb-4">RERA registration {p.reraExpiry.number} {p.reraExpiry.status === 'expired' ? 'has expired' : 'expires soon'} ({new Date(p.reraExpiry.validTill).toLocaleDateString('en-IN')}). Upload the extension certificate in the RERA tab.</Alert>}
      {p.status === 'pending_approval' && <Alert tone="info" className="mb-4">Submitted for approval. Our team checks the RERA details within 24 hours.</Alert>}
      {canSubmit && missing.length > 0 && (
        <Alert tone="warning" className="mb-4" title="Before you submit">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">{missing.map(([k, label]) => <li key={k}><button type="button" className="inline-flex items-center gap-1 underline-offset-4 hover:underline" onClick={() => setParams({ tab: k })}><AlertTriangle className="h-3.5 w-3.5" />{label}</button></li>)}</ul>
        </Alert>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b" role="tablist">
        {PROJECT_TABS.map((t) => {
          const needs = missing.some(([k]) => k === t.key);
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setParams({ tab: t.key })}
              className={cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-subtle hover:text-ink')}>
              {t.label}{needs && <span className="h-1.5 w-1.5 rounded-full bg-warning-600" aria-label="needs attention" />}
            </button>
          );
        })}
      </div>
      <Card>
        <fieldset disabled={!editable && tab !== 'units'} className="min-w-0">
          <Tab key={`${tab}-${p._id}`} project={p} next={next} />
        </fieldset>
      </Card>
    </>
  );
}
