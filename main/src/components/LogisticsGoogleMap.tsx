import { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Navigation, Activity } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

interface Shipment {
  id: string;
  vendor: string;
  item: string;
  product: string;
  quantity: number;
  unit: string;
  fleetSpecification: string;
  logisticsRouteAndProvider: string;
  status: 'delayed' | 'on-time' | 'delivered';
  eta: string;
  origin: string;
  destination: string;
  temp: string;
  route: string;
  date: string;
  hasAnomaly?: boolean;
  rerouted?: boolean;
}

interface LogisticsGoogleMapProps {
  selectedShipment: Shipment | null;
  onSelectShipment?: (shipmentId: string) => void;
  isScanningWeather?: boolean;
}

const MAPS_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey =
  Boolean(MAPS_KEY) && MAPS_KEY !== 'YOUR_API_KEY' && MAPS_KEY.trim() !== '';

type ViewMode = 'roadmap' | 'satellite';

const STREET_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
};

const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri',
};

const SATELLITE_LABELS = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  attribution: '',
};

function getCoordinatesForRoute(shipment: Shipment | null) {
  if (!shipment) {
    return {
      origin: { lat: 47.6062, lng: -122.3321 },
      dest: { lat: 41.8781, lng: -87.6298 },
      originName: 'Seattle Fishery Warehouse, WA',
      destName: 'Chicago DC East, IL',
    };
  }
  const id = shipment.id;

  if (id.includes('8842')) {
    return {
      origin: { lat: 25.7617, lng: -80.1918 },
      dest: { lat: 41.8781, lng: -87.6298 },
      originName: 'Miami Port, FL',
      destName: 'Chicago DC East, IL',
    };
  }
  if (id.includes('9912')) {
    return {
      origin: { lat: 47.6062, lng: -122.3321 },
      dest: { lat: 41.8781, lng: -87.6298 },
      originName: 'Seattle Fishery Warehouse',
      destName: 'Chicago DC East, IL',
    };
  }
  if (id.includes('7731')) {
    return {
      origin: { lat: 44.5191, lng: -88.0198 },
      dest: { lat: 41.8781, lng: -87.6298 },
      originName: 'Wisconsin Farm Store, WI',
      destName: 'Chicago DC East, IL',
    };
  }
  return {
    origin: { lat: 37.8044, lng: -122.2711 },
    dest: { lat: 41.8781, lng: -87.6298 },
    originName: 'Oakland Port, CA',
    destName: 'Chicago DC East, IL',
  };
}

function curvedPath(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  steps = 48
): L.LatLng[] {
  const midLat = (origin.lat + dest.lat) / 2 + 1.2;
  const midLng = (origin.lng + dest.lng) / 2;
  const points: L.LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat =
      (1 - t) * (1 - t) * origin.lat + 2 * (1 - t) * t * midLat + t * t * dest.lat;
    const lng =
      (1 - t) * (1 - t) * origin.lng + 2 * (1 - t) * t * midLng + t * t * dest.lng;
    points.push(L.latLng(lat, lng));
  }
  return points;
}

function dotIcon(color: string, size = 14) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function vehicleIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:8px;
      background:#4f46e5;border:2px solid #fff;
      box-shadow:0 4px 14px rgba(79,70,229,0.55);
      display:flex;align-items:center;justify-content:center;
    "><div style="width:8px;height:8px;border-radius:50%;background:#10b981"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function LogisticsGoogleMap({
  selectedShipment,
  isScanningWeather = false,
}: LogisticsGoogleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const googleRendererRef = useRef<any>(null);
  const googleOverlaysRef = useRef<any[]>([]);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletLayersRef = useRef<L.LayerGroup | null>(null);
  const leafletBaseRef = useRef<L.Layer[]>([]);

  const [useGoogle, setUseGoogle] = useState(hasValidKey);
  const [googleReady, setGoogleReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('roadmap');

  const routeCoords = getCoordinatesForRoute(selectedShipment);
  const isRerouted = !!selectedShipment?.rerouted;
  const hasAnomaly = selectedShipment?.status === 'delayed' && !isRerouted;

  const clearGoogleOverlays = useCallback(() => {
    googleOverlaysRef.current.forEach((o) => o.setMap?.(null));
    googleOverlaysRef.current = [];
  }, []);

  // Google auth failure → fall back to Leaflet
  useEffect(() => {
    window.gm_authFailure = () => {
      console.warn('Google Maps auth failed — using OpenStreetMap.');
      setUseGoogle(false);
    };
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!useGoogle) return;
    if (window.google?.maps) {
      setGoogleReady(true);
      return;
    }

    const existing = document.getElementById('google-maps-bootstrap-loader');
    if (existing) {
      const interval = setInterval(() => {
        if (window.google?.maps) {
          setGoogleReady(true);
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.id = 'google-maps-bootstrap-loader';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&v=weekly&libraries=geometry,places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setUseGoogle(false);
    document.head.appendChild(script);
  }, [useGoogle]);

  // Init Google Map
  useEffect(() => {
    if (!useGoogle || !googleReady || !mapContainerRef.current || !window.google?.maps) return;

    const g = window.google.maps;
    const center = {
      lat: (routeCoords.origin.lat + routeCoords.dest.lat) / 2,
      lng: (routeCoords.origin.lng + routeCoords.dest.lng) / 2,
    };

    if (!googleMapRef.current) {
      googleMapRef.current = new g.Map(mapContainerRef.current, {
        center,
        zoom: 5,
        mapTypeId: viewMode === 'satellite' ? g.MapTypeId.HYBRID : g.MapTypeId.ROADMAP,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      });
      googleRendererRef.current = new g.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: hasAnomaly ? '#ef4444' : '#4f46e5',
          strokeWeight: 5,
          strokeOpacity: 0.9,
        },
      });
    } else {
      googleMapRef.current.setMapTypeId(
        viewMode === 'satellite' ? g.MapTypeId.HYBRID : g.MapTypeId.ROADMAP
      );
    }
  }, [useGoogle, googleReady, viewMode, routeCoords.origin, routeCoords.dest, hasAnomaly]);

  // Google route + markers
  useEffect(() => {
    if (!useGoogle || !googleReady || !googleMapRef.current || !window.google?.maps) return;

    const g = window.google.maps;
    const map = googleMapRef.current;
    clearGoogleOverlays();

    const origin = new g.LatLng(routeCoords.origin.lat, routeCoords.origin.lng);
    const dest = new g.LatLng(routeCoords.dest.lat, routeCoords.dest.lng);

    const originMarker = new g.Marker({
      position: origin,
      map,
      title: routeCoords.originName,
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#4f46e5',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    const destMarker = new g.Marker({
      position: dest,
      map,
      title: routeCoords.destName,
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    googleOverlaysRef.current.push(originMarker, destMarker);

    const directionsService = new g.DirectionsService();
    directionsService.route(
      { origin, destination: dest, travelMode: g.TravelMode.DRIVING },
      (result: any, status: any) => {
        if (status === g.DirectionsStatus.OK && result) {
          googleRendererRef.current?.setDirections(result);
          const legs = result.routes[0].legs[0];
          const mid =
            legs.steps[Math.floor(legs.steps.length / 2)]?.end_location || legs.end_location;
          const vehicle = new g.Marker({
            position: mid,
            map,
            title: 'Active carrier',
            icon: {
              path: g.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4f46e5',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          googleOverlaysRef.current.push(vehicle);
          if (result.routes[0].bounds) map.fitBounds(result.routes[0].bounds, 48);
        } else {
          googleRendererRef.current?.setDirections({ routes: [] });
          const path = curvedPath(routeCoords.origin, routeCoords.dest).map(
            (p) => new g.LatLng(p.lat, p.lng)
          );
          const line = new g.Polyline({
            path,
            strokeColor: hasAnomaly ? '#ef4444' : '#4f46e5',
            strokeWeight: 5,
            strokeOpacity: 0.9,
            map,
          });
          googleOverlaysRef.current.push(line);
          const mid = path[Math.floor(path.length / 2)];
          const vehicle = new g.Marker({ position: mid, map, title: 'Active carrier' });
          googleOverlaysRef.current.push(vehicle);
          const bounds = new g.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(dest);
          map.fitBounds(bounds, 48);
        }
      }
    );

    if (hasAnomaly) {
      let hazard: { lat: number; lng: number } | null = null;
      if (selectedShipment?.id.includes('8842')) hazard = { lat: 27.6648, lng: -81.5158 };
      else if (selectedShipment?.id.includes('9912')) hazard = { lat: 47.7511, lng: -120.7401 };

      if (hazard) {
        const circle = new g.Circle({
          map,
          center: hazard,
          radius: 120000,
          strokeColor: '#ef4444',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: '#ef4444',
          fillOpacity: 0.2,
        });
        googleOverlaysRef.current.push(circle);
      }
    }
  }, [
    useGoogle,
    googleReady,
    selectedShipment,
    routeCoords,
    hasAnomaly,
    clearGoogleOverlays,
  ]);

  // Tear down Google map when falling back to Leaflet
  useEffect(() => {
    if (!useGoogle && googleMapRef.current) {
      googleMapRef.current = null;
      googleRendererRef.current = null;
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = '';
      }
    }
  }, [useGoogle]);

  // Leaflet map (OpenStreetMap / Esri — no API key required)
  useEffect(() => {
    if (useGoogle || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([39.5, -98.5], 4);

      leafletLayersRef.current = L.layerGroup().addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;

    leafletBaseRef.current.forEach((layer) => map.removeLayer(layer));
    leafletBaseRef.current = [];

    if (viewMode === 'satellite') {
      leafletBaseRef.current.push(
        L.tileLayer(SATELLITE_TILES.url, { attribution: SATELLITE_TILES.attribution, maxZoom: 19 }).addTo(map)
      );
      leafletBaseRef.current.push(
        L.tileLayer(SATELLITE_LABELS.url, { attribution: '', maxZoom: 19, pane: 'overlayPane' }).addTo(map)
      );
    } else {
      leafletBaseRef.current.push(
        L.tileLayer(STREET_TILES.url, { attribution: STREET_TILES.attribution, maxZoom: 19 }).addTo(map)
      );
    }

    leafletLayersRef.current?.clearLayers();

    const path = curvedPath(routeCoords.origin, routeCoords.dest);
    L.polyline(path, {
      color: hasAnomaly ? '#ef4444' : '#4f46e5',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
    }).addTo(leafletLayersRef.current!);

    L.polyline(path, {
      color: '#ffffff',
      weight: 2,
      opacity: 0.6,
      dashArray: '8, 12',
      lineCap: 'round',
    }).addTo(leafletLayersRef.current!);

    L.marker([routeCoords.origin.lat, routeCoords.origin.lng], {
      icon: dotIcon('#4f46e5', 16),
      title: routeCoords.originName,
    })
      .bindPopup(`<strong>Origin</strong><br/>${routeCoords.originName}`)
      .addTo(leafletLayersRef.current!);

    L.marker([routeCoords.dest.lat, routeCoords.dest.lng], {
      icon: dotIcon('#10b981', 16),
      title: routeCoords.destName,
    })
      .bindPopup(`<strong>Destination</strong><br/>${routeCoords.destName}`)
      .addTo(leafletLayersRef.current!);

    const mid = path[Math.floor(path.length / 2)];
    L.marker(mid, {
      icon: vehicleIcon(),
      title: 'Active carrier',
    })
      .bindPopup(
        `<div style="font-family:monospace;font-size:11px;line-height:1.5">
          <strong style="color:#4f46e5">Live telemetry</strong><br/>
          ${selectedShipment?.vendor || 'Carrier'} · ${selectedShipment?.temp || '3.2°C'}<br/>
          Container MSKU-${selectedShipment?.id || '7842'}
        </div>`
      )
      .addTo(leafletLayersRef.current!);

    if (hasAnomaly) {
      let hazard: { lat: number; lng: number } | null = null;
      if (selectedShipment?.id.includes('8842')) hazard = { lat: 27.6648, lng: -81.5158 };
      else if (selectedShipment?.id.includes('9912')) hazard = { lat: 47.7511, lng: -120.7401 };

      if (hazard) {
        L.circle(hazard, {
          radius: 120000,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '6, 6',
        })
          .bindPopup('<strong style="color:#ef4444">Climate hazard zone</strong>')
          .addTo(leafletLayersRef.current!);
      }
    }

    map.fitBounds(L.latLngBounds(path), { padding: [48, 48] });

    return () => {
      // keep map instance; layers cleared on next run
    };
  }, [useGoogle, viewMode, selectedShipment, routeCoords, hasAnomaly]);

  // Cleanup Leaflet on unmount
  useEffect(() => {
    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  const handleZoomIn = () => {
    if (useGoogle && googleMapRef.current) {
      googleMapRef.current.setZoom(googleMapRef.current.getZoom() + 1);
    } else {
      leafletMapRef.current?.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (useGoogle && googleMapRef.current) {
      googleMapRef.current.setZoom(googleMapRef.current.getZoom() - 1);
    } else {
      leafletMapRef.current?.zoomOut();
    }
  };

  const handleRecenter = () => {
    const path = curvedPath(routeCoords.origin, routeCoords.dest);
    if (useGoogle && googleMapRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(new window.google.maps.LatLng(routeCoords.origin.lat, routeCoords.origin.lng));
      bounds.extend(new window.google.maps.LatLng(routeCoords.dest.lat, routeCoords.dest.lng));
      googleMapRef.current.fitBounds(bounds, 48);
    } else {
      leafletMapRef.current?.fitBounds(L.latLngBounds(path), { padding: [48, 48] });
    }
  };

  const mapLabel = useGoogle ? 'Google Maps' : 'OpenStreetMap';

  return (
    <div
      id="logistics-gps-engine-container"
      className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 relative overflow-hidden shadow-lg flex flex-col min-h-[460px]"
    >
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1 select-none pointer-events-none">
        <div className="text-[9px] text-slate-800 dark:text-white font-mono tracking-widest uppercase font-extrabold flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg shadow-md">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          Live fleet map · {mapLabel}
        </div>
        <div className="text-[7.5px] text-slate-600 dark:text-slate-400 font-mono bg-white/90 dark:bg-slate-900/80 px-1.5 py-0.5 rounded w-fit border border-slate-200 dark:border-slate-800">
          {routeCoords.originName.split(',')[0]} → {routeCoords.destName.split(',')[0]}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
        <div className="flex bg-white/95 dark:bg-slate-900/95 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 shadow-md">
          <button
            type="button"
            onClick={() => setViewMode('roadmap')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all cursor-pointer ${
              viewMode === 'roadmap'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Street map
          </button>
          <button
            type="button"
            onClick={() => setViewMode('satellite')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all cursor-pointer ${
              viewMode === 'satellite'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Satellite
          </button>
        </div>

        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom in"
          className="p-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-md"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom out"
          className="p-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-md"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
        >
          <Navigation className="w-3.5 h-3.5 rotate-45 shrink-0" /> Recenter
        </button>
      </div>

      <div className="flex-1 w-full relative min-h-[460px]">
        <div ref={mapContainerRef} className="w-full h-full min-h-[460px] z-0" />

        {useGoogle && !googleReady && (
          <div className="absolute inset-0 z-[999] flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-3 bg-slate-100/90 dark:bg-slate-900/90">
            <span className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span>Loading map…</span>
          </div>
        )}

        {isScanningWeather && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-white/95 dark:bg-slate-900/95 border border-cyan-400/50 px-3 py-1.5 rounded-lg shadow-lg font-mono text-[9px] text-cyan-600 dark:text-cyan-400 font-extrabold tracking-wider animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Scanning weather corridors…
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-[1000] pointer-events-none text-[8px] font-mono text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
        {viewMode === 'satellite' ? 'Satellite imagery' : 'Street map'} · GIS active
      </div>
    </div>
  );
}
