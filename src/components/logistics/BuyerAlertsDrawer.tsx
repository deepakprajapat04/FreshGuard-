import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import { Radio, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BuyerShipmentAlert } from '../../lib/psa';

interface Props {
  open: boolean;
  alerts: BuyerShipmentAlert[];
  onClose: () => void;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenTracking: (shipmentId: string) => void;
}

export function BuyerAlertsDrawer({
  open,
  alerts,
  onClose,
  onDismiss,
  onMarkRead,
  onOpenTracking,
}: Props) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close alerts backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] bg-slate-950/25"
            onClick={onClose}
          />
          <motion.aside
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed z-[200] right-4 sm:right-6 top-[max(5.5rem,12vh)] bottom-4 sm:bottom-6 w-[min(100%-2rem,26rem)] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            role="dialog"
            aria-label="Periodic shipment alerts"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Periodic Shipment Alerts
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Auto-pushed from PSA Portnet every ~45s while lots are in transit.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  Waiting for next PSA heartbeat…
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'rounded-xl border p-3.5 space-y-2',
                      alert.category === 'Urgent'
                        ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                        : alert.category === 'Regular'
                          ? 'border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40',
                      !alert.read && 'ring-1 ring-emerald-500/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {alert.title}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                            alert.category === 'Urgent'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                              : alert.category === 'Regular'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {alert.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDismiss(alert.id)}
                        className="text-slate-400 hover:text-slate-600 shrink-0"
                        aria-label="Dismiss alert"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {alert.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                      <span className="truncate">
                        {alert.containerNumber} · {alert.source}
                      </span>
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {!alert.read && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(alert.id)}
                          className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenTracking(alert.shipmentId)}
                        className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300"
                      >
                        Open tracking
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
