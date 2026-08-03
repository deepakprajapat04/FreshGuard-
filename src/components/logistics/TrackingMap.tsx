/**
 * PSA-synced shipment tracking map (Leaflet + natural basemap).
 * Route colors: green = completed, red = delayed stretch, orange = expected delay ahead.
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
  hasAnomaly?: boolean;
  /** Forecast delay ahead (orange stretch) even if not yet delayed */
  expectedDelay?: boolean;
}

const COLORS = {
  completed: '#16a34a',
  delayed: '#dc2626',
  expectedDelay: '#ea580c',
  remainingOk: '#0284c7',
  origin: '#4f46e5',
  dest: '#059669',
  event: '#d97706',
};

const originIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:${COLORS.origin};border:2px solid #fff;box-shadow:0 0 0 4px rgba(79,70,229,.28)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:${COLORS.dest};border:2px solid #fff;box-shadow:0 0 0 4px rgba(5,150,105,.28)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function vesselIcon(delayed: boolean, delivered: boolean) {
  const color = delivered ? COLORS.completed : delayed ? COLORS.delayed : '#0ea5e9';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px)">
      <div style="background:#fff;color:#0f172a;font:700 9px/1 Outfit,sans-serif;padding:3px 6px;border-radius:6px;border:1px solid #cbd5e1;white-space:nowrap;margin-bottom:4px;box-shadow:0 2px 8px rgba(0,0,0,.15)">LIVE</div>
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
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const u = 1 - t;
    pts.push([
      u * u * lat1 + 2 * u * t * midLat + t * t * lat2,
      u * u * lng1 + 2 * u * t * midLng + t * t * lng2,
    ]);
  }
  return pts;
}

function nearestIndex(route: [number, number][], point: [number, number]): number {
  let best = 0;
  let bestD = Infinity;
  route.forEach((p, i) => {
    const d = (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function isDelayEvent(e: PsaEvent): boolean {
  const t = `${e.code || ''} ${e.label || ''} ${e.details || ''}`.toLowerCase();
  return (
    t.includes('temp') ||
    t.includes('delay') ||
    t.includes('alert') ||
    t.includes('anomaly') ||
    t.includes('flood') ||
    t.includes('disrupt') ||
    t.includes('eta_revised')
  );
}

const DEFAULT_ORIGIN: [number, number] = [25.76, -80.19];
const DEFAULT_DEST: [number, number] = [41.88, -87.63];

type RouteSegments = {
  completed: [number, number][];
  delayed: [number, number][];
  expectedDelay: [number, number][];
  remainingOk: [number, number][];
};

function splitRouteSegments(
  route: [number, number][],
  current: [number, number],
  shipment: MapShipment,
  eventPoints: Array<PsaEvent & { pos: [number, number] }>
): RouteSegments {
  const progressIdx = Math.max(1, nearestIndex(route, current));
  const delayed = (shipment.status === 'delayed' || !!shipment.hasAnomaly) && !shipment.rerouted;
  const expectAhead = delayed || !!shipment.expectedDelay;
  const delivered = shipment.status === 'delivered';

  if (delivered) {
    return {
      completed: route,
      delayed: [],
      expectedDelay: [],
      remainingOk: [],
    };
  }

  // Locate where delay started along the path (PSA delay/alert event, else ~65% of completed)
  let delayStartIdx = Math.max(1, Math.floor(progressIdx * 0.55));
  const delayEvents = eventPoints.filter(isDelayEvent);
  if (delayEvents.length) {
    const idxs = delayEvents
      .map((e) => nearestIndex(route, e.pos))
      .filter((i) => i <= progressIdx && i >= 1);
    if (idxs.length) {
      delayStartIdx = Math.max(1, Math.min(...idxs, progressIdx - 1));
    }
  }

  const completedEnd = delayed ? delayStartIdx : progressIdx;
  const completed = route.slice(0, completedEnd + 1);
  const delayedSeg =
    delayed && progressIdx > delayStartIdx
      ? route.slice(delayStartIdx, progressIdx + 1)
      : [];
  const ahead = route.slice(progressIdx);

  return {
    completed: completed.length >= 2 ? completed : route.slice(0, Math.min(2, route.length)),
    delayed: delayedSeg.length >= 2 ? delayedSeg : [],
    expectedDelay: expectAhead && ahead.length >= 2 ? ahead : [],
    remainingOk: !expectAhead && ahead.length >= 2 ? ahead : [],
  };
}

function GlowLine({
  positions,
  color,
  dashed,
}: {
  positions: [number, number][];
  color: string;
  dashed?: boolean;
}) {
  if (positions.length < 2) return null;
  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{ color, weight: 10, opacity: 0.18, lineCap: 'round' }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color,
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          dashArray: dashed ? '10 8' : undefined,
        }}
      />
    </>
  );
}

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

    const segments = splitRouteSegments(route, current, shipment, eventPoints);
    return { origin, dest, current, route, eventPoints, segments };
  }, [shipment]);

  if (!shipment || !geo) {
    return (
      <div className="h-full min-h-[320px] flex items-center justify-center bg-slate-100 text-slate-500 text-xs rounded-2xl border border-slate-200">
        Select a shipment to open the live PSA tracking map.
      </div>
    );
  }

  const delayed = shipment.status === 'delayed' && !shipment.rerouted;
  const delivered = shipment.status === 'delivered';

  return (
    <div className="relative h-full min-h-[360px] w-full rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-[#c8e6c9]">
      <div className="absolute top-3 left-3 z-[500] pointer-events-none space-y-1.5">
        <div className="bg-white/95 backdrop-blur border border-slate-200 text-[9px] font-bold text-slate-700 px-2.5 py-1.5 rounded-lg shadow-md">
          PSA PORTNET LIVE MAP
        </div>
        {shipment.containerNumber && (
          <div className="bg-emerald-600 text-[9px] font-bold text-white px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
            {shipment.containerNumber}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-[500] pointer-events-none">
        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 text-[9px] text-slate-700 space-y-1 shadow-md">
          <div className="font-bold uppercase tracking-wide text-slate-500 mb-1">Route status</div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-emerald-600" /> Completed
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-red-600" /> Delayed stretch
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-orange-600" /> Expected delay ahead
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-sky-600" /> Remaining (on-time)
          </div>
          <div className="border-t border-slate-200 pt-1 mt-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Origin
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> Live asset
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> Destination
            </div>
          </div>
        </div>
      </div>

      <MapContainer
        center={geo.current}
        zoom={4}
        className="h-full w-full [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:bg-white/80"
        style={{ height: '100%', width: '100%', minHeight: 360 }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Natural green / street map (Google Maps–like) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <FitBounds points={[geo.origin, geo.current, geo.dest]} />

        <GlowLine positions={geo.segments.completed} color={COLORS.completed} />
        <GlowLine positions={geo.segments.delayed} color={COLORS.delayed} />
        <GlowLine positions={geo.segments.expectedDelay} color={COLORS.expectedDelay} dashed />
        <GlowLine positions={geo.segments.remainingOk} color={COLORS.remainingOk} />

        <Marker position={geo.origin} icon={originIcon}>
          <Popup>
            <div className="text-xs font-sans">
              <strong>Origin</strong>
              <div>{shipment.origin}</div>
              {shipment.psaTerminal && (
                <div className="text-slate-500">Terminal: {shipment.psaTerminal}</div>
              )}
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
              <div>Status: {shipment.status}</div>
              <div>PSA: {shipment.psaSyncStatus || 'pending'}</div>
            </div>
          </Popup>
        </Marker>

        {geo.eventPoints.map((e) => {
          const delayEv = isDelayEvent(e);
          return (
            <CircleMarker
              key={e.id}
              center={e.pos}
              radius={delayEv ? 7 : 5}
              pathOptions={{
                color: delayEv ? COLORS.delayed : COLORS.event,
                fillColor: delayEv ? COLORS.delayed : COLORS.event,
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs font-sans">
                  <strong>{e.label}</strong>
                  <div>{e.location}</div>
                  {e.details && <div className="text-rose-600 mt-0.5">{e.details}</div>}
                  <div className="text-slate-500">{new Date(e.timestamp).toLocaleString()}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default TrackingMap;
