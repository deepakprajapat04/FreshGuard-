/**
 * Risk action queue — task list on the left, full proposal on the right.
 * Promo changes are two-step: DC Purchasing → Category Manager.
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Bell,
  Check,
  ClipboardList,
  Clock,
  Maximize2,
  Megaphone,
  Minimize2,
  Package,
  Search,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';
import { usePersona } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import { btnPrimaryClass, btnSecondaryClass, btnVioletClass } from '../lib/sapTheme';
import {
  approveRiskAction,
  rejectRiskAction,
  loadRiskActions,
  canPersonaApproveAction,
  getActionStatusLabel,
  type RiskAction,
  type RiskCategory,
  PERSONA_LABELS,
} from '../lib/trackingFlow';

type StatusFilter = 'all' | 'pending' | 'approved';
type CategoryFilter = 'all' | RiskCategory;

const TASK_CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stock' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'shelf_life', label: 'Shelf life' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'transport', label: 'Transport' },
];

const CATEGORY_META: Record<RiskCategory, { label: string; icon: typeof Package; tone: string }> = {
  stock: { label: 'Stock', icon: Package, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  promotion: { label: 'Promotion', icon: Megaphone, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  shelf_life: { label: 'Shelf life', icon: TrendingDown, tone: 'text-amber-800 bg-amber-50 border-amber-200' },
  receiving: { label: 'Receiving', icon: Users, tone: 'text-[#2F5472] bg-[#C0D5E5] border-[#86A8C2]' },
  transport: { label: 'Transport', icon: Truck, tone: 'text-[#2F5472] bg-[#C0D5E5] border-[#86A8C2]' },
  overstock: { label: 'Overstock', icon: TrendingUp, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
  distribution: { label: 'Distribution', icon: Truck, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatusChip({ status }: { status: RiskAction['status'] }) {
  return (
    <span
      className={cn(
        'text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0',
        status === 'pending_approval'
          ? 'bg-amber-100 text-amber-900 border-amber-200'
          : status === 'pending_category_approval'
            ? 'bg-violet-100 text-violet-900 border-violet-200'
            : status === 'approved'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      {getActionStatusLabel(status)}
    </span>
  );
}

function SectionTable({
  title,
  head,
  children,
}: {
  title: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wide">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 text-left border-b border-slate-200 dark:border-slate-700">
              {head.map((h) => (
                <th
                  key={h}
                  className={cn(
                    'px-3 py-2.5 font-semibold text-slate-500',
                    h === 'Cases' || h === 'Trucks' ? 'text-right' : ''
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function ActionDetailBody({ action }: { action: RiskAction }) {
  if (action.stockProposal) {
    return (
      <SectionTable title="Reallocation moves" head={['Type', 'From', '', 'To', 'Item', 'Cases']}>
        {action.stockProposal.moves.map((m, i) => (
          <tr key={`${m.fromLabel}-${m.toLabel}-${i}`}>
            <td className="px-3 py-2.5">
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                  m.type === 'dc_to_store'
                    ? 'bg-[#C0D5E5] text-[#2F5472]'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                )}
              >
                {m.type === 'dc_to_store' ? 'DC → store' : 'Store → store'}
              </span>
            </td>
            <td className="px-3 py-2.5 font-semibold">{m.fromLabel}</td>
            <td className="px-1 py-2.5 text-slate-300">
              <ArrowRight className="w-3.5 h-3.5" />
            </td>
            <td className="px-3 py-2.5 font-semibold">{m.toLabel}</td>
            <td className="px-3 py-2.5 text-slate-600">{m.item}</td>
            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">{m.cases}</td>
          </tr>
        ))}
      </SectionTable>
    );
  }

  if (action.promotionProposal) {
    const { reschedule, storeChanges } = action.promotionProposal;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
            Reschedule
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs mt-1.5">
            <span className="font-semibold">{reschedule.promoName}</span>
            <span className="tabular-nums text-slate-400 line-through">
              {formatShortDate(reschedule.originalStart)} → {formatShortDate(reschedule.originalEnd)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="tabular-nums font-bold text-[#2F5472]">
              {formatShortDate(reschedule.proposedStart)} → {formatShortDate(reschedule.proposedEnd)}
            </span>
          </div>
        </div>
        <SectionTable title="Store mix changes" head={['Action', 'Store', 'Promotion', 'Item']}>
          {storeChanges.map((c, i) => (
            <tr key={`${c.promoId}-${c.storeId}-${c.type}-${i}`}>
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded',
                    c.type === 'remove'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  )}
                >
                  {c.type}
                </span>
              </td>
              <td className="px-3 py-2.5 font-semibold">{c.storeName}</td>
              <td className="px-3 py-2.5 text-slate-600">{c.promoName}</td>
              <td className="px-3 py-2.5 text-slate-600">{c.item}</td>
            </tr>
          ))}
        </SectionTable>
      </div>
    );
  }

  if (action.shelfLifeProposal) {
    return (
      <SectionTable
        title="Items on this batch"
        head={['Item', 'Expires', 'Store shelf', 'OOS gap', 'Pricing']}
      >
        {action.shelfLifeProposal.lines.map((line) => (
          <tr key={line.po}>
            <td className="px-3 py-2.5 font-semibold">{line.item}</td>
            <td className="px-3 py-2.5 tabular-nums text-slate-600">
              {formatShortDate(line.currentOnHandExpiresDate)}
            </td>
            <td className="px-3 py-2.5 tabular-nums font-semibold text-[#2F5472]">
              {formatShortDate(line.storeShelfDate)}
            </td>
            <td className="px-3 py-2.5 tabular-nums">
              {line.oosGapDays > 0 ? (
                <span className="font-bold text-rose-700">{line.oosGapDays}d</span>
              ) : (
                <span className="text-emerald-700">—</span>
              )}
            </td>
            <td className="px-3 py-2.5">
              {line.markdownRecommended ? (
                <span className="font-medium text-amber-800">Markdown {line.markdownPercent}%</span>
              ) : (
                <span className="text-slate-500">Standard</span>
              )}
            </td>
          </tr>
        ))}
      </SectionTable>
    );
  }

  if (action.receivingImpact) {
    const r = action.receivingImpact;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Planned slot', value: formatShortDate(r.plannedSlot), sub: `door ${r.doorId}` },
            { label: 'Revised slot', value: formatShortDate(r.revisedSlot), sub: `${r.delayDays > 0 ? '+' : ''}${r.delayDays}d` },
            { label: 'Crew', value: `${r.crewFte} FTE`, sub: `~${r.unloadHours}h unload` },
            { label: 'Volume', value: `${r.pallets}`, sub: `pallets · ${r.cases.toLocaleString()} cases` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{s.label}</div>
              <div className="text-base font-bold tabular-nums mt-0.5">{s.value}</div>
              <div className="text-[10px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>
        <SectionTable title="Manpower steps" head={['When', 'Action', 'Why']}>
          {r.steps.map((step) => (
            <tr key={step.id}>
              <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-slate-600">
                {formatShortDate(step.when)}
              </td>
              <td className="px-3 py-2.5 font-semibold">{step.action}</td>
              <td className="px-3 py-2.5 text-slate-500">{step.detail}</td>
            </tr>
          ))}
        </SectionTable>
      </div>
    );
  }

  if (action.transportImpact) {
    const t = action.transportImpact;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Planned pickup', value: formatShortDate(t.plannedPickup), sub: 'original booking' },
            { label: 'Revised pickup', value: formatShortDate(t.revisedPickup), sub: `${t.delayDays > 0 ? '+' : ''}${t.delayDays}d` },
            { label: 'Trucks booked', value: `${t.trucksBooked}`, sub: `${t.cases.toLocaleString()} cases` },
            { label: 'Reassigned', value: `${t.trucksReassigned}`, sub: `${t.idleTruckDays} idle truck-days` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">{s.label}</div>
              <div className="text-base font-bold tabular-nums mt-0.5">{s.value}</div>
              <div className="text-[10px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>
        {t.reassignments.length > 0 && (
          <SectionTable title="Reassign to" head={['Container', 'Item', 'Date', 'Trucks']}>
            {t.reassignments.map((r) => (
              <tr key={r.shipmentId}>
                <td className="px-3 py-2.5 font-semibold">{r.containerNumber}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.item}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600">{formatShortDate(r.date)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2F5472]">{r.trucks}</td>
              </tr>
            ))}
          </SectionTable>
        )}
        <SectionTable title="Asset steps" head={['When', 'Action', 'Why']}>
          {t.steps.map((step) => (
            <tr key={step.id}>
              <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-slate-600">
                {formatShortDate(step.when)}
              </td>
              <td className="px-3 py-2.5 font-semibold">{step.action}</td>
              <td className="px-3 py-2.5 text-slate-500">{step.detail}</td>
            </tr>
          ))}
        </SectionTable>
      </div>
    );
  }

  return null;
}

export default function Actions() {
  const { persona } = usePersona();
  const { upsertMany } = useNotifications();
  const [actions, setActions] = useState<RiskAction[]>(() => loadRiskActions());
  const [flash, setFlash] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const forPersona = useMemo(() => {
    if (persona === 'dc_purchasing') {
      return actions.filter(
        (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
      );
    }
    if (persona === 'category_manager') {
      return actions.filter(
        (a) =>
          a.status === 'pending_category_approval' ||
          (a.category === 'promotion' &&
            a.notifyPersonas.includes('category_manager') &&
            a.status === 'approved')
      );
    }
    return actions.filter(
      (a) => a.ownerPersona === persona || a.notifyPersonas.includes(persona) || a.status === 'approved'
    );
  }, [actions, persona]);

  const pendingCount = forPersona.filter(
    (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
  ).length;
  const approvedCount = forPersona.filter((a) => a.status === 'approved').length;

  const visible = useMemo(() => {
    if (statusFilter === 'pending') {
      return forPersona.filter(
        (a) => a.status === 'pending_approval' || a.status === 'pending_category_approval'
      );
    }
    if (statusFilter === 'approved') return forPersona.filter((a) => a.status === 'approved');
    return forPersona;
  }, [forPersona, statusFilter]);

  const filteredVisible = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return visible.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [
        a.title,
        a.shipmentId,
        a.id,
        a.proposal,
        CATEGORY_META[a.category].label,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visible, taskSearch, categoryFilter]);

  useEffect(() => {
    if (filteredVisible.length === 0) {
      if (visible.length === 0) setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredVisible.some((a) => a.id === selectedId)) {
      setSelectedId(filteredVisible[0].id);
    }
  }, [filteredVisible, visible.length, selectedId]);

  const selected = filteredVisible.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) setDetailExpanded(false);
  }, [selected]);

  useEffect(() => {
    if (!detailExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailExpanded]);

  const onApprove = (id: string) => {
    const next = approveRiskAction(id, persona);
    if (!next) return;
    setActions(loadRiskActions());

    if (next.category === 'promotion' && next.status === 'pending_category_approval') {
      upsertMany([
        {
          id: `n-${next.id}-category-review`,
          title: `Promo change ready for approval: ${next.title}`,
          message: `${next.proposal} — Please review and approve reschedule & store mix updates.`,
          severity: 'info' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Sent to Category Manager for approval.');
    } else if (next.category === 'promotion' && next.status === 'approved') {
      upsertMany([
        {
          id: `n-${next.id}-confirmed`,
          title: `Promo changes confirmed: ${next.title}`,
          message: `${next.proposal} — Updates applied to promo calendar & store allocations.`,
          severity: 'success' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        },
      ]);
      setFlash('Promo changes approved — POS & marketing updates confirmed.');
    } else {
      upsertMany(
        next.notifyPersonas.map((p) => ({
          id: `n-${next.id}-${p}`,
          title: `Action approved: ${next.title}`,
          message: `${next.proposal} — ${PERSONA_LABELS[p]} please execute.`,
          severity: 'info' as const,
          category: 'Regular' as const,
          timestamp: new Date().toISOString(),
          read: false,
          module: 'System' as const,
          href: '/actions',
        }))
      );
      setFlash(`Approved. ${next.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')} notified.`);
    }
    setTimeout(() => setFlash(null), 5000);
  };

  const onReject = (id: string) => {
    rejectRiskAction(id, persona);
    setActions(loadRiskActions());
    setFlash('Proposal rejected.');
    setTimeout(() => setFlash(null), 3000);
  };

  const resetDemo = () => {
    localStorage.removeItem('freshguard-risk-actions-v7');
    setActions(loadRiskActions());
  };

  const canAct = selected ? canPersonaApproveAction(selected, persona) : false;

  return (
    <div className={pageShellClass}>
      {!detailExpanded && (
        <PageHeader title="Risk Actions">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all' as const, label: 'All', count: forPersona.length },
                { id: 'pending' as const, label: 'Pending', count: pendingCount },
                { id: 'approved' as const, label: 'Approved', count: approvedCount },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  statusFilter === f.id
                    ? 'bg-[#4684AD] text-white border-[#4684AD]'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#4684AD]/40'
                )}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-80">{f.count}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetDemo}
              className="ml-2 text-xs font-semibold text-slate-400 hover:text-slate-700 underline"
            >
              Reset demo
            </button>
          </div>
        </PageHeader>
      )}

      {flash && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {flash}
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-3 items-start',
          detailExpanded ? 'min-h-[calc(100vh-5rem)]' : 'lg:grid-cols-[minmax(260px,320px)_1fr]'
        )}
      >
        {/* Task list */}
        <section
          className={cn(
            'sticky top-0 self-start z-20 flex flex-col max-h-[calc(100vh-3.5rem)] overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md',
            detailExpanded && 'hidden'
          )}
        >
          <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              <ClipboardList className="w-3.5 h-3.5" />
              Tasks
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {filteredVisible.length} of {visible.length} in queue
            </p>
          </div>
          <div className="shrink-0 space-y-2 border-b border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search task, shipment ID…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {TASK_CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCategoryFilter(f.id)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                    categoryFilter === f.id
                      ? 'bg-[#4684AD] text-white border-[#4684AD]'
                      : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {visible.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No actions in your queue.</p>
            ) : filteredVisible.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No tasks match your search or filters.</p>
            ) : (
              filteredVisible.map((a) => {
                const meta = CATEGORY_META[a.category];
                const active = a.id === selectedId;
                const pending =
                  a.status === 'pending_approval' || a.status === 'pending_category_approval';
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      active
                        ? 'bg-[#C0D5E5]/70 dark:bg-blue-950/30 border-l-4 border-l-[#4684AD]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                          meta.tone
                        )}
                      >
                        <meta.icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {pending && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-sm font-semibold mt-1.5 text-slate-800 dark:text-slate-100">
                      {a.title}
                    </div>
                    <div className="text-[10px] font-code text-slate-400 mt-0.5">{a.shipmentId}</div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Detail */}
        <section
          className={cn(
            'min-h-[420px] rounded-xl border border-slate-200/90 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col overflow-hidden',
            detailExpanded && 'min-h-[calc(100vh-5rem)]'
          )}
        >
          {!selected ? (
            <div className="flex items-center justify-center h-[420px] text-sm text-slate-400">
              Select a task to see the proposal
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-3 rounded-t-xl border-b border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="min-w-0">
                  <span className="text-[10px] font-code text-slate-500">{selected.shipmentId}</span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selected.title}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {selected.summary}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusChip status={selected.status} />
                  <button
                    type="button"
                    onClick={() => setDetailExpanded((v) => !v)}
                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 text-slate-500 hover:text-[#2F5472] hover:border-[#4684AD]/50 transition-colors"
                    title={detailExpanded ? 'Exit full screen (Esc)' : 'Expand to full screen'}
                    aria-label={detailExpanded ? 'Exit full screen' : 'Expand to full screen'}
                  >
                    {detailExpanded ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">
                    Proposal
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {selected.proposal}
                  </p>
                </div>

                <ActionDetailBody action={selected} />

                {selected.detail && (
                  <p className="text-xs text-slate-500 leading-relaxed">{selected.detail}</p>
                )}

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Owner: <strong>{PERSONA_LABELS[selected.ownerPersona]}</strong>
                    {selected.category === 'promotion' ? (
                      <> · Step 2: {PERSONA_LABELS.category_manager}</>
                    ) : (
                      <>
                        {' '}
                        · Notify:{' '}
                        {selected.notifyPersonas.map((p) => PERSONA_LABELS[p]).join(', ')}
                      </>
                    )}
                  </p>

                  {canAct ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(selected.id)}
                        className={
                          persona === 'category_manager' ? btnVioletClass : btnPrimaryClass
                        }
                      >
                        <Check className="w-3.5 h-3.5" />
                        {persona === 'category_manager'
                          ? 'Approve promo changes'
                          : selected.category === 'promotion'
                            ? 'Approve & send to Category Manager'
                            : 'Approve & notify'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(selected.id)}
                        className={btnSecondaryClass}
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  ) : selected.status === 'approved' ? (
                    <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {selected.category === 'promotion'
                        ? 'Confirmed — update POS, signage & promo calendar.'
                        : 'Ready to execute — check notifications for details.'}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5" />
                      Awaiting {PERSONA_LABELS[selected.approverPersona]} approval.
                    </p>
                  )}

                  <Link
                    to="/"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#4684AD] hover:underline"
                  >
                    Open {selected.shipmentId} in Shipment Intelligence
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
