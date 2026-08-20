/**
 * Shipment delay — shelf life (compact, stock-risk style).
 * On-hand freshness vs dock-to-shelf inbound timing + slim approval.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Bell, Check, Package, TrendingDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SAP, btnPrimaryClass, btnSecondaryClass } from '../../lib/sapTheme';
import {
  rejectRiskAction,
  buildShelfLifeProposal,
  getActionStatusLabel,
  canPersonaApproveAction,
  STORE_TRANSIT_BUFFER_DAYS,
  type FreshGuardPersona,
  type RiskAction,
  type TrackShipment,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type ShelfLifePanelProps = {
  shipment: TrackShipment;
  shelfAction: RiskAction | undefined;
  persona: FreshGuardPersona;
  canApprove: boolean;
  onActionsUpdated: () => void;
  onApprove?: (actionId: string) => void;
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ShelfLifePanel({
  shipment,
  shelfAction,
  persona,
  canApprove,
  onActionsUpdated,
  onApprove,
}: ShelfLifePanelProps) {
  const proposal = useMemo(() => buildShelfLifeProposal(shipment), [shipment]);
  const canAct = shelfAction ? canPersonaApproveAction(shelfAction, persona) : false;

  const onHandShelfLifeDays = useMemo(() => {
    if (!proposal.lines.length) return 0;
    return Math.min(...proposal.lines.map((l) => l.currentOnHandShelfLifeDays));
  }, [proposal.lines]);

  const onHandExpiresDate = useMemo(() => {
    const line = proposal.lines.find((l) => l.currentOnHandShelfLifeDays === onHandShelfLifeDays);
    return line?.currentOnHandExpiresDate ?? proposal.originalEta;
  }, [proposal.lines, proposal.originalEta, onHandShelfLifeDays]);

  const storeShelfDate = proposal.lines[0]?.storeShelfDate ?? proposal.revisedEta;
  const maxGapDays = useMemo(
    () => Math.max(0, ...proposal.lines.map((l) => l.oosGapDays)),
    [proposal.lines]
  );
  const itemsAtRisk = proposal.lines.filter((l) => l.oosGapDays > 0).length;
  const markdownItems = proposal.lines.filter((l) => l.markdownRecommended).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <TrendingDown className="w-4 h-4 text-amber-600" />
        Shelf life — on-hand vs dock-to-shelf
      </div>

      {/* Timing strip */}
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
              expires {formatShortDate(onHandExpiresDate)}
            </div>
          </div>
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
              Store shelf
            </div>
            <div className="text-lg font-bold tabular-nums text-[#2F5472] mt-0.5">
              {formatShortDate(storeShelfDate)}
            </div>
            <div className="text-[10px] text-slate-400">
              DC + {STORE_TRANSIT_BUFFER_DAYS}d dock-to-shelf
            </div>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Stock at risk
            </div>
            <div
              className={cn(
                'text-lg font-bold tabular-nums mt-0.5',
                maxGapDays > 0 ? 'text-rose-700' : 'text-emerald-700'
              )}
            >
              {maxGapDays > 0 ? `${maxGapDays}d` : 'None'}
            </div>
            <div className="text-[10px] text-slate-400">
              {maxGapDays > 0
                ? `${itemsAtRisk} item${itemsAtRisk === 1 ? '' : 's'} with OOS gap`
                : 'covered until store'}
            </div>
          </div>
        </div>
      </div>

      {/* Compact item table */}
      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          Items on this batch
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">On hand</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Expires</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Store shelf</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500 text-right">OOS gap</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {proposal.lines.map((line) => (
                <tr
                  key={line.po}
                  className={
                    line.oosGapDays > 0 ? 'bg-rose-50/40 dark:bg-rose-950/10' : undefined
                  }
                >
                  <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    {line.item}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                    {line.currentOnHandShelfLifeDays}d
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">
                    {formatShortDate(line.currentOnHandExpiresDate)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-semibold text-[#2F5472]">
                    {formatShortDate(line.storeShelfDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {line.oosGapDays > 0 ? (
                      <span className="font-bold text-rose-700">{line.oosGapDays}d</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {line.markdownRecommended ? (
                      <span className="font-medium text-amber-800">
                        Markdown {line.markdownPercent}%
                      </span>
                    ) : line.oosGapDays > 0 ? (
                      <span className="font-medium text-rose-700">Prioritize outbound</span>
                    ) : (
                      <span className="text-slate-500">Hold standard</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Proposed actions + approval */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Proposed plan — freshness response
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Gap</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Deliver by</th>
                <th className="px-3 py-2.5 font-semibold text-slate-500">Pricing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {proposal.lines.map((line) => (
                <tr key={`plan-${line.po}`}>
                  <td className="px-3 py-2.5 font-semibold">{line.item}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {line.oosGapDays > 0 ? (
                      <span className="font-bold text-rose-700">{line.oosGapDays}d OOS</span>
                    ) : (
                      <span className="text-emerald-700">None</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">
                    {formatShortDate(line.currentOnHandExpiresDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    {line.markdownRecommended ? (
                      <span className="font-medium text-amber-800">
                        Markdown {line.markdownPercent}%
                      </span>
                    ) : (
                      <span className="text-slate-500">Standard</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 bg-rose-50/40 dark:bg-rose-950/10">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Items with OOS gap
            </div>
            <div className="text-lg font-bold tabular-nums text-rose-700 mt-1">{itemsAtRisk}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 bg-amber-50/40 dark:bg-amber-950/10">
            <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
              Markdown recommended
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-800 mt-1">{markdownItems}</div>
          </div>
        </div>

        {shelfAction && (
          <div className="mx-4 mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Approval
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded border',
                  shelfAction.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : shelfAction.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {getActionStatusLabel(shelfAction.status)}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Owner: <strong>{PERSONA_LABELS[shelfAction.ownerPersona]}</strong>
              {shelfAction.notifyPersonas.length > 0 && (
                <>
                  {' '}
                  · Notify:{' '}
                  {shelfAction.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}
                </>
              )}
            </p>

            {canAct && canApprove && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onApprove?.(shelfAction.id)}
                  className={btnPrimaryClass}
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve & notify teams
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rejectRiskAction(shelfAction.id, persona);
                    onActionsUpdated();
                  }}
                  className={btnSecondaryClass}
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}

            {shelfAction.status === 'pending_approval' && !canApprove && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Awaiting DC Purchasing approval.
              </p>
            )}

            {shelfAction.status === 'approved' && (
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Approved — teams notified.
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
