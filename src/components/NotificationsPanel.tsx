import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Radio,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import {
  useNotifications,
  type AlertCategory,
} from '../context/NotificationsContext';

const CATEGORY_TABS: Array<'All' | AlertCategory> = ['All', 'Urgent', 'Regular', 'Info only'];

function CategoryIcon({ category }: { category: AlertCategory }) {
  if (category === 'Urgent') return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />;
  if (category === 'Regular') return <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />;
  return <Info className="w-4 h-4 text-slate-400 shrink-0" />;
}

function categoryBadgeClass(category: AlertCategory) {
  if (category === 'Urgent') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  }
  if (category === 'Regular') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

export function NotificationsPanel({
  open,
  onClose,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 56, right: 16 });
  const [categoryFilter, setCategoryFilter] = useState<'All' | AlertCategory>('All');

  const filtered = useMemo(
    () =>
      categoryFilter === 'All'
        ? notifications
        : notifications.filter((n) => n.category === categoryFilter),
    [notifications, categoryFilter]
  );

  const counts = useMemo(() => {
    const base = { Urgent: 0, Regular: 0, 'Info only': 0 } as Record<AlertCategory, number>;
    notifications.forEach((n) => {
      base[n.category] += 1;
    });
    return base;
  }, [notifications]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 16, 380);
      const right = Math.max(8, window.innerWidth - r.right);
      const top = Math.min(r.bottom + 8, window.innerHeight - 120);
      const maxRight = window.innerWidth - width - 8;
      setCoords({ top, right: Math.min(right, Math.max(8, maxRight)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          style={{ top: coords.top, right: coords.right }}
          className="fixed z-[200] w-[min(100vw-1rem,380px)] max-h-[min(70vh,520px)] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="Alerts"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Bell className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                Alerts
                {unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Urgent · Regular · Info only
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[10px] font-semibold text-sky-600 dark:text-sky-300 hover:text-sky-800 dark:hover:text-sky-200 px-2 py-1"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label="Close alerts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-2 pt-2 pb-1.5 flex gap-1 overflow-x-auto shrink-0 border-b border-slate-100 dark:border-slate-800">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab === 'All'
                  ? notifications.length
                  : counts[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCategoryFilter(tab)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors',
                    categoryFilter === tab
                      ? tab === 'Urgent'
                        ? 'bg-rose-600 text-white'
                        : 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  {tab}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No {categoryFilter === 'All' ? '' : `${categoryFilter.toLowerCase()} `}alerts.
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    n.category === 'Urgent' && !n.read
                      ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/25'
                      : !n.read
                        ? 'border-sky-200 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <CategoryIcon category={n.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="text-left min-w-0"
                          onClick={() => {
                            markRead(n.id);
                            if (n.href) {
                              navigate(n.href);
                              onClose();
                            }
                          }}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {n.title}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                                categoryBadgeClass(n.category)
                              )}
                            >
                              {n.category}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <Radio className="w-3 h-3" />
                            {n.module}
                            <span>·</span>
                            {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(n.id)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          aria-label="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                        {n.message}
                      </p>
                      {n.href && (
                        <button
                          type="button"
                          onClick={() => {
                            markRead(n.id);
                            navigate(n.href!);
                            onClose();
                          }}
                          className="mt-2 text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 hover:underline"
                        >
                          Open module →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
