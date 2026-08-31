/**
 * Slide-over — full participating-store change list for promotion risk (Option B).
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MinusCircle, PlusCircle, Search, Store, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getStoreDemandSnapshot,
  type PromotionStoreChange,
} from '../../lib/trackingFlow';

type ChangeTab = 'remove' | 'add';

const TAB_META: Record<ChangeTab, { label: string; icon: typeof MinusCircle }> = {
  remove: { label: 'Stores to remove', icon: MinusCircle },
  add: { label: 'Stores to add', icon: PlusCircle },
};

function StoreChangeRow({ change }: { change: PromotionStoreChange }) {
  const snapshot = getStoreDemandSnapshot(change.storeId, change.item);
  const isRemove = change.type === 'remove';

  return (
    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded',
                isRemove
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              )}
            >
              {isRemove ? 'Remove' : 'Add'}
            </span>
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{change.storeName}</span>
            <span className="text-[11px] font-code text-slate-400">{change.storeId}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {change.promoName} · {change.item}
          </p>
        </div>
        {snapshot && (
          <dl className="text-right shrink-0 text-[11px] tabular-nums">
            <dt className="text-slate-400 uppercase font-semibold">Cover</dt>
            <dd className="font-bold text-slate-800 dark:text-slate-100">{snapshot.daysCover.toFixed(1)}d</dd>
          </dl>
        )}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{change.reason}</p>
      {snapshot?.oosStartDate && snapshot.oosEndDate && (
        <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1.5 font-medium">
          OOS window {snapshot.oosStartDate} → {snapshot.oosEndDate}
        </p>
      )}
    </div>
  );
}

export function PromotionStoreMixDrawer({
  open,
  onClose,
  changes,
  initialTab = 'remove',
}: {
  open: boolean;
  onClose: () => void;
  changes: PromotionStoreChange[];
  initialTab?: ChangeTab;
}) {
  const [tab, setTab] = useState<ChangeTab>(initialTab);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const removeChanges = useMemo(() => changes.filter((c) => c.type === 'remove'), [changes]);
  const addChanges = useMemo(() => changes.filter((c) => c.type === 'add'), [changes]);
  const activeChanges = tab === 'remove' ? removeChanges : addChanges;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeChanges;
    return activeChanges.filter(
      (c) =>
        c.storeName.toLowerCase().includes(q) ||
        c.promoName.toLowerCase().includes(q) ||
        c.item.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q)
    );
  }, [activeChanges, query]);

  const meta = TAB_META[tab];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[101] h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700"
          >
            <div className="shrink-0 px-4 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[#2F5472]">
                  <Store className="w-4 h-4" />
                  <h2 className="text-sm font-bold">Store mix changes</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {removeChanges.length} removals · {addChanges.length} additions across{' '}
                  {new Set(changes.map((c) => c.promoId)).size} promos
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="shrink-0 px-4 pt-3 pb-2 flex gap-2 border-b border-slate-100 dark:border-slate-800">
              {(['remove', 'add'] as const).map((t) => {
                const count = t === 'remove' ? removeChanges.length : addChanges.length;
                const active = tab === t;
                const TabIcon = TAB_META[t].icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors',
                      active
                        ? 'bg-[#C0D5E5] border-[#4684AD]/40 text-[#2F5472]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {TAB_META[t].label}
                    <span className="tabular-nums opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50/50 dark:bg-slate-950/50">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${meta.label.toLowerCase()}…`}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No changes match your search.</p>
              ) : (
                filtered.map((change, i) => (
                  <StoreChangeRow key={`${change.promoId}-${change.storeId}-${change.type}-${i}`} change={change} />
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
