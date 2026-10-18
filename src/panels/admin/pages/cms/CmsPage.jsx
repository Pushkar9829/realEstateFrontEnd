// RE-S-ADM-25 CMS (cms.manage): pages, banners, FAQs, testimonials, home
// sections and agreement templates; RE-S-ADM-26 notification templates
// (templates.manage) as a tab. Previews render in a sandboxed frame.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, ImagePlus, Pencil, Plus, Send, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { UPLOAD_RULES, uploadFile } from '@/shared/lib/upload';
import { useAuth } from '@/modules/auth';
import { useT } from '@/shared/i18n';
import {
  HOME_SECTIONS, TEMPLATE_PLACEHOLDERS, TEMPLATE_PURPOSES, useAgreementTemplates, useCmsCreate, useCmsList, useCmsUpdate, useCreateTemplate,
  useEditNotificationTemplate, useHomeSections, useNotificationTemplates, usePublishTemplate, useSetHomeSections, useTestNotificationTemplate,
} from '@/modules/cms/adminApi';

const dayInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Known enum values get a translated label; anything else is title-cased.
const ENUM_KEYS = {
  status: ['draft', 'published', 'retired'], faqGroup: ['buyer', 'lister', 'general'], purpose: ['sale', 'rent', 'project'],
  channel: ['in_app', 'email', 'sms', 'whatsapp'], section: HOME_SECTIONS,
};
const enumLabel = (t, group, v) => ((ENUM_KEYS[group] || []).includes(v) ? t(`admin.cms.enums.${group}.${v}`) : titleCase(v));

function Preview({ html, title }) {
  const t = useT();
  return <iframe title={title || t('admin.cms.preview')} sandbox="" className="h-80 w-full rounded-md border bg-white" srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;padding:16px;color:#1f2937}</style>${html || ''}`} />;
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
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t('admin.cms.banner.tooLarge')); return; }
    setBusy(true);
    try { const up = await uploadFile(file, 'banner_image'); setF((x) => ({ ...x, imageFileId: up.id, imageUrl: up.url })); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-medium text-ink">{t('admin.cms.banner.image')} <span className="text-danger-600">*</span></p>
      <div className="flex flex-wrap items-center gap-3">
        {f.imageUrl ? <img src={f.imageUrl} alt="" className="h-20 w-56 rounded border object-cover" /> : <span className="flex h-20 w-56 items-center justify-center rounded border border-dashed text-ink-subtle"><ImagePlus className="h-5 w-5" /></span>}
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted">
          <Upload className="h-4 w-4" />{busy ? t('admin.cms.banner.uploading') : t('admin.cms.banner.upload')}
          <input type="file" className="sr-only" accept={UPLOAD_RULES.image.accept} onChange={onFile} disabled={busy} />
        </label>
      </div>
      <p className="mt-1 text-xs text-ink-subtle">{t('admin.cms.banner.sizeHint')}</p>
    </div>
  );
}

function ItemEditor({ kind, item, onClose }) {
  const t = useT();
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
      toast.success(t('admin.cms.saved'));
      onClose();
    } catch (e) { setErrors(e.fieldErrors); if (!Object.keys(e.fieldErrors).length) toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={t(`admin.cms.itemTitle.${item && item._id ? 'edit' : 'new'}.${kind}`)}
      footer={<>{kind === 'pages' && <Button variant="ghost" icon={Eye} onClick={() => setPreview((p) => !p)}>{preview ? t('admin.cms.edit') : t('admin.cms.preview')}</Button>}<Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={create.isPending || update.isPending} disabled={!cfg.valid(f)} onClick={save}>{t('common.save')}</Button></>}>
      {kind === 'pages' && (preview ? <Preview html={f.content} title={f.title} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('admin.cms.fields.title')} required value={f.title} onChange={set('title')} error={errors.title} />
          <Input label={t('admin.cms.fields.slug')} required hint={t('admin.cms.fields.slugHint')} value={f.slug} onChange={set('slug')} error={errors.slug} />
          <Textarea className="sm:col-span-2" label={t('admin.cms.fields.bodyHtml')} rows={10} hint={t('admin.cms.fields.bodyHtmlHint')} value={f.content} onChange={set('content')} error={errors.content} />
          <Input label={t('admin.cms.fields.seoTitle')} maxLength={60} hint={`${f.metaTitle.length}/60`} value={f.metaTitle} onChange={set('metaTitle')} error={errors.meta} />
          <Select label={t('admin.cms.cols.status')} value={f.status} onChange={set('status')} options={['draft', 'published'].map((value) => ({ value, label: enumLabel(t, 'status', value) }))} />
          <Textarea className="sm:col-span-2" label={t('admin.cms.fields.metaDescription')} rows={2} maxLength={160} hint={`${f.metaDescription.length}/160`} value={f.metaDescription} onChange={set('metaDescription')} />
        </div>
      ))}
      {kind === 'banners' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <BannerImage f={f} setF={setF} />
          <Input className="sm:col-span-2" label={t('admin.cms.fields.imageUrl')} value={f.imageUrl} onChange={(e) => setF((x) => ({ ...x, imageUrl: e.target.value, imageFileId: '' }))} error={errors.imageUrl} />
          <Input label={t('admin.cms.cols.headline')} maxLength={60} hint={`${f.title.length}/60`} value={f.title} onChange={set('title')} error={errors.title} />
          <Input label={t('admin.cms.cols.link')} placeholder="/projects/..." hint={t('admin.cms.fields.linkHint')} value={f.link} onChange={set('link')} error={errors.link || (f.link && !f.link.startsWith('/') ? t('admin.cms.fields.linkError') : undefined)} />
          <Input className="sm:col-span-2" label={t('admin.cms.cols.cities')} hint={t('admin.cms.fields.citiesHint')} value={f.cities} onChange={set('cities')} />
          <Input label={t('admin.cms.fields.startDate')} type="date" value={f.startAt} onChange={set('startAt')} />
          <Input label={t('admin.cms.fields.endDate')} type="date" value={f.endAt} onChange={set('endAt')} />
          <Input label={t('admin.cms.cols.sort')} type="number" value={f.sort} onChange={set('sort')} />
          <Checkbox className="self-end" label={t('admin.cms.active')} checked={f.active} onChange={set('active')} />
        </div>
      )}
      {kind === 'faqs' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input className="sm:col-span-2" label={t('admin.cms.cols.question')} required value={f.question} onChange={set('question')} error={errors.question} />
          <Textarea className="sm:col-span-2" label={t('admin.cms.fields.answer')} required rows={5} value={f.answer} onChange={set('answer')} error={errors.answer} />
          <Select label={t('admin.cms.cols.group')} value={f.group} onChange={set('group')} options={['buyer', 'lister', 'general'].map((g) => ({ value: g, label: enumLabel(t, 'faqGroup', g) }))} />
          <Input label={t('admin.cms.cols.sort')} type="number" value={f.sort} onChange={set('sort')} />
          <Checkbox label={t('admin.cms.active')} checked={f.active} onChange={set('active')} />
        </div>
      )}
      {kind === 'testimonials' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('admin.cms.cols.name')} value={f.name} onChange={set('name')} />
          <Input label={t('admin.cms.fields.city')} value={f.city} onChange={set('city')} />
          <Textarea className="sm:col-span-2" label={t('admin.cms.cols.text')} required rows={4} value={f.text} onChange={set('text')} error={errors.text} />
          <Select label={t('admin.cms.cols.rating')} value={f.rating} onChange={set('rating')} options={['5', '4', '3', '2', '1'].map((v) => ({ value: v, label: t('admin.cms.fields.stars', { n: v }) }))} />
          <Input label={t('admin.cms.cols.sort')} type="number" value={f.sort} onChange={set('sort')} />
          <Checkbox label={t('admin.cms.active')} checked={f.active} onChange={set('active')} />
        </div>
      )}
    </Modal>
  );
}

const COLUMNS = (t) => ({
  pages: [
    { key: 'title', header: t('admin.cms.cols.title'), render: (r) => <span className="font-medium text-ink">{r.title}</span> },
    { key: 'slug', header: t('admin.cms.fields.slug'), render: (r) => <span className="font-mono text-xs">/{r.slug}</span> },
    { key: 'status', header: t('admin.cms.cols.status'), render: (r) => <Badge tone={r.status === 'published' ? 'success' : 'neutral'}>{enumLabel(t, 'status', r.status)}</Badge> },
    { key: 'updatedAt', header: t('admin.cms.cols.updated'), render: (r) => <span className="text-xs">{dateTime(r.updatedAt)}</span> },
  ],
  banners: [
    { key: 'image', header: t('admin.cms.banner.image'), render: (r) => (r.imageUrl ? <img src={r.imageUrl} alt="" className="h-10 w-28 rounded object-cover" /> : '-') },
    { key: 'title', header: t('admin.cms.cols.headline'), render: (r) => r.title || '-' },
    { key: 'link', header: t('admin.cms.cols.link'), render: (r) => <span className="font-mono text-xs">{r.link || '-'}</span> },
    { key: 'cities', header: t('admin.cms.cols.cities'), render: (r) => ((r.cities || []).length ? r.cities.join(', ') : t('admin.cms.allCities')) },
    { key: 'dates', header: t('admin.cms.cols.runs'), render: (r) => <span className="text-xs">{r.startAt || r.endAt ? `${date(r.startAt)} - ${date(r.endAt)}` : t('admin.cms.always')}</span> },
    { key: 'active', header: t('admin.cms.cols.status'), render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? t('admin.cms.active') : t('admin.cms.off')}</Badge> },
  ],
  faqs: [
    { key: 'question', header: t('admin.cms.cols.question'), render: (r) => <span className="block max-w-md truncate font-medium text-ink">{r.question}</span> },
    { key: 'group', header: t('admin.cms.cols.group'), render: (r) => enumLabel(t, 'faqGroup', r.group || 'general') },
    { key: 'sort', header: t('admin.cms.cols.sort') },
    { key: 'active', header: t('admin.cms.cols.status'), render: (r) => <Badge tone={r.active !== false ? 'success' : 'neutral'}>{r.active !== false ? t('admin.cms.active') : t('admin.cms.off')}</Badge> },
  ],
  testimonials: [
    { key: 'name', header: t('admin.cms.cols.name'), render: (r) => <span>{r.name || '-'}<span className="block text-xs text-ink-subtle">{r.city}</span></span> },
    { key: 'text', header: t('admin.cms.cols.text'), render: (r) => <span className="block max-w-md truncate">{r.text}</span> },
    { key: 'rating', header: t('admin.cms.cols.rating'), render: (r) => (r.rating ? `${r.rating}/5` : '-') },
    { key: 'active', header: t('admin.cms.cols.status'), render: (r) => <Badge tone={r.active !== false ? 'success' : 'neutral'}>{r.active !== false ? t('admin.cms.active') : t('admin.cms.off')}</Badge> },
  ],
});

function CrudTab({ kind }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data, isLoading, error } = useCmsList(kind, { page, limit: 20 });
  return (
    <>
      <div className="mb-3 flex justify-end"><Button icon={Plus} onClick={() => setEditing({})}>{t('admin.cms.new')}</Button></div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setEditing} empty={t('admin.cms.empty')}
        columns={[...COLUMNS(t)[kind], { key: 'edit', header: '', render: (r) => <Button size="sm" variant="ghost" icon={Pencil} aria-label={t('admin.cms.edit')} onClick={(e) => { e.stopPropagation(); setEditing(r); }} /> }]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {editing && <ItemEditor kind={kind} item={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- home sections

function HomeSectionsTab() {
  const t = useT();
  const toast = useToast();
  const { data, isLoading, error } = useHomeSections();
  const save = useSetHomeSections();
  const [order, setOrder] = useState(null);
  const current = order || (data ? [...data.filter((s) => HOME_SECTIONS.includes(s)), ...HOME_SECTIONS.filter((s) => !data.includes(s))].map((key) => ({ key, on: data.includes(key) })) : []);
  const move = (i, d) => { const x = [...current]; const j = i + d; if (j < 0 || j >= x.length) return; [x[i], x[j]] = [x[j], x[i]]; setOrder(x); };
  const toggle = (i) => setOrder(current.map((s, k) => (k === i ? { ...s, on: !s.on } : s)));
  const doSave = async () => {
    try { await save.mutateAsync(current.filter((s) => s.on).map((s) => s.key)); toast.success(t('admin.cms.home.saved')); setOrder(null); } catch (e) { toast.error(e.message); }
  };
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  return (
    <Card className="max-w-xl">
      <CardHeader title={t('admin.cms.home.title')} description={t('admin.cms.home.description')} action={<Button loading={save.isPending} disabled={!order || !current.some((s) => s.on)} onClick={doSave}>{t('admin.cms.home.saveLayout')}</Button>} />
      {isLoading ? <p className="text-sm text-ink-subtle">{t('admin.cms.loading')}</p> : (
        <ol className="divide-y rounded-md border">
          {current.map((s, i) => (
            <li key={s.key} className="flex items-center gap-3 px-3 py-2">
              <Checkbox label={enumLabel(t, 'section', s.key)} checked={s.on} onChange={() => toggle(i)} className="flex-1" />
              <Button size="sm" variant="ghost" icon={ArrowUp} aria-label={t('admin.cms.home.moveUp')} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" icon={ArrowDown} aria-label={t('admin.cms.home.moveDown')} disabled={i === current.length - 1} onClick={() => move(i, 1)} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- agreement templates

function TemplatesTab() {
  const t = useT();
  const toast = useToast();
  const purposeLabel = (p) => enumLabel(t, 'purpose', p);
  const [purpose, setPurpose] = useState('');
  const { data, isLoading, error } = useAgreementTemplates(purpose ? { purpose, limit: 50 } : { limit: 50 });
  const create = useCreateTemplate();
  const publish = usePublishTemplate();
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const doCreate = async () => {
    try { await create.mutateAsync({ purpose: draft.purpose, body: draft.body }); toast.success(t('admin.cms.agreements.draftCreated')); setDraft(null); } catch (e) { toast.error(e.message); }
  };
  const doPublish = async () => {
    try { await publish.mutateAsync(confirm._id); toast.success(t('admin.cms.agreements.published', { purpose: purposeLabel(confirm.purpose), version: confirm.version })); setConfirm(null); } catch (e) { toast.error(e.message); }
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Select className="w-48" aria-label={t('admin.cms.agreements.purpose')} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('admin.cms.agreements.allPurposes')} options={TEMPLATE_PURPOSES.map((p) => ({ value: p, label: purposeLabel(p) }))} />
        <Button icon={Plus} onClick={() => setDraft({ purpose: purpose || 'sale', body: '' })}>{t('admin.cms.agreements.newVersion')}</Button>
      </div>
      <Alert tone="info" className="mb-3">{t('admin.cms.agreements.info', { tag: '{{nonCircumventionMonths}}' })}</Alert>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setView} empty={t('admin.cms.agreements.empty')}
        columns={[
          { key: 'purpose', header: t('admin.cms.agreements.purpose'), render: (r) => purposeLabel(r.purpose) },
          { key: 'version', header: t('admin.cms.agreements.version'), render: (r) => `v${r.version}` },
          { key: 'status', header: t('admin.cms.cols.status'), render: (r) => <Badge tone={r.status === 'published' ? 'success' : r.status === 'draft' ? 'warning' : 'neutral'}>{enumLabel(t, 'status', r.status)}</Badge> },
          { key: 'publishedAt', header: t('admin.cms.enums.status.published'), render: (r) => <span className="text-xs">{dateTime(r.publishedAt)}</span> },
          { key: 'publish', header: '', render: (r) => (r.status === 'draft' ? <Button size="sm" onClick={(e) => { e.stopPropagation(); setConfirm(r); }}>{t('admin.cms.agreements.publish')}</Button> : null) },
        ]} />
      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} size="lg" title={t('admin.cms.agreements.newTitle')} description={t('admin.cms.placeholders', { list: TEMPLATE_PLACEHOLDERS.join(' ') })}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>{t('common.cancel')}</Button><Button loading={create.isPending} disabled={!draft || draft.body.trim().length < 100} onClick={doCreate}>{t('admin.cms.agreements.saveDraft')}</Button></>}>
        {draft && (
          <div className="space-y-3">
            <Select label={t('admin.cms.agreements.purpose')} value={draft.purpose} onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))} options={TEMPLATE_PURPOSES.map((p) => ({ value: p, label: purposeLabel(p) }))} />
            <Textarea label={t('admin.cms.fields.body')} rows={14} hint={t('admin.cms.agreements.bodyHint', { n: draft.body.length })} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          </div>
        )}
      </Modal>
      <Modal open={Boolean(view)} onClose={() => setView(null)} size="lg" title={view ? `${purposeLabel(view.purpose)} v${view.version}` : ''} description={view ? enumLabel(t, 'status', view.status) : ''}>
        {view && <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-surface-sunken p-3 text-xs text-ink">{view.body}</pre>}
      </Modal>
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={t('admin.cms.agreements.publishTitle')} description={confirm ? t('admin.cms.agreements.publishDesc', { label: purposeLabel(confirm.purpose), version: confirm.version, purpose: purposeLabel(confirm.purpose).toLowerCase() }) : ''}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button><Button loading={publish.isPending} onClick={doPublish}>{t('admin.cms.agreements.publish')}</Button></>}>
        <p className="text-sm text-ink-muted">{t('admin.cms.agreements.publishNote')}</p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- notification templates

const placeholdersOf = (s) => [...new Set((String(s || '').match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((x) => x.replace(/\s/g, '')))];
const sample = (s) => String(s || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => `[${k}]`);
const LIMITS = { sms: 300, in_app: 200, whatsapp: 1000, email: 2000 };

function NotificationEditor({ tpl, onClose }) {
  const t = useT();
  const toast = useToast();
  const edit = useEditNotificationTemplate();
  const test = useTestNotificationTemplate();
  const [f, setF] = useState({ subject: tpl.subject || '', body: tpl.body || '', dltTemplateId: '', active: tpl.active !== false });
  const tags = placeholdersOf(`${tpl.subject || ''} ${tpl.body || ''}`);
  const unknown = placeholdersOf(`${f.subject} ${f.body}`).filter((p) => !tags.includes(p));
  const max = LIMITS[tpl.channel] || 2000;
  const save = async () => {
    try {
      await edit.mutateAsync({ key: tpl.key, channel: tpl.channel, body: { body: f.body, active: f.active, ...(tpl.channel === 'email' ? { subject: f.subject } : {}), ...(tpl.channel === 'sms' && f.dltTemplateId.trim() ? { dltTemplateId: f.dltTemplateId.trim() } : {}) } });
      toast.success(t('admin.cms.notif.saved'));
      onClose();
    } catch (e) { toast.error(e.message); }
  };
  const sendTest = async () => { try { await test.mutateAsync({ key: tpl.key, channel: tpl.channel }); toast.success(t('admin.cms.notif.testSent')); } catch (e) { toast.error(e.message); } };
  return (
    <Modal open onClose={onClose} size="lg" title={`${tpl.key} · ${enumLabel(t, 'channel', tpl.channel)}`} description={tpl.category ? t('admin.cms.notif.category', { name: titleCase(tpl.category) }) : ''}
      footer={<><Button variant="ghost" icon={Send} loading={test.isPending} onClick={sendTest}>{t('admin.cms.notif.sendTest')}</Button><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={edit.isPending} disabled={!f.body.trim() || f.body.length > max} onClick={save}>{t('common.save')}</Button></>}>
      <div className="space-y-3">
        {tags.length > 0 && <p className="text-xs text-ink-subtle">{t('admin.cms.placeholdersLabel')}{' '}{tags.map((p) => <code key={p} className="mr-1 rounded bg-surface-sunken px-1">{p}</code>)}</p>}
        {tpl.channel === 'email' && <Input label={t('admin.cms.notif.subject')} maxLength={120} value={f.subject} onChange={(e) => setF((x) => ({ ...x, subject: e.target.value }))} />}
        <Textarea label={t('admin.cms.fields.body')} rows={tpl.channel === 'email' ? 8 : 4} hint={`${f.body.length}/${max}${tpl.channel === 'email' ? ` · ${t('admin.cms.notif.htmlSubset')}` : ''}`} value={f.body} onChange={(e) => setF((x) => ({ ...x, body: e.target.value }))} error={f.body.length > max ? t('admin.cms.notif.maxChars', { max }) : undefined} />
        {tpl.channel === 'sms' && <Input label={t('admin.cms.notif.dlt')} hint={t('admin.cms.notif.dltHint')} value={f.dltTemplateId} onChange={(e) => setF((x) => ({ ...x, dltTemplateId: e.target.value }))} />}
        <Checkbox label={t('admin.cms.active')} checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
        {unknown.length > 0 && <Alert tone="warning">{t('admin.cms.notif.unknown', { list: unknown.join(', ') })}</Alert>}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('admin.cms.notif.previewSample')}</p>
          {tpl.channel === 'email' ? <><p className="mb-1 text-sm font-medium text-ink">{sample(f.subject)}</p><Preview html={sample(f.body)} title={t('admin.cms.notif.emailPreview')} /></> : <p className="whitespace-pre-line rounded-md bg-surface-sunken p-3 text-sm text-ink">{sample(f.body)}</p>}
        </div>
      </div>
    </Modal>
  );
}

function NotificationsTab() {
  const t = useT();
  const { data, isLoading, error } = useNotificationTemplates();
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [open, setOpen] = useState(null);
  const rows = useMemo(() => (data || []).filter((n) => (!channel || n.channel === channel) && (!q.trim() || n.key.includes(q.trim().toLowerCase()))), [data, q, channel]);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-[16rem_12rem]">
        <Input aria-label={t('admin.cms.notif.searchKey')} placeholder={t('admin.cms.notif.searchKey')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label={t('admin.cms.notif.channel')} value={channel} onChange={(e) => setChannel(e.target.value)} placeholder={t('admin.cms.notif.allChannels')} options={['in_app', 'email', 'sms', 'whatsapp'].map((c) => ({ value: c, label: enumLabel(t, 'channel', c) }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={rows} rowKey={(r) => `${r.key}:${r.channel}`} onRowClick={setOpen} empty={t('admin.cms.notif.empty')}
        columns={[
          { key: 'key', header: t('admin.cms.notif.event'), render: (r) => <span className="font-mono text-xs text-ink">{r.key}</span> },
          { key: 'channel', header: t('admin.cms.notif.channel'), render: (r) => <Badge tone="info">{enumLabel(t, 'channel', r.channel)}</Badge> },
          { key: 'category', header: t('admin.cms.notif.categoryCol'), render: (r) => titleCase(r.category || '-') },
          { key: 'text', header: t('admin.cms.cols.text'), render: (r) => <span className="block max-w-md truncate text-xs text-ink-muted">{r.subject ? `${r.subject} · ` : ''}{r.body}</span> },
          { key: 'state', header: t('admin.cms.notif.state'), render: (r) => <span className="flex gap-1">{r.overridden && <Badge tone="accent">{t('admin.cms.notif.edited')}</Badge>}<Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? t('admin.cms.active') : t('admin.cms.off')}</Badge></span> },
        ]} />
      {open && <NotificationEditor tpl={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export default function CmsPage() {
  const t = useT();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('pages');
  const tabs = [
    { value: 'pages', label: t('admin.cms.tabs.pages') }, { value: 'banners', label: t('admin.cms.tabs.banners') }, { value: 'faqs', label: t('admin.cms.tabs.faqs') }, { value: 'testimonials', label: t('admin.cms.tabs.testimonials') },
    { value: 'home', label: t('admin.cms.tabs.home') }, { value: 'agreements', label: t('admin.cms.tabs.agreements') },
    ...(hasPermission('templates.manage') ? [{ value: 'notifications', label: t('admin.cms.tabs.notifications') }] : []),
  ];
  return (
    <>
      <PageHeader title={t('admin.cms.title')} description={t('admin.cms.description')} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={tabs} />
      {FORMS[tab] && <CrudTab key={tab} kind={tab} />}
      {tab === 'home' && <HomeSectionsTab />}
      {tab === 'agreements' && <TemplatesTab />}
      {tab === 'notifications' && <NotificationsTab />}
    </>
  );
}
