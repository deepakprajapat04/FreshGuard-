/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Navigation, 
  Truck, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  CloudRain, 
  Clock, 
  Ship, 
  Calendar as CalendarIcon, 
  Map as MapIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Thermometer, 
  ArrowRight,
  RefreshCw,
  TrendingDown,
  Box,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import POPDFDocumentModal from '../components/POPDFDocumentModal';
import LogisticsGoogleMap from '../components/LogisticsGoogleMap';

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
  stage?: 'packing' | 'delivering' | 'delivered';
  packingProgress?: number;
  preCoolingTarget?: string;
  isBlanket?: boolean;
  contractHorizon?: string;
  deliveryFrequency?: string;
  totalBatches?: number;
  deliveredBatches?: number;
  currentActiveBatch?: number;
  isBlanketBatch?: boolean;
  batchNum?: number;
  parentBlanketId?: string;
  parentBpoId?: string;
  childPOs?: Array<{ id: string; batchNum: number; quantity?: number; volume?: number; status: string }>;
  telemetry?: {
    containerId?: string;
    ambientTemp?: string;
    beaconId?: string;
  };
}

interface AIAlert {
  hasAnomaly: boolean;
  routeId: string;
  threatVector: string;
  delayText: string;
  mitigationText: string;
  mitigationSummary: string;
  alternativeRouteName: string;
}

// Helper to calculate bezier curves for vehicle vectors
const getBezierPoint = (t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
  return { x, y };
};

// Precise geospatial routing coordinates database for real-time shipment paths
const getRouteData = (shipment: Shipment | undefined) => {
  if (!shipment) return null;
  const isDelivered = shipment.status === 'delivered';
  const isRerouted = !!shipment.rerouted;
  const isDelayed = shipment.status === 'delayed';

  // HQ DC - Chicago (Central hub Destination)
  const p3 = { x: 480, y: 180 }; 
  let originName = shipment.origin || "Supplier Facility Port";
  let p0 = { x: 820, y: 440 }; // Default Southeast
  let p1 = { x: 740, y: 380 };
  let p2 = { x: 645, y: 320 };
  let t = 0.58;
  let speed = "0 mph (Blocked)";
  let heading = "N (Stopped)";
  let tempText = "3.2°C [Warning]";

  if (shipment.id === "PO-2026-8842") {
    originName = "Global Farms Facility - Miami Port";
    p0 = { x: 820, y: 440 };
    if (isRerouted) {
      // Re-routed via the Northern I-81 corridor detour
      p1 = { x: 880, y: 320 };
      p2 = { x: 700, y: 100 };
      t = 0.45;
      speed = "62 mph";
      heading = "NW";
      tempText = "3.1°C [Stable]";
    } else {
      // Normal flood-impacted route near Sector 4 Gateway
      p1 = { x: 740, y: 380 };
      p2 = { x: 645, y: 320 };
      t = 0.58; 
      speed = "0 mph (Blocked)";
      heading = "N (Stopped)";
      tempText = "3.2°C [Warning]";
    }
  } else if (shipment.id === "PO-2026-9912A") {
    originName = "Seattle Fishery Warehouse";
    p0 = { x: 120, y: 100 };
    p1 = { x: 220, y: 110 };
    p2 = { x: 360, y: 140 };
    t = 0.8;
    speed = "58 mph";
    heading = "E";
    tempText = "3.0°C [Stable]";
  } else if (shipment.id === "PO-2026-7731C") {
    originName = "Wisconsin Farm Store";
    p0 = { x: 420, y: 120 };
    p1 = { x: 440, y: 140 };
    p2 = { x: 460, y: 160 };
    t = 0.45;
    speed = "64 mph";
    heading = "SE";
    tempText = "4.0°C [Stable]";
  } else {
    // Dynamically seed standard coordinate path based on shipment ID hash for complete resiliency
    let codeHash = 0;
    for (let i = 0; i < shipment.id.length; i++) {
      codeHash += shipment.id.charCodeAt(i);
    }
    const oX = 120 + (codeHash % 180);
    const oY = 280 + (codeHash % 120);
    p0 = { x: oX, y: oY };
    p1 = { x: (oX + 480) / 2, y: oY - 30 };
    p2 = { x: (oX + 480) / 2, y: 180 + 30 };
    t = isDelivered ? 1.0 : 0.35 + (codeHash % 30) / 100;
    speed = "57 mph";
    heading = "NE";
    tempText = shipment.temp || "3.5°C";
  }

  if (isDelivered) {
    t = 1.0;
    speed = "0 mph";
    heading = "Arrived @ DC";
    tempText = shipment.temp || "3.0°C";
  }

  const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
  const pos = getBezierPoint(t, p0, p1, p2, p3);

  return {
    d,
    p0,
    p3,
    x: pos.x,
    y: pos.y,
    speed,
    heading,
    tempText,
    isDelayed,
    isRerouted,
    isDelivered,
    originName
  };
};

interface LogisticsProps {
  openDrawer?: (shipment: Shipment) => void;
}

function Logistics({ openDrawer }: LogisticsProps = {}) {
  const [activeTab, setActiveTab] = useState<'packing' | 'transit'>('packing');
  const [viewMode, setViewMode] = useState<'map' | 'calendar'>('map');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>('');
  
  const handleSelectShipment = (shipment: Shipment) => {
    if (!shipment) return;
    setSelectedShipmentId(shipment.id);
    if (typeof openDrawer !== 'undefined' && openDrawer) {
      openDrawer(shipment);
    }
  };
  const [hoveredShipmentId, setHoveredShipmentId] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfModalData, setPdfModalData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive zoom & pan settings for the map container
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // AI endpoint states
  const [aiAlerts, setAiAlerts] = useState<Record<string, AIAlert>>({});
  const [expandedBlankets, setExpandedBlankets] = useState<Record<string, boolean>>({ 'PO-2026-BLANKET': true });
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isScanningWeather, setIsScanningWeather] = useState<boolean>(false);

  // Automated Weather Hazard scan simulation on selection
  useEffect(() => {
    if (selectedShipmentId) {
      setIsScanningWeather(true);
      const timer = setTimeout(() => {
        setIsScanningWeather(false);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [selectedShipmentId]);
  
  // Tab 1 loading state
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchingChildId, setDispatchingChildId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const { persona } = usePersona();
  const isVendor = persona === 'vendor';

  // Seed default shipments
  const seedDefaultShipments = () => {
    const defaults: Shipment[] = [
      {
        id: "PO-2026-BLANKET",
        vendor: "Global Farms Suppliers",
        item: "12,000 Cases of Organic Hass Avocados (3-Month Contract)",
        product: "Organic Hass Avocados",
        quantity: 12000,
        unit: "Cases",
        fleetSpecification: "Active Refrigerated",
        logisticsRouteAndProvider: "I-80 West - CoolWay Transit",
        status: "on-time" as const,
        eta: "4 Days",
        origin: "Global Farms Warehouse",
        destination: "Chicago DC",
        temp: "3.5°C",
        route: "California → Chicago DC",
        date: new Date().toISOString(),
        stage: 'packing' as const,
        packingProgress: 8,
        preCoolingTarget: "Pre-Cooling Target: 4°C (Currently: 3.8°C)",
        isBlanket: true,
        contractHorizon: "3 Months",
        deliveryFrequency: "Once a Week",
        totalBatches: 12,
        deliveredBatches: 1,
        currentActiveBatch: 2,
        childPOs: [
          { id: "PO-BLANKET-R01", batchNum: 1, quantity: 1000, status: "Delivered" },
          { id: "PO-BLANKET-R02", batchNum: 2, quantity: 1000, status: "Ready to Pack" },
          ...Array.from({ length: 10 }).map((_, i) => ({
            id: `PO-BLANKET-R${(i + 3).toString().padStart(2, '0')}`,
            batchNum: i + 3,
            quantity: 1000,
            status: "Scheduled" as const
          }))
        ]
      },
      {
        id: "PO-2026-8842",
        vendor: "Global Farms Suppliers",
        item: "1,200 Cases of Hard-Boiled Eggs",
        product: 'Hard-Boiled Eggs',
        quantity: 1200,
        unit: "Cases",
        fleetSpecification: "Active Refrigerated",
        logisticsRouteAndProvider: "Route #402 Corridor",
        status: "delayed",
        eta: "14 hrs",
        origin: "Global Farms Plant #4",
        destination: "Chicago DC",
        temp: "3.2°C",
        route: "Florida → Chicago DC",
        date: new Date().toISOString(),
        hasAnomaly: true,
        stage: 'packing',
        packingProgress: 65,
        preCoolingTarget: "Pre-Cooling Target: 3°C (Currently: 3.2°C)"
      },
      {
        id: "PO-2026-9912A",
        vendor: "Ocean Catch Suppliers",
        item: "200 Cases of Fresh Salmon",
        product: "Fresh Salmon",
        quantity: 200,
        unit: "Cases",
        fleetSpecification: "Active Refrigerated",
        logisticsRouteAndProvider: "Route I-94 East",
        status: "on-time",
        eta: "1.5 Days",
        origin: "Seattle Fishery Warehouse",
        destination: "Chicago DC",
        temp: "3°C [Stable]",
        route: "Seattle → Chicago DC",
        date: subDays(new Date(), 1).toISOString(),
        stage: 'delivering',
        packingProgress: 100,
        preCoolingTarget: "Pre-Cooling Target: 3°C (Currently: 3.0°C)"
      },
      {
        id: "PO-2026-7731C",
        vendor: "Sunrise Dairy Co.",
        item: "400 Cases of Organic Milk",
        product: "Organic Milk",
        quantity: 400,
        unit: "Cases",
        fleetSpecification: "Active Refrigerated",
        logisticsRouteAndProvider: "US-12 West",
        status: "on-time",
        eta: "3 Days",
        origin: "Wisconsin Farm Store",
        destination: "Chicago DC",
        temp: "4°C [Stable]",
        route: "Wisconsin → Chicago DC",
        date: subDays(new Date(), 2).toISOString(),
        stage: 'delivering',
        packingProgress: 100,
        preCoolingTarget: "Pre-Cooling Target: 4°C (Currently: 4.0°C)"
      }
    ];
    return defaults;
  };

  // Sync state back to localStorage
  const saveShipmentsToStorage = (updatedList: Shipment[]) => {
    try {
      localStorage.setItem('freshguard-active-shipments', JSON.stringify(updatedList));
    } catch (err) {
      console.error("Failed to save shipments to storage", err);
    }
  };

  const loadShipments = () => {
    try {
      const stored = localStorage.getItem('freshguard-active-shipments');
      let parsed: Shipment[] = stored ? JSON.parse(stored) : [];
      const defaults = seedDefaultShipments();
      
      const defaultFiltered = defaults.filter(def => !parsed.some(p => p.id === def.id));
      const combined = [...parsed, ...defaultFiltered];
      
      const mapped = combined.map(s => {
        if (s.status === 'delivered') {
          return { ...s, stage: 'delivered' as const };
        }
        if (!s.stage) {
          return {
            ...s,
            stage: 'packing' as const,
            packingProgress: s.packingProgress || 65,
            preCoolingTarget: s.preCoolingTarget || `Pre-Cooling Target: 3°C (Currently: ${s.temp || '3.2°C'})`
          };
        }
        return s;
      });
      
      setShipments(mapped);
      saveShipmentsToStorage(mapped);

      // Default selected shipment in transit
      const activeTransit = mapped.filter(s => s.stage === 'delivering');
      if (activeTransit.length > 0) {
        setSelectedShipmentId(prev => {
          if (prev && activeTransit.some(s => s.id === prev)) return prev;
          return activeTransit[0].id;
        });
      } else if (mapped.length > 0) {
        setSelectedShipmentId(prev => prev || mapped[0].id);
      }
    } catch (err) {
      console.error("Failed to load shipments", err);
      const defs = seedDefaultShipments();
      setShipments(defs);
      setSelectedShipmentId(defs[0].id);
    }
  };

  useEffect(() => {
    loadShipments();

    const handleStorageChange = () => {
      loadShipments();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Synchronize active tab based on view role status
  useEffect(() => {
    if (persona === 'vendor') {
      setActiveTab('packing');
    } else {
      setActiveTab('transit');
    }
  }, [persona]);

  const selectedShipment = useMemo(() => {
    return shipments.find(s => s.id === selectedShipmentId);
  }, [shipments, selectedShipmentId]);

  // Request real-time risk evaluation
  const evaluateShipmentRoute = async (shipment: Shipment) => {
    if (!shipment || shipment.status === 'delivered') return;
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/evaluate-transit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: shipment.logisticsRouteAndProvider,
          product: shipment.product || shipment.item,
          route: shipment.route,
          fleetSpecification: shipment.fleetSpecification
        })
      });

      if (res.ok) {
        const data: AIAlert = await res.json();
        setAiAlerts(prev => ({
          ...prev,
          [shipment.id]: data
        }));
      } else {
        throw new Error("Logistics evaluation network error");
      }
    } catch (err) {
      console.error("AI Corridor risk analysis failed, utilizing robust default scenario", err);
      setAiAlerts(prev => ({
        ...prev,
        [shipment.id]: {
          hasAnomaly: shipment.status === 'delayed' ? true : false,
          routeId: "Route #402",
          threatVector: "Severe Flash Flooding near Sector 4 Gateway • Threat Level: High",
          delayText: "Expected transit delay: +14 hours. Predicted post-delivery shelf life reduced from 14 days to 11 days.",
          mitigationText: "Reroute transit vehicle via the Northern I-81 corridor immediately. Adds 45 miles but bypasses the flood zone entirely, restoring climate control stability and saving 92% of perishable volume.",
          mitigationSummary: "Bypasses high water risk areas to secure thermal control values.",
          alternativeRouteName: "Northern I-81"
        }
      }));
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    if (selectedShipment && !aiAlerts[selectedShipment.id] && selectedShipment.stage === 'delivering') {
      evaluateShipmentRoute(selectedShipment);
    }
  }, [selectedShipmentId, selectedShipment]);

  // Handle Approve Reroute action
  const handleApproveReroute = (shipmentId: string) => {
    setFeedbackMsg("Processing reroute request...");
    
    setTimeout(() => {
      const updatedList = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            status: 'on-time' as const,
            temp: '3.1°C [Stable]',
            eta: '6.5 hrs',
            logisticsRouteAndProvider: 'Northern I-81 Bypass Corridor',
            rerouted: true,
            hasAnomaly: false
          };
        }
        return s;
      });

      setShipments(updatedList);
      saveShipmentsToStorage(updatedList);

      if (aiAlerts[shipmentId]) {
        setAiAlerts(prev => ({
          ...prev,
          [shipmentId]: {
            ...prev[shipmentId],
            hasAnomaly: false
          }
        }));
      }

      setFeedbackMsg("Reroute command dispatched to driver headset.");
      setTimeout(() => setFeedbackMsg(null), 5000);
    }, 1200);
  };

  // Dispatch from Warehouse Packing Pipeline
  const handleDispatch = (id: string, itemDesc: string, childPOId?: string) => {
    // Determine if it is blanket
    const targetS = shipments.find(item => item.id === id);
    const isBlanket = targetS?.isBlanket || id === 'PO-2026-BLANKET';

    // If it is blanket, find or calculate the child release PO ID
    const actualChildId = childPOId || (() => {
      const activeB = targetS?.currentActiveBatch || 1;
      const suffix = id.includes('BPO-2026-') ? id.replace('BPO-2026-', '') : 'BLANKET';
      return `PO-${suffix}-R${activeB.toString().padStart(2, '0')}`;
    })();

    setDispatchingId(id);
    if (isBlanket) {
      setDispatchingChildId(actualChildId);
    }
    
    setTimeout(() => {
      const targetS = shipments.find(item => item.id === id);
      if (!targetS) return;
      
      if (isBlanket) {
        const totalB = targetS.totalBatches || 12;
        const currentB = targetS.currentActiveBatch || 1;
        const casesPerB = Math.round(targetS.quantity / totalB);
        
        const updatedList = shipments.map(item => {
          if (item.id === id) {
            // Update childPOs array inside the master
            const updatedChildPOs = (item.childPOs || []).map(child => {
              if (child.id === actualChildId) {
                return { ...child, status: 'In Transit' as const };
              }
              if (child.batchNum === currentB + 1) {
                return { ...child, status: 'Ready to Pack' as const };
              }
              return child;
            });

            return {
              ...item,
              deliveredBatches: Math.min(totalB, (item.deliveredBatches || 0) + 1),
              currentActiveBatch: Math.min(totalB + 1, currentB + 1),
              childPOs: updatedChildPOs.length > 0 ? updatedChildPOs : undefined
            };
          }
          return item;
        });

        // Add the newly created active transit item representing the child PO
        const newTransitBatch: Shipment = {
          id: actualChildId,
          vendor: targetS.vendor || "Global Farms Suppliers",
          item: `Release Batch #${currentB} of ${totalB} (${casesPerB.toLocaleString()} ${targetS.unit || 'Cases'})`,
          product: `${targetS.product || 'Organic Hass Avocados'} (Batch #${currentB})`,
          quantity: casesPerB,
          unit: targetS.unit || "Cases",
          fleetSpecification: targetS.fleetSpecification || "Active Refrigerated",
          logisticsRouteAndProvider: targetS.logisticsRouteAndProvider || "I-80 West Line",
          status: 'on-time' as const,
          eta: '2 Days',
          origin: targetS.origin || "Global Farms Warehouse",
          destination: targetS.destination || "Chicago DC",
          temp: targetS.temp || "3.5°C",
          route: targetS.route || "California → Chicago DC",
          date: new Date().toISOString(),
          stage: 'delivering' as const,
          packingProgress: 100,
          preCoolingTarget: targetS.preCoolingTarget,
          isBlanketBatch: true,
          parentBpoId: id, // permanent link back of child to Master BPO ID!
          batchNum: currentB
        };

        const finalShipments = [newTransitBatch, ...updatedList];
        setShipments(finalShipments);
        saveShipmentsToStorage(finalShipments);
        
        setDispatchingId(null);
        setDispatchingChildId(null);
        setSelectedShipmentId(actualChildId); // Autoselect child PO in transit on map!
        
        setSuccessToast(`Manifest Generated! Release Batch ${actualChildId} has been packed and dispatched strictly.`);
        setTimeout(() => setSuccessToast(null), 5500);
        setActiveTab('transit');
        return;
      }

      const updatedList = shipments.map(item => {
        if (item.id === id) {
          return {
            ...item,
            stage: 'delivering' as const,
            packingProgress: 100,
            // Trigger delayed state and anomaly warning for PO-2026-8842 specifically to prompt interactive AI dashboard options
            status: item.id === 'PO-2026-8842' ? 'delayed' as const : 'on-time' as const,
            hasAnomaly: item.id === 'PO-2026-8842' ? true : false,
            temp: item.id === 'PO-2026-8842' ? '3.2°C' : '4°C'
          };
        }
        return item;
      });

      setShipments(updatedList);
      saveShipmentsToStorage(updatedList);
      setDispatchingId(null);
      setDispatchingChildId(null);
      
      // Auto-select the newly dispatched item in transit view
      setSelectedShipmentId(id);
      
      setSuccessToast(`Manifest Generated! Shipment for ${id} (${itemDesc}) has been successfully processed and pushed to the Active Deliveries channel.`);
      
      setTimeout(() => {
        setSuccessToast(null);
      }, 5500);

      // Auto-switch to Transit page to show live tracking and map view!
      setActiveTab('transit');
    }, 1205);
  };

  // Filtering for pre-dispatch pipeline vs transit
  const preDispatchShipments = useMemo(() => {
    return shipments.filter(s => {
      const isSearchMatch = s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.item.toLowerCase().includes(searchQuery.toLowerCase());
      // Show in packing tab if not marked delivering or if they are delivered (so we can show them closed across all tabs)
      return isSearchMatch && (s.stage === 'packing' || s.status === 'delivered');
    });
  }, [shipments, searchQuery]);

  const transitShipments = useMemo(() => {
    return shipments.filter(s => {
      const isSearchMatch = s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.item.toLowerCase().includes(searchQuery.toLowerCase());
      // Show delivering or delivering-as-delivered
      return isSearchMatch && (s.stage === 'delivering' || s.stage === 'delivered' || s.status === 'delivered');
    });
  }, [shipments, searchQuery]);

  // Grouping for left side rail in Transit view
  const groupedTransit = useMemo(() => {
    const critical = transitShipments.filter(s => (s.status === 'delayed' || s.hasAnomaly) && s.status !== 'delivered');
    const onTrack = transitShipments.filter(s => !((s.status === 'delayed' || s.hasAnomaly) && s.status !== 'delivered'));
    return { critical, onTrack };
  }, [transitShipments]);

  // Calendar parameters
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const allDeliveriesForCalendar = useMemo(() => {
    const deliveries: any[] = [];
    const baseDate = subDays(new Date(), 3);
    
    transitShipments.forEach((s, idx) => {
      deliveries.push({
        id: s.id,
        date: s.date ? new Date(s.date) : addDays(baseDate, idx % 5),
        items: s.item,
        vendor: s.vendor,
        type: s.fleetSpecification.includes('Refrigerated') ? 'truck' : 'ship',
        issue: s.status
      });
    });

    return deliveries;
  }, [transitShipments]);

  return (
    <div className="flex flex-col h-screen min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased overflow-hidden">
      
      {/* Floating Success Toast Alert */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-sans text-xs sm:text-sm font-extrabold px-6 py-4.5 rounded-xl shadow-2xl border border-emerald-500/30 flex items-center gap-3 w-11/12 max-w-2xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-5 h-5 text-white shrink-0 animate-bounce" />
            <div className="flex-1 leading-relaxed">
              {successToast}
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-white hover:text-slate-200 text-xs font-mono font-bold uppercase shrink-0 px-2 py-1 bg-white/10 hover:bg-white/20 rounded"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED TOP HEADER AND PREMIUM TAB BAR BAR */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-805 px-6 py-4.5 space-y-4 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.01)] z-30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase font-mono">Unified Dispatch Hub</span>
            <h1 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight mt-0.5">Logistics &amp; Tracking Center</h1>
            <p className="text-slate-500 text-xs mt-0.5">Control pipeline readiness, run active multimodal cooling fleet checks, and bypass DC barriers dynamically.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-sm text-xs font-mono font-bold border border-slate-200/40 dark:border-slate-705">
              Live PO Lots: {shipments.length}
            </span>
            <div className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-mono text-[10.5px] font-bold px-2.5 py-1 rounded inline-flex items-center gap-1.5 border border-indigo-100/50 dark:border-indigo-900/10">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
              Autonomous Ledger Sync Active
            </div>
          </div>
        </div>

        {/* Search and Core Tab Configuration */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/60 dark:border-slate-850">
          
          {/* Premium Horizontal Tab Bar */}
          <div className="flex bg-slate-200/50 dark:bg-slate-900/60 p-1 rounded-lg border border-slate-200/40 dark:border-slate-800/40 font-mono min-w-0 flex-1 max-w-2xl">
            {isVendor && (
              <button
                onClick={() => setActiveTab('packing')}
                className={cn(
                  "flex-1 py-2 px-3 sm:px-4 rounded-md text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2",
                  activeTab === 'packing'
                    ? "bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-800/20 font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-800/35"
                )}
              >
                <Box className="w-3.5 h-3.5" />
                Warehouse &amp; Packing
              </button>
            )}
            <button
              onClick={() => setActiveTab('transit')}
              className={cn(
                "flex-1 py-2 px-3 sm:px-4 rounded-md text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2",
                activeTab === 'transit'
                  ? "bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-800/20 font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-800/35"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              Active Deliveries
            </button>
          </div>

          {/* Quick Search Filtering */}
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PO, vendor, or cargo..." 
              className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg pl-3.5 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium placeholder-slate-400 dark:text-slate-100 shadow-sm"
            />
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE SCREEN CONTENT */}
      <div className="flex-1 w-full relative overflow-hidden bg-slate-50 dark:bg-slate-950">
        
        <AnimatePresence mode="wait">
          
          {/* TAB 1: WAREHOUSE & PACKING PIPELINE (Pre-Dispatch View) */}
          {activeTab === 'packing' && (
            <motion.div
              key="packing-pipeline"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="absolute inset-0 w-full h-full overflow-y-auto px-6 py-8"
            >
              <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Section summary block */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-805 rounded-xl p-5 shadow-sm gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-505 dark:text-slate-400">Warehouse Readiness Inventory</h3>
                    <p className="text-xs text-slate-500">The following PO lots are currently in pre-dispatch cooling staging and await vendor validation before automated outbound logistics can begin.</p>
                  </div>
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-mono font-extrabold flex items-center gap-2 max-w-[200px] shrink-0">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                    Staging Hold: {preDispatchShipments.length} Lots
                  </span>
                </div>

                {/* Grid of Pending Lots */}
                {preDispatchShipments.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-12 text-center text-slate-450 dark:text-slate-505 max-w-2xl mx-auto flex flex-col items-center justify-center">
                    <Box className="w-12 h-12 text-slate-300 dark:text-slate-800 mb-4 animate-pulse" />
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono uppercase tracking-wider mb-1">Queue Completed</h4>
                    <p className="text-xs text-slate-500 max-w-sm leading-relaxed mt-1">
                      All procured inventory is currently prefilled, packed, and active in transit. Direct bypass logistics operational status: <strong>100% Core Ready.</strong>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {preDispatchShipments.map(s => {
                      const isDelivered = s.status === 'delivered';
                      const isBlanket = s.isBlanket || s.id === 'PO-2026-BLANKET';
                      const activeB = s.currentActiveBatch || 1;
                      const cases = isBlanket ? Math.round(s.quantity / (s.totalBatches || 12)) : s.quantity;
                      const suffix = s.id.includes('BPO-2026-') ? s.id.replace('BPO-2026-', '') : 'BLANKET';
                      const childPOId = `PO-${suffix}-R${activeB.toString().padStart(2, '0')}`;

                      return (
                        <div 
                          key={s.id}
                          className={cn(
                            "bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden",
                            isBlanket 
                              ? "border-indigo-200 dark:border-indigo-900/60 ring-1 ring-indigo-50 dark:ring-indigo-950/25"
                              : "border-slate-200 dark:border-slate-805"
                          )}
                        >
                          {/* Accent line */}
                          <div className={cn(
                            "absolute top-0 left-0 w-full h-1 bg-gradient-to-r",
                            isBlanket ? "from-indigo-600 to-indigo-400" : "from-indigo-505 to-emerald-500"
                          )}></div>

                          {/* Shipment details */}
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-xs font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-widest">
                                  {isBlanket ? `MASTER BPO: ${s.id}` : s.id}
                                </span>
                                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">{s.item}</h4>
                              </div>
                              
                              {isDelivered && (
                                <span className="bg-emerald-600 text-white font-mono text-[8.5px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border border-emerald-500 shrink-0 shadow-sm">
                                  DELIVERED / COMPLETE
                                </span>
                              )}
                            </div>

                            <div className="font-sans text-xs text-slate-650 dark:text-slate-404 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Fulfillment Node: <strong className="font-bold text-slate-850 dark:text-slate-200">{s.origin}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Thermal Guard Specification: <strong className="font-bold text-slate-850 dark:text-slate-200">{s.fleetSpecification}</strong></span>
                              </div>
                              {isBlanket && (
                                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-indigo-650 dark:text-indigo-400">
                                  <span>Progress Status: {s.deliveredBatches || 0} / {s.totalBatches || 12} Batches Completed</span>
                                </div>
                              )}
                            </div>

                            {/* Active release row representing child PO due for dispatch */}
                            {isBlanket && !isDelivered && (
                              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/60 rounded-xl space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase font-mono tracking-widest">CURRENT DUE ITEM</span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-550/15 text-amber-700 dark:text-amber-400 border border-amber-500/10 font-mono animate-pulse">Awaiting Dispatch</span>
                                </div>
                                <div className="text-xs font-bold font-sans text-slate-800 dark:text-slate-250">
                                  Active Release: <span className="font-mono text-indigo-600 dark:text-indigo-400">{childPOId}</span> • {cases.toLocaleString()} Cases
                                </div>
                                
                                {dispatchingChildId === childPOId && (
                                  <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-450 font-mono font-bold">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-emerald-555" />
                                    <span>Applying loading spinner &amp; dispatching strictly...</span>
                                  </div>
                                )}
                              </div>
                            )}

                             {/* Micro-Progress Bar or Blanket Timeline */}
                             {isBlanket ? (
                              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                                <button 
                                  type="button"
                                  onClick={() => setExpandedBlankets(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                  className="flex justify-between items-center w-full text-left text-xs font-bold font-mono text-indigo-650 dark:text-indigo-400 uppercase tracking-wider hover:underline"
                                >
                                  <span>Staggered Release Timeline</span>
                                  <span className="text-[10px] text-slate-400 font-extrabold">{expandedBlankets[s.id] !== false ? '▼ HIDE' : '▲ SHOW'}</span>
                                </button>
                                
                                {expandedBlankets[s.id] !== false && (
                                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {Array.from({ length: s.totalBatches || 12 }).map((_, idx) => {
                                      const bNum = idx + 1;
                                      const curActiveNum = s.currentActiveBatch || 1;
                                      
                                      let bTarget = `In ${bNum - curActiveNum} Weeks`;
                                      if (bNum === curActiveNum) {
                                        bTarget = "This Week";
                                      } else if (bNum === curActiveNum + 1) {
                                        bTarget = "Next Week";
                                      } else if (bNum < curActiveNum) {
                                        bTarget = "Completed";
                                      }
                                      
                                      let bStatus = "Scheduled / On Hold";
                                      if (bNum < curActiveNum) {
                                        bStatus = "Delivered";
                                      } else if (bNum === curActiveNum) {
                                        bStatus = "Ready to Pack";
                                      }
                                      
                                      return (
                                        <div 
                                          key={bNum} 
                                          className={cn(
                                            "p-2 border rounded-lg text-[10.5px] font-mono transition-colors",
                                            bNum === curActiveNum 
                                              ? "bg-emerald-500/10 dark:bg-emerald-950/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-450 ring-1 ring-emerald-500/10"
                                              : bNum < curActiveNum
                                                ? "bg-slate-50/50 dark:bg-slate-950/10 border-slate-100 dark:border-slate-800/80 text-slate-400"
                                                : "bg-slate-50/20 dark:bg-slate-950/5 border-slate-150 dark:border-slate-850 text-slate-500"
                                          )}
                                        >
                                          <div className="flex justify-between font-bold flex-wrap gap-1">
                                            <span>Release Batch #{bNum} of {s.totalBatches || 12} ({cases.toLocaleString()} Cases)</span>
                                            <span className={cn(
                                              "font-black tracking-widest uppercase text-[8.5px] px-1 rounded",
                                              bNum === curActiveNum 
                                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : bNum < curActiveNum
                                                  ? "bg-slate-200 dark:bg-slate-800 text-slate-500"
                                                  : "bg-slate-100 dark:bg-slate-900 text-slate-455"
                                            )}>{bStatus}</span>
                                          </div>
                                          <div className="text-[9px] text-slate-400 mt-0.5">• Target Dispatch: {bTarget}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                             ) : (
                              <>
                                {/* Micro-Progress Bar */}
                                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                                  <div className="flex justify-between items-center text-[11px] font-mono">
                                    <span className="text-slate-400 uppercase font-bold">Checklist Stage</span>
                                    <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">Packing Status: {s.packingProgress || 65}% Items Staged</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-200/20 dark:border-slate-850">
                                    <div 
                                      className="h-full bg-gradient-to-r from-emerald-400 to-indigo-555 rounded-full transition-all duration-500"
                                      style={{ width: `${s.packingProgress || 65}%` }}
                                    ></div>
                                  </div>
                                </div>

                                {/* Telemetry Indicator */}
                                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex items-center gap-3">
                                  <Thermometer className="w-4 h-4 text-emerald-500 shrink-0 animate-pulse" />
                                  <div className="text-[11px] font-mono leading-tight">
                                    <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Staging Temperature Core Target</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-extrabold">{s.preCoolingTarget || `Pre-Cooling Target: 3°C (Currently: ${s.temp})`}</strong>
                                  </div>
                                </div>
                              </>
                             )}
                          </div>

                          {/* Primary Action Button */}
                          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                            {isDelivered ? (
                              <div className="w-full text-center py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 text-[10.5px] font-mono font-black text-slate-500 uppercase tracking-widest rounded-lg">
                                DELIVERED / LOGISTICS PIPELINE CLOSED
                              </div>
                            ) : isBlanket ? (
                              <button
                                onClick={() => handleDispatch(s.id, s.item, childPOId)}
                                disabled={dispatchingId !== null || activeB > (s.totalBatches || 12)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow"
                              >
                                {dispatchingChildId === childPOId ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    Dispatching Release {childPOId}...
                                  </>
                                ) : (
                                  <>
                                    Finalize Packing &amp; Dispatch {childPOId} <ArrowRight className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDispatch(s.id, s.item)}
                                disabled={dispatchingId !== null}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow animate-pulse"
                              >
                                {dispatchingId === s.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    Generating Shipping Manifesto...
                                  </>
                                ) : (
                                  <>
                                    Finalize Packing &amp; Dispatch <ArrowRight className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* TAB 2: ACTIVE DELIVERIES & TRANSIT (Real-Time Tracking View) */}
          {activeTab === 'transit' && (
            <motion.div
              key="transit-realtime"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full flex flex-col lg:flex-row overflow-hidden"
            >
              
              {/* LEFT RAIL: CONTROL COLUMN WITH DISPATCHED FLEETS */}
              <div className="w-full lg:w-[35%] xl:w-[33%] bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-150 dark:border-slate-805 flex flex-col h-[40vh] lg:h-full z-15 shadow-sm shrink-0">
                
                {/* Search / Status Subtitle Info */}
                <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10.5px] font-mono text-slate-500 shrink-0">
                  <span className="font-bold">FLEET DIRECT MONITOR</span>
                  <span>Active On Road: {transitShipments.length} Lots</span>
                </div>

                {/* Fleet list wrap */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  
                  {isVendor ? (
                    <>
                      {/* CRITICAL DELAYS AND EXTREM LIGHT ANOMALIES */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-3 px-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                          <h3 className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-widest font-mono">Disruption Warnings</h3>
                        </div>

                        {groupedTransit.critical.length === 0 ? (
                          <div className="text-center py-4 text-xs font-mono text-slate-450 dark:text-slate-505 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/25 dark:bg-slate-950/10">
                            No corridor stress incidents detected. Thermal control normal.
                          </div>
                        ) : (
                          <div className="space-y-3.5">
                            {groupedTransit.critical.map(s => (
                              <ShipmentListItem 
                                key={s.id}
                                shipment={s}
                                active={selectedShipmentId === s.id}
                                onClick={() => handleSelectShipment(s)}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* REGULAR AND ON TRACK LOADS */}
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <div className="flex items-center gap-1.5 mb-3 px-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-555"></span>
                          <h3 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-404 uppercase tracking-widest font-mono">Operational Deliveries</h3>
                        </div>

                        {groupedTransit.onTrack.length === 0 ? (
                          <div className="text-center py-5 text-xs text-slate-400">
                            No active secure shipments.
                          </div>
                        ) : (
                          <div className="space-y-3.5">
                            {groupedTransit.onTrack.map(s => (
                              <ShipmentListItem 
                                key={s.id}
                                shipment={s}
                                active={selectedShipmentId === s.id}
                                onClick={() => handleSelectShipment(s)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* BUYER INTUITIVE GROUPED MASTER BPO & NESTED CHILD PIPELINE */
                    <div className="space-y-4">
                      {(() => {
                        // 1. Identify Master BPOs in active storage config
                        const masterBPOs = shipments.filter(ship => ship.isBlanket || ship.id === 'PO-2026-BLANKET');
                        
                        // 2. Separate active transit shipments into standalone and child releases
                        const activeChildren = transitShipments.filter(t => t.parentBpoId);
                        
                        const standaloneDeliveries = transitShipments.filter(t => {
                          const queryLower = searchQuery.toLowerCase();
                          const matchesSearch = !searchQuery || 
                            t.id.toLowerCase().includes(queryLower) ||
                            (t.product || '').toLowerCase().includes(queryLower) ||
                            (t.vendor || '').toLowerCase().includes(queryLower) ||
                            (t.item || '').toLowerCase().includes(queryLower);
                            
                          if (!matchesSearch) return false;
                          
                          // Standalone doesn't have parentBpoId
                          return !t.parentBpoId && t.id !== 'PO-2026-BLANKET' && !t.isBlanketBatch;
                        });

                        // Filter and group master BPOs that have active transit children matching search query
                        const bpoGroups = masterBPOs.map(master => {
                          const childrenInTransit = transitShipments.filter(t => 
                            t.parentBpoId === master.id || 
                            (master.id === 'PO-2026-BLANKET' && t.id.startsWith('PO-BLANKET-R'))
                          );

                          const queryLower = searchQuery.toLowerCase();
                          const matchesSearch = !searchQuery || 
                            master.id.toLowerCase().includes(queryLower) ||
                            (master.product || '').toLowerCase().includes(queryLower) ||
                            (master.vendor || '').toLowerCase().includes(queryLower) ||
                            childrenInTransit.some(c => 
                              c.id.toLowerCase().includes(queryLower) || 
                              (c.product || '').toLowerCase().includes(queryLower)
                            );

                          if (childrenInTransit.length === 0 || !matchesSearch) return null;

                          return {
                            master,
                            childrenInTransit
                          };
                        }).filter(Boolean);

                        const totalDisplayCount = standaloneDeliveries.length + bpoGroups.length;

                        if (totalDisplayCount === 0) {
                          return (
                            <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-505 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-55/10">
                              No active secure shipments matches query.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-5">
                            {/* BPO Groups with metric dashboards & child rows */}
                            {bpoGroups.map((group: any) => {
                              const master = group.master;
                              const children = group.childrenInTransit;
                              const casesPerB = Math.round(master.quantity / (master.totalBatches || 12));
                              const totalReceivedVol = (master.deliveredBatches || 0) * casesPerB;
                              const totalInTransitVol = children.length * casesPerB;

                              return (
                                <div 
                                  key={master.id} 
                                  className="border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/15 dark:bg-indigo-950/20 rounded-2xl p-4 space-y-3.5 shadow-sm ring-1 ring-indigo-50/15"
                                >
                                  {/* Group Header */}
                                  <div className="border-b border-indigo-150/40 dark:border-indigo-900/40 pb-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-mono text-[9px] font-extrabold text-indigo-750 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded uppercase tracking-wider">
                                          Master Procurement Contract
                                        </span>
                                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 mt-1.5 font-mono">
                                          {master.id}: {master.product || master.item || 'Enterprise Blanket PO'}
                                        </h4>
                                      </div>
                                    </div>

                                    {/* Overall Relational metrics */}
                                    <div className="grid grid-cols-3 gap-1.5 mt-3 font-mono text-[9px] text-center">
                                      <div className="p-1.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-150/50 dark:border-slate-850/80 rounded">
                                        <span className="text-slate-450 block uppercase text-[8px] font-bold">Total Volume</span>
                                        <strong className="text-slate-755 dark:text-slate-200 font-extrabold">{master.quantity.toLocaleString()} {master.unit || 'Cases'}</strong>
                                      </div>
                                      <div className="p-1.5 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 rounded">
                                        <span className="text-emerald-700 dark:text-emerald-400 block uppercase text-[8px] font-bold">Successfully Received</span>
                                        <strong className="text-emerald-700 dark:text-emerald-350 font-extrabold">{totalReceivedVol.toLocaleString()} Cases</strong>
                                      </div>
                                      <div className="p-1.5 bg-indigo-505/5 dark:bg-indigo-950/20 border border-indigo-555/10 rounded animate-pulse">
                                        <span className="text-indigo-650 dark:text-indigo-400 block uppercase text-[8px] font-bold">In-Transit</span>
                                        <strong className="text-indigo-700 dark:text-indigo-350 font-extrabold">{totalInTransitVol.toLocaleString()} Cases</strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Child PO entries */}
                                  <div className="space-y-2.5 pl-2 border-l-2 border-indigo-200/50 dark:border-indigo-900/45">
                                    {children.map((child: any) => {
                                      const isChildActive = selectedShipmentId === child.id;
                                      return (
                                        <div
                                          key={child.id}
                                          onClick={() => handleSelectShipment(child)}
                                          className={cn(
                                            "p-4 rounded-xl border transition-all duration-300 ease-out cursor-pointer relative overflow-hidden flex flex-col gap-3 hover:-translate-y-1.5 hover:shadow-md",
                                            isChildActive
                                              ? "border-indigo-500 dark:border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/20 ring-1 ring-indigo-500 shadow-md"
                                              : "border-[#E2E8F0] dark:border-slate-805 bg-[#F8FAFC] dark:bg-slate-900 text-slate-900 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900/80"
                                          )}
                                        >
                                          {/* BASE CONTAINER & INTEGRATED STATUS DOTS */}
                                          <div className="flex flex-col gap-1.5 font-sans">
                                            <div className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
                                              <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 tracking-tight leading-snug">
                                                {child.id}: {master.product || master.item || 'Avocados'}
                                              </h4>
                                            </div>

                                            {/* Purged Physical Asset Identifier, direct metrics text underneath */}
                                            <div className="font-mono text-[0.82rem] text-[#64748B] dark:text-slate-400 leading-snug font-medium select-none">
                                              Container: MSKU-784219-5 • Beacon: IoT-TH-9941
                                            </div>

                                            {/* Streamlined timeline block */}
                                            <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-slate-100 mt-1 select-none">
                                              <span className="text-slate-700 dark:text-slate-350 font-semibold">
                                                In Transit
                                              </span>
                                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 ml-auto">
                                                <span>{child.eta || '2 Days'}</span>
                                              </div>
                                            </div>

                                            {/* Sleek Dual Column Environmental Matrix */}
                                            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#F1F5F9] dark:border-slate-800/80 mt-1">
                                              {/* Left Column (Internal Cold-Chain) */}
                                              <div className="flex flex-col pointer-events-none select-none">
                                                <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">Internal Temp</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{child.temp || "3.5°C"}</span>
                                                  <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1 rounded lowercase border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
                                                    stable
                                                  </span>
                                                </div>
                                              </div>
                                              {/* Right Column */}
                                              <div className="flex flex-col text-right font-sans select-none">
                                                <span className="text-[9.5px] uppercase font-bold text-slate-400 font-mono tracking-wider">Ambient Ext</span>
                                                <div className="text-[11px] text-slate-600 dark:text-slate-350 font-medium mt-0.5 whitespace-nowrap">
                                                  72°F • Clear
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Standard standalone shipments list */}
                            {standaloneDeliveries.length > 0 && (
                              <div className="space-y-3.5">
                                {bpoGroups.length > 0 && (
                                  <div className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-505 uppercase font-mono pl-1">
                                    Direct Standard Deliveries
                                  </div>
                                )}
                                {standaloneDeliveries.map((s: any) => (
                                  <BuyerShipmentListItem 
                                    key={s.id}
                                    shipment={s}
                                    active={selectedShipmentId === s.id}
                                    onClick={() => handleSelectShipment(s)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Bottom roles status block */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-805 flex justify-between items-center text-[10.5px] font-mono text-slate-500">
                  <span>ROLE: {isVendor ? "Vendor Fleet Agent" : "Cold Chain Buyer"}</span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    GIS Feeds Active
                  </span>
                </div>
              </div>

              {/* RIGHT WORKSPACE: LIVE SPLIT-SCREEN GEOSPATIAL MAP / CALENDAR GRID */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative flex flex-col h-full overflow-hidden">
                
                {/* Secondary Layout Switch: Map vs Calendar on Map block */}
                <div className="absolute top-4 right-4 z-20 flex bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-1">
                  <button 
                    onClick={() => setViewMode('map')}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-bold font-mono uppercase tracking-tight flex items-center gap-1.5 transition-all cursor-pointer", 
                      viewMode === 'map' 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850"
                    )}
                  >
                    <MapIcon className="w-3.5 h-3.5" /> Map View
                  </button>
                  <button 
                    onClick={() => setViewMode('calendar')}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-bold font-mono uppercase tracking-tight flex items-center gap-1.5 transition-all cursor-pointer", 
                      viewMode === 'calendar' 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850"
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" /> Calendar View
                  </button>
                </div>

                {/* Inner Reroute feedback */}
                <AnimatePresence>
                  {feedbackMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="absolute top-4 left-4 right-64 z-50 bg-emerald-600 text-white text-xs font-extrabold px-4.5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-emerald-500/30"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                      <span>{feedbackMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {viewMode === 'map' ? (
                    <motion.div 
                      key="map-layout"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 w-full h-full flex flex-col pt-18 overflow-hidden"
                    >
                      {/* AI DISRUPTION HIGHLIGHT OVERLAYS */}
                      <div className="px-6 pb-2 shrink-0 z-10 w-full max-w-5xl mx-auto space-y-4">
                          {selectedShipment && selectedShipment.status !== 'delivered' && aiAlerts[selectedShipment.id]?.hasAnomaly && isVendor && (
                            <motion.div 
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="bg-red-50/95 dark:bg-rose-950/20 border-l-4 border-rose-500 dark:border-rose-500 rounded-xl p-5 shadow-sm border border-rose-200/50 dark:border-rose-900/40 relative overflow-hidden flex flex-col gap-4 font-sans backdrop-blur-md"
                            >
                              <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl"></div>
                              
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
                                <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-rose-100 dark:bg-rose-955 text-rose-600 dark:text-rose-450 rounded-lg shrink-0 mt-0.5 animate-pulse">
                                  <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-xs font-black text-rose-950 dark:text-rose-250 uppercase tracking-widest font-mono">
                                    🤖 AI Disruption Intelligence: Corridor Interrupted ({aiAlerts[selectedShipment.id].routeId})
                                  </h4>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 font-mono">
                                      {aiAlerts[selectedShipment.id].threatVector}
                                    </span>
                                    <span className="bg-rose-650 text-white font-mono text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                                      CRITICAL INCIDENT
                                    </span>
                                  </div>

                                  {/* High-fidelity explicit diagnostic grids requested */}
                                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                                    <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-rose-150/40 dark:border-rose-950/40 space-y-1">
                                      <span className="text-[8px] font-mono font-black uppercase text-rose-600 dark:text-rose-400 block tracking-wider">⏱️ Projected Arrival Delay Modifier</span>
                                      <p className="text-base font-black font-mono text-rose-700 dark:text-rose-300">
                                        {selectedShipment.id === "PO-2026-8842" ? "+14.0 Hours" : "+2.4 Hours"}
                                      </p>
                                      <span className="text-[9px] text-slate-500 font-medium font-sans">Climate control safety delay computed</span>
                                    </div>
                                    
                                    <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-indigo-150/40 dark:border-indigo-950/40 space-y-1">
                                      <span className="text-[8px] font-mono font-black uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">⌥ Suggested Alternative Bypass Options</span>
                                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 font-sans truncate">
                                        {aiAlerts[selectedShipment.id].alternativeRouteName || "Northern I-81 Bypass Corridor"}
                                      </p>
                                      <span className="text-[9px] text-indigo-505 font-bold font-mono">Saves 92% of perishable food lot</span>
                                    </div>
                                  </div>
                                  
                                  <p className="text-xs text-rose-800 dark:text-rose-350 mt-3.5 font-medium bg-white/70 dark:bg-slate-900/50 p-2.5 rounded-lg border border-rose-100 dark:border-rose-950/20 w-fit max-w-full font-mono flex items-center gap-1.5">
                                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>{aiAlerts[selectedShipment.id].delayText}</span>
                                  </p>
                                </div>
                                </div>

                                {isEvaluating && (
                                  <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-550">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Recalculating routing options...
                                  </div>
                                )}
                              </div>

                              <div className="border-t border-rose-150 dark:border-rose-950/40 pt-4 space-y-3 relative z-10">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-widest font-mono block">AI Intelligent Mitigation Route</span>
                                  <div className="text-xs text-rose-800 dark:text-rose-300 font-sans leading-relaxed bg-white/40 dark:bg-rose-950/10 p-3 rounded-lg border border-rose-150/50">
                                    <strong>{aiAlerts[selectedShipment.id].mitigationText}</strong>
                                  </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button 
                                    onClick={() => handleApproveReroute(selectedShipment.id)}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-red-200 shadow-md flex items-center gap-2 font-mono"
                                  >
                                    Approve Reroute &amp; Dispatch Alert
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {selectedShipment && selectedShipment.status === 'delivered' && (
                            <motion.div 
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="bg-emerald-50/90 dark:bg-emerald-950/20 border-l-4 border-emerald-500 rounded-xl p-4.5 border border-emerald-200/50 dark:border-emerald-900/40 relative flex items-center justify-between gap-4 font-sans backdrop-blur-md"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                                  <CheckCircle className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-300 font-mono uppercase tracking-widest">
                                    LOT COMPLETED: PIPELINE CLOSED
                                  </h4>
                                  <p className="text-[11px] text-emerald-800 dark:text-emerald-450 mt-0.5 font-medium leading-relaxed">
                                    Delivery successfully finalized &amp; auto-received at DC Hub. This PO [{selectedShipment.id}] has finished cold chain accountability loop safely.
                                  </p>
                                </div>
                              </div>
                              <span className="bg-emerald-600 text-white font-mono text-[8.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm">
                                COMPLETED
                              </span>
                            </motion.div>
                          )}
                        </div>

                      {/* LIVE SVG CARRIER VECTOR TRACK MAP */}
                      <div className="flex-1 w-full max-w-5xl mx-auto px-6 pb-6 relative overflow-hidden flex flex-col">
                        <div className="w-full h-full bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden shadow-2xl flex flex-col">
                          
                          {/* ACTIVE GOOGLE MAPS PLATFORM API INTEGRATED ENGINE CONTAINER */}
                          <div className="flex-1 w-full relative overflow-hidden min-h-[460px]">
                            <LogisticsGoogleMap 
                              selectedShipment={selectedShipment}
                              onSelectShipment={setSelectedShipmentId}
                              isScanningWeather={isScanningWeather}
                            />
                          </div>

                          {/* FIXED BOTTOM DETAIL TELEMETRY BOARD PANEL */}
                          <div 
                            style={{ height: 'auto', minHeight: 'max-content', paddingBottom: '24px' }}
                            className="mt-auto h-auto min-h-max bg-slate-900 border-t border-slate-800 p-4.5 pb-6 z-10 flex flex-wrap items-center justify-between gap-4 font-mono select-none overflow-visible w-full"
                          >
                            {selectedShipment ? (
                              (() => {
                                const rData = getRouteData(selectedShipment);
                                return (
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full overflow-visible">
                                    <div className="flex-1 min-w-[280px] overflow-visible">
                                      <div className="text-[9px] text-slate-455 font-bold uppercase tracking-widest overflow-visible">REAL-TIME COLLATERAL LOGISTICS FEED</div>
                                      <div className="text-sm font-bold text-slate-100 overflow-visible mt-0.5">{selectedShipment.vendor} — {selectedShipment.item}</div>
                                      <div className="text-[11px] text-slate-400 mt-1 overflow-visible">
                                        Corridor: <span className="text-indigo-400 font-bold overflow-visible">{selectedShipment.logisticsRouteAndProvider}</span> • Status: <span className={cn("font-bold overflow-visible", !isVendor ? "text-indigo-400" : (selectedShipment.status === 'delivered' ? 'text-emerald-400' : selectedShipment.status === 'delayed' ? 'text-rose-455' : 'text-emerald-450'))}>
                                          {!isVendor 
                                            ? (selectedShipment.status === 'delivered' ? 'DELIVERED / ARCHIVED' : `IN TRANSIT`)
                                            : (selectedShipment.status === 'delivered' ? 'DELIVERED / LOGISTICS PIPELINE CLOSED' : selectedShipment.status.toUpperCase())
                                          }
                                        </span>
                                      </div>

                                      {/* Blanket PO Progress Banner */}
                                      {(selectedShipment.isBlanket || selectedShipment.id?.includes('BLANKET') || selectedShipment.parentBlanketId?.includes('BLANKET')) && (
                                        <div className="mt-2.5 p-2.5 bg-indigo-950/60 border border-indigo-810/60 rounded-xl text-xs font-mono font-bold text-indigo-300 max-w-xl">
                                          📋 PO-2026-BLANKET • 3-Month Avocado Contract • Progress: {selectedShipment.deliveredBatches || (selectedShipment.id?.includes('B') ? selectedShipment.id.split('-B')[1] : '1')}/12 Batches Delivered
                                        </div>
                                      )}

                                      {/* Export Official PO Document Button */}
                                      <div className="mt-3 flex flex-wrap gap-2.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const activeBNum = selectedShipment.id === "PO-2026-BLANKET" ? "2 of 12" : "1 of 12";
                                            setPdfModalData({
                                              poId: selectedShipment.id || 'PO-2026-8842-R01',
                                              parentBpoId: selectedShipment.parentBpoId || selectedShipment.parentBlanketId || 'BPO-2026-8842',
                                              horizon: selectedShipment.contractHorizon || '3-Month Enterprise Timeline',
                                              batchIndex: `Release Batch ${activeBNum}`,
                                              targetDC: selectedShipment.destination === 'Chicago DC' || selectedShipment.destination === 'Chicago Logistics Hub' ? 'Chicago DC East' : selectedShipment.destination || 'Chicago DC East',
                                              item: selectedShipment.product || selectedShipment.item || 'Organic Fruits',
                                              qty: selectedShipment.quantity || 1200,
                                              unit: selectedShipment.unit || 'Cases',
                                              pricePerUnit: selectedShipment.pricePerCase || 15.50,
                                              vendorName: selectedShipment.vendor || 'Global Farms Suppliers',
                                              vendorScore: '98%',
                                              tempSpec: selectedShipment.temp || '36°F - 42°F',
                                              transitMaxSpec: '36 Hours max',
                                              shelfLifeSpec: '14 days',
                                              containerId: 'MSKU 784219-5'
                                            });
                                            setIsPdfModalOpen(true);
                                          }}
                                          className="px-3.5 py-1.5 bg-slate-850 hover:bg-slate-750 hover:border-indigo-500 border border-slate-700/80 rounded-lg text-xs font-mono font-bold text-slate-100 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                          <span>📄 Export Document</span>
                                        </button>
                                      </div>

                                      {/* ROW CONTAINER FOR 'Active Refrigerated' BADGE AND TRANSIT TIME */}
                                      <div 
                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', overflow: 'visible' }}
                                        className="flex flex-wrap items-center gap-3 mt-4 overflow-visible"
                                      >
                                        {/* Outbound spec Badge */}
                                        <div className="flex items-center gap-2 bg-indigo-950/80 border border-indigo-805/60 px-3 py-1 rounded-md text-xs font-black text-indigo-300 font-mono tracking-wide overflow-visible shadow-sm">
                                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shrink-0 overflow-visible" />
                                          <span style={{ overflow: 'visible' }} className="overflow-visible uppercase text-[9.5px]">
                                            {selectedShipment.fleetSpecification}
                                          </span>
                                        </div>

                                        {/* Transit ETA Badge */}
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1 rounded-md text-xs font-black text-slate-300 font-mono tracking-wide overflow-visible shadow-sm">
                                          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0 overflow-visible" />
                                          <span style={{ overflow: 'visible' }} className="overflow-visible uppercase text-[9.5px] text-slate-300">
                                            {selectedShipment.status === 'delivered' ? 'Landed @ Central DC' : (selectedShipment.eta ? `ETA: ${selectedShipment.eta}` : '6.5 Hours')}
                                          </span>
                                        </div>

                                        {/* Ambient Thermal Badge */}
                                        <div className={cn(
                                          "flex items-center gap-2 border px-3 py-1 rounded-md text-xs font-black font-mono tracking-wide overflow-visible shadow-sm",
                                          !isVendor 
                                            ? "bg-slate-950 border-slate-800 text-emerald-450" 
                                            : (selectedShipment.status === 'delivered' 
                                                ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' 
                                                : selectedShipment.status === 'delayed' 
                                                  ? 'bg-rose-950/40 border-rose-900/65 text-rose-400' 
                                                  : 'bg-emerald-900/20 border-emerald-900/60 text-emerald-400')
                                        )}>
                                          <Thermometer className="w-3.5 h-3.5 text-emerald-400 shrink-0 overflow-visible" />
                                          <span style={{ overflow: 'visible' }} className="overflow-visible uppercase text-[9.5px]">
                                            {selectedShipment.temp}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="text-slate-500 text-xs py-2 w-full text-center">Select an active tracking card from the list to view live telemetry statistics.</div>
                            )}
                          </div>

                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="calendar-layout"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 w-full h-full bg-slate-50 dark:bg-slate-950 p-6 pt-20 overflow-auto"
                    >
                      {/* Active transit calendar overview */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 max-w-5xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <span className="text-[10px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase font-mono">Dispatched Pipeline Calendar</span>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Delivery Schedule</h2>
                          </div>
                          <div className="flex gap-2 font-mono">
                            <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-2 border border-slate-200 dark:border-slate-755 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </button>
                            <span className="flex items-center px-4 font-bold text-xs text-slate-705 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-810 rounded-md">
                              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                            </span>
                            <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 border border-slate-200 dark:border-slate-755 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                          {weekDays.map((day, idx) => {
                            const dayDeliveries = allDeliveriesForCalendar.filter(d => isSameDay(d.date, day));
                            const isToday = isSameDay(day, new Date());
                            return (
                              <div key={idx} className={cn("h-[400px] flex flex-col border rounded-xl overflow-hidden bg-slate-55/60 dark:bg-slate-950/40", isToday ? "border-indigo-400 ring-1 ring-indigo-400" : "border-slate-200 dark:border-slate-800")}>
                                <div className={cn("px-3 py-2 border-b font-medium text-xs text-center shrink-0", isToday ? "bg-indigo-50/70 dark:bg-indigo-950/45 text-indigo-800 dark:text-indigo-400 font-extrabold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300")}>
                                  {format(day, 'EEE')} <br/> <span className={cn("text-lg", isToday ? "text-indigo-700 dark:text-indigo-455 font-black" : "font-semibold")}>{format(day, 'd')}</span>
                                </div>
                                <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                                  {dayDeliveries.map((del, dIdx) => (
                                    <div key={dIdx} className={cn(
                                      "p-2.5 rounded-lg border text-xs shadow-sm transition-all hover:shadow bg-white dark:bg-slate-900",
                                      del.issue === 'delivered' ? "border-emerald-300 bg-emerald-50/10 text-emerald-700 dark:text-emerald-400" :
                                      del.issue === 'delayed' ? "border-rose-250 bg-rose-50/10 dark:bg-rose-950/5 text-rose-700 dark:text-rose-400" : "border-slate-150 dark:border-slate-810 text-slate-850 dark:text-slate-200"
                                    )}>
                                      <div className="font-bold flex items-center justify-between font-mono text-[10px]">
                                        <span>{del.id}</span>
                                        {del.type === 'ship' ? <Ship className="w-3 h-3 text-slate-400" /> : <Truck className="w-3 h-3 text-slate-400" />}
                                      </div>
                                      <div className="text-slate-500 dark:text-slate-404 mt-1 font-sans font-medium line-clamp-2 leading-snug">{del.items}</div>
                                      <div className="text-[9.5px] text-slate-400 dark:text-slate-550 mt-1 font-mono">{del.vendor}</div>
                                      
                                      {/* Delivered badge inside calendar */}
                                      {del.issue === 'delivered' && (
                                        <div className="mt-1.5 bg-emerald-700 text-white font-mono text-[8px] font-black uppercase text-center py-0.5 rounded">
                                          CLOSED
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>

            </motion.div>
          )}

        </AnimatePresence>

      </div>

      <AnimatePresence>
        {isPdfModalOpen && pdfModalData && (
          <POPDFDocumentModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            data={pdfModalData}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

interface ShipmentListItemProps {
  key?: any;
  shipment: Shipment;
  active: boolean;
  onClick: () => void;
}

function ShipmentListItem({ shipment, active, onClick }: ShipmentListItemProps) {
  if (!shipment) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs font-mono">
        Offline Shipment Module (Pending Sync)
      </div>
    );
  }

  const isDelayed = shipment?.status === 'delayed' || shipment?.hasAnomaly;
  const isDelivered = shipment?.status === 'delivered';

  const dotColor = isDelayed && !isDelivered ? "bg-[#D97706]" : "bg-[#10B981]";
  
  let displayStatus = shipment?.status || "Pending Data sync";
  if (isDelivered) {
    displayStatus = "Delivered";
  } else if (shipment?.rerouted) {
    displayStatus = "Approaching DC";
  } else if (shipment?.id === "PO-2026-9912A") {
    displayStatus = "Delayed via Weather Detour";
  } else if (isDelayed) {
    displayStatus = "Delayed via Weather Detour";
  }

  let displayETA = shipment?.eta || "Pending Data sync";
  if (shipment?.id === "PO-2026-8842") {
    displayETA = "Oct 19, 08:30 AM";
  } else if (shipment?.id === "PO-2026-9912A") {
    displayETA = "Oct 20, 01:39 PM";
  } else if (shipment?.id === "PO-2026-7731C") {
    displayETA = "Oct 22, 02:45 PM";
  }

  let delayBadge = "";
  if (shipment?.id === "PO-2026-9912A") {
    delayBadge = "+2.4 hrs";
  } else if (shipment?.id === "PO-2026-8842") {
    delayBadge = "+14.0 hrs";
  }

  const cleanTemp = shipment?.temp ? shipment.temp.split(' ')[0] : (isDelivered ? "3.0°C" : "3.0°C");

  let ambientText = shipment?.telemetry?.ambientTemp || "72°F • Clear";
  if (shipment?.id === "PO-2026-8842") {
    ambientText = shipment?.telemetry?.ambientTemp || "94°F • Extreme Heat";
  } else if (shipment?.id === "PO-2026-9912A") {
    ambientText = shipment?.telemetry?.ambientTemp || "42°F • Rain & Heavy Winds";
  }

  const cargoName = shipment?.product || (shipment?.item ? shipment.item.split(' of ')[1] : '') || shipment?.item || "Pending Data sync";
  const containerIdStr = shipment?.telemetry?.containerId || "MSKU-784219-5";
  const beaconIdStr = "IoT-TH-9941";

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border transition-all duration-300 ease-out cursor-pointer relative overflow-hidden flex flex-col gap-3 hover:-translate-y-1.5 hover:shadow-md",
        active 
          ? "border-indigo-500 dark:border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/20 ring-1 ring-indigo-500 shadow-md" 
          : "border-[#E2E8F0] dark:border-slate-805 bg-[#F8FAFC] dark:bg-slate-900 text-slate-900 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900/80"
      )}
    >
      {/* BASE CONTAINER & INTEGRATED STATUS DOTS */}
      <div className="flex flex-col gap-1.5 font-sans">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
          {/* Unified title */}
          <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 tracking-tight leading-snug">
            {shipment?.id || "Pending Data sync"}: {cargoName}
          </h4>
        </div>

        {/* Purged Physical Asset Identifier, direct metrics text underneath */}
        <div className="font-mono text-[0.82rem] text-[#64748B] dark:text-slate-404 leading-snug font-medium select-none">
          Container: {containerIdStr} • Beacon: {beaconIdStr}
        </div>

        {/* Streamlined timeline block with status and eta */}
        <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-slate-100 mt-1 select-none">
          <span className={cn(
            isDelivered ? "text-emerald-600 dark:text-emerald-450" : (shipment?.status === 'delayed' || shipment?.hasAnomaly) ? "text-[#D97706]" : "text-slate-700 dark:text-slate-355"
          )}>
            {displayStatus}
          </span>
          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 ml-auto">
            <span>{isDelivered ? "Closed" : displayETA}</span>
            {delayBadge && !isDelivered && (
              <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[9.5px] font-bold border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 font-sans ml-1">
                {delayBadge}
              </span>
            )}
          </div>
        </div>

        {/* Sleek Dual Column Environmental Matrix */}
        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#F1F5F9] dark:border-slate-800/80 mt-1">
          {/* Left Column (Internal Cold-Chain) */}
          <div className="flex flex-col pointer-events-none select-none">
            <span className="text-[9.5px] uppercase font-bold text-slate-445 tracking-wider">Internal Temp</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cleanTemp}</span>
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1 rounded lowercase border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
                stable
              </span>
            </div>
          </div>
          {/* Right Column (Ambient External Environment) */}
          <div className="flex flex-col text-right font-sans select-none">
            <span className="text-[9.5px] uppercase font-bold text-slate-445 font-mono tracking-wider">Ambient Ext</span>
            <div className="text-[11px] text-slate-605 dark:text-slate-355 font-medium mt-0.5 whitespace-nowrap">
              {ambientText}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

interface BuyerShipmentListItemProps {
  key?: any;
  shipment: Shipment;
  active: boolean;
  onClick: () => void;
}

function BuyerShipmentListItem({ shipment, active, onClick }: BuyerShipmentListItemProps) {
  if (!shipment) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs font-mono">
        Offline Shipment Module (Pending Sync)
      </div>
    );
  }

  const isDelayed = shipment?.status === 'delayed' || shipment?.hasAnomaly;
  const isDelivered = shipment?.status === 'delivered';

  const dotColor = isDelayed && !isDelivered ? "bg-[#D97706]" : "bg-[#10B981]";
  
  let displayStatus = shipment?.status || "Pending Data sync";
  if (isDelivered) {
    displayStatus = "Delivered";
  } else if (shipment?.rerouted) {
    displayStatus = "Approaching DC";
  } else if (shipment?.id === "PO-2026-9912A") {
    displayStatus = "Delayed via Weather Detour";
  } else if (isDelayed) {
    displayStatus = "Delayed via Weather Detour";
  }

  let displayETA = shipment?.eta || "Pending Data sync";
  if (shipment?.id === "PO-2026-8842") {
    displayETA = "Oct 19, 08:30 AM";
  } else if (shipment?.id === "PO-2026-9912A") {
    displayETA = "Oct 20, 01:39 PM";
  } else if (shipment?.id === "PO-2026-7731C") {
    displayETA = "Oct 22, 02:45 PM";
  }

  let delayBadge = "";
  if (shipment?.id === "PO-2026-9912A") {
    delayBadge = "+2.4 hrs";
  } else if (shipment?.id === "PO-2026-8842") {
    delayBadge = "+14.0 hrs";
  }

  const cleanTemp = shipment?.temp ? shipment.temp.split(' ')[0] : (isDelivered ? "3.0°C" : "3.0°C");

  let ambientText = shipment?.telemetry?.ambientTemp || "72°F • Clear";
  if (shipment?.id === "PO-2026-8842") {
    ambientText = shipment?.telemetry?.ambientTemp || "94°F • Extreme Heat";
  } else if (shipment?.id === "PO-2026-9912A") {
    ambientText = shipment?.telemetry?.ambientTemp || "42°F • Rain & Heavy Winds";
  }

  const isBlanketCtrl = shipment?.isBlanket || shipment?.id === 'PO-2026-BLANKET';
  const cargoName = shipment?.product || (shipment?.item ? shipment.item.split(' of ')[1] : '') || shipment?.item || "Pending Data sync";
  const containerIdStr = shipment?.telemetry?.containerId || "MSKU-784219-5";
  const beaconIdStr = "IoT-TH-9941";

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border transition-all duration-300 ease-out cursor-pointer relative overflow-hidden flex flex-col gap-3 hover:-translate-y-1.5 hover:shadow-md",
        active 
          ? "border-indigo-500 dark:border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/20 ring-1 ring-indigo-500 shadow-md" 
          : "border-[#E2E8F0] dark:border-slate-805 bg-[#F8FAFC] dark:bg-slate-900 text-slate-900 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900/80"
      )}
    >
      {/* BASE CONTAINER & INTEGRATED STATUS DOTS */}
      <div className="flex flex-col gap-1.5 font-sans">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
          {/* Unified title */}
          <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 tracking-tight leading-snug">
            {shipment?.id || "Pending Data sync"}: {cargoName}
          </h4>
        </div>

        {/* Purged Physical Asset Identifier, direct metrics text underneath */}
        <div className="font-mono text-[0.82rem] text-[#64748B] dark:text-slate-404 leading-snug font-medium select-none">
          Container: {containerIdStr} • Beacon: {beaconIdStr}
        </div>

        {/* Streamlined timeline block with status and eta */}
        <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-slate-100 mt-1 select-none">
          <span className={cn(
            isDelivered ? "text-emerald-600 dark:text-emerald-450" : (shipment?.status === 'delayed' || shipment?.hasAnomaly) ? "text-[#D97706]" : "text-slate-700 dark:text-slate-350"
          )}>
            {displayStatus}
          </span>
          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 ml-auto">
            <span>{isDelivered ? "Closed" : displayETA}</span>
            {delayBadge && !isDelivered && (
              <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[9.5px] font-bold border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 font-sans ml-1">
                {delayBadge}
              </span>
            )}
          </div>
        </div>

        {/* Sleek Dual Column Environmental Matrix */}
        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#F1F5F9] dark:border-slate-800/80 mt-1">
          {/* Left Column (Internal Cold-Chain) */}
          <div className="flex flex-col pointer-events-none select-none">
            <span className="text-[9.5px] uppercase font-bold text-slate-445 tracking-wider">Internal Temp</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cleanTemp}</span>
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1 rounded lowercase border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
                stable
              </span>
            </div>
          </div>
          {/* Right Column (Ambient External Environment) */}
          <div className="flex flex-col text-right font-sans select-none">
            <span className="text-[9.5px] uppercase font-bold text-slate-445 font-mono tracking-wider">Ambient Ext</span>
            <div className="text-[11px] text-slate-605 dark:text-slate-355 font-medium mt-0.5 whitespace-nowrap">
              {ambientText}
            </div>
          </div>
        </div>

        {isBlanketCtrl && (
          <div className="mt-2.5 p-2.5 bg-indigo-50 dark:bg-indigo-955/60 border border-indigo-150/40 dark:border-indigo-900/60 rounded-xl text-[10px] font-mono leading-relaxed font-bold text-indigo-750 dark:text-indigo-405">
            📋 {shipment?.id || "Pending Data sync"} • {shipment?.contractHorizon || '3-Month'} Avocado Contract • Progress: {shipment?.deliveredBatches || 1}/{shipment?.totalBatches || 12} Batches Delivered
          </div>
        )}
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error inside Logistics panel boundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl m-6 font-sans">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/20 text-rose-600 rounded-full mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase font-mono tracking-wider">
            Logistics Panel Recovery
          </h2>
          <p className="text-xs text-slate-500 max-w-md leading-relaxed mt-2 font-mono">
            A dynamic telemetry sync script error was safely intercepted from breaking the browser window.
          </p>
          <button
            onClick={() => (this as any).setState({ hasError: false, error: null })}
            className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase font-mono transition-all cursor-pointer"
          >
            Reset Matrix View
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function LogisticsWrapped(props: LogisticsProps) {
  return (
    <ErrorBoundary>
      <Logistics {...props} />
    </ErrorBoundary>
  );
}
