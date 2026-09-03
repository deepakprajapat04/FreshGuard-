/**
 * Supplier portal — fruit contracts → upload shipping → PO created; vegetable POs separately.
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Maximize2,
  Minimize2,
  Package,
  Search,
  Square,
  CheckSquare,
  Truck,
  Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { PageHeader, StatCard, statGridClass } from '../PageChrome';
import { btnPrimaryClass, btnSecondaryClass, contentCanvasClass } from '../../lib/sapTheme';
import { useNotifications } from '../../context/NotificationsContext';
import {
  looksLikeSampleAsn,
  parseAsnText,
  SAMPLE_ASN_CAPTURE,
} from '../../lib/asnCapture';
import {
  createPoFromFruitsRfqShipping,
  formatRepeatSummary,
  FRUITS_RFQ_SUPPLIER,
  cadenceLabel,
  getAwardedQuote,
  getQuoteRepeat,
  getRfqsAwaitingShipping,
  getRfqDropQty,
  getSupplierCompletedRfqs,
  loadFruitsRfqs,
  resetFruitsRfqDemo,
  SUPPLIER_SEEN_RFQS_KEY,
  toContractNumber,
  type FruitsRfq,
  type FruitsRfqCadence,
} from '../../lib/fruitsRfqFlow';
import { getAllPurchaseOrders, getPoDisplayStatus, getPurchasingLaneForPo, type SapPurchaseOrder } from '../../lib/trackingFlow';
import {
  downloadMassShippingExcel,
  looksLikeSpreadsheet,
  normalizeShipDate,
  parseMassShippingExcel,
} from '../../lib/rfqMassShipping';

type SupplierLane = 'fruits' | 'vegetables';
type CadenceFilter = 'all' | FruitsRfqCadence;
type VegStatusFilter = 'all' | 'in-transit' | 'asn-submitted' | 'received';

const CADENCE_FILTER_LABELS: Record<CadenceFilter, string> = {
  all: 'All',
  twice_weekly: '2× weekly',
  weekly: 'Weekly',
  three_times_weekly: '3× weekly',
};

const VEG_STATUS_FILTER_LABELS: Record<VegStatusFilter, string> = {
  all: 'All',
  'in-transit': 'In transit',
  'asn-submitted': 'ASN submitted',
  received: 'Received',
};

const STORAGE_KEY = 'freshguard-active-shipments-v6';

function poStatusClass(status: SapPurchaseOrder['status']) {
  if (status === 'In Transit') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (status === 'ASN Submitted') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'Received') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

type ShipRow = {
  asnNumber: string;
  containerNumber: string;
  shipDate: string;
  eta: string;
  originalEta: string;
  transportMode: string;
  carrier: string;
  vessel: string;
  voyage: string;
  origin: string;
  destination: string;
  incoterms: string;
  billOfLading: string;
  customs: string;
  tempRange: string;
  qtyExpected: string;
  qtyActual: string;
  amount: string;
};

function formatWhen(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function unitPriceFor(rfq: FruitsRfq): number {
  const quote = getAwardedQuote(rfq);
  return quote?.pricePerCase ?? rfq.unitPrice ?? 0;
}

function defaultShipRow(_rfq: FruitsRfq): ShipRow {
  return {
    asnNumber: '',
    containerNumber: '',
    shipDate: '',
    eta: '',
    originalEta: '',
    transportMode: '',
    carrier: '',
    vessel: '',
    voyage: '',
    origin: '',
    destination: '',
    incoterms: '',
    billOfLading: '',
    customs: '',
    tempRange: '',
    qtyExpected: '',
    qtyActual: '',
    amount: '',
  };
}

function loadSeenRfqIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SUPPLIER_SEEN_RFQS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function markRfqSeen(id: string) {
  const seen = loadSeenRfqIds();
  seen.add(id);
  localStorage.setItem(SUPPLIER_SEEN_RFQS_KEY, JSON.stringify([...seen]));
}

const TRANSPORT_MODE_OPTIONS = ['Sea', 'Land', 'Air'] as const;

const SHIP_FIELDS: {
  key: keyof ShipRow;
  label: string;
  type?: 'date' | 'text' | 'number' | 'select';
  options?: readonly string[];
}[] = [
  { key: 'asnNumber', label: 'ASN number' },
  { key: 'containerNumber', label: 'Container' },
  { key: 'shipDate', label: 'Ship date', type: 'date' },
  { key: 'eta', label: 'ETA', type: 'date' },
  { key: 'originalEta', label: 'Original ETA', type: 'date' },
  {
    key: 'transportMode',
    label: 'Transport mode',
    type: 'select',
    options: TRANSPORT_MODE_OPTIONS,
  },
  { key: 'carrier', label: 'Carrier' },
  { key: 'vessel', label: 'Vessel' },
  { key: 'voyage', label: 'Voyage' },
  { key: 'origin', label: 'Origin' },
  { key: 'destination', label: 'Destination' },
  { key: 'incoterms', label: 'Incoterms' },
  { key: 'billOfLading', label: 'Bill of lading' },
  { key: 'customs', label: 'Customs' },
  { key: 'tempRange', label: 'Temp range' },
  { key: 'qtyExpected', label: 'Qty expected', type: 'number' },
  { key: 'qtyActual', label: 'Qty actual', type: 'number' },
  { key: 'amount', label: 'Amount', type: 'number' },
];

/** All shipment fields are required before submit. */
function isShipRowComplete(row: ShipRow): boolean {
  return SHIP_FIELDS.every((f) => String(row[f.key] ?? '').trim().length > 0);
}

function missingShipFields(row: ShipRow): string[] {
  return SHIP_FIELDS.filter((f) => !String(row[f.key] ?? '').trim()).map((f) => f.label);
}

function ShippingEntryTable({
  rfqs,
  rows,
  onChange,
}: {
  rfqs: FruitsRfq[];
  rows: Record<string, ShipRow>;
  onChange: (rfqId: string, patch: Partial<ShipRow>) => void;
}) {
  const inputClass =
    'min-w-0 flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#4684AD]/40';

  return (
    <div className="space-y-4">
      {rfqs.map((rfq) => {
        const row = rows[rfq.id] ?? defaultShipRow(rfq);
        const price = unitPriceFor(rfq);
        const missing = missingShipFields(row);
        return (
          <div
            key={rfq.id}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 bg-white dark:bg-slate-900 rounded-t-xl">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Shipment details
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
                  <span className="font-code text-sm font-bold text-[#4684AD]">
                    {toContractNumber(rfq.id)}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {rfq.item}
                  </span>
                </div>
              </div>
              {missing.length > 0 ? (
                <span className="text-[11px] font-semibold text-amber-700">
                  {missing.length} required field{missing.length === 1 ? '' : 's'} left
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-700">Ready to submit</span>
              )}
            </div>

            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
              {SHIP_FIELDS.map((f) => {
                const empty = !String(row[f.key] ?? '').trim();
                return (
                  <label
                    key={f.key}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 bg-slate-50/60 dark:bg-slate-950/40',
                      empty
                        ? 'border-rose-200 dark:border-rose-900'
                        : 'border-slate-200 dark:border-slate-700'
                    )}
                  >
                    <span className="shrink-0 w-[6.5rem] text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {f.label}
                      <span className="text-rose-500" aria-hidden>
                        *
                      </span>
                    </span>
                    {f.type === 'select' ? (
                      <select
                        required
                        value={row[f.key]}
                        onChange={(e) => onChange(rfq.id, { [f.key]: e.target.value })}
                        className={cn(inputClass, empty && 'text-slate-400')}
                        aria-required
                      >
                        <option value="" disabled>
                          Select…
                        </option>
                        {(f.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : 'text'}
                        required
                        value={row[f.key]}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (f.key === 'qtyActual') {
                            const n = Number(value.replace(/,/g, ''));
                            onChange(rfq.id, {
                              qtyActual: value,
                              amount:
                                Number.isFinite(n) && n >= 0
                                  ? (n * price).toFixed(2)
                                  : row.amount,
                            });
                            return;
                          }
                          onChange(rfq.id, { [f.key]: value });
                        }}
                        className={cn(
                          inputClass,
                          (f.key === 'asnNumber' ||
                            f.key === 'containerNumber' ||
                            f.key === 'billOfLading' ||
                            f.key === 'voyage') &&
                            'font-code',
                          (f.type === 'number' ||
                            f.key === 'qtyExpected' ||
                            f.key === 'qtyActual' ||
                            f.key === 'amount') &&
                            'tabular-nums'
                        )}
                        inputMode={
                          f.type === 'number' ||
                          f.key === 'qtyExpected' ||
                          f.key === 'qtyActual' ||
                          f.key === 'amount'
                            ? 'decimal'
                            : undefined
                        }
                        placeholder={f.label}
                        aria-required
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SelectedRfqsTable({ rfqs }: { rfqs: FruitsRfq[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2.5">Contract</th>
            <th className="px-3 py-2.5">Item</th>
            <th className="px-3 py-2.5">Cadence</th>
            <th className="px-3 py-2.5">Price / case</th>
            <th className="px-3 py-2.5">Per drop</th>
            <th className="px-3 py-2.5">Cold chain</th>
            <th className="px-3 py-2.5">First drop</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rfqs.map((rfq) => {
            const quote = getAwardedQuote(rfq);
            const repeat = quote ? getQuoteRepeat(quote, rfq) : rfq.repeat;
            return (
              <tr key={rfq.id} className="align-top">
                <td className="px-3 py-2.5 font-code font-semibold text-[#4684AD] whitespace-nowrap">
                  {toContractNumber(rfq.id)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-slate-900 dark:text-white">{rfq.item}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{rfq.destination}</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatRepeatSummary(repeat)}</td>
                <td className="px-3 py-2.5 tabular-nums font-semibold">
                  {quote ? `$${quote.pricePerCase.toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                  {getRfqDropQty(rfq).toLocaleString()} cases
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{rfq.specifications.tempRange}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{rfq.deliveryDate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SupplierRfqPortal() {
  const { upsertMany } = useNotifications();
  const [awaiting, setAwaiting] = useState<FruitsRfq[]>(() =>
    getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER)
  );
  const [completed, setCompleted] = useState<FruitsRfq[]>(() =>
    getSupplierCompletedRfqs(FRUITS_RFQ_SUPPLIER)
  );
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadSeenRfqIds());
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER)[0]?.id ?? null
  );
  const [shippingByRfq, setShippingByRfq] = useState<Record<string, ShipRow>>({});
  const [pomsShipping, setPomsShipping] = useState<{ asnNumber: string; containerNumber: string } | null>(
    null
  );
  const [slipMsg, setSlipMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pomsResult, setPomsResult] = useState<{
    poNumber: string;
    rfqId: string;
    item: string;
  } | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [massMsg, setMassMsg] = useState<string | null>(null);
  const [massSaving, setMassSaving] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [lane, setLane] = useState<SupplierLane>('fruits');
  const [selectedVegPo, setSelectedVegPo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all');
  const [vegStatusFilter, setVegStatusFilter] = useState<VegStatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [pomsBatch, setPomsBatch] = useState<
    { poNumber: string; rfqId: string; item: string }[] | null
  >(null);

  const vegPos = useMemo(
    () => getAllPurchaseOrders().filter((p) => getPurchasingLaneForPo(p) === 'vegetables'),
    [awaiting, completed]
  );

  const filteredAwaiting = useMemo(() => {
    const q = search.trim().toLowerCase();
    return awaiting.filter((r) => {
      const cadence = (getAwardedQuote(r)?.repeat ?? r.repeat).cadence;
      if (cadenceFilter !== 'all' && cadence !== cadenceFilter) return false;
      if (!q) return true;
      const quote = getAwardedQuote(r);
      const haystack = [
        r.id,
        toContractNumber(r.id),
        r.item,
        r.fruitItem,
        r.destination,
        cadenceLabel(cadence),
        r.repeat.deliveryDays,
        quote?.vendor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [awaiting, search, cadenceFilter]);

  const filteredCompleted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return completed;
    return completed.filter((r) =>
      [r.id, toContractNumber(r.id), r.item, r.fruitItem, r.poNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [completed, search]);

  const filteredVegPos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vegPos.filter((o) => {
      const status = getPoDisplayStatus(o);
      if (vegStatusFilter === 'in-transit' && status !== 'In Transit') return false;
      if (vegStatusFilter === 'asn-submitted' && status !== 'ASN Submitted') return false;
      if (vegStatusFilter === 'received' && status !== 'Received') return false;
      if (!q) return true;
      const haystack = [
        o.po,
        o.item,
        o.supplier,
        o.shipmentDetail?.containerNumber,
        o.shipmentDetail?.asnNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [vegPos, search, vegStatusFilter]);

  const refresh = () => {
    setAwaiting(getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER));
    setCompleted(getSupplierCompletedRfqs(FRUITS_RFQ_SUPPLIER));
    loadFruitsRfqs();
  };

  useEffect(() => {
    refresh();
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
    setCheckedIds((ids) => ids.filter((id) => awaiting.some((r) => r.id === id)));
  }, [awaiting]);

  useEffect(() => {
    if (!detailExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailExpanded]);

  const allAwarded = useMemo(() => [...awaiting, ...completed], [awaiting, completed]);
  const selected = allAwarded.find((r) => r.id === selectedId) ?? awaiting[0] ?? completed[0] ?? null;
  const selectedCompleted = selected?.status === 'po_created' ? selected : null;
  const selectedAwaiting = selected?.status === 'awarded' ? selected : null;
  const awardedQuote = selected ? getAwardedQuote(selected) : undefined;
  const selectedVeg = vegPos.find((p) => p.po === selectedVegPo) ?? null;
  const linkedPo = useMemo(() => {
    if (!selectedCompleted?.poNumber) return null;
    return getAllPurchaseOrders().find((p) => p.po === selectedCompleted.poNumber) ?? null;
  }, [selectedCompleted?.poNumber, completed, awaiting]);

  useEffect(() => {
    if (!selected) setDetailExpanded(false);
  }, [selected]);

  useEffect(() => {
    if (lane !== 'vegetables') return;
    if (filteredVegPos.length === 0) return;
    if (!selectedVegPo || !filteredVegPos.some((p) => p.po === selectedVegPo)) {
      setSelectedVegPo(filteredVegPos[0].po);
    }
  }, [lane, filteredVegPos, selectedVegPo]);

  useEffect(() => {
    if (lane !== 'fruits') return;
    if (filteredAwaiting.length === 0) return;
    if (selectedId && completed.some((c) => c.id === selectedId)) return;
    if (!selectedId || !filteredAwaiting.some((r) => r.id === selectedId)) {
      setSelectedId(filteredAwaiting[0].id);
    }
  }, [lane, filteredAwaiting, selectedId, completed]);

  const selectRfq = (id: string) => {
    setSelectedId(id);
    setCheckedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPomsResult(null);
    setPomsBatch(null);
    setPomsShipping(null);
    markRfqSeen(id);
    setSeenIds(loadSeenRfqIds());
    setSlipMsg(null);
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const checkedRfqs = useMemo(
    () => awaiting.filter((r) => checkedIds.includes(r.id)),
    [awaiting, checkedIds]
  );
  const panelRfqs = useMemo(() => {
    if (checkedRfqs.length > 0) return checkedRfqs;
    return selectedAwaiting ? [selectedAwaiting] : [];
  }, [checkedRfqs, selectedAwaiting]);
  const allPendingChecked =
    filteredAwaiting.length > 0 && filteredAwaiting.every((r) => checkedIds.includes(r.id));

  useEffect(() => {
    setShippingByRfq((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const rfq of panelRfqs) {
        if (!next[rfq.id]) {
          next[rfq.id] = defaultShipRow(rfq);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [panelRfqs]);

  const resolveRfq = (rfqId: string) =>
    panelRfqs.find((r) => r.id === rfqId) ??
    awaiting.find((r) => r.id === rfqId) ??
    loadFruitsRfqs().find((r) => r.id === rfqId);

  const patchShipRow = (rfqId: string, patch: Partial<ShipRow>) => {
    setShippingByRfq((prev) => {
      const rfq = resolveRfq(rfqId);
      const base = prev[rfqId] ?? (rfq ? defaultShipRow(rfq) : undefined);
      if (!base) return prev;
      return { ...prev, [rfqId]: { ...base, ...patch } };
    });
  };

  const applySlipCapture = (asnNumber?: string, containerNumber?: string) => {
    setShippingByRfq((prev) => {
      const next = { ...prev };
      panelRfqs.forEach((rfq, i) => {
        const current = next[rfq.id] ?? defaultShipRow(rfq);
        next[rfq.id] = {
          ...current,
          asnNumber: asnNumber
            ? panelRfqs.length > 1
              ? `${asnNumber}-${String(i + 1).padStart(2, '0')}`
              : asnNumber
            : current.asnNumber,
          containerNumber: containerNumber || current.containerNumber,
        };
      });
      return next;
    });
  };

  const persistCreatedShipment = (
    poNumber: string,
    rfq: FruitsRfq,
    shipping: {
      asnNumber: string;
      containerNumber: string;
      eta: string;
      qtyActual: number;
      transportMode: string;
    }
  ) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const list = stored ? JSON.parse(stored) : [];
      const qty = shipping.qtyActual;
      list.unshift({
        id: poNumber,
        containerNumber: shipping.containerNumber,
        asnNumber: shipping.asnNumber,
        vendor: FRUITS_RFQ_SUPPLIER,
        product: rfq.item,
        item: `${qty} cases`,
        quantity: qty,
        unit: 'Cases',
        stage: 'packing',
        status: 'on-time',
        eta: shipping.eta,
        destination: rfq.destination,
        transportMode: shipping.transportMode,
        linkedPos: [poNumber],
        cargoLines: [
          {
            poNumber,
            product: rfq.fruitItem,
            item: rfq.fruitItem,
            quantity: qty,
            unit: 'Cases',
          },
        ],
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const applyMassShippingRows = (
    rows: {
      rfqId: string;
      asnNumber: string;
      containerNumber: string;
      shipDate: string;
      eta: string;
      originalEta?: string;
      transportMode?: string;
      carrier?: string;
      vessel?: string;
      voyage?: string;
      origin?: string;
      destination?: string;
      incoterms?: string;
      billOfLading?: string;
      customs?: string;
      tempRange?: string;
      qtyExpected?: string;
      qtyActual?: string;
      amount?: string;
    }[]
  ) => {
    const created: { poNumber: string; rfqId: string; item: string }[] = [];
    const skipped: string[] = [];
    const notifications: Parameters<typeof upsertMany>[0] = [];

    for (const row of rows) {
      const rfq =
        awaiting.find((r) => r.id === row.rfqId) ??
        getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER).find((r) => r.id === row.rfqId);
      if (!rfq) {
        skipped.push(toContractNumber(row.rfqId));
        continue;
      }
      if (!row.asnNumber.trim()) {
        skipped.push(`${toContractNumber(row.rfqId)} (no ASN)`);
        continue;
      }
      const expectedDefault = getRfqDropQty(rfq);
      const qtyExpected = Number(String(row.qtyExpected ?? '').replace(/,/g, '')) || expectedDefault;
      const qtyActual = Number(String(row.qtyActual ?? '').replace(/,/g, '')) || qtyExpected;
      const amountParsed = Number(String(row.amount ?? '').replace(/,/g, ''));
      const amount =
        Number.isFinite(amountParsed) && amountParsed > 0
          ? amountParsed
          : qtyActual * unitPriceFor(rfq);
      const transportMode = row.transportMode?.trim() || 'ocean';
      const incoterms = row.incoterms?.trim() || 'FOB Valparaíso';
      const eta = row.eta.trim() ? normalizeShipDate(row.eta) : '';
      const result = createPoFromFruitsRfqShipping({
        rfqId: row.rfqId,
        asnNumber: row.asnNumber.trim(),
        containerNumber: row.containerNumber.trim(),
        shipDate: normalizeShipDate(row.shipDate),
        eta,
        quantity: qtyActual,
        quantityExpected: qtyExpected,
        quantityActual: qtyActual,
        amount,
        transportMode,
        incoterms,
        originalEta: row.originalEta?.trim()
          ? normalizeShipDate(row.originalEta)
          : eta,
        carrier: row.carrier?.trim(),
        vessel: row.vessel?.trim(),
        voyage: row.voyage?.trim(),
        origin: row.origin?.trim(),
        destination: row.destination?.trim() || rfq.destination,
        billOfLading: row.billOfLading?.trim(),
        customs: row.customs?.trim(),
        tempRange: row.tempRange?.trim() || rfq.specifications.tempRange,
      });
      if (!result) {
        skipped.push(`${toContractNumber(row.rfqId)} (already fulfilled)`);
        continue;
      }
      persistCreatedShipment(result.po.po, rfq, {
        asnNumber: row.asnNumber.trim(),
        containerNumber: row.containerNumber.trim(),
        eta,
        qtyActual,
        transportMode,
      });
      created.push({ poNumber: result.po.po, rfqId: rfq.id, item: rfq.item });
      notifications.push({
        id: `n-ship-${rfq.id}`,
        title: 'Shipping details uploaded',
        message: `${FRUITS_RFQ_SUPPLIER} submitted shipping for ${toContractNumber(rfq.id)} (${rfq.item}). Alert sent to DC Purchasing. After approval, DC will be notified that the PO is created.`,
        severity: 'info',
        category: 'Regular',
        timestamp: new Date().toISOString(),
        read: false,
        module: 'Procurement',
        href: `/orders?po=${result.po.po}`,
      });
    }

    if (notifications.length) upsertMany(notifications);
    refresh();
    getAllPurchaseOrders();
    setCheckedIds([]);
    return { created, skipped };
  };

  const downloadSelectedExcel = () => {
    const target = checkedRfqs.length > 0 ? checkedRfqs : awaiting;
    if (target.length === 0) {
      setMassMsg('No pending contracts to download.');
      return;
    }
    downloadMassShippingExcel(target);
    setMassMsg(
      `Downloaded ${target.length} contract${target.length > 1 ? 's' : ''}. Fill ASN number, container, ship date and ETA, then upload.`
    );
  };

  const onMassExcelUpload = (file: File) => {
    setMassMsg('Reading spreadsheet…');
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseMassShippingExcel(String(reader.result || ''));
      const fillable = rows.filter((r) => r.asnNumber.trim());
      if (rows.length === 0) {
        setMassMsg('Could not read Contract number column. Use the downloaded Excel template.');
        return;
      }
      if (fillable.length === 0) {
        setMassMsg(
          `Found ${rows.length} contract row${rows.length > 1 ? 's' : ''} but no ASN numbers. Fill ASN number (and container / ship date / ETA) then upload again.`
        );
        return;
      }
      setMassSaving(true);
      setTimeout(() => {
        const { created, skipped } = applyMassShippingRows(fillable);
        setMassSaving(false);
        if (created.length) {
          setPomsResult(null);
          setPomsBatch(created);
        }
        const parts = [`Submitted shipping for ${created.length} contract${created.length === 1 ? '' : 's'}. Alert sent to DC.`];
        if (skipped.length) parts.push(`Skipped: ${skipped.join(', ')}.`);
        setMassMsg(parts.join(' '));
      }, 500);
    };
    reader.readAsText(file);
  };

  const onMassDocumentUpload = (file: File) => {
    if (looksLikeSpreadsheet(file)) {
      onMassExcelUpload(file);
      return;
    }
    const ids = checkedRfqs.length > 0 ? checkedRfqs.map((r) => r.id) : awaiting.map((r) => r.id);
    if (ids.length === 0) {
      setMassMsg('Select contracts first, then attach a packing slip.');
      return;
    }
    setMassMsg(
      `Attached ${file.name} to ${ids.length} selected contract${ids.length > 1 ? 's' : ''}. Fill shipping in Excel or submit each contract.`
    );
  };

  useEffect(() => {
    if (selected && !seenIds.has(selected.id)) {
      markRfqSeen(selected.id);
      setSeenIds(loadSeenRfqIds());
    }
  }, [selected, seenIds]);

  const onSlipUpload = async (file: File) => {
    setSlipMsg('Reading ASN…');
    if (file.type.startsWith('text/') || /\.csv|txt$/i.test(file.name)) {
      const tr = new FileReader();
      tr.onload = () => {
        const cap = parseAsnText(String(tr.result || ''), file.name);
        if (cap?.asnNumber || cap?.containerNumber) {
          applySlipCapture(cap.asnNumber, cap.containerNumber);
        }
        setSlipMsg(
          cap
            ? panelRfqs.length > 1
              ? `Captured from ${file.name} — unique ASN applied to each contract.`
              : `Captured from ${file.name}`
            : 'Could not parse file.'
        );
      };
      tr.readAsText(file);
    } else if (looksLikeSampleAsn(file.name)) {
      applySlipCapture(SAMPLE_ASN_CAPTURE.asnNumber, SAMPLE_ASN_CAPTURE.containerNumber);
      setSlipMsg(
        panelRfqs.length > 1
          ? 'Sample ASN captured — unique ASN applied to each contract.'
          : 'Sample ASN captured.'
      );
    } else {
      setSlipMsg(`Attached ${file.name} — enter fields in the table.`);
    }
  };

  const submitShipping = () => {
    const incomplete = panelRfqs.find((rfq) => {
      const row = shippingByRfq[rfq.id] ?? defaultShipRow(rfq);
      return !isShipRowComplete(row);
    });
    if (incomplete) {
      const row = shippingByRfq[incomplete.id] ?? defaultShipRow(incomplete);
      const missing = missingShipFields(row);
      setSlipMsg(
        `Fill all required fields for ${toContractNumber(incomplete.id)}: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}.`
      );
      return;
    }

    const rows = panelRfqs.map((rfq) => {
      const row = shippingByRfq[rfq.id] ?? defaultShipRow(rfq);
      return {
        rfqId: rfq.id,
        asnNumber: row.asnNumber.trim(),
        containerNumber: row.containerNumber.trim(),
        shipDate: row.shipDate,
        eta: row.eta.trim() ? normalizeShipDate(row.eta) : '',
        originalEta: row.originalEta.trim() ? normalizeShipDate(row.originalEta) : '',
        transportMode: row.transportMode,
        carrier: row.carrier,
        vessel: row.vessel,
        voyage: row.voyage,
        origin: row.origin,
        destination: row.destination,
        incoterms: row.incoterms,
        billOfLading: row.billOfLading,
        customs: row.customs,
        tempRange: row.tempRange,
        qtyExpected: row.qtyExpected,
        qtyActual: row.qtyActual,
        amount: row.amount,
      };
    });
    setSaving(true);
    setTimeout(() => {
      const { created, skipped } = applyMassShippingRows(rows);
      setSaving(false);
      if (created.length === 1) {
        const row = rows.find((r) => r.rfqId === created[0].rfqId);
        setPomsBatch(null);
        setPomsResult(created[0]);
        setPomsShipping({
          asnNumber: row?.asnNumber ?? '',
          containerNumber: row?.containerNumber ?? '',
        });
      } else if (created.length > 1) {
        setPomsResult(null);
        setPomsShipping(null);
        setPomsBatch(created);
      }
      if (skipped.length) {
        setSlipMsg(`Skipped: ${skipped.join(', ')}.`);
      }
    }, 800);
  };

  const handleResetDemo = () => {
    resetFruitsRfqDemo();
    setPomsResult(null);
    setPomsBatch(null);
    setPomsShipping(null);
    setShippingByRfq({});
    setCheckedIds([]);
    setMassMsg(null);
    setDetailExpanded(false);
    setSelectedId(getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER)[0]?.id ?? null);
    setSeenIds(new Set());
    refresh();
  };

  return (
    <div
      className={cn(
        contentCanvasClass,
        'p-3 sm:p-4 w-full h-full min-h-0 flex flex-col gap-3 overflow-hidden text-slate-900 dark:text-slate-100'
      )}
    >
      {!detailExpanded && (
        <PageHeader
          title="Shipment details"
          className="sticky top-0 z-30 shrink-0 bg-white dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={handleResetDemo}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
          >
            Reset demo
          </button>
        </PageHeader>
      )}

      {!detailExpanded && (
        <div className={cn(statGridClass, 'shrink-0')}>
          <StatCard label="Fruit contracts pending" value={String(awaiting.length)} tone="amber" />
          <StatCard label="Vegetable POs" value={String(vegPos.length)} />
          <StatCard label="PO created" value={String(completed.length)} tone="emerald" />
        </div>
      )}

      <div
        className={cn(
          'flex-1 min-h-0 grid gap-3 grid-rows-1',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(260px,320px)_1fr]'
        )}
      >
        <section
          className={cn(
            'min-h-0 h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col',
            detailExpanded && 'hidden'
          )}
        >
          <div className="sticky top-0 z-20 px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-2 bg-white dark:bg-slate-900">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Shipping detail
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLane('fruits')}
                className={cn(
                  'flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border',
                  lane === 'fruits'
                    ? 'bg-[#4684AD] text-white border-[#4684AD]'
                    : 'border-slate-200 text-slate-500 dark:border-slate-700'
                )}
              >
                Fruits · Contracts
              </button>
              <button
                type="button"
                onClick={() => setLane('vegetables')}
                className={cn(
                  'flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border',
                  lane === 'vegetables'
                    ? 'bg-[#4684AD] text-white border-[#4684AD]'
                    : 'border-slate-200 text-slate-500 dark:border-slate-700'
                )}
              >
                Vegetables · PO
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {lane === 'fruits'
                ? `${filteredAwaiting.length} of ${awaiting.length} fruit contracts${
                    cadenceFilter !== 'all' ? ` · ${CADENCE_FILTER_LABELS[cadenceFilter]}` : ''
                  }`
                : `${filteredVegPos.length} of ${vegPos.length} vegetable POs${
                    vegStatusFilter !== 'all' ? ` · ${VEG_STATUS_FILTER_LABELS[vegStatusFilter]}` : ''
                  }`}
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    lane === 'fruits'
                      ? 'Search contract, item, cadence…'
                      : 'Search PO, item, supplier…'
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40"
                />
              </div>
              <div className="relative shrink-0" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    (lane === 'fruits' ? cadenceFilter !== 'all' : vegStatusFilter !== 'all') ||
                      filterOpen
                      ? 'border-[#4684AD] bg-[#C0D5E5]/50 text-[#2F5472]'
                      : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                  )}
                  aria-expanded={filterOpen}
                  aria-haspopup="listbox"
                  title={lane === 'fruits' ? 'Filter by cadence' : 'Filter by status'}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                </button>
                {filterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
                  >
                    {lane === 'fruits' ? (
                      <>
                        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Cadence
                        </div>
                        {(Object.keys(CADENCE_FILTER_LABELS) as CadenceFilter[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            role="option"
                            aria-selected={cadenceFilter === f}
                            onClick={() => {
                              setCadenceFilter(f);
                              setFilterOpen(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                              cadenceFilter === f
                                ? 'bg-[#C0D5E5]/60 text-[#2F5472]'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                            )}
                          >
                            {CADENCE_FILTER_LABELS[f]}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Status
                        </div>
                        {(Object.keys(VEG_STATUS_FILTER_LABELS) as VegStatusFilter[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            role="option"
                            aria-selected={vegStatusFilter === f}
                            onClick={() => {
                              setVegStatusFilter(f);
                              setFilterOpen(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                              vegStatusFilter === f
                                ? 'bg-[#C0D5E5]/60 text-[#2F5472]'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                            )}
                          >
                            {VEG_STATUS_FILTER_LABELS[f]}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {lane === 'fruits' && filteredAwaiting.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setCheckedIds(allPendingChecked ? [] : filteredAwaiting.map((r) => r.id))
                }
                className="text-[11px] font-bold uppercase tracking-wide text-[#4684AD] hover:underline"
              >
                {allPendingChecked ? 'Clear selection' : 'Select all pending'}
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {lane === 'fruits' ? (
              awaiting.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No pending shipping — check completed below.</p>
              ) : filteredAwaiting.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No contracts match your search or filters.</p>
              ) : (
                filteredAwaiting.map((r) => {
                  const isNew = !seenIds.has(r.id);
                  const quote = getAwardedQuote(r);
                  const checked = checkedIds.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'flex items-start gap-1 transition-colors',
                    selectedId === r.id
                      ? 'bg-[#C0D5E5]/50 dark:bg-slate-800'
                      : checked
                        ? 'bg-[#C0D5E5]/20 dark:bg-slate-800/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleChecked(r.id)}
                        className="shrink-0 p-3 text-slate-400 hover:text-[#4684AD]"
                        aria-label={
                          checked
                            ? `Unselect ${toContractNumber(r.id)}`
                            : `Select ${toContractNumber(r.id)}`
                        }
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-[#4684AD]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectRfq(r.id)}
                        className="flex-1 min-w-0 text-left py-3 pr-4"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-code font-semibold text-[#4684AD]">
                            {toContractNumber(r.id)}
                          </span>
                          {isNew && (
                            <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium mt-0.5 truncate">{r.item}</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {formatRepeatSummary(quote ? getQuoteRepeat(quote, r) : r.repeat)} ·{' '}
                          {getRfqDropQty(r).toLocaleString()} cs/drop · $
                          {quote?.pricePerCase.toFixed(2)}
                          /case · assigned {formatWhen(r.awardedAt)}
                        </div>
                      </button>
                    </div>
                  );
                })
              )
            ) : vegPos.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No vegetable purchase orders.</p>
            ) : filteredVegPos.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs match your search or filters.</p>
            ) : (
              filteredVegPos.map((o) => {
                const active = selectedVegPo === o.po;
                const displayStatus = getPoDisplayStatus(o);
                return (
                  <button
                    key={o.po}
                    type="button"
                    onClick={() => setSelectedVegPo(o.po)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      active
                        ? 'bg-[#C0D5E5]/50 dark:bg-slate-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <div className="text-xs font-code font-semibold text-[#4684AD]">{o.po}</div>
                    <div className="text-sm font-medium mt-0.5 truncate">{o.item}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          'text-[11px] font-bold uppercase px-2 py-0.5 rounded border',
                          poStatusClass(displayStatus)
                        )}
                      >
                        {displayStatus}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {o.orderedQty.toLocaleString()} cases · {o.supplier}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {lane === 'fruits' && filteredCompleted.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                <h3 className="text-[11px] font-bold uppercase text-slate-400">Completed · PO created</h3>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCompleted.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRfq(r.id)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-xs transition-colors',
                      selectedId === r.id
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <div className="font-code font-semibold text-emerald-700">{r.poNumber}</div>
                    <div className="text-slate-500 truncate">{r.item}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{toContractNumber(r.id)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="min-h-0 h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          {lane === 'vegetables' && selectedVeg ? (
            <>
              <div className="sticky top-0 z-20 shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-code font-bold text-[#4684AD]">{selectedVeg.po}</span>
                  <span
                    className={cn(
                      'text-[11px] font-bold uppercase px-2 py-0.5 rounded border',
                      poStatusClass(getPoDisplayStatus(selectedVeg))
                    )}
                  >
                    {getPoDisplayStatus(selectedVeg)}
                  </span>
                </div>
                <h2 className="text-lg font-bold mt-1">{selectedVeg.item}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedVeg.orderedQty.toLocaleString()} cases · {selectedVeg.supplier} · deliver to{' '}
                  {selectedVeg.destination} {selectedVeg.deliveryDate}
                </p>
              </div>
              <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Vegetable lane ships against an existing purchase order — not a fruit contract.
                </p>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400 font-bold">Buyer</div>
                    <div className="text-sm font-bold">{selectedVeg.buyer}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400 font-bold">Quantity</div>
                    <div className="text-sm font-bold">{selectedVeg.orderedQty.toLocaleString()} cases</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400 font-bold">Cold chain</div>
                    <div className="text-sm font-bold">{selectedVeg.itemDetail.storageTemp}</div>
                  </div>
                </div>
                {selectedVeg.shipmentDetail && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs space-y-1.5">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Shipping</div>
                    <div>
                      <span className="text-slate-400">ASN · </span>
                      {selectedVeg.shipmentDetail.asnNumber || '—'}
                    </div>
                    <div>
                      <span className="text-slate-400">Container · </span>
                      {selectedVeg.shipmentDetail.containerNumber || '—'}
                    </div>
                    <div>
                      <span className="text-slate-400">Ship date · </span>
                      {selectedVeg.shipmentDetail.shipDate}
                    </div>
                    <div>
                      <span className="text-slate-400">ETA · </span>
                      {selectedVeg.shipmentDetail.eta}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link to={`/orders?po=${selectedVeg.po}`} className={btnPrimaryClass}>
                    <Package className="w-4 h-4" />
                    View PO
                  </Link>
                  <Link to="/logistics" className={btnSecondaryClass}>
                    <Truck className="w-4 h-4" />
                    Logistics Tracking
                  </Link>
                </div>
              </div>
            </>
          ) : lane === 'vegetables' ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500 text-sm">
              No vegetable purchase orders.
            </div>
          ) : pomsBatch ? (
            <div className="p-6 flex flex-col items-center justify-center text-center flex-1 gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Shipment detail uploaded successfully
                </h2>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Shipping for {pomsBatch.length} contract{pomsBatch.length === 1 ? '' : 's'} was submitted
                  successfully. An alert has been sent to DC Purchasing. After approval, they will be
                  notified that the PO is created.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-xs w-full max-w-sm space-y-1.5">
                {pomsBatch.map((row) => (
                  <div key={row.rfqId} className="flex justify-between gap-2">
                    <span className="font-code text-[#4684AD]">{toContractNumber(row.rfqId)}</span>
                    <span className="text-slate-500 truncate">{row.item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link to="/logistics" className={btnSecondaryClass}>
                  <Truck className="w-4 h-4" />
                  Logistics Tracking
                </Link>
                <button
                  type="button"
                  className={btnPrimaryClass}
                  onClick={() => {
                    setPomsBatch(null);
                    setMassMsg(null);
                    const next = getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER)[0];
                    setSelectedId(next?.id ?? null);
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : pomsResult ? (
            <div className="p-6 flex flex-col items-center justify-center text-center flex-1 gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Shipment detail uploaded successfully
                </h2>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Shipping for <strong>{toContractNumber(pomsResult.rfqId)}</strong> was submitted
                  successfully. An alert has been sent to DC Purchasing. After approval, they will be
                  notified that the PO is created.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-xs w-full max-w-sm space-y-1">
                <div>
                  <span className="text-slate-400">Item · </span>
                  {pomsResult.item}
                </div>
                <div>
                  <span className="text-slate-400">ASN · </span>
                  {pomsShipping?.asnNumber ?? '—'}
                </div>
                <div>
                  <span className="text-slate-400">Container · </span>
                  {pomsShipping?.containerNumber || '—'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link to={`/orders?po=${pomsResult.poNumber}`} className={btnPrimaryClass}>
                  <Package className="w-4 h-4" />
                  View PO
                </Link>
                <Link to="/logistics" className={btnSecondaryClass}>
                  <Truck className="w-4 h-4" />
                  Logistics Tracking
                </Link>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  onClick={() => {
                    setPomsResult(null);
                    const next = getRfqsAwaitingShipping(FRUITS_RFQ_SUPPLIER)[0];
                    setSelectedId(next?.id ?? null);
                  }}
                >
                  Next contract
                </button>
              </div>
            </div>
          ) : selectedCompleted && panelRfqs.length === 0 ? (
            <>
              <div className="sticky top-0 z-20 shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-code font-bold text-[#4684AD]">
                        {toContractNumber(selectedCompleted.id)}
                      </span>
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                        PO created
                      </span>
                    </div>
                    <h2 className="text-lg font-bold mt-1">{selectedCompleted.item}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      PO <strong className="font-code text-emerald-700">{selectedCompleted.poNumber}</strong>{' '}
                      · created {formatWhen(selectedCompleted.pomsCreatedAt)}
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

              <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
                {awardedQuote && (
                  <div className="grid sm:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <div className="text-[11px] uppercase text-slate-400 font-bold">Contract price</div>
                      <div className="text-sm font-bold">${awardedQuote.pricePerCase.toFixed(2)}/case</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <div className="text-[11px] uppercase text-slate-400 font-bold">Per drop</div>
                      <div className="text-sm font-bold">
                        {getRfqDropQty(selectedCompleted).toLocaleString()} cases
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <div className="text-[11px] uppercase text-slate-400 font-bold">Destination</div>
                      <div className="text-sm font-bold">{selectedCompleted.destination}</div>
                    </div>
                  </div>
                )}

                {linkedPo?.shipmentDetail && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs space-y-1.5">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Shipping submitted
                    </div>
                    <div>
                      <span className="text-slate-400">ASN · </span>
                      {linkedPo.shipmentDetail.asnNumber}
                    </div>
                    <div>
                      <span className="text-slate-400">Container · </span>
                      {linkedPo.shipmentDetail.containerNumber || '—'}
                    </div>
                    <div>
                      <span className="text-slate-400">Ship date · </span>
                      {linkedPo.shipmentDetail.shipDate}
                    </div>
                    <div>
                      <span className="text-slate-400">ETA · </span>
                      {linkedPo.shipmentDetail.eta}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/orders?po=${selectedCompleted.poNumber}`}
                    className={btnPrimaryClass}
                  >
                    <Package className="w-4 h-4" />
                    View PO
                  </Link>
                  <Link to="/logistics" className={btnSecondaryClass}>
                    <Truck className="w-4 h-4" />
                    Logistics Tracking
                  </Link>
                </div>
              </div>
            </>
          ) : panelRfqs.length > 0 ? (
            <>
              <div className="sticky top-0 z-20 shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {panelRfqs.length === 1 ? 'Selected contract' : `${panelRfqs.length} contracts selected`}
                    </div>
                    {panelRfqs.length === 1 && (
                      <div className="text-sm font-code font-bold text-[#4684AD] mt-1">
                        {toContractNumber(panelRfqs[0].id)}
                      </div>
                    )}
                    <h2 className="text-lg font-bold mt-1">
                      {panelRfqs.length === 1
                        ? panelRfqs[0].item
                        : 'Submit shipping for selected contracts'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {panelRfqs.length === 1
                        ? `Standing order · ${formatRepeatSummary(panelRfqs[0].repeat)} · first drop to ${panelRfqs[0].destination} ${panelRfqs[0].deliveryDate}`
                        : panelRfqs.map((r) => toContractNumber(r.id)).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={downloadSelectedExcel} className={btnSecondaryClass}>
                      <Download className="w-3.5 h-3.5" />
                      Download Excel{checkedRfqs.length > 0 ? ` (${checkedRfqs.length})` : ''}
                    </button>
                    <label className={cn(btnSecondaryClass, 'cursor-pointer')}>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {massSaving ? 'Creating POs…' : 'Upload Excel'}
                      <input
                        type="file"
                        accept=".csv,.xls,.xlsx,.txt,text/csv"
                        className="sr-only"
                        disabled={massSaving}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) onMassExcelUpload(f);
                        }}
                      />
                    </label>
                    <label className={cn(btnSecondaryClass, 'cursor-pointer')}>
                      <Upload className="w-3.5 h-3.5" />
                      Mass upload document
                      <input
                        type="file"
                        accept="image/*,.csv,.txt,.pdf,.xls,.xlsx"
                        className="sr-only"
                        disabled={massSaving}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) onMassDocumentUpload(f);
                        }}
                      />
                    </label>
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
                {massMsg && <p className="text-xs text-emerald-800 mt-2 text-right">{massMsg}</p>}
              </div>

              <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
                <SelectedRfqsTable rfqs={panelRfqs} />

                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {panelRfqs.length === 1
                    ? 'No PO exists yet. Submit ASN / container details. After creation, DC Purchasing is notified.'
                    : `Enter shipping for each of the ${panelRfqs.length} selected contracts. After creation, DC Purchasing is notified.`}
                </p>

                <label className="block rounded-lg border border-dashed border-slate-300 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    Upload packing slip / ASN
                  </span>
                  <input
                    type="file"
                    accept="image/*,.csv,.txt,.pdf"
                    className="mt-2 block w-full text-xs"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onSlipUpload(f);
                    }}
                  />
                  {slipMsg && <p className="text-xs text-emerald-700 mt-2">{slipMsg}</p>}
                </label>

                <ShippingEntryTable rfqs={panelRfqs} rows={shippingByRfq} onChange={patchShipRow} />

                <button
                  type="button"
                  disabled={
                    saving ||
                    panelRfqs.length === 0 ||
                    panelRfqs.some(
                      (r) => !isShipRowComplete(shippingByRfq[r.id] ?? defaultShipRow(r))
                    )
                  }
                  onClick={submitShipping}
                  className={cn(btnPrimaryClass, 'w-full sm:w-auto disabled:opacity-50')}
                >
                  {saving
                    ? 'Submitting…'
                    : panelRfqs.length > 1
                      ? `Submit shipping (${panelRfqs.length})`
                      : 'Submit shipping'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500 text-sm">
              Select a contract from the list to submit shipping.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
