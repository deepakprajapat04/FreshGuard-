/**
 * Early arrival — distribution tied to overstock: clear ageing stock & split overflow to stores.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Bell, Check, Truck, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildDistributionProposal,
  getActionStatusLabel,
  canPersonaApproveAction,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type DistributionRiskPanelProps = {
  shipment: TrackShipment;
  distributionAction: RiskAction | undefined;
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

export function DistributionRiskPanel({
  shipment,
  distributionAction,
  persona,
  canApprove,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: DistributionRiskPanelProps) {
  const proposal = useMemo(() => buildDistributionProposal(shipment), [shipment]);
  const canAct = distributionAction
    ? canPersonaApproveAction(distributionAction, persona)
    : false;
  const capacityOk = proposal.hasStorageCapacity;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Truck className="w-4 h-4 text-[#2F5472]" />
        {capacityOk
          ? 'Distribution stand-by (capacity OK)'
          : 'Distribution — clear ageing & split overflow'}
      </div>

      <div
        className={cn(
          'rounded-lg border px-4 py-3 text-xs leading-relaxed',
          capacityOk
            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
            : 'border-amber-300 bg-amber-50/70 text-amber-950'
        )}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          Tied to overstock decision
        </div>
        <p className="mt-1 font-medium">{proposal.notifyMessage}</p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Put away at DC</div>
            <div className="text-lg font-bold tabular-nums text-emerald-700 mt-0.5">
              {proposal.putAwayCases.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">cases into free slots</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Overflow push</div>
            <div
              className={cn(
                'text-lg font-bold tabular-nums mt-0.5',
                proposal.overflowCases > 0 ? 'text-amber-800' : 'text-slate-400'
              )}
            >
              {proposal.overflowCases.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">cases to stores</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Ageing DC stock</div>
            <div className="text-lg font-bold tabular-nums mt-0.5">
              {proposal.ageingDcCases.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">
              {proposal.ageingShelfLifeDays}d life · exp {formatShortDate(proposal.ageingExpiresDate)}
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Extra routes</div>
            <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
              {proposal.extraRoutes}
            </div>
            <div className="text-[10px] text-slate-400">
              {proposal.markdownPercent != null
                ? `markdown ${proposal.markdownPercent}%`
                : 'no markdown'}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
          Recommended steps
        </h4>
        <ol className="space-y-2">
          {proposal.measures.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-white dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold tabular-nums text-white bg-[#4684AD] rounded px-1.5 py-0.5">
                  {m.step}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{m.title}</span>
                <span className="text-[10px] font-semibold uppercase text-slate-400 ml-auto">
                  {m.owner}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {m.action}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {!capacityOk && proposal.storeDeliveries.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
            Store split — notify before delivery
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                  {['Store', 'Item', 'Cases', 'Notify'].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'px-3 py-2.5 font-semibold text-slate-500',
                        h === 'Cases' && 'text-right'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {proposal.storeDeliveries.map((s) => (
                  <tr key={`${s.storeId}-${s.item}`}>
                    <td className="px-3 py-2.5 font-semibold">{s.storeName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{s.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                      {s.cases}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.notifyStore ? (
                        <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          Clear stock / arrange space
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {distributionAction && !hideApproval && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-blue-50 text-blue-800 border-blue-200">
              Distribution
            </span>
            <span className="text-[10px] text-slate-500">
              {getActionStatusLabel(distributionAction.status)}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {distributionAction.proposal}
          </p>
          {canAct && canApprove ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onApprove?.(distributionAction.id)}
                className={btnPrimaryClass}
              >
                <Check className="w-3.5 h-3.5" />
                {capacityOk ? 'Confirm stand-by' : 'Approve store wave'}
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectRiskAction(distributionAction.id, persona);
                  onActionsUpdated();
                }}
                className={btnSecondaryClass}
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Awaiting {PERSONA_LABELS[distributionAction.approverPersona]} ·{' '}
              <Link to="/actions" className="text-[#4684AD] font-semibold hover:underline">
                Open in Actions
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
