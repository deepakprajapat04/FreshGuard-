import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select';
  filterOptions?: string[];
  /** Hide from default column visibility (still exportable if visible) */
  defaultHidden?: boolean;
  /** Value used for sort/filter/export */
  getValue?: (row: T) => string | number | boolean | null | undefined;
  /** Custom cell render */
  render?: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
};

type SortDir = 'asc' | 'desc' | null;

function cellValue<T>(row: T, col: DataTableColumn<T>): string {
  if (col.getValue) {
    const v = col.getValue(row);
    return v == null ? '' : String(v);
  }
  const raw = (row as Record<string, unknown>)[col.key];
  return raw == null ? '' : String(raw);
}

export function downloadExcelCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    const s = v.replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') || filename.endsWith('.csv') ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  title,
  subtitle,
  excelFileName = 'export',
  emptyMessage = 'No rows match the current filters.',
  className,
  toolbarExtra,
  initialFilterOpen = true,
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  title?: string;
  subtitle?: string;
  excelFileName?: string;
  emptyMessage?: string;
  className?: string;
  toolbarExtra?: ReactNode;
  initialFilterOpen?: boolean;
}) {
  const [globalQuery, setGlobalQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [filterBarOpen, setFilterBarOpen] = useState(initialFilterOpen);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key))
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  const selectOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    columns.forEach((col) => {
      if (col.filterType === 'select') {
        if (col.filterOptions?.length) {
          map[col.key] = col.filterOptions;
        } else {
          const set = new Set<string>();
          data.forEach((row) => {
            const v = cellValue(row, col).trim();
            if (v) set.add(v);
          });
          map[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b));
        }
      }
    });
    return map;
  }, [columns, data]);

  const processed = useMemo(() => {
    let rows = [...data];
    const q = globalQuery.trim().toLowerCase();

    if (q) {
      rows = rows.filter((row) =>
        columns.some((col) => cellValue(row, col).toLowerCase().includes(q))
      );
    }

    Object.entries(colFilters).forEach(([key, raw]) => {
      const filter = String(raw ?? '').trim().toLowerCase();
      if (!filter) return;
      const col = columns.find((c) => c.key === key);
      if (!col) return;
      rows = rows.filter((row) => {
        const v = cellValue(row, col).toLowerCase();
        if (col.filterType === 'select') return v === filter;
        return v.includes(filter);
      });
    });

    if (sortKey && sortDir) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        rows.sort((a, b) => {
          const av = cellValue(a, col);
          const bv = cellValue(b, col);
          const an = Number(av.replace(/[^0-9.-]/g, ''));
          const bn = Number(bv.replace(/[^0-9.-]/g, ''));
          let cmp = 0;
          if (!Number.isNaN(an) && !Number.isNaN(bn) && av.match(/[0-9]/) && bv.match(/[0-9]/)) {
            cmp = an - bn;
          } else {
            cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
          }
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return rows;
  }, [data, columns, globalQuery, colFilters, sortKey, sortDir]);

  const activeFilterCount =
    Object.values(colFilters).filter((v) => String(v ?? '').trim()).length +
    (globalQuery.trim() ? 1 : 0);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir('asc');
  };

  const toggleColumn = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        // Keep at least one visible column
        if (columns.length - next.size <= 1) return prev;
        next.add(key);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setGlobalQuery('');
    setColFilters({});
    setSortKey(null);
    setSortDir(null);
  };

  const exportExcel = () => {
    const headers = visibleColumns.map((c) => c.label);
    const rows = processed.map((row) => visibleColumns.map((c) => cellValue(row, c)));
    downloadExcelCsv(excelFileName, headers, rows);
  };

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">{title}</h3>
            )}
            {subtitle && <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 normal-case tracking-normal">{subtitle}</p>}
            <p className="text-[11px] text-sky-600 dark:text-sky-300 mt-1">
              Showing {processed.length} of {data.length} rows
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {toolbarExtra}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search all columns…"
                className="pl-8 pr-3 py-1.5 w-44 sm:w-56 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterBarOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase border transition-colors',
                filterBarOpen
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
              )}
              title={filterBarOpen ? 'Hide filters for more space' : 'Show column filters'}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {filterBarOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {activeFilterCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                title="Show / hide columns"
              >
                <Columns3 className="w-3.5 h-3.5" />
                Columns
              </button>
              {columnsOpen && (
                <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-2 py-1 mb-1">
                    Hide / unhide columns
                  </div>
                  {columns.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-slate-600"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/40"
              title="Download Excel-compatible file"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Collapsible column filter bar */}
        {filterBarOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-white/10">
            {visibleColumns
              .filter((c) => c.filterable !== false)
              .map((col) => (
                <div key={col.key} className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {col.label}
                  </label>
                  {col.filterType === 'select' ? (
                    <select
                      value={colFilters[col.key] || ''}
                      onChange={(e) =>
                        setColFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">All</option>
                      {(selectOptions[col.key] || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={colFilters[col.key] || ''}
                      onChange={(e) =>
                        setColFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      placeholder={`Filter ${col.label.toLowerCase()}…`}
                      className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold tracking-wide uppercase border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((col) => {
                const sortable = col.sortable !== false;
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 whitespace-nowrap select-none',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.headerClassName
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-sky-700 dark:hover:text-sky-600 dark:text-sky-300"
                      >
                        {col.label}
                        {active && sortDir === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                        ) : active && sortDir === 'desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {processed.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleColumns.length, 1)}
                  className="px-6 py-16 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              processed.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className="hover:bg-sky-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row, index) : cellValue(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Click-away for columns menu */}
      {columnsOpen && (
        <button
          type="button"
          aria-label="Close columns menu"
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setColumnsOpen(false)}
        />
      )}
    </div>
  );
}

export default DataTable;
