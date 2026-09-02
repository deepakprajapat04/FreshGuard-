/**
 * Dashboard period helpers — date-range KPIs (default: previous calendar month).
 */

export type MonthKpis = {
  key: string;
  label: string;
  month: number;
  year: number;
  contracts: number;
  pending: number;
  delayed: number;
  early: number;
  atRisk: number;
  riskActions: number;
};

export type LiveDashboardBaseline = {
  contracts: number;
  pending: number;
  delayed: number;
  early: number;
  atRisk: number;
  riskActions: number;
};

export type DateRange = { from: string; to: string };

/**
 * Typical DC monthly ops volume for period KPIs — keeps Last month / date-range
 * cards looking like real throughput instead of a tiny live snapshot.
 */
export const REALISTIC_MONTHLY_BASELINE: LiveDashboardBaseline = {
  contracts: 36,
  pending: 28,
  delayed: 11,
  early: 7,
  atRisk: 16,
  riskActions: 38,
};

/** Blend live counts up to a realistic monthly floor for dashboard period views. */
export function periodKpiBaseline(live: LiveDashboardBaseline): LiveDashboardBaseline {
  return {
    contracts: Math.max(live.contracts, REALISTIC_MONTHLY_BASELINE.contracts),
    pending: Math.max(live.pending, REALISTIC_MONTHLY_BASELINE.pending),
    delayed: Math.max(live.delayed, REALISTIC_MONTHLY_BASELINE.delayed),
    early: Math.max(live.early, REALISTIC_MONTHLY_BASELINE.early),
    atRisk: Math.max(live.atRisk, REALISTIC_MONTHLY_BASELINE.atRisk),
    riskActions: Math.max(live.riskActions, REALISTIC_MONTHLY_BASELINE.riskActions),
  };
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Seasonal shape vs the live (current) month — keeps Aug aligned to live demo data. */
const MONTH_WEIGHTS = [0.72, 0.68, 0.78, 0.85, 0.92, 1.05, 1.12, 1, 0.98, 0.88, 0.8, 0.74];

function scaleCount(base: number, weight: number, month: number, salt: number): number {
  if (base <= 0) return Math.max(0, Math.round(2 * weight + ((month * salt) % 3)));
  const wobble = ((month * 17 + salt * 13) % 5) - 2;
  return Math.max(0, Math.round(base * weight + wobble));
}

function parseIso(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatShort(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Previous calendar month relative to `todayIso` (YYYY-MM-DD). */
export function defaultLastMonthRange(todayIso: string): DateRange {
  const today = parseIso(todayIso);
  const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastPrev = new Date(firstThisMonth);
  lastPrev.setDate(0);
  const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
  return { from: toIso(firstPrev), to: toIso(lastPrev) };
}

export function normalizeDateRange(from: string, to: string): DateRange {
  if (!from || !to) return { from, to };
  if (from <= to) return { from, to };
  return { from: to, to: from };
}

export function dateRangeLabel(from: string, to: string): string {
  if (!from || !to) return 'Select a date range';
  const a = parseIso(from);
  const b = parseIso(to);
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  const right = b.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${left} – ${right}`;
}

export function buildYearMonthSeries(
  year: number,
  liveMonth: number,
  live: LiveDashboardBaseline
): MonthKpis[] {
  const base = periodKpiBaseline(live);
  const liveWeight = MONTH_WEIGHTS[liveMonth - 1] || 1;
  return MONTH_LABELS.map((label, i) => {
    const month = i + 1;
    const weight = (MONTH_WEIGHTS[i] || 1) / liveWeight;
    const isLive = month === liveMonth;
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      label,
      month,
      year,
      // Live month stays close to real-time ops; other months keep seasonal shape.
      contracts: isLive
        ? Math.round((base.contracts + live.contracts) / 2)
        : scaleCount(base.contracts, weight, month, 1),
      pending: isLive
        ? Math.round((base.pending + live.pending) / 2)
        : scaleCount(base.pending, weight, month, 2),
      delayed: isLive
        ? Math.max(live.delayed, scaleCount(base.delayed, 0.95, month, 3))
        : scaleCount(base.delayed, weight * 0.95, month, 3),
      early: isLive
        ? Math.max(live.early, scaleCount(base.early, 0.9, month, 4))
        : scaleCount(base.early, weight * 0.9, month, 4),
      atRisk: isLive
        ? Math.max(live.atRisk, scaleCount(base.atRisk, 0.95, month, 5))
        : scaleCount(base.atRisk, weight, month, 5),
      riskActions: isLive
        ? Math.max(live.riskActions, scaleCount(base.riskActions, 0.95, month, 6))
        : scaleCount(base.riskActions, weight, month, 6),
    };
  });
}

function monthRowForDay(
  iso: string,
  liveMonth: number,
  liveYear: number,
  live: LiveDashboardBaseline,
  cache: Map<number, MonthKpis[]>
): MonthKpis {
  const d = parseIso(iso);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  let series = cache.get(year);
  if (!series) {
    // Align "live" month only for the live year; other years use Aug-weight as baseline.
    const alignMonth = year === liveYear ? liveMonth : 8;
    series = buildYearMonthSeries(year, alignMonth, live);
    cache.set(year, series);
  }
  return series[month - 1];
}

/**
 * Weekly KPI buckets across [from, to] (inclusive), scaled from the month series.
 */
export function buildDateRangeSeries(
  from: string,
  to: string,
  liveToday: string,
  live: LiveDashboardBaseline
): MonthKpis[] {
  const range = normalizeDateRange(from, to);
  if (!range.from || !range.to) return [];

  const liveMonth = Number(liveToday.slice(5, 7)) || 8;
  const liveYear = Number(liveToday.slice(0, 4)) || 2026;
  const cache = new Map<number, MonthKpis[]>();
  const points: MonthKpis[] = [];

  let weekStart = range.from;
  let guard = 0;
  while (weekStart <= range.to && guard < 80) {
    guard += 1;
    const weekEnd = addDays(weekStart, 6) > range.to ? range.to : addDays(weekStart, 6);
    let contracts = 0;
    let pending = 0;
    let delayed = 0;
    let early = 0;
    let atRisk = 0;
    let riskActions = 0;

    let day = weekStart;
    while (day <= weekEnd) {
      const row = monthRowForDay(day, liveMonth, liveYear, live, cache);
      const dim = daysInMonth(row.year, row.month) || 30;
      contracts += row.contracts / dim;
      pending += row.pending / dim;
      delayed += row.delayed / dim;
      early += row.early / dim;
      atRisk += row.atRisk / dim;
      riskActions += row.riskActions / dim;
      day = addDays(day, 1);
    }

    const startD = parseIso(weekStart);
    points.push({
      key: weekStart,
      label:
        weekStart === weekEnd
          ? formatShort(weekStart)
          : `${formatShort(weekStart)}–${formatShort(weekEnd)}`,
      month: startD.getMonth() + 1,
      year: startD.getFullYear(),
      contracts: Math.max(0, Math.round(contracts)),
      pending: Math.max(0, Math.round(pending)),
      delayed: Math.max(0, Math.round(delayed)),
      early: Math.max(0, Math.round(early)),
      atRisk: Math.max(0, Math.round(atRisk)),
      riskActions: Math.max(0, Math.round(riskActions)),
    });

    weekStart = addDays(weekEnd, 1);
  }

  return points;
}

export function sumMonthKpis(rows: MonthKpis[]): LiveDashboardBaseline {
  return rows.reduce(
    (acc, row) => ({
      contracts: acc.contracts + row.contracts,
      pending: acc.pending + row.pending,
      delayed: acc.delayed + row.delayed,
      early: acc.early + row.early,
      atRisk: acc.atRisk + row.atRisk,
      riskActions: acc.riskActions + row.riskActions,
    }),
    { contracts: 0, pending: 0, delayed: 0, early: 0, atRisk: 0, riskActions: 0 }
  );
}

export { MONTH_LABELS };
