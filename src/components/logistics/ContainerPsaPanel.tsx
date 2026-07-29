import { format } from 'date-fns';
import { Loader2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSyncAge, type ContainerUpdatePayload } from '../../lib/psa';
import type { Shipment } from '../../lib/shipmentTypes';

interface Props {
  shipments: Shipment[];
  searchQuery: string;
  selectedShipment: Shipment | undefined;
  selectedShipmentId: string;
  isVendor: boolean;
  containerForm: ContainerUpdatePayload;
  savingContainer: boolean;
  onSelect: (id: string) => void;
  onFormChange: (next: ContainerUpdatePayload) => void;
  onSave: () => void;
}

export function ContainerPsaPanel({
  shipments,
  searchQuery,
  selectedShipment,
  selectedShipmentId,
  isVendor,
  containerForm,
  savingContainer,
  onSelect,
  onFormChange,
  onSave,
}: Props) {
  const list = shipments.filter(
    (s) =>
      !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.containerNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fields = [
    ['containerNumber', 'Container number'],
    ['vesselName', 'Vessel / fleet unit'],
    ['voyageNumber', 'Voyage number'],
    ['bookingNumber', 'Booking number'],
    ['psaTerminal', 'PSA terminal'],
    ['eta', 'ETA'],
    ['temp', 'Reefer temp'],
    ['origin', 'Origin / load point'],
  ] as const;

  return (
    <div className="w-full grid lg:grid-cols-12 gap-5">
      <div className="lg:col-span-4 space-y-3">
        <div className="rounded-xl bg-[#0c1e36] px-4 py-3 text-white">
          <h3 className="text-sm font-black font-mono uppercase tracking-wider text-sky-200">
            {isVendor ? 'Select lot to update' : 'PSA container ledger'}
          </h3>
        </div>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                'w-full text-left p-3.5 rounded-xl border transition-all shadow-sm',
                selectedShipmentId === s.id
                  ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50 dark:bg-sky-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-black">{s.id}</span>
                <span className="text-[9px] font-mono uppercase text-sky-700 dark:text-sky-400">
                  {s.psaSyncStatus}
                </span>
              </div>
              <div className="text-xs font-bold mt-1 text-slate-800 dark:text-slate-200">
                {s.containerNumber}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.product || s.item}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-8 space-y-4">
        {!selectedShipment ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center text-xs text-slate-400 font-mono">
            Select a container lot to view PSA details.
          </div>
        ) : (
          <>
            {isVendor ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-[#0c1e36] text-white flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black font-mono uppercase tracking-wider">
                      Supplier container update
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Changes publish to PSA Portnet® and appear on the retail tracking dashboard.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded shrink-0">
                    Last sync {formatSyncAge(selectedShipment.psaLastSyncAt)}
                  </span>
                </div>
                <div className="p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {fields.map(([key, label]) => (
                    <label key={key} className="block space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                        {label}
                      </span>
                      <input
                        value={containerForm[key]}
                        onChange={(e) => onFormChange({ ...containerForm, [key]: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </label>
                  ))}
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                      Update notes
                    </span>
                    <textarea
                      value={containerForm.notes}
                      onChange={(e) => onFormChange({ ...containerForm, notes: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                      placeholder="Optional note for PSA event ledger…"
                    />
                  </label>
                </div>
                <button
                  onClick={onSave}
                  disabled={savingContainer}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-wider font-mono"
                >
                  {savingContainer ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Push to PSA Portnet
                </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-[#0c1e36] text-white">
                  <h3 className="text-sm font-black font-mono uppercase tracking-wider">
                    Retail view · PSA mirrored data
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Read-only container details synced from supplier updates via PSA Portnet.
                  </p>
                </div>
                <dl className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs p-6">
                  {[
                    ['Container', selectedShipment.containerNumber],
                    ['Vessel', selectedShipment.vesselName],
                    ['Voyage', selectedShipment.voyageNumber],
                    ['Booking', selectedShipment.bookingNumber],
                    ['Terminal', selectedShipment.psaTerminal],
                    ['ETA', selectedShipment.eta],
                    ['Temp', selectedShipment.temp],
                    ['Origin', selectedShipment.origin],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/40"
                    >
                      <dt className="text-[9px] font-mono uppercase text-slate-400 font-bold">{k}</dt>
                      <dd className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {v || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
              <div className="px-6 py-4 bg-[#0f2744] flex items-center justify-between">
                <h3 className="text-sm font-black font-mono uppercase tracking-wider text-white">
                  PSA event timeline
                </h3>
                <span className="text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Completely synced
                </span>
              </div>
              <div className="p-6 relative space-y-0 pl-10 border-l-0">
              <div className="relative space-y-0 pl-4 border-l-2 border-sky-300 dark:border-sky-800">
                {[...(selectedShipment.psaEvents || [])].reverse().map((ev) => (
                  <div key={ev.id} className="relative pb-5 last:pb-0">
                    <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-white dark:border-slate-900" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                        {ev.label}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {ev.source}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{ev.location}</div>
                    {ev.details && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {ev.details}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-slate-400 mt-1">
                      {format(new Date(ev.timestamp), 'MMM d, yyyy · HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
