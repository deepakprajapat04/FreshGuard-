/**
 * PSA-synced shipment tracking map (OpenStreetMap + Leaflet).
 */

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PsaEvent } from '../../lib/psa';

export interface MapShipment {
  id: string;
  vendor: string;
  item: string;
  product?: string;
  status: 'delayed' | 'on-time' | 'delivered';
  eta: string;
  origin: string;
  destination: string;
  temp: string;
  containerNumber?: string;
  vesselName?: string;
  voyageNumber?: string;
  psaTerminal?: string;
  psaSyncStatus?: string;
  psaLastSyncAt?: string;
  psaEvents?: PsaEvent[];
  currentLat?: number;
  currentLng?: number;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  transportMode?: 'ocean' | 'road' | 'multimodal';
  rerouted?: boolean;
}

const originIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:#6366f1;border:2px solid #fff;box-shadow:0 0 0 4px rgba(99,102,241,.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:#10b981;border:2px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function vesselIcon(delayed: boolean, delivered: boolean) {
  const color = delivered ? '#10b981' : delayed ? '#f43f5e' : '#0ea5e9';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px)">
      <div style="background:#0f172a;color:#e2e8f0;font:700 9px/1 monospace;padding:3px 6px;border-radius:6px;border:1px solid #334155;white-space:nowrap;margin-bottom:4px">LIVE</div>
      <div style="width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 12px ${color};display:flex;align-items:center;justify-content:center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      </div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 28],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) {
      if (points.length === 1) map.setView(points[0], 5);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 6 });
  }, [map, points]);
  return null;
}

function buildArc(
  start: [number, number],
  end: [number, number],
  bend = 0.18
): [number, number][] {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;
  const midLat = (lat1 + lat2) / 2 + (lng2 - lng1) * bend;
  const midLng = (lng1 + lng2) / 2 - (lat2 - lat1) * bend * 0.35;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const u = 1 - t;
    pts.push([
      u * u * lat1 + 2 * u * t * midLat + t * t * lat2,
      u * u * lng1 + 2 * u * t * midLng + t * t * lng2,
    ]);
  }
  return pts;
}

const DEFAULT_ORIGIN: [number, number] = [25.76, -80.19]; // Miami
const DEFAULT_DEST: [number, number] = [41.88, -87.63]; // Chicago

export function TrackingMap({ shipment }: { shipment: MapShipment | undefined }) {
  const geo = useMemo(() => {
    if (!shipment) return null;
    const origin: [number, number] = [
      shipment.originLat ?? DEFAULT_ORIGIN[0],
      shipment.originLng ?? DEFAULT_ORIGIN[1],
    ];
    const dest: [number, number] = [
      shipment.destLat ?? DEFAULT_DEST[0],
      shipment.destLng ?? DEFAULT_DEST[1],
    ];
    const current: [number, number] = [
      shipment.currentLat ?? (origin[0] + dest[0]) / 2,
      shipment.currentLng ?? (origin[1] + dest[1]) / 2,
    ];
    const route = buildArc(origin, dest, shipment.transportMode === 'ocean' ? 0.28 : 0.12);
    const eventPoints = (shipment.psaEvents || [])
      .filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number')
      .map((e) => ({ ...e, pos: [e.lat!, e.lng!] as [number, number] }));

    return { origin, dest, current, route, eventPoints };
  }, [shipment]);

  if (!shipment || !geo) {
    return (
      <div className="h-full min-h-[320px] flex items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs rounded-2xl border border-slate-800">
        Select a shipment to open the live PSA tracking map.
      </div>
    );
  }

  const delayed = shipment.status === 'delayed' && !shipment.rerouted;
  const delivered = shipment.status === 'delivered';
  const routeColor = delivered ? '#10b981' : delayed ? '#f43f5e' : '#38bdf8';

  return (
    <div className="relative h-full min-h-[360px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <div className="absolute top-3 left-3 z-[500] pointer-events-none space-y-1.5">
        <div className="bg-slate-950/90 backdrop-blur border border-slate-700 text-[9px] font-mono font-bold text-slate-200 px-2.5 py-1.5 rounded-lg shadow-lg">
          PSA PORTNET LIVE MAP · OSM
        </div>
        {shipment.containerNumber && (
          <div className="bg-emerald-950/90 backdrop-blur border border-emerald-700/50 text-[9px] font-mono font-bold text-emerald-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {shipment.containerNumber}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-[500] pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-[9px] font-mono text-slate-300 space-y-1 shadow-lg">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Origin</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-400" /> Vessel / asset</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Destination DC</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> PSA event</div>
        </div>
      </div>

      <MapContainer
        center={geo.current}
        zoom={4}
        className="h-full w-full bg-slate-950 [&_.leaflet-control-attribution]:text-[9px]"
        style={{ height: '100%', width: '100%', minHeight: 360 }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={[geo.origin, geo.current, geo.dest]} />

        <Polyline
          positions={geo.route}
          pathOptions={{
            color: routeColor,
            weight: 3,
            opacity: 0.85,
            dashArray: delayed ? '8 6' : undefined,
          }}
        />
        <Polyline
          positions={geo.route}
          pathOptions={{ color: routeColor, weight: 10, opacity: 0.12 }}
        />

        <Marker position={geo.origin} icon={originIcon}>
          <Popup>
            <div className="text-xs font-sans">
              <strong>Origin</strong>
              <div>{shipment.origin}</div>
              {shipment.psaTerminal && <div className="text-slate-500">Terminal: {shipment.psaTerminal}</div>}
            </div>
          </Popup>
        </Marker>

        <Marker position={geo.dest} icon={destIcon}>
          <Popup>
            <div className="text-xs font-sans">
              <strong>Destination</strong>
              <div>{shipment.destination || 'Chicago DC'}</div>
            </div>
          </Popup>
        </Marker>

        <Marker position={geo.current} icon={vesselIcon(delayed, delivered)}>
          <Popup>
            <div className="text-xs font-sans space-y-1 min-w-[180px]">
              <strong>{shipment.containerNumber || shipment.id}</strong>
              <div>{shipment.product || shipment.item}</div>
              <div>Vessel: {shipment.vesselName || 'Road fleet'}</div>
              <div>Temp: {shipment.temp}</div>
              <div>ETA: {shipment.eta}</div>
              <div>PSA: {shipment.psaSyncStatus || 'pending'}</div>
            </div>
          </Popup>
        </Marker>

        {geo.eventPoints.map((e) => (
          <CircleMarker
            key={e.id}
            center={e.pos}
            radius={5}
            pathOptions={{
              color: '#fbbf24',
              fillColor: '#f59e0b',
              fillOpacity: 0.9,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-xs font-sans">
                <strong>{e.label}</strong>
                <div>{e.location}</div>
                <div className="text-slate-500">{new Date(e.timestamp).toLocaleString()}</div>
                <div className="text-slate-500">Source: {e.source}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default TrackingMap;
