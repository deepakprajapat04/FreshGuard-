/**
 * Risk action approval queue — two-step promo approval (DC → Category Manager).
 */
import { useMemo, useState } from 'react';
import { Check, X, Bell, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import { SAP } from '../lib/sapTheme';
import {
  approveRiskAction,
  rejectRiskAction,
  loadRiskActions,
  canPersonaApproveAction,
  getActionStatusLabel,
  type RiskAction,
  PERSONA_LABELS,
} from '../lib/trackingFlow';

export default function Actions() {
  const { persona } = usePersona();
  const { upsertMany } = useNotifications();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [flash, setFlash] = useState<string | null>(null);

  const pendingDc = actions.filter((a) => a.status === 'pending_approval');
  const pendingCategory = actions.filter((a) => a.status === 'pending_category_approval');
  const approved = actions.filter((a) => a.status === 'approved');

  const visible = useMemo(() => {
    if (persona === 'dc_purchasing') {
      return actions.filter((a) => a.status === 'pending_approval' || a.status === 'pending_category_approval');
    }
    if (persona === 'category_manager') {
      return actions.filter(
        (a) =>
          a.status === 'pending_category_approval' ||
          (a.category === 'promotion' && a.notifyPersonas.includes('category_manager') && a.status === 'approved')
      );
    }
    return actions.filter(
      (a) =>
        a.ownerPersona === persona ||
        a.notifyPersonas.includes(persona) ||
        a.status === 'approved'
    );
  }, [actions, persona]);

  const onApprove = (id: string) => {
    const next = approveRiskAction(id, persona);
    if (!next) return;
    setActions(loadRiskActions());

    if (next.category === 'promotion' && next.status === 'pending_category_approval') {
      upsertMany([
        {
          id: `n-${next.id}-category-review`,
          title: `Promo change ready for approval: ${next.title}`,
          message: `${next.proposal} — Please review and approve reschedule & store mix updates.`,
          severity: 'info' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Sent to Category Manager for approval.');
    } else if (next.category === 'promotion' && next.status === 'approved') {
      upsertMany([
        {
          id: `n-${next.id}-confirmed`,
          title: `Promo changes confirmed: ${next.title}`,
          message: `${next.proposal} — Updates applied to promo calendar & store allocations.`,
          severity: 'success' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Promo changes approved — POS & marketing updates confirmed.');
    } else {
      const isShelf = next.category === 'shelf_life';
      const notifies = next.notifyPersonas.map((p) => ({
        id: `n-${next.id}-${p}`,
        title: isShelf ? `Shelf-life guidance approved: ${next.title}` : `Action approved: ${next.title}`,
        message: isShelf
          ? `${next.proposal} — ${PERSONA_LABELS[p]} please apply QC markdown rules & delivery schedule.`
          : `${next.proposal} — ${PERSONA_LABELS[p]} please execute delivery moves.`,
        severity: 'info' as const,
        category: 'Regular' as const,
        timestamp: new Date().toISOString(),
        read: false,
        module: 'System' as const,
        href: '/actions',
      }));
      upsertMany(notifies);
      setFlash(`Approved. ${next.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')} notified.`);
    }
    setTimeout(() => setFlash(null), 5000);
  };

  const onReject = (id: string) => {
    rejectRiskAction(id, persona);
    setActions(loadRiskActions());
    setFlash('Proposal rejected.');
    setTimeout(() => setFlash(null), 3000);
  };

  const resetDemo = () => {
    localStorage.removeItem('freshguard-risk-actions-v6');
    setActions(loadRiskActions());
  };

  const subtitle =
    persona === 'dc_purchasing'
      ? 'Approve proposals — promo changes go to Category Manager for step 2.'
      : persona === 'category_manager'
        ? 'Review promo reschedule & store mix proposals sent by DC Purchasing.'
        : 'Actions assigned to your team appear here after approval.';

  return (
    <div className={pageShellClass}>
      <PageHeader eyebrow="Workflow" title="Risk actions" subtitle={subtitle}>
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
          <div className="text-xs text-slate-500 uppercase font-bold">Pending DC approval</div>
          <div className="text-2xl font-bold mt-1">{pendingDc.length}</div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 uppercase font-bold">Pending Category Manager</div>
          <div className="text-2xl font-bold mt-1 text-violet-700">{pendingCategory.length}</div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 uppercase font-bold">Fully approved</div>
          <div className="text-2xl font-bold mt-1 text-emerald-700">{approved.length}</div>
        </div>
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500 border border-dashed rounded-xl">
            No actions in your queue.
          </div>
        ) : (
          visible.map((a) => {
            const canAct = canPersonaApproveAction(a, persona);
            return (
              <div
                key={a.id}
                className={cn(
                  'rounded-xl border p-5 space-y-3 bg-white dark:bg-slate-900',
                  (a.status === 'pending_approval' || a.status === 'pending_category_approval') &&
                    'border-l-4 border-l-amber-500'
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
                      a.status === 'pending_approval' || a.status === 'pending_category_approval'
                        ? 'bg-amber-100 text-amber-900'
                        : a.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {getActionStatusLabel(a.status)}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-sm">
                  <strong>Proposal:</strong> {a.proposal}
                </div>
                {a.promotionProposal && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-violet-900">
                      Reschedule & store mix changes
                    </div>
                    <div className="text-xs">
                      <strong>Reschedule:</strong> {a.promotionProposal.reschedule.promoName} →{' '}
                      {a.promotionProposal.reschedule.proposedStart}–
                      {a.promotionProposal.reschedule.proposedEnd}
                    </div>
                    <ul className="space-y-1 text-xs">
                      {a.promotionProposal.storeChanges.map((c, i) => (
                        <li key={i} className="flex flex-wrap gap-1">
                          <span
                            className={cn(
                              'font-bold uppercase text-[10px] px-1.5 py-0.5 rounded',
                              c.type === 'remove'
                                ? 'bg-rose-100 text-rose-900'
                                : 'bg-emerald-100 text-emerald-900'
                            )}
                          >
                            {c.type === 'remove' ? 'Remove' : 'Add'}
                          </span>
                          <span>{c.storeName}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.shelfLifeProposal && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-amber-900">
                      Shelf life · QC · DC hold · store delivery
                    </div>
                    {a.shelfLifeProposal.lines.map((line) => (
                      <div key={line.po} className="text-xs border-t border-amber-100 pt-2 first:border-0 first:pt-0">
                        <strong>{line.item}</strong> — on-hand {line.currentOnHandShelfLifeDays}d (expires{' '}
                        {line.currentOnHandExpiresDate}); delayed DC {line.revisedArrivalDate} +{' '}
                        {line.storeTransitBufferDays}d → store shelf {line.storeShelfDate}
                        {line.oosGapDays > 0 ? ` · ${line.oosGapDays}d out-of-stock gap` : ''}
                        {line.markdownRecommended
                          ? ` · Markdown ${line.markdownPercent}%`
                          : ' · No markdown'}
                        <div className="text-slate-600 mt-0.5">
                          Max DC hold {line.maxDcHoldDays}d (until {line.dcHoldUntil}) · Deliver to stores
                          by {line.lastStoreDeliveryBy}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {a.stockProposal && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-emerald-900">
                      DC reallocation & inter-store moves
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      {a.stockProposal.moves.map((move, i) => (
                        <li key={i} className="flex flex-wrap gap-1">
                          <span
                            className={cn(
                              'font-bold uppercase text-[10px] px-1.5 py-0.5 rounded',
                              move.type === 'store_to_store'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-emerald-100 text-emerald-900'
                            )}
                          >
                            {move.type === 'store_to_store' ? 'Inter-store' : 'DC → store'}
                          </span>
                          <span>
                            {move.cases} {move.item}: {move.fromLabel} → {move.toLabel}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span>Owner: {PERSONA_LABELS[a.ownerPersona]}</span>
                  {a.category === 'promotion' && (
                    <>
                      <span>·</span>
                      <span>Step 2: {PERSONA_LABELS.category_manager}</span>
                    </>
                  )}
                  {a.category !== 'promotion' && (
                    <>
                      <span>·</span>
                      <span>Notify: {a.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}</span>
                    </>
                  )}
                </div>
                {canAct && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onApprove(a.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold uppercase',
                        persona === 'category_manager' ? 'bg-violet-700 hover:bg-violet-800' : ''
                      )}
                      style={persona !== 'category_manager' ? { backgroundColor: SAP.blue } : undefined}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {persona === 'category_manager'
                        ? 'Approve promo changes'
                        : a.category === 'promotion'
                          ? 'Approve & send to Category Manager'
                          : 'Approve & notify'}
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
                {a.status === 'approved' && persona === 'category_manager' && a.category === 'promotion' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Confirmed — update POS, signage & promo calendar in merchandising systems.
                  </div>
                )}
                {a.status === 'approved' && a.ownerPersona === persona && a.category !== 'promotion' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Ready to execute — check notifications for details.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
