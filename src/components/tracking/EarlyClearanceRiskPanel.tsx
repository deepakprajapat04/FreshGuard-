/**
 * Early arrival clearance — markdown OR schedule promotion for Category Manager.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Check, Megaphone, Percent, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { btnPrimaryClass, btnSecondaryClass, btnVioletClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildEarlyClearanceProposal,
  selectClearanceOption,
  canPersonaApproveAction,
  getActionStatusLabel,
  isDcPurchasingPersona,
  type EarlyClearanceProposal,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type EarlyClearanceRiskPanelProps = {
  shipment: TrackShipment;
  clearanceAction: RiskAction | undefined;
  persona: FreshGuardPersona;
  hideApproval?: boolean;
  onActionsUpdated: () => void;
  onApprove?: (actionId: string) => void;
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EarlyClearanceRiskPanel({
  shipment,
  clearanceAction,
  persona,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: EarlyClearanceRiskPanelProps) {
  const live = useMemo(() => buildEarlyClearanceProposal(shipment), [shipment]);
  const proposal: EarlyClearanceProposal | null =
    clearanceAction?.clearanceProposal ?? live;

  const [selectedId, setSelectedId] = useState<'markdown' | 'schedule_promotion' | null>(null);

  useEffect(() => {
    setSelectedId(
      clearanceAction?.clearanceProposal?.selectedOptionId ??
        proposal?.selectedOptionId ??
        proposal?.recommendedOptionId ??
        null
    );
  }, [
    shipment.id,
    clearanceAction?.id,
    clearanceAction?.clearanceProposal?.selectedOptionId,
    proposal?.selectedOptionId,
    proposal?.recommendedOptionId,
  ]);

  const canAct = clearanceAction ? canPersonaApproveAction(clearanceAction, persona) : false;

  if (!proposal) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
        No clearance proposal — capacity covers early inbound (BAU). Markdown / promo not required.
      </div>
    );
  }

  const effectiveSelectedId =
    selectedId ?? proposal.selectedOptionId ?? proposal.recommendedOptionId;
  const canSelect =
    (isDcPurchasingPersona(persona) || persona === 'category_manager') &&
    (!clearanceAction ||
      clearanceAction.status === 'pending_approval' ||
      clearanceAction.status === 'pending_category_approval');

  const handleSelect = (optionId: 'markdown' | 'schedule_promotion') => {
    if (!canSelect) return;
    setSelectedId(optionId);
    if (clearanceAction) {
      selectClearanceOption(clearanceAction.id, optionId);
      onActionsUpdated();
    }
  };

  const handleApprove = () => {
    if (!clearanceAction || !onApprove) return;
    if (effectiveSelectedId) {
      selectClearanceOption(clearanceAction.id, effectiveSelectedId);
    }
    onApprove(clearanceAction.id);
  };

  const handleReject = () => {
    if (!clearanceAction) return;
    rejectRiskAction(clearanceAction.id, persona);
    onActionsUpdated();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Megaphone className="w-4 h-4 text-violet-700" />
        Clear ageing stock — markdown or schedule promotion
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Why clear now
        </div>
        <p className="text-sm font-bold mt-1 text-slate-900 dark:text-slate-100">
          {proposal.item}: {proposal.ageingDcCases.toLocaleString()} DC +{' '}
          {proposal.ageingStoreCases.toLocaleString()} store cases · {proposal.onHandShelfLifeDays}d
          life left (exp {formatShortDate(proposal.onHandExpiresDate)})
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          Early inbound arrives {formatShortDate(proposal.revisedEta)} ({proposal.earlyDays}d early).
          Capacity is short — clear ageing stock before put-away / store push. Category Manager
          sign-off required. Tap a card below to choose markdown or promo.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Clearance options">
        {proposal.options.map((opt) => {
          const isRec = opt.id === proposal.recommendedOptionId;
          const isSelected = opt.id === effectiveSelectedId;
          const Icon = opt.id === 'markdown' ? Percent : Megaphone;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!canSelect}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                'flex h-full flex-col items-stretch justify-start rounded-lg border overflow-hidden bg-white dark:bg-slate-900 p-0 text-left transition-colors',
                isSelected
                  ? 'border-violet-400 ring-1 ring-violet-200 dark:ring-violet-900'
                  : 'border-slate-200 dark:border-slate-700 hover:border-violet-300',
                !canSelect && 'opacity-90 cursor-default'
              )}
            >
              <div
                className={cn(
                  'px-4 py-3 border-b flex items-start gap-2 shrink-0',
                  isSelected
                    ? 'bg-violet-50/80 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900'
                    : 'bg-slate-50/80 dark:bg-slate-950/40 border-slate-100 dark:border-slate-800'
                )}
              >
                <span
                  className={cn(
                    'mt-1 w-3.5 h-3.5 rounded-full border-2 shrink-0',
                    isSelected
                      ? 'border-violet-600 bg-violet-600'
                      : 'border-slate-300 bg-white'
                  )}
                />
                <div className="p-1.5 rounded-md bg-white/90 dark:bg-slate-900 shadow-sm">
                  <Icon className="w-4 h-4 text-[#2F5472]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {opt.title}
                    </h5>
                    {isRec && (
                      <span className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                        Recommended
                      </span>
                    )}
                    {isSelected && (
                      <span className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#C0D5E5] text-[#2F5472]">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {opt.summary}
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2 text-xs flex-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Cases</span>
                  <span className="font-bold tabular-nums">{opt.casesAffected.toLocaleString()}</span>
                </div>
                {opt.markdownPercent != null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Markdown</span>
                    <span className="font-bold text-amber-800">{opt.markdownPercent}%</span>
                  </div>
                )}
                {opt.promoName && opt.proposedStart && opt.proposedEnd && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Promo window</span>
                    <span className="font-bold tabular-nums text-[#2F5472]">
                      {formatShortDate(opt.proposedStart)} → {formatShortDate(opt.proposedEnd)}
                    </span>
                  </div>
                )}
                {opt.stores && opt.stores.length > 0 && (
                  <div>
                    <div className="text-slate-500 mb-1">Stores</div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {opt.stores.map((s) => s.storeName).join(', ')}
                    </p>
                  </div>
                )}
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Est. recovery</span>
                  <span className="font-bold tabular-nums text-emerald-700">
                    ${opt.estimatedRecoveryUsd.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed pt-1">{opt.reason}</p>
              </div>
            </button>
          );
        })}
      </div>

      {clearanceAction && !hideApproval && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Approval
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold uppercase px-2 py-0.5 rounded border',
                clearanceAction.status === 'pending_approval' ||
                  clearanceAction.status === 'pending_category_approval'
                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : clearanceAction.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
              )}
            >
              {getActionStatusLabel(clearanceAction.status)}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Owner: <strong>{PERSONA_LABELS[clearanceAction.ownerPersona]}</strong>
            {clearanceAction.status === 'pending_approval' && ' · then Category Manager'}
            {clearanceAction.status === 'pending_category_approval' &&
              ` · awaiting ${PERSONA_LABELS.category_manager}`}
            {' · '}
            Plan:{' '}
            <strong>
              {effectiveSelectedId === 'markdown' ? 'Markdown' : 'Schedule promotion'}
            </strong>
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
                Approve clearance plan
              </button>
              <button type="button" onClick={handleReject} className={btnSecondaryClass}>
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          )}

          {clearanceAction.status === 'pending_approval' && persona === 'category_manager' && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Awaiting {PERSONA_LABELS[clearanceAction.approverPersona]}.
            </p>
          )}

          {clearanceAction.status === 'pending_category_approval' && isDcPurchasingPersona(persona) && (
            <p className="text-xs text-violet-800 font-medium flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Sent to Category Manager.
            </p>
          )}

          {clearanceAction.status === 'approved' && (
            <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Fully approved — apply the selected clearance plan.
            </p>
          )}

          <Link
            to="/actions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4684AD] hover:underline"
          >
            Open in Risk Actions
          </Link>
        </div>
      )}

      {!clearanceAction && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-xs text-amber-950 space-y-2">
          <p className="font-semibold">Approval task not loaded yet</p>
          <p className="text-amber-900/80 leading-relaxed">
            Open <Link to="/actions" className="font-bold underline">Risk Actions</Link>, click{' '}
            <strong>Reset demo</strong>, then return here — Approve appears below these options
            (DC Purchasing first, then Category Manager).
          </p>
        </div>
      )}
    </div>
  );
}
