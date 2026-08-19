/**
 * Track → Risk → Act — master-detail with step wizard detail panel.
 */
import { useEffect, useMemo, useState } from 'react';
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
  TrendingUp,
  Truck,
  Route,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass } from '../components/PageChrome';
import { usePersona, canApproveActions } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import { SAP } from '../lib/sapTheme';
import { StockRiskPanel } from '../components/tracking/StockRiskPanel';
import { PromotionRiskPanel } from '../components/tracking/PromotionRiskPanel';
import { ShelfLifePanel } from '../components/tracking/ShelfLifePanel';
import {
  DEMO_SHIPMENTS,
  EVENT_COLORS,
  EVENT_LABELS,
  loadRiskActions,
  getShipmentDelayDays,
  approveRiskAction,
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
type RiskSubStep = 'stock' | 'promotion' | 'shelf_life' | 'overstock';
type EventFilter = 'all' | ShipmentEventStatus;

const DETAIL_STEPS: { id: DetailStep; label: string; icon: typeof Package }[] = [
  { id: 'event', label: 'Event', icon: AlertTriangle },
  { id: 'route', label: 'Touchpoints', icon: Route },
  { id: 'risks', label: 'Risks', icon: TrendingDown },
  { id: 'actions', label: 'Actions', icon: ClipboardList },
];

const ORIGINAL_ETA_ISO: Record<string, string> = {
  'SHP-BB-DLY-01': '2026-08-21',
  'SHP-ST-EARLY-01': '2026-08-20',
  'SHP-BB-ONT-01': '2026-08-21',
};

const REVISED_ETA_ISO: Record<string, string> = {
  'SHP-BB-DLY-01': '2026-08-23',
  'SHP-ST-EARLY-01': '2026-08-19',
  'SHP-BB-ONT-01': '2026-08-21',
};

function getRiskSubSteps(shipment: TrackShipment): { id: RiskSubStep; label: string }[] {
  if (shipment.eventStatus === 'delayed') {
    return [
      { id: 'stock', label: 'Stock risk' },
      { id: 'promotion', label: 'Promotion risk' },
      { id: 'shelf_life', label: 'Shelf life' },
    ];
  }
  if (shipment.eventStatus === 'early') {
    return [{ id: 'overstock', label: 'Overstock risk' }];
  }
  return [];
}

export default function TrackingHub() {
  const { persona } = usePersona();
  const { upsertMany } = useNotifications();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [flash, setFlash] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(DEMO_SHIPMENTS[0].id);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
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
    setActions(loadRiskActions());
  }, []);

  const filteredShipments = useMemo(() => {
    return DEMO_SHIPMENTS.filter((s) => {
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
  }, [eventFilter, search]);

  const selected =
    filteredShipments.find((s) => s.id === selectedId) ||
    DEMO_SHIPMENTS.find((s) => s.id === selectedId) ||
    filteredShipments[0] ||
    DEMO_SHIPMENTS[0];

  const shipmentActions = actions.filter((a) => a.shipmentId === selected.id);
  const stockAction = shipmentActions.find((a) => a.category === 'stock');
  const promoAction = shipmentActions.find((a) => a.category === 'promotion');
  const shelfAction = shipmentActions.find((a) => a.category === 'shelf_life');
  const delayDays = getShipmentDelayDays(selected);
  const riskSubSteps = getRiskSubSteps(selected);

  const pendingForPersona = useMemo(() => {
    return actions.filter((a) => {
      if (a.status === 'pending_approval') {
        if (persona === 'dc_purchasing') return a.approverPersona === 'dc_purchasing';
        return false;
      }
      if (a.status === 'pending_category_approval') {
        return persona === 'category_manager' && a.category === 'promotion';
      }
      return false;
    });
  }, [actions, persona]);

  const canApprove = canApproveActions(persona);

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

  const notifyCategoryManagerForReview = (action: RiskAction) => {
    upsertMany([
      {
        id: `n-${action.id}-category-review`,
        title: `Promo change ready for approval: ${action.title}`,
        message: `${action.proposal} — Please review and approve reschedule & store mix updates.`,
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
    if (updated.status === 'pending_category_approval') {
      notifyCategoryManagerForReview(updated);
      setFlash('Sent to Category Manager for approval.');
    } else if (updated.status === 'approved') {
      upsertMany([
        {
          id: `n-${updated.id}-confirmed`,
          title: `Promo changes confirmed: ${updated.title}`,
          message: `${updated.proposal} — Updates applied to promo calendar & store allocations.`,
          severity: 'success' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Promo changes approved — POS & marketing updates confirmed.');
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

  const selectShipment = (id: string) => {
    setSelectedId(id);
    setDetailStep('event');
    const ship = DEMO_SHIPMENTS.find((s) => s.id === id);
    if (ship) {
      const subs = getRiskSubSteps(ship);
      if (subs.length) setRiskSubStep(subs[0].id);
    }
  };

  return (
    <div className={pageShellClass}>
      {!detailExpanded && (
        <PageHeader
          eyebrow="FreshGuard · Shipment intelligence"
          title="Track → Risk → Act"
        >
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Active lots" value={String(DEMO_SHIPMENTS.length)} tone="sap" />
          <StatCard
            label="Delayed"
            value={String(DEMO_SHIPMENTS.filter((s) => s.eventStatus === 'delayed').length)}
            tone="amber"
          />
          <StatCard
            label="Early"
            value={String(DEMO_SHIPMENTS.filter((s) => s.eventStatus === 'early').length)}
            tone="cyan"
          />
          <StatCard label="Actions pending" value={String(pendingForPersona.length)} tone="rose" />
        </div>
      )}

      <div
        className={cn(
          'grid gap-3 items-start',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(280px,340px)_1fr]'
        )}
      >
        {/* Master — container list (whole panel sticks with list) */}
        <section
          className={cn(
            'sticky top-0 self-start z-20 flex flex-col max-h-[calc(100vh-3.5rem)] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 px-4 py-3 text-[#4A7394] border-b border-slate-200/80 dark:border-slate-700" style={{ background: SAP.shellGradient }}>
            <h2 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Containers
            </h2>
          </div>

          <div className="shrink-0 p-3 space-y-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search container, PO, item…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#6A9EC8]/40"
            />
            <div className="flex flex-wrap gap-1">
              {(['all', 'delayed', 'early', 'on-time'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setEventFilter(f)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                    eventFilter === f
                      ? 'bg-[#6A9EC8] text-white border-[#6A9EC8]'
                      : 'border-slate-200 text-slate-500 hover:border-[#6A9EC8]/40'
                  )}
                >
                  {f === 'all' ? 'All' : EVENT_LABELS[f]}
                </button>
              ))}
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
                        ? 'bg-[#EDF3F9]/70 dark:bg-blue-950/30 border-l-4 border-l-[#6A9EC8]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-xs font-bold text-[#4A7394]">{s.containerNumber}</span>
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded border', EVENT_COLORS[s.eventStatus])}>
                        {EVENT_LABELS[s.eventStatus]}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-1">{s.item}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      ETA {s.eta}
                    </div>
                    <div className="text-[10px] text-slate-400 font-code mt-0.5">{s.linkedPos.join(' · ')}</div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Detail — step wizard */}
        <section
          className={cn(
            'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm',
            detailExpanded ? 'min-h-[calc(100vh-5rem)]' : 'min-h-[480px]'
          )}
        >
          {/* Sticky chrome — sticks when page scrolls past header/stats */}
          <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200/80 dark:border-slate-700">
            <div
              className="px-4 py-3 text-[#4A7394] flex items-start justify-between gap-3"
              style={{ backgroundColor: SAP.headerBg }}
            >
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide">Container detail</h2>
                <p className="font-code text-sm font-bold mt-0.5">{selected.containerNumber}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{selected.item} · {selected.supplier}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-[10px] font-bold uppercase px-2 py-1 rounded border', EVENT_COLORS[selected.eventStatus])}>
                  {EVENT_LABELS[selected.eventStatus]}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailExpanded((v) => !v)}
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-slate-500 hover:text-[#4A7394] hover:border-[#6A9EC8]/50 transition-colors"
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
              {DETAIL_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setDetailStep(step.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 whitespace-nowrap transition-colors',
                    detailStep === step.id
                      ? 'border-[#6A9EC8] text-[#6A9EC8] bg-[#EDF3F9]/40'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                      detailStep === step.id ? 'bg-[#6A9EC8] text-white' : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <step.icon className="w-3.5 h-3.5" />
                  {step.label}
                </button>
              ))}
            </div>

            {detailStep === 'risks' && riskSubSteps.length > 0 && (
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-950/95">
                <div className="flex flex-wrap gap-1">
                  {riskSubSteps.map((sub, idx) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setRiskSubStep(sub.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                        riskSubStep === sub.id
                          ? 'bg-[#6A9EC8] text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-700 hover:border-[#6A9EC8]/40'
                      )}
                    >
                      <span className="text-[10px] opacity-80">{idx + 1}.</span>
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            {/* Step 1 — Event */}
            {detailStep === 'event' && (
              <div className="space-y-4 max-w-2xl">
                <h3 className="text-sm font-bold text-[#4A7394] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  What happened
                </h3>
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-slate-400">Event</dt>
                      <dd className="font-semibold mt-0.5">{EVENT_LABELS[selected.eventStatus]}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-slate-400">ASN</dt>
                      <dd className="font-code mt-0.5">{selected.asnNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-slate-400">Original ETA</dt>
                      <dd className="mt-0.5">{selected.originalEta}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-slate-400">Current ETA</dt>
                      <dd className="mt-0.5 font-semibold text-[#4A7394]">{selected.eta}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-slate-400">Quantity</dt>
                      <dd className="mt-0.5">{selected.quantity.toLocaleString()} {selected.unit}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-slate-400">Linked POs</dt>
                      <dd className="font-code text-xs mt-0.5">{selected.linkedPos.join(', ')}</dd>
                    </div>
                  </dl>
                  {delayDays !== 0 && (
                    <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                      {delayDays > 0
                        ? `Shipment is ${delayDays} day(s) behind plan — downstream stock & promo risks triggered.`
                        : `Shipment arriving ${Math.abs(delayDays)} day(s) early — overstock & receiving capacity risks triggered.`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailStep('route')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#6A9EC8]"
                >
                  Next: Touchpoints <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2 — Route / touchpoints */}
            {detailStep === 'route' && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-sm font-bold text-[#4A7394] flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Touchpoints — origin to DC
                </h3>
                <ol className="relative border-l-2 border-[#6A9EC8]/30 ml-2 space-y-5 pl-6">
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
                            active ? 'bg-[#6A9EC8]' : passed ? 'bg-blue-300' : 'bg-slate-200'
                          )}
                        />
                        <div className={cn('text-sm font-semibold', active && 'text-[#4A7394]')}>
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
                <button
                  type="button"
                  onClick={() => setDetailStep('risks')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#6A9EC8]"
                >
                  Next: Business risks <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 3 — Risks with sub-wizard */}
            {detailStep === 'risks' && (
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
                        canApprove={canApprove}
                        onActionsUpdated={refreshActions}
                        onApprove={handleStockApprove}
                      />
                    )}

                    {riskSubStep === 'promotion' && (
                      <PromotionRiskPanel
                        shipment={selected}
                        promoAction={promoAction}
                        persona={persona}
                        onActionsUpdated={refreshActions}
                        onApprove={handlePromoApprove}
                      />
                    )}

                    {riskSubStep === 'shelf_life' && (
                      <ShelfLifePanel
                        shipment={selected}
                        shelfAction={shelfAction}
                        persona={persona}
                        canApprove={canApprove}
                        onActionsUpdated={refreshActions}
                        onApprove={handleShelfApprove}
                      />
                    )}

                    {riskSubStep === 'overstock' && (
                      <div className="space-y-3 max-w-lg">
                        <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                          <TrendingUp className="w-4 h-4" />
                          Possible overstock
                        </div>
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDetailStep('actions')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#6A9EC8]"
                >
                  Next: Actions <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 4 — Actions */}
            {detailStep === 'actions' && (
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
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded text-white bg-[#4A7394]">
                            {a.category.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Owner: {PERSONA_LABELS[a.ownerPersona]}
                          </span>
                          {a.status === 'approved' && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
                        </div>
                        <h3 className="text-sm font-bold">{a.title}</h3>
                        <p className="text-xs text-slate-600">{a.summary}</p>
                        <p className="text-xs font-medium">{a.proposal}</p>
                        {a.status === 'pending_approval' && canApprove && (
                          <Link to="/actions" className="inline-flex items-center gap-1 text-xs font-bold text-[#6A9EC8] hover:underline">
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
        </section>
      </div>
    </div>
  );
}
