import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { Radio, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BuyerShipmentAlert } from '../../lib/psa';

interface Props {
  alerts: BuyerShipmentAlert[];
  onClose: () => void;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenTracking: (shipmentId: string) => void;
}

export function BuyerAlertsDrawer({
  alerts,
  onClose,
  onDismiss,
  onMarkRead,
  onOpenTracking,
}: Props) {
  return (
    <motion.aside
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      className="fixed top-0 right-0 h-full w-full max-w-md z-[60] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black font-mono uppercase tracking-wider">
            Periodic Shipment Alerts
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Auto-pushed from PSA Portnet every ~45s while lots are in transit.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 font-mono">
            Waiting for next PSA heartbeat…
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'rounded-xl border p-3.5 space-y-2',
                alert.severity === 'warning' || alert.severity === 'critical'
                  ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
                  : alert.severity === 'success'
                    ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40',
                !alert.read && 'ring-1 ring-emerald-500/40'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                    {alert.title}
                  </span>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {alert.message}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>
                  {alert.containerNumber} · {alert.source}
                </span>
                <span>
                  {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div className="flex gap-2">
                {!alert.read && (
                  <button
                    onClick={() => onMarkRead(alert.id)}
                    className="text-[10px] font-bold uppercase font-mono text-emerald-700 dark:text-emerald-400"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => onOpenTracking(alert.shipmentId)}
                  className="text-[10px] font-bold uppercase font-mono text-slate-600 dark:text-slate-300"
                >
                  Open tracking
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.aside>
  );
}
