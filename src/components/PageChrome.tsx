import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/** Shared full-bleed page shell — light Mall Media canvas */
export const pageShellClass =
  'p-3 sm:p-4 w-full mx-auto space-y-3.5 bg-[#F0F3F8] dark:bg-slate-950 min-h-full text-slate-900 dark:text-slate-100';

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
          <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 tracking-wide uppercase block">
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
        'rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900',
        className
      )}
    >
      {title && (
        <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
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
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

type StatTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'cyan';

const STAT_TONES: Record<StatTone, { value: string; bar: string; accent: string }> = {
  sky: { value: 'text-sky-600 dark:text-sky-300', bar: 'bg-sky-500', accent: 'from-sky-500/10' },
  emerald: { value: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500', accent: 'from-emerald-500/10' },
  amber: { value: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500', accent: 'from-amber-500/10' },
  rose: { value: 'text-rose-600 dark:text-rose-300', bar: 'bg-rose-500', accent: 'from-rose-500/10' },
  cyan: { value: 'text-cyan-600 dark:text-cyan-300', bar: 'bg-cyan-500', accent: 'from-cyan-500/10' },
};

export function StatCard({
  label,
  value,
  sub,
  tone = 'sky',
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 shadow-sm',
        className
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', t.accent)} />
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
    </div>
  );
}
