/**
 * Shipment delay — promotion risk (compact, stock-risk style).
 * Summary on page; full store-mix detail in side drawer.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Megaphone,
  MinusCircle,
  PlusCircle,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SAP, btnPrimaryClass, btnSecondaryClass, btnVioletClass } from '../../lib/sapTheme';
import { PromotionStoreMixDrawer } from './PromotionStoreMixDrawer';
import {
  rejectRiskAction,
  buildPromotionRiskProposal,
  canPersonaApproveAction,
  getActionStatusLabel,
  isDcPurchasingPersona,
  type FreshGuardPersona,
  type PromotionStoreChange,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type PromotionRiskPanelProps = {
  shipment: TrackShipment;
  promoAction: RiskAction | undefined;
  persona: FreshGuardPersona;
  hideApproval?: boolean;
  onActionsUpdated: () => void;
  onApprove?: (actionId: string) => void;
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChangeSummaryCard({
  title,
  icon: Icon,
  count,
  accentClass,
  countClass,
  onViewDetails,
}: {
  title: string;
  icon: typeof MinusCircle;
  count: number;
  accentClass: string;
  countClass: string;
  onViewDetails: () => void;
}) {
  if (count === 0) {
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
        <dl className="mt-3 text-xs">
          <dt className="text-slate-500 uppercase text-[10px] font-semibold tracking-wide">Stores</dt>
          <dd className={cn('font-bold text-lg tabular-nums', countClass)}>{count}</dd>
        </dl>
      </div>
      <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-950/30 mt-auto">
        <button
          type="button"
          onClick={onViewDetails}
          className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-[#2F5472] hover:border-[#4684AD]/50 hover:bg-[#C0D5E5]/50 dark:hover:bg-slate-800 transition-colors"
        >
          <span>View details ({count})</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function PromotionRiskPanel({
  shipment,
  promoAction,
  persona,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: PromotionRiskPanelProps) {
  const proposal = useMemo(() => buildPromotionRiskProposal(shipment), [shipment]);
  const canAct = promoAction ? canPersonaApproveAction(promoAction, persona) : false;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'remove' | 'add'>('remove');

  const removeChanges = useMemo(
    () => proposal.storeChanges.filter((c) => c.type === 'remove'),
    [proposal.storeChanges]
  );
  const addChanges = useMemo(
    () => proposal.storeChanges.filter((c) => c.type === 'add'),
    [proposal.storeChanges]
  );

  const shiftDays =
    Math.round(
      (new Date(`${proposal.reschedule.proposedStart}T12:00:00`).getTime() -
        new Date(`${proposal.reschedule.originalStart}T12:00:00`).getTime()) /
        86400000
    ) || 2;

  const openDrawer = (tab: 'remove' | 'add' = 'remove') => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  const handleApprove = () => {
    if (!promoAction) return;
    onApprove?.(promoAction.id);
  };

  const handleReject = () => {
    if (!promoAction) return;
    rejectRiskAction(promoAction.id, persona);
    onActionsUpdated();
  };

  const previewChanges: PromotionStoreChange[] = [
    ...removeChanges.slice(0, 3),
    ...addChanges.slice(0, 2),
  ].slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Megaphone className="w-4 h-4 text-violet-600" />
        Promotion risk — batch-dependent campaigns
      </div>

      {/* Timing strip — mirrors stock-risk inbound strip */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Planned DC
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
              {formatShortDate(proposal.originalEta)}
            </div>
            <div className="text-[10px] text-slate-400">original ETA</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              DC arrival
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-800 mt-0.5">
              {formatShortDate(proposal.revisedEta)}
            </div>
            <div className="text-[10px] text-slate-400">current ETA</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Promos at risk
            </div>
            <div className="text-lg font-bold tabular-nums text-violet-700 mt-0.5">
              {proposal.promotions.filter((p) => p.atRisk).length}
            </div>
            <div className="text-[10px] text-slate-400">
              of {proposal.promotions.length} on this batch
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Store changes
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {proposal.storeChanges.length}
            </div>
            <div className="text-[10px] text-slate-400">
              {removeChanges.length} remove · {addChanges.length} add
            </div>
          </div>
        </div>
      </div>

      {/* Compact promo list */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          Promotions on this batch
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">Promotion</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Window</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Stores</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {proposal.promotions.map((p) => (
                <tr
                  key={p.id}
                  className={p.atRisk ? 'bg-violet-50/40 dark:bg-violet-950/10' : undefined}
                >
                  <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    {p.name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{p.item}</td>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                    {formatShortDate(p.startDate)} → {formatShortDate(p.endDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {p.stores.length}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.atRisk ? (
                      <span className="font-medium text-violet-700 dark:text-violet-400">At risk</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">On track</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Proposed plan */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Proposed plan — reschedule & store mix
          </h4>
          <button
            type="button"
            onClick={() => openDrawer('remove')}
            className="text-[11px] font-semibold text-[#2F5472] hover:underline"
          >
            All store changes ({proposal.storeChanges.length})
          </button>
        </div>

        {/* Option A — one compact row */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide mb-2">
            Reschedule
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {proposal.reschedule.promoName}
            </span>
            <span className="tabular-nums text-slate-400 line-through">
              {formatShortDate(proposal.reschedule.originalStart)} →{' '}
              {formatShortDate(proposal.reschedule.originalEnd)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="tabular-nums font-bold text-[#2F5472]">
              {formatShortDate(proposal.reschedule.proposedStart)} →{' '}
              {formatShortDate(proposal.reschedule.proposedEnd)}
            </span>
            <span className="text-[10px] font-semibold text-[#2F5472] bg-[#C0D5E5] px-1.5 py-0.5 rounded">
              +{shiftDays}d
            </span>
          </div>
        </div>

        {/* Store mix preview table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">Action</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Store</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Promotion</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {previewChanges.map((change, i) => (
                <tr key={`${change.promoId}-${change.storeId}-${change.type}-${i}`}>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                        change.type === 'remove'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      )}
                    >
                      {change.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{change.storeName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{change.promoName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{change.item}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800">
          <ChangeSummaryCard
            title="Stores to remove"
            icon={MinusCircle}
            count={removeChanges.length}
            accentClass="bg-rose-50/50 dark:bg-rose-950/20"
            countClass="text-rose-700"
            onViewDetails={() => openDrawer('remove')}
          />
          <ChangeSummaryCard
            title="Stores to add"
            icon={PlusCircle}
            count={addChanges.length}
            accentClass="bg-emerald-50/50 dark:bg-emerald-950/20"
            countClass="text-emerald-700"
            onViewDetails={() => openDrawer('add')}
          />
        </div>

        {promoAction && !hideApproval && (
          <div className="mx-4 mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Approval
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded border',
                  promoAction.status === 'pending_approval' ||
                    promoAction.status === 'pending_category_approval'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : promoAction.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {getActionStatusLabel(promoAction.status)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Owner: <strong>{PERSONA_LABELS[promoAction.ownerPersona]}</strong>
              {promoAction.status === 'pending_approval' && ' · then Category Manager'}
              {promoAction.status === 'pending_category_approval' &&
                ` · awaiting ${PERSONA_LABELS.category_manager}`}
            </p>

            {canAct && isDcPurchasingPersona(persona) && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={handleApprove} className={btnPrimaryClass}>
                  <Check className="w-3.5 h-3.5" />
                  Approve & send to Category Manager
                </button>
                <button type="button" onClick={handleReject} className={btnSecondaryClass}>
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {canAct && persona === 'category_manager' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={handleApprove} className={btnVioletClass}>
                  <Check className="w-3.5 h-3.5" />
                  Approve promo changes
                </button>
                <button type="button" onClick={handleReject} className={btnSecondaryClass}>
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {promoAction.status === 'pending_approval' && persona === 'category_manager' && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Awaiting {PERSONA_LABELS[promoAction.approverPersona]}.
              </p>
            )}

            {promoAction.status === 'pending_category_approval' && isDcPurchasingPersona(persona) && (
              <p className="text-xs text-violet-800 font-medium flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Sent to Category Manager.
              </p>
            )}

            {promoAction.status === 'approved' && (
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Fully approved — promo calendar & store mix updated.
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

      <PromotionStoreMixDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        changes={proposal.storeChanges}
        initialTab={drawerTab}
      />
    </div>
  );
}
