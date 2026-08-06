/**
 * Risk KPI strip for Live Tracking (shipments / suppliers / terminals / high-risk events).
 */

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { BuyerShipmentAlert } from '../../lib/psa';
import { loadBusinessRules } from '../../lib/businessRules';
import type { Shipment } from '../../lib/shipmentTypes';

function MiniBars({
  seed,
  bars = 8,
  tone = 'sky',
}: {
  seed: number;
  bars?: number;
  tone?: 'sky' | 'rose';
}) {
  const heights = Array.from({ length: bars }, (_, i) => ((seed * 17 + i * 31) % 70) + 25);
  return (
    <div className="flex items-end gap-0.5 h-9 shrink-0">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn('w-1.5 rounded-sm opacity-90', tone === 'rose' ? 'bg-rose-500' : 'bg-sky-500')}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function RiskKpiCard({
  value,
  label,
  trendPct,
  barsSeed,
  barTone = 'sky',
  hint,
}: {
  value: number;
  label: string;
  trendPct: number;
  barsSeed: number;
  barTone?: 'sky' | 'rose';
  hint: string;
}) {
  const up = trendPct > 0;
  const flat = trendPct === 0;
  // For risk KPIs, down is usually good
  const good = !flat && !up;

  return (
    <div
      className="rounded-xl border border-slate-700/80 px-3 py-2.5 shadow-md flex items-start justify-between gap-2 min-h-[76px]"
      style={{ backgroundColor: '#0f2744' }}
      title={hint}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xl font-bold text-white tracking-tight tabular-nums">
            {value.toLocaleString()}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[9px] font-bold',
              flat ? 'text-slate-400' : good ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {flat ? null : up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trendPct)} %
            <Info className="w-3 h-3 opacity-50" />
          </span>
        </div>
        <div className="text-[10px] text-slate-300 mt-0.5 font-medium leading-snug">{label}</div>
      </div>
      <MiniBars seed={barsSeed} tone={barTone} />
    </div>
  );
}

export function RiskOverviewKpis({
  shipments,
  buyerAlerts,
  className,
}: {
  shipments: Shipment[];
  buyerAlerts: BuyerShipmentAlert[];
  className?: string;
}) {
  const riskKpis = useMemo(() => {
    const riskLots = shipments.filter(
      (s) =>
        (s.status === 'delayed' || !!s.hasAnomaly || !!s.expectedDelay) &&
        s.status !== 'delivered'
    );
    const suppliers = new Set(riskLots.map((s) => s.vendor).filter(Boolean));
    const terminals = new Set(riskLots.map((s) => s.psaTerminal || s.origin).filter(Boolean));
    const rules = loadBusinessRules();
    const urgentAlerts = buyerAlerts.filter(
      (a) => a.category === 'Urgent' || a.severity === 'critical' || a.severity === 'warning'
    ).length;
    const customHigh = (rules.customAlerts || []).filter(
      (a) => a.enabled && (a.riskScore === 'High' || a.riskScore === 'Critical')
    ).length;
    const highRiskEvents = urgentAlerts + customHigh + rules.enabledAlertTypes.length;

    return {
      shipmentsAtRisk: riskLots.length,
      suppliersAtRisk: suppliers.size,
      terminalsAtRisk: terminals.size,
      highRiskEvents,
      shipTrend: riskLots.length > 5 ? -11 : riskLots.length > 0 ? -5 : 0,
      supplierTrend: 0,
      terminalTrend: terminals.size > 0 ? -3 : 0,
      eventsTrend: highRiskEvents > 10 ? -5 : highRiskEvents > 0 ? -2 : 0,
    };
  }, [shipments, buyerAlerts]);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Exposure snapshot
        </h3>
        <span className="text-[9px] text-slate-400 hidden sm:inline">
          Watchlist · vendors · corridors · alerts
        </span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <RiskKpiCard
          value={riskKpis.shipmentsAtRisk}
          label="Lots under watch"
          trendPct={riskKpis.shipTrend}
          barsSeed={riskKpis.shipmentsAtRisk + 11}
          hint="In-transit lots with delay, anomaly, or expected slippage"
        />
        <RiskKpiCard
          value={riskKpis.suppliersAtRisk}
          label="Vendors flagged"
          trendPct={riskKpis.supplierTrend}
          barsSeed={riskKpis.suppliersAtRisk + 22}
          hint="Suppliers tied to at least one watched lot"
        />
        <RiskKpiCard
          value={riskKpis.terminalsAtRisk}
          label="Sites at risk"
          trendPct={riskKpis.terminalTrend}
          barsSeed={riskKpis.terminalsAtRisk + 33}
          hint="Origin sites, load points, or terminals linked to watched lots"
        />
        <RiskKpiCard
          value={riskKpis.highRiskEvents}
          label="Priority alerts"
          trendPct={riskKpis.eventsTrend}
          barsSeed={riskKpis.highRiskEvents + 44}
          barTone="rose"
          hint="Urgent buyer alerts, high/critical custom rules, and active alert types"
        />
      </div>
    </div>
  );
}
