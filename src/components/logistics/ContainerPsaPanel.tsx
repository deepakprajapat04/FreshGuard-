import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  Package,
  Save,
  Search,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSyncAge, type ContainerUpdatePayload } from '../../lib/psa';
import {
  getContainerCargoLines,
  getShipmentCargoLines,
  type Shipment,
} from '../../lib/shipmentTypes';
import { PsaEventTimeline } from './PsaEventTimeline';

interface Props {
  shipments: Shipment[];
  searchQuery: string;
  selectedShipment: Shipment | undefined;
  selectedShipmentId: string;
  isVendor: boolean;
  containerForm: ContainerUpdatePayload;
  savingContainer: boolean;
  onSelect: (id: string) => void;
  onFormChange: (next: ContainerUpdatePayload) => void;
  onSave: () => void;
}

type StatusFilter = 'all' | Shipment['status'];
type ModeFilter = 'all' | 'ocean' | 'air' | 'road';
type SyncFilter = 'all' | 'synced' | 'syncing' | 'pending' | 'error';

export function ContainerPsaPanel({
  shipments,
  searchQuery,
  selectedShipment,
  selectedShipmentId,
  isVendor,
  containerForm,
  savingContainer,
  onSelect,
  onFormChange,
  onSave,
}: Props) {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [syncFilter, setSyncFilter] = useState<SyncFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [showAllPos, setShowAllPos] = useState(true);
  const [poQuery, setPoQuery] = useState('');

  const suppliers = useMemo(() => {
    const set = new Set(shipments.map((s) => s.vendor).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shipments]);

  const list = useMemo(() => {
    const q = `${searchQuery} ${localSearch}`.trim().toLowerCase();
    return shipments.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (modeFilter !== 'all' && (s.transportMode || 'road') !== modeFilter) return false;
      if (syncFilter !== 'all' && (s.psaSyncStatus || 'pending') !== syncFilter) return false;
      if (supplierFilter !== 'all' && s.vendor !== supplierFilter) return false;
      if (!q) return true;
      const lines = getShipmentCargoLines(s);
      const hay = [
        s.id,
        s.containerNumber || '',
        s.product || '',
        s.item || '',
        s.vendor,
        s.vesselName || '',
        ...lines.flatMap((l) => [l.poNumber, l.product, l.item, l.sku || '']),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [shipments, searchQuery, localSearch, statusFilter, modeFilter, syncFilter, supplierFilter]);

  const cargoLines = useMemo(() => {
    if (!selectedShipment) return [];
    return getContainerCargoLines(shipments, selectedShipment.containerNumber, selectedShipment);
  }, [shipments, selectedShipment]);

  const filteredCargo = useMemo(() => {
    const q = poQuery.trim().toLowerCase();
    if (!q) return cargoLines;
    return cargoLines.filter((l) =>
      `${l.poNumber} ${l.product} ${l.item} ${l.sku || ''} ${l.buyerRef || ''}`.toLowerCase().includes(q)
    );
  }, [cargoLines, poQuery]);

  const cargoTotals = useMemo(() => {
    const cases = cargoLines.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const pos = new Set(cargoLines.map((l) => l.poNumber)).size;
    return { cases, pos, lines: cargoLines.length };
  }, [cargoLines]);

  const filterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (modeFilter !== 'all' ? 1 : 0) +
    (syncFilter !== 'all' ? 1 : 0) +
    (supplierFilter !== 'all' ? 1 : 0) +
    (localSearch.trim() ? 1 : 0);

  const clearFilters = () => {
    setLocalSearch('');
    setStatusFilter('all');
    setModeFilter('all');
    setSyncFilter('all');
    setSupplierFilter('all');
  };

  const fields = [
    ['containerNumber', 'Container number'],
    ['vesselName', 'Vessel / fleet unit'],
    ['voyageNumber', 'Voyage number'],
    ['bookingNumber', 'Booking number'],
    ['psaTerminal', 'PSA terminal'],
    ['eta', 'ETA'],
    ['temp', 'Reefer temp'],
    ['origin', 'Origin / load point'],
  ] as const;

  return (
    <div className="w-full grid lg:grid-cols-12 gap-5">
      <div className="lg:col-span-4 space-y-3">
        <div className="rounded-xl bg-[#0c1e36] px-4 py-3 text-white space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-sky-200">
              {isVendor ? 'Select lot to update' : 'PSA container ledger'}
            </h3>
            <span className="text-[10px] text-slate-400 shrink-0">
              {list.length}
              {filterCount > 0 ? ` / ${shipments.length}` : ''} lots
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search PO, container, item…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0a1829] border border-sky-900/80 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
                filtersOpen || filterCount > 0
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {filterCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>
            {filterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-white/10">
              <label className="space-y-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full rounded-lg bg-[#0a1829] border border-sky-900/80 px-2.5 py-1.5 text-[11px] text-slate-100"
                >
                  <option value="all">All statuses</option>
                  <option value="on-time">On-time</option>
                  <option value="delayed">Delayed</option>
                  <option value="delivered">Delivered</option>
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Transport</span>
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
                  className="w-full rounded-lg bg-[#0a1829] border border-sky-900/80 px-2.5 py-1.5 text-[11px] text-slate-100"
                >
                  <option value="all">Sea &amp; land</option>
                  <option value="ocean">Sea only</option>
                  <option value="air">Air only</option>
                  <option value="road">Land only</option>
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">PSA sync</span>
                <select
                  value={syncFilter}
                  onChange={(e) => setSyncFilter(e.target.value as SyncFilter)}
                  className="w-full rounded-lg bg-[#0a1829] border border-sky-900/80 px-2.5 py-1.5 text-[11px] text-slate-100"
                >
                  <option value="all">All sync states</option>
                  <option value="synced">Synced</option>
                  <option value="syncing">Syncing</option>
                  <option value="pending">Pending</option>
                  <option value="error">Error</option>
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Supplier</span>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="w-full rounded-lg bg-[#0a1829] border border-sky-900/80 px-2.5 py-1.5 text-[11px] text-slate-100"
                >
                  <option value="all">All suppliers</option>
                  {suppliers.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {list.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No containers match these filters.
            </div>
          ) : (
            list.map((s) => {
              const lines = getShipmentCargoLines(s);
              const poCount = new Set(lines.map((l) => l.poNumber)).size;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelect(s.id);
                    setShowAllPos(true);
                    setPoQuery('');
                  }}
                  className={cn(
                    'w-full text-left p-3.5 rounded-xl border transition-all shadow-sm',
                    selectedShipmentId === s.id
                      ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50 dark:bg-sky-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {s.containerNumber}
                    </span>
                    <span className="text-[9px] font-mono uppercase text-sky-700 dark:text-sky-400">
                      {s.psaSyncStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                    <Package className="w-3 h-3" />
                    {poCount} PO{poCount === 1 ? '' : 's'} · {lines.length} item
                    {lines.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Lead {s.id} · {s.product || s.item}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                        s.status === 'delayed'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : s.status === 'delivered'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      )}
                    >
                      {s.status}
                    </span>
                    <span className="text-[9px] uppercase text-slate-400">
                      {s.transportMode || 'road'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="lg:col-span-8 space-y-4">
        {!selectedShipment ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center text-xs text-slate-400 font-mono">
            Select a container lot to view PSA details.
          </div>
        ) : (
          <>
            {isVendor ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-[#0c1e36] text-white flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black font-mono uppercase tracking-wider">
                      Supplier container update
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Changes publish to PSA Portnet® and appear on the retail tracking dashboard.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded shrink-0">
                    Last sync {formatSyncAge(selectedShipment.psaLastSyncAt)}
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {fields.map(([key, label]) => (
                      <label key={key} className="block space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                          {label}
                        </span>
                        <input
                          value={containerForm[key]}
                          onChange={(e) => onFormChange({ ...containerForm, [key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </label>
                    ))}
                    <label className="block space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                        Update notes
                      </span>
                      <textarea
                        value={containerForm.notes}
                        onChange={(e) => onFormChange({ ...containerForm, notes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Optional note for PSA event ledger…"
                      />
                    </label>
                  </div>
                  <button
                    onClick={onSave}
                    disabled={savingContainer}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider font-mono"
                  >
                    {savingContainer ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Push to PSA Portnet
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-[#0c1e36] text-white">
                  <h3 className="text-sm font-black font-mono uppercase tracking-wider">
                    Retail view · PSA mirrored data
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Read-only container details synced from supplier updates via PSA Portnet.
                  </p>
                </div>
                <dl className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs p-6">
                  {[
                    ['Container', selectedShipment.containerNumber],
                    ['Vessel', selectedShipment.vesselName],
                    ['Voyage', selectedShipment.voyageNumber],
                    ['Booking', selectedShipment.bookingNumber],
                    ['Terminal', selectedShipment.psaTerminal],
                    ['ETA', selectedShipment.eta],
                    ['Temp', selectedShipment.temp],
                    ['Origin', selectedShipment.origin],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/40"
                    >
                      <dt className="text-[9px] font-mono uppercase text-slate-400 font-bold">{k}</dt>
                      <dd className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {v || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Multi-PO cargo manifest */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
              <div className="px-5 py-3.5 bg-[#0f2744] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-sky-300" />
                    Shipped POs &amp; items
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {cargoTotals.pos} purchase order{cargoTotals.pos === 1 ? '' : 's'} ·{' '}
                    {cargoTotals.lines} line{cargoTotals.lines === 1 ? '' : 's'} ·{' '}
                    {cargoTotals.cases.toLocaleString()} total units in {selectedShipment.containerNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllPos((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                >
                  {showAllPos ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> View all POs
                    </>
                  )}
                </button>
              </div>

              {showAllPos && (
                <div className="p-4 space-y-3">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={poQuery}
                      onChange={(e) => setPoQuery(e.target.value)}
                      placeholder="Filter by PO, product, SKU, buyer…"
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs min-w-[640px]">
                      <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">PO number</th>
                          <th className="px-3 py-2.5 font-semibold">Product / item</th>
                          <th className="px-3 py-2.5 font-semibold">SKU</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Qty</th>
                          <th className="px-3 py-2.5 font-semibold">Buyer / DC</th>
                          <th className="px-3 py-2.5 font-semibold">Line status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredCargo.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                              No POs match this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredCargo.map((line) => (
                            <tr
                              key={`${line.poNumber}-${line.sku || line.product}`}
                              className="hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
                            >
                              <td className="px-3 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-100">
                                {line.poNumber}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {line.product}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{line.item}</div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">
                                {line.sku || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                {line.quantity.toLocaleString()}{' '}
                                <span className="text-[10px] font-normal text-slate-400">{line.unit}</span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                                {line.buyerRef || '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={cn(
                                    'inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                                    line.lineStatus === 'partial'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                      : line.lineStatus === 'held'
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  )}
                                >
                                  {line.lineStatus || 'shipped'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <PsaEventTimeline shipment={selectedShipment} />
          </>
        )}
      </div>
    </div>
  );
}
