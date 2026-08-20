/**
 * Shipment delay — stock risk: DC inventory, store orders, OOS, reallocation proposal & approval.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Package,
  TrendingDown,
  Truck,
  Warehouse,
  X,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SAP, btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  ReallocationMovesDrawer,
  sumReallocationCases,
} from './ReallocationMovesDrawer';
import {
  rejectRiskAction,
  buildStockRiskProposal,
  getActionStatusLabel,
  getShipmentEtaIso,
  STORE_TRANSIT_BUFFER_DAYS,
  type FreshGuardPersona,
  type ReallocationMove,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type StockRiskPanelProps = {
  shipment: TrackShipment;
  stockAction: RiskAction | undefined;
  persona: FreshGuardPersona;
  originalEta?: string;
  revisedEta?: string;
  canApprove: boolean;
  onActionsUpdated: () => void;
  onApprove?: (actionId: string) => void;
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000
  );
}

/** Compact inbound timing — DC arrival ≠ store shelf */
function InboundTimingStrip({
  originalDc,
  revisedDc,
  storeShelfDate,
  bufferDays,
  onHandShelfLifeDays,
  asOfDate,
  stockAtRiskDays,
  onHandExpiresDate,
}: {
  originalDc: string;
  revisedDc: string;
  storeShelfDate: string;
  bufferDays: number;
  onHandShelfLifeDays: number;
  asOfDate: string;
  stockAtRiskDays: number;
  onHandExpiresDate: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-slate-100 dark:divide-slate-800">
        <div className="px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            On-hand shelf life
          </div>
          <div className="text-lg font-bold tabular-nums text-emerald-700 mt-0.5">
            {onHandShelfLifeDays}d
          </div>
          <div className="text-[10px] text-slate-400">
            as of {formatShortDate(asOfDate)} → {formatShortDate(onHandExpiresDate)}
          </div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Planned DC
          </div>
          <div className="text-lg font-bold tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
            {formatShortDate(originalDc)}
          </div>
          <div className="text-[10px] text-slate-400">original ETA</div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            DC arrival
          </div>
          <div className="text-lg font-bold tabular-nums text-amber-800 mt-0.5">
            {formatShortDate(revisedDc)}
          </div>
          <div className="text-[10px] text-slate-400">current ETA</div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Store arrival
          </div>
          <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
            {formatShortDate(storeShelfDate)}
          </div>
          <div className="text-[10px] text-slate-400">
            DC + {bufferDays}d dock-to-shelf
          </div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Stock at risk
          </div>
          <div
            className={cn(
              'text-lg font-bold tabular-nums mt-0.5',
              stockAtRiskDays > 0 ? 'text-rose-700' : 'text-emerald-700'
            )}
          >
            {stockAtRiskDays > 0 ? `${stockAtRiskDays}d` : 'None'}
          </div>
          <div className="text-[10px] text-slate-400">
            {stockAtRiskDays > 0
              ? `gap ${formatShortDate(onHandExpiresDate)} → ${formatShortDate(storeShelfDate)}`
              : 'covered until store'}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Summary-only widget — full move list lives in the side drawer (scales to 50+). */
function MoveCategoryCard({
  title,
  icon: Icon,
  moves,
  accentClass,
  onViewDetails,
}: {
  title: string;
  icon: typeof Warehouse;
  moves: ReallocationMove[];
  accentClass: string;
  onViewDetails: () => void;
}) {
  const totalCases = sumReallocationCases(moves);

  if (moves.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-500">
        No {title.toLowerCase()} proposed.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
      <div className={cn('px-4 py-3 border-b border-slate-100 dark:border-slate-800', accentClass)}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-white/80 dark:bg-slate-900/80 shadow-sm">
            <Icon className="w-4 h-4 text-[#2F5472]" />
          </div>
          <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h5>
        </div>
        <dl className="flex gap-6 mt-3 text-xs">
          <div>
            <dt className="text-slate-500 uppercase text-[10px] font-semibold tracking-wide">Total moves</dt>
            <dd className="font-bold text-lg tabular-nums text-slate-900 dark:text-slate-100">{moves.length}</dd>
          </div>
          <div>
            <dt className="text-slate-500 uppercase text-[10px] font-semibold tracking-wide">Total cases</dt>
            <dd className="font-bold text-lg tabular-nums text-slate-900 dark:text-slate-100">{totalCases}</dd>
          </div>
        </dl>
      </div>

      <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-950/30 mt-auto">
        <button
          type="button"
          onClick={onViewDetails}
          className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#2F5472] hover:border-[#4684AD]/50 hover:bg-[#C0D5E5]/50 dark:hover:bg-slate-800 transition-colors"
        >
          <span>View details ({moves.length})</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function StockRiskPanel({
  shipment,
  stockAction,
  persona,
  originalEta,
  revisedEta,
  canApprove,
  onActionsUpdated,
  onApprove,
}: StockRiskPanelProps) {
  const proposal = useMemo(() => buildStockRiskProposal(shipment), [shipment]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'dc_to_store' | 'store_to_store'>('dc_to_store');

  const { original: originalDcIso, revised: revisedDcIso } = useMemo(
    () => getShipmentEtaIso(shipment),
    [shipment]
  );
  const storeArrivalIso = useMemo(
    () => addDaysIso(revisedDcIso, STORE_TRANSIT_BUFFER_DAYS),
    [revisedDcIso]
  );
  const onHandShelfLifeDays = useMemo(() => {
    const atRisk = proposal.storeOrders.filter((s) => s.stockoutRiskDays != null);
    const pool = atRisk.length ? atRisk : proposal.storeOrders;
    if (!pool.length) return 3;
    return Math.min(...pool.map((s) => s.onHandShelfLifeDays));
  }, [proposal.storeOrders]);

  /** Aug 21 + 3d shelf life → expires Aug 24; store Aug 25 → 1d stock at risk */
  const onHandExpiresDate = useMemo(
    () => addDaysIso(originalDcIso, onHandShelfLifeDays),
    [originalDcIso, onHandShelfLifeDays]
  );
  const stockAtRiskDays = useMemo(
    () => Math.max(0, daysBetween(onHandExpiresDate, storeArrivalIso)),
    [onHandExpiresDate, storeArrivalIso]
  );

  const dcMoves = useMemo(
    () => proposal.moves.filter((m) => m.type === 'dc_to_store'),
    [proposal.moves]
  );
  const storeMoves = useMemo(
    () => proposal.moves.filter((m) => m.type === 'store_to_store'),
    [proposal.moves]
  );

  const openDrawer = (tab: 'dc_to_store' | 'store_to_store') => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  const handleApprove = () => {
    if (!stockAction) return;
    onApprove?.(stockAction.id);
  };

  const handleReject = () => {
    if (!stockAction) return;
    rejectRiskAction(stockAction.id, persona);
    onActionsUpdated();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <TrendingDown className="w-4 h-4 text-rose-600" />
        Stock risk — delayed batch impact
      </div>

      <InboundTimingStrip
        originalDc={originalDcIso}
        revisedDc={revisedDcIso}
        storeShelfDate={storeArrivalIso}
        bufferDays={STORE_TRANSIT_BUFFER_DAYS}
        onHandShelfLifeDays={onHandShelfLifeDays}
        asOfDate={originalDcIso}
        stockAtRiskDays={stockAtRiskDays}
        onHandExpiresDate={onHandExpiresDate}
      />

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
          <Warehouse className="w-3.5 h-3.5" />
          DC available stock & dispatch rate
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-56 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">DC</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Available</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Dispatch / day</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">DC cover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {proposal.dcSnapshots.map((dc) => {
                const coverDays =
                  dc.dailyDispatchRate > 0 ? dc.availableStock / dc.dailyDispatchRate : 0;
                return (
                  <tr key={`${dc.dcId}-${dc.item}`}>
                    <td className="px-3 py-2.5 text-slate-600">{dc.name}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{dc.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                      {dc.availableStock}
                      <span className="font-normal text-slate-400 ml-1">{dc.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {dc.dailyDispatchRate}
                      <span className="text-slate-400 ml-1">{dc.unit}/d</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {coverDays.toFixed(1)}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          Store stock left
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">Store</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">On hand</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Cover left</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Stock at risk</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...proposal.storeOrders]
                .sort((a, b) => {
                  const aRisk = a.stockoutRiskDays != null ? 0 : 1;
                  const bRisk = b.stockoutRiskDays != null ? 0 : 1;
                  if (aRisk !== bRisk) return aRisk - bRisk;
                  return a.daysCover - b.daysCover;
                })
                .map((s) => {
                const expires = addDaysIso(originalDcIso, s.onHandShelfLifeDays);
                const atRiskDays = Math.max(0, daysBetween(expires, storeArrivalIso));
                const inboundCases = dcMoves
                  .filter((m) => m.storeToId === s.storeId)
                  .reduce((n, m) => n + m.cases, 0);
                const transferIn = storeMoves
                  .filter((m) => m.storeToId === s.storeId)
                  .reduce((n, m) => n + m.cases, 0);
                const transferOut = storeMoves
                  .filter((m) => m.storeFromId === s.storeId)
                  .reduce((n, m) => n + m.cases, 0);
                return (
                  <tr
                    key={s.storeId}
                    className={cn(
                      s.stockoutRiskDays != null || atRiskDays > 0
                        ? 'bg-rose-50/40 dark:bg-rose-950/10'
                        : s.daysCover >= 4
                          ? 'bg-emerald-50/25 dark:bg-emerald-950/10'
                          : ''
                    )}
                  >
                    <td className="px-3 py-2.5 font-semibold">{s.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{s.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.onHand}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {s.daysCover.toFixed(1)}d
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {s.stockoutRiskDays != null && atRiskDays > 0 ? (
                        <span className="font-bold text-rose-700">{atRiskDays}d</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.stockoutRiskDays != null ? (
                        <span className="font-medium text-rose-700 dark:text-rose-400">
                          Needs stock
                          {(inboundCases > 0 || transferIn > 0) && (
                            <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                              +{inboundCases + transferIn} cases inbound
                            </span>
                          )}
                        </span>
                      ) : s.daysCover >= 4 ? (
                        <span className="text-emerald-700 font-medium">
                          Can donate
                          {transferOut > 0 && (
                            <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                              −{transferOut} cases out
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#2F5472]" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Transfer plan — from → to
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openDrawer('dc_to_store')}
              className="text-[11px] font-semibold text-[#2F5472] hover:underline"
            >
              All DC moves ({dcMoves.length})
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => openDrawer('store_to_store')}
              className="text-[11px] font-semibold text-[#2F5472] hover:underline"
            >
              All inter-store ({storeMoves.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">Type</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">From</th>
                <th className="px-3 py-2.5 w-8" />
                <th className="px-3 py-2.5 font-semibold text-slate-500">To</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dcMoves.map((move, i) => (
                <tr key={`${move.type}-${move.fromLabel}-${move.toLabel}-${i}`}>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                        'bg-[#C0D5E5] text-[#2F5472]'
                      )}
                    >
                      DC → store
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{move.fromLabel}</td>
                  <td className="px-1 py-2.5 text-slate-300">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{move.toLabel}</td>
                  <td className="px-3 py-2.5 text-slate-600">{move.item}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                    {move.cases}
                  </td>
                </tr>
              ))}
              {storeMoves.map((move, i) => (
                <tr key={`${move.type}-${move.fromLabel}-${move.toLabel}-${i}`}>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800">
                      Store → store
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{move.fromLabel}</td>
                  <td className="px-1 py-2.5 text-slate-300">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{move.toLabel}</td>
                  <td className="px-3 py-2.5 text-slate-600">{move.item}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                    {move.cases}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800">
          <MoveCategoryCard
            title="DC reallocation"
            icon={Warehouse}
            moves={dcMoves}
            accentClass="bg-[#C0D5E5]/60 dark:bg-slate-800/50"
            onViewDetails={() => openDrawer('dc_to_store')}
          />
          <MoveCategoryCard
            title="Inter-store transfer"
            icon={ArrowRightLeft}
            moves={storeMoves}
            accentClass="bg-slate-50 dark:bg-slate-950/50"
            onViewDetails={() => openDrawer('store_to_store')}
          />
        </div>

        {stockAction && (
          <div className="mx-4 mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Approval workflow
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded',
                  stockAction.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : stockAction.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                )}
              >
                {getActionStatusLabel(stockAction.status)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Owner: <strong>{PERSONA_LABELS[stockAction.ownerPersona]}</strong> · Notify on approval:{' '}
              {stockAction.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}
            </p>

            {stockAction.status === 'pending_approval' && canApprove && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={handleApprove} className={btnPrimaryClass}>
                  <Check className="w-3.5 h-3.5" />
                  Approve & notify delivery team
                </button>
                <button type="button" onClick={handleReject} className={btnSecondaryClass}>
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {stockAction.status === 'pending_approval' && !canApprove && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Awaiting DC Purchasing approval.
              </p>
            )}

            {stockAction.status === 'approved' && (
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Approved — delivery team notified to execute moves.
              </p>
            )}

            <Link
              to="/actions"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4684AD] hover:underline"
            >
              View full actions queue
            </Link>
          </div>
        )}
      </section>

      <ReallocationMovesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        moves={proposal.moves}
        initialTab={drawerTab}
      />
    </div>
  );
}
