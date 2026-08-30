/**
 * Fruits RFQ — buyer awards quote; PO is created only after supplier uploads shipping.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Award, CheckCircle2, Filter, Package, Repeat, Search, Thermometer } from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass, statGridClass } from '../components/PageChrome';
import { btnPrimaryClass, btnSecondaryClass } from '../lib/sapTheme';
import { usePersona } from '../context/PersonaContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  awardFruitsRfq,
  cadenceLabel,
  formatRepeatSummary,
  getQuoteRepeat,
  loadFruitsRfqs,
  resetFruitsRfqDemo,
  type FruitsRfq,
  type FruitsRfqQuote,
} from '../lib/fruitsRfqFlow';

function statusLabel(status: FruitsRfq['status']) {
  switch (status) {
    case 'open':
      return 'Open';
    case 'review':
      return 'In review';
    case 'awarded':
      return 'Awaiting shipping';
    case 'po_created':
      return 'PO created';
  }
}

function statusClass(status: FruitsRfq['status']) {
  switch (status) {
    case 'open':
    case 'review':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'awarded':
      return 'bg-blue-50 text-[#2F5472] border-[#4684AD]/30';
    case 'po_created':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
}

type RfqStatusFilter = 'all' | FruitsRfq['status'];

const RFQ_STATUS_FILTER_LABELS: Record<RfqStatusFilter, string> = {
  all: 'All',
  open: 'Open',
  review: 'In review',
  awarded: 'Awaiting shipping',
  po_created: 'PO created',
};

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function QuoteCard({
  quote,
  rfq,
  onAward,
  awarding,
}: {
  quote: FruitsRfqQuote;
  rfq: FruitsRfq;
  onAward: () => void;
  awarding: boolean;
}) {
  const isWinner =
    rfq.awardedQuoteId === quote.id ||
    (rfq.status !== 'review' && rfq.awardedVendor === quote.vendor);
  const repeat = getQuoteRepeat(quote, rfq);
  const matchesAsk = repeat.cadence === rfq.repeat.cadence;
  const perDrop = Math.round(quote.pricePerCase * repeat.qtyPerDelivery);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isWinner
          ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{quote.vendor}</div>
          <div className="text-xs text-slate-500 mt-0.5">{quote.fleetSpecification}</div>
        </div>
        {isWinner && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 bg-white">
            Awarded
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded border',
            matchesAsk
              ? 'border-[#4684AD]/30 bg-[#C0D5E5]/40 text-[#2F5472]'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          )}
        >
          <Repeat className="w-3 h-3" />
          {formatRepeatSummary(repeat)}
        </span>
        <span className="text-slate-500">
          {repeat.qtyPerDelivery.toLocaleString()} cases/drop · {repeat.deliveries} drops · {repeat.weeks}{' '}
          weeks
        </span>
        {!matchesAsk && (
          <span className="text-[10px] font-semibold uppercase text-amber-800">
            Differs from {cadenceLabel(rfq.repeat.cadence)} ask
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div>
          <div className="text-[10px] uppercase text-slate-400 font-semibold">Price / case</div>
          <div className="font-bold tabular-nums">${quote.pricePerCase.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400 font-semibold">Per drop</div>
          <div className="font-bold tabular-nums">${perDrop.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400 font-semibold">Program</div>
          <div className="font-bold tabular-nums">${quote.totalPrice.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400 font-semibold">First ETA</div>
          <div className="font-medium">{formatDate(quote.eta)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-400 font-semibold">Quality</div>
          <div className="font-medium">{quote.qualityIndex}</div>
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{quote.notes}</p>

      {rfq.status === 'review' && !isWinner && (
        <button
          type="button"
          disabled={awarding}
          onClick={onAward}
          className={cn(btnPrimaryClass, 'w-full sm:w-auto disabled:opacity-60')}
        >
          <Award className="w-4 h-4" />
          {awarding ? 'Awarding…' : 'Award quote'}
        </button>
      )}
    </div>
  );
}

export default function FruitsRfq() {
  const { persona } = usePersona();
  const { upsertMany } = useNotifications();
  const [rfqs, setRfqs] = useState<FruitsRfq[]>(() => loadFruitsRfqs());
  const [selectedId, setSelectedId] = useState<string>('RFQ-F-2026-001');
  const [awardingId, setAwardingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RfqStatusFilter>('all');

  useEffect(() => {
    setRfqs(loadFruitsRfqs());
  }, []);

  const filteredRfqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rfqs.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.id,
        r.item,
        r.fruitItem,
        r.destination,
        r.awardedVendor,
        cadenceLabel(r.repeat.cadence),
        r.repeat.deliveryDays,
        ...r.quotes.map((quote) => quote.vendor),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rfqs, search, statusFilter]);

  useEffect(() => {
    if (filteredRfqs.length === 0) return;
    if (!filteredRfqs.some((r) => r.id === selectedId)) {
      setSelectedId(filteredRfqs[0].id);
    }
  }, [filteredRfqs, selectedId]);

  const selected = filteredRfqs.find((r) => r.id === selectedId) ?? filteredRfqs[0];

  const stats = useMemo(() => {
    const inReview = rfqs.filter((r) => r.status === 'review').length;
    const awaiting = rfqs.filter((r) => r.status === 'awarded').length;
    const created = rfqs.filter((r) => r.status === 'po_created').length;
    return { inReview, awaiting, created };
  }, [rfqs]);

  const handleAward = (rfqId: string, quoteId: string) => {
    setAwardingId(quoteId);
    setTimeout(() => {
      const rfq = rfqs.find((r) => r.id === rfqId);
      const quote = rfq?.quotes.find((q) => q.id === quoteId);
      awardFruitsRfq(rfqId, quoteId);
      const next = loadFruitsRfqs();
      setRfqs(next);
      setAwardingId(null);
      setToast(
        'Quote awarded and sent to supplier. PO is created when they upload shipping details.'
      );
      setTimeout(() => setToast(null), 9000);

      if (rfq && quote) {
        upsertMany([
          {
            id: `n-supplier-award-${rfqId}`,
            title: 'Request for Quote awarded to you',
            message: `DC awarded ${rfq.item} (${rfqId}) at $${quote.pricePerCase.toFixed(2)}/case. Upload shipping in Shipping Detail to create the PO.`,
            severity: 'success',
            category: 'Regular',
            timestamp: new Date().toISOString(),
            read: false,
            module: 'Procurement',
            href: '/orders',
          },
        ]);
      }
    }, 1200);
  };

  const handleResetDemo = () => {
    resetFruitsRfqDemo();
    const next = loadFruitsRfqs();
    setRfqs(next);
    setSelectedId('RFQ-F-2026-001');
    setToast(
      'Demo reset — requests restored (Blueberries in review, six awards awaiting shipping).'
    );
    setTimeout(() => setToast(null), 7000);
  };

  if (persona === 'supplier') {
    return <Navigate to="/orders" replace />;
  }

  if (persona !== 'dc_purchasing_fruits') {
    return (
      <div className={pageShellClass}>
        <PageHeader
          title="Request for Quote"
          subtitle="Switch to DC Purchasing — Fruits to manage request for quote sourcing."
        />
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="Procurement"
        title="Request for Quote"
        subtitle="Award competitive quotes first. Purchase orders are created only after the supplier uploads shipping details."
      >
        <button
          type="button"
          onClick={handleResetDemo}
          className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
        >
          Reset demo
        </button>
        <Link to="/orders" className={btnSecondaryClass}>
          <Package className="w-4 h-4" />
          View POs
        </Link>
      </PageHeader>

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{toast}</span>
        </div>
      )}

      <div className={statGridClass}>
        <StatCard label="In review" value={String(stats.inReview)} />
        <StatCard label="Awaiting supplier shipping" value={String(stats.awaiting)} />
        <StatCard label="PO created" value={String(stats.created)} />
        <StatCard label="Flow" value="RFQ → ASN → PO" />
      </div>

      <div className="grid lg:grid-cols-[minmax(240px,300px)_1fr] gap-3 min-h-[480px]">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700">
            <h2 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Filter className="w-3.5 h-3.5" />
              Active RFQs
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {filteredRfqs.length} of {rfqs.length}
            </p>
          </div>

          <div className="shrink-0 p-3 space-y-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search RFQ, item, supplier…"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Status</div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(RFQ_STATUS_FILTER_LABELS) as RfqStatusFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                      statusFilter === f
                        ? 'bg-[#4684AD] text-white border-[#4684AD]'
                        : 'border-slate-200 text-slate-500 hover:border-[#4684AD]/40 dark:border-slate-700'
                    )}
                  >
                    {RFQ_STATUS_FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {rfqs.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No active RFQs.</p>
            ) : filteredRfqs.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No RFQs match your search or filters.</p>
            ) : (
              filteredRfqs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors',
                    selected?.id === r.id
                      ? 'bg-[#C0D5E5]/50 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  )}
                >
                  <div className="text-xs font-code font-semibold text-[#4684AD]">{r.id}</div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate">
                    {r.item}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
                        statusClass(r.status)
                      )}
                    >
                      {statusLabel(r.status)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {cadenceLabel(r.repeat.cadence)} · {r.repeat.qtyPerDelivery.toLocaleString()}{' '}
                      cs/drop
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {selected && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-code font-bold text-[#4684AD]">{selected.id}</span>
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
                    statusClass(selected.status)
                  )}
                >
                  {statusLabel(selected.status)}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.item}</h2>
              <p className="text-xs text-slate-500">
                Standing order · {formatRepeatSummary(selected.repeat)} ·{' '}
                {selected.repeat.qtyPerDelivery.toLocaleString()} cases/drop · {selected.quantity.toLocaleString()}{' '}
                cases/week · first delivery {formatDate(selected.deliveryDate)} · {selected.destination}
              </p>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                    <Repeat className="w-3 h-3" />
                    Cadence
                  </div>
                  <div className="text-sm font-medium mt-1">{formatRepeatSummary(selected.repeat)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                    <Thermometer className="w-3 h-3" />
                    Cold chain
                  </div>
                  <div className="text-sm font-medium mt-1">{selected.specifications.tempRange}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Shelf life</div>
                  <div className="text-sm font-medium mt-1">{selected.specifications.minShelfLife}</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Spec</div>
                  <div className="text-sm font-medium mt-1">{selected.specifications.sizeSpec}</div>
                </div>
              </div>

              {selected.status === 'awarded' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/20 px-4 py-3 text-sm text-[#2F5472]">
                  <strong>Standing order awarded.</strong> First-drop PO is created when{' '}
                  <strong>{selected.awardedVendor}</strong> uploads shipping for the next{' '}
                  {selected.repeat.deliveryDays} slot ({cadenceLabel(selected.repeat.cadence)},{' '}
                  {selected.repeat.deliveries} drops).
                </div>
              )}

              {selected.status === 'po_created' && selected.poNumber && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    PO created
                  </div>
                  <p>
                    Purchase order <strong className="font-code">{selected.poNumber}</strong> was
                    auto-created after supplier shipping upload. You can continue in{' '}
                    <Link to={`/orders?po=${selected.poNumber}`} className="text-[#4684AD] underline">
                      SAP Purchase Orders
                    </Link>{' '}
                    and Logistics Tracking.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Supplier quotes ({selected.quotes.length})
                </h3>
                {selected.quotes.map((q) => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    rfq={selected}
                    awarding={awardingId === q.id}
                    onAward={() => handleAward(selected.id, q.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
