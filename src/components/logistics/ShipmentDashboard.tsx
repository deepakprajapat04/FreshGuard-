import { useState } from 'react';
import { Activity, CalendarDays, CheckCircle2, Link2, Ship, Table2, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSyncAge } from '../../lib/psa';
import type { BuyerShipmentAlert } from '../../lib/psa';
import type { Shipment } from '../../lib/shipmentTypes';
import { DataTable, type DataTableColumn } from '../DataTable';
import { ShipmentCalendar } from './ShipmentCalendar';

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
  const [boardView, setBoardView] = useState<'calendar' | 'table'>('calendar');

  const active = shipments.filter((s) => s.stage === 'delivering').length;
  const synced = shipments.filter((s) => s.psaSyncStatus === 'synced').length;
  const delayed = shipments.filter((s) => s.status === 'delayed').length;
  const onTime = shipments.filter((s) => s.status === 'on-time').length;
  const ocean = shipments.filter((s) => s.transportMode === 'ocean').length;
  const syncPct = shipments.length ? Math.round((synced / shipments.length) * 100) : 100;

  const cards = [
    { label: 'Active', value: active, sub: 'In transit', valueClass: 'text-sky-300', bar: 'bg-sky-400' },
    { label: 'PSA sync', value: `${syncPct}%`, sub: `${synced} linked`, valueClass: 'text-emerald-300', bar: 'bg-emerald-400' },
    { label: 'On-time / delayed', value: `${onTime}/${delayed}`, sub: 'Status mix', valueClass: 'text-amber-300', bar: 'bg-amber-400' },
    { label: 'Sea lots', value: ocean, sub: 'Ocean via PSA', valueClass: 'text-cyan-300', bar: 'bg-cyan-400' },
  ];

  const filtered = shipments.filter(
    (s) =>
      !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.containerNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.product || s.item || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: DataTableColumn<Shipment>[] = [
    {
      key: 'id',
      label: 'PO / Container',
      getValue: (s) => `${s.id} ${s.containerNumber || ''} ${s.product || s.item || ''}`,
      render: (s) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{s.id}</div>
          <div className="text-slate-500 text-[11px]">{s.containerNumber}</div>
          <div className="text-slate-400 truncate max-w-[220px]">{s.product || s.item}</div>
        </div>
      ),
    },
    {
      key: 'vendor',
      label: 'Supplier',
      filterType: 'select',
      className: 'font-medium text-slate-700 dark:text-slate-300',
    },
    {
      key: 'transportMode',
      label: 'Mode',
      filterType: 'select',
      getValue: (s) => s.transportMode || 'road',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300">
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
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
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
        <span className="text-slate-500 text-[11px]">{formatSyncAge(s.psaLastSyncAt)}</span>
      ),
    },
    {
      key: 'eta',
      label: 'ETA',
      getValue: (s) => (s.status === 'delivered' ? 'Closed' : s.eta),
      render: (s) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {s.status === 'delivered' ? 'Closed' : s.eta}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      filterType: 'select',
      filterOptions: ['on-time', 'delayed', 'delivered'],
      getValue: (s) => s.status,
      render: (s) => (
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase',
            s.status === 'delayed'
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
              : s.status === 'delivered'
                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          )}
        >
          {s.status}
        </span>
      ),
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
          className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400 hover:underline"
        >
          Track
        </button>
      ),
    },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-xl border border-slate-700/80 p-3.5 shadow-md"
            style={{ backgroundColor: '#0f2744' }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </div>
              <span className={cn('h-1 w-6 rounded-full', card.bar)} />
            </div>
            <div className={cn('text-2xl font-bold mt-1 tracking-tight', card.valueClass)}>
              {card.value}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="inline-flex bg-[#0c1e36] p-1 rounded-xl border border-sky-900/60 shadow-sm">
          <button
            type="button"
            onClick={() => setBoardView('calendar')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              boardView === 'calendar'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setBoardView('table')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              boardView === 'table'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            )}
          >
            <Table2 className="w-4 h-4" />
            Table
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {boardView === 'calendar'
            ? 'Supplier rows with transit bars across days / weeks / months'
            : 'Sortable ledger with column filters and Excel export'}
        </p>
      </div>

      {boardView === 'calendar' ? (
        <ShipmentCalendar
          shipments={shipments}
          searchQuery={searchQuery}
          onSelectShipment={onTrack}
          className="min-h-[520px] max-h-[calc(100vh-280px)]"
        />
      ) : (
        <div className="grid xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8 rounded-2xl overflow-hidden border border-slate-700/60 shadow-xl bg-white dark:bg-slate-900">
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(s) => s.id}
              title="Shipment Tracking Board"
              subtitle="Every lot is mirrored on PSA Portnet®"
              excelFileName="shipment-tracking-board.xls"
              emptyMessage="No shipments match the current filters."
              initialFilterOpen={true}
              toolbarExtra={
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  <Activity className="w-3.5 h-3.5" />
                  Live feed
                </div>
              }
            />
          </div>

          <div className="xl:col-span-4 space-y-3">
            <div className="bg-gradient-to-br from-[#0c1e36] via-[#123556] to-[#0a4d68] text-white rounded-2xl p-4 shadow-xl border border-sky-900/40">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                <Link2 className="w-4 h-4" /> Integration
              </div>
              <h3 className="text-base font-bold mt-1.5">PSA Portnet® Connected</h3>
              <p className="text-xs text-sky-100/75 mt-1.5 leading-relaxed">
                Sea and land lots share the same event ledger for retail buyers.
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-sky-50/90">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Bi-directional events
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> Vessel &amp; haulage sync
                </li>
              </ul>
            </div>

            {!isVendor && (
              <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg bg-white dark:bg-slate-900">
                <div className="px-4 py-2.5 bg-[#0f2744] flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Buyer alerts</h4>
                  <button
                    onClick={onOpenAlerts}
                    className="text-[10px] font-bold text-sky-300 uppercase hover:text-white"
                  >
                    View all
                  </button>
                </div>
                <div className="p-3 space-y-2 max-h-48 overflow-auto">
                  {buyerAlerts.slice(0, 4).map((a) => (
                    <div
                      key={a.id}
                      className="text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-950/50"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                        {a.title}
                        <span
                          className={cn(
                            'text-[8px] font-extrabold uppercase tracking-wider px-1 py-0.5 rounded',
                            a.category === 'Urgent'
                              ? 'bg-rose-100 text-rose-700'
                              : a.category === 'Regular'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-200 text-slate-600'
                          )}
                        >
                          {a.category}
                        </span>
                      </div>
                      <div className="text-slate-500 line-clamp-2 mt-0.5">{a.message}</div>
                    </div>
                  ))}
                  {buyerAlerts.length === 0 && (
                    <p className="text-[11px] text-slate-400 py-4 text-center">No alerts yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
