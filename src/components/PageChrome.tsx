import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { contentCanvasClass } from '../lib/sapTheme';

/** Shared full-bleed page shell — SAP Fiori canvas */
export const pageShellClass =
  `p-3 sm:p-4 w-full mx-auto space-y-3.5 ${contentCanvasClass} h-full min-h-0 overflow-y-auto text-slate-900 dark:text-slate-100`;

/** Standard compact grid for KPI / stat cards */
export const statGridClass =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'w-full rounded-2xl bg-white dark:bg-slate-900 px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm border border-slate-200/90 dark:border-slate-800',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase block">
            {eyebrow}
          </span>
        )}
        <h1 className="text-lg font-bold tracking-tight mt-0.5 text-slate-900 dark:text-white">{title}</h1>
        {subtitle && (
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-2xl leading-snug">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900',
        className
      )}
    >
      {title && (
        <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-xs font-bold tracking-tight text-slate-900 dark:text-white">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal normal-case tracking-normal">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </div>
  );
}

type StatTone = 'sap' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'sky';

const STAT_TONES: Record<StatTone, { value: string; bar: string; accent: string }> = {
  sap: { value: 'text-[#2F5472] dark:text-blue-300', bar: 'bg-[#4684AD]', accent: 'from-[#4684AD]/10' },
  sky: { value: 'text-[#2F5472] dark:text-blue-300', bar: 'bg-[#4684AD]', accent: 'from-[#4684AD]/10' },
  emerald: { value: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500', accent: 'from-emerald-500/10' },
  amber: { value: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500', accent: 'from-amber-500/10' },
  rose: { value: 'text-rose-600 dark:text-rose-300', bar: 'bg-rose-500', accent: 'from-rose-500/10' },
  cyan: { value: 'text-cyan-600 dark:text-cyan-300', bar: 'bg-cyan-500', accent: 'from-cyan-500/10' },
};

export function StatCard({
  label,
  value,
  sub,
  tone = 'sap',
  compact = false,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  compact?: boolean;
  className?: string;
}) {
  const t = STAT_TONES[tone] ?? STAT_TONES.sap;
  return (
    <div
      className={cn(
        'relative overflow-hidden border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm',
        compact ? 'rounded-xl px-3 py-2' : 'rounded-2xl px-3.5 py-3',
        className
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', t.accent)} />
      {compact ? (
        <div className="relative flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('h-1 w-4 rounded-full shrink-0', t.bar)} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate leading-tight">
                {label}
              </div>
              {sub && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                  {sub}
                </div>
              )}
            </div>
          </div>
          <div className={cn('text-lg font-bold tabular-nums tracking-tight shrink-0 leading-none', t.value)}>
            {value}
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </div>
            <span className={cn('h-1 w-6 rounded-full shrink-0', t.bar)} />
          </div>
          <div className={cn('text-xl font-bold mt-1 tracking-tight', t.value)}>{value}</div>
          {sub && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
        </div>
      )}
    </div>
  );
}
