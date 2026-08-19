/**
 * Slide-over — full DC reallocation & inter-store transfer lists (scales to 50+ moves).
 * Summary cards open this drawer; rows expand for store-level cover / OOS detail.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, Search, Warehouse, X, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ReallocationMove } from '../../lib/trackingFlow';

type MoveTab = 'dc_to_store' | 'store_to_store';

const TAB_META: Record<
  MoveTab,
  { label: string; short: string; icon: typeof Warehouse }
> = {
  dc_to_store: { label: 'DC reallocation', short: 'DC → store', icon: Warehouse },
  store_to_store: { label: 'Inter-store transfer', short: 'Store → store', icon: ArrowRightLeft },
};

function sumCases(moves: ReallocationMove[]) {
  return moves.reduce((n, m) => n + m.cases, 0);
}

function moveKey(move: ReallocationMove, index: number) {
  return `${move.type}-${move.fromLabel}-${move.toLabel}-${move.item}-${index}`;
}

function MoveDetailPanel({ move }: { move: ReallocationMove }) {
  return (
    <div className="px-5 pb-3 pt-0">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/50 p-3 space-y-3">
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{move.reason}</p>
        <dl className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <dt className="text-slate-400 uppercase font-semibold tracking-wide text-[10px]">Destination</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{move.toLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-400 uppercase font-semibold tracking-wide text-[10px]">Item / cases</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
              {move.cases} · {move.item}
            </dd>
          </div>
          {move.toOnHand != null && (
            <div>
              <dt className="text-slate-400 uppercase font-semibold tracking-wide text-[10px]">On hand</dt>
              <dd className="font-semibold tabular-nums mt-0.5">{move.toOnHand}</dd>
            </div>
          )}
          {move.toDailyDemand != null && (
            <div>
              <dt className="text-slate-400 uppercase font-semibold tracking-wide text-[10px]">Daily demand</dt>
              <dd className="font-semibold tabular-nums mt-0.5">{move.toDailyDemand}/d</dd>
            </div>
          )}
          {move.toPendingOrders != null && (
            <div>
              <dt className="text-slate-400 uppercase font-semibold tracking-wide text-[10px]">Pending orders</dt>
              <dd className="font-semibold tabular-nums mt-0.5">{move.toPendingOrders}</dd>
            </div>
          )}
          {move.toDaysCover != null && (
            <div>
              <dt className="text-slate-400 uppercase font-semibold tracking-wide text-[10px]">Current cover</dt>
              <dd className="font-semibold tabular-nums mt-0.5">{move.toDaysCover.toFixed(1)}d</dd>
            </div>
          )}
        </dl>
        {move.toOosStartDate && move.toOosEndDate && (
          <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 px-2.5 py-1.5">
            OOS risk window {move.toOosStartDate} → {move.toOosEndDate}
          </div>
        )}
        {move.type === 'store_to_store' && move.fromDaysCover != null && (
          <div className="text-[11px] text-slate-600 dark:text-slate-400">
            Donor <strong>{move.fromLabel}</strong>
            {move.fromOnHand != null ? ` · ${move.fromOnHand} on hand` : ''} ·{' '}
            {move.fromDaysCover.toFixed(1)}d cover
          </div>
        )}
      </div>
    </div>
  );
}

export function ReallocationMovesDrawer({
  open,
  onClose,
  moves,
  initialTab = 'dc_to_store',
}: {
  open: boolean;
  onClose: () => void;
  moves: ReallocationMove[];
  initialTab?: MoveTab;
}) {
  const [tab, setTab] = useState<MoveTab>(initialTab);
  const [query, setQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setExpandedKey(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setExpandedKey(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const dcMoves = useMemo(() => moves.filter((m) => m.type === 'dc_to_store'), [moves]);
  const storeMoves = useMemo(() => moves.filter((m) => m.type === 'store_to_store'), [moves]);
  const activeMoves = tab === 'dc_to_store' ? dcMoves : storeMoves;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeMoves;
    return activeMoves.filter(
      (m) =>
        m.fromLabel.toLowerCase().includes(q) ||
        m.toLabel.toLowerCase().includes(q) ||
        m.item.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q)
    );
  }, [activeMoves, query]);

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
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[201] w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700"
            role="dialog"
            aria-modal="true"
            aria-labelledby="moves-drawer-title"
          >
            <header className="shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="moves-drawer-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Stock reallocation plan
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {moves.length} proposed moves · {sumCases(moves)} cases total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-1 mt-4 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-lg">
                {(['dc_to_store', 'store_to_store'] as const).map((t) => {
                  const count = t === 'dc_to_store' ? dcMoves.length : storeMoves.length;
                  const Icon = TAB_META[t].icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTab(t);
                        setExpandedKey(null);
                      }}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-colors',
                        tab === t
                          ? 'bg-white dark:bg-slate-900 text-[#4A7394] shadow-sm'
                          : 'text-slate-600 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {TAB_META[t].label}
                      <span className="tabular-nums text-[10px] opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${meta.short}…`}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-[#6A9EC8]/30"
                />
              </div>
            </header>

            <div className="shrink-0 px-5 py-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
              Showing {filtered.length} of {activeMoves.length} · {sumCases(filtered)} cases
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No moves match your search.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((move, i) => {
                    const key = moveKey(move, i);
                    const expanded = expandedKey === key;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => setExpandedKey(expanded ? null : key)}
                          className={cn(
                            'w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors',
                            expanded && 'bg-[#EDF3F9]/40 dark:bg-slate-800/60'
                          )}
                          aria-expanded={expanded}
                        >
                          <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {move.fromLabel}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {move.toLabel}
                            </span>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <div className="text-xs font-bold">{move.cases}</div>
                            <div className="text-[10px] text-slate-500">{move.item}</div>
                          </div>
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform',
                              expanded && 'rotate-180'
                            )}
                          />
                        </button>
                        {expanded && <MoveDetailPanel move={move} />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer className="shrink-0 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function sumReallocationCases(moves: ReallocationMove[]) {
  return sumCases(moves);
}
