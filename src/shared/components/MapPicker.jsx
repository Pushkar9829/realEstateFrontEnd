// Exact location picker (RE-A-04): OpenStreetMap tiles, a draggable pin and
// click-to-move. The exact pin stays private; the public map uses an offset pin.
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Inline SVG pin (bundlers break Leaflet's default image icon paths).
const pin = L.divIcon({
  className: '',
  html: '<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg"><path d="M17 43s15-14.3 15-26A15 15 0 0 0 2 17c0 11.7 15 26 15 26z" fill="#1F4E78" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="6" fill="#F29F05"/></svg>',
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

function ClickToMove({ onChange }) {
  useMapEvents({ click: (e) => onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }) });
  return null;
}

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom ?? map.getZoom()); }, [center && center[0], center && center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapPicker({ value, center, onChange, height = 320 }) {
  const pos = value ? [value.lat, value.lng] : null;
  const start = pos || center || [20.5937, 78.9629];
  return (
    <div className="overflow-hidden rounded-lg border" style={{ height }}>
      <MapContainer center={start} zoom={pos ? 16 : center ? 13 : 5} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToMove onChange={onChange} />
        <Recenter center={pos || center} zoom={pos ? 16 : 13} />
        {pos && (
          <Marker position={pos} icon={pin} draggable
            eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); onChange({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }); } }} />
        )}
      </MapContainer>
    </div>
  );
}
