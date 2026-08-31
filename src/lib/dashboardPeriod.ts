/**
 * Dashboard period helpers — year / quarter / month views over a full calendar year.
 */

export type PeriodGranularity = 'year' | 'quarter' | 'month';

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

export function buildYearMonthSeries(
  year: number,
  liveMonth: number,
  live: LiveDashboardBaseline
): MonthKpis[] {
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
      contracts: isLive ? live.contracts : scaleCount(live.contracts, weight, month, 1),
      pending: isLive ? live.pending : scaleCount(live.pending, weight, month, 2),
      delayed: isLive ? live.delayed : scaleCount(live.delayed, weight * 0.9, month, 3),
      early: isLive ? live.early : scaleCount(live.early, weight * 0.85, month, 4),
      atRisk: isLive ? live.atRisk : scaleCount(live.atRisk, weight, month, 5),
      riskActions: isLive ? live.riskActions : scaleCount(live.riskActions, weight, month, 6),
    };
  });
}

export function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.ceil(month / 3) as 1 | 2 | 3 | 4);
}

export function monthsInQuarter(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
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

export function selectPeriodRows(
  series: MonthKpis[],
  granularity: PeriodGranularity,
  quarter: 1 | 2 | 3 | 4,
  month: number
): MonthKpis[] {
  if (granularity === 'year') return series;
  if (granularity === 'quarter') {
    const months = monthsInQuarter(quarter);
    return series.filter((r) => months.includes(r.month));
  }
  return series.filter((r) => r.month === month);
}

export function periodLabel(
  year: number,
  granularity: PeriodGranularity,
  quarter: 1 | 2 | 3 | 4,
  month: number
): string {
  if (granularity === 'year') return `Full year ${year}`;
  if (granularity === 'quarter') return `Q${quarter} ${year}`;
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export { MONTH_LABELS };
