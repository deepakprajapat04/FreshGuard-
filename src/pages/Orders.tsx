/**
 * SAP purchase orders — 3-panel: list · header summary · detail wizard.
 */
import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { SAP } from '../lib/sapTheme';
import {
  DEMO_POS,
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

type WizardStep = 'item' | 'shipment';

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
    Acknowledged: 'bg-blue-50 text-[#074E8C] border-[#0A6ED1]/30',
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">{value}</dd>
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

  const selectPo = (po: string) => {
    setSelectedPo(po);
    setDetailOpen(false);
    setWizardStep('item');
  };

  const openDetail = () => {
    if (selected) setDetailOpen(true);
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
            ? 'Select a PO to view header details. Open detail wizard for line & shipment info.'
            : 'Synced from SAP. Select a PO — header summary in center, full detail wizard on the right.'
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
            className="px-4 py-3 border-b border-white/20 text-white shrink-0"
            style={{ background: SAP.shellGradient }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wide">SAP PO list</h2>
            <p className="text-[10px] text-blue-100 mt-0.5">Blueberries & Strawberries</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {visibleOrders.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No POs for this view.</p>
            ) : (
              visibleOrders.map((o) => {
                const active = selectedPo === o.po;
                return (
                  <button
                    key={o.po}
                    type="button"
                    onClick={() => selectPo(o.po)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      active
                        ? 'bg-[#E5F0FA] dark:bg-blue-950/40 border-l-4 border-l-[#0A6ED1]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-code text-xs font-bold text-[#074E8C] dark:text-blue-300">
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
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Panel 2 — Header detail */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-hidden">
          <div
            className="px-4 py-3 border-b border-white/20 text-white shrink-0 flex items-center justify-between"
            style={{ backgroundColor: SAP.headerBg }}
          >
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide">PO header</h2>
              <p className="text-[10px] text-blue-100 mt-0.5">
                {selected ? selected.po : 'Select a purchase order'}
              </p>
            </div>
            {selected && (
              <button
                type="button"
                onClick={openDetail}
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
              <div className="rounded-lg border border-[#0A6ED1]/20 bg-[#E5F0FA]/60 dark:bg-blue-950/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-code text-lg font-bold text-[#074E8C] dark:text-blue-300">
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
                  <div className="font-bold text-[#074E8C] flex items-center gap-1.5">
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

              <button
                type="button"
                onClick={openDetail}
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
              className="px-4 py-3 border-b border-white/20 text-white shrink-0 flex items-start justify-between gap-2"
              style={{ background: SAP.shellGradient }}
            >
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide">PO detail wizard</h2>
                <p className="text-[10px] text-blue-100 mt-0.5 font-code">{selected.po}</p>
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
                  { id: 'item' as const, label: 'Item detail', icon: Package },
                  { id: 'shipment' as const, label: 'Shipment detail', icon: Truck },
                ] as const
              ).map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setWizardStep(step.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors',
                    wizardStep === step.id
                      ? 'border-[#0A6ED1] text-[#0A6ED1] bg-[#E5F0FA]/50 dark:bg-blue-950/30'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                      wizardStep === step.id
                        ? 'bg-[#0A6ED1] text-white'
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
                  <div className="flex items-center gap-2 text-sm font-bold text-[#074E8C]">
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
                    className="w-full py-2 rounded-lg border border-[#0A6ED1] text-[#0A6ED1] text-xs font-bold uppercase flex items-center justify-center gap-2"
                  >
                    Next: Shipment detail
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {wizardStep === 'shipment' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#074E8C]">
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
                              <span className="font-bold text-[#074E8C]">{line.item}</span>
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
                    onClick={() => setWizardStep('item')}
                    className="w-full py-2 rounded-lg border text-xs font-bold uppercase text-slate-600"
                  >
                    Back to item detail
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
              className="px-5 py-4 border-b border-white/20 text-white"
              style={{ background: SAP.shellGradient }}
            >
              <h2 className="text-sm font-bold uppercase tracking-wide">Mass ASN upload</h2>
              <p className="text-xs text-blue-100 mt-1">
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
                        on ? 'border-[#0A6ED1] bg-[#E5F0FA]/60' : 'border-slate-200'
                      )}
                    >
                      {on ? (
                        <CheckSquare className="w-4 h-4 text-[#0A6ED1]" />
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
