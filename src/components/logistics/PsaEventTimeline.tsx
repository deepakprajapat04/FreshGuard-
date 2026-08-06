import { format } from 'date-fns';
import { Fragment } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ClipboardList,
  Flag,
  MapPin,
  Navigation,
  Thermometer,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  buildShipmentNextActions,
  getTransportModeMismatch,
  getPsaEventKind,
  type PsaEvent,
  type PsaEventKind,
  type ShipmentNextAction,
} from '../../lib/psa';
import type { Shipment } from '../../lib/shipmentTypes';

const KIND_META: Record<
  PsaEventKind,
  { label: string; dot: string; badge: string; icon: typeof Navigation }
> = {
  movement: {
    label: 'Movement',
    dot: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    icon: Navigation,
  },
  alert: {
    label: 'Alert',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    icon: Thermometer,
  },
  warning: {
    label: 'ETA change',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
  },
  milestone: {
    label: 'Milestone',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: Flag,
  },
};

const PRIORITY_STYLE = {
  urgent: 'border-rose-300 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/30',
  soon: 'border-amber-300 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/25',
  planned: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
} as const;

function ActionCard({ action }: { action: ShipmentNextAction }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-1.5',
        PRIORITY_STYLE[action.priority]
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border',
            action.priority === 'urgent'
              ? 'bg-rose-600 text-white border-rose-700'
              : action.priority === 'soon'
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'
          )}
        >
          {action.priority}
        </span>
        <span className="text-[9px] font-bold uppercase text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
          {action.owner}
        </span>
        {action.status === 'in_progress' && (
          <span className="text-[9px] font-bold uppercase text-sky-700 dark:text-sky-300">In progress</span>
        )}
      </div>
      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{action.title}</div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{action.detail}</p>
      <div className="text-[10px] font-mono text-slate-400">{action.dueHint}</div>
    </div>
  );
}

export function PsaEventTimeline({
  shipment,
  title = 'PSA event timeline',
  syncedLabel = 'Completely synced',
  onNotifyCarrier,
  onEscalateBuyer,
  onOpenAlerts,
}: {
  shipment: Shipment;
  title?: string;
  syncedLabel?: string;
  onNotifyCarrier?: () => void;
  onEscalateBuyer?: () => void;
  onOpenAlerts?: () => void;
}) {
  const events = [...(shipment.psaEvents || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const nextActions = buildShipmentNextActions(shipment);
  const transportMismatch = getTransportModeMismatch({
    transportMode: shipment.transportMode,
    psaEvents: shipment.psaEvents,
    incoterms: shipment.incoterms,
  });
  const alertCount = events.filter((e) => getPsaEventKind(e.code) === 'alert').length;
  const moveCount = events.filter((e) => getPsaEventKind(e.code) === 'movement').length;

  const expectedLabel =
    transportMismatch.expected === 'water'
      ? 'Sea'
      : transportMismatch.expected === 'land'
        ? 'Road'
        : transportMismatch.expected === 'air'
          ? 'Air'
          : transportMismatch.expected;
  const actualLabel =
    transportMismatch.actual === 'water'
      ? 'Sea'
      : transportMismatch.actual === 'land'
        ? 'Road'
        : transportMismatch.actual === 'air'
          ? 'Air'
          : transportMismatch.actual;

  const mismatchActions = nextActions.filter((a) => a.id.includes('-mismatch-'));
  const otherActions = nextActions.filter((a) => !a.id.includes('-mismatch-'));

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
        <div className="px-5 py-3.5 bg-[#0f2744] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black font-mono uppercase tracking-wider text-white">{title}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Newest at top · scroll down for earlier moves
            </p>
          </div>
          <span className="text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {syncedLabel}
          </span>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-slate-500">
            <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
            Flow: Latest → Origin
          </span>
          <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold', KIND_META.movement.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', KIND_META.movement.dot)} />
            Movement {moveCount}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold', KIND_META.alert.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', KIND_META.alert.dot)} />
            Alert {alertCount}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold', KIND_META.warning.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', KIND_META.warning.dot)} />
            ETA change
          </span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold', KIND_META.milestone.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', KIND_META.milestone.dot)} />
            Milestone
          </span>
        </div>

        <div className="p-5">
          {!events.length ? (
            <div className="text-xs text-slate-400 font-mono py-8 text-center">No PSA events yet.</div>
          ) : (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-sky-400 via-slate-300 to-slate-200 dark:from-sky-600 dark:via-slate-700 dark:to-slate-800" />
              <div className="space-y-0">
                {events.map((ev, idx) => (
                  <Fragment key={ev.id}>
                    <TimelineEventRow
                      ev={ev}
                      isLatest={idx === 0}
                      isOldest={idx === events.length - 1}
                    />
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
        <div className="px-5 py-3.5 bg-[#0c1e36] text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-4 h-4 text-sky-300 shrink-0" />
            <div>
              <h3 className="text-sm font-black font-mono uppercase tracking-wider">Next actions</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {transportMismatch.isMismatch
                  ? `Mismatch proceedings · ${shipment.containerNumber || shipment.id}`
                  : `Prep for arrival · ${shipment.containerNumber || shipment.id} · ETA ${shipment.eta || 'TBD'}`}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/30">
            {(transportMismatch.isMismatch ? mismatchActions : nextActions).filter((a) => a.status !== 'done').length} open
          </span>
        </div>

        {transportMismatch.isMismatch && (
          <div className="px-4 pt-3 pb-0 space-y-3">
            <div className="rounded-xl border border-rose-300/80 bg-gradient-to-r from-rose-50 to-amber-50/80 dark:from-rose-950/30 dark:to-amber-950/20 dark:border-rose-800/50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-rose-800 dark:text-rose-200">
                      Mode mismatch — take action
                    </span>
                    {transportMismatch.incotermCode && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border border-rose-200/60 dark:border-rose-800/50">
                        {transportMismatch.incotermCode}
                      </span>
                    )}
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                      Expected {expectedLabel}
                    </span>
                    <span className="text-[9px] text-slate-400">→</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                      Seeing {actualLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {transportMismatch.summary}
                    {shipment.incoterms ? (
                      <span className="text-slate-400"> · {shipment.incoterms}</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={onNotifyCarrier}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase"
                    >
                      Notify carrier
                    </button>
                    <button
                      type="button"
                      onClick={onEscalateBuyer}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase"
                    >
                      Escalate to buyer
                    </button>
                    {onOpenAlerts && (
                      <button
                        type="button"
                        onClick={onOpenAlerts}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-[10px] font-black uppercase"
                      >
                        Open alerts
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {mismatchActions.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-2 px-0.5">
                  Mismatch proceedings ({mismatchActions.length})
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {mismatchActions.map((a) => (
                    <Fragment key={a.id}>
                      <ActionCard action={a} />
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-4 space-y-2">
          {!transportMismatch.isMismatch && otherActions.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-0.5">
                Arrival prep
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {otherActions.map((a) => (
                  <Fragment key={a.id}>
                    <ActionCard action={a} />
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineEventRow({
  ev,
  isLatest,
  isOldest,
}: {
  ev: PsaEvent;
  isLatest: boolean;
  isOldest: boolean;
}) {
  const kind = getPsaEventKind(ev.code);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const isAlertish = kind === 'alert' || kind === 'warning';

  return (
    <div className="relative pb-5 last:pb-0">
      <span
        className={cn(
          'absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center',
          meta.dot
        )}
      />
      <div
        className={cn(
          'rounded-xl border p-3',
          isAlertish
            ? kind === 'alert'
              ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20'
              : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30'
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {isLatest && (
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-600 text-white">
              Latest
            </span>
          )}
          {isOldest && (
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-600 text-white">
              Origin
            </span>
          )}
          <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', meta.badge)}>
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700">
            {ev.source}
          </span>
        </div>
        <div className="text-xs font-black text-slate-900 dark:text-slate-100">{ev.label}</div>
        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />
          {ev.location}
        </div>
        {ev.details && (
          <div
            className={cn(
              'text-[11px] mt-1.5 leading-relaxed',
              isAlertish ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'
            )}
          >
            {ev.details}
          </div>
        )}
        <div className="text-[10px] font-mono text-slate-400 mt-1.5">
          {format(new Date(ev.timestamp), 'MMM d, yyyy · HH:mm')}
        </div>
      </div>
    </div>
  );
}

/** Compact empty-state friendly wrapper for transit timeline tab */
export function PsaTimelinePanel({
  shipment,
  onNotifyCarrier,
  onEscalateBuyer,
  onOpenAlerts,
}: {
  shipment: Shipment | undefined;
  onNotifyCarrier?: () => void;
  onEscalateBuyer?: () => void;
  onOpenAlerts?: () => void;
}) {
  if (!shipment) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-10 text-center text-xs text-slate-400 font-mono">
        Select a shipment to view PSA events and next actions.
      </div>
    );
  }
  return (
    <PsaEventTimeline
      shipment={shipment}
      title="PSA Portnet event stream"
      syncedLabel={`Synced · ${shipment.containerNumber || shipment.id}`}
      onNotifyCarrier={onNotifyCarrier}
      onEscalateBuyer={onEscalateBuyer}
      onOpenAlerts={onOpenAlerts}
    />
  );
}
