/**
 * Shipment tracking → risk identification → actions (design flow hub).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, Panel, StatCard, pageShellClass } from '../components/PageChrome';
import { usePersona, canApproveActions } from '../context/PersonaContext';
import {
  DEMO_SHIPMENTS,
  EVENT_COLORS,
  EVENT_LABELS,
  STORE_DEMAND,
  PROMOTIONS,
  loadRiskActions,
  type RiskAction,
  type TrackShipment,
  type FreshGuardPersona,
  PERSONA_LABELS,
} from '../lib/trackingFlow';

const STAGE_LABELS: Record<TrackShipment['stage'], string> = {
  origin: 'Origin / supplier',
  ocean: 'Ocean transit',
  customs: 'Customs clearance',
  inland: 'Inland haulage',
  dc_arrival: 'DC arrival',
  delivered: 'Delivered',
};

function ShelfLifeJourney({ daysLost }: { daysLost: number }) {
  const total = 14;
  const remaining = Math.max(0, total - daysLost);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-600">
        <span>Day 0 (harvest)</span>
        <span>Planned arrival</span>
        <span>Revised arrival (+{daysLost}d)</span>
      </div>
      <div className="h-3 rounded-full bg-slate-200 overflow-hidden flex">
        <div className="bg-slate-400" style={{ width: `${((total - remaining) / total) * 100}%` }} />
        <div className="bg-amber-500 flex-1" title={`${remaining}d sellable remaining`} />
      </div>
      <p className="text-xs text-slate-600">
        Sellable window reduced by <strong>{daysLost} days</strong>. Post-QC: consider markdown if
        &gt;2 days lost.
      </p>
    </div>
  );
}

export default function TrackingHub() {
  const { persona } = usePersona();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [selectedId, setSelectedId] = useState(DEMO_SHIPMENTS[0].id);

  useEffect(() => {
    setActions(loadRiskActions());
  }, []);

  const selected = DEMO_SHIPMENTS.find((s) => s.id === selectedId) || DEMO_SHIPMENTS[0];
  const shipmentActions = actions.filter((a) => a.shipmentId === selected.id);

  const pendingForPersona = useMemo(() => {
    return actions.filter((a) => {
      if (a.status !== 'pending_approval') return false;
      if (persona === 'dc_purchasing') return a.approverPersona === 'dc_purchasing';
      return a.ownerPersona === persona || a.notifyPersonas.includes(persona);
    });
  }, [actions, persona]);

  const canApprove = canApproveActions(persona);

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="FreshGuard · Shipment intelligence"
        title="Track → Identify risk → Act"
        subtitle="Event status drives business risks and persona-owned actions with approval workflow."
      >
        <Link
          to="/logistics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-white dark:hover:bg-slate-800"
        >
          <Truck className="w-4 h-4" />
          Full logistics map
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Active lots" value={String(DEMO_SHIPMENTS.length)} tone="slate" />
        <StatCard
          label="Delayed"
          value={String(DEMO_SHIPMENTS.filter((s) => s.eventStatus === 'delayed').length)}
          tone="amber"
        />
        <StatCard
          label="Early arrival"
          value={String(DEMO_SHIPMENTS.filter((s) => s.eventStatus === 'early').length)}
          tone="cyan"
        />
        <StatCard label="Actions pending" value={String(pendingForPersona.length)} tone="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="1 · Event happened" className="lg:col-span-1">
          <div className="space-y-2">
            {DEMO_SHIPMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors',
                  selectedId === s.id
                    ? 'border-[#1e3a5f] bg-slate-50 dark:bg-slate-800/50'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-code text-xs font-bold">{s.containerNumber}</span>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
                      EVENT_COLORS[s.eventStatus]
                    )}
                  >
                    {EVENT_LABELS[s.eventStatus]}
                  </span>
                </div>
                <div className="text-sm font-semibold mt-1">{s.item}</div>
                <div className="text-xs text-slate-500 mt-1">
                  ETA {s.eta} · was {s.originalEta}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-code">{s.linkedPos.join(', ')}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="2 · Touchpoints (origin → customs → DC)" className="lg:col-span-1">
          <ol className="relative border-l-2 border-slate-300 dark:border-slate-600 ml-2 space-y-4 pl-5">
            {(['origin', 'ocean', 'customs', 'inland', 'dc_arrival'] as const).map((stage) => {
              const active = selected.stage === stage;
              const passed =
                ['origin', 'ocean', 'customs', 'inland', 'dc_arrival'].indexOf(selected.stage) >=
                ['origin', 'ocean', 'customs', 'inland', 'dc_arrival'].indexOf(stage);
              return (
                <li key={stage} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[1.35rem] w-3 h-3 rounded-full border-2 border-white dark:border-slate-900',
                      active ? 'bg-[#1e3a5f]' : passed ? 'bg-slate-400' : 'bg-slate-200'
                    )}
                  />
                  <div className={cn('text-sm font-semibold', active && 'text-[#1e3a5f]')}>
                    {STAGE_LABELS[stage]}
                  </div>
                  {stage === 'customs' && (
                    <div className="text-xs text-slate-500">Status: {selected.customsStatus}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div>
              <strong>Route:</strong> {selected.origin} → {selected.destination}
            </div>
            <div>
              <strong>Mode:</strong> {selected.transportMode}
            </div>
          </div>
        </Panel>

        <Panel title="3 · Business risks identified" className="lg:col-span-1">
          {selected.eventStatus === 'delayed' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <TrendingDown className="w-4 h-4" />
                  Stock risk
                </div>
                <p className="text-xs text-amber-900/80 mt-1">
                  Stores with orders tied to this batch may stock out before revised arrival.
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {STORE_DEMAND.filter((s) => s.stockoutRiskDays != null).map((s) => (
                    <li key={s.storeId}>
                      {s.name}: {s.onHand} on hand · {s.pendingOrders} pending · stockout ~{' '}
                      {s.stockoutRiskDays}d
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-sm">
                <div className="font-bold text-violet-950">Promotion risk</div>
                {PROMOTIONS.map((p) => (
                  <p key={p.id} className="text-xs mt-1">
                    {p.name} ({p.item}) starts {p.startDate} — depends on {p.dependsOnPo}
                  </p>
                ))}
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-bold">Shelf-life impact</div>
                <ShelfLifeJourney daysLost={2} />
              </div>
            </div>
          )}
          {selected.eventStatus === 'early' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm">
                <div className="font-bold flex items-center gap-1.5 text-blue-950">
                  <TrendingUp className="w-4 h-4" />
                  Possible overstock
                </div>
                <p className="text-xs mt-1">
                  Chilled bays at 92% — early lot may need overflow or accelerated store push.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-xs">
                AI guidance: 10% markdown on prior Blueberry batch if early lot lands before clearance
                window.
              </div>
            </div>
          )}
          {selected.eventStatus === 'on-time' && (
            <p className="text-sm text-slate-600">No elevated risks. Standard receiving & transport plan.</p>
          )}
        </Panel>
      </div>

      <Panel title="4 · Actions & approval workflow">
        <p className="text-xs text-slate-500 mb-4">
          Viewing as <strong>{PERSONA_LABELS[persona as FreshGuardPersona]}</strong>
          {canApprove ? ' — you can approve proposals and notify teams.' : ' — notifications after DC approval.'}
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {shipmentActions.map((a) => (
            <div
              key={a.id}
              className={cn(
                'rounded-xl border p-4 space-y-2',
                a.status === 'pending_approval'
                  ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                  : a.status === 'approved'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-slate-200'
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-white">
                  {a.category.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-500">
                  Owner: {PERSONA_LABELS[a.ownerPersona]}
                </span>
                {a.status === 'approved' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />
                )}
              </div>
              <h3 className="text-sm font-bold">{a.title}</h3>
              <p className="text-xs text-slate-600">{a.summary}</p>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{a.proposal}</p>
              {a.status === 'pending_approval' && canApprove && (
                <Link
                  to="/actions"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#1e3a5f] hover:underline"
                >
                  Review in Actions <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
        {shipmentActions.length === 0 && (
          <p className="text-sm text-slate-500">No risk actions for on-time shipments.</p>
        )}
      </Panel>
    </div>
  );
}
