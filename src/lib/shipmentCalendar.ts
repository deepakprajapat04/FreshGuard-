import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isBefore,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  addHours,
} from 'date-fns';
import type { Shipment } from './shipmentTypes';

export type TimelineScale = 'day' | 'week' | 'month';

export function parseShipmentDate(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : startOfDay(d);
  } catch {
    return null;
  }
}

/** End of transit / expected delivery day */
export function getExpectedDeliveryDate(s: Shipment): Date {
  const fromEtaDate = parseShipmentDate(s.etaDate);
  if (fromEtaDate) return fromEtaDate;

  const eta = (s.eta || '').toLowerCase();
  const now = new Date();
  const hrs = eta.match(/(\d+(?:\.\d+)?)\s*hrs?/);
  if (hrs) return startOfDay(addHours(now, parseFloat(hrs[1])));
  const days = eta.match(/(\d+(?:\.\d+)?)\s*days?/);
  if (days) return startOfDay(addDays(now, parseFloat(days[1])));
  if (eta.includes('tomorrow')) return startOfDay(addDays(now, 1));
  if (eta.includes('today') || eta === 'closed') return startOfDay(now);

  return parseShipmentDate(s.date) || startOfDay(now);
}

/** Start of transit (departure / booking date) */
export function getShipmentStartDate(s: Shipment): Date {
  const fromDate = parseShipmentDate(s.date);
  const end = getExpectedDeliveryDate(s);
  if (fromDate) {
    return isBefore(fromDate, end) || fromDate.getTime() === end.getTime()
      ? fromDate
      : startOfDay(
          addDays(
            end,
            -Math.max(
              1,
              s.transportMode === 'ocean' ? 14 : s.transportMode === 'air' ? 5 : 3
            )
          )
        );
  }
  // Infer span by mode when only ETA exists
  const back =
    s.transportMode === 'ocean'
      ? 18
      : s.transportMode === 'multimodal'
        ? 10
        : s.transportMode === 'air'
          ? 6
          : 4;
  return startOfDay(addDays(end, -back));
}

export type ShipmentSpan = { start: Date; end: Date };

export function getShipmentSpan(s: Shipment): ShipmentSpan {
  let start = getShipmentStartDate(s);
  let end = getExpectedDeliveryDate(s);
  if (isBefore(end, start)) {
    const t = start;
    start = end;
    end = t;
  }
  // Ensure at least 1 day visible bar
  if (differenceInCalendarDays(end, start) < 0) {
    end = start;
  }
  return { start: startOfDay(start), end: startOfDay(end) };
}

export type TimelineColumn = {
  key: string;
  label: string;
  subLabel?: string;
  start: Date;
  end: Date;
};

export function getTimelineWindow(
  scale: TimelineScale,
  anchor: Date
): { start: Date; end: Date; label: string; columns: TimelineColumn[] } {
  if (scale === 'day') {
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const columns = eachDayOfInterval({ start, end }).map((d) => ({
      key: format(d, 'yyyy-MM-dd'),
      label: format(d, 'd'),
      subLabel: format(d, 'EEE'),
      start: startOfDay(d),
      end: endOfDay(d),
    }));
    return { start, end, label: format(anchor, 'MMMM yyyy'), columns };
  }

  if (scale === 'week') {
    // 8 weeks centered around anchor month
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(addWeeks(start, 7), { weekStartsOn: 1 });
    const columns = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((d) => {
      const wEnd = endOfWeek(d, { weekStartsOn: 1 });
      return {
        key: format(d, 'yyyy-MM-dd'),
        label: `W${format(d, 'II')}`,
        subLabel: `${format(d, 'MMM d')}–${format(wEnd, 'd')}`,
        start: startOfDay(d),
        end: endOfDay(wEnd),
      };
    });
    return {
      start,
      end,
      label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
      columns,
    };
  }

  // month — full year
  const start = startOfYear(anchor);
  const end = endOfYear(anchor);
  const columns = eachMonthOfInterval({ start, end }).map((d) => ({
    key: format(d, 'yyyy-MM'),
    label: format(d, 'MMM'),
    subLabel: format(d, 'yyyy'),
    start: startOfMonth(d),
    end: endOfMonth(d),
  }));
  return { start, end, label: format(anchor, 'yyyy'), columns };
}

export function shiftTimelineAnchor(scale: TimelineScale, anchor: Date, dir: -1 | 1): Date {
  if (scale === 'day') return addMonths(anchor, dir);
  if (scale === 'week') return addWeeks(anchor, dir * 4);
  return addMonths(anchor, dir * 12);
}

/** Bar geometry as % of the visible timeline window */
export function barStyleInWindow(
  span: ShipmentSpan,
  windowStart: Date,
  windowEnd: Date
): { left: string; width: string; clipped: boolean } | null {
  const wStart = startOfDay(windowStart).getTime();
  const wEnd = endOfDay(windowEnd).getTime();
  const total = Math.max(1, wEnd - wStart);

  const s = Math.max(span.start.getTime(), wStart);
  const e = Math.min(endOfDay(span.end).getTime(), wEnd);
  if (e < s) return null;

  const left = ((s - wStart) / total) * 100;
  const width = Math.max(((e - s) / total) * 100, 1.2);
  const clipped = span.start.getTime() < wStart || endOfDay(span.end).getTime() > wEnd;
  return { left: `${left}%`, width: `${width}%`, clipped };
}

export function spansOverlapWindow(span: ShipmentSpan, windowStart: Date, windowEnd: Date): boolean {
  return !(endOfDay(span.end) < startOfDay(windowStart) || startOfDay(span.start) > endOfDay(windowEnd));
}

export function groupShipmentsBySupplier(shipments: Shipment[]): Array<{
  vendor: string;
  shipments: Shipment[];
  delayed: number;
  onTime: number;
  delivered: number;
}> {
  const map = new Map<string, Shipment[]>();
  shipments.forEach((s) => {
    const key = s.vendor || 'Unknown supplier';
    const list = map.get(key) || [];
    list.push(s);
    map.set(key, list);
  });
  return Array.from(map.entries())
    .map(([vendor, list]) => ({
      vendor,
      shipments: list.sort(
        (a, b) => getShipmentStartDate(a).getTime() - getShipmentStartDate(b).getTime()
      ),
      delayed: list.filter((s) => s.status === 'delayed').length,
      onTime: list.filter((s) => s.status === 'on-time').length,
      delivered: list.filter((s) => s.status === 'delivered').length,
    }))
    .sort((a, b) => a.vendor.localeCompare(b.vendor));
}

export { format, startOfMonth, addMonths, minDate, maxDate };
