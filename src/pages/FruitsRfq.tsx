/**
 * Contracts — standing orders with an assigned supplier (award already done upstream).
 * Supplier uploads shipping → PO created.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import {
  Building2,
  CheckCircle2,
  Filter,
  Maximize2,
  Minimize2,
  Package,
  Repeat,
  Search,
  Thermometer,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass, statGridClass } from '../components/PageChrome';
import { btnSecondaryClass } from '../lib/sapTheme';
import { usePersona } from '../context/PersonaContext';
import {
  cadenceLabel,
  formatRepeatSummary,
  getAwardedQuote,
  getQuoteRepeat,
  loadFruitsRfqs,
  resetFruitsRfqDemo,
  toContractNumber,
  type FruitsRfq,
} from '../lib/fruitsRfqFlow';

function statusLabel(status: FruitsRfq['status']) {
  switch (status) {
    case 'open':
      return 'Open';
    case 'review':
      return 'In review';
    case 'awarded':
      return 'Awaiting shipping';
    case 'po_created':
      return 'PO created';
  }
}

function statusClass(status: FruitsRfq['status']) {
  switch (status) {
    case 'open':
    case 'review':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'awarded':
      return 'bg-blue-50 text-[#2F5472] border-[#4684AD]/30';
    case 'po_created':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
}

type ContractStatusFilter = 'all' | 'awarded' | 'po_created';

const STATUS_FILTER_LABELS: Record<ContractStatusFilter, string> = {
  all: 'All',
  awarded: 'Awaiting shipping',
  po_created: 'PO created',
};

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AssignedSupplierCard({ rfq }: { rfq: FruitsRfq }) {
  const quote = getAwardedQuote(rfq);
  const vendor = rfq.awardedVendor ?? quote?.vendor ?? '—';
  const perDrop =
    quote != null
      ? Math.round(quote.pricePerCase * getQuoteRepeat(quote, rfq).qtyPerDelivery)
      : null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-[#C0D5E5]/50 border border-[#4684AD]/25 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-[#2F5472]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Assigned supplier
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white truncate">{vendor}</div>
          {quote?.fleetSpecification && (
            <div className="text-xs text-slate-500">{quote.fleetSpecification}</div>
          )}
        </div>
      </div>

      {quote && (
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">Price / case</div>
            <div className="text-sm font-bold tabular-nums mt-0.5">${quote.pricePerCase.toFixed(2)}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">Per drop</div>
            <div className="text-sm font-bold tabular-nums mt-0.5">
              ${(perDrop ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">Program value</div>
            <div className="text-sm font-bold tabular-nums mt-0.5">
              ${quote.totalPrice.toLocaleString()}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">First ETA</div>
            <div className="text-sm font-bold mt-0.5">{formatDate(quote.eta)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FruitsRfq() {
  const { persona } = usePersona();
  const [rfqs, setRfqs] = useState<FruitsRfq[]>(() => loadFruitsRfqs());
  const [selectedId, setSelectedId] = useState<string>('RFQ-F-2026-001');
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatusFilter>(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status === 'awarded' || status === 'po_created') return status;
    if (status === 'pending') return 'awarded';
    return 'all';
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRfqs(loadFruitsRfqs());
    const status = new URLSearchParams(window.location.search).get('status');
    if (status === 'awarded' || status === 'po_created') setStatusFilter(status);
    if (status === 'pending') setStatusFilter('awarded');
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!detailExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailExpanded]);

  const filteredRfqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rfqs.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.id,
        toContractNumber(r.id),
        r.item,
        r.fruitItem,
        r.destination,
        r.awardedVendor,
        cadenceLabel(r.repeat.cadence),
        r.repeat.deliveryDays,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rfqs, search, statusFilter]);

  useEffect(() => {
    if (filteredRfqs.length === 0) return;
    if (!filteredRfqs.some((r) => r.id === selectedId)) {
      setSelectedId(filteredRfqs[0].id);
    }
  }, [filteredRfqs, selectedId]);

  const selected = filteredRfqs.find((r) => r.id === selectedId) ?? filteredRfqs[0];

  useEffect(() => {
    if (!selected) setDetailExpanded(false);
  }, [selected]);

  const stats = useMemo(() => {
    const assigned = rfqs.filter((r) => Boolean(r.awardedVendor)).length;
    const awaiting = rfqs.filter((r) => r.status === 'awarded').length;
    const created = rfqs.filter((r) => r.status === 'po_created').length;
    return { assigned, awaiting, created };
  }, [rfqs]);

  const handleResetDemo = () => {
    resetFruitsRfqDemo();
    const next = loadFruitsRfqs();
    setRfqs(next);
    setSelectedId('RFQ-F-2026-001');
    setDetailExpanded(false);
    setToast('Demo reset — contracts restored with assigned suppliers awaiting shipping.');
    setTimeout(() => setToast(null), 7000);
  };

  if (persona === 'supplier') {
    return <Navigate to="/orders" replace />;
  }

  if (persona !== 'dc_purchasing_fruits') {
    return (
      <div className={pageShellClass}>
        <PageHeader
          title="Contracts"
          subtitle="Switch to DC Purchasing — Fruits to manage standing-order contracts."
        />
      </div>
    );
  }

  return (
    <div className={cn(pageShellClass, 'flex flex-col')}>
      {!detailExpanded && (
        <PageHeader eyebrow="Procurement" title="Contracts">
          <button
            type="button"
            onClick={handleResetDemo}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
          >
            Reset demo
          </button>
          <Link to="/orders" className={btnSecondaryClass}>
            <Package className="w-4 h-4" />
            View POs
          </Link>
        </PageHeader>
      )}

      {toast && !detailExpanded && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{toast}</span>
        </div>
      )}

      {!detailExpanded && (
        <div className={statGridClass}>
          <StatCard label="Assigned contracts" value={String(stats.assigned)} />
          <StatCard label="Awaiting supplier shipping" value={String(stats.awaiting)} />
          <StatCard label="PO created" value={String(stats.created)} />
        </div>
      )}

      <div
        className={cn(
          'flex-1 min-h-[480px] grid gap-3',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(240px,300px)_1fr]'
        )}
      >
        <section
          className={cn(
            'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col min-h-0',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              Active contracts
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {filteredRfqs.length} of {rfqs.length}
              {statusFilter !== 'all' ? ` · ${STATUS_FILTER_LABELS[statusFilter]}` : ''}
            </p>
          </div>

          <div className="shrink-0 p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40"
                />
              </div>
              <div className="relative shrink-0" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    statusFilter !== 'all' || filterOpen
                      ? 'border-[#4684AD] bg-[#C0D5E5]/50 text-[#2F5472]'
                      : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                  )}
                  aria-expanded={filterOpen}
                  aria-haspopup="listbox"
                  title="Filter by status"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                </button>
                {filterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Status
                    </div>
                    {(Object.keys(STATUS_FILTER_LABELS) as ContractStatusFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="option"
                        aria-selected={statusFilter === f}
                        onClick={() => {
                          setStatusFilter(f);
                          setFilterOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                          statusFilter === f
                            ? 'bg-[#C0D5E5]/60 text-[#2F5472]'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        {STATUS_FILTER_LABELS[f]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {rfqs.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No active contracts.</p>
            ) : filteredRfqs.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No contracts match your search or filters.</p>
            ) : (
              filteredRfqs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors',
                    selected?.id === r.id
                      ? 'bg-[#C0D5E5]/50 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  )}
                >
                  <div className="text-sm font-code font-semibold text-[#4684AD]">
                    {toContractNumber(r.id)}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate">
                    {r.item}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {r.awardedVendor ?? 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        'text-[11px] font-bold uppercase px-2 py-0.5 rounded border',
                        statusClass(r.status)
                      )}
                    >
                      {statusLabel(r.status)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {cadenceLabel(r.repeat.cadence)} · {r.repeat.qtyPerDelivery.toLocaleString()}{' '}
                      cs/drop
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {selected && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-code font-bold text-[#4684AD]">
                      {toContractNumber(selected.id)}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-bold uppercase px-2 py-0.5 rounded border',
                        statusClass(selected.status)
                      )}
                    >
                      {statusLabel(selected.status)}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.item}</h2>
                  <p className="text-xs text-slate-500">
                    {selected.destination} · first delivery {formatDate(selected.deliveryDate)}
                    {selected.awardedVendor ? ` · Supplier: ${selected.awardedVendor}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailExpanded((v) => !v)}
                  className="shrink-0 p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-slate-500 hover:text-[#2F5472] hover:border-[#4684AD]/50 transition-colors"
                  title={detailExpanded ? 'Exit full screen (Esc)' : 'Expand to full screen'}
                  aria-label={detailExpanded ? 'Exit full screen' : 'Expand to full screen'}
                >
                  {detailExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                    <Repeat className="w-3 h-3" />
                    Cadence
                  </div>
                  <div className="text-sm font-medium mt-1">{formatRepeatSummary(selected.repeat)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selected.repeat.qtyPerDelivery.toLocaleString()} cases / drop
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase text-slate-400">Volume</div>
                  <div className="text-sm font-medium mt-1">
                    {selected.quantity.toLocaleString()} cases / week
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selected.repeat.deliveries} drops · {selected.repeat.weeks} weeks
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                    <Thermometer className="w-3 h-3" />
                    Cold chain
                  </div>
                  <div className="text-sm font-medium mt-1">{selected.specifications.tempRange}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selected.specifications.minShelfLife}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase text-slate-400">Spec</div>
                  <div className="text-sm font-medium mt-1">{selected.specifications.sizeSpec}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Who supplies this contract
                </h3>
                <AssignedSupplierCard rfq={selected} />
              </div>

              {selected.status === 'po_created' && selected.poNumber && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    PO created
                  </div>
                  <p>
                    Purchase order <strong className="font-code">{selected.poNumber}</strong> is ready.
                    Open{' '}
                    <Link to={`/orders?po=${selected.poNumber}`} className="text-[#4684AD] underline">
                      SAP Purchase Orders
                    </Link>{' '}
                    or Logistics Tracking.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
