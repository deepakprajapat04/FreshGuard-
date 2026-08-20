import { lazy, Suspense, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Link2,
  Loader2,
  Radar,
  Radio,
  Ship,
  Table2,
  Truck,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSyncAge } from '../../lib/psa';
import type { BuyerShipmentAlert } from '../../lib/psa';
import type { Shipment } from '../../lib/shipmentTypes';
import { DataTable, type DataTableColumn } from '../DataTable';
import { ShipmentCalendar } from './ShipmentCalendar';
import { RiskOverviewKpis } from './RiskOverviewKpis';
import type { FleetMapFilter } from './GlobalFleetMap';

const GlobalFleetMap = lazy(() =>
  import('./GlobalFleetMap').then((m) => ({ default: m.GlobalFleetMap }))
);

interface Props {
  shipments: Shipment[];
  searchQuery: string;
  isVendor: boolean;
  buyerAlerts: BuyerShipmentAlert[];
  selectedShipmentId?: string;
  onTrack: (id: string) => void;
  onOpenAlerts: () => void;
  onSelectShipment?: (id: string) => void;
  onDismissAlert?: (id: string) => void;
  onMarkAlertRead?: (id: string) => void;
}

export function ShipmentDashboard({
  shipments,
  searchQuery,
  isVendor,
  buyerAlerts,
  selectedShipmentId,
  onTrack,
  onOpenAlerts,
  onSelectShipment,
  onDismissAlert,
  onMarkAlertRead,
}: Props) {
  const [boardView, setBoardView] = useState<'calendar' | 'table' | 'risk'>('calendar');
  const [fleetFilter, setFleetFilter] = useState<FleetMapFilter>('all');
  const [riskSelectedId, setRiskSelectedId] = useState(selectedShipmentId || '');
  const [mapAlertsOpen, setMapAlertsOpen] = useState(false);

  const active = shipments.filter((s) => s.stage === 'delivering').length;
  const synced = shipments.filter((s) => s.psaSyncStatus === 'synced').length;
  const delayed = shipments.filter((s) => s.status === 'delayed').length;
  const onTime = shipments.filter((s) => s.status === 'on-time').length;
  const ocean = shipments.filter((s) => s.transportMode === 'ocean').length;
  const syncPct = shipments.length ? Math.round((synced / shipments.length) * 100) : 100;

  const cards = [
    { label: 'Active', value: active, sub: 'In transit', valueClass: 'text-[#4684AD]', bar: 'bg-[#C0D5E5]/300' },
    { label: 'PSA sync', value: `${syncPct}%`, sub: `${synced} linked`, valueClass: 'text-emerald-600', bar: 'bg-emerald-500' },
    { label: 'On-time / delayed', value: `${onTime}/${delayed}`, sub: 'Status mix', valueClass: 'text-amber-600', bar: 'bg-amber-500' },
    { label: 'Sea lots', value: ocean, sub: 'Ocean via PSA', valueClass: 'text-cyan-600', bar: 'bg-cyan-500' },
  ];

  const transitShipments = shipments.filter((s) => s.stage === 'delivering' || s.status !== 'delivered');

  const filtered = shipments.filter(
    (s) =>
      !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.containerNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.product || s.item || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const riskMapShipments = transitShipments.filter(
    (s) =>
      !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.containerNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.product || s.item || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeRiskId =
    riskSelectedId && riskMapShipments.some((s) => s.id === riskSelectedId)
      ? riskSelectedId
      : selectedShipmentId && riskMapShipments.some((s) => s.id === selectedShipmentId)
        ? selectedShipmentId
        : riskMapShipments[0]?.id || '';

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
            <Ship className="w-3.5 h-3.5 text-[#4684AD]" />
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
                ? 'bg-[#C0D5E5]/40 text-[#2F5472] dark:bg-sky-950/40 dark:text-[#C0D5E5]'
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
          className="text-[10px] font-bold uppercase text-[#2F5472] dark:text-blue-300 hover:underline"
        >
          Track
        </button>
      ),
    },
  ];

  const viewHint =
    boardView === 'calendar'
      ? 'Supplier rows with transit bars across days / weeks / months'
      : boardView === 'table'
        ? 'Sortable ledger with column filters and Excel export'
        : 'Exposure snapshot KPIs + all-lots fleet map for risk tracking';

  return (
    <div className="w-full space-y-4">
      {boardView !== 'risk' && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </div>
                <span className={cn('h-1 w-6 rounded-full', card.bar)} />
              </div>
              <div className={cn('text-xl font-bold mt-1 tracking-tight', card.valueClass)}>
                {card.value}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="inline-flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setBoardView('calendar');
              setMapAlertsOpen(false);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              boardView === 'calendar'
                ? 'bg-[#4684AD] text-white shadow'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => {
              setBoardView('table');
              setMapAlertsOpen(false);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              boardView === 'table'
                ? 'bg-[#4684AD] text-white shadow'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            <Table2 className="w-4 h-4" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setBoardView('risk')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              boardView === 'risk'
                ? 'bg-[#4684AD] text-white shadow'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            <Radar className="w-4 h-4" />
            Risk Tracking
          </button>
        </div>
        <p className="text-[11px] text-slate-500">{viewHint}</p>
      </div>

      {boardView === 'calendar' && (
        <ShipmentCalendar
          shipments={shipments}
          searchQuery={searchQuery}
          onSelectShipment={onTrack}
          className="min-h-[520px] max-h-[calc(100vh-280px)]"
        />
      )}

      {boardView === 'table' && (
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
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  <Activity className="w-3.5 h-3.5" />
                  Live feed
                </div>
              }
            />
          </div>

          <div className="xl:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#4684AD] dark:text-[#C0D5E5]">
                <Link2 className="w-4 h-4" /> Integration
              </div>
              <h3 className="text-base font-bold mt-1.5">PSA Portnet® Connected</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Sea and land lots share the same event ledger for retail buyers.
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Bi-directional events
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Vessel &amp; haulage sync
                </li>
              </ul>
            </div>

            {!isVendor && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
                <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Buyer alerts</h4>
                  <button
                    onClick={onOpenAlerts}
                    className="text-[10px] font-bold text-[#4684AD] dark:text-[#C0D5E5] uppercase hover:text-[#2F5472] dark:hover:text-white"
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
                                ? 'bg-[#C0D5E5]/40 text-[#2F5472]'
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

      {boardView === 'risk' && (
        <div className="space-y-3">
          <RiskOverviewKpis
            shipments={transitShipments}
            buyerAlerts={buyerAlerts}
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">All-lots fleet map</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Network-wide exposure view · land, sea, and air lots on one map
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isVendor && (
                <button
                  type="button"
                  onClick={() => setMapAlertsOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/20 dark:border-amber-400/40 dark:text-amber-200 text-[10px] font-bold uppercase"
                >
                  Alerts{buyerAlerts.length ? ` (${buyerAlerts.length})` : ''}
                </button>
              )}
              <button
                type="button"
                disabled={!activeRiskId}
                onClick={() => activeRiskId && onTrack(activeRiskId)}
                className="px-3 py-1.5 rounded-lg bg-[#4684AD] hover:bg-[#3B7398] disabled:opacity-40 text-white text-[10px] font-bold uppercase"
              >
                Open selected in Live Tracking
              </button>
            </div>
          </div>

          <div className="relative min-h-[420px] h-[min(58vh,560px)] rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
            <Suspense
              fallback={
                <div className="h-full min-h-[320px] rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading fleet map…
                </div>
              }
            >
              <GlobalFleetMap
                shipments={riskMapShipments}
                selectedId={activeRiskId}
                filter={fleetFilter}
                onFilterChange={setFleetFilter}
                onSelect={(id) => {
                  setRiskSelectedId(id);
                  onSelectShipment?.(id);
                }}
                onOpenLot={(id) => {
                  setRiskSelectedId(id);
                  onTrack(id);
                }}
              />
            </Suspense>

            {mapAlertsOpen && !isVendor && (
              <div className="absolute inset-0 z-[500] pointer-events-none">
                <button
                  type="button"
                  aria-label="Close alerts"
                  className="absolute inset-0 bg-slate-950/20 pointer-events-auto"
                  onClick={() => setMapAlertsOpen(false)}
                />
                <aside
                  className="absolute top-3 right-3 bottom-3 w-[min(100%-1.5rem,22rem)] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                  role="dialog"
                  aria-label="Periodic shipment alerts"
                >
                  <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Periodic Shipment Alerts
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Overlaid on fleet map · PSA heartbeat
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMapAlertsOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-white/10"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
                    {buyerAlerts.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-400">
                        Waiting for next PSA heartbeat…
                      </div>
                    ) : (
                      buyerAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            'rounded-xl border p-3 space-y-2',
                            alert.category === 'Urgent'
                              ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
                              : alert.category === 'Regular'
                                ? 'border-[#86A8C2]/50 bg-[#C0D5E5]/40 dark:border-sky-900/40 dark:bg-sky-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40',
                            !alert.read && 'ring-1 ring-emerald-500/40'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {alert.title}
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                                  alert.category === 'Urgent'
                                    ? 'bg-rose-100 text-rose-700'
                                    : alert.category === 'Regular'
                                      ? 'bg-[#C0D5E5]/40 text-[#2F5472]'
                                      : 'bg-slate-100 text-slate-600'
                                )}
                              >
                                {alert.category}
                              </span>
                            </div>
                            {onDismissAlert && (
                              <button
                                type="button"
                                onClick={() => onDismissAlert(alert.id)}
                                className="text-slate-400 hover:text-slate-600 shrink-0"
                                aria-label="Dismiss alert"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            {alert.message}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                            <span className="truncate">
                              {alert.containerNumber} · {alert.source}
                            </span>
                            <span className="shrink-0">
                              {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {!alert.read && onMarkAlertRead && (
                              <button
                                type="button"
                                onClick={() => onMarkAlertRead(alert.id)}
                                className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400"
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setMapAlertsOpen(false);
                                onTrack(alert.shipmentId);
                              }}
                              className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300"
                            >
                              Open tracking
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
