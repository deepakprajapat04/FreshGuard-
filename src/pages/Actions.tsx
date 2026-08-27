/**
 * Risk action queue — task list on the left, full proposal on the right.
 * Promo / early clearance are two-step: DC Purchasing → Category Manager.
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Maximize2,
  Megaphone,
  Minimize2,
  Package,
  Search,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import { contentCanvasClass } from '../lib/sapTheme';
import {
  approveRiskAction,
  rejectRiskAction,
  loadRiskActions,
  canPersonaApproveAction,
  getActionStatusLabel,
  getRiskActionContext,
  isCategoryTwoStepAction,
  selectSourcingSupplier,
  selectClearanceOption,
  EVENT_COLORS,
  EVENT_LABELS,
  type RiskAction,
  type RiskActionContext,
  type RiskCategory,
  PERSONA_LABELS,
} from '../lib/trackingFlow';

type StatusFilter = 'all' | 'pending' | 'approved';
type CategoryFilter = 'all' | RiskCategory;

const TASK_CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'stock', label: 'Stock' },
  { id: 'sourcing', label: 'Alt supplier' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'shelf_life', label: 'Shelf life' },
  { id: 'overstock', label: 'Overstock' },
  { id: 'clearance', label: 'Clearance' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'transport', label: 'Transport' },
  { id: 'distribution', label: 'Distribution' },
];

type ContainerTaskGroup = {
  key: string;
  containerNumber: string;
  shipmentId: string;
  eventStatus: RiskAction['eventStatus'];
  supplier: string;
  items: string[];
  linkedPos: string[];
  pendingCount: number;
  actions: RiskAction[];
};

function groupActionsByContainer(actions: RiskAction[]): ContainerTaskGroup[] {
  const map = new Map<string, ContainerTaskGroup>();
  for (const a of actions) {
    const ctx = getRiskActionContext(a);
    const container = ctx?.containerNumber || a.containerNumber || a.shipmentId || 'Unknown';
    const key = container;
    const existing = map.get(key);
    const pending =
      a.status === 'pending_approval' || a.status === 'pending_category_approval' ? 1 : 0;
    if (!existing) {
      map.set(key, {
        key,
        containerNumber: container,
        shipmentId: a.shipmentId,
        eventStatus: a.eventStatus,
        supplier: ctx?.supplier || a.supplier || '—',
        items: ctx?.items?.length ? [...ctx.items] : [...(a.items ?? [])],
        linkedPos: ctx?.linkedPos?.length ? [...ctx.linkedPos] : [...(a.linkedPos ?? [])],
        pendingCount: pending,
        actions: [a],
      });
    } else {
      existing.actions.push(a);
      existing.pendingCount += pending;
      for (const item of ctx?.items ?? a.items ?? []) {
        if (!existing.items.includes(item)) existing.items.push(item);
      }
      for (const po of ctx?.linkedPos ?? a.linkedPos ?? []) {
        if (!existing.linkedPos.includes(po)) existing.linkedPos.push(po);
      }
    }
  }

  const eventOrder = { delayed: 0, early: 1, 'on-time': 2 } as const;
  return Array.from(map.values()).sort((a, b) => {
    const eo = eventOrder[a.eventStatus] - eventOrder[b.eventStatus];
    if (eo !== 0) return eo;
    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
    return a.containerNumber.localeCompare(b.containerNumber);
  });
}

const CATEGORY_META: Record<RiskCategory, { label: string; icon: typeof Package; tone: string }> = {
  stock: { label: 'Stock', icon: Package, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  sourcing: {
    label: 'Alt supplier',
    icon: Package,
    tone: 'text-[#2F5472] bg-[#C0D5E5] border-[#86A8C2]',
  },
  promotion: { label: 'Promotion', icon: Megaphone, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  shelf_life: { label: 'Shelf life', icon: TrendingDown, tone: 'text-amber-800 bg-amber-50 border-amber-200' },
  receiving: { label: 'Receiving', icon: Users, tone: 'text-[#2F5472] bg-[#C0D5E5] border-[#86A8C2]' },
  transport: { label: 'Transport', icon: Truck, tone: 'text-[#2F5472] bg-[#C0D5E5] border-[#86A8C2]' },
  overstock: { label: 'Overstock', icon: TrendingUp, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  distribution: { label: 'Distribution', icon: Truck, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  clearance: { label: 'Clearance', icon: Megaphone, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActionSourceContext({
  ctx,
  compact = false,
}: {
  ctx: RiskActionContext;
  compact?: boolean;
}) {
  const poLabel =
    ctx.poSummaries.length > 0
      ? ctx.poSummaries.map((p) => p.po).join(', ')
      : ctx.linkedPos.join(', ') || '—';
  const itemLabel = ctx.items.length > 0 ? ctx.items.join(', ') : '—';

  if (compact) {
    return (
      <div className="mt-1.5 space-y-0.5 leading-snug">
        <div className="font-code text-xs font-semibold text-[#2F5472] dark:text-blue-300 truncate">
          {poLabel}
        </div>
        <div className="truncate text-xs text-slate-500">
          <span className="font-semibold text-slate-600 dark:text-slate-300">{ctx.supplier}</span>
          <span className="text-slate-300 mx-1">·</span>
          {itemLabel}
        </div>
        <div className="truncate text-xs font-code font-semibold text-slate-600 dark:text-slate-300">
          {ctx.containerNumber}
          {ctx.asnNumber ? (
            <span className="font-normal text-xs text-slate-500"> · {ctx.asnNumber}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#4684AD]/25 bg-[#C0D5E5]/20 dark:bg-blue-950/20 px-4 py-3 space-y-3">
      <div className="text-[10px] font-semibold uppercase text-[#2F5472] tracking-wide">
        Source shipment
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">Supplier</dt>
          <dd className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{ctx.supplier}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">Container</dt>
          <dd className="font-code font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
            {ctx.containerNumber}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">ASN</dt>
          <dd className="font-code text-slate-700 dark:text-slate-200 mt-0.5">{ctx.asnNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">Items</dt>
          <dd className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{itemLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">Volume</dt>
          <dd className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
            {ctx.totalQuantity.toLocaleString()} {ctx.unit}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">Destination</dt>
          <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{ctx.destination}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">ETA</dt>
          <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{ctx.eta}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">Shipment ID</dt>
          <dd className="font-code text-slate-500 mt-0.5">{ctx.shipmentId}</dd>
        </div>
      </dl>
      {ctx.poSummaries.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#4684AD]/15">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Linked purchase orders
          </div>
          <div className="space-y-2">
            {ctx.poSummaries.map((po) => (
              <div
                key={po.po}
                className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-code text-xs font-bold text-[#2F5472] dark:text-blue-300">
                    {po.po}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {po.lineCount} line{po.lineCount === 1 ? '' : 's'} ·{' '}
                    {po.orderedQty.toLocaleString()} {po.unit} {po.item}
                  </span>
                </div>
                {po.lineDescriptions.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {po.lineDescriptions.map((desc) => (
                      <li key={`${po.po}-${desc}`} className="truncate">
                        · {desc}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: RiskAction['status'] }) {
  return (
    <span
      className={cn(
        'text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0',
        status === 'pending_approval'
          ? 'bg-amber-100 text-amber-900 border-amber-200'
          : status === 'pending_category_approval'
            ? 'bg-violet-100 text-violet-900 border-violet-200'
            : status === 'approved'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      {getActionStatusLabel(status)}
    </span>
  );
}

function SectionTable({
  title,
  head,
  children,
}: {
  title: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
              {head.map((h) => (
                <th
                  key={h}
                  className={cn(
                    'px-3 py-2.5 font-semibold text-slate-500',
                    h === 'Cases' || h === 'Trucks' ? 'text-right' : ''
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function ActionDetailBody({
  action,
  onSelectSourcingSupplier,
  onSelectClearanceOption,
}: {
  action: RiskAction;
  onSelectSourcingSupplier?: (optionId: string) => void;
  onSelectClearanceOption?: (optionId: 'markdown' | 'schedule_promotion') => void;
}) {
  if (action.stockProposal) {
    return (
      <SectionTable title="Reallocation moves" head={['Type', 'From', '', 'To', 'Item', 'Cases']}>
        {action.stockProposal.moves.map((m, i) => (
          <tr key={`${m.fromLabel}-${m.toLabel}-${i}`}>
            <td className="px-3 py-2.5">
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                  m.type === 'dc_to_store'
                    ? 'bg-[#C0D5E5] text-[#2F5472]'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                )}
              >
                {m.type === 'dc_to_store' ? 'DC → store' : 'Store → store'}
              </span>
            </td>
            <td className="px-3 py-2.5 font-semibold">{m.fromLabel}</td>
            <td className="px-1 py-2.5 text-slate-300">
              <ArrowRight className="w-3.5 h-3.5" />
            </td>
            <td className="px-3 py-2.5 font-semibold">{m.toLabel}</td>
            <td className="px-3 py-2.5 text-slate-600">{m.item}</td>
            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">{m.cases}</td>
          </tr>
        ))}
      </SectionTable>
    );
  }

  if (action.sourcingProposal) {
    const p = action.sourcingProposal;
    const selected =
      p.options.find((o) => o.id === (p.selectedOptionId ?? p.recommendedOptionId)) ?? p.options[0];
    const canPick =
      action.status === 'pending_approval' && p.eligible && typeof onSelectSourcingSupplier === 'function';
    return (
      <div className="space-y-4">
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-xs',
            p.eligible ? 'border-amber-300 bg-amber-50/70' : 'border-slate-300 bg-slate-50'
          )}
        >
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Days configuration
          </div>
          <p className="mt-1 font-bold text-slate-900">
            Delay {p.delayDays}d · threshold ≥ {p.minDelayDaysConfig}d · alt ship ≤ {p.maxShipDaysConfig}d
          </p>
          <p className="mt-1 text-slate-600">
            Primary {p.primarySupplier} ({p.primaryPo}) · fill-in {p.fillInCases.toLocaleString()}{' '}
            {p.unit} {p.item}
          </p>
          {!p.eligible && p.ineligibleReason && (
            <p className="mt-2 font-medium text-slate-700">{p.ineligibleReason}</p>
          )}
          {p.issuedPo && (
            <p className="mt-2 font-bold text-emerald-800">Issued PO: {p.issuedPo}</p>
          )}
        </div>
        {p.options.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Alternate suppliers{canPick ? ' — tap to select' : ''}
            </h4>
            <div className="space-y-2">
              {p.options.map((o) => {
                const isSelected = o.id === selected?.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={!canPick}
                    onClick={() => onSelectSourcingSupplier?.(o.id)}
                    className={cn(
                      'w-full text-left rounded-lg border px-4 py-3 text-xs transition-colors',
                      isSelected
                        ? 'border-[#4684AD] bg-[#C0D5E5]/35 ring-1 ring-[#4684AD]/40'
                        : 'border-slate-200 bg-white hover:border-[#4684AD]/50',
                      !canPick && 'cursor-default opacity-90'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'w-3.5 h-3.5 rounded-full border-2 shrink-0',
                              isSelected
                                ? 'border-[#4684AD] bg-[#4684AD]'
                                : 'border-slate-300 bg-white'
                            )}
                          />
                          <span className="font-bold text-xs text-slate-900">{o.supplierName}</span>
                          {o.recommended && (
                            <span className="text-[10px] font-bold uppercase text-emerald-700">
                              Rec
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 mt-1 pl-5">{o.origin}</p>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="font-bold text-[#2F5472]">{o.shipDays}d</div>
                        <div>${o.pricePerCase.toFixed(2)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (action.promotionProposal) {
    const { reschedule, storeChanges } = action.promotionProposal;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Reschedule
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs mt-1.5">
            <span className="font-semibold">{reschedule.promoName}</span>
            <span className="tabular-nums text-slate-400 line-through">
              {formatShortDate(reschedule.originalStart)} → {formatShortDate(reschedule.originalEnd)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="tabular-nums font-bold text-[#2F5472]">
              {formatShortDate(reschedule.proposedStart)} → {formatShortDate(reschedule.proposedEnd)}
            </span>
          </div>
        </div>
        <SectionTable title="Store mix changes" head={['Action', 'Store', 'Promotion', 'Item']}>
          {storeChanges.map((c, i) => (
            <tr key={`${c.promoId}-${c.storeId}-${c.type}-${i}`}>
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                    c.type === 'remove'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  )}
                >
                  {c.type}
                </span>
              </td>
              <td className="px-3 py-2.5 font-semibold">{c.storeName}</td>
              <td className="px-3 py-2.5 text-slate-600">{c.promoName}</td>
              <td className="px-3 py-2.5 text-slate-600">{c.item}</td>
            </tr>
          ))}
        </SectionTable>
      </div>
    );
  }

  if (action.shelfLifeProposal) {
    return (
      <SectionTable
        title="Items on this batch"
        head={['PO', 'Item', 'Expires', 'Store shelf', 'OOS gap', 'Pricing']}
      >
        {action.shelfLifeProposal.lines.map((line) => (
          <tr key={line.po}>
            <td className="px-3 py-2.5 font-code text-xs text-[#2F5472]">{line.po}</td>
            <td className="px-3 py-2.5 font-semibold">{line.item}</td>
            <td className="px-3 py-2.5 tabular-nums text-slate-600">
              {formatShortDate(line.currentOnHandExpiresDate)}
            </td>
            <td className="px-3 py-2.5 tabular-nums font-semibold text-[#2F5472]">
              {formatShortDate(line.storeShelfDate)}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {line.oosGapDays > 0 ? (
                <span className="font-bold text-rose-700">{line.oosGapDays}d</span>
              ) : (
                <span className="text-emerald-700">—</span>
              )}
            </td>
            <td className="px-3 py-2.5">
              {line.markdownRecommended ? (
                <span className="font-medium text-amber-800">Markdown {line.markdownPercent}%</span>
              ) : (
                <span className="text-slate-500">Standard</span>
              )}
            </td>
          </tr>
        ))}
      </SectionTable>
    );
  }

  if (action.overstockProposal) {
    const p = action.overstockProposal;
    return (
      <div className="space-y-4">
        <div
          className={cn(
            'rounded-lg border px-4 py-3',
            p.hasStorageCapacity
              ? 'border-emerald-300 bg-emerald-50/70'
              : 'border-amber-300 bg-amber-50/70'
          )}
        >
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Capacity check
          </div>
          <p className="text-xs font-bold mt-1">
            {p.hasStorageCapacity
              ? 'Yes — capacity available → BAU (no stock action)'
              : 'No — capacity short → early replenishment + store notify'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {p.bayLabel} · {p.capacityPct}% · {p.freePalletSlots} free / {p.inboundPallets} inbound
            pallets · {p.earlyDays}d early
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Present stock vs early arrival
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="px-3 py-2.5">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">DC on hand</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">
                {p.presentStock.dcOnHandCases.toLocaleString()}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Store on hand</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">
                {p.presentStock.storeOnHandCases.toLocaleString()}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Ageing life</div>
              <div className="text-sm font-bold tabular-nums text-amber-800 mt-0.5">
                {p.presentStock.onHandShelfLifeDays}d
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">If held at DC</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">
                {p.projectedStock.dcIfHeldCases.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">
                {p.projectedStock.overflowCases > 0
                  ? `${p.projectedStock.overflowCases.toLocaleString()} overflow`
                  : `${p.projectedStock.dcDaysCoverIfHeld}d cover`}
              </div>
            </div>
          </div>
          <p className="px-3 py-2 text-xs text-slate-600 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
            {p.projectedStock.ageingBatchAction}
          </p>
        </div>

        <SectionTable title="Recommended steps" head={['#', 'Step', 'Owner']}>
          {p.handlingMeasures.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2.5 tabular-nums font-bold text-[#4684AD]">{m.step}</td>
              <td className="px-3 py-2.5">
                <div className="font-semibold">{m.title}</div>
                <div className="text-slate-500 mt-0.5">{m.action}</div>
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{m.owner}</td>
            </tr>
          ))}
        </SectionTable>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Storage cost</div>
            <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
              {p.storageCostNote}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              Shelf-life consequence
            </div>
            <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
              {p.shelfLifeConsequence}
            </p>
          </div>
        </div>
        <SectionTable
          title="New batch shelf life & DC hold"
          head={['PO', 'Item', 'New batch life', 'Max DC hold', 'Markdown']}
        >
          {p.batches.map((b) => (
            <tr key={b.po}>
              <td className="px-3 py-2.5 font-code text-xs text-[#2F5472]">{b.po}</td>
              <td className="px-3 py-2.5 font-semibold">{b.item}</td>
              <td className="px-3 py-2.5 tabular-nums font-bold text-emerald-700">
                {b.newBatchShelfLifeDays}d
              </td>
              <td className="px-3 py-2.5 tabular-nums font-bold text-[#2F5472]">
                {b.maxDcHoldDays}d
                <span className="text-slate-400 font-normal ml-1">(reco {b.recommendedDcHoldDays}d)</span>
              </td>
              <td className="px-3 py-2.5">
                {b.markdownPercent != null ? (
                  <span className="font-medium text-amber-800">{b.markdownPercent}%</span>
                ) : (
                  <span className="text-emerald-700">BAU</span>
                )}
              </td>
            </tr>
          ))}
        </SectionTable>
        {p.storePushes.length > 0 && (
          <SectionTable title="Early replenishment — notify stores" head={['Store', 'Item', 'Cases', 'Action']}>
            {p.storePushes.map((s) => (
              <tr key={`${s.storeId}-${s.item}`}>
                <td className="px-3 py-2.5 font-semibold">{s.storeName}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.item}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                  {s.cases}
                </td>
                <td className="px-3 py-2.5 text-amber-800 text-xs">
                  {s.notifyStore ? 'Notify — clear stock / arrange space' : '—'}
                </td>
              </tr>
            ))}
          </SectionTable>
        )}
      </div>
    );
  }

  if (action.distributionProposal) {
    const d = action.distributionProposal;
    return (
      <div className="space-y-4">
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-xs',
            d.hasStorageCapacity
              ? 'border-emerald-300 bg-emerald-50/70'
              : 'border-amber-300 bg-amber-50/70'
          )}
        >
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Tied to overstock
          </div>
          <p className="mt-1 font-medium text-slate-800">{d.notifyMessage}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Put away', value: d.putAwayCases.toLocaleString(), sub: 'DC slots' },
            { label: 'Overflow', value: d.overflowCases.toLocaleString(), sub: 'to stores' },
            {
              label: 'Ageing DC',
              value: d.ageingDcCases.toLocaleString(),
              sub: `${d.ageingShelfLifeDays}d · md ${d.markdownPercent ?? 0}%`,
            },
            { label: 'Extra routes', value: `${d.extraRoutes}`, sub: formatShortDate(d.revisedEta) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{s.label}</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{s.value}</div>
              <div className="text-xs text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>
        <SectionTable title="Recommended steps" head={['#', 'Step', 'Owner']}>
          {d.measures.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2.5 tabular-nums font-bold text-[#4684AD]">{m.step}</td>
              <td className="px-3 py-2.5">
                <div className="font-semibold">{m.title}</div>
                <div className="text-slate-500 mt-0.5">{m.action}</div>
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{m.owner}</td>
            </tr>
          ))}
        </SectionTable>
        {d.storeDeliveries.length > 0 && (
          <SectionTable title="Store deliveries" head={['Store', 'Item', 'Cases', 'Notify']}>
            {d.storeDeliveries.map((s) => (
              <tr key={`${s.storeId}-${s.item}`}>
                <td className="px-3 py-2.5 font-semibold">{s.storeName}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.item}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">{s.cases}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {s.notifyStore ? 'Yes — arrange space' : 'Stand-by'}
                </td>
              </tr>
            ))}
          </SectionTable>
        )}
      </div>
    );
  }

  if (action.clearanceProposal) {
    const c = action.clearanceProposal;
    const selectedId = c.selectedOptionId ?? c.recommendedOptionId;
    const canPick =
      (action.status === 'pending_approval' || action.status === 'pending_category_approval') &&
      typeof onSelectClearanceOption === 'function';
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50/70 px-4 py-3 text-xs">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Ageing stock to clear
          </div>
          <p className="mt-1 font-bold text-slate-900">
            {c.item}: {c.ageingDcCases.toLocaleString()} DC + {c.ageingStoreCases.toLocaleString()}{' '}
            store · {c.onHandShelfLifeDays}d left (exp {formatShortDate(c.onHandExpiresDate)})
          </p>
          <p className="mt-1 text-slate-600">
            Early inbound {formatShortDate(c.revisedEta)} ({c.earlyDays}d early)
            {canPick ? ' — tap a card to choose markdown or schedule promo.' : '.'}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {c.options.map((opt) => {
            const isRec = opt.id === c.recommendedOptionId;
            const isSelected = opt.id === selectedId;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!canPick}
                onClick={() => onSelectClearanceOption?.(opt.id)}
                className={cn(
                  'rounded-lg border px-4 py-3 space-y-2 text-xs text-left transition-colors',
                  isSelected
                    ? 'border-violet-400 bg-violet-50/50 ring-1 ring-violet-200'
                    : 'border-slate-200 hover:border-violet-300',
                  !canPick && 'cursor-default'
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'w-3.5 h-3.5 rounded-full border-2 shrink-0',
                      isSelected
                        ? 'border-violet-600 bg-violet-600'
                        : 'border-slate-300 bg-white'
                    )}
                  />
                  <span className="font-bold text-xs text-slate-900">{opt.title}</span>
                  {isRec && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                      Recommended
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#C0D5E5] text-[#2F5472]">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed">{opt.summary}</p>
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-500">
                    {opt.casesAffected.toLocaleString()} cases
                    {opt.markdownPercent != null ? ` · ${opt.markdownPercent}% md` : ''}
                    {opt.proposedStart && opt.proposedEnd
                      ? ` · ${formatShortDate(opt.proposedStart)}–${formatShortDate(opt.proposedEnd)}`
                      : ''}
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700">
                    ${opt.estimatedRecoveryUsd.toLocaleString()}
                  </span>
                </div>
                {opt.stores && opt.stores.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Stores: {opt.stores.map((s) => s.storeName).join(', ')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (action.receivingImpact) {
    const r = action.receivingImpact;
    return (
      <div className="space-y-4">
        {r.capacityNote && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 text-xs',
              r.hasStorageCapacity === false
                ? 'border-amber-300 bg-amber-50/70'
                : 'border-emerald-300 bg-emerald-50/70'
            )}
          >
            <div className="text-[10px] font-semibold uppercase text-slate-500">Tied to overstock</div>
            <p className="mt-1 font-medium">{r.capacityNote}</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Planned slot', value: formatShortDate(r.plannedSlot), sub: `door ${r.doorId}` },
            { label: 'Revised slot', value: formatShortDate(r.revisedSlot), sub: `${r.delayDays > 0 ? '+' : ''}${r.delayDays}d` },
            { label: 'Put away', value: `${r.putAwayPallets ?? r.pallets}`, sub: 'pallets to chill' },
            {
              label: 'Cross-dock',
              value: `${r.crossDockPallets ?? 0}`,
              sub:
                (r.crossDockCases ?? 0) > 0
                  ? `${r.crossDockCases!.toLocaleString()} cases`
                  : 'none',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{s.label}</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{s.value}</div>
              <div className="text-xs text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>
        <SectionTable title="Manpower steps" head={['When', 'Action', 'Why']}>
          {r.steps.map((step) => (
            <tr key={step.id}>
              <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-slate-600">
                {formatShortDate(step.when)}
              </td>
              <td className="px-3 py-2.5 font-semibold">{step.action}</td>
              <td className="px-3 py-2.5 text-slate-500">{step.detail}</td>
            </tr>
          ))}
        </SectionTable>
      </div>
    );
  }

  if (action.transportImpact) {
    const t = action.transportImpact;
    return (
      <div className="space-y-4">
        {t.capacityNote && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 text-xs',
              t.hasStorageCapacity === false
                ? 'border-amber-300 bg-amber-50/70'
                : 'border-emerald-300 bg-emerald-50/70'
            )}
          >
            <div className="text-[10px] font-semibold uppercase text-slate-500">Tied to overstock</div>
            <p className="mt-1 font-medium">{t.capacityNote}</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Planned pickup', value: formatShortDate(t.plannedPickup), sub: 'original booking' },
            { label: 'Revised pickup', value: formatShortDate(t.revisedPickup), sub: `${t.delayDays > 0 ? '+' : ''}${t.delayDays}d` },
            { label: 'Inbound trucks', value: `${t.trucksBooked}`, sub: `${t.cases.toLocaleString()} cases` },
            {
              label: 'Store-haul',
              value: `${t.storeHaulTrucks ?? 0}`,
              sub:
                (t.storeHaulCases ?? 0) > 0
                  ? `${t.storeHaulCases!.toLocaleString()} overflow`
                  : 'none — BAU',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{s.label}</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{s.value}</div>
              <div className="text-xs text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>
        {(t.storeHaulLegs?.length ?? 0) > 0 && (
          <SectionTable title="Outbound store haul" head={['Store', 'Item', 'Cases', 'Trucks']}>
            {t.storeHaulLegs!.map((l) => (
              <tr key={`${l.storeId}-${l.item}`}>
                <td className="px-3 py-2.5 font-semibold">{l.storeName}</td>
                <td className="px-3 py-2.5 text-slate-600">{l.item}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">{l.cases}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.trucks}</td>
              </tr>
            ))}
          </SectionTable>
        )}
        {t.reassignments.length > 0 && (
          <SectionTable title="Pull-forward / reassign" head={['Container', 'Item', 'Date', 'Trucks']}>
            {t.reassignments.map((r) => (
              <tr key={r.shipmentId}>
                <td className="px-3 py-2.5 font-semibold">{r.containerNumber}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.item}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600">{formatShortDate(r.date)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">{r.trucks}</td>
              </tr>
            ))}
          </SectionTable>
        )}
        <SectionTable title="Asset steps" head={['When', 'Action', 'Why']}>
          {t.steps.map((step) => (
            <tr key={step.id}>
              <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-slate-600">
                {formatShortDate(step.when)}
              </td>
              <td className="px-3 py-2.5 font-semibold">{step.action}</td>
              <td className="px-3 py-2.5 text-slate-500">{step.detail}</td>
            </tr>
          ))}
        </SectionTable>
      </div>
    );
  }

  return null;
}

export default function Actions() {
  const { persona } = usePersona();
  const { upsertMany } = useNotifications();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [flash, setFlash] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActions(loadRiskActions());
  }, []);

  const forPersona = useMemo(() => {
    if (persona === 'dc_purchasing') {
      return actions.filter(
        (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
      );
    }
    if (persona === 'category_manager') {
      return actions.filter(
        (a) =>
          a.status === 'pending_category_approval' ||
          (isCategoryTwoStepAction(a) &&
            a.notifyPersonas.includes('category_manager') &&
            a.status === 'approved')
      );
    }
    return actions.filter(
      (a) => a.ownerPersona === persona || a.notifyPersonas.includes(persona) || a.status === 'approved'
    );
  }, [actions, persona]);

  const pendingCount = forPersona.filter(
    (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
  ).length;
  const approvedCount = forPersona.filter((a) => a.status === 'approved').length;

  const visible = useMemo(() => {
    if (statusFilter === 'pending') {
      return forPersona.filter(
        (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
      );
    }
    if (statusFilter === 'approved') return forPersona.filter((a) => a.status === 'approved');
    return forPersona;
  }, [forPersona, statusFilter]);

  const filteredVisible = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return visible.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (!q) return true;
      const ctx = getRiskActionContext(a);
      const haystack = [
        a.title,
        a.shipmentId,
        a.id,
        a.proposal,
        a.supplier,
        a.containerNumber,
        a.asnNumber,
        ...(a.linkedPos ?? []),
        ...(a.items ?? []),
        ctx?.supplier,
        ctx?.containerNumber,
        ctx?.asnNumber,
        ...(ctx?.linkedPos ?? []),
        ...(ctx?.items ?? []),
        ...(ctx?.poSummaries.map((p) => `${p.po} ${p.item} ${p.supplier}`) ?? []),
        CATEGORY_META[a.category].label,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visible, taskSearch, categoryFilter]);

  const containerGroups = useMemo(
    () => groupActionsByContainer(filteredVisible),
    [filteredVisible]
  );

  useEffect(() => {
    if (containerGroups.length === 0) return;
    setExpandedContainers((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of containerGroups) {
        if (next[g.key] === undefined) {
          next[g.key] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [containerGroups]);

  useEffect(() => {
    if (filteredVisible.length === 0) {
      if (visible.length === 0) setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredVisible.some((a) => a.id === selectedId)) {
      setSelectedId(filteredVisible[0].id);
    }
  }, [filteredVisible, visible.length, selectedId]);

  const selected = filteredVisible.find((a) => a.id === selectedId) ?? null;
  const selectedContext = useMemo(
    () => (selected ? getRiskActionContext(selected) : null),
    [selected]
  );
  const siblingActions = useMemo(() => {
    if (!selected) return [];
    const ctx = getRiskActionContext(selected);
    const container = ctx?.containerNumber || selected.containerNumber || selected.shipmentId;
    return filteredVisible.filter((a) => {
      const c = getRiskActionContext(a);
      const key = c?.containerNumber || a.containerNumber || a.shipmentId;
      return key === container;
    });
  }, [selected, filteredVisible]);

  useEffect(() => {
    if (!selected) setDetailExpanded(false);
  }, [selected]);

  useEffect(() => {
    if (!detailExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailExpanded]);

  const onApprove = (id: string) => {
    const next = approveRiskAction(id, persona);
    if (!next) return;
    setActions(loadRiskActions());

    if (next.category === 'sourcing' && next.status === 'approved') {
      const po = next.sourcingProposal?.issuedPo;
      const alt = next.sourcingProposal?.options.find(
        (o) => o.id === next.sourcingProposal?.selectedOptionId
      );
      upsertMany(
        next.notifyPersonas.map((p) => ({
          id: `n-${next.id}-${p}`,
          title: po ? `New PO issued: ${po}` : `Action approved: ${next.title}`,
          message: po
            ? `${po} created for ${alt?.supplierName ?? 'alternate'} — ${next.proposal}`
            : `${next.proposal} — ${PERSONA_LABELS[p]} please execute.`,
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
    } else if (next.category === 'clearance' && next.status === 'pending_category_approval') {
      upsertMany([
        {
          id: `n-${next.id}-category-review`,
          title: `Clearance ready for approval: ${next.title}`,
          message: `${next.proposal} — Please choose markdown or schedule promotion.`,
          severity: 'info' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Sent to Category Manager for approval.');
    } else if (next.category === 'clearance' && next.status === 'approved') {
      upsertMany([
        {
          id: `n-${next.id}-confirmed`,
          title: `Clearance confirmed: ${next.title}`,
          message: `${next.proposal} — Apply markdown and/or schedule promo on calendar.`,
          severity: 'success' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Clearance plan approved — apply markdown and/or schedule promo.');
    } else if (next.category === 'promotion' && next.status === 'pending_category_approval') {
      upsertMany([
        {
          id: `n-${next.id}-category-review`,
          title: `Promo change ready for approval: ${next.title}`,
          message: `${next.proposal} — Please review and approve reschedule & store mix updates.`,
          severity: 'info' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Sent to Category Manager for approval.');
    } else if (next.category === 'promotion' && next.status === 'approved') {
      upsertMany([
        {
          id: `n-${next.id}-confirmed`,
          title: `Promo changes confirmed: ${next.title}`,
          message: `${next.proposal} — Updates applied to promo calendar & store allocations.`,
          severity: 'success' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Promo changes approved — POS & marketing updates confirmed.');
    } else {
      upsertMany(
        next.notifyPersonas.map((p) => ({
          id: `n-${next.id}-${p}`,
          title: `Action approved: ${next.title}`,
          message: `${next.proposal} — ${PERSONA_LABELS[p]} please execute.`,
          severity: 'info' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        }))
      );
      setFlash(`Approved. ${next.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')} notified.`);
    }
    setTimeout(() => setFlash(null), 5000);
  };

  const onReject = (id: string) => {
    rejectRiskAction(id, persona);
    setActions(loadRiskActions());
    setFlash('Proposal rejected.');
    setTimeout(() => setFlash(null), 3000);
  };

  const resetDemo = () => {
    localStorage.removeItem('freshguard-risk-actions-v11');
    localStorage.removeItem('freshguard-risk-actions-v12');
    localStorage.removeItem('freshguard-risk-actions-v13');
    setActions(loadRiskActions());
  };

  const canAct = selected ? canPersonaApproveAction(selected, persona) : false;

  return (
    <div
      className={cn(
        contentCanvasClass,
        'p-3 sm:p-4 w-full h-full min-h-0 mx-auto flex flex-col gap-3 overflow-hidden text-slate-900 dark:text-slate-100'
      )}
    >
      {!detailExpanded && (
        <PageHeader title="Risk Actions" className="shrink-0">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all' as const, label: 'All', count: forPersona.length },
                { id: 'pending' as const, label: 'Pending', count: pendingCount },
                { id: 'approved' as const, label: 'Approved', count: approvedCount },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  statusFilter === f.id
                    ? 'bg-[#4684AD] text-white border-[#4684AD]'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#4684AD]/40'
                )}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-80">{f.count}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetDemo}
              className="ml-2 text-xs font-semibold text-slate-400 hover:text-slate-700 underline"
            >
              Reset demo
            </button>
          </div>
        </PageHeader>
      )}

      {flash && (
        <div className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3 text-xs flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {flash}
        </div>
      )}

      <div
        className={cn(
          'flex-1 min-h-0 grid gap-3',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(260px,320px)_1fr]'
        )}
      >
        {/* Left — containers (pinned shell, scroll list) */}
        <section
          className={cn(
            'min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              <ClipboardList className="w-3.5 h-3.5" />
              Containers
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {containerGroups.length} container{containerGroups.length === 1 ? '' : 's'} ·{' '}
              {filteredVisible.length} action{filteredVisible.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="shrink-0 space-y-2 border-b border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search container, PO, supplier…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Risk type filter
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs font-medium"
              >
                {TASK_CATEGORY_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">No actions in your queue.</p>
            ) : filteredVisible.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">No tasks match your search or filters.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {containerGroups.map((group) => {
                  const open = expandedContainers[group.key] === true;
                  const hasSelected = group.actions.some((a) => a.id === selectedId);
                  return (
                    <div
                      key={group.key}
                      className={cn(hasSelected && 'bg-[#C0D5E5]/15 dark:bg-blue-950/10')}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedContainers((prev) => ({
                            ...prev,
                            [group.key]: !open,
                          }));
                          if (!hasSelected && group.actions[0]) {
                            setSelectedId(group.actions[0].id);
                          }
                        }}
                        className="w-full text-left px-3 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-slate-400">
                            {open ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-code text-xs font-bold text-[#2F5472] dark:text-blue-300">
                                {group.containerNumber}
                              </span>
                              <span
                                className={cn(
                                  'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                                  EVENT_COLORS[group.eventStatus]
                                )}
                              >
                                {EVENT_LABELS[group.eventStatus]}
                              </span>
                              {group.pendingCount > 0 && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                  {group.pendingCount} pending
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                              {group.supplier}
                              {group.items.length > 0 && ` · ${group.items.join(', ')}`}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {group.actions.length} risk action
                              {group.actions.length === 1 ? '' : 's'}
                              {group.linkedPos.length > 0 &&
                                ` · ${group.linkedPos.slice(0, 2).join(', ')}${
                                  group.linkedPos.length > 2
                                    ? ` +${group.linkedPos.length - 2}`
                                    : ''
                                }`}
                            </p>
                          </div>
                        </div>
                      </button>

                      {open && (
                        <div className="pb-2 pl-3 pr-2 space-y-0.5">
                          {group.actions.map((a) => {
                            const meta = CATEGORY_META[a.category];
                            const active = a.id === selectedId;
                            const pending =
                              a.status === 'pending_approval' ||
                              a.status === 'pending_category_approval';
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => setSelectedId(a.id)}
                                className={cn(
                                  'w-full text-left rounded-lg px-3 py-2 transition-colors border',
                                  active
                                    ? 'bg-white dark:bg-slate-900 border-[#4684AD] shadow-sm'
                                    : 'border-transparent hover:bg-white/80 dark:hover:bg-slate-900/60'
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                                      meta.tone
                                    )}
                                  >
                                    <meta.icon className="w-3 h-3" />
                                    {meta.label}
                                  </span>
                                  {pending ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  ) : a.status === 'approved' ? (
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  ) : null}
                                </div>
                                <div className="text-xs font-semibold mt-1 text-slate-800 dark:text-slate-100 leading-snug">
                                  {a.title}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right — detail (pinned header + tabs, scroll body, pinned approve) */}
        <section
          className={cn(
            'min-h-0 h-full rounded-xl border border-slate-200/90 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col overflow-hidden'
          )}
        >
          {!selected ? (
            <div className="flex items-center justify-center flex-1 text-xs text-slate-400">
              Select a task to see the proposal
            </div>
          ) : (
            <>
              <div className="shrink-0 z-20 flex flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {selectedContext && (
                        <span className="font-code font-bold text-[#2F5472] dark:text-blue-300">
                          {selectedContext.containerNumber}
                        </span>
                      )}
                      <span
                        className={cn(
                          'font-bold uppercase px-1.5 py-0.5 rounded border text-[10px]',
                          EVENT_COLORS[selected.eventStatus]
                        )}
                      >
                        {EVENT_LABELS[selected.eventStatus]}
                      </span>
                      {selectedContext && (
                        <span className="text-slate-500 truncate text-xs">
                          {selectedContext.supplier}
                          {selectedContext.items.length > 0 &&
                            ` · ${selectedContext.items.join(', ')}`}
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 leading-snug">
                      {selected.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed line-clamp-2">
                      {selected.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusChip status={selected.status} />
                    <button
                      type="button"
                      onClick={() => setDetailExpanded((v) => !v)}
                      className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-slate-500 hover:text-[#2F5472] hover:border-[#4684AD]/50 transition-colors"
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

                {siblingActions.length > 1 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1">
                    {siblingActions.map((a, idx) => {
                      const meta = CATEGORY_META[a.category];
                      const active = a.id === selected.id;
                      const pending =
                        a.status === 'pending_approval' ||
                        a.status === 'pending_category_approval';
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                            active
                              ? 'bg-[#4684AD] text-white border-[#4684AD]'
                              : 'bg-white dark:bg-slate-950 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-[#4684AD]/50'
                          )}
                        >
                          <span className="tabular-nums opacity-70">{idx + 1}</span>
                          <meta.icon className="w-2.5 h-2.5" />
                          {meta.label}
                          {pending && !active && (
                            <span className="w-1 h-1 rounded-full bg-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {selectedContext && <ActionSourceContext ctx={selectedContext} />}

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
                    Proposal
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {selected.proposal}
                  </p>
                </div>

                <ActionDetailBody
                  action={selected}
                  onSelectSourcingSupplier={
                    selected.category === 'sourcing' &&
                    selected.status === 'pending_approval' &&
                    persona === 'dc_purchasing'
                      ? (optionId) => {
                          selectSourcingSupplier(selected.id, optionId);
                          setActions(loadRiskActions());
                        }
                      : undefined
                  }
                  onSelectClearanceOption={
                    selected.category === 'clearance' &&
                    (selected.status === 'pending_approval' ||
                      selected.status === 'pending_category_approval') &&
                    (persona === 'dc_purchasing' || persona === 'category_manager')
                      ? (optionId) => {
                          selectClearanceOption(selected.id, optionId);
                          setActions(loadRiskActions());
                        }
                      : undefined
                  }
                />

                {selected.detail && (
                  <p className="text-xs text-slate-500 leading-relaxed">{selected.detail}</p>
                )}
              </div>

              <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Owner: <strong className="text-slate-700 dark:text-slate-300">{PERSONA_LABELS[selected.ownerPersona]}</strong>
                    {isCategoryTwoStepAction(selected) ? (
                      <> · Step 2: {PERSONA_LABELS.category_manager}</>
                    ) : (
                      <>
                        {' '}
                        · Notify:{' '}
                        {selected.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}
                      </>
                    )}
                  </p>
                  <Link
                    to="/"
                    className="text-xs font-semibold text-[#4684AD] hover:underline"
                  >
                    Open in Shipment Intelligence
                  </Link>
                </div>

                {canAct ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(selected.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-white shadow-sm',
                        persona === 'category_manager'
                          ? 'bg-violet-700 hover:bg-violet-800'
                          : 'bg-[#4684AD] hover:bg-[#3B7398]'
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {persona === 'category_manager'
                        ? selected.category === 'clearance'
                          ? 'Approve clearance'
                          : 'Approve promo'
                        : selected.category === 'sourcing'
                          ? 'Approve & create PO'
                          : isCategoryTwoStepAction(selected)
                            ? 'Approve → Category Mgr'
                            : 'Approve & notify'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(selected.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 text-xs font-bold uppercase tracking-wide hover:bg-slate-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                ) : selected.status === 'approved' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {selected.category === 'clearance'
                        ? 'Confirmed — apply markdown / promo.'
                        : selected.category === 'sourcing' && selected.sourcingProposal?.issuedPo
                          ? `Confirmed — ${selected.sourcingProposal.issuedPo} issued.`
                          : selected.category === 'promotion'
                            ? 'Confirmed — update POS & calendar.'
                            : 'Ready to execute.'}
                    </p>
                    {selected.category === 'sourcing' && selected.sourcingProposal?.issuedPo && (
                      <Link
                        to={`/orders?po=${encodeURIComponent(selected.sourcingProposal.issuedPo)}`}
                        className="text-xs font-semibold text-[#4684AD] hover:underline"
                      >
                        Track PO
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    Awaiting {PERSONA_LABELS[selected.approverPersona]}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
