import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Check,
  CheckCircle2,
  Clock,
  Inbox as InboxIcon,
  Settings2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass } from '../components/PageChrome';
import {
  approveAutoProposal,
  loadAutoProposals,
  saveAutoProposals,
  type AutoProposal,
} from '../lib/businessRules';
import { useNotifications } from '../context/NotificationsContext';

export default function Inbox() {
  const navigate = useNavigate();
  const { upsertMany } = useNotifications();
  const [proposals, setProposals] = useState<AutoProposal[]>(() => loadAutoProposals());
  const [actionFlash, setActionFlash] = useState<string | null>(null);

  useEffect(() => {
    saveAutoProposals(proposals);
  }, [proposals]);

  const pending = useMemo(
    () => proposals.filter((p) => p.status === 'pending_buyer'),
    [proposals]
  );
  const issued = useMemo(
    () => proposals.filter((p) => p.status === 'po_issued'),
    [proposals]
  );
  const rejected = useMemo(
    () => proposals.filter((p) => p.status === 'rejected'),
    [proposals]
  );

  const onApprove = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = approveAutoProposal(p);
        setActionFlash(
          `Approved ${p.id}: request sent to ${next.secondBestSupplier} (ships in ${next.secondBestEtaDays}d). PO ${next.issuedPo} issued.`
        );
        upsertMany([
          {
            id: `n-apr-${next.id}`,
            title: `PO ${next.issuedPo} issued`,
            message: `Alt supplier ${next.secondBestSupplier} engaged for ${next.quantity} ${next.unit} of ${next.item}.`,
            severity: 'success',
            category: 'Regular',
            timestamp: new Date().toISOString(),
            read: false,
            module: 'Procurement',
            href: '/procurement',
          },
        ]);
        return next;
      })
    );
    setTimeout(() => setActionFlash(null), 6000);
  };

  const onReject = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'rejected' as const } : p))
    );
    setActionFlash(`Proposal ${id} rejected. No alternate PO issued.`);
    setTimeout(() => setActionFlash(null), 4000);
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="Buyer workspace"
        title="Inbox"
        subtitle="Approval queue for auto-generated fill-in proposals. Configure thresholds under Business Rules."
      >
        <button
          type="button"
          onClick={() => navigate('/business-rules')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Settings2 className="w-4 h-4" />
          Business Rules
        </button>
      </PageHeader>

      {actionFlash && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {actionFlash}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Awaiting approval" value={String(pending.length)} tone="amber" />
        <StatCard label="Alt POs issued" value={String(issued.length)} tone="emerald" />
        <StatCard label="Rejected" value={String(rejected.length)} tone="rose" />
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
        <div className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <InboxIcon className="w-4 h-4 text-[#4684AD] dark:text-[#C0D5E5] shrink-0" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Buyer approval queue</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Auto-generated proposals awaiting category buyer approval
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30">
            {pending.length} pending
          </span>
        </div>

        <div className="p-4 space-y-3">
          {pending.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Inbox clear. New delay fill-in proposals will appear here for approval.
            </div>
          ) : (
            pending.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-500">{p.id}</div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {p.item} · {p.category}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Buyer: <strong>{p.buyerOwner}</strong>
                      {' · '}
                      Trigger:{' '}
                      {p.trigger === 'cancelled'
                        ? `cancelled shipment ${p.shipmentId}`
                        : `${p.expectedDelayDays}d delay on ${p.shipmentId}`}{' '}
                      ({p.containerNumber})
                    </p>
                    <div className="mt-1.5">
                      <span
                        className={cn(
                          'inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border',
                          p.trigger === 'cancelled'
                            ? 'bg-slate-800 text-white border-slate-700'
                            : 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800'
                        )}
                      >
                        {p.trigger === 'cancelled' ? 'Cancelled shipment' : 'Delayed shipment'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{p.rationale}</p>
                {p.stockShortage && (
                  <div
                    className={cn(
                      'rounded-lg border p-2.5 text-xs space-y-1',
                      p.stockShortage.willShortage
                        ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    )}
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                      Stock not available impact
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                      <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900">
                        On hand {p.stockShortage.storeOnHandCases}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900">
                        {p.stockShortage.dailyDemandCases}/day
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900">
                        Cover {p.stockShortage.daysOfCover}d
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200">
                        Shortage {p.stockShortage.shortageCases} cases · stockout ~
                        {p.stockShortage.stockoutInDays}d
                      </span>
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <div className="text-[9px] uppercase font-bold text-slate-400">
                      Primary ({p.trigger === 'cancelled' ? 'cancelled' : 'delayed'})
                    </div>
                    <div className="font-semibold mt-0.5">{p.primarySupplier}</div>
                  </div>
                  <div className="rounded-lg border border-[#86A8C2]/50 dark:border-sky-800 bg-[#C0D5E5]/30 dark:bg-sky-950/30 p-2.5">
                    <div className="text-[9px] uppercase font-bold text-[#4684AD]">2nd-best short-lead</div>
                    <div className="font-semibold mt-0.5">{p.secondBestSupplier}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {p.secondBestBidId} · ships in {p.secondBestEtaDays}d · ${p.secondBestPricePerCase}/case
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Fill-in volume</div>
                    <div className="font-semibold mt-0.5">
                      {p.quantity.toLocaleString()} {p.unit}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onApprove(p.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve → send to 2nd-best &amp; issue PO
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(p.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/logistics')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[#2F5472] dark:text-[#C0D5E5] text-xs font-bold uppercase hover:underline"
                  >
                    Open live tracking
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {issued.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Recently issued alternate POs
            </h3>
            {issued.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-xs"
              >
                <span>
                  <strong className="font-mono">{p.issuedPo}</strong> → {p.secondBestSupplier} ·{' '}
                  {p.quantity} {p.unit} {p.item}
                </span>
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">PO issued</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
