/**
 * SAP purchase orders + supplier ASN (no bidding).
 */
import { useMemo, useState } from 'react';
import { Upload, Package, CheckSquare, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { DataTable, type DataTableColumn } from '../components/DataTable';
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

function toDateInputValue(raw?: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export default function Orders() {
  const { persona } = usePersona();
  const isSupplier = persona === 'supplier';
  const [orders, setOrders] = useState<SapPurchaseOrder[]>(() => [...DEMO_POS]);
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
    () =>
      isSupplier
        ? orders.filter((o) => o.supplier === SUPPLIER_NAME)
        : orders,
    [orders, isSupplier]
  );

  const eligiblePos = visibleOrders.filter(
    (o) => o.status === 'Acknowledged' || o.status === 'Open'
  );

  const columns: DataTableColumn<SapPurchaseOrder>[] = [
    { key: 'po', label: 'SAP PO', className: 'font-code font-semibold text-sm' },
    { key: 'item', label: 'Item', className: 'font-semibold' },
    ...(isSupplier
      ? []
      : [{ key: 'supplier', label: 'Supplier', filterType: 'select' as const }]),
    {
      key: 'orderedQty',
      label: 'Qty',
      render: (r) => `${r.orderedQty.toLocaleString()} ${r.unit}`,
    },
    { key: 'deliveryDate', label: 'Delivery date' },
    {
      key: 'status',
      label: 'Status',
      filterType: 'select',
      render: (r) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-200 bg-slate-50">
          {r.status}
        </span>
      ),
    },
    { key: 'destination', label: 'Destination', defaultHidden: true },
  ];

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
    const dr = new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ''));
      r.readAsDataURL(file);
    });
    await dr;
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

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow={isSupplier ? PERSONA_LABELS.supplier : 'SAP integration'}
        title="Purchase orders"
        subtitle={
          isSupplier
            ? 'Your SAP POs from DC. Mass-upload ASN for one container covering multiple POs.'
            : 'Purchase orders synced from SAP. Suppliers submit ASN against acknowledged lines.'
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold"
          >
            <Upload className="w-4 h-4" />
            Create / upload ASN
          </button>
        )}
      </PageHeader>

      <DataTable
        data={visibleOrders}
        columns={columns}
        rowKey={(r) => r.po}
        title="SAP purchase order list"
        subtitle="Demo scope: Blueberries & Strawberries only"
        excelFileName="sap-purchase-orders.xls"
        emptyMessage="No POs for this view."
      />

      {asnOpen && isSupplier && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-[#1a2332] text-white">
              <h2 className="text-sm font-bold uppercase tracking-wide">Mass ASN upload</h2>
              <p className="text-xs text-slate-300 mt-1">
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
                        on ? 'border-[#1e3a5f] bg-slate-50' : 'border-slate-200'
                      )}
                    >
                      {on ? <CheckSquare className="w-4 h-4 text-[#1e3a5f]" /> : <Square className="w-4 h-4 text-slate-400" />}
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
                  className="flex-1 py-2.5 rounded-lg bg-[#1e3a5f] text-white text-xs font-bold uppercase disabled:opacity-50"
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
