import { Activity, CheckCircle2, Link2, Ship, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSyncAge } from '../../lib/psa';
import type { BuyerShipmentAlert } from '../../lib/psa';
import type { Shipment } from '../../lib/shipmentTypes';
import { DataTable, type DataTableColumn } from '../DataTable';

interface Props {
  shipments: Shipment[];
  searchQuery: string;
  isVendor: boolean;
  buyerAlerts: BuyerShipmentAlert[];
  onTrack: (id: string) => void;
  onOpenAlerts: () => void;
}

export function ShipmentDashboard({
  shipments,
  searchQuery,
  isVendor,
  buyerAlerts,
  onTrack,
  onOpenAlerts,
}: Props) {
  const active = shipments.filter((s) => s.stage === 'delivering').length;
  const synced = shipments.filter((s) => s.psaSyncStatus === 'synced').length;
  const delayed = shipments.filter((s) => s.status === 'delayed').length;
  const onTime = shipments.filter((s) => s.status === 'on-time').length;
  const ocean = shipments.filter((s) => s.transportMode === 'ocean').length;
  const syncPct = shipments.length ? Math.round((synced / shipments.length) * 100) : 100;

  const cards = [
    {
      label: 'Active shipments',
      value: active,
      sub: 'In transit',
      accent: 'from-sky-500/20 to-transparent',
      valueClass: 'text-sky-300',
      bar: 'bg-sky-400',
    },
    {
      label: 'PSA sync health',
      value: `${syncPct}%`,
      sub: `${synced} containers linked`,
      accent: 'from-emerald-500/20 to-transparent',
      valueClass: 'text-emerald-300',
      bar: 'bg-emerald-400',
    },
    {
      label: 'On-time / delayed',
      value: `${onTime} / ${delayed}`,
      sub: 'Live status mix',
      accent: 'from-amber-500/20 to-transparent',
      valueClass: 'text-amber-300',
      bar: 'bg-amber-400',
    },
    {
      label: 'Ocean via PSA',
      value: ocean,
      sub: 'Portnet vessel lots',
      accent: 'from-cyan-500/20 to-transparent',
      valueClass: 'text-cyan-300',
      bar: 'bg-cyan-400',
    },
  ];

  const filtered = shipments.filter(
    (s) =>
      !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.containerNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.product || s.item || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: DataTableColumn<Shipment>[] = [
    {
      key: 'id',
      label: 'PO / Container',
      getValue: (s) => `${s.id} ${s.containerNumber || ''} ${s.product || s.item || ''}`,
      render: (s) => (
        <div>
          <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{s.id}</div>
          <div className="text-slate-500 font-mono">{s.containerNumber}</div>
          <div className="text-slate-400 truncate max-w-[220px]">{s.product || s.item}</div>
        </div>
      ),
    },
    {
      key: 'transportMode',
      label: 'Mode',
      filterType: 'select',
      getValue: (s) => s.transportMode || 'road',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300">
          {s.transportMode === 'ocean' ? (
            <Ship className="w-3.5 h-3.5 text-sky-600" />
          ) : (
            <Truck className="w-3.5 h-3.5 text-slate-500" />
          )}
          {s.transportMode || 'road'}
        </span>
      ),
    },
    {
      key: 'psaSyncStatus',
      label: 'PSA Status',
      filterType: 'select',
      getValue: (s) => s.psaSyncStatus || 'pending',
      render: (s) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] font-black uppercase',
            s.psaSyncStatus === 'synced'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-800'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {s.psaSyncStatus || 'pending'}
        </span>
      ),
    },
    {
      key: 'psaLastSyncAt',
      label: 'Last Sync',
      getValue: (s) => s.psaLastSyncAt || '',
      render: (s) => (
        <span className="font-mono text-slate-500">{formatSyncAge(s.psaLastSyncAt)}</span>
      ),
    },
    {
      key: 'eta',
      label: 'ETA',
      getValue: (s) => (s.status === 'delivered' ? 'Closed' : s.eta),
      render: (s) => (
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
          {s.status === 'delivered' ? 'Closed' : s.eta}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      filterType: 'select',
      defaultHidden: true,
    },
    {
      key: 'actions',
      label: 'Action',
      sortable: false,
      filterable: false,
      getValue: () => '',
      render: (s) => (
        <button
          type="button"
          onClick={() => onTrack(s.id)}
          className="text-[10px] font-black uppercase font-mono text-sky-700 dark:text-sky-400 hover:underline"
        >
          Track
        </button>
      ),
    },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              'relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0f2744] p-5 shadow-lg',
              'bg-gradient-to-br',
              card.accent
            )}
            style={{ backgroundColor: '#0f2744' }}
          >
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-100', card.accent)} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  {card.label}
                </div>
                <span className={cn('h-1.5 w-8 rounded-full', card.bar)} />
              </div>
              <div className={cn('text-3xl font-black mt-2 tracking-tight', card.valueClass)}>
                {card.value}
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 rounded-2xl overflow-hidden border border-slate-700/60 shadow-xl bg-white dark:bg-slate-900">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(s) => s.id}
            title="Shipment Tracking Board"
            subtitle="Every lot is mirrored on PSA Portnet®"
            excelFileName="shipment-tracking-board.xls"
            emptyMessage="No shipments match the current filters."
            toolbarExtra={
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <Activity className="w-3.5 h-3.5" />
                Live feed
              </div>
            }
          />
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="bg-gradient-to-br from-[#0c1e36] via-[#123556] to-[#0a4d68] text-white rounded-2xl p-5 shadow-xl border border-sky-900/40 min-h-[220px]">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-sky-300">
              <Link2 className="w-4 h-4" /> Integration
            </div>
            <h3 className="text-lg font-black mt-2">PSA Portnet® Connected</h3>
            <p className="text-xs text-sky-100/75 mt-2 leading-relaxed">
              FreshGuard mirrors container gate-in/out, vessel AIS, discharge, and reefer feeds from
              PSA. Supplier edits publish upstream; retail tracking reads the same event ledger.
            </p>
            <ul className="mt-4 space-y-2 text-[11px] font-mono text-sky-50/90">
              <li className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Bi-directional
                container events
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Vessel &amp; haulage
                position sync
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Periodic buyer alert
                channel
              </li>
            </ul>
          </div>

          {!isVendor && (
            <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg bg-white dark:bg-slate-900">
              <div className="px-4 py-3 bg-[#0f2744] flex items-center justify-between">
                <h4 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                  Latest buyer alerts
                </h4>
                <button
                  onClick={onOpenAlerts}
                  className="text-[10px] font-bold text-sky-300 font-mono uppercase hover:text-white"
                >
                  View all
                </button>
              </div>
              <div className="p-3 space-y-2">
                {buyerAlerts.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-950/50"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-200">{a.title}</div>
                    <div className="text-slate-500 line-clamp-2 mt-0.5">{a.message}</div>
                  </div>
                ))}
                {buyerAlerts.length === 0 && (
                  <p className="text-[11px] text-slate-400 font-mono py-4 text-center">
                    Alerts will appear as PSA heartbeats arrive.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
