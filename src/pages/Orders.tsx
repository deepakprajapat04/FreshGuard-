/**
 * SAP purchase orders — PO list on the left; unified detail + timeline on the right.
 */
import type { ReactNode } from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { btnPrimaryClass, btnSecondaryClass, contentCanvasClass } from '../lib/sapTheme';
import {
  buildPoRiskImpact,
  buildSourcingProposal,
  getPoDisplayStatus,
  getPoLineCount,
  getPoNetValue,
  getPoOrderLines,
  getAllPurchaseOrders,
  getPurchasingLaneForPo,
  getShipmentEtaIso,
  getShipmentForPo,
  isFillInPurchaseOrder,
  poVisibleToPersona,
  type PoRiskImpact,
  type SapPurchaseOrder,
  type TrackShipment,
} from '../lib/trackingFlow';
import {
  looksLikeSampleAsn,
  parseAsnText,
  SAMPLE_ASN_CAPTURE,
  type CapturedAsnFields,
} from '../lib/asnCapture';
import {
  createPoFromFruitsRfqShipping,
  FRUITS_RFQ_SUPPLIER,
  getContractNumberForPo,
  getRfqsAwaitingShipping,
  getRfqAlternateSupplierOptions,
  getRfqDropQty,
  type FruitsRfq,
} from '../lib/fruitsRfqFlow';
import { loadBusinessRules } from '../lib/businessRules';

import { SupplierRfqPortal } from '../components/supplier/SupplierRfqPortal';

const SUPPLIER_NAME = FRUITS_RFQ_SUPPLIER;
const STORAGE_KEY = 'freshguard-active-shipments-v6';

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

const STAGE_LABELS: Record<TrackShipment['stage'], string> = {
  origin: 'Origin / supplier',
  ocean: 'Ocean transit',
  customs: 'Customs clearance',
  inland: 'Inland haulage',
  dc_arrival: 'DC arrival',
  delivered: 'Delivered',
};

const STAGE_ORDER: TrackShipment['stage'][] = [
  'origin',
  'ocean',
  'customs',
  'inland',
  'dc_arrival',
  'delivered',
];

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
        'text-[11px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap shrink-0',
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
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
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
        'text-[11px] font-bold uppercase px-1.5 py-0.5 rounded border',
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
      <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">{label}</div>
      <div
        className={cn(
          'text-lg font-bold tabular-nums mt-0.5 text-slate-800 dark:text-slate-100',
          valueClass
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}

type TimelineTone = 'done' | 'current' | 'upcoming' | 'alert';

type TimelineMilestone = {
  id: string;
  label: string;
  when: string;
  tone: TimelineTone;
};

function formatTimelineDate(isoOrLabel: string | undefined): string {
  if (!isoOrLabel) return '—';
  const d = new Date(isoOrLabel.includes('T') ? isoOrLabel : `${isoOrLabel}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoOrLabel;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildPoTimeline(
  po: SapPurchaseOrder,
  shipment: TrackShipment | undefined,
  risk: PoRiskImpact | undefined
): TimelineMilestone[] {
  const sd = po.shipmentDetail;
  const milestones: TimelineMilestone[] = [];
  const stageIdx = shipment ? STAGE_ORDER.indexOf(shipment.stage) : -1;

  milestones.push({
    id: 'asn',
    label: 'ASN created',
    when: formatTimelineDate(sd?.shipDate || po.createdDate),
    tone: sd?.asnNumber || shipment ? 'done' : 'upcoming',
  });

  if (shipment) {
    for (const stage of STAGE_ORDER) {
      if (stage === 'origin' || stage === 'delivered') continue;
      const idx = STAGE_ORDER.indexOf(stage);
      let tone: TimelineTone = 'upcoming';
      if (idx < stageIdx) tone = 'done';
      else if (idx === stageIdx) tone = 'current';
      milestones.push({
        id: stage,
        label: STAGE_LABELS[stage],
        when: idx === stageIdx ? 'In progress' : idx < stageIdx ? 'Completed' : 'Pending',
        tone,
      });
    }
  } else if (sd?.asnNumber) {
    milestones.push({
      id: 'pickup',
      label: 'Picked up by carrier',
      when: formatTimelineDate(sd.shipDate),
      tone: 'done',
    });
  }

  if (risk && risk.eventStatus === 'delayed') {
    milestones.push({
      id: 'delay',
      label: 'Delay reported',
      when: `+${risk.delayDays}d vs plan`,
      tone: 'alert',
    });
  } else if (risk && risk.eventStatus === 'early') {
    milestones.push({
      id: 'early',
      label: 'Early arrival signal',
      when: `${Math.abs(risk.delayDays)}d ahead`,
      tone: 'current',
    });
  }

  const etaIso = shipment ? getShipmentEtaIso(shipment) : undefined;
  const expectedWhen =
    (risk?.revisedEta ? formatTimelineDate(risk.revisedEta) : undefined) ||
    (etaIso?.revised ? formatTimelineDate(etaIso.revised) : undefined) ||
    formatTimelineDate(sd?.eta?.replace(/^ETA\s+/i, '') || po.deliveryDate);

  milestones.push({
    id: 'expected',
    label: 'Expected delivery',
    when: expectedWhen,
    tone:
      shipment?.stage === 'delivered'
        ? 'done'
        : risk?.eventStatus === 'delayed'
          ? 'alert'
          : stageIdx >= STAGE_ORDER.indexOf('dc_arrival')
            ? 'current'
            : 'upcoming',
  });

  if (shipment?.stage === 'delivered') {
    milestones.push({
      id: 'delivered',
      label: 'Delivered to DC',
      when: expectedWhen,
      tone: 'done',
    });
  }

  return milestones;
}

function PoShipmentTimeline({ milestones }: { milestones: TimelineMilestone[] }) {
  if (milestones.length === 0) {
    return <p className="text-xs text-slate-500">No shipment milestones yet.</p>;
  }

  return (
    <ol className="relative space-y-0 pl-0">
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1;
        return (
          <li key={m.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2',
                m.tone === 'done' && 'border-emerald-500 bg-emerald-500',
                m.tone === 'current' &&
                  'border-sky-500 bg-sky-500 ring-4 ring-sky-100 dark:ring-sky-900/40',
                m.tone === 'upcoming' &&
                  'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900',
                m.tone === 'alert' &&
                  'border-orange-500 bg-orange-500 ring-4 ring-orange-100 dark:ring-orange-900/30'
              )}
              aria-hidden
            />
            <div className="min-w-0 pt-0.5">
              <div
                className={cn(
                  'text-sm font-semibold leading-snug',
                  m.tone === 'alert'
                    ? 'text-orange-700 dark:text-orange-400'
                    : 'text-slate-800 dark:text-slate-100'
                )}
              >
                {m.label}
              </div>
              <div
                className={cn(
                  'text-xs mt-0.5',
                  m.tone === 'alert'
                    ? 'text-orange-600 dark:text-orange-400/90'
                    : 'text-slate-500'
                )}
              >
                {m.when}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function Orders() {
  const { persona } = usePersona();
  const isSupplier = persona === 'supplier';
  const isFruitsBuyer = persona === 'dc_purchasing_fruits';
  const [orders, setOrders] = useState<SapPurchaseOrder[]>(() => getAllPurchaseOrders());
  const [awaitingRfqs, setAwaitingRfqs] = useState<FruitsRfq[]>(() =>
    getRfqsAwaitingShipping(SUPPLIER_NAME)
  );
  const [selectedPo, setSelectedPo] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('po');
    const all = getAllPurchaseOrders().filter((o) =>
      isSupplier ? o.supplier === SUPPLIER_NAME : poVisibleToPersona(o, persona)
    );
    if (fromQuery && all.some((o) => o.po === fromQuery)) return fromQuery;
    return all.find((o) => isFillInPurchaseOrder(o))?.po ?? all.find((o) => o.shipmentDetail)?.po ?? null;
  });
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
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [linkedRfqId, setLinkedRfqId] = useState<string | null>(null);
  const [asnMode, setAsnMode] = useState<'po' | 'rfq'>('po');
  const [pomsSuccess, setPomsSuccess] = useState<{ poNumber: string; rfqId: string; item: string } | null>(
    null
  );

  const refreshFruitsRfqState = () => {
    setAwaitingRfqs(getRfqsAwaitingShipping(SUPPLIER_NAME));
    setOrders(getAllPurchaseOrders());
  };

  useEffect(() => {
    refreshFruitsRfqState();
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('po');
    if (fromQuery) setSelectedPo(fromQuery);
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

  const visibleOrders = useMemo(
    () =>
      isSupplier
        ? orders.filter((o) => o.supplier === SUPPLIER_NAME)
        : orders.filter((o) => poVisibleToPersona(o, persona)),
    [orders, isSupplier, persona]
  );

  /** Only POs with a submitted ASN appear in the purchase order list. */
  const listedOrders = useMemo(
    () => visibleOrders.filter((o) => o.shipmentDetail),
    [visibleOrders]
  );

  const riskByPo = useMemo(() => {
    const map = new Map<string, PoRiskImpact>();
    for (const o of orders) {
      try {
        const impact = buildPoRiskImpact(o);
        if (impact) map.set(o.po, impact);
      } catch {
        /* skip POs that cannot resolve risk context yet */
      }
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
  const selectedContractNo = selected ? getContractNumberForPo(selected.po) : null;
  const eligiblePos = visibleOrders.filter((o) => !o.shipmentDetail);

  const selectedRisk = selected ? (riskByPo.get(selected.po) ?? null) : null;
  const selectedShipment = selected ? getShipmentForPo(selected) : undefined;
  const selectedTimeline = useMemo(
    () => (selected ? buildPoTimeline(selected, selectedShipment, selectedRisk ?? undefined) : []),
    [selected, selectedShipment, selectedRisk]
  );
  const altSupplierName = useMemo(() => {
    if (!selected || isFillInPurchaseOrder(selected)) return null;
    const delayed =
      selectedRisk?.eventStatus === 'delayed' || selectedShipment?.eventStatus === 'delayed';
    if (!delayed) return null;

    const maxDays = loadBusinessRules().maxShipDaysForAltSupplier;
    if (getPurchasingLaneForPo(selected) === 'fruits') {
      const { options, recommendedOptionId } = getRfqAlternateSupplierOptions(
        selected.item,
        selected.supplier,
        maxDays
      );
      const recommended =
        options.find((o) => o.id === recommendedOptionId) ?? options[0];
      return recommended?.supplierName ?? null;
    }

    if (!selectedShipment) return null;
    const proposal = buildSourcingProposal(selectedShipment);
    const recommended =
      proposal?.options.find((o) => o.id === proposal.recommendedOptionId) ??
      proposal?.options[0];
    return recommended?.supplierName ?? null;
  }, [selected, selectedRisk, selectedShipment]);

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

  const submitRfqAsn = () => {
    if (!linkedRfqId || !asnFields.asnNumber) return;
    const rfq = awaitingRfqs.find((r) => r.id === linkedRfqId);
    if (!rfq) return;
    setSaving(true);
    const dropQty = getRfqDropQty(rfq);
    setTimeout(() => {
      const result = createPoFromFruitsRfqShipping({
        rfqId: linkedRfqId,
        asnNumber: asnFields.asnNumber,
        containerNumber: asnFields.containerNumber,
        shipDate: asnFields.shipDate,
        eta: asnFields.eta,
        quantity: dropQty,
      });
      if (!result) {
        setSaving(false);
        setSlipMsg('Could not create PO — RFQ may already be fulfilled.');
        return;
      }

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [];
        list.unshift({
          id: result.po.po,
          containerNumber: asnFields.containerNumber,
          asnNumber: asnFields.asnNumber,
          vendor: SUPPLIER_NAME,
          product: rfq.item,
          item: `${dropQty} cases`,
          quantity: dropQty,
          unit: 'Cases',
          stage: 'packing',
          status: 'on-time',
          eta: asnFields.eta,
          destination: rfq.destination,
          transportMode: 'ocean',
          linkedPos: [result.po.po],
          cargoLines: [
            {
              poNumber: result.po.po,
              product: rfq.fruitItem,
              item: rfq.fruitItem,
              quantity: dropQty,
              unit: 'Cases',
            },
          ],
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }

      refreshFruitsRfqState();
      setSelectedPo(result.po.po);
      setSaving(false);
      setAsnOpen(false);
      setLinkedRfqId(null);
      setPomsSuccess({
        poNumber: result.po.po,
        rfqId: rfq.id,
        item: rfq.item,
      });
    }, 700);
  };

  const submitAsn = () => {
    if (asnMode === 'rfq') {
      submitRfqAsn();
      return;
    }
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

  if (isSupplier) {
    return <SupplierRfqPortal />;
  }

  return (
    <div
      className={cn(
        contentCanvasClass,
        'p-3 sm:p-4 w-full h-full min-h-0 flex flex-col gap-3 overflow-y-auto text-slate-900 dark:text-slate-100'
      )}
    >
      {!detailExpanded && (
        <PageHeader title="Purchase Order" className="shrink-0">
          {isFruitsBuyer && (
            <Link to="/fruits-rfq" className={btnSecondaryClass}>
              <FileText className="w-4 h-4" />
              Contracts
            </Link>
          )}
        </PageHeader>
      )}

      <div
        className={cn(
          'grid gap-3 items-start',
          detailExpanded ? 'grid-cols-1' : 'lg:grid-cols-[minmax(220px,280px)_1fr]'
        )}
      >
        {/* Panel 1 — PO list */}
        <section
          className={cn(
            'rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              SAP PO list
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {filteredListedOrders.length} of {listedOrders.length} with ASN
              {statusFilter !== 'all' ? ` · ${PO_STATUS_FILTER_LABELS[statusFilter]}` : ''}
              {riskFilter !== 'all' ? ` · ${PO_RISK_FILTER_LABELS[riskFilter]}` : ''}
            </p>
          </div>

          <div className="shrink-0 p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO number, item, container…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40"
                />
              </div>
              <div className="relative shrink-0" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    statusFilter !== 'all' || riskFilter !== 'all' || filterOpen
                      ? 'border-[#4684AD] bg-[#C0D5E5]/50 text-[#2F5472]'
                      : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                  )}
                  aria-expanded={filterOpen}
                  aria-haspopup="listbox"
                  title="Filter by status and delivery risk"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                </button>
                {filterOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Status
                    </div>
                    {(Object.keys(PO_STATUS_FILTER_LABELS) as PoStatusFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="option"
                        aria-selected={statusFilter === f}
                        onClick={() => setStatusFilter(f)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                          statusFilter === f
                            ? 'bg-[#C0D5E5]/60 text-[#2F5472]'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        {PO_STATUS_FILTER_LABELS[f]}
                      </button>
                    ))}
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Delivery risk
                    </div>
                    {(Object.keys(PO_RISK_FILTER_LABELS) as PoRiskFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="option"
                        aria-selected={riskFilter === f}
                        onClick={() => setRiskFilter(f)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-medium transition-colors',
                          riskFilter === f
                            ? 'bg-[#C0D5E5]/60 text-[#2F5472]'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        {PO_RISK_FILTER_LABELS[f]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {listedOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs with ASN yet.</p>
            ) : filteredListedOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs match your search or filters.</p>
            ) : (
              filteredListedOrders.map((o) => {
                const active = selectedPo === o.po;
                const risk = riskByPo.get(o.po);
                const contractNo = getContractNumberForPo(o.po);
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
                          <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Fill-in
                          </span>
                        )}
                        {statusBadge(getPoDisplayStatus(o))}
                      </div>
                    </div>
                    {contractNo && (
                      <div className="font-code text-[11px] font-semibold text-[#4684AD] mt-0.5">
                        {contractNo}
                      </div>
                    )}
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
                          <span className="text-[11px] font-semibold text-rose-700">
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

        {/* Panel 2 — PO detail: risk + header details + items + shipment | timeline */}
        <section className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          {!selected ? (
            <div className="flex items-center justify-center p-8 text-sm text-slate-400">
              Select a PO from the list
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-700">
                <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                      PO detail
                    </h2>
                    <p className="font-code text-sm font-bold mt-0.5">{selected.po}</p>
                    {selectedContractNo && (
                      <p className="font-code text-[11px] font-semibold text-[#4684AD] mt-0.5">
                        {selectedContractNo}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {selected.item} · {selected.supplier}
                      {isFillInPurchaseOrder(selected) && ' · Alt-supplier fill-in'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isFillInPurchaseOrder(selected) && (
                      <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Fill-in
                      </span>
                    )}
                    {statusBadge(getPoDisplayStatus(selected))}
                    {selectedRisk && selectedRisk.severity !== 'none' && (
                      <RiskChip risk={selectedRisk} />
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

                <dl className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2">
                  {selectedContractNo && (
                    <DetailField
                      label="Contract"
                      value={<span className="font-code text-[#4684AD]">{selectedContractNo}</span>}
                    />
                  )}
                  <DetailField label="Supplier" value={selected.supplier} />
                  <DetailField label="Buyer" value={selected.buyer} />
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
                  <DetailField label="Purch. org" value={selected.purchasingOrg} />
                  <DetailField label="Company code" value={selected.companyCode} />
                </dl>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)]">
                <div className="p-4 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-700">
                  {/* Compact delivery risk */}
                  {!selectedRisk ? (
                    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500">
                      No shipment linked yet — risk appears once an ASN is submitted.
                    </div>
                  ) : selectedRisk.severity === 'none' ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        On plan — DC {formatShortDate(selectedRisk.revisedEta)}, store shelf{' '}
                        {formatShortDate(selectedRisk.storeShelfDate)}.
                      </span>
                    </div>
                  ) : (
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
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="min-w-0 truncate">{selectedRisk.headline}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
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
                          sub={`${selectedRisk.storesAtRisk} stores · ${selectedRisk.moveCount} transfers`}
                          valueClass="text-[#2F5472]"
                        />
                        <RiskStat
                          label="Stock at risk"
                          value={
                            selectedRisk.oosGapDays > 0 ? `${selectedRisk.oosGapDays}d` : 'None'
                          }
                          sub={
                            selectedRisk.oosGapDays > 0 ? 'projected OOS gap' : 'within cover'
                          }
                          valueClass={
                            selectedRisk.oosGapDays > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <section className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Items and quantity
                    </h3>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left font-semibold px-3 py-2">PO line</th>
                            <th className="text-left font-semibold px-3 py-2">Item</th>
                            <th className="text-right font-semibold px-3 py-2">Ordered</th>
                            <th className="text-right font-semibold px-3 py-2 hidden sm:table-cell">
                              Confirmed
                            </th>
                            <th className="text-right font-semibold px-3 py-2 hidden md:table-cell">
                              Unit price
                            </th>
                            <th className="text-right font-semibold px-3 py-2">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {getPoOrderLines(selected).map((line) => (
                            <tr key={line.lineNumber} className="bg-white dark:bg-slate-900">
                              <td className="px-3 py-2.5 font-code text-slate-500">{line.lineNumber}</td>
                              <td className="px-3 py-2.5">
                                <div className="font-semibold text-slate-800 dark:text-slate-100">
                                  {line.item}
                                </div>
                                <div className="text-[11px] text-slate-400 font-code mt-0.5">
                                  {line.sku}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                                {line.orderedQty.toLocaleString()} {line.unit}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell text-slate-600">
                                {line.confirmedQty.toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell text-slate-600">
                                {line.currency} {line.unitPrice.toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                                {line.currency}{' '}
                                {(line.unitPrice * line.orderedQty).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {getPoOrderLines(selected)[0] && (
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <DetailField
                          label="Shelf life"
                          value={`${getPoOrderLines(selected)[0].shelfLifeDays} days`}
                        />
                        <DetailField
                          label="Storage temp"
                          value={getPoOrderLines(selected)[0].storageTemp}
                        />
                        <DetailField
                          label="Origin"
                          value={getPoOrderLines(selected)[0].countryOfOrigin}
                        />
                        <DetailField
                          label="Storage loc."
                          value={getPoOrderLines(selected)[0].storageLocation}
                        />
                      </dl>
                    )}
                  </section>

                  {/* Shipment */}
                  <section className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Shipment details
                    </h3>
                    {!selected.shipmentDetail ? (
                      <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                        <Truck className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                        No ASN submitted yet.
                        {isSupplier && (
                          <p className="mt-2 text-xs">
                            Use <strong>Create / upload ASN</strong> to attach shipment details.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          <DetailField label="ASN number" value={selected.shipmentDetail.asnNumber} />
                          <DetailField
                            label="Container"
                            value={selected.shipmentDetail.containerNumber}
                          />
                          <DetailField label="Ship date" value={selected.shipmentDetail.shipDate} />
                          <DetailField label="ETA" value={selected.shipmentDetail.eta} />
                          <DetailField
                            label="Original ETA"
                            value={selected.shipmentDetail.originalEta}
                          />
                          <DetailField
                            label="Transport mode"
                            value={selected.shipmentDetail.transportMode}
                          />
                          <DetailField label="Carrier" value={selected.shipmentDetail.carrier} />
                          <DetailField label="Vessel" value={selected.shipmentDetail.vesselName} />
                          <DetailField
                            label="Voyage"
                            value={selected.shipmentDetail.voyageNumber}
                          />
                          <DetailField label="Origin" value={selected.shipmentDetail.origin} />
                          <DetailField
                            label="Destination"
                            value={selected.shipmentDetail.destination}
                          />
                          <DetailField
                            label="Incoterms"
                            value={selected.shipmentDetail.incoterms}
                          />
                          <DetailField
                            label="Bill of lading"
                            value={selected.shipmentDetail.billOfLading}
                          />
                          <DetailField
                            label="Customs"
                            value={selected.shipmentDetail.customsStatus}
                          />
                          <DetailField
                            label="Temp range"
                            value={selected.shipmentDetail.tempRange}
                          />
                        </dl>

                        {selected.shipmentDetail.cargoLines.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Cargo lines
                            </h4>
                            {selected.shipmentDetail.cargoLines.map((line) => (
                              <div
                                key={`${line.poNumber}-${line.lotNumber}`}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs bg-slate-50/50 dark:bg-slate-950/40"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                  <span className="font-bold text-[#2F5472]">{line.item}</span>
                                  <span className="font-code text-[11px] text-slate-400">
                                    {line.poNumber}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
                                  <span>
                                    <strong className="text-slate-500 font-medium">Qty:</strong>{' '}
                                    {line.quantity.toLocaleString()} {line.unit}
                                  </span>
                                  <span>
                                    <strong className="text-slate-500 font-medium">Lot:</strong>{' '}
                                    {line.lotNumber}
                                  </span>
                                  <span>
                                    <strong className="text-slate-500 font-medium">Pallets:</strong>{' '}
                                    {line.palletCount}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    Harvest {line.harvestDate}
                                  </span>
                                  <span>
                                    <strong className="text-slate-500 font-medium">BBD:</strong>{' '}
                                    {line.bestBefore}
                                  </span>
                                  <span>
                                    <strong className="text-slate-500 font-medium">Gross wt:</strong>{' '}
                                    {line.grossWeightKg.toLocaleString()} kg
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  {altSupplierName && (
                    <div className="pt-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Alt supplier
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {altSupplierName}
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <aside className="p-4 bg-slate-50/40 dark:bg-slate-950/30 lg:sticky lg:top-3 self-start">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-4">
                    Shipment milestones
                  </h3>
                  <PoShipmentTimeline milestones={selectedTimeline} />
                  {selectedShipment && (
                    <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
                      Stage: {STAGE_LABELS[selectedShipment.stage]}
                      {selectedShipment.containerNumber
                        ? ` · ${selectedShipment.containerNumber}`
                        : ''}
                    </p>
                  )}
                </aside>
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
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                {asnMode === 'rfq' ? 'Upload shipping against RFQ' : 'Mass ASN upload'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {asnMode === 'rfq'
                  ? 'Contract flow — shipping upload creates the purchase order'
                  : 'One container · multiple POs · photo OCR or manual entry'}
              </p>
            </div>
            <div className="p-5 space-y-4">
              {awaitingRfqs.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAsnMode('rfq');
                      setLinkedPoIds([]);
                      if (!linkedRfqId && awaitingRfqs[0]) setLinkedRfqId(awaitingRfqs[0].id);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold uppercase border',
                      asnMode === 'rfq'
                        ? 'bg-[#4684AD] text-white border-[#4684AD]'
                        : 'border-slate-200 text-slate-500'
                    )}
                  >
                    RFQ shipping
                  </button>
                  {eligiblePos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAsnMode('po');
                        setLinkedRfqId(null);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold uppercase border',
                        asnMode === 'po'
                          ? 'bg-[#4684AD] text-white border-[#4684AD]'
                          : 'border-slate-200 text-slate-500'
                      )}
                    >
                      Existing PO
                    </button>
                  )}
                </div>
              )}

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

              {asnMode === 'rfq' ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Select awarded RFQ
                  </span>
                  {awaitingRfqs.length === 0 ? (
                    <p className="text-sm text-slate-500">No awarded RFQs awaiting shipping.</p>
                  ) : (
                    awaitingRfqs.map((r) => {
                      const on = linkedRfqId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setLinkedRfqId(r.id)}
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
                          <span className="font-code font-semibold">{r.id}</span>
                          <span className="truncate">{r.item}</span>
                          <span className="ml-auto text-slate-500 shrink-0">
                            {r.quantity} cs
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
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
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400">ASN number</span>
                  <input
                    value={asnFields.asnNumber}
                    onChange={(e) => setAsnFields((f) => ({ ...f, asnNumber: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-code"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Container</span>
                  <input
                    value={asnFields.containerNumber}
                    onChange={(e) => setAsnFields((f) => ({ ...f, containerNumber: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-code"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Ship date</span>
                  <input
                    type="date"
                    value={asnFields.shipDate}
                    onChange={(e) => setAsnFields((f) => ({ ...f, shipDate: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400">ETA</span>
                  <input
                    value={asnFields.eta}
                    onChange={(e) => setAsnFields((f) => ({ ...f, eta: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {asnMode === 'rfq' && (
                <p className="text-xs text-slate-500 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                  Submitting will create a purchase order and notify the DC team. No PO
                  exists until this step.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={
                    saving ||
                    !asnFields.asnNumber ||
                    (asnMode === 'rfq' ? !linkedRfqId : !linkedPoIds.length)
                  }
                  onClick={submitAsn}
                  className={cn(btnPrimaryClass, 'flex-1 disabled:opacity-50')}
                >
                  {saving
                    ? 'Submitting…'
                    : asnMode === 'rfq'
                      ? 'Submit shipping & create PO'
                      : 'Submit ASN to DC'}
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

      {pomsSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/45">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-wide">PO created</h2>
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <p>
                Shipping details for <strong>{pomsSuccess.rfqId}</strong> were received. Purchase order{' '}
                <strong className="font-code text-[#4684AD]">{pomsSuccess.poNumber}</strong> was created.
              </p>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs space-y-1">
                <div>
                  <span className="text-slate-400">Item · </span>
                  {pomsSuccess.item}
                </div>
                <div>
                  <span className="text-slate-400">Supplier · </span>
                  {SUPPLIER_NAME}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                You can proceed in SAP Purchase Orders and Logistics Tracking.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPomsSuccess(null);
                    setSelectedPo(pomsSuccess.poNumber);
                  }}
                  className={cn(btnPrimaryClass, 'flex-1')}
                >
                  View PO & continue
                </button>
                <button
                  type="button"
                  onClick={() => setPomsSuccess(null)}
                  className={btnSecondaryClass}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
