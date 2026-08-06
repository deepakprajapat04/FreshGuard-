/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useNavigate } from 'react-router';
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, Truck, AlertTriangle, ShieldAlert, CheckCircle2, Clock, Ship,
  Calendar as CalendarIcon, Map as MapIcon, Filter, X,
  Thermometer, ArrowRight, RefreshCw, TrendingDown, Box, Loader2,
  LayoutDashboard, Link2, Container, Navigation, Activity, ShoppingCart,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  createPsaEvent, buildPeriodicBuyerAlerts, formatSyncAge, getTransportModeMismatch,
  type BuyerShipmentAlert, type ContainerUpdatePayload,
} from '../lib/psa';
import { seedDefaultShipments, enrichWithPsaDefaults } from '../lib/shipmentSeeds';
import type { Shipment, AIAlert, LogisticsTab } from '../lib/shipmentTypes';
import { getShipmentCargoLines } from '../lib/shipmentTypes';
import { evaluateDelayAlertLevel, estimateShelfShortage, loadBusinessRules } from '../lib/businessRules';
import { ShipmentDashboard } from '../components/logistics/ShipmentDashboard';
import { ContainerPsaPanel } from '../components/logistics/ContainerPsaPanel';
import { BuyerAlertsDrawer } from '../components/logistics/BuyerAlertsDrawer';
import { ShipmentCalendar } from '../components/logistics/ShipmentCalendar';
import { PsaTimelinePanel } from '../components/logistics/PsaEventTimeline';

const TrackingMap = lazy(() =>
  import('../components/logistics/TrackingMap').then((m) => ({ default: m.TrackingMap }))
);

const STORAGE_KEY = 'freshguard-active-shipments-v5';

function getShipmentModeMismatch(shipment: Shipment) {
  return getTransportModeMismatch({
    transportMode: shipment.transportMode,
    psaEvents: shipment.psaEvents,
    incoterms: shipment.incoterms,
  });
}

function isShipmentModeMismatch(shipment: Shipment) {
  if (shipment.status === 'delivered') return false;
  return getShipmentModeMismatch(shipment).isMismatch;
}

function isShipmentCritical(shipment: Shipment) {
  return (
    shipment.status === 'delayed' ||
    !!shipment.hasAnomaly ||
    isShipmentModeMismatch(shipment)
  );
}

export default function Logistics() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LogisticsTab>('dashboard');
  const [viewMode, setViewMode] = useState<'map' | 'calendar' | 'timeline'>('map');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAlerts, setAiAlerts] = useState<Record<string, AIAlert>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [confirmQtyById, setConfirmQtyById] = useState<Record<string, string>>({});
  const [shipNotesById, setShipNotesById] = useState<Record<string, string>>({});
  const [shipContainerById, setShipContainerById] = useState<Record<string, string>>({});
  const [shipEtaById, setShipEtaById] = useState<Record<string, string>>({});
  const [psaSyncPulse, setPsaSyncPulse] = useState(false);
  const [buyerAlerts, setBuyerAlerts] = useState<BuyerShipmentAlert[]>([]);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [savingContainer, setSavingContainer] = useState(false);
  const [transitStatusFilter, setTransitStatusFilter] = useState<'all' | 'on-time' | 'delayed' | 'mismatched' | 'delivered'>('delayed');
  const [transitModeFilter, setTransitModeFilter] = useState<'all' | 'ocean' | 'air' | 'road'>('all');
  const [transitSupplierFilter, setTransitSupplierFilter] = useState('all');
  const [transitFiltersOpen, setTransitFiltersOpen] = useState(true);
  /** Keep buyer alert compact so the map stays visible */
  const [alertDetailsOpen, setAlertDetailsOpen] = useState(false);
  const [containerForm, setContainerForm] = useState<ContainerUpdatePayload>({
    containerNumber: '', vesselName: '', voyageNumber: '', bookingNumber: '',
    psaTerminal: '', eta: '', temp: '', origin: '', notes: '',
  });

  const { persona } = usePersona();
  const isVendor = persona === 'vendor';
  const { upsertMany } = useNotifications();

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
            incoterms: p.incoterms || seed.incoterms,
            shippingMethod: p.shippingMethod || seed.shippingMethod,
            etaDate: p.etaDate || seed.etaDate,
            cargoLines: p.cargoLines?.length ? p.cargoLines : seed.cargoLines,
            storeOnHandCases: p.storeOnHandCases ?? seed.storeOnHandCases,
            dailyDemandCases: p.dailyDemandCases ?? seed.dailyDemandCases,
            shelfLifeDays: p.shelfLifeDays ?? seed.shelfLifeDays,
            shelfLifeDaysAtRisk: p.shelfLifeDaysAtRisk ?? seed.shelfLifeDaysAtRisk,
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
      setSelectedShipmentId((prev) => {
        if (prev && mapped.some((s) => s.id === prev)) return prev;
        const delayed = mapped.find((s) => s.id === 'PO-2026-DELAY1');
        const expected = mapped.find((s) => s.id === 'PO-2026-EXPECT1');
        const active = mapped.filter((s) => s.stage === 'delivering');
        return delayed?.id || expected?.id || active[0]?.id || mapped[0]?.id || '';
      });
    } catch {
      const defs = seedDefaultShipments();
      setShipments(defs);
      setSelectedShipmentId(
        defs.find((s) => s.id === 'PO-2026-DELAY1')?.id || defs[0].id
      );
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
      upsertMany(
        generated.map((a) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          severity: a.severity,
          category: a.category,
          timestamp: a.timestamp,
          read: a.read,
          module: 'Logistics' as const,
          href: '/logistics',
        }))
      );
    };
    push();
    const id = window.setInterval(push, 45000);
    return () => window.clearInterval(id);
  }, [isVendor, shipments, upsertMany]);

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
      const rules = loadBusinessRules();
      const delayedDays = shipment.status === 'delayed' ? Math.max(rules.urgentDelayDays + 1, 2) : 0;
      const expectedDays = shipment.expectedDelay
        ? Math.max(rules.warningExpectedDelayDays + 1, 1)
        : delayedDays;
      const level = evaluateDelayAlertLevel(rules, {
        delayedDays,
        expectedDelayDays: expectedDays,
      });
      const delayForStock = Math.max(delayedDays, expectedDays, 1);
      const stock = estimateShelfShortage({
        storeOnHandCases: shipment.storeOnHandCases ?? 120,
        dailyDemandCases: shipment.dailyDemandCases ?? 80,
        delayDays: delayForStock,
        inboundCases: shipment.quantity,
        minDaysOfCoverThreshold: rules.minDaysOfCoverThreshold,
      });
      setAiAlerts((prev) => ({
        ...prev,
        [shipment.id]: {
          hasAnomaly: shipment.status === 'delayed' || !!shipment.expectedDelay || !!shipment.hasAnomaly,
          routeId: shipment.logisticsRouteAndProvider || 'Route #402',
          threatVector:
            level === 'urgent' || shipment.status === 'delayed'
              ? `Urgent (rule: delayed > ${rules.urgentDelayDays}d) · Flash flood / corridor disruption`
              : `Warning (rule: expected delay > ${rules.warningExpectedDelayDays}d) · Berth / corridor forecast`,
          delayText:
            shipment.status === 'delayed'
              ? `Actual delay ~${delayedDays} days. Predicted post-delivery shelf life reduced from 14 days to 9 days.`
              : `Expected delay ahead ~${expectedDays} day(s). Shelf availability may compress on inland leg.`,
          mitigationText:
            'Monitor PSA Portnet updates. Buyer may source alternative supplier volume if shelf window tightens further.',
          mitigationSummary: 'Alert-only — no supplier reroute approval required.',
          alternativeRouteName: 'Northern I-81 (advisory)',
          shelfImpact:
            shipment.status === 'delayed'
              ? 'Store shelf availability at risk: usable window drops from 14 → 9 days after DC receipt. Recommend alternate supplier RFQ for fill-in volume.'
              : 'Potential shelf compression: usable window may drop from 12 → 8 days if berth wait materializes.',
          shelfLifeBefore: shipment.shelfLifeDays || 14,
          shelfLifeAfter: shipment.shelfLifeDaysAtRisk || (shipment.status === 'delayed' ? 9 : 8),
          willShortage: stock.willShortage,
          storeOnHandCases: stock.storeOnHandCases,
          dailyDemandCases: stock.dailyDemandCases,
          daysOfCover: stock.daysOfCover,
          stockoutInDays: stock.stockoutInDays,
          shortageCases: stock.shortageCases,
          shortageImpact: stock.willShortage
            ? `Shelf shortage likely: ${stock.storeOnHandCases} cases on hand (~${stock.daysOfCover}d cover at ${stock.dailyDemandCases}/day). With ${delayForStock}d delay, stockout in ~${stock.stockoutInDays}d and projected gap of ${stock.shortageCases} cases while inbound ${shipment.quantity.toLocaleString()} cases stay unavailable.`
            : `On-hand cover (~${stock.daysOfCover}d) covers the ${delayForStock}d delay window — no immediate shelf shortage projected.`,
          suggestedAction: stock.willShortage
            ? 'Stock-not-available risk triggers BRM auto-proposal. Review Inbox to approve 2nd-best supplier fill-in, or open Procurement.'
            : 'Open Inbox → approve auto-proposal if configured, or ask alternative suppliers in Procurement.',
        },
      }));
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    if (
      selectedShipment &&
      !aiAlerts[selectedShipment.id] &&
      selectedShipment.stage === 'delivering' &&
      (selectedShipment.status === 'delayed' ||
        selectedShipment.hasAnomaly ||
        selectedShipment.expectedDelay)
    ) {
      evaluateShipmentRoute(selectedShipment);
    }
  }, [selectedShipmentId, selectedShipment]);

  const activeDisruption =
    selectedShipment &&
    selectedShipment.status !== 'delivered' &&
    (aiAlerts[selectedShipment.id]?.hasAnomaly ||
      selectedShipment.status === 'delayed' ||
      selectedShipment.hasAnomaly ||
      selectedShipment.expectedDelay ||
      isShipmentModeMismatch(selectedShipment))
      ? (() => {
          const existing = aiAlerts[selectedShipment.id];
          if (existing) return existing;
          const rules = loadBusinessRules();
          const mismatch = getShipmentModeMismatch(selectedShipment);
          const isMismatchOnly =
            mismatch.isMismatch &&
            selectedShipment.status !== 'delayed' &&
            !selectedShipment.hasAnomaly &&
            !selectedShipment.expectedDelay;

          if (isMismatchOnly) {
            const expectedLabel =
              mismatch.expected === 'water' ? 'Sea' : mismatch.expected === 'land' ? 'Road' : mismatch.expected;
            const actualLabel =
              mismatch.actual === 'water' ? 'Sea' : mismatch.actual === 'land' ? 'Road' : mismatch.actual;
            return {
              hasAnomaly: true,
              kind: 'mismatch' as const,
              routeId: mismatch.incotermCode
                ? `Incoterms ${mismatch.incotermCode}`
                : 'Transport mode check',
              threatVector: mismatch.summary,
              delayText: `${expectedLabel} expected · ${actualLabel} showing on PSA. Confirm the active leg with the carrier.`,
              mitigationText: 'Validate Incoterms vs live transit mode before the next handoff.',
              mitigationSummary: 'Mode mismatch',
              alternativeRouteName: '—',
              shelfImpact: 'Mode mismatch can add dwell time and cut usable shelf life if the wrong corridor is followed.',
              shelfLifeBefore: selectedShipment.shelfLifeDays || 14,
              shelfLifeAfter: selectedShipment.shelfLifeDaysAtRisk || 10,
              willShortage: false,
              storeOnHandCases: selectedShipment.storeOnHandCases ?? 120,
              dailyDemandCases: selectedShipment.dailyDemandCases ?? 80,
              daysOfCover: Math.round(((selectedShipment.storeOnHandCases ?? 120) / Math.max(1, selectedShipment.dailyDemandCases ?? 80)) * 10) / 10,
              stockoutInDays: Math.floor((selectedShipment.storeOnHandCases ?? 120) / Math.max(1, selectedShipment.dailyDemandCases ?? 80)),
              shortageCases: 0,
              shortageImpact: 'No shelf shortage projected from mode mismatch alone — still confirm corridor with carrier.',
              suggestedAction: 'Open Live Tracking actions and ask carrier to confirm sea vs road leg against Incoterms.',
            };
          }

          const delayDays =
            selectedShipment.status === 'delayed'
              ? Math.max(rules.urgentDelayDays + 1, 2)
              : Math.max(rules.warningExpectedDelayDays + 1, 1);
          const stock = estimateShelfShortage({
            storeOnHandCases: selectedShipment.storeOnHandCases ?? 120,
            dailyDemandCases: selectedShipment.dailyDemandCases ?? 80,
            delayDays,
            inboundCases: selectedShipment.quantity,
            minDaysOfCoverThreshold: rules.minDaysOfCoverThreshold,
          });
          return {
            hasAnomaly: true,
            kind: 'delay' as const,
            routeId: selectedShipment.logisticsRouteAndProvider || 'Transit corridor',
            threatVector:
              selectedShipment.status === 'delayed' ? 'Active delay on corridor' : 'Expected delay ahead',
            delayText: selectedShipment.eta,
            mitigationText: 'Alert only — monitor PSA Portnet. No supplier reroute approval required.',
            mitigationSummary: 'Informational',
            alternativeRouteName: '—',
            shelfImpact: `Shelf life at risk: ${selectedShipment.shelfLifeDays || 14} → ${selectedShipment.shelfLifeDaysAtRisk || 9} days usable after receipt.`,
            shelfLifeBefore: selectedShipment.shelfLifeDays || 14,
            shelfLifeAfter: selectedShipment.shelfLifeDaysAtRisk || 9,
            willShortage: stock.willShortage,
            storeOnHandCases: stock.storeOnHandCases,
            dailyDemandCases: stock.dailyDemandCases,
            daysOfCover: stock.daysOfCover,
            stockoutInDays: stock.stockoutInDays,
            shortageCases: stock.shortageCases,
            shortageImpact: stock.willShortage
              ? `Shelf shortage likely: ${stock.shortageCases} cases gap; stockout in ~${stock.stockoutInDays}d.`
              : `No immediate shelf shortage projected (${stock.daysOfCover}d cover).`,
            suggestedAction: stock.willShortage
              ? 'Request alternative supplier volume in Inbox / Procurement.'
              : 'Monitor PSA; open Inbox if auto-proposal is raised.',
          };
        })()
      : null;

  const handleConfirmAndDispatch = (s: Shipment) => {
    const qtyRaw = confirmQtyById[s.id];
    const confirmedQty = qtyRaw ? Number(qtyRaw) : s.quantity;
    if (!confirmedQty || confirmedQty <= 0) {
      setSuccessToast('Enter a confirmed quantity before dispatch.');
      setTimeout(() => setSuccessToast(null), 3000);
      return;
    }
    const container = (shipContainerById[s.id] || s.containerNumber || '').trim();
    const notes = (shipNotesById[s.id] || '').trim();
    const eta = (shipEtaById[s.id] || s.eta || '').trim();
    setDispatchingId(s.id);
    setTimeout(() => {
      const updated = shipments.map((item) => {
        if (item.id !== s.id) return item;
        return {
          ...item,
          quantity: confirmedQty,
          item: `${confirmedQty.toLocaleString()} ${item.unit} of ${item.product || item.item}`,
          containerNumber: container || item.containerNumber,
          eta: eta || item.eta,
          stage: 'delivering' as const,
          packingProgress: 100,
          status: 'on-time' as const,
          psaSyncStatus: 'synced' as const,
          psaLastSyncAt: new Date().toISOString(),
          psaEvents: [
            ...(item.psaEvents || []),
            createPsaEvent('SUPPLIER_UPDATE', item.psaTerminal || item.origin, {
              source: 'Supplier',
              details: `Qty confirmed ${confirmedQty} ${item.unit}${notes ? ` · ${notes}` : ''} · container ${container || item.containerNumber}`,
              lat: item.originLat,
              lng: item.originLng,
            }),
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
      setSelectedShipmentId(s.id);
      setSuccessToast(`PO ${s.id}: qty ${confirmedQty} confirmed · shipment details synced to PSA.`);
      setTimeout(() => setSuccessToast(null), 5000);
      setActiveTab('transit');
    }, 900);
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

  const transitSuppliers = useMemo(() => {
    const set = new Set(transitShipments.map((s) => s.vendor).filter(Boolean));
    return Array.from(set).sort((a: string, b: string) => a.localeCompare(b));
  }, [transitShipments]);

  const filteredTransitShipments = useMemo(() => {
    return transitShipments.filter((s) => {
      if (transitStatusFilter === 'delayed') {
        if (!(s.status === 'delayed' || s.hasAnomaly)) return false;
      } else if (transitStatusFilter === 'mismatched') {
        if (!isShipmentModeMismatch(s)) return false;
      } else if (transitStatusFilter === 'on-time') {
        if (s.status !== 'on-time' || isShipmentModeMismatch(s)) return false;
      } else if (transitStatusFilter !== 'all' && s.status !== transitStatusFilter) {
        return false;
      }
      if (transitModeFilter !== 'all' && (s.transportMode || 'road') !== transitModeFilter) return false;
      if (transitSupplierFilter !== 'all' && s.vendor !== transitSupplierFilter) return false;
      return true;
    });
  }, [transitShipments, transitStatusFilter, transitModeFilter, transitSupplierFilter]);

  const transitFilterCount =
    (transitStatusFilter !== 'all' ? 1 : 0) +
    (transitModeFilter !== 'all' ? 1 : 0) +
    (transitSupplierFilter !== 'all' ? 1 : 0);

  const groupedTransit = useMemo(() => ({
    critical: filteredTransitShipments.filter((s) => isShipmentCritical(s) && s.status !== 'delivered'),
    onTrack: filteredTransitShipments.filter((s) => !(isShipmentCritical(s) && s.status !== 'delivered')),
  }), [filteredTransitShipments]);

  // Keep selection inside the filtered Live Tracking list only —
  // do not override PSA Containers / Dashboard selections (those show all lots).
  useEffect(() => {
    if (activeTab !== 'transit') return;
    if (!filteredTransitShipments.length) return;
    if (!filteredTransitShipments.some((s) => s.id === selectedShipmentId)) {
      setSelectedShipmentId(filteredTransitShipments[0].id);
    }
  }, [activeTab, filteredTransitShipments, selectedShipmentId]);

  const tabs: Array<{ id: LogisticsTab; label: string; icon: typeof Truck; vendorOnly?: boolean }> = [
    { id: 'dashboard', label: 'Tracking Dashboard', icon: LayoutDashboard },
    { id: 'packing', label: 'Warehouse & Packing', icon: Box, vendorOnly: true },
    { id: 'containers', label: isVendor ? 'Update Containers' : 'PSA Containers', icon: Container },
    { id: 'transit', label: 'Live Tracking', icon: Truck },
  ];

  return (
    <div className="flex flex-col h-screen min-h-screen bg-[#F0F3F8] dark:bg-slate-950 font-sans antialiased overflow-hidden">
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

      <header className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-5 py-2.5 shrink-0 shadow-lg z-30">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 w-full">
          <div className="min-w-0 flex items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Logistics &amp; Shipment Tracking
                </h1>
                <span className="text-[10px] font-semibold tracking-wide text-sky-600 dark:text-sky-300 uppercase">
                  FreshGuard × PSA Portnet®
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 truncate max-w-xl hidden sm:block">
                Bi-directional container sync · sea &amp; land lots
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold',
              psaSyncPulse
                ? 'bg-emerald-500 text-white border-emerald-400'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40'
            )}>
              <Link2 className="w-3.5 h-3.5" />
              PSA Synced
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            </div>
            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/15">
              {shipments.length} lots
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full mt-2">
          <div className="flex bg-white dark:bg-slate-900/80 p-0.5 rounded-lg min-w-0 flex-1 overflow-x-auto border border-slate-200/80 dark:border-slate-700">
            {tabs.filter((t) => !t.vendorOnly || isVendor).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex-1 min-w-[100px] py-1.5 px-2.5 rounded-md text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all',
                    activeTab === t.id
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
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
            className="w-full md:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-400"
          />
        </div>
      </header>

      <BuyerAlertsDrawer
        open={!isVendor && showAlertsPanel}
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

      <div className="flex-1 w-full relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto px-4 lg:px-5 py-5">
              <ShipmentDashboard
                shipments={shipments}
                searchQuery={searchQuery}
                isVendor={isVendor}
                buyerAlerts={buyerAlerts}
                selectedShipmentId={selectedShipmentId}
                onSelectShipment={setSelectedShipmentId}
                onTrack={(id) => { setSelectedShipmentId(id); setActiveTab('transit'); }}
                onOpenAlerts={() => setShowAlertsPanel(true)}
                onDismissAlert={(id) => setBuyerAlerts((p) => p.filter((a) => a.id !== id))}
                onMarkAlertRead={(id) => setBuyerAlerts((p) => p.map((a) => (a.id === id ? { ...a, read: true } : a)))}
              />
            </motion.div>
          )}

          {activeTab === 'packing' && isVendor && (
            <motion.div key="pack" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto px-4 lg:px-5 py-5">
              <div className="w-full space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-sky-600 dark:text-sky-300">Warehouse readiness</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Finalize packing, then dispatch — manifests push to PSA Portnet for retail visibility.</p>
                  </div>
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-400/40 dark:text-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-mono font-extrabold flex items-center gap-2">
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
                      <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-600 via-sky-400 to-emerald-500" />
                        <div className="space-y-3">
                          <div>
                            <span className="font-mono text-xs font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest">{s.id}</span>
                            <h4 className="text-sm font-black mt-1">{s.product || s.item}</h4>
                            <div className="text-[10px] font-mono text-slate-500 mt-1">Ordered: {s.quantity.toLocaleString()} {s.unit}</div>
                            {s.asnNumber && (
                              <div className="text-[10px] font-mono text-violet-600 dark:text-violet-400 mt-0.5">ASN {s.asnNumber}</div>
                            )}
                            {s.cargoLines && s.cargoLines.length > 1 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {s.cargoLines.length} POs in container · {s.cargoLines.map((c) => c.poNumber).join(', ')}
                              </div>
                            )}
                            {s.packingSlipName && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                                Slip: {s.packingSlipName}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 space-y-2">
                            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" />{s.origin}</div>
                            <div className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-emerald-500" />PSA: {s.psaTerminal}</div>
                          </div>

                          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <label className="block space-y-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Confirm qty ({s.unit})</span>
                              <input
                                type="number"
                                min={1}
                                value={confirmQtyById[s.id] ?? String(s.quantity)}
                                onChange={(e) => setConfirmQtyById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Container #</span>
                              <input
                                value={shipContainerById[s.id] ?? (s.containerNumber || '')}
                                onChange={(e) => setShipContainerById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="e.g. FGRU8800121"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400">ETA</span>
                              <input
                                value={shipEtaById[s.id] ?? (s.eta === 'Pending dispatch' ? '3 Days' : s.eta)}
                                onChange={(e) => setShipEtaById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="e.g. 3 Days"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400">Shipment notes</span>
                              <textarea
                                rows={2}
                                value={shipNotesById[s.id] ?? ''}
                                onChange={(e) => setShipNotesById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Seal #, trailer, special handling…"
                              />
                            </label>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                          {s.status === 'delivered' ? (
                            <div className="w-full text-center py-2 bg-slate-100 text-[10.5px] font-mono font-black text-slate-500 uppercase rounded-lg">Pipeline closed</div>
                          ) : (
                            <button
                              onClick={() => handleConfirmAndDispatch(s)}
                              disabled={dispatchingId !== null}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                            >
                              {dispatchingId === s.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Syncing to PSA…</>
                              ) : (
                                <>Confirm qty &amp; ship <ArrowRight className="w-3.5 h-3.5" /></>
                              )}
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
              <div className="w-full lg:w-[32%] xl:w-[28%] bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col h-[42vh] lg:h-full shrink-0">
                <div className="p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-sky-200">PSA-linked fleet</span>
                    <span className="text-slate-400">
                      {filteredTransitShipments.length}
                      {transitFilterCount > 0 ? ` / ${transitShipments.length}` : ''} active
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['all', 'All'],
                          ['on-time', 'On-time'],
                          ['delayed', 'Delayed'],
                          ['mismatched', 'Mismatched'],
                          ['delivered', 'Delivered'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTransitStatusFilter(value)}
                          className={cn(
                            'px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors',
                            transitStatusFilter === value
                              ? value === 'delayed' || value === 'mismatched'
                                ? 'bg-rose-600 border-rose-500 text-white'
                                : value === 'delivered'
                                  ? 'bg-sky-600 border-sky-500 text-white'
                                  : value === 'on-time'
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-slate-700 border-slate-600 text-white dark:bg-white/20 dark:border-white/30'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-white/5 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTransitFiltersOpen((v) => !v)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
                        transitFiltersOpen || transitFilterCount > 0
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-white/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10'
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      More filters
                      {transitFilterCount > 0 && (
                        <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] flex items-center justify-center">
                          {transitFilterCount}
                        </span>
                      )}
                    </button>
                    {transitFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransitStatusFilter('all');
                          setTransitModeFilter('all');
                          setTransitSupplierFilter('all');
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  {transitFiltersOpen && (
                    <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-slate-100 dark:border-white/10">
                      <label className="space-y-0.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Transport</span>
                        <select
                          value={transitModeFilter}
                          onChange={(e) => setTransitModeFilter(e.target.value as typeof transitModeFilter)}
                          className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-slate-100"
                        >
                          <option value="all">Sea, air &amp; land</option>
                          <option value="ocean">Sea only</option>
                          <option value="air">Air only</option>
                          <option value="road">Land only</option>
                        </select>
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Supplier</span>
                        <select
                          value={transitSupplierFilter}
                          onChange={(e) => setTransitSupplierFilter(e.target.value)}
                          className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-slate-100"
                        >
                          <option value="all">All suppliers</option>
                          {transitSuppliers.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {filteredTransitShipments.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No lots match these filters.
                    </div>
                  ) : isVendor ? (
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
                    <div className="space-y-2.5">
                      {filteredTransitShipments.map((s) => (
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
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[10px] text-slate-500 shrink-0">
                  <span>Role: {isVendor ? 'Supplier' : 'Retail buyer'}</span>
                  <span className="flex items-center gap-1 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> PSA live</span>
                </div>
              </div>

              <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
                <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="absolute top-3 right-4 z-20">
                  <div className="flex bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-1">
                  {([['map', MapIcon, 'Map'], ['timeline', Activity, 'PSA Timeline'], ['calendar', CalendarIcon, 'Calendar']] as const).map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-[10px] font-bold font-mono uppercase flex items-center gap-1.5',
                        viewMode === mode ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                  </div>
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
                  <div className="absolute inset-0 flex flex-col pt-14 overflow-y-auto">
                    {selectedShipment && activeDisruption && (
                      <div className="px-4 lg:px-5 pb-2 shrink-0 z-10 w-full">
                        <div
                          className={cn(
                            'rounded-xl p-3 border space-y-2',
                            selectedShipment.status === 'delayed' || selectedShipment.hasAnomaly || ('kind' in activeDisruption && activeDisruption.kind === 'mismatch')
                              ? 'bg-red-50/95 dark:bg-rose-950/20 border-l-4 border-rose-500 border-rose-200/50'
                              : 'bg-amber-50/95 dark:bg-amber-950/20 border-l-4 border-amber-500 border-amber-200/50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <ShieldAlert
                              className={cn(
                                'w-5 h-5 shrink-0',
                                selectedShipment.status === 'delayed' || selectedShipment.hasAnomaly || ('kind' in activeDisruption && activeDisruption.kind === 'mismatch')
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <h4
                                className={cn(
                                  'text-sm font-black uppercase font-mono',
                                  selectedShipment.status === 'delayed' || selectedShipment.hasAnomaly || ('kind' in activeDisruption && activeDisruption.kind === 'mismatch')
                                    ? 'text-rose-900 dark:text-rose-200'
                                    : 'text-amber-900 dark:text-amber-200'
                                )}
                              >
                                {isVendor ? 'Supplier alert' : 'Buyer alert'} · {activeDisruption.routeId}
                              </h4>
                              <p className="text-xs mt-1 font-mono text-slate-700 dark:text-slate-300 line-clamp-2">
                                {activeDisruption.threatVector}
                              </p>
                              <p className="text-xs mt-1.5 flex items-start gap-2 text-slate-600 dark:text-slate-400">
                                <TrendingDown className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{activeDisruption.delayText}</span>
                              </p>
                              {!isVendor && alertDetailsOpen && (
                                <div className="mt-2 space-y-2">
                                  {'kind' in activeDisruption && activeDisruption.kind === 'mismatch' ? (
                                    <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/50 border border-rose-200/60 dark:border-rose-800/40 space-y-1.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-rose-800 dark:text-rose-300">
                                        Take action
                                      </div>
                                      <p className="text-xs text-slate-700 dark:text-slate-300">
                                        {activeDisruption.suggestedAction}
                                      </p>
                                      <p className="text-[11px] text-slate-500">
                                        {activeDisruption.mitigationText}
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/50 border border-amber-200/60 dark:border-amber-800/40 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                                      Shelf life impact
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">
                                      {activeDisruption.shelfImpact}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                                      <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        Planned shelf: {activeDisruption.shelfLifeBefore ?? 14}d
                                      </span>
                                      <span className="px-2 py-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                                        At-risk shelf: {activeDisruption.shelfLifeAfter ?? 9}d
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      'p-3 rounded-lg border space-y-1.5',
                                      activeDisruption.willShortage
                                        ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50'
                                        : 'bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        'text-[10px] font-bold uppercase tracking-wide',
                                        activeDisruption.willShortage
                                          ? 'text-rose-800 dark:text-rose-300'
                                          : 'text-slate-500'
                                      )}
                                    >
                                      {activeDisruption.willShortage
                                        ? 'Shelf shortage if shipment stays delayed'
                                        : 'Shelf stock check'}
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">
                                      {activeDisruption.shortageImpact}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        On hand: {(activeDisruption.storeOnHandCases ?? 0).toLocaleString()} cases
                                      </span>
                                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        Demand: {activeDisruption.dailyDemandCases ?? 0}/day
                                      </span>
                                      <span className="px-2 py-1 rounded bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                                        Cover: {activeDisruption.daysOfCover ?? 0}d
                                      </span>
                                      {activeDisruption.willShortage && (
                                        <span className="px-2 py-1 rounded bg-rose-200 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200">
                                          Gap: {(activeDisruption.shortageCases ?? 0).toLocaleString()} cases · stockout ~
                                          {activeDisruption.stockoutInDays ?? 0}d
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                    </>
                                  )}
                                </div>
                              )}
                              {isVendor && (
                                <p className="text-[11px] mt-2 text-slate-600 dark:text-slate-400">
                                  Informational only — no reroute approval required. Keep PSA Portnet updated with container status.
                                </p>
                              )}
                            </div>
                            {isEvaluating && (
                              <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recalculating…
                              </div>
                            )}
                          </div>
                          {!isVendor && (
                            <div className="border-t border-amber-200/70 dark:border-amber-800/40 pt-2 flex flex-wrap justify-between gap-2 items-center">
                              <button
                                type="button"
                                onClick={() => setAlertDetailsOpen((v) => !v)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300 hover:text-sky-700"
                              >
                                {alertDetailsOpen ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                                {alertDetailsOpen
                                  ? 'Hide actions'
                                  : ('kind' in activeDisruption && activeDisruption.kind === 'mismatch'
                                      ? 'Take actions'
                                      : 'Show shelf impact')}
                              </button>
                              <div className="flex flex-wrap gap-2">
                                {'kind' in activeDisruption && activeDisruption.kind === 'mismatch' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setViewMode('timeline')}
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase font-mono shrink-0"
                                    >
                                      Review PSA timeline
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowAlertsPanel(true)}
                                      className="inline-flex items-center gap-2 px-3 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-[10px] font-black uppercase font-mono shrink-0"
                                    >
                                      Open buyer alerts
                                    </button>
                                  </>
                                ) : (
                                  <>
                                <button
                                  type="button"
                                  onClick={() => navigate('/inbox')}
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase font-mono shrink-0"
                                >
                                  Review Inbox approvals
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate('/procurement')}
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-[10px] font-black uppercase font-mono shrink-0"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                  Ask alternative suppliers
                                </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {!isVendor && selectedShipment && !activeDisruption && (
                      <div className="px-4 lg:px-5 pb-2 shrink-0 w-full">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
                          <div className="flex items-center gap-2 font-mono font-bold text-sky-200">
                            <Link2 className="w-4 h-4" /> Tracking {selectedShipment.containerNumber} via PSA Portnet®
                          </div>
                          <span className="text-[10px] font-mono text-emerald-300">Sync {formatSyncAge(selectedShipment.psaLastSyncAt)} · {selectedShipment.psaEvents?.length || 0} events</span>
                        </div>
                      </div>
                    )}
                    {!isVendor && selectedShipment && activeDisruption && (
                      <div className="px-4 lg:px-5 pb-2 shrink-0 w-full">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 flex flex-wrap justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
                          <div className="flex items-center gap-2 font-mono font-bold text-sky-200">
                            <Link2 className="w-4 h-4" /> Tracking {selectedShipment.containerNumber} via PSA Portnet®
                          </div>
                          <span className="text-[10px] font-mono text-amber-300">
                            {'kind' in activeDisruption && activeDisruption.kind === 'mismatch'
                              ? 'Mode mismatch alert active'
                              : 'Delay alert active'}
                            {' · '}Sync {formatSyncAge(selectedShipment.psaLastSyncAt)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex-1 px-4 lg:px-5 pb-4 min-h-[420px] flex flex-col gap-2 w-full">
                      <div className="flex-1 min-h-[360px] h-[min(52vh,520px)]">
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
                          {(() => {
                            const lines = getShipmentCargoLines(selectedShipment);
                            const poCount = new Set(lines.map((l) => l.poNumber)).size;
                            return (
                              <div className="text-[11px] text-sky-300/90 mt-1.5">
                                {poCount} PO{poCount === 1 ? '' : 's'} / {lines.length} item{lines.length === 1 ? '' : 's'} in this container
                                {' · '}
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('containers')}
                                  className="underline hover:text-sky-200"
                                >
                                  View all PO details
                                </button>
                              </div>
                            );
                          })()}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="flex items-center gap-1.5 border border-slate-700 px-3 py-1 rounded-md text-[9.5px] font-black uppercase"><Clock className="w-3.5 h-3.5" />{selectedShipment.status === 'delivered' ? 'Landed @ DC' : `ETA ${selectedShipment.eta}`}</span>
                            <span className="flex items-center gap-1.5 border border-emerald-900/60 bg-emerald-950/40 text-emerald-400 px-3 py-1 rounded-md text-[9.5px] font-black uppercase"><Thermometer className="w-3.5 h-3.5" />{selectedShipment.temp}</span>
                            <span className="flex items-center gap-1.5 border border-sky-700/60 bg-sky-950/40 text-sky-300 px-3 py-1 rounded-md text-[9.5px] font-black uppercase"><Navigation className="w-3.5 h-3.5" />{selectedShipment.fleetSpecification}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === 'timeline' && (
                  <div className="absolute inset-0 overflow-y-auto p-4 lg:p-5 pt-20">
                    <PsaTimelinePanel
                      shipment={selectedShipment}
                      onNotifyCarrier={() => {
                        if (!selectedShipment) return;
                        setFeedbackMsg(
                          `Carrier notified for ${selectedShipment.containerNumber || selectedShipment.id}: confirm ${selectedShipment.incoterms || 'booking'} mode vs live PSA leg.`
                        );
                        setTimeout(() => setFeedbackMsg(null), 4500);
                        upsertMany([
                          {
                            id: `n-mismatch-carrier-${selectedShipment.id}-${Date.now()}`,
                            title: 'Carrier notified — mode mismatch',
                            message: `${selectedShipment.id}: confirm active transit leg against ${selectedShipment.incoterms || 'Incoterms'}.`,
                            severity: 'warning',
                            category: 'Urgent',
                            timestamp: new Date().toISOString(),
                            read: false,
                            module: 'Logistics',
                            href: '/logistics',
                          },
                        ]);
                      }}
                      onEscalateBuyer={() => {
                        if (!selectedShipment) return;
                        setFeedbackMsg(
                          `Mismatch escalated to category buyer for ${selectedShipment.product || selectedShipment.item}.`
                        );
                        setTimeout(() => setFeedbackMsg(null), 4500);
                        upsertMany([
                          {
                            id: `n-mismatch-buyer-${selectedShipment.id}-${Date.now()}`,
                            title: 'Mode mismatch escalated to buyer',
                            message: `${selectedShipment.id}: ${selectedShipment.incoterms || 'Incoterms'} expects sea/road differently than PSA tracking.`,
                            severity: 'warning',
                            category: 'Urgent',
                            timestamp: new Date().toISOString(),
                            read: false,
                            module: 'Logistics',
                            href: '/inbox',
                          },
                        ]);
                        navigate('/inbox');
                      }}
                      onOpenAlerts={() => setShowAlertsPanel(true)}
                    />
                  </div>
                )}

                {viewMode === 'calendar' && (
                  <div className="absolute inset-0 overflow-auto p-4 lg:p-5 pt-20">
                    <ShipmentCalendar
                      shipments={filteredTransitShipments}
                      searchQuery={searchQuery}
                      onSelectShipment={(id) => {
                        setSelectedShipmentId(id);
                        setViewMode('map');
                      }}
                    />
                  </div>
                )}
                </div>
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
  const isDelayed = shipment.status === 'delayed' || !!shipment.hasAnomaly;
  const isMismatch = !isDelayed && isShipmentModeMismatch(shipment);
  const isAlert = isDelayed || isMismatch;
  const isDelivered = shipment.status === 'delivered';
  return (
    <div onClick={onClick} className={cn(
      'p-4 rounded-xl border cursor-pointer flex flex-col gap-2.5 transition-colors',
      isDelivered && (active
        ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'),
      isAlert && !isDelivered && (active
        ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-100 dark:bg-rose-950/40'
        : 'border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/25'),
      !isAlert && !isDelivered && (active
        ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50/40'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900')
    )}>
      <div className="flex justify-between gap-2">
        <div>
          <h4 className="font-mono text-[11px] font-black">{shipment.id} · <span className="font-sans font-bold">{shipment.item}</span></h4>
          <span className="text-[10px] text-slate-500 font-mono">{shipment.containerNumber}</span>
        </div>
        {isDelivered ? (
          <span className="bg-emerald-600 text-white font-mono text-[8.5px] font-black uppercase px-2 py-0.5 rounded">Delivered</span>
        ) : isDelayed ? (
          <span className="bg-rose-200/80 dark:bg-rose-900/50 border border-rose-300 dark:border-rose-700 px-2 py-0.5 rounded text-[8.5px] font-black uppercase text-rose-700 dark:text-rose-300 font-mono flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Delayed</span>
        ) : isMismatch ? (
          <span className="bg-rose-200/80 dark:bg-rose-900/50 border border-rose-300 dark:border-rose-700 px-2 py-0.5 rounded text-[8.5px] font-black uppercase text-rose-700 dark:text-rose-300 font-mono flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mismatched</span>
        ) : (
          <span className="bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[8.5px] font-black uppercase text-emerald-600 font-mono">On track</span>
        )}
      </div>
      <div className={cn('border-t pt-2 flex justify-between text-[11px] text-slate-500', isAlert && !isDelivered ? 'border-rose-200/80 dark:border-rose-800/50' : 'border-slate-100 dark:border-slate-800')}>
        <span className="truncate">From: <strong className="text-slate-700 dark:text-slate-300">{shipment.origin}</strong></span>
        <ArrowRight className="w-3.5 h-3.5 mx-1 shrink-0" />
        <span className="truncate text-right">To: <strong className="text-slate-700 dark:text-slate-300">{shipment.destination}</strong></span>
      </div>
      <div className="flex justify-between text-[11px] font-mono">
        <span className="flex items-center gap-1"><Thermometer className={cn('w-3.5 h-3.5', isAlert ? 'text-rose-500' : 'text-emerald-500')} />{isDelivered ? 'Received @ DC' : shipment.temp}</span>
        <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5 text-emerald-500" />ETA: {isDelivered ? 'Closed' : shipment.eta}</span>
      </div>
    </div>
  );
}

function BuyerShipmentListItem({ shipment, active, onClick }: { shipment: Shipment; active: boolean; onClick: () => void }) {
  const isDelivered = shipment.status === 'delivered';
  const isDelayed = shipment.status === 'delayed' || !!shipment.hasAnomaly;
  const isMismatch = !isDelayed && isShipmentModeMismatch(shipment);
  const isAlert = isDelayed || isMismatch;
  const mismatch = isMismatch ? getShipmentModeMismatch(shipment) : null;
  let status = 'In transit · PSA synced';
  if (isDelivered) status = 'Delivered';
  else if (isDelayed) status = 'Delayed · PSA update';
  else if (isMismatch) {
    status = mismatch?.incotermCode
      ? `Mismatched · ${mismatch.incotermCode} expects ${mismatch.expected === 'water' ? 'sea' : mismatch.expected}`
      : 'Mismatched · transit mode';
  }
  else if (shipment.rerouted) status = 'Approaching DC';
  else if (shipment.expectedDelay) status = 'Expected delay ahead';
  let eta = shipment.eta;
  if (shipment.id === 'PO-2026-DELAY1') eta = shipment.eta;
  else if (shipment.id === 'PO-2026-8842') eta = 'Oct 19, 08:30 AM';
  else if (shipment.id === 'PO-2026-9912A') eta = 'Oct 20, 11:15 AM';
  else if (shipment.id === 'PO-2026-7731C') eta = 'Oct 22, 02:45 PM';

  return (
    <div onClick={onClick} className={cn(
      'p-4 rounded-xl border cursor-pointer flex flex-col gap-2 transition-colors',
      isDelivered && (active
        ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'),
      isAlert && !isDelivered && (active
        ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-100 dark:bg-rose-950/40'
        : 'border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/25'),
      !isAlert && !isDelivered && (active
        ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50/40'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900')
    )}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-black font-mono">
          {shipment.id}:{' '}
          <span className={cn('font-sans font-extrabold', isAlert ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-400')}>
            {shipment.product || shipment.item}
          </span>
        </h4>
        {isDelayed && !isDelivered && (
          <span className="shrink-0 bg-rose-200/80 dark:bg-rose-900/50 border border-rose-300 dark:border-rose-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-rose-700 dark:text-rose-300 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> Delayed
          </span>
        )}
        {isMismatch && !isDelivered && (
          <span className="shrink-0 bg-rose-200/80 dark:bg-rose-900/50 border border-rose-300 dark:border-rose-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-rose-700 dark:text-rose-300 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> Mismatched
          </span>
        )}
      </div>
      <div className="text-[10px] font-mono text-slate-500">{shipment.containerNumber} · {shipment.vesselName}</div>
      <div className="text-[11px] mt-1">
        <div className="font-semibold text-slate-600">
          Status:{' '}
          <span className={cn('font-bold', isAlert ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-400')}>
            {status}
          </span>
        </div>
        <div className="text-slate-500 font-mono mt-0.5">Expected: <span className="text-slate-700 dark:text-slate-300 font-bold">{isDelivered ? 'Closed' : eta}</span></div>
      </div>
    </div>
  );
}
