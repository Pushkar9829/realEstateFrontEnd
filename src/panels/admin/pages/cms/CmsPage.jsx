// RE-S-ADM-25 CMS (cms.manage): pages, banners, FAQs, testimonials, home
// sections and agreement templates; RE-S-ADM-26 notification templates
// (templates.manage) as a tab. Previews render in a sandboxed frame.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, ImagePlus, Pencil, Plus, Send, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { UPLOAD_RULES, uploadFile } from '@/shared/lib/upload';
import { useAuth } from '@/modules/auth';
import {
  HOME_SECTIONS, TEMPLATE_PLACEHOLDERS, TEMPLATE_PURPOSES, useAgreementTemplates, useCmsCreate, useCmsList, useCmsUpdate, useCreateTemplate,
  useEditNotificationTemplate, useHomeSections, useNotificationTemplates, usePublishTemplate, useSetHomeSections, useTestNotificationTemplate,
} from '@/modules/cms/adminApi';

const dayInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function Preview({ html, title }) {
  return <iframe title={title || 'Preview'} sandbox="" className="h-80 w-full rounded-md border bg-white" srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;padding:16px;color:#1f2937}</style>${html || ''}`} />;
}

// ---------------------------------------------------------------- per-kind forms

const FORMS = {
  pages: {
    empty: { title: '', slug: '', content: '', metaTitle: '', metaDescription: '', status: 'draft' },
    from: (d) => ({ title: d.title || '', slug: d.slug || '', content: d.content || '', metaTitle: d.meta?.title || '', metaDescription: d.meta?.description || '', status: d.status || 'draft' }),
    body: (f) => ({ title: f.title.trim(), slug: f.slug.trim().toLowerCase(), content: f.content, meta: { ...(f.metaTitle.trim() ? { title: f.metaTitle.trim() } : {}), ...(f.metaDescription.trim() ? { description: f.metaDescription.trim() } : {}) }, status: f.status }),
    valid: (f) => f.title.trim().length >= 2 && /^[a-z0-9-]{2,60}$/.test(f.slug.trim().toLowerCase()),
  },
  banners: {
    empty: { title: '', imageUrl: '', imageFileId: '', link: '', cities: '', startAt: '', endAt: '', active: true, sort: '0' },
    from: (d) => ({ title: d.title || '', imageUrl: d.imageUrl || '', imageFileId: d.imageFileId || '', link: d.link || '', cities: (d.cities || []).join(', '), startAt: dayInput(d.startAt), endAt: dayInput(d.endAt), active: d.active !== false, sort: String(d.sort ?? 0) }),
    body: (f) => ({ title: f.title.trim(), ...(f.imageUrl ? { imageUrl: f.imageUrl } : {}), ...(f.imageFileId ? { imageFileId: f.imageFileId } : {}), link: f.link.trim(), cities: list(f.cities), ...(f.startAt ? { startAt: f.startAt } : {}), ...(f.endAt ? { endAt: f.endAt } : {}), active: f.active, sort: Number(f.sort) || 0 }),
    valid: (f) => Boolean(f.imageUrl || f.imageFileId) && (!f.link || f.link.startsWith('/')) && f.title.trim().length <= 60,
  },
  faqs: {
    empty: { question: '', answer: '', group: 'general', active: true, sort: '0' },
    from: (d) => ({ question: d.question || '', answer: d.answer || '', group: d.group || 'general', active: d.active !== false, sort: String(d.sort ?? 0) }),
    body: (f) => ({ question: f.question.trim(), answer: f.answer.trim(), group: f.group, active: f.active, sort: Number(f.sort) || 0 }),
    valid: (f) => f.question.trim().length >= 5 && f.answer.trim().length >= 2,
  },
  testimonials: {
    empty: { name: '', city: '', text: '', rating: '5', active: true, sort: '0' },
    from: (d) => ({ name: d.name || '', city: d.city || '', text: d.text || '', rating: String(d.rating ?? 5), active: d.active !== false, sort: String(d.sort ?? 0) }),
    body: (f) => ({ name: f.name.trim(), city: f.city.trim(), text: f.text.trim(), ...(f.rating ? { rating: Number(f.rating) } : {}), active: f.active, sort: Number(f.sort) || 0 }),
    valid: (f) => f.text.trim().length >= 5,
  },
};

function BannerImage({ f, setF }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Banner images must be 2 MB or smaller'); return; }
    setBusy(true);
    try { const up = await uploadFile(file, 'banner_image'); setF((x) => ({ ...x, imageFileId: up.id, imageUrl: up.url })); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-medium text-ink">Image <span className="text-danger-600">*</span></p>
      <div className="flex flex-wrap items-center gap-3">
        {f.imageUrl ? <img src={f.imageUrl} alt="" className="h-20 w-56 rounded border object-cover" /> : <span className="flex h-20 w-56 items-center justify-center rounded border border-dashed text-ink-subtle"><ImagePlus className="h-5 w-5" /></span>}
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted">
          <Upload className="h-4 w-4" />{busy ? 'Uploading...' : 'Upload'}
          <input type="file" className="sr-only" accept={UPLOAD_RULES.image.accept} onChange={onFile} disabled={busy} />
        </label>
      </div>
      <p className="mt-1 text-xs text-ink-subtle">Desktop 1920x600, mobile 800x600, up to 2 MB. Or paste an image URL below.</p>
    </div>
  );
}

function ItemEditor({ kind, item, onClose }) {
  const toast = useToast();
  const cfg = FORMS[kind];
  const create = useCmsCreate(kind);
  const update = useCmsUpdate(kind);
  const [f, setF] = useState(() => (item && item._id ? cfg.from(item) : cfg.empty));
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    setErrors({});
    try {
      if (item && item._id) await update.mutateAsync({ id: item._id, body: cfg.body(f) });
      else await create.mutateAsync(cfg.body(f));
      toast.success('Saved');
      onClose();
    } catch (e) { setErrors(e.fieldErrors); if (!Object.keys(e.fieldErrors).length) toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={`${item && item._id ? 'Edit' : 'New'} ${kind === 'faqs' ? 'FAQ' : titleCase(kind).replace(/s$/, '').toLowerCase()}`}
      footer={<>{kind === 'pages' && <Button variant="ghost" icon={Eye} onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</Button>}<Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending || update.isPending} disabled={!cfg.valid(f)} onClick={save}>Save</Button></>}>
      {kind === 'pages' && (preview ? <Preview html={f.content} title={f.title} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Title" required value={f.title} onChange={set('title')} error={errors.title} />
          <Input label="Slug" required hint="Lowercase letters, numbers and dashes." value={f.slug} onChange={set('slug')} error={errors.slug} />
          <Textarea className="sm:col-span-2" label="Body (HTML)" rows={10} hint="Sanitised HTML subset: headings, paragraphs, lists, links, bold, italic." value={f.content} onChange={set('content')} error={errors.content} />
          <Input label="SEO title" maxLength={60} hint={`${f.metaTitle.length}/60`} value={f.metaTitle} onChange={set('metaTitle')} error={errors.meta} />
          <Select label="Status" value={f.status} onChange={set('status')} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }]} />
          <Textarea className="sm:col-span-2" label="Meta description" rows={2} maxLength={160} hint={`${f.metaDescription.length}/160`} value={f.metaDescription} onChange={set('metaDescription')} />
        </div>
      ))}
      {kind === 'banners' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <BannerImage f={f} setF={setF} />
          <Input className="sm:col-span-2" label="Image URL" value={f.imageUrl} onChange={(e) => setF((x) => ({ ...x, imageUrl: e.target.value, imageFileId: '' }))} error={errors.imageUrl} />
          <Input label="Headline" maxLength={60} hint={`${f.title.length}/60`} value={f.title} onChange={set('title')} error={errors.title} />
          <Input label="Link" placeholder="/projects/..." hint="Internal path only. Project or builder links get the RERA caption automatically." value={f.link} onChange={set('link')} error={errors.link || (f.link && !f.link.startsWith('/') ? 'Use an internal path starting with /' : undefined)} />
          <Input className="sm:col-span-2" label="Cities" hint="Comma separated; empty shows the banner everywhere." value={f.cities} onChange={set('cities')} />
          <Input label="Start date" type="date" value={f.startAt} onChange={set('startAt')} />
          <Input label="End date" type="date" value={f.endAt} onChange={set('endAt')} />
          <Input label="Sort" type="number" value={f.sort} onChange={set('sort')} />
          <Checkbox className="self-end" label="Active" checked={f.active} onChange={set('active')} />
        </div>
      )}
      {kind === 'faqs' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Question" required value={f.question} onChange={set('question')} error={errors.question} />
          <Textarea className="sm:col-span-2" label="Answer" required rows={5} value={f.answer} onChange={set('answer')} error={errors.answer} />
          <Select label="Group" value={f.group} onChange={set('group')} options={['buyer', 'lister', 'general'].map((g) => ({ value: g, label: titleCase(g) }))} />
          <Input label="Sort" type="number" value={f.sort} onChange={set('sort')} />
          <Checkbox label="Active" checked={f.active} onChange={set('active')} />
        </div>
      )}
      {kind === 'testimonials' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Name" value={f.name} onChange={set('name')} />
          <Input label="City" value={f.city} onChange={set('city')} />
          <Textarea className="sm:col-span-2" label="Text" required rows={4} value={f.text} onChange={set('text')} error={errors.text} />
          <Select label="Rating" value={f.rating} onChange={set('rating')} options={['5', '4', '3', '2', '1'].map((v) => ({ value: v, label: `${v} stars` }))} />
          <Input label="Sort" type="number" value={f.sort} onChange={set('sort')} />
          <Checkbox label="Active" checked={f.active} onChange={set('active')} />
        </div>
      )}
    </Modal>
  );
}

const COLUMNS = {
  pages: [
    { key: 'title', header: 'Title', render: (r) => <span className="font-medium text-ink">{r.title}</span> },
    { key: 'slug', header: 'Slug', render: (r) => <span className="font-mono text-xs">/{r.slug}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'published' ? 'success' : 'neutral'}>{titleCase(r.status)}</Badge> },
    { key: 'updatedAt', header: 'Updated', render: (r) => <span className="text-xs">{dateTime(r.updatedAt)}</span> },
  ],
  banners: [
    { key: 'image', header: 'Image', render: (r) => (r.imageUrl ? <img src={r.imageUrl} alt="" className="h-10 w-28 rounded object-cover" /> : '-') },
    { key: 'title', header: 'Headline', render: (r) => r.title || '-' },
    { key: 'link', header: 'Link', render: (r) => <span className="font-mono text-xs">{r.link || '-'}</span> },
    { key: 'cities', header: 'Cities', render: (r) => ((r.cities || []).length ? r.cities.join(', ') : 'All') },
    { key: 'dates', header: 'Runs', render: (r) => <span className="text-xs">{r.startAt || r.endAt ? `${date(r.startAt)} - ${date(r.endAt)}` : 'Always'}</span> },
    { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Off'}</Badge> },
  ],
  faqs: [
    { key: 'question', header: 'Question', render: (r) => <span className="block max-w-md truncate font-medium text-ink">{r.question}</span> },
    { key: 'group', header: 'Group', render: (r) => titleCase(r.group || 'general') },
    { key: 'sort', header: 'Sort' },
    { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active !== false ? 'success' : 'neutral'}>{r.active !== false ? 'Active' : 'Off'}</Badge> },
  ],
  testimonials: [
    { key: 'name', header: 'Name', render: (r) => <span>{r.name || '-'}<span className="block text-xs text-ink-subtle">{r.city}</span></span> },
    { key: 'text', header: 'Text', render: (r) => <span className="block max-w-md truncate">{r.text}</span> },
    { key: 'rating', header: 'Rating', render: (r) => (r.rating ? `${r.rating}/5` : '-') },
    { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active !== false ? 'success' : 'neutral'}>{r.active !== false ? 'Active' : 'Off'}</Badge> },
  ],
};

function CrudTab({ kind }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data, isLoading, error } = useCmsList(kind, { page, limit: 20 });
  return (
    <>
      <div className="mb-3 flex justify-end"><Button icon={Plus} onClick={() => setEditing({})}>New</Button></div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setEditing} empty="Nothing here yet"
        columns={[...COLUMNS[kind], { key: 'edit', header: '', render: (r) => <Button size="sm" variant="ghost" icon={Pencil} aria-label="Edit" onClick={(e) => { e.stopPropagation(); setEditing(r); }} /> }]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {editing && <ItemEditor kind={kind} item={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- home sections

function HomeSectionsTab() {
  const toast = useToast();
  const { data, isLoading, error } = useHomeSections();
  const save = useSetHomeSections();
  const [order, setOrder] = useState(null);
  const current = order || (data ? [...data.filter((s) => HOME_SECTIONS.includes(s)), ...HOME_SECTIONS.filter((s) => !data.includes(s))].map((key) => ({ key, on: data.includes(key) })) : []);
  const move = (i, d) => { const x = [...current]; const j = i + d; if (j < 0 || j >= x.length) return; [x[i], x[j]] = [x[j], x[i]]; setOrder(x); };
  const toggle = (i) => setOrder(current.map((s, k) => (k === i ? { ...s, on: !s.on } : s)));
  const doSave = async () => {
    try { await save.mutateAsync(current.filter((s) => s.on).map((s) => s.key)); toast.success('Home page layout saved'); setOrder(null); } catch (e) { toast.error(e.message); }
  };
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  return (
    <Card className="max-w-xl">
      <CardHeader title="Home page strips" description="Turn strips on or off and set their order." action={<Button loading={save.isPending} disabled={!order || !current.some((s) => s.on)} onClick={doSave}>Save layout</Button>} />
      {isLoading ? <p className="text-sm text-ink-subtle">Loading...</p> : (
        <ol className="divide-y rounded-md border">
          {current.map((s, i) => (
            <li key={s.key} className="flex items-center gap-3 px-3 py-2">
              <Checkbox label={titleCase(s.key)} checked={s.on} onChange={() => toggle(i)} className="flex-1" />
              <Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" icon={ArrowDown} aria-label="Move down" disabled={i === current.length - 1} onClick={() => move(i, 1)} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- agreement templates

function TemplatesTab() {
  const toast = useToast();
  const [purpose, setPurpose] = useState('');
  const { data, isLoading, error } = useAgreementTemplates(purpose ? { purpose, limit: 50 } : { limit: 50 });
  const create = useCreateTemplate();
  const publish = usePublishTemplate();
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const doCreate = async () => {
    try { await create.mutateAsync({ purpose: draft.purpose, body: draft.body }); toast.success('Draft version created'); setDraft(null); } catch (e) { toast.error(e.message); }
  };
  const doPublish = async () => {
    try { await publish.mutateAsync(confirm._id); toast.success(`${titleCase(confirm.purpose)} v${confirm.version} published`); setConfirm(null); } catch (e) { toast.error(e.message); }
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Select className="w-48" aria-label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="All purposes" options={TEMPLATE_PURPOSES.map((p) => ({ value: p, label: titleCase(p) }))} />
        <Button icon={Plus} onClick={() => setDraft({ purpose: purpose || 'sale', body: '' })}>New version</Button>
      </div>
      <Alert tone="info" className="mb-3">Publishing a new version does not change existing agreements; new acceptances use the new version. The body must include the non-circumvention clause ({'{{nonCircumventionMonths}}'}).</Alert>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setView} empty="No templates"
        columns={[
          { key: 'purpose', header: 'Purpose', render: (r) => titleCase(r.purpose) },
          { key: 'version', header: 'Version', render: (r) => `v${r.version}` },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'published' ? 'success' : r.status === 'draft' ? 'warning' : 'neutral'}>{titleCase(r.status)}</Badge> },
          { key: 'publishedAt', header: 'Published', render: (r) => <span className="text-xs">{dateTime(r.publishedAt)}</span> },
          { key: 'publish', header: '', render: (r) => (r.status === 'draft' ? <Button size="sm" onClick={(e) => { e.stopPropagation(); setConfirm(r); }}>Publish</Button> : null) },
        ]} />
      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} size="lg" title="New agreement template version" description={`Placeholders: ${TEMPLATE_PLACEHOLDERS.join(' ')}`}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button loading={create.isPending} disabled={!draft || draft.body.trim().length < 100} onClick={doCreate}>Save draft</Button></>}>
        {draft && (
          <div className="space-y-3">
            <Select label="Purpose" value={draft.purpose} onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))} options={TEMPLATE_PURPOSES.map((p) => ({ value: p, label: titleCase(p) }))} />
            <Textarea label="Body" rows={14} hint={`${draft.body.length} characters (100-20000).`} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          </div>
        )}
      </Modal>
      <Modal open={Boolean(view)} onClose={() => setView(null)} size="lg" title={view ? `${titleCase(view.purpose)} v${view.version}` : ''} description={view ? titleCase(view.status) : ''}>
        {view && <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface-sunken p-3 text-xs text-ink">{view.body}</pre>}
      </Modal>
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Publish template" description={confirm ? `${titleCase(confirm.purpose)} v${confirm.version} replaces the current published ${confirm.purpose} template, which is retired.` : ''}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button loading={publish.isPending} onClick={doPublish}>Publish</Button></>}>
        <p className="text-sm text-ink-muted">Existing agreements keep the version they were accepted under.</p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- notification templates

const placeholdersOf = (s) => [...new Set((String(s || '').match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((x) => x.replace(/\s/g, '')))];
const sample = (s) => String(s || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => `[${k}]`);
const LIMITS = { sms: 300, in_app: 200, whatsapp: 1000, email: 2000 };

function NotificationEditor({ t, onClose }) {
  const toast = useToast();
  const edit = useEditNotificationTemplate();
  const test = useTestNotificationTemplate();
  const [f, setF] = useState({ subject: t.subject || '', body: t.body || '', dltTemplateId: '', active: t.active !== false });
  const tags = placeholdersOf(`${t.subject || ''} ${t.body || ''}`);
  const unknown = placeholdersOf(`${f.subject} ${f.body}`).filter((p) => !tags.includes(p));
  const max = LIMITS[t.channel] || 2000;
  const save = async () => {
    try {
      await edit.mutateAsync({ key: t.key, channel: t.channel, body: { body: f.body, active: f.active, ...(t.channel === 'email' ? { subject: f.subject } : {}), ...(t.channel === 'sms' && f.dltTemplateId.trim() ? { dltTemplateId: f.dltTemplateId.trim() } : {}) } });
      toast.success('Template saved');
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  const sendTest = async () => { try { await test.mutateAsync({ key: t.key, channel: t.channel }); toast.success('Test sent to you'); } catch (e) { toast.error(e.message); } };
  return (
    <Modal open onClose={onClose} size="lg" title={`${t.key} · ${titleCase(t.channel)}`} description={t.category ? `Category ${titleCase(t.category)}` : ''}
      footer={<><Button variant="ghost" icon={Send} loading={test.isPending} onClick={sendTest}>Send test to me</Button><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={edit.isPending} disabled={!f.body.trim() || f.body.length > max} onClick={save}>Save</Button></>}>
      <div className="space-y-3">
        {tags.length > 0 && <p className="text-xs text-ink-subtle">Placeholders: {tags.map((p) => <code key={p} className="mr-1 rounded bg-surface-sunken px-1">{p}</code>)}</p>}
        {t.channel === 'email' && <Input label="Subject" maxLength={120} value={f.subject} onChange={(e) => setF((x) => ({ ...x, subject: e.target.value }))} />}
        <Textarea label="Body" rows={t.channel === 'email' ? 8 : 4} hint={`${f.body.length}/${max}${t.channel === 'email' ? ' · HTML subset' : ''}`} value={f.body} onChange={(e) => setF((x) => ({ ...x, body: e.target.value }))} error={f.body.length > max ? `At most ${max} characters` : undefined} />
        {t.channel === 'sms' && <Input label="DLT template ID" hint="India SMS compliance; optional in development." value={f.dltTemplateId} onChange={(e) => setF((x) => ({ ...x, dltTemplateId: e.target.value }))} />}
        <Checkbox label="Active" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
        {unknown.length > 0 && <Alert tone="warning">Not in the default template: {unknown.join(', ')}. The server rejects unknown or contact placeholders on buyer-facing events.</Alert>}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Preview with sample data</p>
          {t.channel === 'email' ? <><p className="mb-1 text-sm font-medium text-ink">{sample(f.subject)}</p><Preview html={sample(f.body)} title="Email preview" /></> : <p className="whitespace-pre-line rounded-md bg-surface-sunken p-3 text-sm text-ink">{sample(f.body)}</p>}
        </div>
      </div>
    </Modal>
  );
}

function NotificationsTab() {
  const { data, isLoading, error } = useNotificationTemplates();
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => (data || []).filter((t) => (!channel || t.channel === channel) && (!q.trim() || t.key.includes(q.trim().toLowerCase()))), [data, q, channel]);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-[16rem_12rem]">
        <Input aria-label="Search event key" placeholder="Search event key" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="All channels" options={['in_app', 'email', 'sms', 'whatsapp'].map((c) => ({ value: c, label: titleCase(c) }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={rows} rowKey={(r) => `${r.key}:${r.channel}`} onRowClick={setOpen} empty="No templates match"
        columns={[
          { key: 'key', header: 'Event', render: (r) => <span className="font-mono text-xs text-ink">{r.key}</span> },
          { key: 'channel', header: 'Channel', render: (r) => <Badge tone="info">{titleCase(r.channel)}</Badge> },
          { key: 'category', header: 'Category', render: (r) => titleCase(r.category || '-') },
          { key: 'text', header: 'Text', render: (r) => <span className="block max-w-md truncate text-xs text-ink-muted">{r.subject ? `${r.subject} · ` : ''}{r.body}</span> },
          { key: 'state', header: 'State', render: (r) => <span className="flex gap-1">{r.overridden && <Badge tone="accent">Edited</Badge>}<Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Off'}</Badge></span> },
        ]} />
      {open && <NotificationEditor t={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export default function CmsPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('pages');
  const tabs = [
    { value: 'pages', label: 'Pages' }, { value: 'banners', label: 'Banners' }, { value: 'faqs', label: 'FAQs' }, { value: 'testimonials', label: 'Testimonials' },
    { value: 'home', label: 'Home sections' }, { value: 'agreements', label: 'Agreement templates' },
    ...(hasPermission('templates.manage') ? [{ value: 'notifications', label: 'Notification templates' }] : []),
  ];
  return (
    <>
      <PageHeader title="CMS and templates" description="Content for the public portal, the listing agreement templates and notification texts." />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={tabs} />
      {FORMS[tab] && <CrudTab key={tab} kind={tab} />}
      {tab === 'home' && <HomeSectionsTab />}
      {tab === 'agreements' && <TemplatesTab />}
      {tab === 'notifications' && <NotificationsTab />}
    </>
  );
}
