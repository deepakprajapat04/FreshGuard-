/**
 * Mini timeline calendar — store OOS windows, promotions, ETA markers.
 */
import { cn } from '../../lib/utils';
import { SAP } from '../../lib/sapTheme';
import type { PromotionRisk, StoreDemand } from '../../lib/trackingFlow';

type TimelineEvent = {
  id: string;
  label: string;
  start: string;
  end: string;
  tone: 'oos' | 'promo';
  sub?: string;
};

const TONE_STYLES: Record<TimelineEvent['tone'], string> = {
  oos: 'bg-rose-500/85',
  promo: 'bg-violet-500/85',
};

function parseDay(iso: string) {
  return new Date(iso + 'T12:00:00').getTime();
}

function dayLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

export function RiskTimelineCalendar({
  rangeStart,
  rangeEnd,
  stores,
  promotions,
  originalEta,
  revisedEta,
  className,
}: {
  rangeStart: string;
  rangeEnd: string;
  stores: StoreDemand[];
  promotions: PromotionRisk[];
  originalEta?: string;
  revisedEta?: string;
  className?: string;
}) {
  const startMs = parseDay(rangeStart);
  const endMs = parseDay(rangeEnd);
  const spanMs = endMs - startMs || 1;

  const days: string[] = [];
  for (let t = startMs; t <= endMs; t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }

  const rows: TimelineEvent[] = [
    ...stores
      .filter((s) => s.oosStartDate && s.oosEndDate)
      .map((s) => ({
        id: s.storeId,
        label: s.name,
        start: s.oosStartDate!,
        end: s.oosEndDate!,
        tone: 'oos' as const,
        sub: `${s.item} · OOS ${s.oosStartDate} → ${s.oosEndDate}`,
      })),
    ...promotions.map((p) => ({
      id: p.id,
      label: p.name,
      start: p.startDate,
      end: p.endDate,
      tone: 'promo' as const,
      sub: `${p.item} · ${p.stores.length} stores`,
    })),
  ];

  const pct = (iso: string) =>
    Math.min(100, Math.max(0, ((parseDay(iso) - startMs) / spanMs) * 100));

  const barStyle = (start: string, end: string) => ({
    left: `${pct(start)}%`,
    width: `${Math.max(2, pct(end) - pct(start))}%`,
  });

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden', className)}>
      <div
        className="grid border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60"
        style={{ gridTemplateColumns: '140px 1fr' }}
      >
        <div className="px-3 py-2 text-[11px] font-bold uppercase text-slate-400">Store / event</div>
        <div className="relative py-2 pr-2">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
            {days.map((d) => (
              <div key={d} className="text-[11px] text-center text-slate-500 font-medium">
                {dayLabel(d)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {(originalEta || revisedEta) && (
        <div className="grid border-b border-slate-100 dark:border-slate-800" style={{ gridTemplateColumns: '140px 1fr' }}>
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-500">ETA markers</div>
          <div className="relative h-8 mx-2">
            {originalEta && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
                style={{ left: `${pct(originalEta)}%` }}
                title={`Original ETA ${originalEta}`}
              >
                <span className="absolute -top-0 left-1 text-[8px] text-slate-500 whitespace-nowrap">Orig</span>
              </div>
            )}
            {revisedEta && (
              <div
                className="absolute top-0 bottom-0 w-0.5 z-10"
                style={{ left: `${pct(revisedEta)}%`, backgroundColor: SAP.blue }}
                title={`Revised ETA ${revisedEta}`}
              >
                <span
                  className="absolute -top-0 left-1 text-[8px] font-bold whitespace-nowrap"
                  style={{ color: SAP.blueDark }}
                >
                  Revised
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="p-4 text-sm text-slate-500 text-center">No OOS or promotion windows in range.</div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="grid border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
            style={{ gridTemplateColumns: '140px 1fr' }}
          >
            <div className="px-3 py-3 min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{row.label}</div>
              {row.sub && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{row.sub}</div>}
            </div>
            <div className="relative py-3 mx-2">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200 dark:bg-slate-700" />
              <div
                className={cn('absolute top-1/2 -translate-y-1/2 h-5 rounded-md shadow-sm', TONE_STYLES[row.tone])}
                style={barStyle(row.start, row.end)}
                title={`${row.start} → ${row.end}`}
              />
            </div>
          </div>
        ))
      )}

      <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-900/40 flex flex-wrap gap-3 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-rose-500/85" /> Store OOS window
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-violet-500/85" /> Promotion
        </span>
        <span className="flex items-center gap-1">
          <span className="w-0.5 h-3 bg-slate-400" /> Original ETA
        </span>
        <span className="flex items-center gap-1">
          <span className="w-0.5 h-3" style={{ backgroundColor: SAP.blue }} /> Revised ETA
        </span>
      </div>
    </div>
  );
}

export function StoreOosTable({ stores }: { stores: StoreDemand[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900 text-left">
            <th className="px-3 py-2 font-bold uppercase text-slate-400">Store</th>
            <th className="px-3 py-2 font-bold uppercase text-slate-400">Item</th>
            <th className="px-3 py-2 font-bold uppercase text-slate-400 text-right">On hand</th>
            <th className="px-3 py-2 font-bold uppercase text-slate-400 text-right">Daily demand</th>
            <th className="px-3 py-2 font-bold uppercase text-slate-400 text-right">Cover (days)</th>
            <th className="px-3 py-2 font-bold uppercase text-slate-400">OOS period</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {stores.map((s) => (
            <tr key={s.storeId} className={s.stockoutRiskDays != null ? 'bg-rose-50/40 dark:bg-rose-950/10' : ''}>
              <td className="px-3 py-2.5 font-semibold">{s.name}</td>
              <td className="px-3 py-2.5 text-slate-600">{s.item}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{s.onHand}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{s.dailyDemand}/d</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{s.daysCover.toFixed(1)}</td>
              <td className="px-3 py-2.5">
                {s.oosStartDate && s.oosEndDate ? (
                  <span className="font-semibold text-rose-700 dark:text-rose-400">
                    {s.oosStartDate} → {s.oosEndDate}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium">No OOS projected</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
