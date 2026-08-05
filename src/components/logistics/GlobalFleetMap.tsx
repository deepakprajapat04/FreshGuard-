/**
 * Global fleet map — all in-transit lots on a world map.
 * Toggle: Land (road) · Sea (vessel) · Air (flight) · All.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Plane, Ship, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Shipment } from '../../lib/shipmentTypes';

export type FleetMapFilter = 'all' | 'ocean' | 'air' | 'road';

type Props = {
  shipments: Shipment[];
  selectedId?: string;
  filter: FleetMapFilter;
  onFilterChange: (f: FleetMapFilter) => void;
  /** Select lot on map (stay on All lots) */
  onSelect: (id: string) => void;
  /** Open detailed one-lot route map */
  onOpenLot?: (id: string) => void;
};

const MODE_COLOR: Record<'ocean' | 'air' | 'road' | 'multimodal', string> = {
  ocean: '#ea580c',
  air: '#2563eb',
  road: '#16a34a',
  multimodal: '#7c3aed',
};

function statusColor(s: Shipment): string {
  if (s.status === 'delayed' || s.hasAnomaly) return '#dc2626';
  if (s.status === 'delivered') return '#16a34a';
  const mode = s.transportMode || 'road';
  return MODE_COLOR[mode] || MODE_COLOR.road;
}

function modeIconSvg(mode: string): string {
  if (mode === 'ocean') {
    return `<path d="M3 17h18l-2-5H5l-2 5zm9-13l4 6H8l4-6z" fill="white"/>`;
  }
  if (mode === 'air') {
    return `<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" fill="white"/>`;
  }
  return `<path d="M3 17h2v2H3v-2zm4 0h11v2H7v-2zm13-7H4l-1 4h17l-1-4zM5 8h14l1 2H4l1-2z" fill="white"/>`;
}

function fleetMarkerIcon(s: Shipment, selected: boolean) {
  const color = statusColor(s);
  const mode = s.transportMode || 'road';
  const ring = selected ? '0 0 0 4px rgba(14,165,233,.55)' : `0 0 0 3px ${color}44`;
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:${ring};display:flex;align-items:center;justify-content:center">
      <svg width="14" height="14" viewBox="0 0 24 24">${modeIconSvg(mode)}</svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Fix blank map when container size changes (All lots ↔ One lot). */
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t1 = window.setTimeout(fix, 50);
    const t2 = window.setTimeout(fix, 250);
    const t3 = window.setTimeout(fix, 600);
    window.addEventListener('resize', fix);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (!points.length) {
      map.setView([20, 0], 2);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 4);
      return;
    }
    try {
      map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 4 });
    } catch {
      map.setView([20, 0], 2);
    }
  }, [map, points]);
  return null;
}

function positionOf(s: Shipment): [number, number] | null {
  if (typeof s.currentLat === 'number' && typeof s.currentLng === 'number') {
    return [s.currentLat, s.currentLng];
  }
  if (typeof s.originLat === 'number' && typeof s.originLng === 'number') {
    return [s.originLat, s.originLng];
  }
  return null;
}

export function GlobalFleetMap({
  shipments,
  selectedId,
  filter,
  onFilterChange,
  onSelect,
  onOpenLot,
}: Props) {
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street');

  const visible = useMemo(() => {
    return shipments.filter((s) => {
      if (s.stage === 'packing') return false;
      if (filter === 'all') return true;
      const mode = s.transportMode || 'road';
      if (filter === 'ocean') return mode === 'ocean' || mode === 'multimodal';
      if (filter === 'air') return mode === 'air';
      if (filter === 'road') return mode === 'road';
      return true;
    });
  }, [shipments, filter]);

  const points = useMemo(() => {
    const pts: [number, number][] = [];
    visible.forEach((s) => {
      const p = positionOf(s);
      if (p) pts.push(p);
    });
    return pts;
  }, [visible]);

  const counts = useMemo(() => {
    const c = { all: 0, ocean: 0, air: 0, road: 0 };
    shipments.forEach((s) => {
      if (s.stage === 'packing') return;
      c.all += 1;
      const mode = s.transportMode || 'road';
      if (mode === 'ocean' || mode === 'multimodal') c.ocean += 1;
      else if (mode === 'air') c.air += 1;
      else c.road += 1;
    });
    return c;
  }, [shipments]);

  const filterLabel =
    filter === 'ocean'
      ? 'Sea vessels'
      : filter === 'air'
        ? 'Air flights'
        : filter === 'road'
          ? 'Land trucks'
          : 'All shipments';

  return (
    <div className="relative h-full min-h-[420px] w-full rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-[#c8e6c9]">
      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="bg-[#0c1e36]/95 text-white text-[11px] font-semibold px-3 py-2 rounded-lg shadow-md border border-sky-900/60">
            Global fleet map · {filterLabel}: {visible.length}
          </div>
          <div className="flex bg-[#0c1e36]/95 rounded-lg shadow-md border border-sky-900/60 p-0.5">
            <button
              type="button"
              onClick={() => setBasemap('street')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase',
                basemap === 'street' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              )}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setBasemap('satellite')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase',
                basemap === 'satellite' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              )}
            >
              Satellite
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#0c1e36]/95 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-md border border-sky-900/60">
            In transit: {counts.all}
          </div>
          <div className="flex bg-[#0c1e36]/95 rounded-lg shadow-md border border-sky-900/60 p-0.5">
            {(
              [
                ['all', Box, 'All', counts.all],
                ['road', Truck, 'Land', counts.road],
                ['ocean', Ship, 'Sea', counts.ocean],
                ['air', Plane, 'Air', counts.air],
              ] as const
            ).map(([id, Icon, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => onFilterChange(id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1',
                  filter === id ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
                )}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
                <span className="opacity-80">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[500] pointer-events-none">
        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 text-[9px] text-slate-700 space-y-1 shadow-md">
          <div className="font-bold uppercase tracking-wide text-slate-500 mb-1">Marker color</div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Sea (ocean)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Air
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Land (road)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Delayed
          </div>
        </div>
      </div>

      <MapContainer
        key={`fleet-${basemap}`}
        center={[20, 0]}
        zoom={2}
        className="h-full w-full [&_.leaflet-control-attribution]:text-[9px] [&_.leaflet-control-attribution]:bg-white/80"
        style={{ height: '100%', width: '100%', minHeight: 420, position: 'absolute', inset: 0 }}
        zoomControl
        scrollWheelZoom
        worldCopyJump
      >
        {/* Default: same working street map as One Lot. Satellite optional. */}
        {basemap === 'street' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
        ) : (
          <>
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              attribution=""
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              opacity={0.9}
              maxZoom={19}
            />
          </>
        )}

        <MapInvalidateSize />
        <FitAll points={points} />

        {visible.map((s) => {
          const pos = positionOf(s);
          if (!pos) return null;
          const selected = s.id === selectedId;
          const origin: [number, number] | null =
            typeof s.originLat === 'number' && typeof s.originLng === 'number'
              ? [s.originLat, s.originLng]
              : null;
          const dest: [number, number] | null =
            typeof s.destLat === 'number' && typeof s.destLng === 'number'
              ? [s.destLat, s.destLng]
              : null;

          return (
            <Fragment key={s.id}>
              {selected && origin && dest && (
                <Polyline
                  positions={[origin, pos, dest]}
                  pathOptions={{
                    color: statusColor(s),
                    weight: 2,
                    opacity: 0.75,
                    dashArray: '6 8',
                  }}
                />
              )}
              <Marker
                position={pos}
                icon={fleetMarkerIcon(s, selected)}
                eventHandlers={{
                  click: () => onSelect(s.id),
                }}
              >
                <Popup>
                  <div className="text-xs font-sans space-y-1 min-w-[180px]">
                    <strong>{s.containerNumber || s.id}</strong>
                    <div>{s.product || s.item}</div>
                    <div>Mode: {(s.transportMode || 'road').toUpperCase()}</div>
                    <div>Status: {s.status}</div>
                    <div>ETA: {s.eta}</div>
                    <div className="text-slate-500">
                      {s.origin} → {s.destination}
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-[10px] font-bold uppercase text-sky-700"
                      onClick={() => (onOpenLot || onSelect)(s.id)}
                    >
                      Open one-lot map
                    </button>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>

      {visible.length === 0 && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-slate-900/40 pointer-events-none">
          <div className="bg-white/95 rounded-xl px-4 py-3 text-xs text-slate-600 font-medium shadow-lg">
            No lots in this view. Try All / Land / Sea / Air.
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalFleetMap;
