/**
 * Dashboard — period KPIs (year / quarter / month) plus live operations snapshot.
 */
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  Package,
  Timer,
  Truck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';
import { PageHeader, Panel, StatCard, pageShellClass } from '../components/PageChrome';
import { btnSecondaryClass } from '../lib/sapTheme';
import { usePersona, isSupplierPersona } from '../context/PersonaContext';
import {
  DEMO_SHIPMENTS,
  DEMO_TODAY,
  buildPoRiskImpact,
  getAllPurchaseOrders,
  getShipmentDelayDays,
  getShipmentEtaIso,
  getShipmentForPo,
  isVegetablesStatusOnlyIntel,
  loadRiskActions,
  poVisibleToPersona,
  shipmentVisibleToPersona,
  type SapPurchaseOrder,
  type TrackShipment,
} from '../lib/trackingFlow';
import {
  getAwardedQuote,
  isPendingContractStatus,
  loadFruitsRfqs,
  toContractNumber,
  type FruitsRfq,
} from '../lib/fruitsRfqFlow';
import {
  MONTH_LABELS,
  buildYearMonthSeries,
  periodLabel,
  quarterOfMonth,
  selectPeriodRows,
  sumMonthKpis,
  type PeriodGranularity,
} from '../lib/dashboardPeriod';

type DeliveryStatus = 'delayed' | 'early' | 'on-time' | 'pending';

type ContractDeliveryRow = {
  rfqId: string;
  contractNo: string;
  poNumber: string;
  eta: string;
  status: DeliveryStatus;
  days: number | null;
};

/** Demo PO / ETA fallbacks so every standing-order contract has a delivery row. */
const CONTRACT_DELIVERY_DEMO: Record<
  string,
  { po: string; eta: string; status: DeliveryStatus; days: number }
> = {
  'RFQ-F-2026-001': { po: 'PO-4500012345', eta: '2026-08-23', status: 'delayed', days: 2 },
  'RFQ-F-2026-002': { po: 'PO-4500012346', eta: '2026-08-19', status: 'early', days: 1 },
  'RFQ-F-2026-003': { po: 'PO-4500012410', eta: '2026-09-10', status: 'delayed', days: 3 },
  'RFQ-F-2026-004': { po: 'PO-4500012411', eta: '2026-09-12', status: 'on-time', days: 0 },
  'RFQ-F-2026-005': { po: 'PO-4500012395', eta: '2026-08-20', status: 'early', days: 2 },
  'RFQ-F-2026-006': { po: 'PO-4500012412', eta: '2026-09-09', status: 'delayed', days: 5 },
  'RFQ-F-2026-007': { po: 'PO-4500012388', eta: '2026-08-19', status: 'early', days: 1 },
  'RFQ-F-2026-008': { po: 'PO-4500012413', eta: '2026-09-07', status: 'on-time', days: 0 },
};

function formatEtaDate(iso: string): string {
  const raw = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return iso;
  return new Date(`${raw}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function etaDeltaDays(shipment: TrackShipment): number {
  const { original, revised } = getShipmentEtaIso(shipment);
  const a = new Date(`${original.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${revised.slice(0, 10)}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return shipment.eventStatus === 'delayed' ? getShipmentDelayDays(shipment) : shipment.eventStatus === 'early' ? -1 : 0;
  }
  return Math.round((b - a) / 86_400_000);
}

function findPoForContract(rfq: FruitsRfq, pos: SapPurchaseOrder[]): SapPurchaseOrder | undefined {
  if (rfq.poNumber) {
    const byId = pos.find((p) => p.po === rfq.poNumber);
    if (byId) return byId;
  }
  const demo = CONTRACT_DELIVERY_DEMO[rfq.id];
  if (demo) {
    const byDemo = pos.find((p) => p.po === demo.po);
    if (byDemo) return byDemo;
  }
  return pos.find(
    (p) => p.item === rfq.fruitItem || p.item.startsWith(rfq.fruitItem) || p.item.includes(rfq.fruitItem)
  );
}

function buildContractDeliveryRow(rfq: FruitsRfq, pos: SapPurchaseOrder[]): ContractDeliveryRow {
  const contractNo = toContractNumber(rfq.id);
  const demo = CONTRACT_DELIVERY_DEMO[rfq.id];
  const po = findPoForContract(rfq, pos);
  const shipment = po ? getShipmentForPo(po) : undefined;
  const quoteEta = getAwardedQuote(rfq)?.eta;

  if (shipment) {
    const etaIso = getShipmentEtaIso(shipment).revised.slice(0, 10);
    const delta = etaDeltaDays(shipment);
    const status: DeliveryStatus =
      shipment.eventStatus === 'delayed'
        ? 'delayed'
        : shipment.eventStatus === 'early'
          ? 'early'
          : 'on-time';
    return {
      rfqId: rfq.id,
      contractNo,
      poNumber: po?.po ?? rfq.poNumber ?? demo?.po ?? '—',
      eta: formatEtaDate(etaIso),
      status,
      days: status === 'on-time' ? 0 : Math.abs(delta) || (status === 'delayed' ? 1 : 1),
    };
  }

  if (demo) {
    return {
      rfqId: rfq.id,
      contractNo,
      poNumber: rfq.poNumber ?? demo.po,
      eta: formatEtaDate(demo.eta),
      status: demo.status,
      days: demo.status === 'on-time' ? 0 : demo.days,
    };
  }

  if (rfq.status === 'open' || rfq.status === 'review' || rfq.status === 'awarded') {
    return {
      rfqId: rfq.id,
      contractNo,
      poNumber: rfq.poNumber ?? '—',
      eta: formatEtaDate(quoteEta ?? rfq.deliveryDate),
      status: 'pending',
      days: null,
    };
  }

  return {
    rfqId: rfq.id,
    contractNo,
    poNumber: rfq.poNumber ?? '—',
    eta: formatEtaDate(rfq.deliveryDate),
    status: 'on-time',
    days: 0,
  };
}

function deliveryStatusLabel(status: DeliveryStatus, days: number | null): string {
  if (status === 'delayed') {
    const n = days ?? 1;
    return n === 1 ? '1 day late' : `${n} days late`;
  }
  if (status === 'early') {
    const n = days ?? 1;
    return n === 1 ? '1 day early' : `${n} days early`;
  }
  if (status === 'pending') return 'Awaiting shipping';
  return 'On time';
}

function deliveryStatusClass(status: DeliveryStatus) {
  if (status === 'delayed') return 'bg-rose-50 text-rose-800 border-rose-200';
  if (status === 'early') return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  if (status === 'pending') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200';
}

function eventTone(status: TrackShipment['eventStatus']) {
  if (status === 'delayed') return 'text-amber-700';
  if (status === 'early') return 'text-cyan-700';
  return 'text-slate-600';
}

const GRANULARITY_OPTIONS: { id: PeriodGranularity; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'month', label: 'Month' },
];

const pillClass = (active: boolean) =>
  cn(
    'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border transition-colors',
    active
      ? 'bg-[#4684AD] text-white border-[#4684AD]'
      : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
  );

const selectClass =
  'rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#4684AD]/40';

export default function HealthCheck() {
  const { persona } = usePersona();
  const statusOnly = isVegetablesStatusOnlyIntel(persona);
  const showContracts = persona === 'dc_purchasing_fruits' || persona === 'category_manager';
  const supplier = isSupplierPersona(persona);

  const liveMonth = Number(DEMO_TODAY.slice(5, 7)) || 8;
  const liveYear = Number(DEMO_TODAY.slice(0, 4)) || 2026;

  const [granularity, setGranularity] = useState<PeriodGranularity>('year');
  const [year, setYear] = useState(liveYear);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(() => quarterOfMonth(liveMonth));
  const [month, setMonth] = useState(liveMonth);

  const shipments = useMemo(
    () =>
      DEMO_SHIPMENTS.filter(
        (s) => s.stage !== 'delivered' && shipmentVisibleToPersona(s, persona)
      ),
    [persona]
  );

  const contracts = useMemo(() => (showContracts ? loadFruitsRfqs() : []), [showContracts]);

  const pendingActions = useMemo(() => {
    if (statusOnly) return [];
    return loadRiskActions().filter(
      (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
    );
  }, [statusOnly]);

  const pos = useMemo(
    () => getAllPurchaseOrders().filter((po) => poVisibleToPersona(po, persona)),
    [persona]
  );

  const delayed = useMemo(
    () => shipments.filter((s) => s.eventStatus === 'delayed'),
    [shipments]
  );
  const early = useMemo(
    () => shipments.filter((s) => s.eventStatus === 'early'),
    [shipments]
  );
  const pendingContracts = useMemo(
    () => contracts.filter((c) => isPendingContractStatus(c.status)),
    [contracts]
  );

  const contractRows = useMemo(
    () => contracts.map((c) => buildContractDeliveryRow(c, pos)),
    [contracts, pos]
  );

  const atRiskContainers = useMemo(() => {
    const byId = new Map<string, { shipment: TrackShipment; severity: 'high' | 'watch' }>();
    for (const po of pos) {
      const impact = buildPoRiskImpact(po);
      if (!impact || impact.severity === 'none') continue;
      const ship = shipments.find((s) => s.id === impact.shipmentId);
      if (!ship) continue;
      const prev = byId.get(ship.id);
      if (!prev || (impact.severity === 'high' && prev.severity !== 'high')) {
        byId.set(ship.id, { shipment: ship, severity: impact.severity });
      }
    }
    for (const s of delayed) {
      if (!byId.has(s.id)) byId.set(s.id, { shipment: s, severity: 'watch' });
    }
    return [...byId.values()].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return getShipmentDelayDays(b.shipment) - getShipmentDelayDays(a.shipment);
    });
  }, [pos, shipments, delayed]);

  const liveBaseline = useMemo(
    () => ({
      contracts: showContracts ? contracts.length : pos.length,
      pending: showContracts ? pendingContracts.length : pendingActions.length || delayed.length,
      delayed: delayed.length,
      early: early.length,
      atRisk: atRiskContainers.length,
      riskActions: pendingActions.length,
    }),
    [
      showContracts,
      contracts.length,
      pos.length,
      pendingContracts.length,
      pendingActions.length,
      delayed.length,
      early.length,
      atRiskContainers.length,
    ]
  );

  const yearSeries = useMemo(
    () => buildYearMonthSeries(year, liveMonth, liveBaseline),
    [year, liveMonth, liveBaseline]
  );

  const periodRows = useMemo(
    () => selectPeriodRows(yearSeries, granularity, quarter, month),
    [yearSeries, granularity, quarter, month]
  );

  const periodTotals = useMemo(() => sumMonthKpis(periodRows), [periodRows]);
  const activePeriodLabel = periodLabel(year, granularity, quarter, month);

  const chartData = useMemo(
    () =>
      periodRows.map((row) => ({
        name: row.label,
        Contracts: row.contracts,
        Pending: row.pending,
        Delayed: row.delayed,
        Early: row.early,
        'At risk': row.atRisk,
      })),
    [periodRows]
  );

  if (supplier) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <div className={pageShellClass}>
      <PageHeader eyebrow="Operations" title="Dashboard">
        <Link to="/tracking" className={btnSecondaryClass}>
          <Truck className="w-4 h-4" />
          Shipment intelligence
        </Link>
        {showContracts && (
          <Link to="/fruits-rfq" className={btnSecondaryClass}>
            <FileText className="w-4 h-4" />
            Contracts
          </Link>
        )}
        <Link to="/orders" className={btnSecondaryClass}>
          <Package className="w-4 h-4" />
          Purchase orders
        </Link>
      </PageHeader>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">
          Period
        </div>
        <div className="flex flex-wrap gap-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setGranularity(opt.id)}
              className={pillClass(granularity === opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className={selectClass}
          aria-label="Year"
        >
          {[liveYear - 1, liveYear, liveYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {granularity === 'quarter' && (
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className={selectClass}
            aria-label="Quarter"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </select>
        )}
        {granularity === 'month' && (
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={selectClass}
            aria-label="Month"
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs font-semibold text-[#2F5472] dark:text-blue-300 ml-auto">
          {activePeriodLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard
          label={showContracts ? 'Contracts' : 'Active POs'}
          value={String(periodTotals.contracts)}
          tone="sap"
          className="!rounded-xl !py-2.5 !px-3"
        />
        <StatCard
          label="Pending"
          value={String(periodTotals.pending)}
          tone="amber"
          className="!rounded-xl !py-2.5 !px-3"
        />
        <StatCard
          label="Delayed"
          value={String(periodTotals.delayed)}
          tone="rose"
          className="!rounded-xl !py-2.5 !px-3"
        />
        <StatCard
          label="Early"
          value={String(periodTotals.early)}
          tone="cyan"
          className="!rounded-xl !py-2.5 !px-3"
        />
        <StatCard
          label="At risk"
          value={String(periodTotals.atRisk)}
          tone={periodTotals.atRisk > 0 ? 'rose' : 'emerald'}
          className="!rounded-xl !py-2.5 !px-3"
        />
        {!statusOnly ? (
          <StatCard
            label="Risk actions"
            value={String(periodTotals.riskActions)}
            tone={periodTotals.riskActions ? 'amber' : 'emerald'}
            className="!rounded-xl !py-2.5 !px-3"
          />
        ) : (
          <StatCard
            label="On-time"
            value={String(
              Math.max(0, periodTotals.contracts - periodTotals.delayed - periodTotals.early)
            )}
            tone="emerald"
            className="!rounded-xl !py-2.5 !px-3"
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {showContracts && (
          <Panel
            title="Contracts"
            titleClassName="text-base"
            subtitle="Live snapshot · PO, ETA & delivery status"
            action={
              <Link
                to="/fruits-rfq"
                className="text-xs font-semibold text-[#4684AD] hover:underline inline-flex items-center gap-1"
              >
                Open <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5">Contract no.</th>
                    <th className="px-2 py-1.5">PO number</th>
                    <th className="px-2 py-1.5">ETA</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contractRows.map((row) => (
                    <tr key={row.rfqId}>
                      <td className="px-2 py-2 font-code font-semibold text-[#4684AD] whitespace-nowrap">
                        <Link to="/fruits-rfq" className="hover:underline">
                          {row.contractNo}
                        </Link>
                      </td>
                      <td className="px-2 py-2 font-code text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {row.poNumber !== '—' ? (
                          <Link
                            to={`/orders?po=${row.poNumber}`}
                            className="text-[#4684AD] hover:underline"
                          >
                            {row.poNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {row.eta}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'text-[11px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap',
                            deliveryStatusClass(row.status)
                          )}
                        >
                          {row.status === 'delayed'
                            ? 'Delayed'
                            : row.status === 'early'
                              ? 'Early'
                              : row.status === 'pending'
                                ? 'Pending'
                                : 'On time'}
                        </span>
                        {(row.status === 'delayed' || row.status === 'early') && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {deliveryStatusLabel(row.status, row.days)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel
          title="Containers needing attention"
          titleClassName="text-base"
          subtitle="Live snapshot · delayed, early, or at risk"
          action={
            <Link
              to="/tracking"
              className="text-xs font-semibold text-[#4684AD] hover:underline inline-flex items-center gap-1"
            >
              Investigate <ArrowRight className="w-3 h-3" />
            </Link>
          }
          className={showContracts ? undefined : 'lg:col-span-2'}
        >
          {atRiskContainers.length === 0 ? (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Timer className="w-4 h-4 text-emerald-600" />
              No containers currently at risk in this lane.
            </p>
          ) : (
            <ul className="space-y-2">
              {atRiskContainers.slice(0, 8).map(({ shipment: s, severity }) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-code text-xs font-semibold text-slate-900 dark:text-white">
                        {s.containerNumber}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-bold uppercase',
                          eventTone(s.eventStatus)
                        )}
                      >
                        {s.eventStatus}
                      </span>
                      {severity === 'high' && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold uppercase text-rose-700">
                          <AlertTriangle className="w-3 h-3" />
                          High
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {s.item} · ETA {s.eta}
                      {s.eventStatus === 'delayed'
                        ? ` · ${getShipmentDelayDays(s)}d late`
                        : s.eventStatus === 'early'
                          ? ' · early'
                          : ''}
                    </p>
                  </div>
                  <Link
                    to="/tracking"
                    className="shrink-0 text-xs font-semibold text-[#4684AD] hover:underline"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {!statusOnly && pendingActions.length > 0 && (
        <Panel
          title="Open risk actions"
          subtitle={`Live snapshot · ${pendingActions.length} waiting`}
          action={
            <Link
              to="/actions"
              className="text-xs font-semibold text-[#4684AD] hover:underline inline-flex items-center gap-1"
            >
              Risk actions <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          <ul className="grid sm:grid-cols-2 gap-2">
            {pendingActions.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs"
              >
                <div className="font-semibold text-slate-900 dark:text-white truncate">{a.title}</div>
                <div className="text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {a.status.replace(/_/g, ' ')}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Trend"
        subtitle={
          granularity === 'year'
            ? `Monthly breakdown · ${year}`
            : granularity === 'quarter'
              ? `Months in Q${quarter} ${year}`
              : `${MONTH_LABELS[month - 1]} ${year}`
        }
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Contracts" fill="#4684AD" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Delayed" fill="#e11d48" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Early" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              <Bar dataKey="At risk" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
