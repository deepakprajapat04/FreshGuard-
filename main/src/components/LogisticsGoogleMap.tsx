import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Navigation, Info, ShieldCheck, Activity, CloudRain } from 'lucide-react';

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

const YOUR_GCP_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

const hasValidKey = Boolean(YOUR_GCP_MAPS_API_KEY) && 
                    YOUR_GCP_MAPS_API_KEY !== 'YOUR_API_KEY' && 
                    YOUR_GCP_MAPS_API_KEY.trim() !== '';

// High-fidelity dark roadmap design: land is dark charcoal (#121214), water is deep navy blue (#000814), and highways stand out in clear gray tracks (#4b5563)
const SLATE_THEME_STYLES = [
  {
    elementType: "geometry",
    stylers: [{ color: "#121214" }]
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b7280" }]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#121214" }]
  },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1f2937" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1f2937" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#4b5563" }] // clear gray highway tracks
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1d2432" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000814" }] // deep navy blue water
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }]
  }
];

const MOCK_CITIES = [
  { name: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
  { name: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  { name: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  { name: "Wisconsin, WI", lat: 44.5191, lng: -88.0198 },
  { name: "Oakland, CA", lat: 37.8044, lng: -122.2711 }
];

export default function LogisticsGoogleMap({ selectedShipment, onSelectShipment, isScanningWeather = false }: LogisticsGoogleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const hazardCircleRef = useRef<any>(null);
  const hazardMarkerRef = useRef<any>(null);

  // References for reliable fallbacks
  const fallbackPolylineRef = useRef<any>(null);
  const fallbackOriginMarkerRef = useRef<any>(null);
  const fallbackDestMarkerRef = useRef<any>(null);

  // Fallback states for premium SVG map engine
  const [useFallbackMock, setUseFallbackMock] = useState(() => !hasValidKey);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapViewMode, setViewMode] = useState<'vector' | 'satellite'>('vector');
  const [activeTelemOpen, setActiveTelemOpen] = useState(false);
  const [activeHazardOpen, setActiveHazardOpen] = useState(false);

  // Custom Zoom and Pan structures for offline interactive mockup
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Address coordinate lookup
  const getCoordinatesForRoute = (shipment: Shipment | null) => {
    if (!shipment) {
      return {
        origin: { lat: 47.6062, lng: -122.3321 }, // Seattle, WA
        dest: { lat: 41.8781, lng: -87.6298 },    // Chicago DC East
        originName: "Seattle Fishery Warehouse, WA",
        destName: "Chicago DC East, IL"
      };
    }
    const id = shipment.id;

    if (id.includes('8842')) {
      return {
        origin: { lat: 25.7617, lng: -80.1918 }, // Miami Port, FL
        dest: { lat: 41.8781, lng: -87.6298 },   // Chicago DC East, IL
        originName: "Miami Port, FL",
        destName: "Chicago DC East, IL"
      };
    }
    if (id.includes('9912')) {
      return {
        origin: { lat: 47.6062, lng: -122.3321 }, // Seattle, WA
        dest: { lat: 41.8781, lng: -87.6298 },    // Chicago DC East, IL
        originName: "Seattle Fishery Warehouse",
        destName: "Chicago DC East, IL"
      };
    }
    if (id.includes('7731')) {
      return {
        origin: { lat: 44.5191, lng: -88.0198 }, // Green Bay, WI
        dest: { lat: 41.8781, lng: -87.6298 },   // Chicago DC East, IL
        originName: "Wisconsin Farm Store, WI",
        destName: "Chicago DC East, IL"
      };
    }
    return {
      origin: { lat: 37.8044, lng: -122.2711 }, // Oakland, CA
      dest: { lat: 41.8781, lng: -87.6298 },    // Chicago DC East, IL
      originName: "Oakland Port, CA",
      destName: "Chicago DC East, IL"
    };
  };

  // Coordinates translation tool for high-fidelity interactive map
  const getCanvasCoords = (lat: number, lng: number) => {
    // US map bounds approximation inside 1000x600 viewBox
    // Longitude: -125 (West) to -70 (East)
    // Latitude: 24 (South) to 50 (North)
    const x = ((lng - (-125)) / 55) * 1000;
    const y = (1 - (lat - 24) / 26) * 600;
    
    return {
      x: Math.max(100, Math.min(900, x)),
      y: Math.max(60, Math.min(540, y))
    };
  };

  // Google Maps Auth Failure Capturer
  useEffect(() => {
    window.gm_authFailure = () => {
      console.warn("Google Maps authentication failure. Safely loaded premium secure offline GIS dashboard mapping fallback system.");
      setUseFallbackMock(true);
    };
    return () => {
      // Keep global handler active or cleanup gently
    };
  }, []);

  // 1. Unconditional Google Maps integration script loader (Skipped if initially in Mock Fallback mode to save footprint)
  useEffect(() => {
    if (typeof window === 'undefined' || useFallbackMock) return;

    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-bootstrap-loader');
    if (existingScript) {
      const waitInterval = setInterval(() => {
        if (window.google?.maps) {
          setIsLoaded(true);
          clearInterval(waitInterval);
        }
      }, 200);
      return () => clearInterval(waitInterval);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${YOUR_GCP_MAPS_API_KEY}&v=weekly&libraries=geometry,places`;
    script.id = 'google-maps-bootstrap-loader';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load GCP Google Maps script context. Transitioned securely to interactive supply chain fallback framework.");
      setUseFallbackMock(true);
    };

    document.head.appendChild(script);
  }, [useFallbackMock]);

  // 2. Map container initialization (Only active for real GCP loading)
  useEffect(() => {
    if (useFallbackMock) return;
    if (!isLoaded || !mapContainerRef.current || !window.google?.maps) return;

    try {
      const gMaps = window.google.maps;
      const initialCoords = getCoordinatesForRoute(selectedShipment);
      const centerCoords = {
        lat: (initialCoords.origin.lat + initialCoords.dest.lat) / 2,
        lng: (initialCoords.origin.lng + initialCoords.dest.lng) / 2
      };

      const mapOptions = {
        center: centerCoords,
        zoom: 4,
        mapTypeId: mapViewMode === 'satellite' ? gMaps.MapTypeId.HYBRID : gMaps.MapTypeId.ROADMAP,
        styles: mapViewMode === 'satellite' ? [] : SLATE_THEME_STYLES,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      };

      const map = new gMaps.Map(mapContainerRef.current, mapOptions);
      mapRef.current = map;

      const directionsRenderer = new gMaps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeWeight: 4,
          strokeOpacity: 0.9
        }
      });
      directionsRendererRef.current = directionsRenderer;

      const infoWindow = new gMaps.InfoWindow();
      infoWindowRef.current = infoWindow;

    } catch (e) {
      console.error("Could not construct live map instance", e);
      setUseFallbackMock(true);
    }
  }, [isLoaded, useFallbackMock]);

  // 3. Keep satellite vs styled vector map state synchronized smoothly
  useEffect(() => {
    if (useFallbackMock) return;
    if (!mapRef.current || !window.google?.maps) return;
    const gMaps = window.google.maps;
    const map = mapRef.current;

    if (mapViewMode === 'satellite') {
      map.setOptions({
        mapTypeId: gMaps.MapTypeId.HYBRID,
        styles: []
      });
    } else {
      map.setOptions({
        mapTypeId: gMaps.MapTypeId.ROADMAP,
        styles: SLATE_THEME_STYLES
      });
    }
  }, [mapViewMode, useFallbackMock]);

  // 4. Dynamic routing calculations, geohazard circles, and telemetry popups
  useEffect(() => {
    if (useFallbackMock) return;
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;

    const gMaps = window.google.maps;
    const map = mapRef.current;
    const directionsService = new gMaps.DirectionsService();
    const routeCoords = getCoordinatesForRoute(selectedShipment);

    // Clear previous elements
    if (fallbackPolylineRef.current) fallbackPolylineRef.current.setMap(null);
    if (fallbackOriginMarkerRef.current) fallbackOriginMarkerRef.current.setMap(null);
    if (fallbackDestMarkerRef.current) fallbackDestMarkerRef.current.setMap(null);
    if (vehicleMarkerRef.current) vehicleMarkerRef.current.setMap(null);
    if (hazardCircleRef.current) hazardCircleRef.current.setMap(null);
    if (hazardMarkerRef.current) hazardMarkerRef.current.setMap(null);

    // Determine anomaly status
    const isRerouted = !!selectedShipment?.rerouted;
    const hasAnomaly = selectedShipment?.status === 'delayed' && !isRerouted;

    // Custom function to handle custom pulsing dot and data overlays
    const updateActiveVehicle = (position: any) => {
      if (vehicleMarkerRef.current) vehicleMarkerRef.current.setMap(null);

      const contentString = `
        <div style="font-family: inherit; font-size: 11px; padding: 6px; line-height: 1.4; color: #1e293b; min-width: 190px;">
          <strong style="color: #4f46e5; display: block; margin-bottom: 4px; font-family: monospace;">TELEMETRY LINK: ACTIVE</strong>
          <div style="border-top: 1px solid #f1f5f9; margin-top: 4px; padding-top: 4px;">
            <div style="font-weight: 700; color: #0f172a;">📦 Fleet Container MSKU 7842</div>
            <div style="color: #64748b; font-family: monospace; font-size: 9.5px; margin: 2px 0;">LAT/LNG: ${position.lat().toFixed(4)}°, ${position.lng().toFixed(4)}°</div>
            <div style="font-weight: 700; color: #10b981; margin-top: 2px;">🌡️ Cargo Temp Window: ${selectedShipment?.temp || '3.0°C'}</div>
          </div>
        </div>
      `;

      const marker = new gMaps.Marker({
        position: position,
        map: map,
        title: "Active Carrier Reefer",
        icon: {
          path: gMaps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4f46e5",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        }
      });

      vehicleMarkerRef.current = marker;

      marker.addListener('click', () => {
        infoWindowRef.current.setContent(contentString);
        infoWindowRef.current.open(map, marker);
        setActiveTelemOpen(true);
      });
    };

    // Construct raw fallback line in case Directions API fails or requires elevation bypass
    const drawHighFidelityFallback = () => {
      const pathCoordinates = [
        new gMaps.LatLng(routeCoords.origin.lat, routeCoords.origin.lng),
        new gMaps.LatLng((routeCoords.origin.lat + routeCoords.dest.lat) / 2 + 1.5, (routeCoords.origin.lng + routeCoords.dest.lng) / 2),
        new gMaps.LatLng(routeCoords.dest.lat, routeCoords.dest.lng)
      ];

      const polyline = new gMaps.Polyline({
        path: pathCoordinates,
        strokeColor: hasAnomaly ? "#f43f5e" : "#4f46e5",
        strokeOpacity: 0.9,
        strokeWeight: 4.5,
        map: map
      });
      fallbackPolylineRef.current = polyline;

      // Custom markers
      const originMarker = new gMaps.Marker({
        position: routeCoords.origin,
        map: map,
        title: `Origin: ${routeCoords.originName}`,
        icon: {
          path: gMaps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#818cf8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5
        }
      });
      fallbackOriginMarkerRef.current = originMarker;

      const destMarker = new gMaps.Marker({
        position: routeCoords.dest,
        map: map,
        title: `Destination: ${routeCoords.destName}`,
        icon: {
          path: gMaps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5
        }
      });
      fallbackDestMarkerRef.current = destMarker;

      const midPoint = new gMaps.LatLng(
        (routeCoords.origin.lat + routeCoords.dest.lat) / 2 + 0.75,
        (routeCoords.origin.lng + routeCoords.dest.lng) / 2
      );
      updateActiveVehicle(midPoint);

      const bounds = new gMaps.LatLngBounds();
      bounds.extend(new gMaps.LatLng(routeCoords.origin.lat, routeCoords.origin.lng));
      bounds.extend(new gMaps.LatLng(routeCoords.dest.lat, routeCoords.dest.lng));
      map.fitBounds(bounds);
    };

    // Calculate directions or cleanly trigger fallback design with explicit authentication checks
    const requestOptions = {
      origin: new gMaps.LatLng(routeCoords.origin.lat, routeCoords.origin.lng),
      destination: new gMaps.LatLng(routeCoords.dest.lat, routeCoords.dest.lng),
      travelMode: gMaps.TravelMode.DRIVING
    };

    directionsService.route(requestOptions, (result: any, status: any) => {
      if (status === gMaps.DirectionsStatus.OK && result) {
        if (directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        }
        const legs = result.routes[0].legs[0];
        const midpointStep = legs.steps[Math.floor(legs.steps.length / 2)];
        const vehiclePos = midpointStep?.end_location || legs.end_location;
        updateActiveVehicle(vehiclePos);

        if (result.routes[0].bounds) {
          map.fitBounds(result.routes[0].bounds);
        }
      } else {
        console.log("Using high-fidelity geodesic polyline vector routing fallback context:", status);
        drawHighFidelityFallback();
      }
    });

    // Add severe climate anomaly zone overlays
    if (hasAnomaly) {
      let hazardCoord = null;
      let hazardLabel = "";

      if (selectedShipment?.id.includes('8842')) {
        hazardCoord = new gMaps.LatLng(27.6648, -81.5158); // Florida location flooding
        hazardLabel = "Severity Level Red: Flash Flood Inundation Corridor";
      } else if (selectedShipment?.id.includes('9912')) {
        hazardCoord = new gMaps.LatLng(47.7511, -120.7401); // Seattle storm
        hazardLabel = "Severity Level Warning: Thunderstorm Winds Front";
      }

      if (hazardCoord) {
        const circle = new gMaps.Circle({
          strokeColor: '#f43f5e',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: '#ef4444',
          fillOpacity: 0.25,
          map: map,
          center: hazardCoord,
          radius: 120000
        });
        hazardCircleRef.current = circle;

        const marker = new gMaps.Marker({
          position: hazardCoord,
          map: map,
          title: hazardLabel,
          icon: {
            path: gMaps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: "#ef4444",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 1.5
          }
        });
        hazardMarkerRef.current = marker;

        const threatInfoString = `
          <div style="font-family: inherit; font-size: 10.5px; padding: 4px; color: #9f1239; line-height: 1.35; max-width: 220px;">
            <div style="font-weight: 800; display: flex; items-center gap: 5px; color: #ef4444;">
              ⚠️ EXTREME CLIMATE HAZARD AREA
            </div>
            <div style="margin-top: 4px; font-weight: 500; color: #4c0519;">
              ${hazardLabel}
            </div>
          </div>
        `;

        marker.addListener('click', () => {
          infoWindowRef.current.setContent(threatInfoString);
          infoWindowRef.current.open(map, marker);
        });
      }
    }
  }, [selectedShipment, isLoaded, useFallbackMock]);

  // HUD actions - fully responsive across both live and high-fidelity mock settings
  const handleZoomIn = () => {
    if (!useFallbackMock && mapRef.current) {
      try {
        mapRef.current.setZoom(mapRef.current.getZoom() + 1);
      } catch (e) {
        setZoomLevel(prev => Math.min(prev + 0.5, 4));
      }
    } else {
      setZoomLevel(prev => Math.min(prev + 0.5, 4));
    }
  };

  const handleZoomOut = () => {
    if (!useFallbackMock && mapRef.current) {
      try {
        mapRef.current.setZoom(mapRef.current.getZoom() - 1);
      } catch (e) {
        setZoomLevel(prev => Math.max(prev - 0.5, 1));
      }
    } else {
      setZoomLevel(prev => Math.max(prev - 0.5, 1));
    }
  };

  const handleRecenter = () => {
    if (!useFallbackMock && mapRef.current) {
      try {
        const coords = getCoordinatesForRoute(selectedShipment);
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(new window.google.maps.LatLng(coords.origin.lat, coords.origin.lng));
        bounds.extend(new window.google.maps.LatLng(coords.dest.lat, coords.dest.lng));
        mapRef.current.fitBounds(bounds);
      } catch (e) {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      }
    } else {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Pre-calculate SVG coordinates for reactive rendering
  const routeCoords = getCoordinatesForRoute(selectedShipment);
  const start = getCanvasCoords(routeCoords.origin.lat, routeCoords.origin.lng);
  const end = getCanvasCoords(routeCoords.dest.lat, routeCoords.dest.lng);
  const controlX = (start.x + end.x) / 2;
  const controlY = (start.y + end.y) / 2 - 60; // Curving arch upwards nicely
  
  // Custom vehicle position along the curve (at exactly 50% progress for visual symmetry)
  const t = 0.5;
  const vehicleX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * controlX + t * t * end.x;
  const vehicleY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * controlY + t * t * end.y;

  // Determine hazards inside SVG Map
  const isRerouted = !!selectedShipment?.rerouted;
  const hasAnomaly = selectedShipment?.status === 'delayed' && !isRerouted;
  let hazardCoord: { lat: number, lng: number } | null = null;
  let hazardLabel = "";
  if (hasAnomaly) {
    if (selectedShipment?.id.includes('8842')) {
      hazardCoord = { lat: 27.6648, lng: -81.5158 };
      hazardLabel = "Severity Level Red: Flash Flood Inundation Corridor";
    } else if (selectedShipment?.id.includes('9912')) {
      hazardCoord = { lat: 47.7511, lng: -120.7401 };
      hazardLabel = "Severity Level Warning: Thunderstorm Winds Front";
    }
  }
  const hazardPos = hazardCoord ? getCanvasCoords(hazardCoord.lat, hazardCoord.lng) : null;

  // Setup viewbox centering values
  const baseWidth = 1000;
  const baseHeight = 600;
  const currentWidth = baseWidth / zoomLevel;
  const currentHeight = baseHeight / zoomLevel;
  const routeMidX = (start.x + end.x) / 2;
  const routeMidY = (start.y + end.y) / 2;
  const k = (zoomLevel - 1) / zoomLevel;
  const centerX = 500 + (routeMidX - 500) * k + panOffset.x;
  const centerY = 300 + (routeMidY - 300) * k + panOffset.y;
  const minX = centerX - currentWidth / 2;
  const minY = centerY - currentHeight / 2;
  const viewBoxString = `${minX} ${minY} ${currentWidth} ${currentHeight}`;

  return (
    <div id="logistics-gps-engine-container" className="w-full h-full bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden shadow-2xl flex flex-col min-h-[460px]">
      
      {/* MAP STATUS/HEADER HUD OVERLAY */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 select-none pointer-events-none">
        <div className="text-[9px] text-white font-mono tracking-widest uppercase font-extrabold flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 px-2.5 py-1 rounded shadow-md">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          ACTIVE INTEL GPS CORE: {useFallbackMock ? "OFFLINE VECTOR HYBRID" : "LIVE MAP INTEGRATED"}
        </div>
        <div className="text-[7.5px] text-slate-400 font-mono tracking-normal bg-slate-900/70 px-1.5 py-0.5 rounded w-fit border border-slate-800">
          {routeCoords.originName.split(',')[0]} ↔ {routeCoords.destName.split(',')[0]}
        </div>
      </div>

      {/* MAP CONTROLS OVERLAY - FLUX OVER TOP-RIGHT CORNER */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        
        {/* PREMIUM MAP TYPE SELECTOR */}
        <div className="flex bg-slate-900/95 rounded-lg p-0.5 border border-slate-700 shadow-md">
          <button
            onClick={() => setViewMode('vector')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all cursor-pointer ${
              mapViewMode === 'vector' 
                ? 'bg-indigo-650 text-white shadow font-black' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🗺️ Vector Map
          </button>
          <button
            onClick={() => setViewMode('satellite')}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold font-mono transition-all cursor-pointer ${
              mapViewMode === 'satellite' 
                ? 'bg-indigo-650 text-white shadow font-black' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛰️ Satellite View
          </button>
        </div>

        <button 
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 bg-slate-900/95 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:text-white transition-all cursor-pointer shadow-md"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 bg-slate-900/95 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:text-white transition-all cursor-pointer shadow-md"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button 
          onClick={handleRecenter}
          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
        >
          <Navigation className="w-3.5 h-3.5 rotate-45 fill-white shrink-0" /> Recenter Map
        </button>
      </div>

      {/* CORE CANVAS DRAWING AREA */}
      <div className="flex-1 w-full relative overflow-hidden bg-slate-950">
        
        {/* Dynamic Live Google Map Canvas Node vs Interactive Fallback Engine */}
        {!useFallbackMock ? (
          isLoaded ? (
            <div ref={mapContainerRef} className="w-full h-full min-h-[460px] relative rounded-2xl border border-slate-900" />
          ) : (
            <div className="w-full h-full min-h-[460px] flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-3">
              <span className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
              <span>Initializing Secure GIS Framework Satellite Ensembles...</span>
            </div>
          )
        ) : (
          /* High-Fidelity Interactive Offline SVG Vector Map */
          <div className="w-full h-full min-h-[460px] relative bg-[#090d16] overflow-hidden select-none" style={{ height: '100%', width: '100%' }}>
            <svg 
              className="w-full h-full min-h-[460px] transition-all duration-300 ease-out origin-center"
              viewBox={viewBoxString}
              style={{ background: mapViewMode === 'satellite' ? '#030712' : '#080c14' }}
            >
              {/* DEFINITIONS & GRADIENTS */}
              <defs>
                <pattern id="grid-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="80" y2="0" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" />
                  <line x1="0" y1="0" x2="0" y2="80" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" />
                  <circle cx="0" cy="0" r="1.5" fill="rgba(99, 102, 241, 0.15)" />
                </pattern>
                
                <radialGradient id="ocean-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0b132b" />
                  <stop offset="100%" stopColor="#040815" />
                </radialGradient>

                <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="50%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>

                <linearGradient id="route-delayed-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* SPACE GRID */}
              <rect width="100%" height="100%" fill="url(#ocean-glow)" />
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />

              {/* SATELLITE MODE RADAR RINGS AND TARGET CRUCIFORMS */}
              {mapViewMode === 'satellite' ? (
                <>
                  <circle cx="500" cy="300" r="280" fill="none" stroke="rgba(6, 182, 212, 0.07)" strokeWidth="1.5" strokeDasharray="4,8" />
                  <circle cx="500" cy="300" r="480" fill="none" stroke="rgba(6, 182, 212, 0.04)" strokeWidth="1" />
                  <line x1="500" y1="0" x2="500" y2="600" stroke="rgba(6, 182, 212, 0.06)" strokeWidth="1.5" strokeDasharray="3,3" />
                  <line x1="0" y1="300" x2="1000" y2="300" stroke="rgba(6, 182, 212, 0.06)" strokeWidth="1.5" strokeDasharray="3,3" />
                  
                  {/* Topographic elevation concentric arcs */}
                  <path d="M 120 180 Q 250 120 400 150" fill="none" stroke="rgba(241, 245, 249, 0.02)" strokeWidth="1.5" />
                  <path d="M 680 400 Q 800 350 900 480" fill="none" stroke="rgba(241, 245, 249, 0.02)" strokeWidth="1.5" />
                  <path d="M 150 490 Q 300 450 420 520" fill="none" stroke="rgba(241, 245, 249, 0.02)" strokeWidth="1.5" />
                </>
              ) : (
                <>
                  {/* Map Grid Labels */}
                  <text x="30" y="50" fill="rgba(148, 163, 184, 0.35)" fontSize="9" fontFamily="monospace" fontWeight="bold">Grid: Area-A1 [N-45.7° / W-118.2°]</text>
                  <text x="30" y="90" fill="rgba(148, 163, 184, 0.25)" fontSize="8" fontFamily="monospace">REF_COORD: SYSTEM_GPS_OK</text>
                  <text x="30" y="560" fill="rgba(148, 163, 184, 0.35)" fontSize="9" fontFamily="monospace" fontWeight="bold">US CONUS TRANSPORT VECTOR SYSTEM</text>
                </>
              )}

              {/* THEMATIC GEOGRAPHICAL REFERENCE SHAPES & BOUNDARIES */}
              <g stroke="rgba(99, 102, 241, 0.05)" strokeWidth="1" fill="none">
                {/* Pacific Coast trunk line */}
                <path d="M 100 100 Q 80 250 95 440 T 150 540" />
                {/* Mid-West connection corridor */}
                <path d="M 95 300 Q 400 250 670 180" />
                {/* Southern Route pipeline */}
                <path d="M 95 440 Q 450 480 810 520" />
                {/* East Coast trunk line */}
                <path d="M 670 180 Q 800 120 900 60" />
                <path d="M 810 520 Q 850 300 900 60" />
              </g>

              {/* ALL REGISTERED TRANSPORTATION HUBS */}
              {MOCK_CITIES.map((city, idx) => {
                const pos = getCanvasCoords(city.lat, city.lng);
                const isOrigin = city.name.toLowerCase().includes(routeCoords.originName.toLowerCase().split(',')[0].toLowerCase()) || 
                                 routeCoords.originName.toLowerCase().includes(city.name.toLowerCase());
                const isDest = city.name.toLowerCase().includes(routeCoords.destName.toLowerCase().split(',')[0].toLowerCase()) ||
                               routeCoords.destName.toLowerCase().includes(city.name.toLowerCase());
                
                return (
                  <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
                    {/* Ring glow for active endpoint hubs */}
                    {(isOrigin || isDest) && (
                      <circle cx="0" cy="0" r="14" fill="none" stroke={isDest ? "#10b981" : "#4f46e5"} strokeWidth="1.5" className="animate-ping opacity-45" />
                    )}
                    <circle 
                      cx="0" 
                      cy="0" 
                      r={isOrigin || isDest ? "6" : "3.5"} 
                      fill={isDest ? "#10b981" : isOrigin ? "#4f46e5" : "#1e293b"} 
                      stroke="#ffffff" 
                      strokeWidth={isOrigin || isDest ? "1.5" : "1"} 
                    />
                    
                    {/* City names displayed clearly in high-contrast monospaced overlay */}
                    <text 
                      x="10" 
                      y="3" 
                      fill={(isOrigin || isDest) ? "#ffffff" : "#64748b"} 
                      fontSize={(isOrigin || isDest) ? "10" : "8"} 
                      fontFamily="monospace" 
                      fontWeight={(isOrigin || isDest) ? "bold" : "normal"}
                    >
                      {city.name}
                    </text>
                  </g>
                );
              })}

              {/* CURVED ROUTE PATHWAY - DASHES MOVING TOWARDS DESTINATION */}
              <path 
                d={`M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`} 
                fill="none" 
                stroke={hasAnomaly ? "url(#route-delayed-gradient)" : "url(#route-gradient)"} 
                strokeWidth={hasAnomaly ? "5" : "4"} 
                strokeLinecap="round"
              />
              <path 
                d={`M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`} 
                fill="none" 
                stroke="#ffffff" 
                strokeWidth="2" 
                strokeDasharray="10, 25" 
                strokeLinecap="round"
                opacity="0.75"
              />

              {/* SEVERE CLIMATE HAZARD OVERLAYS */}
              {hasAnomaly && hazardPos && (
                <g>
                  {/* Hazard Zone Transparent Pulsing Circle */}
                  <circle 
                    cx={hazardPos.x} 
                    cy={hazardPos.y} 
                    r="60" 
                    fill="rgba(244, 63, 94, 0.12)" 
                    stroke="#f43f5e" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    className="animate-pulse" 
                    onClick={() => setActiveHazardOpen(true)}
                    style={{ cursor: 'pointer' }}
                  />
                  <circle 
                    cx={hazardPos.x} 
                    cy={hazardPos.y} 
                    r="100" 
                    fill="none" 
                    stroke="rgba(244, 63, 94, 0.15)" 
                    strokeWidth="1" 
                    className="animate-pulse"
                  />
                  
                  {/* Warning Sign Pin */}
                  <g 
                    transform={`translate(${hazardPos.x}, ${hazardPos.y})`} 
                    className="cursor-pointer"
                    onClick={() => {
                      setActiveHazardOpen(!activeHazardOpen);
                      setActiveTelemOpen(false);
                    }}
                  >
                    <circle cx="0" cy="0" r="14" fill="#f43f5e" opacity="0.4" className="animate-ping" />
                    <circle cx="0" cy="0" r="8" fill="#f43f5e" stroke="#ffffff" strokeWidth="1" />
                    <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">!</text>
                  </g>
                </g>
              )}

              {/* TRUCK CONTAINER INTERACTIVE ICON */}
              <g 
                transform={`translate(${vehicleX}, ${vehicleY})`} 
                className="cursor-pointer"
                onClick={() => {
                  setActiveTelemOpen(!activeTelemOpen);
                  setActiveHazardOpen(false);
                }}
              >
                <circle cx="0" cy="0" r="18" fill="none" stroke="#6366f1" strokeWidth="1" className="animate-ping opacity-35" />
                <circle cx="0" cy="0" r="10" fill="#4f46e5" className="opacity-30" />
                
                <rect x="-8" y="-8" width="16" height="16" rx="4" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />
                
                <circle cx="0" cy="0" r="3" fill="#10b981" />
              </g>

            </svg>

            {/* DYNAMIC INFORMATION OVERLAYS LINKED TO SVG POSITIONING */}
            {activeTelemOpen && (
              <div 
                className="absolute z-50 bg-slate-900/95 backdrop-blur border border-indigo-500/50 p-4 rounded-xl shadow-2xl w-60 font-mono text-[10.5px] text-slate-300 pointer-events-auto select-none transition-all duration-300 shadow-indigo-950/45"
                style={{
                  top: `calc(${((vehicleY - minY) / currentHeight) * 100}% - 145px)`,
                  left: `calc(${((vehicleX - minX) / currentWidth) * 100}% - 120px)`,
                }}
              >
                <div className="flex items-center justify-between border-b border-indigo-950 pb-2 mb-2">
                  <span className="text-indigo-400 font-bold tracking-widest text-[9.5px]">🛰️ TELEMETRY ACTIVE</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTelemOpen(false); }}
                    className="text-slate-500 hover:text-slate-200 font-bold text-xs"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-1.5 text-xs text-left">
                  <div>
                    <span className="text-slate-500 text-[9.5px]">CARRIER:</span> 
                    <span className="text-indigo-200 font-semibold ml-1">{selectedShipment?.vendor || 'Premium Logistics'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[9.5px]">CONTAINER:</span> 
                    <span className="text-indigo-200 font-semibold ml-1">MSKU-{selectedShipment?.id || '7842'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/80 p-2 rounded border border-slate-800">
                    <div>
                      <div className="text-[8px] text-slate-500 uppercase">Cargo Temperature</div>
                      <div className="text-emerald-400 font-black text-sm tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        {selectedShipment?.temp || '3.2°C'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] text-slate-500 uppercase">Spec</div>
                      <div className="text-slate-400 font-bold text-[10px]">{selectedShipment?.fleetSpecification || 'Reefer'}</div>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 flex justify-between">
                    <span>LAT: {routeCoords.origin.lat.toFixed(3)}°</span>
                    <span>LNG: {routeCoords.origin.lng.toFixed(3)}°</span>
                  </div>
                </div>
              </div>
            )}

            {activeHazardOpen && hasAnomaly && hazardPos && (
              <div 
                className="absolute z-50 bg-rose-955/95 backdrop-blur border border-rose-500/50 p-4 rounded-xl shadow-2xl w-60 font-mono text-[10.5px] text-rose-100 pointer-events-auto select-none transition-all duration-300 shadow-rose-950/45"
                style={{
                  top: `calc(${((hazardPos.y - minY) / currentHeight) * 100}% - 110px)`,
                  left: `calc(${((hazardPos.x - minX) / currentWidth) * 100}% - 120px)`,
                }}
              >
                <div className="flex items-center justify-between border-b border-rose-900 pb-2 mb-2">
                  <span className="text-rose-400 font-bold tracking-widest text-[9.5px]">⚠️ ATMOSPHERIC ANOMALY</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveHazardOpen(false); }}
                    className="text-rose-400 hover:text-rose-200 font-bold text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">{hazardLabel}</p>
                  <p className="text-[10px] text-rose-400 leading-normal mt-1">
                    Route crossing hazard corridor. Automated re-routing options triggered to bypass storm front.
                  </p>
                </div>
              </div>
            )}
            
            {/* HUD SCALE GRAPHICS */}
            <div className="absolute bottom-4 right-4 z-10 font-mono text-[8.5px] text-slate-500 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-900 pointer-events-none">
              GRID SCALE: 1:1,500,000 | OFF-GRID BYPASS LINK: ACTIVE
            </div>
          </div>
        )}

        {/* SCANNING RADAR HUD OVERLAY */}
        {isScanningWeather && (
          <div className="absolute bottom-6 left-4 z-40 bg-slate-900/95 border border-cyan-500/55 px-3 py-1.5 rounded-lg shadow-xl font-mono text-[9px] text-cyan-400 font-extrabold tracking-wider animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>SCANNING ATMOSPHERIC WEATHER RADAR CORRIDORS...</span>
          </div>
        )}
      </div>

    </div>
  );
}
