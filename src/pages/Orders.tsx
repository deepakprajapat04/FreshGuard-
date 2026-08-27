/**
 * SAP purchase orders — PO list on the left, PO detail with details / item / shipment / risk tabs on the right.
 */
import type { ReactNode } from 'react';
import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Upload,
  CheckSquare,
  Square,
  Truck,
  Calendar,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { btnPrimaryClass, btnSecondaryClass, contentCanvasClass } from '../lib/sapTheme';
import {
  buildPoRiskImpact,
  getPoDisplayStatus,
  getPoLineCount,
  getPoNetValue,
  getPoOrderLines,
  getAllPurchaseOrders,
  isFillInPurchaseOrder,
  type PoRiskImpact,
  type SapPurchaseOrder,
} from '../lib/trackingFlow';
import {
  looksLikeSampleAsn,
  parseAsnText,
  SAMPLE_ASN_CAPTURE,
  type CapturedAsnFields,
} from '../lib/asnCapture';

const SUPPLIER_NAME = 'Berry Farms Co-op';
const STORAGE_KEY = 'freshguard-active-shipments-v6';

type WizardStep = 'details' | 'item' | 'shipment' | 'risk';

type PoStatusFilter = 'all' | 'in-transit' | 'asn-submitted' | 'received';
type PoRiskFilter = 'all' | 'late' | 'early' | 'on-time';

const PO_STATUS_FILTER_LABELS: Record<PoStatusFilter, string> = {
  all: 'All',
  'in-transit': 'In transit',
  'asn-submitted': 'ASN submitted',
  received: 'Received',
};

const PO_RISK_FILTER_LABELS: Record<PoRiskFilter, string> = {
  all: 'All risk',
  late: 'Late',
  early: 'Early',
  'on-time': 'On time',
};

function toDateInputValue(raw?: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status: SapPurchaseOrder['status']) {
  const styles: Record<SapPurchaseOrder['status'], string> = {
    Open: 'bg-slate-100 text-slate-700 border-slate-200',
    Acknowledged: 'bg-blue-50 text-[#2F5472] border-[#4684AD]/30',
    'ASN Submitted': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'In Transit': 'bg-amber-50 text-amber-900 border-amber-200',
    Received: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={cn(
        'text-[10px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap shrink-0',
        styles[status]
      )}
    >
      {status}
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">
        {value === undefined || value === null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RiskChip({ risk }: { risk: PoRiskImpact }) {
  if (risk.severity === 'none') return null;
  return (
    <span
      className={cn(
        'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
        risk.severity === 'high'
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : 'bg-amber-50 text-amber-900 border-amber-200'
      )}
    >
      {risk.delayDays > 0 ? `+${risk.delayDays}d late` : `${Math.abs(risk.delayDays)}d early`}
    </span>
  );
}

function RiskStat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{label}</div>
      <div
        className={cn(
          'text-lg font-bold tabular-nums mt-0.5 text-slate-800 dark:text-slate-100',
          valueClass
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
  );
}

export default function Orders() {
  const { persona } = usePersona();
  const isSupplier = persona === 'supplier';
  const [orders, setOrders] = useState<SapPurchaseOrder[]>(() => getAllPurchaseOrders());
  const [selectedPo, setSelectedPo] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('po');
    if (fromQuery) return fromQuery;
    const all = getAllPurchaseOrders();
    return all.find((o) => isFillInPurchaseOrder(o))?.po ?? all.find((o) => o.shipmentDetail)?.po ?? null;
  });
  const [wizardStep, setWizardStep] = useState<WizardStep>('details');
  const [asnOpen, setAsnOpen] = useState(false);
  const [linkedPoIds, setLinkedPoIds] = useState<string[]>([]);
  const [asnFields, setAsnFields] = useState({
    asnNumber: '',
    containerNumber: '',
    shipDate: toDateInputValue(),
    eta: '3 Days',
    notes: '',
  });
  const [lineQty, setLineQty] = useState<Record<string, string>>({});
  const [slipMsg, setSlipMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PoStatusFilter>('all');
  const [riskFilter, setRiskFilter] = useState<PoRiskFilter>('all');

  useEffect(() => {
    setOrders(getAllPurchaseOrders());
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('po');
    if (fromQuery) setSelectedPo(fromQuery);
  }, []);

  const visibleOrders = useMemo(
    () => (isSupplier ? orders.filter((o) => o.supplier === SUPPLIER_NAME) : orders),
    [orders, isSupplier]
  );

  /** Only POs with a submitted ASN appear in the purchase order list. */
  const listedOrders = useMemo(
    () => visibleOrders.filter((o) => o.shipmentDetail),
    [visibleOrders]
  );

  const riskByPo = useMemo(() => {
    const map = new Map<string, PoRiskImpact>();
    for (const o of orders) {
      const impact = buildPoRiskImpact(o);
      if (impact) map.set(o.po, impact);
    }
    return map;
  }, [orders]);

  const filteredListedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listedOrders.filter((o) => {
      const displayStatus = getPoDisplayStatus(o);
      if (statusFilter === 'in-transit' && displayStatus !== 'In Transit') return false;
      if (statusFilter === 'asn-submitted' && displayStatus !== 'ASN Submitted') return false;
      if (statusFilter === 'received' && displayStatus !== 'Received') return false;

      const risk = riskByPo.get(o.po);
      if (riskFilter === 'late' && !(risk && risk.delayDays > 0)) return false;
      if (riskFilter === 'early' && !(risk && risk.delayDays < 0)) return false;
      if (riskFilter === 'on-time' && risk && risk.delayDays !== 0) return false;

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
  }, [listedOrders, search, statusFilter, riskFilter, riskByPo]);
  useEffect(() => {
    if (listedOrders.length === 0) {
      setSelectedPo(null);
      return;
    }
    if (!selectedPo || !listedOrders.some((o) => o.po === selectedPo)) {
      setSelectedPo(listedOrders[0].po);
    }
  }, [listedOrders, selectedPo]);

  useEffect(() => {
    if (filteredListedOrders.length === 0) return;
    if (!selectedPo || !filteredListedOrders.some((o) => o.po === selectedPo)) {
      setSelectedPo(filteredListedOrders[0].po);
    }
  }, [filteredListedOrders, selectedPo]);

  const selected = listedOrders.find((o) => o.po === selectedPo) ?? null;
  const eligiblePos = visibleOrders.filter((o) => !o.shipmentDetail);

  const selectedRisk = selected ? (riskByPo.get(selected.po) ?? null) : null;

  useEffect(() => {
    if (!selected) setDetailExpanded(false);
  }, [selected]);

  useEffect(() => {
    if (!detailExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailExpanded]);

  const selectPo = (po: string) => {
    setSelectedPo(po);
    setWizardStep('details');
  };

  const togglePo = (po: string) => {
    setLinkedPoIds((prev) => {
      if (prev.includes(po)) return prev.filter((id) => id !== po);
      const row = orders.find((o) => o.po === po);
      if (row) setLineQty((q) => ({ ...q, [po]: String(row.orderedQty) }));
      return [...prev, po];
    });
  };

  const applyCapture = (captured: CapturedAsnFields) => {
    if (captured.asnNumber) setAsnFields((f) => ({ ...f, asnNumber: captured.asnNumber! }));
    if (captured.containerNumber)
      setAsnFields((f) => ({ ...f, containerNumber: captured.containerNumber! }));
    if (captured.shipDate || captured.asnDate)
      setAsnFields((f) => ({
        ...f,
        shipDate: toDateInputValue(captured.shipDate || captured.asnDate),
      }));
    if (captured.etaDate) setAsnFields((f) => ({ ...f, eta: `ETA ${captured.etaDate}` }));
    const matched = orders.filter((o) =>
      captured.linkedPoNumbers.some((p) => p.includes(o.po.slice(-4)) || p === o.po)
    );
    if (matched.length) {
      setLinkedPoIds(matched.map((m) => m.po));
      const q: Record<string, string> = {};
      matched.forEach((m) => {
        q[m.po] = String(captured.poQuantities[m.po] || m.orderedQty);
      });
      setLineQty(q);
    }
    setSlipMsg(`Captured: ${captured.asnNumber || 'ASN'} · ${captured.containerNumber || 'container'}`);
  };

  const onSlipUpload = async (file: File) => {
    setSlipMsg('Reading ASN…');
    if (file.type.startsWith('text/') || /\.csv|txt$/i.test(file.name)) {
      const tr = new FileReader();
      tr.onload = () => {
        const cap = parseAsnText(String(tr.result || ''), file.name);
        if (cap) applyCapture(cap);
        else setSlipMsg('Could not parse file — enter manually.');
      };
      tr.readAsText(file);
    } else if (looksLikeSampleAsn(file.name)) {
      applyCapture({ ...SAMPLE_ASN_CAPTURE });
    } else {
      applyCapture({
        ...SAMPLE_ASN_CAPTURE,
        linkedPoNumbers: ['PO-4500012345', 'PO-4500012346'],
        notes: `Uploaded: ${file.name}`,
      });
    }
  };

  const submitAsn = () => {
    if (!asnFields.asnNumber || !linkedPoIds.length) return;
    setSaving(true);
    setTimeout(() => {
      setOrders((prev) =>
        prev.map((o) => {
          if (!linkedPoIds.includes(o.po)) return o;
          const qty = Number(lineQty[o.po] || o.orderedQty);
          return {
            ...o,
            status: 'ASN Submitted' as const,
            itemDetail: { ...o.itemDetail, confirmedQty: qty },
            shipmentDetail: {
              asnNumber: asnFields.asnNumber,
              containerNumber: asnFields.containerNumber,
              shipDate: asnFields.shipDate,
              eta: asnFields.eta,
              originalEta: asnFields.eta,
              origin: o.itemDetail.countryOfOrigin,
              destination: o.destination,
              transportMode: 'ocean' as const,
              incoterms: 'FOB',
              tempRange: o.itemDetail.storageTemp,
              cargoLines: [
                {
                  poNumber: o.po,
                  item: o.itemDetail.description,
                  quantity: qty,
                  unit: o.unit,
                  lotNumber: `LOT-${o.po.slice(-4)}`,
                  harvestDate: asnFields.shipDate,
                  bestBefore: o.deliveryDate,
                  palletCount: Math.max(1, Math.round(qty / 50)),
                  grossWeightKg: Math.round(qty * (o.itemDetail.netWeightKg / o.orderedQty)),
                },
              ],
            },
          };
        })
      );
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [];
        const linked = orders.filter((o) => linkedPoIds.includes(o.po));
        const totalQty = linked.reduce(
          (s, o) => s + Number(lineQty[o.po] || o.orderedQty),
          0
        );
        list.unshift({
          id: linked.length > 1 ? asnFields.asnNumber : linked[0].po,
          containerNumber: asnFields.containerNumber,
          asnNumber: asnFields.asnNumber,
          vendor: SUPPLIER_NAME,
          product: linked.map((l) => l.item).join(' + '),
          item: `${totalQty} cases`,
          quantity: totalQty,
          unit: 'Cases',
          stage: 'packing',
          status: 'on-time',
          eta: asnFields.eta,
          destination: 'Chicago DC',
          transportMode: 'ocean',
          cargoLines: linked.map((o) => ({
            poNumber: o.po,
            product: o.item,
            item: o.item,
            quantity: Number(lineQty[o.po] || o.orderedQty),
            unit: 'Cases',
          })),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
      setSaving(false);
      setAsnOpen(false);
      setSlipMsg('ASN submitted — visible in Logistics Tracking.');
    }, 600);
  };

  return (
    <div
      className={cn(
        contentCanvasClass,
        'p-3 sm:p-4 w-full h-full min-h-0 flex flex-col gap-3 overflow-hidden text-slate-900 dark:text-slate-100'
      )}
    >
      {!detailExpanded && (
        <PageHeader title="Purchase Order" className="shrink-0">
          {isSupplier && (
            <button
              type="button"
              onClick={() => {
                setAsnOpen(true);
                setLinkedPoIds([]);
                setAsnFields({
                  asnNumber: `ASN-${Date.now().toString().slice(-6)}`,
                  containerNumber: '',
                  shipDate: toDateInputValue(),
                  eta: '3 Days',
                  notes: '',
                });
              }}
              className={btnPrimaryClass}
            >
              <Upload className="w-4 h-4" />
              Create / upload ASN
            </button>
          )}
        </PageHeader>
      )}

      <div
        className={cn(
          'flex-1 min-h-0 grid gap-3 grid-rows-1',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(220px,280px)_1fr]'
        )}
      >
        {/* Panel 1 — PO list (pinned shell, list scrolls inside) */}
        <section
          className={cn(
            'min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900">
            <h2 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Filter className="w-3.5 h-3.5" />
              SAP PO list
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {filteredListedOrders.length} of {listedOrders.length} with ASN
            </p>
          </div>

          <div className="shrink-0 p-3 space-y-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO number, item, container…"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Status</div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(PO_STATUS_FILTER_LABELS) as PoStatusFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                      statusFilter === f
                        ? 'bg-[#4684AD] text-white border-[#4684AD]'
                        : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                    )}
                  >
                    {PO_STATUS_FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Delivery risk</div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(PO_RISK_FILTER_LABELS) as PoRiskFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRiskFilter(f)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                      riskFilter === f
                        ? 'bg-[#4684AD] text-white border-[#4684AD]'
                        : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                    )}
                  >
                    {PO_RISK_FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {listedOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs with ASN yet.</p>
            ) : filteredListedOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs match your search or filters.</p>
            ) : (
              filteredListedOrders.map((o) => {
                const active = selectedPo === o.po;
                const risk = riskByPo.get(o.po);
                return (
                  <button
                    key={o.po}
                    type="button"
                    onClick={() => selectPo(o.po)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 transition-colors',
                      active
                        ? 'bg-[#C0D5E5] dark:bg-blue-950/40 border-l-4 border-l-[#4684AD]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-xs font-bold text-[#2F5472] dark:text-blue-300">
                        {o.po}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isFillInPurchaseOrder(o) && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Fill-in
                          </span>
                        )}
                        {statusBadge(getPoDisplayStatus(o))}
                      </div>
                    </div>
                    <div className="text-sm font-semibold mt-1 text-slate-800 dark:text-slate-100">
                      {o.item}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {isFillInPurchaseOrder(o) && (
                        <span className="font-semibold text-emerald-700">Alt supplier · </span>
                      )}
                      {getPoLineCount(o) > 1 && (
                        <span className="font-semibold text-[#4684AD]">
                          {getPoLineCount(o)} lines ·{' '}
                        </span>
                      )}
                      {o.orderedQty.toLocaleString()} {o.unit} · {o.supplier}
                    </div>
                    {risk && risk.severity !== 'none' && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <RiskChip risk={risk} />
                        {risk.oosGapDays > 0 && (
                          <span className="text-[10px] font-semibold text-rose-700">
                            {risk.oosGapDays}d OOS gap
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Panel 2 — PO detail (pinned chrome, tab body scrolls) */}
        <section className="min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-400">
              Select a PO from the list
            </div>
          ) : (
            <>
              <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700">
                <div className="px-4 py-3 flex items-start justify-between gap-3 bg-white dark:bg-slate-900">
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">PO detail</h2>
                    <p className="font-code text-sm font-bold mt-0.5">{selected.po}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {selected.item} · {selected.supplier}
                      {isFillInPurchaseOrder(selected) && ' · Alt-supplier fill-in'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isFillInPurchaseOrder(selected) && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Fill-in
                      </span>
                    )}
                    {statusBadge(getPoDisplayStatus(selected))}
                    {selectedRisk && selectedRisk.severity !== 'none' && (
                      <button
                        type="button"
                        onClick={() => setWizardStep('risk')}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <RiskChip risk={selectedRisk} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailExpanded((v) => !v)}
                      className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-slate-500 hover:text-[#2F5472] hover:border-[#4684AD]/50 transition-colors"
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

                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              {(
                [
                  { id: 'details' as const, label: 'Details' },
                  { id: 'item' as const, label: 'Item' },
                  { id: 'shipment' as const, label: 'Shipment' },
                  { id: 'risk' as const, label: 'Delivery risk' },
                ] as const
              ).map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setWizardStep(step.id)}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors min-w-0',
                    wizardStep === step.id
                      ? 'border-[#4684AD] text-[#4684AD] bg-[#C0D5E5]/50 dark:bg-blue-950/30'
                      : 'border-transparent text-slate-400 hover:text-slate-600',
                    step.id === 'risk' &&
                      selectedRisk &&
                      selectedRisk.severity !== 'none' &&
                      wizardStep !== 'risk' &&
                      'text-amber-700'
                  )}
                >
                  {step.label}
                </button>
              ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {wizardStep === 'details' && (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <DetailField label="Supplier" value={selected.supplier} />
                      <DetailField label="Buyer" value={selected.buyer} />
                      <DetailField label="Company code" value={selected.companyCode} />
                      <DetailField label="Purch. org" value={selected.purchasingOrg} />
                      <DetailField
                        label="Ordered qty"
                        value={`${selected.orderedQty.toLocaleString()} ${selected.unit}`}
                      />
                      <DetailField label="Delivery date" value={selected.deliveryDate} />
                      <DetailField label="Destination" value={selected.destination} />
                      <DetailField label="Payment terms" value={selected.paymentTerms} />
                      <DetailField label="Created" value={selected.createdDate} />
                      <DetailField
                        label="Net value"
                        value={`${selected.itemDetail.currency} ${getPoNetValue(selected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      />
                  </dl>
                </div>
              )}

              {wizardStep === 'item' && (
                <div className="space-y-4">
                  {getPoOrderLines(selected).map((line) => (
                    <div
                      key={line.lineNumber}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className="text-sm font-bold text-[#2F5472] dark:text-blue-300">
                          Line {line.lineNumber} · {line.item}
                        </span>
                        <span className="font-code text-[10px] text-slate-400">{line.sku}</span>
                      </div>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <DetailField label="Material number" value={line.materialNumber} />
                        <div className="col-span-full sm:col-span-2 lg:col-span-3">
                          <DetailField label="Description" value={line.description} />
                        </div>
                        <DetailField
                          label="Ordered / confirmed"
                          value={`${line.orderedQty.toLocaleString()} / ${line.confirmedQty.toLocaleString()} ${line.unit}`}
                        />
                        <DetailField
                          label="Unit price"
                          value={`${line.currency} ${line.unitPrice.toFixed(2)}`}
                        />
                        <DetailField label="Line value" value={`${line.currency} ${(line.unitPrice * line.orderedQty).toLocaleString()}`} />
                        <DetailField label="Shelf life" value={`${line.shelfLifeDays} days`} />
                        <DetailField label="Storage temp" value={line.storageTemp} />
                        <DetailField label="Storage location" value={line.storageLocation} />
                        <DetailField label="Net weight" value={`${line.netWeightKg.toLocaleString()} kg`} />
                        <DetailField label="Country of origin" value={line.countryOfOrigin} />
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              {wizardStep === 'shipment' && (
                <div className="space-y-4">
                  {!selected.shipmentDetail ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      No ASN submitted yet.
                      {isSupplier && (
                        <p className="mt-2 text-xs">
                          Use <strong>Create / upload ASN</strong> to attach shipment details.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <DetailField label="ASN number" value={selected.shipmentDetail.asnNumber} />
                        <DetailField label="Container" value={selected.shipmentDetail.containerNumber} />
                        <DetailField label="Ship date" value={selected.shipmentDetail.shipDate} />
                        <DetailField label="ETA" value={selected.shipmentDetail.eta} />
                        <DetailField label="Original ETA" value={selected.shipmentDetail.originalEta} />
                        <DetailField label="Transport mode" value={selected.shipmentDetail.transportMode} />
                        <DetailField label="Origin" value={selected.shipmentDetail.origin} />
                        <DetailField label="Destination" value={selected.shipmentDetail.destination} />
                        <DetailField label="Port of loading" value={selected.shipmentDetail.portOfLoading} />
                        <DetailField label="Port of discharge" value={selected.shipmentDetail.portOfDischarge} />
                        <DetailField label="Carrier" value={selected.shipmentDetail.carrier} />
                        <DetailField label="Vessel" value={selected.shipmentDetail.vesselName} />
                        <DetailField label="Voyage" value={selected.shipmentDetail.voyageNumber} />
                        <DetailField label="Booking" value={selected.shipmentDetail.bookingNumber} />
                        <DetailField label="Bill of lading" value={selected.shipmentDetail.billOfLading} />
                        <DetailField label="Seal" value={selected.shipmentDetail.sealNumber} />
                        <DetailField label="Incoterms" value={selected.shipmentDetail.incoterms} />
                        <DetailField label="Customs" value={selected.shipmentDetail.customsStatus} />
                        <DetailField label="Temp range" value={selected.shipmentDetail.tempRange} />
                        <DetailField label="Freight forwarder" value={selected.shipmentDetail.freightForwarder} />
                      </dl>

                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500">Cargo lines</h3>
                        {selected.shipmentDetail.cargoLines.map((line) => (
                          <div
                            key={`${line.poNumber}-${line.lotNumber}`}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-2 bg-slate-50/50 dark:bg-slate-950/40"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-[#2F5472]">{line.item}</span>
                              <span className="font-code text-[10px] text-slate-400">{line.poNumber}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <span>
                                <strong>Qty:</strong> {line.quantity.toLocaleString()} {line.unit}
                              </span>
                              <span>
                                <strong>Lot:</strong> {line.lotNumber}
                              </span>
                              <span>
                                <strong>Pallets:</strong> {line.palletCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Harvest {line.harvestDate}
                              </span>
                              <span>
                                <strong>BBD:</strong> {line.bestBefore}
                              </span>
                              <span>
                                <strong>Gross wt:</strong> {line.grossWeightKg.toLocaleString()} kg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {wizardStep === 'risk' && (
                <div className="space-y-4">
                  {!selectedRisk ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      No shipment linked yet — risk appears once an ASN is submitted.
                    </div>
                  ) : selectedRisk.severity === 'none' ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-sm text-emerald-800">
                      On plan — arriving {formatShortDate(selectedRisk.revisedEta)}, stores shelved{' '}
                      {formatShortDate(selectedRisk.storeShelfDate)}. No downstream action needed.
                    </div>
                  ) : (
                    <>
                      <div
                        className={cn(
                          'rounded-lg border overflow-hidden',
                          selectedRisk.severity === 'high'
                            ? 'border-rose-200 dark:border-rose-900'
                            : 'border-amber-200 dark:border-amber-900'
                        )}
                      >
                        <div
                          className={cn(
                            'px-3 py-2 flex items-center gap-1.5 text-xs font-bold',
                            selectedRisk.severity === 'high'
                              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30'
                              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30'
                          )}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {selectedRisk.headline}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          <RiskStat
                            label="Planned DC"
                            value={formatShortDate(selectedRisk.originalEta)}
                            sub="original ETA"
                          />
                          <RiskStat
                            label="DC arrival"
                            value={formatShortDate(selectedRisk.revisedEta)}
                            sub={
                              selectedRisk.delayDays > 0
                                ? `+${selectedRisk.delayDays}d vs plan`
                                : `${Math.abs(selectedRisk.delayDays)}d early`
                            }
                            valueClass="text-amber-800"
                          />
                          <RiskStat
                            label="Store shelf"
                            value={formatShortDate(selectedRisk.storeShelfDate)}
                            sub={`DC + ${selectedRisk.storeTransitBufferDays}d dock-to-shelf`}
                            valueClass="text-[#2F5472]"
                          />
                          <RiskStat
                            label="Stock at risk"
                            value={
                              selectedRisk.oosGapDays > 0 ? `${selectedRisk.oosGapDays}d` : 'None'
                            }
                            sub={
                              selectedRisk.oosGapDays > 0
                                ? `gap from ${formatShortDate(selectedRisk.onHandExpiresDate)}`
                                : 'covered until store'
                            }
                            valueClass={
                              selectedRisk.oosGapDays > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
                          <RiskStat
                            label="Stores affected"
                            value={`${selectedRisk.storesAtRisk}`}
                            sub={`of ${selectedRisk.storesTotal} on this item`}
                            valueClass={
                              selectedRisk.storesAtRisk > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }
                          />
                          <RiskStat
                            label="Transfers"
                            value={`${selectedRisk.moveCount}`}
                            sub={`${selectedRisk.casesToMove} cases to cover`}
                            valueClass="text-[#2F5472]"
                          />
                          <RiskStat
                            label="Promotions"
                            value={`${selectedRisk.promosAtRisk}`}
                            sub={`${selectedRisk.promoStoreChanges} store changes`}
                            valueClass="text-violet-700"
                          />
                          <RiskStat
                            label="Pricing"
                            value={
                              selectedRisk.markdownPercent != null
                                ? `${selectedRisk.markdownPercent}%`
                                : 'Standard'
                            }
                            sub="markdown on affected units"
                            valueClass="text-amber-800"
                          />
                        </div>
                      </div>

                      {isSupplier ? (
                        <section className="space-y-2">
                          <h3 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
                            Requested from you
                          </h3>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                            {selectedRisk.supplierRequests.map((req) => (
                              <div key={req.id} className="px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                    {req.label}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-slate-400 shrink-0">
                                    by {formatShortDate(req.dueDate)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  {req.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                          {selectedRisk.exposureValue > 0 && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 px-3 py-2.5">
                              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
                                Claim exposure on this PO
                              </div>
                              <div className="text-lg font-bold tabular-nums text-rose-700 mt-0.5">
                                {selectedRisk.currency}{' '}
                                {selectedRisk.exposureValue.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {selectedRisk.markdownPercent}% markdown on affected units
                              </div>
                            </div>
                          )}
                        </section>
                      ) : (
                        <section className="space-y-2">
                          <h3 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
                            Raised with supplier
                          </h3>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                            {selectedRisk.supplierRequests.map((req) => (
                              <div
                                key={req.id}
                                className="px-3 py-2.5 flex items-start justify-between gap-3"
                              >
                                <span className="text-xs text-slate-700 dark:text-slate-200">
                                  {req.label}
                                </span>
                                <span className="text-[10px] tabular-nums text-slate-400 shrink-0">
                                  by {formatShortDate(req.dueDate)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <Link
                            to="/"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4684AD] hover:underline"
                          >
                            Open Shipment Intelligence for {selectedRisk.containerNumber}
                          </Link>
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ASN modal */}
      {asnOpen && isSupplier && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">Mass ASN upload</h2>
              <p className="text-xs text-slate-500 mt-1">
                One container · multiple POs · photo OCR or manual entry
              </p>
            </div>
            <div className="p-5 space-y-4">
              <label className="block rounded-lg border border-dashed border-slate-300 p-4 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold uppercase text-slate-500">Upload ASN photo / CSV</span>
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

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-slate-500">Link POs to container</span>
                {eligiblePos.map((o) => {
                  const on = linkedPoIds.includes(o.po);
                  return (
                    <button
                      key={o.po}
                      type="button"
                      onClick={() => togglePo(o.po)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm',
                        on ? 'border-[#4684AD] bg-[#C0D5E5]/60' : 'border-slate-200'
                      )}
                    >
                      {on ? (
                        <CheckSquare className="w-4 h-4 text-[#4684AD]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="font-code font-semibold">{o.po}</span>
                      <span>{o.item}</span>
                      <span className="ml-auto text-slate-500">{o.orderedQty} cs</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">ASN number</span>
                  <input
                    value={asnFields.asnNumber}
                    onChange={(e) => setAsnFields((f) => ({ ...f, asnNumber: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-code"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Container</span>
                  <input
                    value={asnFields.containerNumber}
                    onChange={(e) => setAsnFields((f) => ({ ...f, containerNumber: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-code"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Ship date</span>
                  <input
                    type="date"
                    value={asnFields.shipDate}
                    onChange={(e) => setAsnFields((f) => ({ ...f, shipDate: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">ETA</span>
                  <input
                    value={asnFields.eta}
                    onChange={(e) => setAsnFields((f) => ({ ...f, eta: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving || !linkedPoIds.length || !asnFields.asnNumber}
                  onClick={submitAsn}
                  className={cn(btnPrimaryClass, 'flex-1 disabled:opacity-50')}
                >
                  {saving ? 'Submitting…' : 'Submit ASN to DC'}
                </button>
                <button
                  type="button"
                  onClick={() => setAsnOpen(false)}
                  className={btnSecondaryClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
