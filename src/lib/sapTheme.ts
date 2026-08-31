/** SAP Fiori-inspired brand palette — medium blue chrome. */
export const SAP = {
  blue: '#4684AD',
  blueHover: '#3B7398',
  blueDark: '#2F5472',
  blueDarker: '#254659',
  blueLight: '#C0D5E5',
  blueMuted: '#AEC9DC',
  border: '#86A8C2',
  shell: '#C4D6E6',
  shellDark: '#A8C0D4',
  shellGradient: 'linear-gradient(180deg, #CDDAE8 0%, #AEC9DC 100%)',
  accent: '#4684AD',
  accentRing: '#4684AD',
  headerBg: '#B8CFE0',
  inputBg: '#9FB5C9',
  /** Main content canvas — lighter than sidebar/header chrome */
  contentBg: '#F5F8FB',
} as const;

/** Page canvas behind white cards — lighter than sidebar/header only */
export const contentCanvasClass =
  'bg-[#F5F8FB] dark:bg-slate-950';

/** White section card — matches Business Rules panels */
export const sectionCardClass =
  'rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden';

export const sectionHeaderClass =
  'px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800';

export const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4684AD]/40';

export const filterChipClass =
  'px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700 transition-colors';

export const filterChipActiveClass =
  'px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border bg-[#4684AD] text-white border-[#4684AD]';

export const selectedRowClass =
  'bg-[#C0D5E5]/50 dark:bg-blue-950/30 border-l-4 border-l-[#4684AD]';

/** Solid blue primary — matches Logistics tab active style (shadow + uppercase). */
export const btnPrimaryClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#4684AD] hover:bg-[#3B7398] text-white text-xs font-semibold uppercase tracking-wide shadow-md transition-all active:scale-[0.98]';

/** Primary button at page-header size (Business Rules style) */
export const btnPrimaryLgClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#4684AD] hover:bg-[#3B7398] text-white text-sm font-semibold shadow-sm transition-colors';

export const btnGhostClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#86A8C2] dark:border-slate-600 text-[#2F5472] dark:text-slate-200 text-sm font-semibold hover:bg-[#C0D5E5]/30 dark:hover:bg-slate-800 transition-colors';

export const btnSecondaryClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold uppercase tracking-wide shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';

export const btnVioletClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold uppercase tracking-wide shadow-md transition-all active:scale-[0.98]';

/** Active tab pill — same blue + shadow as Logistics Tracking Dashboard tab. */
export const btnTabActiveClass = 'bg-[#4684AD] text-white shadow-md';
