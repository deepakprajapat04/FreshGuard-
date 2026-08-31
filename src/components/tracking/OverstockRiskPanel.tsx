/**
 * Early arrival — storage capacity check, BAU vs early replenishment, shelf-life / markdown guidance.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Bell, Check, TrendingUp, Warehouse, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildOverstockProposal,
  getActionStatusLabel,
  canPersonaApproveAction,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type OverstockRiskPanelProps = {
  shipment: TrackShipment;
  overstockAction: RiskAction | undefined;
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

export function OverstockRiskPanel({
  shipment,
  overstockAction,
  persona,
  canApprove,
  hideApproval = false,
  onActionsUpdated,
  onApprove,
}: OverstockRiskPanelProps) {
  const proposal = useMemo(() => buildOverstockProposal(shipment), [shipment]);
  const canAct = overstockAction ? canPersonaApproveAction(overstockAction, persona) : false;
  const capacityOk = proposal.hasStorageCapacity;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <TrendingUp className="w-4 h-4 text-blue-700" />
        Possible overstock — storage capacity check
      </div>

      <div
        className={cn(
          'rounded-lg border px-4 py-3',
          capacityOk
            ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20'
            : 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20'
        )}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Capacity decision
        </div>
        <p className="text-sm font-bold mt-1 text-slate-900 dark:text-slate-100">
          {capacityOk
            ? 'Yes — storage capacity available → BAU (no stock action)'
            : 'No — capacity short → early replenishment to stores'}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          {proposal.bayLabel} at {proposal.capacityPct}% · {proposal.freePalletSlots} free pallet
          slots vs {proposal.inboundPallets} inbound · arrives {formatShortDate(proposal.revisedEta)}{' '}
          ({proposal.earlyDays}d early vs {formatShortDate(proposal.originalEta)})
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Free slots
            </div>
            <div className="text-lg font-bold tabular-nums mt-0.5">{proposal.freePalletSlots}</div>
            <div className="text-[11px] text-slate-400">pallets</div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
              Inbound
            </div>
            <div className="text-lg font-bold tabular-nums mt-0.5 text-amber-800">
              {proposal.inboundPallets}
            </div>
            <div className="text-[11px] text-slate-400">pallets</div>
          </div>
          <div className="px-3 py-2.5 col-span-2">
            <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              Storage / shelf-life
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-snug">
              {proposal.storageCostNote}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-snug">{proposal.shelfLifeConsequence}</p>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
          Present stock (already held)
        </h4>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">DC on hand</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">
                {proposal.presentStock.dcOnHandCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400">
                {proposal.presentStock.item} · {proposal.presentStock.dcDailyDispatch}/day out
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Store on hand</div>
              <div className="text-lg font-bold tabular-nums mt-0.5">
                {proposal.presentStock.storeOnHandCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400">
                {proposal.presentStock.storeCount} stores
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Ageing batch life</div>
              <div className="text-lg font-bold tabular-nums text-amber-800 mt-0.5">
                {proposal.presentStock.onHandShelfLifeDays}d
              </div>
              <div className="text-[11px] text-slate-400">
                expires {formatShortDate(proposal.presentStock.onHandExpiresDate)}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                If early inbound held
              </div>
              <div className="text-lg font-bold tabular-nums mt-0.5">
                {proposal.projectedStock.dcIfHeldCases.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400">
                DC cases · {proposal.projectedStock.dcDaysCoverIfHeld}d cover
                {proposal.projectedStock.overflowCases > 0
                  ? ` · ${proposal.projectedStock.overflowCases.toLocaleString()} overflow`
                  : ''}
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          {proposal.projectedStock.ageingBatchAction}
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
          Recommended steps
        </h4>
        <ol className="space-y-2">
          {proposal.handlingMeasures.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-white dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold tabular-nums text-white bg-[#4684AD] rounded px-1.5 py-0.5">
                  {m.step}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{m.title}</span>
                <span className="text-[11px] font-semibold uppercase text-slate-400 ml-auto">
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

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
          New batch shelf life & DC hold
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                {['PO', 'Item', 'Cases', 'New batch life', 'Max DC hold', 'Markdown / clearance'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold text-slate-500">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {proposal.batches.map((b) => (
                <tr key={b.po}>
                  <td className="px-3 py-2.5 font-code text-[11px] text-[#2F5472]">{b.po}</td>
                  <td className="px-3 py-2.5 font-semibold">{b.item}</td>
                  <td className="px-3 py-2.5 tabular-nums">{b.inboundCases.toLocaleString()}</td>
                  <td className="px-3 py-2.5 tabular-nums font-bold text-emerald-700">
                    {b.newBatchShelfLifeDays}d
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-[#2F5472]">{b.maxDcHoldDays}d</span>
                    <span className="text-slate-400 ml-1">
                      (reco {b.recommendedDcHoldDays}d)
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {b.markdownPercent != null ? (
                      <span className="font-medium text-amber-800">
                        Markdown {b.markdownPercent}%
                      </span>
                    ) : (
                      <span className="text-emerald-700">None — BAU</span>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {b.clearanceGuidance}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!capacityOk && proposal.storePushes.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
            Early replenishment — notify stores
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
                {proposal.storePushes.map((s) => (
                  <tr key={`${s.storeId}-${s.item}`}>
                    <td className="px-3 py-2.5 font-semibold">{s.storeName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{s.item}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">
                      {s.cases}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.notifyStore ? (
                        <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
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
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {proposal.storePushes[0]?.reason}
          </p>
        </section>
      )}

      {overstockAction && !hideApproval && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded border bg-blue-50 text-blue-800 border-blue-200">
              Overstock
            </span>
            <span className="text-[11px] text-slate-500">
              {getActionStatusLabel(overstockAction.status)}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {overstockAction.proposal}
          </p>
          {canAct && canApprove ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onApprove?.(overstockAction.id)}
                className={btnPrimaryClass}
              >
                <Check className="w-3.5 h-3.5" />
                {capacityOk ? 'Confirm BAU' : 'Approve early replenishment'}
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectRiskAction(overstockAction.id, persona);
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
              Awaiting {PERSONA_LABELS[overstockAction.approverPersona]} ·{' '}
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
