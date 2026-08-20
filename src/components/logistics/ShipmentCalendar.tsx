import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Ship,
  Truck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Shipment } from '../../lib/shipmentTypes';
import {
  barStyleInWindow,
  format,
  getShipmentSpan,
  getTimelineWindow,
  groupShipmentsBySupplier,
  shiftTimelineAnchor,
  spansOverlapWindow,
  type TimelineScale,
} from '../../lib/shipmentCalendar';

type StatusFilter = 'all' | Shipment['status'];

interface Props {
  shipments: Shipment[];
  searchQuery?: string;
  onSelectShipment: (id: string) => void;
  className?: string;
}

const STATUS_BAR: Record<Shipment['status'], string> = {
  'on-time': 'bg-emerald-500 hover:bg-emerald-400 border-emerald-600/40',
  delayed: 'bg-rose-500 hover:bg-rose-400 border-rose-600/40',
  delivered: 'bg-[#C0D5E5]/300 hover:bg-sky-400 border-sky-600/40',
};

const STATUS_LABEL: Record<Shipment['status'], string> = {
  'on-time': 'On-time',
  delayed: 'Delayed',
  delivered: 'Delivered',
};

export function ShipmentCalendar({
  shipments,
  searchQuery = '',
  onSelectShipment,
  className,
}: Props) {
  const [scale, setScale] = useState<TimelineScale>('day');
  const [anchor, setAnchor] = useState(() => new Date());
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'ocean' | 'road'>('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const suppliers = useMemo(() => {
    const set = new Set(shipments.map((s) => s.vendor).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shipments]);

  const window = useMemo(() => getTimelineWindow(scale, anchor), [scale, anchor]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shipments.filter((s) => {
      if (supplierFilter !== 'all' && s.vendor !== supplierFilter) return false;
      if (status !== 'all' && s.status !== status) return false;
      if (modeFilter !== 'all' && (s.transportMode || 'road') !== modeFilter) return false;
      if (q) {
        const hay = `${s.id} ${s.vendor} ${s.product} ${s.item} ${s.containerNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return spansOverlapWindow(getShipmentSpan(s), window.start, window.end);
    });
  }, [shipments, supplierFilter, status, modeFilter, searchQuery, window]);

  const rows = useMemo(() => groupShipmentsBySupplier(filtered), [filtered]);

  const summary = useMemo(() => {
    const c = { delayed: 0, 'on-time': 0, delivered: 0, ocean: 0, road: 0, total: filtered.length };
    filtered.forEach((s) => {
      c[s.status] += 1;
      if (s.transportMode === 'ocean') c.ocean += 1;
      else c.road += 1;
    });
    return c;
  }, [filtered]);

  const activeFilters =
    (supplierFilter !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (modeFilter !== 'all' ? 1 : 0);

  const colMin =
    scale === 'day' ? 36 : scale === 'week' ? 88 : 72;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 flex flex-col',
        className
      )}
    >
      {/* Toolbar */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-bold tracking-tight">Supplier shipment calendar</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Rows = suppliers · bars span departure → ETA · {summary.total} lots in view
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
              {(
                [
                  ['day', 'Days'],
                  ['week', 'Weeks'],
                  ['month', 'Months'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScale(id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                    scale === id ? 'bg-[#4684AD] text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAnchor((d) => shiftTimelineAnchor(scale, d, -1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-[140px] text-center text-xs font-semibold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 dark:bg-white/10 dark:border-white/10">
                {window.label}
              </span>
              <button
                type="button"
                onClick={() => setAnchor((d) => shiftTimelineAnchor(scale, d, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setAnchor(new Date())}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10"
              >
                Today
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border',
                filtersOpen
                  ? 'bg-[#4684AD] border-[#4684AD] text-white'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:border-white/15 dark:hover:bg-white/10'
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Supplier
              </span>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="all">All suppliers</option>
                {suppliers.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="all">All statuses</option>
                <option value="on-time">On-time</option>
                <option value="delayed">Delayed</option>
                <option value="delivered">Delivered</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Transport
              </span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as 'all' | 'ocean' | 'road')}
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="all">Sea &amp; land</option>
                <option value="ocean">Sea only</option>
                <option value="road">Land only</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSupplierFilter('all');
                    setStatus('all');
                    setModeFilter('all');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-2 py-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gantt grid */}
      <div className="flex min-h-0 flex-1 overflow-auto">
        {/* Sticky supplier column */}
        <div className="sticky left-0 z-20 shrink-0 w-[200px] sm:w-[240px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[4px_0_12px_rgba(0,0,0,0.06)]">
          <div className="h-12 px-3 flex items-center text-[10px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            Supplier
          </div>
          {rows.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">No suppliers in this window.</div>
          ) : (
            rows.map((row) => {
              const barCount = row.shipments.length;
              const rowH = Math.max(56, 28 + barCount * 22);
              const healthy = row.delayed === 0;
              return (
                <div
                  key={row.vendor}
                  className="px-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"
                  style={{ height: rowH }}
                >
                  {healthy ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {row.vendor}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {barCount} lot{barCount === 1 ? '' : 's'}
                      {row.delayed > 0 ? ` · ${row.delayed} delayed` : ' · on track'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Timeline */}
        <div className="min-w-0 flex-1">
          <div
            className="h-12 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex"
            style={{ minWidth: window.columns.length * colMin }}
          >
            {window.columns.map((col) => (
              <div
                key={col.key}
                className="flex-1 border-r border-slate-200/80 dark:border-slate-800 px-0.5 flex flex-col items-center justify-center"
                style={{ minWidth: colMin }}
              >
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {col.label}
                </span>
                {col.subLabel && (
                  <span className="text-[8px] text-slate-400 leading-none mt-0.5">{col.subLabel}</span>
                )}
              </div>
            ))}
          </div>

          {rows.map((row) => {
            const barCount = row.shipments.length;
            const rowH = Math.max(56, 28 + barCount * 22);
            return (
              <div
                key={row.vendor}
                className="relative border-b border-slate-100 dark:border-slate-800"
                style={{
                  height: rowH,
                  minWidth: window.columns.length * colMin,
                }}
              >
                {/* Column guides via absolute grid */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {window.columns.map((col) => (
                    <div
                      key={col.key}
                      className="flex-1 border-r border-slate-100 dark:border-slate-800/80"
                      style={{ minWidth: colMin }}
                    />
                  ))}
                </div>

                <div className="absolute inset-x-1 top-2 bottom-2">
                  {row.shipments.map((s, idx) => {
                    const span = getShipmentSpan(s);
                    const geo = barStyleInWindow(span, window.start, window.end);
                    if (!geo) return null;
                    const top = idx * 22;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={`${s.id} · ${s.product || s.item} · ${STATUS_LABEL[s.status]} · ${format(span.start, 'MMM d')} → ${format(span.end, 'MMM d')}`}
                        onClick={() => onSelectShipment(s.id)}
                        onMouseEnter={() => setHoverId(s.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className={cn(
                          'absolute h-[18px] rounded-full border text-[9px] font-bold text-white px-2 flex items-center gap-1 overflow-hidden shadow-sm transition-transform',
                          STATUS_BAR[s.status],
                          hoverId === s.id && 'ring-2 ring-offset-1 ring-sky-400 z-10 scale-[1.02]'
                        )}
                        style={{ left: geo.left, width: geo.width, top }}
                      >
                        {s.transportMode === 'ocean' ? (
                          <Ship className="w-3 h-3 shrink-0 opacity-90" />
                        ) : (
                          <Truck className="w-3 h-3 shrink-0 opacity-90" />
                        )}
                        <span className="truncate">
                          {s.id.replace('PO-2026-', '')} · {s.product || s.item}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-500">
              No shipments overlap this period. Try another range or clear filters.
            </div>
          )}
        </div>

        {/* Right summary rail */}
        <div className="hidden lg:flex sticky right-0 z-20 w-[180px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="h-12 px-3 flex items-center text-[10px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800">
            Period summary
          </div>
          <div className="p-3 space-y-3 text-xs">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase text-slate-400">In view</div>
              <div className="flex justify-between"><span>Total lots</span><strong>{summary.total}</strong></div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>On-time</span><strong>{summary['on-time']}</strong></div>
              <div className="flex justify-between text-rose-600"><span>Delayed</span><strong>{summary.delayed}</strong></div>
              <div className="flex justify-between text-[#4684AD]"><span>Delivered</span><strong>{summary.delivered}</strong></div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Transport</div>
              <div className="flex justify-between items-center gap-1"><span className="inline-flex items-center gap-1"><Ship className="w-3 h-3" /> Sea</span><strong>{summary.ocean}</strong></div>
              <div className="flex justify-between items-center gap-1"><span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /> Land</span><strong>{summary.road}</strong></div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Legend</div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center gap-2"><span className="w-6 h-2.5 rounded-full bg-emerald-500" /> On-time</div>
                <div className="flex items-center gap-2"><span className="w-6 h-2.5 rounded-full bg-rose-500" /> Delayed</div>
                <div className="flex items-center gap-2"><span className="w-6 h-2.5 rounded-full bg-[#C0D5E5]/300" /> Delivered</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
