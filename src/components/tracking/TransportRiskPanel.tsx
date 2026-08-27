/**
 * Shipment delay — transport: trucks held for this pickup released and moved onto other loads.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Bell, Check, Truck, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SAP, btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildTransportImpact,
  getActionStatusLabel,
  canPersonaApproveAction,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type TransportRiskPanelProps = {
  shipment: TrackShipment;
  transportAction: RiskAction | undefined;
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

export function TransportRiskPanel({
  shipment,
  transportAction,
  persona,
  canApprove,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: TransportRiskPanelProps) {
  const impact = useMemo(() => buildTransportImpact(shipment), [shipment]);
  const canAct = transportAction ? canPersonaApproveAction(transportAction, persona) : false;
  const late = impact.delayDays > 0;
  const earlyShort = !late && impact.hasStorageCapacity === false;
  const earlyBau = !late && impact.hasStorageCapacity === true;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Truck className="w-4 h-4 text-[#2F5472]" />
        {earlyShort
          ? 'Transport — inbound + early store haul'
          : earlyBau
            ? 'Transport — pull-forward inbound only'
            : 'Transport — truck redeployment'}
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
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
            Tied to overstock decision
          </div>
          <p className="mt-1 font-medium">{impact.capacityNote}</p>
        </div>
      )}

      {(earlyShort || earlyBau) && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Inbound trucks</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">{impact.trucksBooked}</div>
              <div className="text-[10px] text-slate-400">pull to {formatShortDate(impact.revisedPickup)}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Store-haul trucks</div>
              <div
                className={cn(
                  'text-lg font-bold tabular-nums mt-0.5',
                  (impact.storeHaulTrucks ?? 0) > 0 ? 'text-amber-800' : 'text-slate-400'
                )}
              >
                {impact.storeHaulTrucks ?? 0}
              </div>
              <div className="text-[10px] text-slate-400">
                {(impact.storeHaulCases ?? 0) > 0
                  ? `${impact.storeHaulCases!.toLocaleString()} overflow cases`
                  : 'none — BAU'}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Store legs</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">
                {impact.storeHaulLegs?.length ?? 0}
              </div>
              <div className="text-[10px] text-slate-400">outbound routes</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500">From later loads</div>
              <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
                {impact.trucksReassigned}
              </div>
              <div className="text-[10px] text-slate-400">pulled forward</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-slate-100 dark:divide-slate-800">
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Planned pickup
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-700 dark:text-slate-200 mt-0.5">
              {formatShortDate(impact.plannedPickup)}
            </div>
            <div className="text-[10px] text-slate-400">original booking</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Revised pickup
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-800 mt-0.5">
              {formatShortDate(impact.revisedPickup)}
            </div>
            <div className="text-[10px] text-slate-400">
              {late ? `+${impact.delayDays}d vs plan` : `${Math.abs(impact.delayDays)}d earlier`}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Trucks booked
            </div>
            <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
              {impact.trucksBooked}
            </div>
            <div className="text-[10px] text-slate-400">
              reefers · {impact.cases.toLocaleString()} cases
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Idle if held
            </div>
            <div
              className={cn(
                'text-lg font-bold tabular-nums mt-0.5',
                impact.idleTruckDays > 0 ? 'text-rose-700' : 'text-emerald-700'
              )}
            >
              {impact.idleTruckDays > 0 ? `${impact.idleTruckDays}` : 'None'}
            </div>
            <div className="text-[10px] text-slate-400">
              {impact.idleTruckDays > 0 ? 'truck-days' : 'no idle time'}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Reassigned
            </div>
            <div className="text-lg font-bold tabular-nums text-emerald-700 mt-0.5">
              {impact.trucksReassigned}
            </div>
            <div className="text-[10px] text-slate-400">
              of {impact.trucksBooked} moved to other loads
            </div>
          </div>
        </div>
      </div>

      {earlyShort && (impact.storeHaulLegs?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
            Outbound — early store haul (overflow)
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2.5 font-semibold text-slate-500">Store</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Cases</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Trucks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {impact.storeHaulLegs!.map((l) => (
                  <tr key={`${l.storeId}-${l.item}`}>
                    <td className="px-3 py-2.5 font-semibold">{l.storeName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                      {l.cases}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.trucks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
          {late ? 'Reassign to — other inbound loads' : 'Pull-forward from — later bookings'}
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">From</th>
                <th className="px-3 py-2.5 w-8" />
                <th className="px-3 py-2.5 font-semibold text-slate-500">To container</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Date</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">Trucks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {impact.reassignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    No inbound load in this window — park the freed trucks.
                  </td>
                </tr>
              ) : (
                impact.reassignments.map((r) => (
                  <tr key={r.shipmentId}>
                    <td className="px-3 py-2.5 font-semibold">{shipment.containerNumber}</td>
                    <td className="px-1 py-2.5 text-slate-300">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{r.containerNumber}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.item}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">
                      {formatShortDate(r.date)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                      {r.trucks}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Proposed plan — assets
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

        {transportAction && !hideApproval && (
          <div className="mx-4 my-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Approval
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded border',
                  transportAction.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : transportAction.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {getActionStatusLabel(transportAction.status)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Owner: <strong>{PERSONA_LABELS[transportAction.ownerPersona]}</strong> · Approver:{' '}
              {PERSONA_LABELS[transportAction.approverPersona]}
            </p>

            {canAct && canApprove && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onApprove?.(transportAction.id)}
                  className={btnPrimaryClass}
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve & notify transport
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rejectRiskAction(transportAction.id, persona);
                    onActionsUpdated();
                  }}
                  className={btnSecondaryClass}
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {transportAction.status === 'pending_approval' && !canApprove && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Awaiting DC Purchasing approval.
              </p>
            )}

            {transportAction.status === 'approved' && (
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Approved — transport team notified to release and rebook.
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
