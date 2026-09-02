/**
 * Pinned approve / reject bar — matches Risk Actions detail footer.
 */
import { Link } from 'react-router';
import { Bell, Check, Clock, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  canPersonaApproveAction,
  getActionStatusLabel,
  isCategoryTwoStepAction,
  type FreshGuardPersona,
  type RiskAction,
  PERSONA_LABELS,
} from '../../lib/trackingFlow';

type RiskActionFooterProps = {
  action: RiskAction;
  persona: FreshGuardPersona;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  /** Secondary link on the right (e.g. actions queue or shipment intel) */
  secondaryLink?: { label: string; href: string };
  /** Extra note under owner line (sourcing eligible, clearance plan, etc.) */
  ownerNote?: string;
  className?: string;
};

function approveLabel(action: RiskAction, persona: FreshGuardPersona): string {
  if (persona === 'category_manager') {
    return 'Approve clearance';
  }
  if (action.category === 'sourcing') return 'Approve & create PO';
  if (action.category === 'stock') return 'Approve & notify delivery team';
  if (action.category === 'shelf_life') return 'Approve & notify teams';
  if (isCategoryTwoStepAction(action)) return 'Approve → Category Mgr';
  return 'Approve & notify';
}

function approvedMessage(action: RiskAction): string {
  if (action.category === 'clearance') return 'Confirmed — apply markdown.';
  if (action.category === 'sourcing' && action.sourcingProposal?.issuedPo) {
    return `Confirmed — ${action.sourcingProposal.issuedPo} issued.`;
  }
  if (action.category === 'stock') return 'Approved — delivery team notified to execute moves.';
  return 'Ready to execute.';
}

export function RiskActionFooter({
  action,
  persona,
  onApprove,
  onReject,
  secondaryLink = { label: 'View full actions queue', href: '/actions' },
  ownerNote,
  className,
}: RiskActionFooterProps) {
  const canAct = canPersonaApproveAction(action, persona);
  const twoStep = isCategoryTwoStepAction(action);

  return (
    <div
      className={cn(
        'shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2.5',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Approval
          </span>
          <span
            className={cn(
              'text-[11px] font-semibold uppercase px-2 py-0.5 rounded border',
              action.status === 'pending_approval' || action.status === 'pending_category_approval'
                ? 'bg-amber-100 text-amber-900 border-amber-200'
                : action.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
            )}
          >
            {getActionStatusLabel(action.status)}
          </span>
        </div>
        <Link
          to={secondaryLink.href}
          className="text-xs font-semibold text-[#4684AD] hover:underline shrink-0"
        >
          {secondaryLink.label}
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Owner:{' '}
        <strong className="text-slate-700 dark:text-slate-300">
          {PERSONA_LABELS[action.ownerPersona]}
        </strong>
        {twoStep ? (
          <> · Step 2: {PERSONA_LABELS.category_manager}</>
        ) : action.notifyPersonas.length > 0 ? (
          <> · Notify: {action.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}</>
        ) : null}
        {ownerNote ? <> · {ownerNote}</> : null}
      </p>

      {canAct ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onApprove(action.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-white shadow-sm',
              persona === 'category_manager'
                ? 'bg-violet-700 hover:bg-violet-800'
                : 'bg-[#4684AD] hover:bg-[#3B7398]'
            )}
          >
            <Check className="w-3.5 h-3.5" />
            {approveLabel(action, persona)}
          </button>
          <button
            type="button"
            onClick={() => onReject(action.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 text-xs font-bold uppercase tracking-wide hover:bg-slate-50"
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      ) : action.status === 'approved' ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {approvedMessage(action)}
          </p>
          {action.category === 'sourcing' && action.sourcingProposal?.issuedPo && (
            <Link
              to={`/orders?po=${encodeURIComponent(action.sourcingProposal.issuedPo)}`}
              className="text-xs font-semibold text-[#4684AD] hover:underline"
            >
              Track PO
            </Link>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" />
          Awaiting {PERSONA_LABELS[action.approverPersona]}
        </p>
      )}
    </div>
  );
}
