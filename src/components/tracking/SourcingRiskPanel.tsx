/**
 * Delayed container — choose alternate supplier and create a fill-in PO.
 * Eligibility is driven by Business Rules day thresholds.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Check, PackagePlus, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildSourcingProposal,
  selectSourcingSupplier,
  getActionStatusLabel,
  canPersonaApproveAction,
  getShipmentPurchasingPersona,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type SourcingRiskPanelProps = {
  shipment: TrackShipment;
  sourcingAction: RiskAction | undefined;
  persona: FreshGuardPersona;
  canApprove: boolean;
  hideApproval?: boolean;
  onActionsUpdated: () => void;
  onApprove?: (actionId: string) => void;
};

export function SourcingRiskPanel({
  shipment,
  sourcingAction,
  persona,
  canApprove,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: SourcingRiskPanelProps) {
  const live = useMemo(() => buildSourcingProposal(shipment), [shipment]);
  const proposal = sourcingAction?.sourcingProposal ?? live;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(
      sourcingAction?.sourcingProposal?.selectedOptionId ??
        proposal?.selectedOptionId ??
        proposal?.recommendedOptionId ??
        null
    );
  }, [
    shipment.id,
    sourcingAction?.id,
    sourcingAction?.sourcingProposal?.selectedOptionId,
    proposal?.selectedOptionId,
    proposal?.recommendedOptionId,
  ]);

  const canAct =
    sourcingAction && canApprove
      ? canPersonaApproveAction(sourcingAction, persona)
      : false;

  if (!proposal) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
        {shipment.eventStatus !== 'delayed'
          ? 'Alternate supplier is only available on delayed containers.'
          : 'Alternate supplier data is loading — refresh the page or open Risk Actions and click Reset demo.'}
      </div>
    );
  }

  const buyerPersona = getShipmentPurchasingPersona(shipment);
  const effectiveSelectedId =
    selectedId ?? proposal.selectedOptionId ?? proposal.recommendedOptionId;
  const selected = proposal.options.find((o) => o.id === effectiveSelectedId);
  const canSelect =
    proposal.eligible &&
    persona === buyerPersona &&
    (!sourcingAction || sourcingAction.status === 'pending_approval');

  const handleSelect = (optionId: string) => {
    if (!canSelect) return;
    setSelectedId(optionId);
    if (sourcingAction) {
      selectSourcingSupplier(sourcingAction.id, optionId);
      onActionsUpdated();
    }
  };

  const handleApprove = () => {
    if (!sourcingAction || !onApprove) return;
    if (effectiveSelectedId) {
      selectSourcingSupplier(sourcingAction.id, effectiveSelectedId);
    }
    onApprove(sourcingAction.id);
  };

  const handleReject = () => {
    if (!sourcingAction) return;
    rejectRiskAction(sourcingAction.id, persona);
    onActionsUpdated();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <PackagePlus className="w-4 h-4 text-[#2F5472]" />
        Alternate supplier — create new PO
      </div>

      <div
        className={cn(
          'rounded-lg border px-4 py-3',
          proposal.eligible
            ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20'
            : 'border-slate-300 bg-slate-50 dark:bg-slate-950/40'
        )}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Days configuration
        </div>
        <p className="text-sm font-bold mt-1 text-slate-900 dark:text-slate-100">
          Delay {proposal.delayDays}d · offer when ≥ {proposal.minDelayDaysConfig}d · alt ship ≤{' '}
          {proposal.maxShipDaysConfig}d
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          Primary: {proposal.primarySupplier} on {proposal.primaryPo}. Fill-in{' '}
          {proposal.fillInCases.toLocaleString()} {proposal.unit} of {proposal.item}
          {proposal.shortageCases > 0
            ? ` · projected shortage ${proposal.shortageCases.toLocaleString()} cases (${proposal.daysOfCover}d cover)`
            : ` · ${proposal.daysOfCover}d store cover`}
          . Thresholds from{' '}
          <Link to="/business-rules" className="font-semibold text-[#4684AD] hover:underline">
            Business Rules
          </Link>
          .
        </p>
        {!proposal.eligible && proposal.ineligibleReason && (
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
            {proposal.ineligibleReason}
          </p>
        )}
      </div>

      {proposal.eligible && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
            Choose alternate supplier
          </h4>
          <div className="space-y-2" role="radiogroup" aria-label="Alternate suppliers">
            {proposal.options.map((opt) => {
              const isSelected = opt.id === effectiveSelectedId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!canSelect}
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    'w-full text-left rounded-lg border px-4 py-3 transition-colors',
                    isSelected
                      ? 'border-[#4684AD] bg-[#C0D5E5]/35 ring-1 ring-[#4684AD]/40'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#4684AD]/50',
                    !canSelect && 'opacity-80 cursor-default'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'w-3.5 h-3.5 rounded-full border-2 shrink-0',
                            isSelected
                              ? 'border-[#4684AD] bg-[#4684AD]'
                              : 'border-slate-300 bg-white'
                          )}
                        />
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {opt.supplierName}
                        </span>
                        {opt.recommended && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {opt.rfqId ? '2nd-best RFQ' : 'Recommended alt vendor'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-5 leading-relaxed">
                        {opt.reason} · {opt.origin}
                        {opt.rfqId ? ` · ${opt.rfqId} · ${opt.bidId}` : ` · ${opt.bidId}`}
                      </p>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <div className="font-bold tabular-nums text-[#2F5472]">{opt.shipDays}d ship</div>
                      <div className="tabular-nums text-slate-600">
                        ${opt.pricePerCase.toFixed(2)}/
                        {proposal.unit.slice(0, -1).toLowerCase() || 'case'}
                      </div>
                      <div className="text-slate-400">
                        cap {opt.capacityCases.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
                New PO preview
              </div>
              <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                Create PO to <strong>{selected.supplierName}</strong> for{' '}
                {proposal.fillInCases.toLocaleString()} {proposal.unit} {proposal.item} · ETA in{' '}
                {selected.shipDays}d · est. value $
                {Math.round(proposal.fillInCases * selected.pricePerCase).toLocaleString()}
              </p>
            </div>
          )}
        </section>
      )}

      {!hideApproval && (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Approval
          </span>
          {sourcingAction ? (
            <>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded border',
                  sourcingAction.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : sourcingAction.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {getActionStatusLabel(sourcingAction.status)}
              </span>
              {sourcingAction.sourcingProposal?.issuedPo && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#C0D5E5] text-[#2F5472]">
                  {sourcingAction.sourcingProposal.issuedPo}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border bg-amber-100 text-amber-900 border-amber-200">
              Loading task…
            </span>
          )}
        </div>

        {sourcingAction ? (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Owner: <strong>{PERSONA_LABELS[sourcingAction.ownerPersona]}</strong>
              {proposal.eligible && ' · Approving creates the new PO to the selected supplier'}
            </p>

            {canAct && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={handleApprove} className={btnPrimaryClass}>
                  <Check className="w-3.5 h-3.5" />
                  Approve & create new PO
                </button>
                <button type="button" onClick={handleReject} className={btnSecondaryClass}>
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {!proposal.eligible && sourcingAction.status === 'pending_approval' && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Adjust Business Rules day thresholds, then Reset demo on Risk Actions.
              </p>
            )}

            {sourcingAction.status === 'approved' &&
              sourcingAction.sourcingProposal?.issuedPo && (
                <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  New PO {sourcingAction.sourcingProposal.issuedPo} issued to{' '}
                  {selected?.supplierName ?? 'alternate supplier'}.
                </p>
              )}

            <Link
              to={
                sourcingAction.sourcingProposal?.issuedPo
                  ? `/orders?po=${encodeURIComponent(sourcingAction.sourcingProposal.issuedPo)}`
                  : '/orders'
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4684AD] hover:underline"
            >
              {sourcingAction.sourcingProposal?.issuedPo
                ? `Track ${sourcingAction.sourcingProposal.issuedPo} in SAP Purchase Orders`
                : 'Open SAP Purchase Orders'}
            </Link>
            <Link
              to="/actions"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4684AD] hover:underline ml-3"
            >
              Open in Risk Actions
            </Link>
          </>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Task not in queue yet. Open{' '}
            <Link to="/actions" className="font-semibold text-[#4684AD] hover:underline">
              Risk Actions
            </Link>{' '}
            (or click <strong>Reset demo</strong>), then return here — Approve will appear.
          </p>
        )}
      </div>
      )}
    </div>
  );
}
