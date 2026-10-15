// Public maps on OpenStreetMap tiles. Only the approximate public point the
// API sends is used (RE-B-04); detail pages draw a circle, never an exact pin.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { shortRupees } from '@/shared/lib/format';

const TILES = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' };
const INDIA = [20.5937, 78.9629];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const priceIcon = (text, active) => L.divIcon({
  className: '',
  html: `<span style="display:inline-block;transform:translate(-50%,-100%);white-space:nowrap;border-radius:9999px;padding:2px 8px;font:600 12px/18px Inter,system-ui,sans-serif;box-shadow:0 2px 6px rgba(16,24,40,.25);border:2px solid #fff;background:${active ? '#F29F05' : '#1F4E78'};color:${active ? '#101828' : '#fff'}">${esc(text)}</span>`,
  iconSize: [0, 0],
});

const clusterIcon = (count) => {
  const size = count > 99 ? 48 : count > 9 ? 40 : 34;
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;transform:translate(-50%,-50%);border-radius:9999px;background:rgba(31,78,120,.9);color:#fff;font:700 13px Inter,system-ui,sans-serif;border:3px solid rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(16,24,40,.3)">${count}</span>`,
    iconSize: [0, 0],
  });
};

const pinPrice = (c) => shortRupees(c.purpose === 'rent' ? c.price && c.price.monthlyRent : c.price && c.price.amount);

function BoundsWatcher({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange && onChange(boundsOf(map), map.getZoom()),
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; onChange && onChange(boundsOf(map), map.getZoom()); }
  }, [map, onChange]);
  return null;
}

function boundsOf(map) {
  const b = map.getBounds();
  const r = (n) => +n.toFixed(5);
  return { swLat: r(b.getSouth()), swLng: r(b.getWest()), neLat: r(b.getNorth()), neLng: r(b.getEast()) };
}

function Recenter({ center, zoom }) {
  const map = useMap();
  const key = center ? `${center[0]},${center[1]},${zoom}` : '';
  useEffect(() => { if (center) map.setView(center, zoom ?? map.getZoom()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ZoomTo({ target }) {
  const map = useMap();
  useEffect(() => { if (target) map.setView([target.lat, target.lng], Math.min(map.getZoom() + 2, 17)); }, [target, map]);
  return null;
}

/**
 * Search map: price pins (or clusters with counts) on public coordinates.
 * pins: public cards with .point; clusters: [{ lat, lng, count, minPrice }].
 */
export function SearchMap({ pins = [], clusters = [], center, zoom = 12, onBoundsChange, activeId, onPinClick, radius, height = '100%', zoomTarget, onClusterClick }) {
  return (
    <MapContainer center={center || INDIA} zoom={center ? zoom : 5} scrollWheelZoom style={{ height, width: '100%' }}>
      <TileLayer attribution={TILES.attribution} url={TILES.url} />
      <BoundsWatcher onChange={onBoundsChange} />
      <Recenter center={center} zoom={zoom} />
      <ZoomTo target={zoomTarget} />
      {radius && center && <Circle center={center} radius={radius * 1000} pathOptions={{ color: '#1F4E78', weight: 1, fillOpacity: 0.05 }} />}
      {pins.filter((c) => c.point).map((c) => (
        <Marker key={c.id} position={[c.point.lat, c.point.lng]} icon={priceIcon(pinPrice(c), c.id === activeId)} eventHandlers={{ click: () => onPinClick && onPinClick(c) }}>
          <Popup>
            <Link to={`/property/${c.slug}`} className="block w-48 text-ink no-underline">
              {c.cover && <img src={c.cover.url} alt="" className="mb-2 h-24 w-full rounded object-cover" />}
              <span className="block text-sm font-semibold">{pinPrice(c)}{c.purpose === 'rent' ? ' / month' : ''}</span>
              <span className="block text-xs leading-snug">{c.title}</span>
              <span className="block text-xs text-ink-subtle">{[c.locality, c.city].filter(Boolean).join(', ')}</span>
            </Link>
          </Popup>
        </Marker>
      ))}
      {clusters.map((c) => (
        <Marker key={`${c.lat},${c.lng}`} position={[c.lat, c.lng]} icon={clusterIcon(c.count)} eventHandlers={{ click: () => onClusterClick && onClusterClick(c) }} />
      ))}
    </MapContainer>
  );
}

// Detail map: a circle around the approximate public point.
export function ApproxMap({ point, height = 280 }) {
  if (!point) return null;
  const center = [point.lat, point.lng];
  return (
    <div className="overflow-hidden rounded-lg border" style={{ height }}>
      <MapContainer center={center} zoom={point.radiusM ? 15 : 16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution={TILES.attribution} url={TILES.url} />
        {point.radiusM
          ? <Circle center={center} radius={point.radiusM} pathOptions={{ color: '#1F4E78', weight: 2, fillColor: '#2E6599', fillOpacity: 0.15 }} />
          : <Circle center={center} radius={40} pathOptions={{ color: '#1F4E78', weight: 2, fillColor: '#F29F05', fillOpacity: 0.6 }} />}
      </MapContainer>
    </div>
  );
}
