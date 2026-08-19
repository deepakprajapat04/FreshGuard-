/**
 * SAP purchase orders — 3-panel: list · header summary · detail wizard.
 */
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Upload,
  CheckSquare,
  Square,
  ChevronRight,
  X,
  Package,
  Truck,
  FileText,
  Building2,
  Calendar,
  TrendingDown,
  AlertTriangle,
  Store,
  Megaphone,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { SAP } from '../lib/sapTheme';
import {
  DEMO_POS,
  buildPoRiskImpact,
  type PoRiskImpact,
  type SapPurchaseOrder,
  PERSONA_LABELS,
} from '../lib/trackingFlow';
import {
  looksLikeSampleAsn,
  parseAsnText,
  SAMPLE_ASN_CAPTURE,
  type CapturedAsnFields,
} from '../lib/asnCapture';

const SUPPLIER_NAME = 'Berry Farms Co-op';
const STORAGE_KEY = 'freshguard-active-shipments-v6';

type WizardStep = 'item' | 'shipment' | 'risk';

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
    Acknowledged: 'bg-blue-50 text-[#4A7394] border-[#6A9EC8]/30',
    'ASN Submitted': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'In Transit': 'bg-amber-50 text-amber-900 border-amber-200',
    Received: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded border', styles[status])}>
      {status}
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">{value}</dd>
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
  const [orders, setOrders] = useState<SapPurchaseOrder[]>(() => [...DEMO_POS]);
  const [selectedPo, setSelectedPo] = useState<string | null>(DEMO_POS[0]?.po ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('item');
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

  const visibleOrders = useMemo(
    () => (isSupplier ? orders.filter((o) => o.supplier === SUPPLIER_NAME) : orders),
    [orders, isSupplier]
  );

  const selected = visibleOrders.find((o) => o.po === selectedPo) ?? null;
  const eligiblePos = visibleOrders.filter(
    (o) => o.status === 'Acknowledged' || o.status === 'Open'
  );

  const riskByPo = useMemo(() => {
    const map = new Map<string, PoRiskImpact>();
    for (const o of orders) {
      const impact = buildPoRiskImpact(o);
      if (impact) map.set(o.po, impact);
    }
    return map;
  }, [orders]);

  const selectedRisk = selected ? (riskByPo.get(selected.po) ?? null) : null;

  const selectPo = (po: string) => {
    setSelectedPo(po);
    setDetailOpen(false);
    setWizardStep('item');
  };

  const openDetail = (step: WizardStep = 'item') => {
    if (!selected) return;
    setWizardStep(step);
    setDetailOpen(true);
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
        prev.map((o) =>
          linkedPoIds.includes(o.po) ? { ...o, status: 'ASN Submitted' as const } : o
        )
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

  const gridCols = detailOpen
    ? 'lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.1fr)_minmax(320px,1.4fr)]'
    : 'lg:grid-cols-[minmax(260px,1fr)_minmax(320px,1.2fr)]';

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow={isSupplier ? PERSONA_LABELS.supplier : 'SAP S/4HANA'}
        title="Purchase orders"
        subtitle={
          isSupplier
            ? 'Select a PO for header, shipment and the delivery risk raised against it.'
            : 'Synced from SAP. Delivery risk on each PO is derived from its linked shipment event.'
        }
      >
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: SAP.blue }}
          >
            <Upload className="w-4 h-4" />
            Create / upload ASN
          </button>
        )}
      </PageHeader>

      <div className={cn('grid grid-cols-1 gap-3 min-h-[calc(100vh-12rem)]', gridCols)}>
        {/* Panel 1 — PO list */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-hidden">
          <div
            className="px-4 py-3 border-b border-[#B8CFE0]/60 text-[#4A7394] shrink-0"
            style={{ background: SAP.shellGradient }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wide">SAP PO list</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Blueberries & Strawberries</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {visibleOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs for this view.</p>
            ) : (
              visibleOrders.map((o) => {
                const active = selectedPo === o.po;
                const risk = riskByPo.get(o.po);
                return (
                  <button
                    key={o.po}
                    type="button"
                    onClick={() => selectPo(o.po)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      active
                        ? 'bg-[#EDF3F9] dark:bg-blue-950/40 border-l-4 border-l-[#6A9EC8]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-xs font-bold text-[#4A7394] dark:text-blue-300">
                        {o.po}
                      </span>
                      {statusBadge(o.status)}
                    </div>
                    <div className="text-sm font-semibold mt-1 text-slate-800 dark:text-slate-100">
                      {o.item}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {o.orderedQty.toLocaleString()} {o.unit} · {o.deliveryDate}
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

        {/* Panel 2 — Header detail */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-hidden">
          <div
            className="px-4 py-3 border-b border-[#B8CFE0]/60 text-[#4A7394] shrink-0 flex items-center justify-between"
            style={{ backgroundColor: SAP.headerBg }}
          >
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide">PO header</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {selected ? selected.po : 'Select a purchase order'}
              </p>
            </div>
            {selected && (
              <button
                type="button"
                onClick={() => openDetail()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold uppercase"
              >
                Detail
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-400">
              Select a PO from the list
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="rounded-lg border border-[#6A9EC8]/20 bg-[#EDF3F9]/60 dark:bg-blue-950/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-code text-lg font-bold text-[#4A7394] dark:text-blue-300">
                      {selected.po}
                    </div>
                    <div className="text-base font-semibold mt-1">{selected.item}</div>
                  </div>
                  {statusBadge(selected.status)}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
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
                  value={`${selected.itemDetail.currency} ${(selected.itemDetail.unitPrice * selected.orderedQty).toLocaleString()}`}
                />
              </dl>

              {selected.shipmentDetail && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-1">
                  <div className="font-bold text-[#4A7394] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    Shipment linked
                  </div>
                  <p>
                    Container <strong>{selected.shipmentDetail.containerNumber}</strong> · ASN{' '}
                    {selected.shipmentDetail.asnNumber}
                  </p>
                  <p className="text-slate-500">ETA {selected.shipmentDetail.eta}</p>
                </div>
              )}

              {selectedRisk && selectedRisk.severity !== 'none' && (
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
                  <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    <RiskStat
                      label="DC arrival"
                      value={formatShortDate(selectedRisk.revisedEta)}
                      sub={`planned ${formatShortDate(selectedRisk.originalEta)}`}
                      valueClass="text-amber-800"
                    />
                    <RiskStat
                      label="Store shelf"
                      value={formatShortDate(selectedRisk.storeShelfDate)}
                      sub={`DC + ${selectedRisk.storeTransitBufferDays}d dock-to-shelf`}
                      valueClass="text-[#4A7394]"
                    />
                    <RiskStat
                      label="Stock at risk"
                      value={selectedRisk.oosGapDays > 0 ? `${selectedRisk.oosGapDays}d` : 'None'}
                      sub={
                        selectedRisk.oosGapDays > 0
                          ? `on-hand expires ${formatShortDate(selectedRisk.onHandExpiresDate)}`
                          : 'covered until store'
                      }
                      valueClass={
                        selectedRisk.oosGapDays > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }
                    />
                    <RiskStat
                      label="Stores affected"
                      value={`${selectedRisk.storesAtRisk}`}
                      sub={`of ${selectedRisk.storesTotal} on this item`}
                      valueClass={
                        selectedRisk.storesAtRisk > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail('risk')}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 text-xs font-semibold text-[#4A7394] hover:bg-[#EDF3F9]/60"
                  >
                    <span>
                      {isSupplier ? 'What the buyer needs from you' : 'Downstream impact & actions'}
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => openDetail()}
                className="w-full py-2.5 rounded-lg text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"
                style={{ backgroundColor: SAP.blue }}
              >
                <FileText className="w-4 h-4" />
                Open detail wizard
              </button>
            </div>
          )}
        </section>

        {/* Panel 3 — Detail wizard */}
        {detailOpen && selected && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-hidden lg:col-span-1">
            <div
              className="px-4 py-3 border-b border-[#B8CFE0]/60 text-[#4A7394] shrink-0 flex items-start justify-between gap-2"
              style={{ background: SAP.shellGradient }}
            >
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide">PO detail wizard</h2>
                <p className="text-[10px] text-slate-500 mt-0.5 font-code">{selected.po}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-1 rounded hover:bg-white/15"
                aria-label="Close detail panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
              {(
                [
                  { id: 'item' as const, label: 'Item', icon: Package },
                  { id: 'shipment' as const, label: 'Shipment', icon: Truck },
                  { id: 'risk' as const, label: 'Delivery risk', icon: TrendingDown },
                ] as const
              ).map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setWizardStep(step.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors',
                    wizardStep === step.id
                      ? 'border-[#6A9EC8] text-[#6A9EC8] bg-[#EDF3F9]/50 dark:bg-blue-950/30'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                      wizardStep === step.id
                        ? 'bg-[#6A9EC8] text-white'
                        : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <step.icon className="w-3.5 h-3.5 hidden sm:block" />
                  {step.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {wizardStep === 'item' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#4A7394]">
                    <Package className="w-4 h-4" />
                    Item detail — {selected.item}
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <DetailField label="Material number" value={selected.itemDetail.materialNumber} />
                    <DetailField label="SKU" value={selected.itemDetail.sku} />
                    <div className="col-span-2">
                      <DetailField label="Description" value={selected.itemDetail.description} />
                    </div>
                    <DetailField
                      label="Ordered / confirmed"
                      value={`${selected.itemDetail.orderedQty.toLocaleString()} / ${selected.itemDetail.confirmedQty.toLocaleString()} ${selected.itemDetail.unit}`}
                    />
                    <DetailField
                      label="Unit price"
                      value={`${selected.itemDetail.currency} ${selected.itemDetail.unitPrice.toFixed(2)}`}
                    />
                    <DetailField label="Shelf life" value={`${selected.itemDetail.shelfLifeDays} days`} />
                    <DetailField label="Storage temp" value={selected.itemDetail.storageTemp} />
                    <DetailField label="Plant" value={selected.itemDetail.plant} />
                    <DetailField label="Storage location" value={selected.itemDetail.storageLocation} />
                    <DetailField
                      label="Net weight"
                      value={`${selected.itemDetail.netWeightKg.toLocaleString()} kg`}
                    />
                    <DetailField label="Country of origin" value={selected.itemDetail.countryOfOrigin} />
                  </dl>
                  <button
                    type="button"
                    onClick={() => setWizardStep('shipment')}
                    className="w-full py-2 rounded-lg border border-[#6A9EC8] text-[#6A9EC8] text-xs font-bold uppercase flex items-center justify-center gap-2"
                  >
                    Next: Shipment
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {wizardStep === 'shipment' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#4A7394]">
                    <Truck className="w-4 h-4" />
                    Shipment detail
                  </div>

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
                      <dl className="grid grid-cols-2 gap-3">
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
                        <h3 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          Cargo lines (per item)
                        </h3>
                        {selected.shipmentDetail.cargoLines.map((line) => (
                          <div
                            key={`${line.poNumber}-${line.lotNumber}`}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-2 bg-slate-50/50 dark:bg-slate-950/40"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-[#4A7394]">{line.item}</span>
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

                  <button
                    type="button"
                    onClick={() => setWizardStep('risk')}
                    className="w-full py-2 rounded-lg border border-[#6A9EC8] text-[#6A9EC8] text-xs font-bold uppercase flex items-center justify-center gap-2"
                  >
                    Next: Delivery risk
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {wizardStep === 'risk' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#4A7394]">
                    <TrendingDown className="w-4 h-4" />
                    Delivery risk
                  </div>

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
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-slate-800">
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
                            valueClass="text-[#4A7394]"
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
                            Downstream impact
                          </h3>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-xs">
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr>
                                  <td className="px-3 py-2.5 text-slate-500 flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5" />
                                    Stores needing stock
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-rose-700">
                                    {selectedRisk.storesAtRisk}
                                    <span className="font-normal text-slate-400 ml-1">
                                      / {selectedRisk.storesTotal}
                                    </span>
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-3 py-2.5 text-slate-500 flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5" />
                                    Transfers to cover
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#4A7394]">
                                    {selectedRisk.moveCount}
                                    <span className="font-normal text-slate-400 ml-1">
                                      moves · {selectedRisk.casesToMove} cases
                                    </span>
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-3 py-2.5 text-slate-500 flex items-center gap-1.5">
                                    <Megaphone className="w-3.5 h-3.5" />
                                    Promotions affected
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-violet-700">
                                    {selectedRisk.promosAtRisk}
                                    <span className="font-normal text-slate-400 ml-1">
                                      · {selectedRisk.promoStoreChanges} store changes
                                    </span>
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-3 py-2.5 text-slate-500 flex items-center gap-1.5">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                    Pricing
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-bold text-amber-800">
                                    {selectedRisk.markdownPercent != null
                                      ? `Markdown ${selectedRisk.markdownPercent}%`
                                      : 'Standard'}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <h3 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide pt-1">
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
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A9EC8] hover:underline"
                          >
                            Open Track → Risk → Act for {selectedRisk.containerNumber}
                          </Link>
                        </section>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setWizardStep('shipment')}
                    className="w-full py-2 rounded-lg border text-xs font-bold uppercase text-slate-600"
                  >
                    Back to shipment
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ASN modal */}
      {asnOpen && isSupplier && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">
            <div
              className="px-5 py-4 border-b border-[#B8CFE0]/60 text-[#4A7394]"
              style={{ background: SAP.shellGradient }}
            >
              <h2 className="text-sm font-bold uppercase tracking-wide">Mass ASN upload</h2>
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
                        on ? 'border-[#6A9EC8] bg-[#EDF3F9]/60' : 'border-slate-200'
                      )}
                    >
                      {on ? (
                        <CheckSquare className="w-4 h-4 text-[#6A9EC8]" />
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
                  className="flex-1 py-2.5 rounded-lg text-white text-xs font-bold uppercase disabled:opacity-50"
                  style={{ backgroundColor: SAP.blue }}
                >
                  {saving ? 'Submitting…' : 'Submit ASN to DC'}
                </button>
                <button
                  type="button"
                  onClick={() => setAsnOpen(false)}
                  className="px-4 py-2.5 rounded-lg border text-sm font-semibold"
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
