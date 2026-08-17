/**
 * Risk action approval queue — notify teams after DC approval.
 */
import { useState } from 'react';
import { Check, X, Bell, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';
import { usePersona, canApproveActions } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import { SAP } from '../lib/sapTheme';
import {
  approveRiskAction,
  rejectRiskAction,
  loadRiskActions,
  type RiskAction,
  PERSONA_LABELS,
} from '../lib/trackingFlow';

export default function Actions() {
  const { persona } = usePersona();
  const { upsertMany } = useNotifications();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [flash, setFlash] = useState<string | null>(null);

  const pending = actions.filter((a) => a.status === 'pending_approval');
  const approved = actions.filter((a) => a.status === 'approved');
  const canApprove = canApproveActions(persona);

  const visible = canApprove
    ? pending
    : actions.filter(
        (a) =>
          a.ownerPersona === persona ||
          a.notifyPersonas.includes(persona) ||
          a.status === 'approved'
      );

  const onApprove = (id: string) => {
    const next = approveRiskAction(id);
    if (!next) return;
    setActions(loadRiskActions());
    const notifies = next.notifyPersonas.map((p) => ({
      id: `n-${next.id}-${p}`,
      title: `Action approved: ${next.title}`,
      message: `${next.proposal} — ${PERSONA_LABELS[p]} please execute.`,
      severity: 'info' as const,
      category: 'Regular' as const,
      timestamp: new Date().toISOString(),
      read: false,
      module: 'Actions',
      href: '/actions',
    }));
    upsertMany(notifies);
    setFlash(`Approved. ${next.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')} notified.`);
    setTimeout(() => setFlash(null), 5000);
  };

  const onReject = (id: string) => {
    rejectRiskAction(id);
    setActions(loadRiskActions());
    setFlash('Proposal rejected.');
    setTimeout(() => setFlash(null), 3000);
  };

  const resetDemo = () => {
    localStorage.removeItem('freshguard-risk-actions-v1');
    setActions(loadRiskActions());
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="Workflow"
        title="Risk actions"
        subtitle={
          canApprove
            ? 'Approve proposals — system notifies Transport, Receiving, and Category teams.'
            : 'Actions assigned to your team appear here after DC Purchasing approval.'
        }
      >
        <button
          type="button"
          onClick={resetDemo}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
        >
          Reset demo actions
        </button>
      </PageHeader>

      {flash && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {flash}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 uppercase font-bold">Pending approval</div>
          <div className="text-2xl font-bold mt-1">{pending.length}</div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 uppercase font-bold">Approved</div>
          <div className="text-2xl font-bold mt-1 text-emerald-700">{approved.length}</div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 uppercase font-bold">Your queue</div>
          <div className="text-2xl font-bold mt-1">{visible.filter((a) => a.status === 'pending_approval').length}</div>
        </div>
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500 border border-dashed rounded-xl">
            No actions in your queue.
          </div>
        ) : (
          visible.map((a) => (
            <div
              key={a.id}
              className={cn(
                'rounded-xl border p-5 space-y-3 bg-white dark:bg-slate-900',
                a.status === 'pending_approval' && 'border-l-4 border-l-amber-500'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-code text-slate-400">{a.shipmentId}</span>
                  <h3 className="text-base font-bold mt-0.5">{a.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{a.summary}</p>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase px-2 py-1 rounded',
                    a.status === 'pending_approval'
                      ? 'bg-amber-100 text-amber-900'
                      : a.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {a.status.replace('_', ' ')}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-sm">
                <strong>Proposal:</strong> {a.proposal}
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                <span>Owner: {PERSONA_LABELS[a.ownerPersona]}</span>
                <span>·</span>
                <span>
                  Notify: {a.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}
                </span>
              </div>
              {a.status === 'pending_approval' && canApprove && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onApprove(a.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold uppercase"
                    style={{ backgroundColor: SAP.blue }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve & notify
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(a.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-bold uppercase"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
              {a.status === 'approved' && a.ownerPersona === persona && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  Ready to execute — check notifications for details.
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
