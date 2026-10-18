// Step 2: city, locality (or a request for a new one), address, private unit
// number, pincode, exact map pin and up to 10 landmarks (RE-A-04/08).
import { useMemo, useState } from 'react';
import { Lock, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { Alert, Button, Input, Select } from '@/shared/ui';
import MapPicker from '@/shared/components/MapPicker';
import { geocode, useCities, useLocalities, useMasters } from '@/modules/listings/api';
import { num, StepFooter, StepMessages, useStepSave } from './common';
import { useT } from '@/shared/i18n';

export default function LocationStep({ listing, next, back }) {
  const t = useT();
  const loc = listing.location || {};
  const coords = loc.geo && loc.geo.coordinates;
  const cities = useCities();
  const masters = useMasters();
  const [v, setV] = useState({
    cityId: loc.cityId ? String(loc.cityId) : '', localityId: loc.localityId ? String(loc.localityId) : '', localityRequest: '',
    societyName: loc.societyName || '', addressLine: loc.addressLine || '', unitNo: loc.unitNo || '', pincode: loc.pincode || '',
    pin: coords ? { lat: coords[1], lng: coords[0] } : null, landmarks: loc.landmarks || [],
  });
  const [requesting, setRequesting] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const localities = useLocalities(v.cityId);
  const linked = Boolean(listing.projectId); // RE-G-07: location comes from the project; only the unit number is the lister's
  const body = () => (linked ? { ...(v.unitNo ? { unitNo: v.unitNo } : {}) } : v.pin && {
    cityId: v.cityId || undefined, ...(requesting ? { localityRequest: v.localityRequest } : { localityId: v.localityId || undefined }),
    ...(v.societyName ? { societyName: v.societyName } : {}), addressLine: v.addressLine, ...(v.unitNo ? { unitNo: v.unitNo } : {}), pincode: v.pincode,
    lat: v.pin.lat, lng: v.pin.lng,
    landmarks: v.landmarks.filter((l) => l.name).map((l) => ({ type: l.type || 'other', name: l.name, ...(num(l.distanceKm) !== undefined ? { distanceKm: num(l.distanceKm) } : {}) })),
  });
  const s = useStepSave(listing, 2, { onSaved: next, value: v, build: body });
  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));

  const city = (cities.data || []).find((c) => c._id === v.cityId);
  const locality = (localities.data || []).find((l) => l._id === v.localityId);
  const center = useMemo(() => {
    const c = (locality && locality.meta && locality.meta.centroid) || (city && city.meta && city.meta.centroid);
    return c ? [c.coordinates[1], c.coordinates[0]] : null;
  }, [city, locality]);

  const search = async () => {
    setGeoError(null);
    try { const r = await geocode(`${q}${city ? `, ${city.name}` : ''}`); setResults(r); if (!r.length) setGeoError(t('lister.wizard.loc.noMatch')); } catch (e) { setGeoError(e.message); }
  };

  const save = () => s.run(body() || {}); // without a pin the API reports every missing field at once

  if (linked) {
    return (
      <div className="space-y-6">
        <StepMessages formError={s.formError} />
        <Alert tone="info">{t('lister.wizard.loc.fromProject')}{listing.project ? ` (${listing.project.name})` : ''}: {[loc.societyName, loc.locality, loc.city, loc.pincode].filter(Boolean).join(', ')}. {t('lister.wizard.loc.changeOnProject')}</Alert>
        <Input label={t('lister.wizard.loc.unitNo')} value={v.unitNo} onChange={(e) => set('unitNo', e.target.value)} leading={<Lock className="h-3.5 w-3.5" />} hint={t('lister.wizard.loc.unitHint')} error={s.errors.unitNo} />
        <StepFooter onBack={back} saving={s.saving} onSave={save} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} warnings={s.warnings} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('common.city')} required placeholder={t('lister.wizard.loc.chooseCity')} value={v.cityId} onChange={(e) => setV((x) => ({ ...x, cityId: e.target.value, localityId: '' }))}
          options={(cities.data || []).map((c) => ({ value: c._id, label: c.name }))} error={s.errors.cityId} />
        {!requesting ? (
          <div>
            <Select label={t('lister.wizard.loc.locality')} required placeholder={v.cityId ? t('lister.wizard.loc.chooseLocality') : t('lister.wizard.loc.cityFirst')} disabled={!v.cityId} value={v.localityId} onChange={(e) => set('localityId', e.target.value)}
              options={(localities.data || []).map((l) => ({ value: l._id, label: l.name }))} error={s.errors.localityId} />
            {v.cityId && <button type="button" className="mt-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setRequesting(true)}>{t('lister.wizard.loc.notListed')}</button>}
          </div>
        ) : (
          <div>
            <Input label={t('lister.wizard.loc.newLocality')} required value={v.localityRequest} onChange={(e) => set('localityRequest', e.target.value)} hint={t('lister.wizard.loc.newLocalityHint')} error={s.errors.localityRequest || s.errors.localityId} />
            <button type="button" className="mt-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setRequesting(false)}>{t('lister.wizard.loc.pickList')}</button>
          </div>
        )}
        <Input label={t('lister.wizard.loc.society')} value={v.societyName} onChange={(e) => set('societyName', e.target.value)} />
        <Input label={t('lister.kyc.details.pincode')} required inputMode="numeric" maxLength={6} value={v.pincode} onChange={(e) => set('pincode', e.target.value)} error={s.errors.pincode} />
        <Input label={t('lister.kyc.details.address')} required className="sm:col-span-2" value={v.addressLine} onChange={(e) => set('addressLine', e.target.value)} error={s.errors.addressLine}
          hint={t('lister.wizard.loc.addressHint')} />
        <Input label={t('lister.wizard.loc.unitNo')} value={v.unitNo} onChange={(e) => set('unitNo', e.target.value)} leading={<Lock className="h-3.5 w-3.5" />} hint={t('lister.wizard.loc.unitHint')} />
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{t('lister.wizard.loc.exact')} <span className="text-danger-600">*</span></p>
            <p className="text-xs text-ink-subtle">{t('lister.wizard.loc.exactHint')}</p>
          </div>
          {v.pin && <span className="text-xs text-ink-subtle">{v.pin.lat}, {v.pin.lng}</span>}
        </div>
        <div className="mb-3 flex gap-2">
          <input className="h-10 flex-1 rounded-md border border-line-strong px-3 text-sm focus:border-brand-500 focus:outline-none" placeholder={t('lister.wizard.loc.searchPh')} value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
          <Button variant="secondary" icon={Search} onClick={search} disabled={q.trim().length < 3}>{t('lister.wizard.loc.find')}</Button>
        </div>
        {results && results.length > 0 && (
          <ul className="mb-3 divide-y rounded-md border bg-white text-sm">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}><button type="button" className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-muted" onClick={() => { set('pin', { lat: r.lat, lng: r.lng }); setResults(null); }}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{r.label}</button></li>
            ))}
          </ul>
        )}
        {geoError && <p className="mb-2 text-xs text-ink-subtle">{geoError}</p>}
        <MapPicker value={v.pin} center={center} onChange={(p) => set('pin', p)} />
        {!v.pin && s.formError && <p className="mt-1 text-xs text-danger-600">{t('lister.wizard.loc.dropPin')}</p>}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{t('lister.wizard.loc.landmarks')} <span className="text-xs font-normal text-ink-subtle">({t('lister.wizard.loc.upTo10')})</span></p>
          <Button variant="secondary" size="sm" icon={Plus} disabled={v.landmarks.length >= 10} onClick={() => set('landmarks', [...v.landmarks, { type: 'other', name: '', distanceKm: '' }])}>{t('lister.wizard.loc.addLandmark')}</Button>
        </div>
        {v.landmarks.length === 0 && <p className="text-sm text-ink-subtle">{t('lister.wizard.loc.landmarksHint')}</p>}
        <ul className="space-y-2">
          {v.landmarks.map((l, i) => (
            <li key={i} className="grid grid-cols-[1fr_2fr_90px_auto] gap-2">
              <select className="h-10 rounded-md border border-line-strong px-2 text-sm" value={l.type} onChange={(e) => set('landmarks', v.landmarks.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} aria-label={t('lister.wizard.loc.landmarkType')}>
                {((masters.data && masters.data.landmarkTypes) || [{ code: 'other', name: t('lister.listings.offReasons.other') }]).map((lt) => <option key={lt.code} value={lt.code}>{lt.name}</option>)}
              </select>
              <input className="h-10 rounded-md border border-line-strong px-3 text-sm" placeholder={t('lister.wizard.loc.name')} value={l.name} onChange={(e) => set('landmarks', v.landmarks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={t('lister.wizard.loc.landmarkName')} />
              <input className="h-10 rounded-md border border-line-strong px-3 text-sm" placeholder={t('lister.wizard.loc.km')} inputMode="decimal" value={l.distanceKm ?? ''} onChange={(e) => set('landmarks', v.landmarks.map((x, j) => (j === i ? { ...x, distanceKm: e.target.value } : x)))} aria-label={t('lister.wizard.loc.distance')} />
              <Button variant="ghost" size="sm" icon={Trash2} aria-label={t('lister.wizard.loc.removeLandmark')} onClick={() => set('landmarks', v.landmarks.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      </div>
      {!v.pin && <Alert tone="info">{t('lister.wizard.loc.placePin')}</Alert>}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </div>
  );
}
