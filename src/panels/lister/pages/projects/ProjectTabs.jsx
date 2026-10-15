// Project editor tabs: details, location, configurations, amenities and RERA
// (PATCH /lister/projects/:id/steps/:tab). RE-G-01/03/08.
import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Button, Input, Select, Textarea, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import MapPicker from '@/shared/components/MapPicker';
import { shortRupees } from '@/shared/lib/format';
import { useCities, useLocalities, useMasters } from '@/modules/listings/api';
import { reraWarning, useSaveProjectTab } from '@/modules/projects/api';

function useTab(project, tab, onSaved) {
  const save = useSaveProjectTab(project._id);
  const toast = useToast();
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const run = async (body) => {
    setErrors({}); setError(null);
    try {
      const r = await save.mutateAsync({ tab, body });
      if ((r.warnings || []).length) toast.info(r.warnings.map(reraWarning).join('. '), { title: 'Saved, please check', duration: 8000 });
      else toast.success('Saved');
      onSaved && onSaved();
    } catch (e) {
      setErrors(e.fieldErrors || {});
      setError(e.message);
    }
  };
  return { run, saving: save.isPending, errors, error };
}

const Footer = ({ saving, onSave, label = 'Save and continue' }) => <div className="mt-6 flex justify-end border-t pt-5"><Button loading={saving} onClick={onSave}>{label}</Button></div>;

export function DetailsTab({ project, next }) {
  const [v, setV] = useState({ name: project.name || '', description: project.description || '', status: project.possession?.status || 'under_construction', date: project.possession?.date ? String(project.possession.date).slice(0, 10) : '' });
  const t = useTab(project, 'details', next);
  return (
    <div className="space-y-5">
      {t.error && <Alert tone="danger">{t.error}</Alert>}
      <Input label="Project name" required value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} error={t.errors.name} />
      <Textarea label="Description" required rows={6} value={v.description} onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))} hint={`${v.description.length}/8000 · at least 50 characters. Contact details are blocked.`} error={t.errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Possession" value={v.status} onChange={(e) => setV((x) => ({ ...x, status: e.target.value }))} options={[{ value: 'under_construction', label: 'Under construction' }, { value: 'ready', label: 'Ready to move' }]} />
        {v.status === 'under_construction' && <Input label="Expected possession" type="date" value={v.date} onChange={(e) => setV((x) => ({ ...x, date: e.target.value }))} />}
      </div>
      <Footer saving={t.saving} onSave={() => t.run({ name: v.name, description: v.description, possession: { status: v.status, ...(v.status === 'under_construction' && v.date ? { date: v.date } : {}) } })} />
    </div>
  );
}

export function LocationTab({ project, next }) {
  const loc = project.location || {};
  const c = loc.geo && loc.geo.coordinates;
  const cities = useCities();
  const [v, setV] = useState({ cityId: loc.cityId ? String(loc.cityId) : '', localityId: loc.localityId ? String(loc.localityId) : '', addressLine: loc.addressLine || '', pincode: loc.pincode || '', pin: c ? { lat: c[1], lng: c[0] } : null });
  const localities = useLocalities(v.cityId);
  const t = useTab(project, 'location', next);
  const city = (cities.data || []).find((x) => x._id === v.cityId);
  const lc = (localities.data || []).find((x) => x._id === v.localityId);
  const center = useMemo(() => { const g = (lc && lc.meta && lc.meta.centroid) || (city && city.meta && city.meta.centroid); return g ? [g.coordinates[1], g.coordinates[0]] : null; }, [city, lc]);
  return (
    <div className="space-y-5">
      {t.error && <Alert tone="danger">{t.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="City" required placeholder="Choose a city" value={v.cityId} onChange={(e) => setV((x) => ({ ...x, cityId: e.target.value, localityId: '' }))} options={(cities.data || []).map((x) => ({ value: x._id, label: x.name }))} />
        <Select label="Locality" required placeholder="Choose a locality" disabled={!v.cityId} value={v.localityId} onChange={(e) => setV((x) => ({ ...x, localityId: e.target.value }))} options={(localities.data || []).map((x) => ({ value: x._id, label: x.name }))} error={t.errors.localityId} />
        <Input label="Site address" required value={v.addressLine} onChange={(e) => setV((x) => ({ ...x, addressLine: e.target.value }))} error={t.errors.addressLine} />
        <Input label="Pincode" required maxLength={6} value={v.pincode} onChange={(e) => setV((x) => ({ ...x, pincode: e.target.value }))} error={t.errors.pincode} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Site location <span className="text-danger-600">*</span> <span className="text-xs font-normal text-ink-subtle">click the map or drag the pin</span></p>
        <MapPicker value={v.pin} center={center} onChange={(p) => setV((x) => ({ ...x, pin: p }))} />
      </div>
      <Footer saving={t.saving} onSave={() => t.run({ cityId: v.cityId, localityId: v.localityId, addressLine: v.addressLine, pincode: v.pincode, ...(v.pin ? { lat: v.pin.lat, lng: v.pin.lng } : {}) })} />
    </div>
  );
}

const EMPTY_CONFIG = { name: '', bhk: '', carpetMin: '', carpetMax: '', priceMin: '', priceMax: '', totalUnits: '', availableUnits: '' };

export function ConfigurationsTab({ project, next }) {
  const [rows, setRows] = useState((project.configurations || []).length
    ? project.configurations.map((c) => ({ _id: c._id, name: c.name, bhk: c.bhk ?? '', carpetMin: c.carpetMin, carpetMax: c.carpetMax, priceMin: c.priceMin / 100, priceMax: c.priceMax / 100, totalUnits: c.totalUnits, availableUnits: c.availableUnits }))
    : [{ ...EMPTY_CONFIG }]);
  const t = useTab(project, 'configurations', next);
  const set = (i, k, val) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  const n = (x) => (x === '' || x == null ? undefined : Number(x));
  const save = () => t.run({ items: rows.map((r) => Object.fromEntries(Object.entries({ _id: r._id, name: r.name, bhk: n(r.bhk), carpetMin: n(r.carpetMin), carpetMax: n(r.carpetMax), priceMin: n(r.priceMin), priceMax: n(r.priceMax), totalUnits: n(r.totalUnits), availableUnits: n(r.availableUnits) }).filter(([, val]) => val !== undefined && val !== ''))) });
  const cell = 'h-9 w-full rounded-md border border-line-strong px-2 text-sm';
  return (
    <div className="space-y-4">
      {t.error && <Alert tone="danger">{t.error}</Alert>}
      <p className="text-sm text-ink-muted">1 to 30 unit types. Prices in rupees. Buyers see price ranges and "available / few left / sold out", never exact counts.</p>
      <div className="overflow-x-auto">
        <table className="min-w-[860px] text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-subtle">{['Name', 'BHK', 'Carpet min', 'Carpet max', 'Price min ₹', 'Price max ₹', 'Total units', 'Available', ''].map((h) => <th key={h} className="px-1 pb-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="p-1"><input className={cell} placeholder="2 BHK Type A" value={r.name} onChange={(e) => set(i, 'name', e.target.value)} aria-label="Configuration name" /></td>
                {['bhk', 'carpetMin', 'carpetMax', 'priceMin', 'priceMax', 'totalUnits', 'availableUnits'].map((k) => (
                  <td key={k} className="p-1"><input className={cell} type="number" min={0} value={r[k]} onChange={(e) => set(i, k, e.target.value)} aria-label={k} /></td>
                ))}
                <td className="p-1"><Button variant="ghost" size="sm" icon={Trash2} disabled={rows.length === 1} aria-label="Remove configuration" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" icon={Plus} disabled={rows.length >= 30} onClick={() => setRows((x) => [...x, { ...EMPTY_CONFIG }])}>Add configuration</Button>
        <span className="text-xs text-ink-subtle">{rows.filter((r) => r.priceMin).map((r) => `${r.name || '?'}: ${shortRupees(Number(r.priceMin) * 100)}–${shortRupees(Number(r.priceMax || r.priceMin) * 100)}`).join(' · ')}</span>
      </div>
      <Footer saving={t.saving} onSave={save} />
    </div>
  );
}

export function AmenitiesTab({ project, next }) {
  const masters = useMasters();
  const [sel, setSel] = useState(new Set(project.amenities || []));
  const t = useTab(project, 'amenities', next);
  return (
    <div className="space-y-5">
      {t.error && <Alert tone="danger">{t.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {((masters.data && masters.data.amenities) || []).map((a) => {
          const on = sel.has(a.code);
          return (
            <button key={a.code} type="button" aria-pressed={on} onClick={() => setSel((x) => { const s = new Set(x); if (on) s.delete(a.code); else s.add(a.code); return s; })}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm', on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'bg-white text-ink-muted hover:border-brand-300')}>
              {on && <Check className="h-3.5 w-3.5" />}{a.name}
            </button>
          );
        })}
      </div>
      <Footer saving={t.saving} onSave={() => t.run({ amenities: [...sel] })} />
    </div>
  );
}

export function ReraTab({ project, next }) {
  const r = project.rera || {};
  const [mode, setMode] = useState(r.exempt && r.exempt.reason ? 'exempt' : 'registered');
  const [regs, setRegs] = useState((r.registrations || []).length ? r.registrations.map((x) => ({ number: x.number, state: x.state, phaseLabel: x.phaseLabel || '', url: x.url, certificateFileId: x.certificateFileId })) : [{ number: '', state: 'Maharashtra', phaseLabel: '', url: '', certificateFileId: '' }]);
  const [ex, setEx] = useState({ reason: r.exempt?.reason || 'plot_upto_500sqm', plotAreaSqm: r.exempt?.plotAreaSqm || '', units: r.exempt?.units || '', docFileId: r.exempt?.docFileId || '' });
  const t = useTab(project, 'rera', next);
  const set = (i, k, val) => setRegs((x) => x.map((y, j) => (j === i ? { ...y, [k]: val } : y)));
  const save = () => (mode === 'registered'
    ? t.run({ registrations: regs.map((x) => ({ number: x.number, state: x.state, url: x.url, certificateFileId: x.certificateFileId, ...(x.phaseLabel ? { phaseLabel: x.phaseLabel } : {}) })) })
    : t.run({ registrations: [], exempt: { reason: ex.reason, plotAreaSqm: Number(ex.plotAreaSqm), units: Number(ex.units), docFileId: ex.docFileId } }));
  return (
    <div className="space-y-5">
      {t.error && <Alert tone="danger">{t.error}</Alert>}
      <div className="inline-flex rounded-lg border bg-surface-muted p-1">
        {[['registered', 'RERA registered'], ['exempt', 'Exempt under Section 3(2)']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium', mode === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted')}>{l}</button>
        ))}
      </div>
      {mode === 'registered' ? (
        <div className="space-y-4">
          {regs.map((x, i) => (
            <div key={i} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <Input label="RERA number" required placeholder="P52100012345" value={x.number} onChange={(e) => set(i, 'number', e.target.value.toUpperCase())} />
              <Input label="State" required value={x.state} onChange={(e) => set(i, 'state', e.target.value)} />
              <Input label="Official RERA link" required className="sm:col-span-2" placeholder="https://maharera.maharashtra.gov.in/…" value={x.url} onChange={(e) => set(i, 'url', e.target.value)} />
              <Input label="Phase / tower (optional)" value={x.phaseLabel} onChange={(e) => set(i, 'phaseLabel', e.target.value)} />
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Certificate <span className="text-danger-600">*</span> {x.certificateFileId && <span className="text-xs text-success-700">uploaded</span>}</p>
                <FileDrop compact purpose="rera_certificate" kind="document" label={x.certificateFileId ? 'Replace' : 'Upload certificate'} onUploaded={(f) => set(i, 'certificateFileId', f.id)} />
              </div>
              {regs.length > 1 && <div className="sm:col-span-2"><Button variant="ghost" size="sm" icon={Trash2} onClick={() => setRegs((y) => y.filter((_, j) => j !== i))}>Remove</Button></div>}
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={Plus} disabled={regs.length >= 10} onClick={() => setRegs((y) => [...y, { number: '', state: y[0]?.state || '', phaseLabel: '', url: '', certificateFileId: '' }])}>Add registration (another phase)</Button>
        </div>
      ) : (
        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <Alert tone="info" className="sm:col-span-2">Exempt only if the plot is up to 500 sq m or the project has up to 8 units (all phases). Our team approves every exemption.</Alert>
          <Select label="Reason" value={ex.reason} onChange={(e) => setEx((y) => ({ ...y, reason: e.target.value }))} options={[{ value: 'plot_upto_500sqm', label: 'Plot up to 500 sq m' }, { value: 'upto_8_units', label: 'Up to 8 units' }]} />
          <div />
          <Input label="Plot area (sq m)" type="number" value={ex.plotAreaSqm} onChange={(e) => setEx((y) => ({ ...y, plotAreaSqm: e.target.value }))} />
          <Input label="Total units (all phases)" type="number" value={ex.units} onChange={(e) => setEx((y) => ({ ...y, units: e.target.value }))} />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-ink">Sanctioned plan <span className="text-danger-600">*</span> {ex.docFileId && <span className="text-xs text-success-700">uploaded</span>}</p>
            <FileDrop compact purpose="rera_certificate" kind="document" label={ex.docFileId ? 'Replace' : 'Upload sanctioned plan'} onUploaded={(f) => setEx((y) => ({ ...y, docFileId: f.id }))} />
          </div>
        </div>
      )}
      <Footer saving={t.saving} onSave={save} />
    </div>
  );
}
