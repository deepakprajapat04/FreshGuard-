/**
 * Shipment intelligence — master-detail with step wizard detail panel.
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Filter,
  MapPin,
  Package,
  AlertTriangle,
  ClipboardList,
  TrendingDown,
  Truck,
  Route,
  Maximize2,
  Minimize2,
  Search,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import { contentCanvasClass } from '../lib/sapTheme';
import { StockRiskPanel } from '../components/tracking/StockRiskPanel';
import { SourcingRiskPanel } from '../components/tracking/SourcingRiskPanel';
import { PromotionRiskPanel } from '../components/tracking/PromotionRiskPanel';
import { ShelfLifePanel } from '../components/tracking/ShelfLifePanel';
import { ReceivingRiskPanel } from '../components/tracking/ReceivingRiskPanel';
import { TransportRiskPanel } from '../components/tracking/TransportRiskPanel';
import { OverstockRiskPanel } from '../components/tracking/OverstockRiskPanel';
import { EarlyClearanceRiskPanel } from '../components/tracking/EarlyClearanceRiskPanel';
import { DistributionRiskPanel } from '../components/tracking/DistributionRiskPanel';
import { RiskActionFooter } from '../components/tracking/RiskActionFooter';
import { MVP_HIDE_PROMOTIONS } from '../lib/mvpFlags';
import {
  DEMO_SHIPMENTS,
  EVENT_COLORS,
  EVENT_LABELS,
  loadRiskActions,
  getShipmentDelayDays,
  approveRiskAction,
  rejectRiskAction,
  selectClearanceOption,
  selectSourcingSupplier,
  isCategoryTwoStepAction,
  isDcPurchasingPersona,
  canPersonaApproveAction,
  shipmentVisibleToPersona,
  isVegetablesStatusOnlyIntel,
  type RiskAction,
  type TrackShipment,
  type FreshGuardPersona,
  type ShipmentEventStatus,
  PERSONA_LABELS,
} from '../lib/trackingFlow';

const STAGE_LABELS: Record<TrackShipment['stage'], string> = {
  origin: 'Origin / supplier',
  ocean: 'Ocean transit',
  customs: 'Customs clearance',
  inland: 'Inland haulage',
  dc_arrival: 'DC arrival',
  delivered: 'Delivered',
};

type DetailStep = 'event' | 'route' | 'risks' | 'actions';
type RiskSubStep =
  | 'stock'
  | 'sourcing'
  | 'promotion'
  | 'shelf_life'
  | 'overstock'
  | 'clearance'
  | 'receiving'
  | 'transport'
  | 'distribution';
type EventFilter = 'all' | ShipmentEventStatus;

const DETAIL_STEPS: { id: DetailStep; label: string; icon: typeof Package }[] = [
  { id: 'event', label: 'Event', icon: AlertTriangle },
  { id: 'route', label: 'Touchpoints', icon: Route },
  { id: 'risks', label: 'Risks', icon: TrendingDown },
  { id: 'actions', label: 'Actions', icon: ClipboardList },
];

/** MVP: hide Risks & Actions tabs and Actions pending KPI — flip to false to restore. */
const MVP_HIDE_RISKS_AND_ACTIONS = true;

const ORIGINAL_ETA_ISO: Record<string, string> = {
  'SHP-BB-DLY-01': '2026-08-21',
  'SHP-ST-EARLY-01': '2026-08-20',
  'SHP-ST-EARLY-02': '2026-08-22',
  'SHP-BB-ONT-01': '2026-08-21',
  'SHP-VEG-DLY-01': '2026-08-22',
  'SHP-VEG-DLY-02': '2026-08-21',
  'SHP-VEG-DLY-03': '2026-08-22',
  'SHP-VEG-EARLY-01': '2026-08-20',
  'SHP-VEG-EARLY-02': '2026-08-22',
  'SHP-VEG-ONT-01': '2026-08-22',
  'SHP-VEG-ONT-02': '2026-08-23',
  'SHP-VEG-ONT-03': '2026-08-24',
};

const REVISED_ETA_ISO: Record<string, string> = {
  'SHP-BB-DLY-01': '2026-08-23',
  'SHP-ST-EARLY-01': '2026-08-19',
  'SHP-ST-EARLY-02': '2026-08-20',
  'SHP-BB-ONT-01': '2026-08-21',
  'SHP-VEG-DLY-01': '2026-08-24',
  'SHP-VEG-DLY-02': '2026-08-22',
  'SHP-VEG-DLY-03': '2026-08-25',
  'SHP-VEG-EARLY-01': '2026-08-19',
  'SHP-VEG-EARLY-02': '2026-08-20',
  'SHP-VEG-ONT-01': '2026-08-22',
  'SHP-VEG-ONT-02': '2026-08-23',
  'SHP-VEG-ONT-03': '2026-08-24',
};

function getRiskSubSteps(shipment: TrackShipment): { id: RiskSubStep; label: string }[] {
  if (shipment.eventStatus === 'delayed') {
    const steps: { id: RiskSubStep; label: string }[] = [
      { id: 'stock', label: 'Stock risk' },
      { id: 'sourcing', label: 'Alt supplier' },
      { id: 'promotion', label: 'Promotion risk' },
      { id: 'shelf_life', label: 'Shelf life' },
      { id: 'receiving', label: 'Receiving' },
      { id: 'transport', label: 'Transport' },
    ];
    return MVP_HIDE_PROMOTIONS ? steps.filter((s) => s.id !== 'promotion') : steps;
  }
  if (shipment.eventStatus === 'early') {
    return [
      { id: 'overstock', label: 'Overstock risk' },
      { id: 'clearance', label: 'Clearance' },
      { id: 'receiving', label: 'Receiving' },
      { id: 'transport', label: 'Transport' },
      { id: 'distribution', label: 'Distribution' },
    ];
  }
  return [];
}

const VEGETABLE_DETAIL_STEPS: { id: DetailStep; label: string; icon: typeof Package }[] = [
  { id: 'event', label: 'Event', icon: AlertTriangle },
  { id: 'route', label: 'Touchpoints', icon: Route },
];

export default function TrackingHub() {
  const { persona } = usePersona();
  const statusOnlyIntel = isVegetablesStatusOnlyIntel(persona);
  const hideRisksAndActions = statusOnlyIntel || MVP_HIDE_RISKS_AND_ACTIONS;
  const visibleDetailSteps = hideRisksAndActions ? VEGETABLE_DETAIL_STEPS : DETAIL_STEPS;
  const { upsertMany } = useNotifications();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [flash, setFlash] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(DEMO_SHIPMENTS[0].id);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [detailStep, setDetailStep] = useState<DetailStep>('event');
  const [riskSubStep, setRiskSubStep] = useState<RiskSubStep>('stock');
  const [detailExpanded, setDetailExpanded] = useState(false);

  useEffect(() => {
    if (!detailExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailExpanded]);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  useEffect(() => {
    setActions(loadRiskActions());
  }, []);

  const filteredShipments = useMemo(() => {
    return DEMO_SHIPMENTS.filter((s) => {
      if (!shipmentVisibleToPersona(s, persona)) return false;
      if (eventFilter !== 'all' && s.eventStatus !== eventFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.containerNumber.toLowerCase().includes(q) ||
          s.item.toLowerCase().includes(q) ||
          s.linkedPos.some((p) => p.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [eventFilter, search, persona]);

  useEffect(() => {
    if (filteredShipments.some((s) => s.id === selectedId)) return;
    setSelectedId(filteredShipments[0]?.id ?? DEMO_SHIPMENTS[0].id);
  }, [filteredShipments, selectedId]);

  useEffect(() => {
    if (!hideRisksAndActions) return;
    if (detailStep === 'risks' || detailStep === 'actions') {
      setDetailStep('event');
    }
  }, [hideRisksAndActions, detailStep]);

  const selected =
    filteredShipments.find((s) => s.id === selectedId) ||
    DEMO_SHIPMENTS.find((s) => s.id === selectedId) ||
    filteredShipments[0] ||
    DEMO_SHIPMENTS[0];

  const shipmentActions = actions.filter((a) => a.shipmentId === selected.id);
  const stockAction = shipmentActions.find((a) => a.category === 'stock');
  const sourcingAction = shipmentActions.find((a) => a.category === 'sourcing');
  const promoAction = shipmentActions.find((a) => a.category === 'promotion');
  const shelfAction = shipmentActions.find((a) => a.category === 'shelf_life');
  const overstockAction = shipmentActions.find((a) => a.category === 'overstock');
  const clearanceAction = shipmentActions.find((a) => a.category === 'clearance');
  const receivingAction = shipmentActions.find((a) => a.category === 'receiving');
  const transportAction = shipmentActions.find((a) => a.category === 'transport');
  const distributionAction = shipmentActions.find((a) => a.category === 'distribution');
  const delayDays = getShipmentDelayDays(selected);
  const riskSubSteps = getRiskSubSteps(selected);

  const pendingForPersona = useMemo(() => {
    return actions.filter((a) => {
      if (a.status === 'pending_approval') {
        if (isDcPurchasingPersona(persona)) return a.approverPersona === persona;
        return false;
      }
      if (a.status === 'pending_category_approval') {
        return persona === 'category_manager' && isCategoryTwoStepAction(a);
      }
      return false;
    });
  }, [actions, persona]);

  const canApproveAction = (action: RiskAction | undefined) =>
    !!action && canPersonaApproveAction(action, persona);

  const refreshActions = () => setActions(loadRiskActions());

  const notifyDeliveryTeam = (action: RiskAction) => {
    const notifies = action.notifyPersonas.map((p) => ({
      id: `n-${action.id}-${p}`,
      title: `Stock reallocation approved: ${action.title}`,
      message: `${action.proposal} — ${PERSONA_LABELS[p]} please execute delivery moves.`,
      severity: 'info' as const,
      category: 'Regular' as const,
      timestamp: new Date().toISOString(),
      read: false,
      module: 'System' as const,
      href: '/actions',
    }));
    upsertMany(notifies);
  };

  const handleStockApprove = (actionId: string) => {
    const updated = approveRiskAction(actionId, persona);
    if (!updated) return;
    notifyDeliveryTeam(updated);
    refreshActions();
    const teams = updated.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ');
    setFlash(`Stock reallocation approved. Delivery team (${teams}) notified to execute moves.`);
    setTimeout(() => setFlash(null), 5000);
  };

  const handleSourcingApprove = (actionId: string) => {
    const updated = approveRiskAction(actionId, persona);
    if (!updated) return;
    refreshActions();
    const po = updated.sourcingProposal?.issuedPo;
    const alt = updated.sourcingProposal?.options.find(
      (o) => o.id === updated.sourcingProposal?.selectedOptionId
    );
    upsertMany(
      updated.notifyPersonas.map((p) => ({
        id: `n-${updated.id}-${p}`,
        title: po
          ? `New PO issued: ${po}`
          : `Alternate supplier approved: ${updated.title}`,
        message: po
          ? `${po} created for ${alt?.supplierName ?? 'alternate'} — ${updated.proposal}`
          : updated.proposal,
        severity: 'success' as const,
        category: 'Regular' as const,
        timestamp: new Date().toISOString(),
        read: false,
        module: 'System' as const,
        href: po ? `/orders?po=${encodeURIComponent(po)}` : '/orders',
      }))
    );
    setFlash(
      po
        ? `New PO ${po} created — open SAP Purchase Orders to track it.`
        : 'Alternate supplier proposal approved.'
    );
    setTimeout(() => setFlash(null), 5000);
  };

  const notifyCategoryManagerForReview = (action: RiskAction) => {
    const isClearance = action.category === 'clearance';
    upsertMany([
      {
        id: `n-${action.id}-category-review`,
        title: isClearance
          ? `Clearance ready for approval: ${action.title}`
          : MVP_HIDE_PROMOTIONS
            ? `Change ready for approval: ${action.title}`
            : `Promo change ready for approval: ${action.title}`,
        message: isClearance
          ? MVP_HIDE_PROMOTIONS
            ? `${action.proposal} — Please choose a markdown plan.`
            : `${action.proposal} — Please choose markdown or schedule promotion.`
          : `${action.proposal} — Please review and approve reschedule & store mix updates.`,
        severity: 'info' as const,
        category: 'Regular' as const,
        timestamp: new Date().toISOString(),
        read: false,
        module: 'System' as const,
        href: '/actions',
      },
    ]);
  };

  const handlePromoApprove = (actionId: string) => {
    const updated = approveRiskAction(actionId, persona);
    if (!updated) return;
    refreshActions();
    const isClearance = updated.category === 'clearance';
    if (updated.status === 'pending_category_approval') {
      notifyCategoryManagerForReview(updated);
      setFlash('Sent to Category Manager for approval.');
    } else if (updated.status === 'approved') {
      upsertMany([
        {
          id: `n-${updated.id}-confirmed`,
          title: isClearance
            ? `Clearance confirmed: ${updated.title}`
            : MVP_HIDE_PROMOTIONS
              ? `Changes confirmed: ${updated.title}`
              : `Promo changes confirmed: ${updated.title}`,
          message: isClearance
            ? MVP_HIDE_PROMOTIONS
              ? `${updated.proposal} — Apply markdown plan.`
              : `${updated.proposal} — Apply markdown and/or schedule promo on calendar.`
            : MVP_HIDE_PROMOTIONS
              ? `${updated.proposal} — Updates applied to calendar & store allocations.`
              : `${updated.proposal} — Updates applied to promo calendar & store allocations.`,
          severity: 'success' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash(
        isClearance
          ? MVP_HIDE_PROMOTIONS
            ? 'Clearance plan approved — apply markdown.'
            : 'Clearance plan approved — apply markdown and/or schedule promo.'
          : MVP_HIDE_PROMOTIONS
            ? 'Changes approved — POS & marketing updates confirmed.'
            : 'Promo changes approved — POS & marketing updates confirmed.'
      );
    }
    setTimeout(() => setFlash(null), 5000);
  };

  const notifyShelfLifeTeams = (action: RiskAction) => {
    const notifies = action.notifyPersonas.map((p) => ({
      id: `n-${action.id}-${p}`,
      title: `Shelf-life guidance approved: ${action.title}`,
      message: `${action.proposal} — ${PERSONA_LABELS[p]} please apply QC markdown rules & delivery schedule.`,
      severity: 'info' as const,
      category: 'Regular' as const,
      timestamp: new Date().toISOString(),
      read: false,
      module: 'System' as const,
      href: '/actions',
    }));
    upsertMany(notifies);
  };

  const handleShelfApprove = (actionId: string) => {
    const updated = approveRiskAction(actionId, persona);
    if (!updated) return;
    notifyShelfLifeTeams(updated);
    refreshActions();
    setFlash('Shelf-life guidance approved. Receiving & Category Manager notified.');
    setTimeout(() => setFlash(null), 5000);
  };

  const handleResourceApprove = (actionId: string) => {
    const updated = approveRiskAction(actionId, persona);
    if (!updated) return;
    upsertMany(
      updated.notifyPersonas.map((p) => ({
        id: `n-${updated.id}-${p}`,
        title: `${updated.title} approved`,
        message: `${updated.proposal} — ${PERSONA_LABELS[p]} please replan accordingly.`,
        severity: 'info' as const,
        category: 'Regular' as const,
        timestamp: new Date().toISOString(),
        read: false,
        module: 'System' as const,
        href: '/actions',
      }))
    );
    refreshActions();
    const teams = updated.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ');
    setFlash(`${updated.title} approved. ${teams} notified.`);
    setTimeout(() => setFlash(null), 5000);
  };

  const selectShipment = (id: string) => {
    setSelectedId(id);
    setDetailStep('event');
    const ship = DEMO_SHIPMENTS.find((s) => s.id === id);
    if (ship) {
      const subs = getRiskSubSteps(ship);
      if (subs.length) setRiskSubStep(subs[0].id);
    }
  };

  const activeRiskAction = useMemo((): RiskAction | undefined => {
    if (detailStep !== 'risks') return undefined;
    const byStep: Record<RiskSubStep, RiskAction | undefined> = {
      stock: stockAction,
      sourcing: sourcingAction,
      promotion: promoAction,
      shelf_life: shelfAction,
      overstock: overstockAction,
      clearance: clearanceAction,
      receiving: receivingAction,
      transport: transportAction,
      distribution: distributionAction,
    };
    return byStep[riskSubStep];
  }, [
    detailStep,
    riskSubStep,
    stockAction,
    sourcingAction,
    promoAction,
    shelfAction,
    overstockAction,
    clearanceAction,
    receivingAction,
    transportAction,
    distributionAction,
  ]);

  const handleActiveRiskApprove = (actionId: string) => {
    const action = activeRiskAction;
    if (!action || action.id !== actionId) return;

    if (action.category === 'sourcing' && action.sourcingProposal) {
      const optionId =
        action.sourcingProposal.selectedOptionId ?? action.sourcingProposal.recommendedOptionId;
      if (optionId) selectSourcingSupplier(actionId, optionId);
    }
    if (action.category === 'clearance' && action.clearanceProposal) {
      const optionId =
        action.clearanceProposal.selectedOptionId ?? action.clearanceProposal.recommendedOptionId;
      selectClearanceOption(actionId, optionId);
    }

    switch (action.category) {
      case 'stock':
        handleStockApprove(actionId);
        break;
      case 'sourcing':
        handleSourcingApprove(actionId);
        break;
      case 'promotion':
      case 'clearance':
        handlePromoApprove(actionId);
        break;
      case 'shelf_life':
        handleShelfApprove(actionId);
        break;
      default:
        handleResourceApprove(actionId);
        break;
    }
  };

  const handleActiveRiskReject = (actionId: string) => {
    rejectRiskAction(actionId, persona);
    refreshActions();
  };

  const activeRiskOwnerNote = useMemo(() => {
    if (!activeRiskAction) return undefined;
    if (activeRiskAction.category === 'sourcing' && activeRiskAction.sourcingProposal?.eligible) {
      return 'Approving creates the new PO to the selected supplier';
    }
    if (activeRiskAction.category === 'clearance' && activeRiskAction.clearanceProposal) {
      const plan =
        activeRiskAction.clearanceProposal.selectedOptionId ??
        activeRiskAction.clearanceProposal.recommendedOptionId;
      return `Plan: ${plan === 'markdown' || MVP_HIDE_PROMOTIONS ? 'Markdown' : 'Schedule promotion'}`;
    }
    return undefined;
  }, [activeRiskAction]);

  return (
    <div
      className={cn(
        contentCanvasClass,
        'w-full h-full min-h-0 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100'
      )}
    >
      {/* Fixed chrome: title + KPIs stay pinned; list/detail scroll below */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 space-y-3">
        {!detailExpanded && (
          <PageHeader title="FreshGuard · Shipment intelligence">
            <Link
              to="/logistics"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-white dark:hover:bg-slate-800"
            >
              <Truck className="w-4 h-4" />
              Full logistics map
            </Link>
          </PageHeader>
        )}

        {flash && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm">
            {flash}
          </div>
        )}

        {!detailExpanded && (
          <div className={cn('grid gap-2', hideRisksAndActions ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
            <StatCard
              compact
              label="Active lots"
              value={String(filteredShipments.length)}
              tone="sap"
            />
            <StatCard
              compact
              label="Delayed"
              value={String(filteredShipments.filter((s) => s.eventStatus === 'delayed').length)}
              tone="amber"
            />
            <StatCard
              compact
              label="Early"
              value={String(filteredShipments.filter((s) => s.eventStatus === 'early').length)}
              tone="cyan"
            />
            {!hideRisksAndActions && (
              <StatCard compact label="Actions pending" value={String(pendingForPersona.length)} tone="rose" />
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex-1 min-h-0 box-border px-3 sm:px-4 pt-3 pb-3 sm:pb-4',
          'grid gap-3 grid-rows-1',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(280px,340px)_1fr]'
        )}
      >
        <section
          className={cn(
            'min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              Containers
            </h2>
            {eventFilter !== 'all' && (
              <p className="text-[11px] text-slate-500 mt-0.5">{EVENT_LABELS[eventFilter]}</p>
            )}
          </div>

          <div className="shrink-0 p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search container, PO, item…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40"
                />
              </div>
              <div className="relative shrink-0" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    eventFilter !== 'all' || filterOpen
                      ? 'border-[#4684AD] bg-[#C0D5E5]/50 text-[#2F5472]'
                      : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40'
                  )}
                  aria-expanded={filterOpen}
                  aria-haspopup="listbox"
                  title="Filter by delivery event"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                </button>
                {filterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Delivery event
                    </div>
                    {(['all', 'delayed', 'early', 'on-time'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="option"
                        aria-selected={eventFilter === f}
                        onClick={() => {
                          setEventFilter(f);
                          setFilterOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                          eventFilter === f
                            ? 'bg-[#C0D5E5]/60 text-[#2F5472]'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        {f === 'all' ? 'All' : EVENT_LABELS[f]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredShipments.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No containers match filters.</p>
            ) : (
              filteredShipments.map((s) => {
                const active = selected.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectShipment(s.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      active
                        ? 'bg-[#C0D5E5]/70 dark:bg-blue-950/30 border-l-4 border-l-[#4684AD]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-xs font-bold text-[#2F5472]">{s.containerNumber}</span>
                      <span className={cn('text-[11px] font-bold uppercase px-2 py-0.5 rounded border', EVENT_COLORS[s.eventStatus])}>
                        {EVENT_LABELS[s.eventStatus]}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-1">{s.item}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      ETA {s.eta}
                    </div>
                    <div className="text-[11px] text-slate-400 font-code mt-0.5">{s.linkedPos.join(' · ')}</div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Detail — same sticky row; chrome fixed, body scrolls inside */}
        <section className="min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700">
            <div className="px-3 py-2.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="min-w-0">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Container detail
                </h2>
                <p className="font-code text-sm font-bold leading-snug truncate">
                  {selected.containerNumber}
                </p>
                <p className="text-[11px] text-slate-500 truncate leading-snug">
                  {selected.item} · {selected.supplier}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    'text-[11px] font-bold uppercase px-2 py-0.5 rounded border',
                    EVENT_COLORS[selected.eventStatus]
                  )}
                >
                  {EVENT_LABELS[selected.eventStatus]}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailExpanded((v) => !v)}
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-slate-500 hover:text-[#2F5472] hover:border-[#4684AD]/50 transition-colors"
                  title={detailExpanded ? 'Exit full screen (Esc)' : 'Expand to full screen'}
                  aria-label={detailExpanded ? 'Exit full screen' : 'Expand to full screen'}
                >
                  {detailExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-900">
              {visibleDetailSteps.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setDetailStep(step.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-colors',
                    detailStep === step.id
                      ? 'border-[#4684AD] text-[#4684AD] bg-[#C0D5E5]/40'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'w-[1.125rem] h-[1.125rem] rounded-full flex items-center justify-center text-[11px]',
                      detailStep === step.id ? 'bg-[#4684AD] text-white' : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <step.icon className="w-3.5 h-3.5" />
                  {step.label}
                </button>
              ))}
            </div>

            {detailStep === 'risks' && !hideRisksAndActions && riskSubSteps.length > 0 && (
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-950/95">
                <div className="flex flex-wrap gap-1.5">
                  {riskSubSteps.map((sub, idx) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setRiskSubStep(sub.id)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors',
                        riskSubStep === sub.id
                          ? 'bg-[#4684AD] text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-700 hover:border-[#4684AD]/40'
                      )}
                    >
                      <span className="opacity-80">{idx + 1}.</span>
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {/* Step 1 — Event */}
            {detailStep === 'event' && (
              <div className="space-y-4 max-w-2xl">
                <h3 className="text-sm font-bold text-[#2F5472] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  What happened
                </h3>
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-slate-400">Event</dt>
                      <dd className="font-semibold mt-0.5">{EVENT_LABELS[selected.eventStatus]}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-slate-400">ASN</dt>
                      <dd className="font-code mt-0.5">{selected.asnNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-slate-400">Original ETA</dt>
                      <dd className="mt-0.5">{selected.originalEta}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-slate-400">Current ETA</dt>
                      <dd className="mt-0.5 font-semibold text-[#2F5472]">{selected.eta}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-slate-400">Quantity</dt>
                      <dd className="mt-0.5">{selected.quantity.toLocaleString()} {selected.unit}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-slate-400">Linked POs</dt>
                      <dd className="font-code text-xs mt-0.5">{selected.linkedPos.join(', ')}</dd>
                    </div>
                  </dl>
                  {delayDays !== 0 && (
                    <p
                      className={cn(
                        'text-xs rounded-lg px-3 py-2 border',
                        delayDays > 0
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-sky-50 border-sky-200 text-sky-900'
                      )}
                    >
                      {statusOnlyIntel
                        ? delayDays > 0
                          ? `This container is delayed by ${delayDays} day(s). Revised ETA: ${selected.eta}.`
                          : `This container is arriving ${Math.abs(delayDays)} day(s) early. Revised ETA: ${selected.eta}.`
                        : delayDays > 0
                          ? `Shipment is ${delayDays} day(s) behind plan — downstream stock risks triggered.`
                          : `Shipment arriving ${Math.abs(delayDays)} day(s) early — overstock & receiving capacity risks triggered.`}
                    </p>
                  )}
                  {statusOnlyIntel && selected.eventStatus === 'on-time' && (
                    <p className="text-xs rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2">
                      On plan — no schedule change for this container.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailStep('route')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#4684AD]"
                >
                  Next: Touchpoints <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2 — Route / touchpoints */}
            {detailStep === 'route' && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-sm font-bold text-[#2F5472] flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Touchpoints — origin to DC
                </h3>
                <ol className="relative border-l-2 border-[#4684AD]/30 ml-2 space-y-5 pl-6">
                  {(['origin', 'ocean', 'customs', 'inland', 'dc_arrival'] as const).map((stage) => {
                    const active = selected.stage === stage;
                    const stageIdx = ['origin', 'ocean', 'customs', 'inland', 'dc_arrival'].indexOf(stage);
                    const currentIdx = ['origin', 'ocean', 'customs', 'inland', 'dc_arrival'].indexOf(selected.stage);
                    const passed = currentIdx >= stageIdx;
                    return (
                      <li key={stage} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[1.6rem] w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900',
                            active ? 'bg-[#4684AD]' : passed ? 'bg-blue-300' : 'bg-slate-200'
                          )}
                        />
                        <div className={cn('text-sm font-semibold', active && 'text-[#2F5472]')}>
                          {STAGE_LABELS[stage]}
                        </div>
                        {stage === 'customs' && (
                          <div className="text-xs text-slate-500 mt-0.5">Customs: {selected.customsStatus}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <div className="rounded-lg border p-3 text-xs space-y-1 bg-slate-50 dark:bg-slate-950/40">
                  <div><strong>Route:</strong> {selected.origin} → {selected.destination}</div>
                  <div><strong>Mode:</strong> {selected.transportMode}</div>
                </div>
                {!hideRisksAndActions && (
                  <button
                    type="button"
                    onClick={() => setDetailStep('risks')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#4684AD]"
                  >
                    Next: Business risks <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Step 3 — Risks with sub-wizard */}
            {detailStep === 'risks' && !hideRisksAndActions && (
              <div className="space-y-4">
                {riskSubSteps.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    No elevated risks — on-time delivery. Standard receiving plan applies.
                  </div>
                ) : (
                  <>
                    {riskSubStep === 'stock' && (
                      <StockRiskPanel
                        shipment={selected}
                        stockAction={stockAction}
                        persona={persona}
                        originalEta={ORIGINAL_ETA_ISO[selected.id]}
                        revisedEta={REVISED_ETA_ISO[selected.id]}
                        canApprove={canApproveAction(stockAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleStockApprove}
                      />
                    )}

                    {riskSubStep === 'sourcing' && (
                      <SourcingRiskPanel
                        shipment={selected}
                        sourcingAction={sourcingAction}
                        persona={persona}
                        canApprove={canApproveAction(sourcingAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleSourcingApprove}
                      />
                    )}

                    {riskSubStep === 'promotion' && !MVP_HIDE_PROMOTIONS && (
                      <PromotionRiskPanel
                        shipment={selected}
                        promoAction={promoAction}
                        persona={persona}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handlePromoApprove}
                      />
                    )}

                    {riskSubStep === 'shelf_life' && (
                      <ShelfLifePanel
                        shipment={selected}
                        shelfAction={shelfAction}
                        persona={persona}
                        canApprove={canApproveAction(shelfAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleShelfApprove}
                      />
                    )}

                    {riskSubStep === 'receiving' && (
                      <ReceivingRiskPanel
                        shipment={selected}
                        receivingAction={receivingAction}
                        persona={persona}
                        canApprove={canApproveAction(receivingAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleResourceApprove}
                      />
                    )}

                    {riskSubStep === 'transport' && (
                      <TransportRiskPanel
                        shipment={selected}
                        transportAction={transportAction}
                        persona={persona}
                        canApprove={canApproveAction(transportAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleResourceApprove}
                      />
                    )}

                    {riskSubStep === 'overstock' && (
                      <OverstockRiskPanel
                        shipment={selected}
                        overstockAction={overstockAction}
                        persona={persona}
                        canApprove={canApproveAction(overstockAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleResourceApprove}
                      />
                    )}

                    {riskSubStep === 'clearance' && (
                      <EarlyClearanceRiskPanel
                        shipment={selected}
                        clearanceAction={clearanceAction}
                        persona={persona}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handlePromoApprove}
                      />
                    )}

                    {riskSubStep === 'distribution' && (
                      <DistributionRiskPanel
                        shipment={selected}
                        distributionAction={distributionAction}
                        persona={persona}
                        canApprove={canApproveAction(distributionAction)}
                        hideApproval
                        onActionsUpdated={refreshActions}
                        onApprove={handleResourceApprove}
                      />
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDetailStep('actions')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#4684AD]"
                >
                  Next: Actions <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 4 — Actions */}
            {detailStep === 'actions' && !hideRisksAndActions && (
              <div className="space-y-4">
                {shipmentActions.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center border border-dashed rounded-xl">
                    No risk actions for this container.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {shipmentActions.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded-xl border p-4 space-y-2',
                          a.status === 'pending_approval'
                            ? 'border-amber-300 bg-amber-50/50'
                            : a.status === 'approved'
                              ? 'border-emerald-300 bg-emerald-50/50'
                              : 'border-slate-200'
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded text-white bg-[#2F5472]">
                            {a.category.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Owner: {PERSONA_LABELS[a.ownerPersona]}
                          </span>
                          {a.status === 'approved' && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
                        </div>
                        <h3 className="text-sm font-bold">{a.title}</h3>
                        <p className="text-xs text-slate-600">{a.summary}</p>
                        <p className="text-xs font-medium">{a.proposal}</p>
                        {a.status === 'pending_approval' && canPersonaApproveAction(a, persona) && (
                          <Link to="/actions" className="inline-flex items-center gap-1 text-xs font-bold text-[#4684AD] hover:underline">
                            Review in Actions <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>

            {detailStep === 'risks' && !hideRisksAndActions && activeRiskAction && (
              <RiskActionFooter
                action={activeRiskAction}
                persona={persona}
                onApprove={handleActiveRiskApprove}
                onReject={handleActiveRiskReject}
                ownerNote={activeRiskOwnerNote}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
