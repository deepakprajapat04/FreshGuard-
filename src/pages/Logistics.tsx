/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, Truck, AlertTriangle, ShieldAlert, CheckCircle2, Clock, Ship,
  Calendar as CalendarIcon, Map as MapIcon, ChevronLeft, ChevronRight,
  Thermometer, ArrowRight, RefreshCw, TrendingDown, Box, Loader2,
  LayoutDashboard, Bell, Link2, Container, Navigation, Activity,
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import {
  createPsaEvent, buildPeriodicBuyerAlerts, formatSyncAge,
  type BuyerShipmentAlert, type ContainerUpdatePayload,
} from '../lib/psa';
import { seedDefaultShipments, enrichWithPsaDefaults } from '../lib/shipmentSeeds';
import type { Shipment, AIAlert, LogisticsTab } from '../lib/shipmentTypes';
import { ShipmentDashboard } from '../components/logistics/ShipmentDashboard';
import { ContainerPsaPanel } from '../components/logistics/ContainerPsaPanel';
import { BuyerAlertsDrawer } from '../components/logistics/BuyerAlertsDrawer';

const TrackingMap = lazy(() =>
  import('../components/logistics/TrackingMap').then((m) => ({ default: m.TrackingMap }))
);

const STORAGE_KEY = 'freshguard-active-shipments';

export default function Logistics() {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('dashboard');
  const [viewMode, setViewMode] = useState<'map' | 'calendar' | 'timeline'>('map');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAlerts, setAiAlerts] = useState<Record<string, AIAlert>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [psaSyncPulse, setPsaSyncPulse] = useState(false);
  const [buyerAlerts, setBuyerAlerts] = useState<BuyerShipmentAlert[]>([]);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [savingContainer, setSavingContainer] = useState(false);
  const [containerForm, setContainerForm] = useState<ContainerUpdatePayload>({
    containerNumber: '', vesselName: '', voyageNumber: '', bookingNumber: '',
    psaTerminal: '', eta: '', temp: '', origin: '', notes: '',
  });

  const { persona } = usePersona();
  const isVendor = persona === 'vendor';

  const saveShipments = (list: Shipment[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const loadShipments = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: Shipment[] = stored ? JSON.parse(stored) : [];
      const defaults = seedDefaultShipments();
      const combined = [
        ...parsed.map((p) => {
          const seed = defaults.find((d) => d.id === p.id);
          if (!seed) return p;
          // Preserve runtime stage/status; backfill PSA container fields from seed when missing
          const needsPsaBackfill = !p.psaTerminal || !p.psaEvents?.length;
          return {
            ...seed,
            ...p,
            containerNumber: p.containerNumber || seed.containerNumber,
            vesselName: p.vesselName || seed.vesselName,
            voyageNumber: p.voyageNumber || seed.voyageNumber,
            bookingNumber: p.bookingNumber || seed.bookingNumber,
            psaTerminal: p.psaTerminal || seed.psaTerminal,
            psaSyncStatus: p.psaSyncStatus || seed.psaSyncStatus,
            psaLastSyncAt: p.psaLastSyncAt || seed.psaLastSyncAt,
            psaEvents: p.psaEvents?.length ? p.psaEvents : seed.psaEvents,
            currentLat: p.currentLat ?? seed.currentLat,
            currentLng: p.currentLng ?? seed.currentLng,
            originLat: needsPsaBackfill ? seed.originLat : (p.originLat ?? seed.originLat),
            originLng: needsPsaBackfill ? seed.originLng : (p.originLng ?? seed.originLng),
            destLat: p.destLat ?? seed.destLat,
            destLng: p.destLng ?? seed.destLng,
            transportMode: p.transportMode || seed.transportMode,
            origin: needsPsaBackfill ? seed.origin : p.origin,
            route: needsPsaBackfill ? seed.route : p.route,
            logisticsRouteAndProvider: needsPsaBackfill
              ? seed.logisticsRouteAndProvider
              : p.logisticsRouteAndProvider,
          };
        }),
        ...defaults.filter((d) => !parsed.some((p) => p.id === d.id)),
      ];
      const mapped = combined.map((s) => {
        let next = s;
        if (s.status === 'delivered') next = { ...s, stage: 'delivered' as const };
        else if (!s.stage) {
          next = {
            ...s,
            stage: 'packing' as const,
            packingProgress: s.packingProgress || 65,
            preCoolingTarget: s.preCoolingTarget || `Pre-Cooling Target: 3°C (Currently: ${s.temp || '3.2°C'})`,
          };
        }
        return enrichWithPsaDefaults(next);
      });
      setShipments(mapped);
      saveShipments(mapped);
      const active = mapped.filter((s) => s.stage === 'delivering');
      setSelectedShipmentId((prev) => {
        if (prev && mapped.some((s) => s.id === prev)) return prev;
        return active[0]?.id || mapped[0]?.id || '';
      });
    } catch {
      const defs = seedDefaultShipments();
      setShipments(defs);
      setSelectedShipmentId(defs[0].id);
    }
  };

  useEffect(() => {
    loadShipments();
    const onStorage = () => loadShipments();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    setActiveTab(persona === 'vendor' ? 'packing' : 'dashboard');
  }, [persona]);

  const selectedShipment = useMemo(
    () => shipments.find((s) => s.id === selectedShipmentId),
    [shipments, selectedShipmentId]
  );

  useEffect(() => {
    if (!selectedShipment) return;
    setContainerForm({
      containerNumber: selectedShipment.containerNumber || '',
      vesselName: selectedShipment.vesselName || '',
      voyageNumber: selectedShipment.voyageNumber || '',
      bookingNumber: selectedShipment.bookingNumber || '',
      psaTerminal: selectedShipment.psaTerminal || '',
      eta: selectedShipment.eta || '',
      temp: selectedShipment.temp || '',
      origin: selectedShipment.origin || '',
      notes: '',
      currentLat: selectedShipment.currentLat,
      currentLng: selectedShipment.currentLng,
    });
  }, [selectedShipmentId, selectedShipment?.id]);

  // PSA Portnet heartbeat
  useEffect(() => {
    const tick = () => {
      setPsaSyncPulse(true);
      setShipments((prev) => {
        const next = prev.map((s) =>
          s.psaSyncStatus === 'error'
            ? s
            : { ...s, psaSyncStatus: 'synced' as const, psaLastSyncAt: new Date().toISOString() }
        );
        saveShipments(next);
        return next;
      });
      setTimeout(() => setPsaSyncPulse(false), 900);
    };
    const id = window.setInterval(tick, 28000);
    return () => window.clearInterval(id);
  }, []);

  // Periodic buyer alerts
  useEffect(() => {
    if (isVendor) return;
    const push = () => {
      const active = shipments.filter((s) => s.stage === 'delivering' || s.status === 'delayed');
      const generated = active.map((s) => buildPeriodicBuyerAlerts(s)).filter(Boolean) as BuyerShipmentAlert[];
      if (!generated.length) return;
      setBuyerAlerts((prev) => {
        const seen = new Set<string>();
        return [...generated, ...prev].filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        }).slice(0, 24);
      });
    };
    push();
    const id = window.setInterval(push, 45000);
    return () => window.clearInterval(id);
  }, [isVendor, shipments]);

  const evaluateShipmentRoute = async (shipment: Shipment) => {
    if (!shipment || shipment.status === 'delivered') return;
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/evaluate-transit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: shipment.logisticsRouteAndProvider,
          product: shipment.product || shipment.item,
          route: shipment.route,
          fleetSpecification: shipment.fleetSpecification,
        }),
      });
      if (res.ok) {
        const data: AIAlert = await res.json();
        setAiAlerts((prev) => ({ ...prev, [shipment.id]: data }));
      } else throw new Error('fail');
    } catch {
      setAiAlerts((prev) => ({
        ...prev,
        [shipment.id]: {
          hasAnomaly: shipment.status === 'delayed',
          routeId: 'Route #402',
          threatVector: 'Severe Flash Flooding near Sector 4 Gateway • Threat Level: High',
          delayText: 'Expected transit delay: +14 hours. Predicted post-delivery shelf life reduced from 14 days to 11 days.',
          mitigationText: 'Reroute via Northern I-81 corridor immediately. Adds 45 miles but bypasses the flood zone, restoring climate control and saving 92% of perishable volume.',
          mitigationSummary: 'Bypasses high water risk areas.',
          alternativeRouteName: 'Northern I-81',
        },
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

  const handleApproveReroute = (shipmentId: string) => {
    setFeedbackMsg('Processing reroute request...');
    setTimeout(() => {
      const updated = shipments.map((s) => {
        if (s.id !== shipmentId) return s;
        return {
          ...s,
          status: 'on-time' as const,
          temp: '3.1°C [Stable]',
          eta: '6.5 hrs',
          logisticsRouteAndProvider: 'Northern I-81 Bypass Corridor',
          rerouted: true,
          hasAnomaly: false,
          currentLat: 38.2,
          currentLng: -81.5,
          psaSyncStatus: 'synced' as const,
          psaLastSyncAt: new Date().toISOString(),
          psaEvents: [
            ...(s.psaEvents || []),
            createPsaEvent('ETA_REVISED', 'Northern I-81 Bypass', {
              source: 'FreshGuard',
              details: 'Reroute approved — PSA Portnet notified',
              lat: 38.2,
              lng: -81.5,
            }),
          ],
        };
      });
      setShipments(updated);
      saveShipments(updated);
      if (aiAlerts[shipmentId]) {
        setAiAlerts((prev) => ({ ...prev, [shipmentId]: { ...prev[shipmentId], hasAnomaly: false } }));
      }
      setFeedbackMsg('Reroute confirmed. PSA Portnet synced — driver on I-81 N.');
      setTimeout(() => setFeedbackMsg(null), 5000);
    }, 1200);
  };

  const handleDispatch = (id: string, itemDesc: string) => {
    setDispatchingId(id);
    setTimeout(() => {
      const updated = shipments.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          stage: 'delivering' as const,
          packingProgress: 100,
          status: item.id === 'PO-2026-8842' ? ('delayed' as const) : ('on-time' as const),
          hasAnomaly: item.id === 'PO-2026-8842',
          temp: item.id === 'PO-2026-8842' ? '3.2°C' : '4°C',
          psaSyncStatus: 'synced' as const,
          psaLastSyncAt: new Date().toISOString(),
          psaEvents: [
            ...(item.psaEvents || []),
            createPsaEvent('GATE_OUT', item.psaTerminal || item.origin, {
              source: 'Supplier',
              details: 'Supplier finalized packing & pushed manifest to PSA Portnet',
              lat: item.originLat,
              lng: item.originLng,
            }),
          ],
        };
      });
      setShipments(updated);
      saveShipments(updated);
      setDispatchingId(null);
      setSelectedShipmentId(id);
      setSuccessToast(`Manifest synced to PSA Portnet®. Shipment ${id} (${itemDesc}) is live for retail tracking.`);
      setTimeout(() => setSuccessToast(null), 5500);
      setActiveTab('transit');
    }, 1000);
  };

  const handleSaveContainerDetails = () => {
    if (!selectedShipmentId) return;
    setSavingContainer(true);
    setTimeout(() => {
      const updated = shipments.map((s) => {
        if (s.id !== selectedShipmentId) return s;
        return {
          ...s,
          containerNumber: containerForm.containerNumber.trim() || s.containerNumber,
          vesselName: containerForm.vesselName.trim() || s.vesselName,
          voyageNumber: containerForm.voyageNumber.trim() || s.voyageNumber,
          bookingNumber: containerForm.bookingNumber.trim() || s.bookingNumber,
          psaTerminal: containerForm.psaTerminal.trim() || s.psaTerminal,
          eta: containerForm.eta.trim() || s.eta,
          temp: containerForm.temp.trim() || s.temp,
          origin: containerForm.origin.trim() || s.origin,
          psaSyncStatus: 'synced' as const,
          psaLastSyncAt: new Date().toISOString(),
          psaEvents: [
            ...(s.psaEvents || []),
            createPsaEvent('SUPPLIER_UPDATE', containerForm.psaTerminal || s.psaTerminal || 'PSA', {
              source: 'Supplier',
              details: containerForm.notes || 'Container shipment details updated by supplier',
              lat: containerForm.currentLat ?? s.currentLat,
              lng: containerForm.currentLng ?? s.currentLng,
            }),
          ],
        };
      });
      setShipments(updated);
      saveShipments(updated);
      setSavingContainer(false);
      setSuccessToast('Container details pushed to PSA Portnet®. Retail buyers will see the update on next sync.');
      setTimeout(() => setSuccessToast(null), 5000);
    }, 800);
  };

  const unreadAlerts = buyerAlerts.filter((a) => !a.read).length;

  const preDispatchShipments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return shipments.filter((s) => {
      const match = !q || s.id.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q)
        || s.item.toLowerCase().includes(q) || (s.containerNumber || '').toLowerCase().includes(q);
      return match && (s.stage === 'packing' || s.status === 'delivered');
    });
  }, [shipments, searchQuery]);

  const transitShipments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return shipments.filter((s) => {
      const match = !q || s.id.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q)
        || s.item.toLowerCase().includes(q) || (s.containerNumber || '').toLowerCase().includes(q);
      return match && (s.stage === 'delivering' || s.stage === 'delivered' || s.status === 'delivered');
    });
  }, [shipments, searchQuery]);

  const groupedTransit = useMemo(() => ({
    critical: transitShipments.filter((s) => (s.status === 'delayed' || s.hasAnomaly) && s.status !== 'delivered'),
    onTrack: transitShipments.filter((s) => !((s.status === 'delayed' || s.hasAnomaly) && s.status !== 'delivered')),
  }), [transitShipments]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const calendarDeliveries = useMemo(() => {
    const base = subDays(new Date(), 3);
    return transitShipments.map((s, idx) => ({
      id: s.id,
      date: s.date ? new Date(s.date) : addDays(base, idx % 5),
      items: s.item,
      type: s.transportMode === 'ocean' ? 'ship' : 'truck',
      issue: s.status,
      container: s.containerNumber,
    }));
  }, [transitShipments]);

  const tabs: Array<{ id: LogisticsTab; label: string; icon: typeof Truck; vendorOnly?: boolean }> = [
    { id: 'dashboard', label: 'Tracking Dashboard', icon: LayoutDashboard },
    { id: 'packing', label: 'Warehouse & Packing', icon: Box, vendorOnly: true },
    { id: 'containers', label: isVendor ? 'Update Containers' : 'PSA Containers', icon: Container },
    { id: 'transit', label: 'Live Tracking', icon: Truck },
  ];

  return (
    <div className="flex flex-col h-screen min-h-screen bg-[#dce6f0] dark:bg-slate-950 font-sans antialiased overflow-hidden">
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs sm:text-sm font-extrabold px-6 py-4 rounded-xl shadow-2xl border border-emerald-500/30 flex items-center gap-3 w-11/12 max-w-2xl"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div className="flex-1">{successToast}</div>
            <button onClick={() => setSuccessToast(null)} className="text-xs font-mono font-bold uppercase px-2 py-1 bg-white/10 rounded">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-[#0c1e36] text-white border-b border-sky-900/50 px-5 lg:px-6 py-4 space-y-4 shrink-0 shadow-lg z-30">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider text-sky-300 uppercase font-mono">
              FreshGuard × PSA Portnet®
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
              Logistics &amp; Shipment Tracking
            </h1>
            <p className="text-slate-400 text-xs mt-0.5 max-w-2xl">
              Container events sync bi-directionally with PSA Portnet. Suppliers update shipment details; retail buyers track every milestone in real time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10.5px] font-mono font-bold',
              psaSyncPulse
                ? 'bg-emerald-500 text-white border-emerald-400'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            )}>
              <Link2 className="w-3.5 h-3.5" />
              PSA Portnet® Fully Synced
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            </div>
            <span className="bg-white/10 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-white/15">
              Containers: {shipments.length}
            </span>
            {!isVendor && (
              <button onClick={() => setShowAlertsPanel((v) => !v)} className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10.5px] font-mono font-bold border border-sky-400/30">
                <Bell className="w-3.5 h-3.5" /> Buyer Alerts
                {unreadAlerts > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center">{unreadAlerts}</span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-[#132a45] p-2 rounded-xl border border-sky-900/60 w-full">
          <div className="flex bg-[#0a1829]/80 p-1 rounded-lg font-mono min-w-0 flex-1 overflow-x-auto">
            {tabs.filter((t) => !t.vendorOnly || isVendor).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex-1 min-w-[120px] py-2 px-3 rounded-md text-[10px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
                    activeTab === t.id
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO, container, vendor..."
            className="w-full md:w-72 bg-[#0a1829] border border-sky-900/80 text-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500"
          />
        </div>
      </header>

      <AnimatePresence>
        {!isVendor && showAlertsPanel && (
          <BuyerAlertsDrawer
            alerts={buyerAlerts}
            onClose={() => setShowAlertsPanel(false)}
            onDismiss={(id) => setBuyerAlerts((p) => p.filter((a) => a.id !== id))}
            onMarkRead={(id) => setBuyerAlerts((p) => p.map((a) => (a.id === id ? { ...a, read: true } : a)))}
            onOpenTracking={(id) => {
              setSelectedShipmentId(id);
              setActiveTab('transit');
              setShowAlertsPanel(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 w-full relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto px-4 lg:px-5 py-5">
              <ShipmentDashboard
                shipments={shipments}
                searchQuery={searchQuery}
                isVendor={isVendor}
                buyerAlerts={buyerAlerts}
                onTrack={(id) => { setSelectedShipmentId(id); setActiveTab('transit'); }}
                onOpenAlerts={() => setShowAlertsPanel(true)}
              />
            </motion.div>
          )}

          {activeTab === 'packing' && isVendor && (
            <motion.div key="pack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto px-4 lg:px-5 py-5">
              <div className="w-full space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0f2744] text-white border border-slate-700/60 rounded-xl p-5 shadow-lg gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-sky-300">Warehouse readiness</h3>
                    <p className="text-xs text-slate-400 mt-1">Finalize packing, then dispatch — manifests push to PSA Portnet for retail visibility.</p>
                  </div>
                  <span className="bg-amber-500/15 border border-amber-400/40 text-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-mono font-extrabold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" /> Staging: {preDispatchShipments.length}
                  </span>
                </div>
                {preDispatchShipments.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border rounded-2xl p-12 text-center border-slate-200 dark:border-slate-800 shadow-sm">
                    <Box className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h4 className="text-base font-bold font-mono uppercase mb-1">Queue clear</h4>
                    <p className="text-xs text-slate-500">All lots are packed and active in PSA-synced transit.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                    {preDispatchShipments.map((s) => (
                      <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0c1e36] via-sky-500 to-emerald-500" />
                        <div className="space-y-4">
                          <div>
                            <span className="font-mono text-xs font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest">{s.id}</span>
                            <h4 className="text-sm font-black mt-1">{s.item}</h4>
                            <div className="text-[10px] font-mono text-slate-500 mt-1">{s.containerNumber}</div>
                          </div>
                          <div className="text-xs text-slate-600 space-y-2">
                            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" />{s.origin}</div>
                            <div className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-emerald-500" />PSA: {s.psaTerminal}</div>
                          </div>
                          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className="text-slate-400 uppercase font-bold">Packing</span>
                              <span className="text-emerald-700 font-extrabold">{s.packingProgress || 65}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-500" style={{ width: `${s.packingProgress || 65}%` }} />
                            </div>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center gap-3">
                            <Thermometer className="w-4 h-4 text-emerald-500" />
                            <div className="text-[11px] font-mono"><strong>{s.preCoolingTarget}</strong></div>
                          </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                          {s.status === 'delivered' ? (
                            <div className="w-full text-center py-2 bg-slate-100 text-[10.5px] font-mono font-black text-slate-500 uppercase rounded-lg">Pipeline closed</div>
                          ) : (
                            <button
                              onClick={() => handleDispatch(s.id, s.item)}
                              disabled={dispatchingId !== null}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                            >
                              {dispatchingId === s.id ? (<><Loader2 className="w-4 h-4 animate-spin" /> Syncing to PSA…</>) : (<>Dispatch &amp; sync PSA <ArrowRight className="w-3.5 h-3.5" /></>)}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'containers' && (
            <motion.div key="ctr" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto px-4 lg:px-5 py-5">
              <ContainerPsaPanel
                shipments={shipments}
                searchQuery={searchQuery}
                selectedShipment={selectedShipment}
                selectedShipmentId={selectedShipmentId}
                isVendor={isVendor}
                containerForm={containerForm}
                savingContainer={savingContainer}
                onSelect={setSelectedShipmentId}
                onFormChange={setContainerForm}
                onSave={handleSaveContainerDetails}
              />
            </motion.div>
          )}

          {activeTab === 'transit' && (
            <motion.div key="transit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col lg:flex-row overflow-hidden">
              <div className="w-full lg:w-[32%] xl:w-[28%] bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col h-[38vh] lg:h-full shrink-0">
                <div className="p-4 bg-[#0c1e36] text-white flex justify-between text-[10.5px] font-mono">
                  <span className="font-bold text-sky-200">PSA-LINKED FLEET</span>
                  <span className="text-slate-400">Active: {transitShipments.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isVendor ? (
                    <>
                      <Section
                        title="Disruption warnings"
                        tone="rose"
                        empty="No corridor stress. PSA feeds normal."
                        items={groupedTransit.critical}
                        selectedId={selectedShipmentId}
                        onSelect={setSelectedShipmentId}
                      />
                      <Section
                        title="Operational"
                        tone="emerald"
                        empty="No active lots."
                        items={groupedTransit.onTrack}
                        selectedId={selectedShipmentId}
                        onSelect={setSelectedShipmentId}
                      />
                    </>
                  ) : (
                    <div className="space-y-3">
                      {transitShipments.map((s) => (
                        <div key={s.id}>
                          <BuyerShipmentListItem
                            shipment={s}
                            active={selectedShipmentId === s.id}
                            onClick={() => setSelectedShipmentId(s.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[10.5px] font-mono text-slate-500">
                  <span>ROLE: {isVendor ? 'Supplier' : 'Retail buyer'}</span>
                  <span className="flex items-center gap-1 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> PSA live</span>
                </div>
              </div>

              <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
                <div className="absolute top-4 right-4 z-20 flex bg-[#0c1e36] rounded-lg shadow-lg border border-sky-900/60 p-1">
                  {([['map', MapIcon, 'Map'], ['timeline', Activity, 'PSA Timeline'], ['calendar', CalendarIcon, 'Calendar']] as const).map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-[10px] font-bold font-mono uppercase flex items-center gap-1.5',
                        viewMode === mode ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {feedbackMsg && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute top-4 left-4 right-72 z-50 bg-emerald-600 text-white text-xs font-extrabold px-4 py-3 rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {feedbackMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                {viewMode === 'map' && (
                  <div className="absolute inset-0 flex flex-col pt-16 overflow-hidden">
                    {isVendor && selectedShipment && selectedShipment.status !== 'delivered' && aiAlerts[selectedShipment.id]?.hasAnomaly && (
                      <div className="px-4 lg:px-5 pb-2 shrink-0 z-10 w-full">
                        <div className="bg-red-50/95 dark:bg-rose-950/20 border-l-4 border-rose-500 rounded-xl p-5 border border-rose-200/50 space-y-3">
                          <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                            <div>
                              <h4 className="text-sm font-black text-rose-900 uppercase font-mono">AI Disruption · {aiAlerts[selectedShipment.id].routeId}</h4>
                              <p className="text-xs text-rose-700 mt-1 font-mono">{aiAlerts[selectedShipment.id].threatVector}</p>
                              <p className="text-xs mt-2 flex items-center gap-2 bg-white/70 p-3 rounded-lg"><TrendingDown className="w-4 h-4" />{aiAlerts[selectedShipment.id].delayText}</p>
                            </div>
                            {isEvaluating && <div className="flex items-center gap-2 text-xs font-mono"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recalculating…</div>}
                          </div>
                          <div className="border-t border-rose-200 pt-3 flex justify-between gap-3">
                            <p className="text-xs text-rose-800 flex-1"><strong>{aiAlerts[selectedShipment.id].mitigationText}</strong></p>
                            <button onClick={() => handleApproveReroute(selectedShipment.id)} className="px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase font-mono shrink-0">
                              Approve reroute &amp; sync PSA
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {!isVendor && selectedShipment && (
                      <div className="px-4 lg:px-5 pb-2 shrink-0 w-full">
                        <div className="bg-[#0f2744] border border-sky-900/50 rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2 text-xs text-white">
                          <div className="flex items-center gap-2 font-mono font-bold text-sky-200">
                            <Link2 className="w-4 h-4" /> Tracking {selectedShipment.containerNumber} via PSA Portnet®
                          </div>
                          <span className="text-[10px] font-mono text-emerald-300">Sync {formatSyncAge(selectedShipment.psaLastSyncAt)} · {selectedShipment.psaEvents?.length || 0} events</span>
                        </div>
                      </div>
                    )}
                    <div className="flex-1 px-4 lg:px-5 pb-4 min-h-0 flex flex-col gap-3 w-full">
                      <div className="flex-1 min-h-[280px]">
                        <Suspense fallback={<div className="h-full min-h-[320px] rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading PSA map…</div>}>
                          <TrackingMap shipment={selectedShipment} />
                        </Suspense>
                      </div>
                      {selectedShipment && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 font-mono shrink-0">
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Live logistics feed · PSA mirrored</div>
                          <div className="text-sm font-bold mt-0.5">{selectedShipment.vendor} — {selectedShipment.item}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {selectedShipment.containerNumber} · {selectedShipment.vesselName} · <span className="text-emerald-400">{selectedShipment.psaSyncStatus?.toUpperCase()}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="flex items-center gap-1.5 border border-slate-700 px-3 py-1 rounded-md text-[9.5px] font-black uppercase"><Clock className="w-3.5 h-3.5" />{selectedShipment.status === 'delivered' ? 'Landed @ DC' : `ETA ${selectedShipment.eta}`}</span>
                            <span className="flex items-center gap-1.5 border border-emerald-900/60 bg-emerald-950/40 text-emerald-400 px-3 py-1 rounded-md text-[9.5px] font-black uppercase"><Thermometer className="w-3.5 h-3.5" />{selectedShipment.temp}</span>
                            <span className="flex items-center gap-1.5 border border-sky-900/60 bg-sky-950/40 text-sky-300 px-3 py-1 rounded-md text-[9.5px] font-black uppercase"><Navigation className="w-3.5 h-3.5" />{selectedShipment.fleetSpecification}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === 'timeline' && (
                  <div className="absolute inset-0 overflow-y-auto p-4 lg:p-5 pt-20">
                    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                      <div className="px-6 py-4 bg-[#0c1e36] text-white">
                        <h2 className="text-lg font-black font-mono uppercase tracking-wider">PSA Portnet event stream</h2>
                        <p className="text-xs text-slate-400 mt-1">{selectedShipment ? `${selectedShipment.containerNumber} · completely synced with PSA` : 'Select a shipment'}</p>
                      </div>
                      <div className="p-6">
                      {selectedShipment?.psaEvents?.length ? (
                        <div className="space-y-4 pl-4 border-l-2 border-sky-300 dark:border-sky-800">
                          {[...selectedShipment.psaEvents].reverse().map((ev) => (
                            <div key={ev.id} className="relative">
                              <span className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-sky-500 border-2 border-white dark:border-slate-900" />
                              <div className="font-bold text-sm">{ev.label}</div>
                              <div className="text-xs text-slate-500">{ev.location} · {ev.source}</div>
                              {ev.details && <div className="text-xs text-slate-600 mt-1">{ev.details}</div>}
                              <div className="text-[10px] font-mono text-slate-400 mt-1">{format(new Date(ev.timestamp), 'PPpp')}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-mono py-8 text-center">No PSA events yet.</div>
                      )}
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'calendar' && (
                  <div className="absolute inset-0 overflow-auto p-4 lg:p-5 pt-20">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden w-full">
                      <div className="px-6 py-4 bg-[#0c1e36] text-white flex justify-between items-center">
                        <div>
                          <span className="text-[10px] font-bold tracking-wider text-sky-300 uppercase font-mono">PSA delivery calendar</span>
                          <h2 className="text-xl font-bold">Delivery schedule</h2>
                        </div>
                        <div className="flex gap-2 font-mono">
                          <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-2 border rounded-md border-white/20 hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
                          <span className="flex items-center px-4 font-bold text-xs bg-white/10 border rounded-md border-white/15">
                            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                          </span>
                          <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 border rounded-md border-white/20 hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                        {weekDays.map((day, idx) => {
                          const dayDels = calendarDeliveries.filter((d) => isSameDay(d.date, day));
                          const isToday = isSameDay(day, new Date());
                          return (
                            <div key={idx} className={cn('h-[380px] flex flex-col border rounded-xl overflow-hidden', isToday ? 'border-sky-400 ring-1 ring-sky-400' : 'border-slate-200 dark:border-slate-800')}>
                              <div className={cn('px-3 py-2 border-b text-xs text-center', isToday ? 'bg-sky-50 text-sky-800 font-extrabold' : 'bg-slate-50 dark:bg-slate-900')}>
                                {format(day, 'EEE')}<br /><span className="text-lg font-semibold">{format(day, 'd')}</span>
                              </div>
                              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                                {dayDels.map((del, i) => (
                                  <div key={i} className={cn('p-2.5 rounded-lg border text-xs', del.issue === 'delayed' ? 'border-rose-200 text-rose-700' : 'border-slate-200 dark:border-slate-800')}>
                                    <div className="font-bold flex justify-between font-mono text-[10px]">
                                      <span>{del.id}</span>
                                      {del.type === 'ship' ? <Ship className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                    </div>
                                    <div className="text-slate-500 mt-1 line-clamp-2">{del.items}</div>
                                    <div className="text-[9px] font-mono text-slate-400 mt-1">{del.container}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  empty,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  tone: 'rose' | 'emerald';
  empty: string;
  items: Shipment[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 px-1">
        <span className={cn('w-2 h-2 rounded-full', tone === 'rose' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500')} />
        <h3 className={cn('text-[10px] font-extrabold uppercase tracking-widest font-mono', tone === 'rose' ? 'text-rose-600' : 'text-slate-500')}>{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-4 text-xs font-mono text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">{empty}</div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id}>
              <ShipmentListItem
                shipment={s}
                active={selectedId === s.id}
                onClick={() => onSelect(s.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShipmentListItem({
  shipment,
  active,
  onClick,
}: {
  shipment: Shipment;
  active: boolean;
  onClick: () => void;
}) {
  const isDelayed = shipment.status === 'delayed' || shipment.hasAnomaly;
  const isDelivered = shipment.status === 'delivered';
  return (
    <div onClick={onClick} className={cn(
      'p-4 rounded-xl border cursor-pointer flex flex-col gap-2.5',
      active ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50/40' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
      isDelayed && !active && !isDelivered && 'border-rose-200'
    )}>
      <div className="flex justify-between gap-2">
        <div>
          <h4 className="font-mono text-[11px] font-black">{shipment.id} · <span className="font-sans font-bold">{shipment.item}</span></h4>
          <span className="text-[10px] text-slate-500 font-mono">{shipment.containerNumber}</span>
        </div>
        {isDelivered ? (
          <span className="bg-emerald-600 text-white font-mono text-[8.5px] font-black uppercase px-2 py-0.5 rounded">Delivered</span>
        ) : isDelayed ? (
          <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[8.5px] font-black uppercase text-rose-600 font-mono flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alert</span>
        ) : (
          <span className="bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[8.5px] font-black uppercase text-emerald-600 font-mono">On track</span>
        )}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between text-[11px] text-slate-500">
        <span className="truncate">From: <strong className="text-slate-700 dark:text-slate-300">{shipment.origin}</strong></span>
        <ArrowRight className="w-3.5 h-3.5 mx-1 shrink-0" />
        <span className="truncate text-right">To: <strong className="text-slate-700 dark:text-slate-300">{shipment.destination}</strong></span>
      </div>
      <div className="flex justify-between text-[11px] font-mono">
        <span className="flex items-center gap-1"><Thermometer className={cn('w-3.5 h-3.5', isDelayed ? 'text-rose-500' : 'text-emerald-500')} />{isDelivered ? 'Received @ DC' : shipment.temp}</span>
        <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5 text-emerald-500" />ETA: {isDelivered ? 'Closed' : shipment.eta}</span>
      </div>
    </div>
  );
}

function BuyerShipmentListItem({ shipment, active, onClick }: { shipment: Shipment; active: boolean; onClick: () => void }) {
  const isDelivered = shipment.status === 'delivered';
  let status = 'In transit · PSA synced';
  if (isDelivered) status = 'Delivered';
  else if (shipment.rerouted) status = 'Approaching DC';
  else if (shipment.status === 'delayed') status = 'Delayed · PSA update';
  let eta = shipment.eta;
  if (shipment.id === 'PO-2026-8842') eta = 'Oct 19, 08:30 AM';
  else if (shipment.id === 'PO-2026-9912A') eta = 'Oct 20, 11:15 AM';
  else if (shipment.id === 'PO-2026-7731C') eta = 'Oct 22, 02:45 PM';

  return (
    <div onClick={onClick} className={cn(
      'p-4 rounded-xl border cursor-pointer flex flex-col gap-2',
      active ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50/40' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
    )}>
      <h4 className="text-xs font-black font-mono">{shipment.id}: <span className="font-sans font-extrabold text-emerald-700 dark:text-emerald-400">{shipment.product || shipment.item}</span></h4>
      <div className="text-[10px] font-mono text-slate-500">{shipment.containerNumber} · {shipment.vesselName}</div>
      <div className="text-[11px] mt-1">
        <div className="font-semibold text-slate-600">Status: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{status}</span></div>
        <div className="text-slate-500 font-mono mt-0.5">Expected: <span className="text-slate-700 dark:text-slate-300 font-bold">{isDelivered ? 'Closed' : eta}</span></div>
      </div>
    </div>
  );
}
