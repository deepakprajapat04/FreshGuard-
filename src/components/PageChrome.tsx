import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/** Shared full-bleed page shell matching Logistics navy theme */
export const pageShellClass =
  'p-4 sm:p-5 lg:p-5 w-full mx-auto space-y-5 bg-[#dce6f0] dark:bg-slate-950 min-h-full text-slate-900 dark:text-slate-100';

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
        'w-full rounded-2xl bg-[#0c1e36] text-white px-5 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg border border-sky-900/50',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-[10px] font-semibold text-sky-300 tracking-wide uppercase block">
            {eyebrow}
          </span>
        )}
        <h1 className="text-2xl font-bold tracking-tight mt-0.5 text-white">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
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
        'rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900',
        className
      )}
    >
      {title && (
        <div className="px-5 py-3.5 bg-[#0c1e36] text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight">{title}</h3>
            {subtitle && <p className="text-[12px] text-slate-400 mt-0.5 font-normal normal-case tracking-normal">{subtitle}</p>}
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
  sky: { value: 'text-sky-300', bar: 'bg-sky-400', accent: 'from-sky-500/20' },
  emerald: { value: 'text-emerald-300', bar: 'bg-emerald-400', accent: 'from-emerald-500/20' },
  amber: { value: 'text-amber-300', bar: 'bg-amber-400', accent: 'from-amber-500/20' },
  rose: { value: 'text-rose-300', bar: 'bg-rose-400', accent: 'from-rose-500/20' },
  cyan: { value: 'text-cyan-300', bar: 'bg-cyan-400', accent: 'from-cyan-500/20' },
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
        'relative overflow-hidden rounded-2xl border border-slate-700/80 p-5 shadow-lg',
        className
      )}
      style={{ backgroundColor: '#0f2744' }}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', t.accent)} />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <span className={cn('h-1.5 w-8 rounded-full shrink-0', t.bar)} />
        </div>
        <div className={cn('text-3xl font-bold mt-2 tracking-tight', t.value)}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-1.5">{sub}</div>}
      </div>
    </div>
  );
}
