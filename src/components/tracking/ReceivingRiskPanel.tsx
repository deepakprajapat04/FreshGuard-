/**
 * Shipment delay — receiving: dock slot and crew replanned against the revised arrival.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Bell, Check, Users, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SAP, btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildReceivingImpact,
  getActionStatusLabel,
  canPersonaApproveAction,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type ReceivingRiskPanelProps = {
  shipment: TrackShipment;
  receivingAction: RiskAction | undefined;
  persona: FreshGuardPersona;
  canApprove: boolean;
  hideApproval?: boolean;
  onActionsUpdated: () => void;
  onApprove?: (actionId: string) => void;
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ReceivingRiskPanel({
  shipment,
  receivingAction,
  persona,
  canApprove,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: ReceivingRiskPanelProps) {
  const impact = useMemo(() => buildReceivingImpact(shipment), [shipment]);
  const canAct = receivingAction ? canPersonaApproveAction(receivingAction, persona) : false;
  const late = impact.delayDays > 0;
  const earlyShort = !late && impact.hasStorageCapacity === false;
  const earlyBau = !late && impact.hasStorageCapacity === true;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Users className="w-4 h-4 text-[#2F5472]" />
        {earlyShort
          ? 'Receiving — split put-away & cross-dock'
          : earlyBau
            ? 'Receiving — early gate-in (BAU put-away)'
            : 'Receiving — dock slot & crew replan'}
      </div>

      {impact.capacityNote && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-xs leading-relaxed',
            earlyShort
              ? 'border-amber-300 bg-amber-50/70 text-amber-950'
              : 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
          )}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Tied to overstock decision
          </div>
          <p className="mt-1 font-medium">{impact.capacityNote}</p>
        </div>
      )}

      {(earlyShort || earlyBau) && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Inbound</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{impact.pallets}</div>
              <div className="text-[11px] text-slate-400">pallets</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Put away</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700 mt-0.5">
                {impact.putAwayPallets ?? impact.pallets}
              </div>
              <div className="text-[11px] text-slate-400">to chilled slots</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Cross-dock</div>
              <div
                className={cn(
                  'text-lg font-bold tabular-nums mt-0.5',
                  (impact.crossDockPallets ?? 0) > 0 ? 'text-amber-800' : 'text-slate-400'
                )}
              >
                {impact.crossDockPallets ?? 0}
              </div>
              <div className="text-[11px] text-slate-400">
                {(impact.crossDockCases ?? 0) > 0
                  ? `${impact.crossDockCases!.toLocaleString()} cases → stores`
                  : 'none — BAU'}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Crew</div>
              <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
                {impact.crewFte} FTE
              </div>
              <div className="text-[11px] text-slate-400">~{impact.unloadHours}h · door {impact.doorId}</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-slate-100 dark:divide-slate-800">
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Planned slot
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
              {formatShortDate(impact.plannedSlot)}
            </div>
            <div className="text-[11px] text-slate-400">door {impact.doorId}</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Revised slot
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-800 mt-0.5">
              {formatShortDate(impact.revisedSlot)}
            </div>
            <div className="text-[11px] text-slate-400">
              {late ? `+${impact.delayDays}d vs plan` : `${Math.abs(impact.delayDays)}d earlier`}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Crew needed
            </div>
            <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
              {impact.crewFte} FTE
            </div>
            <div className="text-[11px] text-slate-400">~{impact.unloadHours}h to unload</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Volume
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
              {impact.pallets}
            </div>
            <div className="text-[11px] text-slate-400">
              pallets · {impact.cases.toLocaleString()} cases
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Crew freed
            </div>
            <div
              className={cn(
                'text-lg font-bold tabular-nums mt-0.5',
                impact.freedCrewHours > 0 ? 'text-rose-700' : 'text-emerald-700'
              )}
            >
              {impact.freedCrewHours > 0 ? `${impact.freedCrewHours}h` : 'None'}
            </div>
            <div className="text-[11px] text-slate-400">
              {impact.freedCrewHours > 0
                ? `idle on ${formatShortDate(impact.plannedSlot)}`
                : 'no idle shift'}
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Proposed plan — manpower
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">When</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Action</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {impact.steps.map((step) => (
                <tr key={step.id}>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-slate-600">
                    {formatShortDate(step.when)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    {step.action}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{step.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {receivingAction && !hideApproval && (
          <div className="mx-4 my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Approval
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase px-2 py-0.5 rounded border',
                  receivingAction.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : receivingAction.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {getActionStatusLabel(receivingAction.status)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Owner: <strong>{PERSONA_LABELS[receivingAction.ownerPersona]}</strong> · Approver:{' '}
              {PERSONA_LABELS[receivingAction.approverPersona]}
            </p>

            {canAct && canApprove && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onApprove?.(receivingAction.id)}
                  className={btnPrimaryClass}
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve & notify receiving
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rejectRiskAction(receivingAction.id, persona);
                    onActionsUpdated();
                  }}
                  className={btnSecondaryClass}
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {receivingAction.status === 'pending_approval' && !canApprove && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Awaiting {PERSONA_LABELS[receivingAction.approverPersona]}.
              </p>
            )}

            {receivingAction.status === 'approved' && (
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Approved — receiving team notified to replan the shift.
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
    </div>
  );
}
