/**
 * Receiving quality control — pick a PO, pick an item lot, run the check,
 * then pass the lot, receive it with a markdown, or reject it into a claim.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { 
  Activity, 
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2, 
  Camera,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  ImagePlus,
  Package,
  RotateCcw,
  ScanLine,
  Search,
  Thermometer,
  TrendingDown,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/PageChrome';
import { btnPrimaryClass, btnSecondaryClass, contentCanvasClass } from '../lib/sapTheme';
import {
  applyQcDecision,
  claimValue,
  clearQcRecords,
  getQcLines,
  getQcPurchaseOrders,
  loadQcRecords,
  removeQcRecord,
  runQualityCheck,
  QC_DECISION_LABELS,
  type QcCheckResult,
  type QcDecision,
  type QcLine,
  type QcRecord,
} from '../lib/qualityCheck';

const STEPS = [
  { id: 1, label: 'Purchase order' },
  { id: 2, label: 'Item lot' },
  { id: 3, label: 'Quality check' },
  { id: 4, label: 'Decision' },
] as const;

const DECISION_TONE: Record<QcDecision, { chip: string; dot: string; icon: typeof Check }> = {
  pass: {
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  markdown: {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    icon: TrendingDown,
  },
  reject: {
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    icon: XCircle,
  },
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                active
                  ? 'border-[#4684AD] bg-[#C0D5E5] text-[#254659]'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
              )}
            >
              <span
                className={cn(
                  'grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold',
                  active
                    ? 'bg-[#4684AD] text-white'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : step.id}
              </span>
              {step.label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function DecisionChip({ decision }: { decision: QcDecision }) {
  const tone = DECISION_TONE[decision];
  const Icon = tone.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase',
        tone.chip
      )}
    >
      <Icon className="h-3 w-3" />
      {decision === 'reject' ? 'Rejected' : decision}
    </span>
  );
}

type QcPhoto = { id: string; name: string; previewUrl: string };

function PhotoEvidence({
  photos,
  onUpload,
  onRemove,
  compact,
}: {
  photos: QcPhoto[];
  onUpload: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn('w-full', compact ? 'max-w-lg' : 'max-w-md')}>
      <label className="block cursor-pointer rounded-lg border border-dashed border-[#86A8C2] bg-white px-4 py-3 text-left transition-colors hover:bg-[#C0D5E5]/20 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800/60">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#2F5472] dark:text-slate-200">
          <Camera className="h-4 w-4 shrink-0" />
          Upload inspection photos
        </span>
        <span className="mt-1 block text-[11px] text-slate-500">
          PNG or JPG — carton labels, defects, cold-chain logger
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            onUpload(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              <img src={photo.previewUrl} alt={photo.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[9px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          {photos.length} photo{photos.length === 1 ? '' : 's'} attached to this inspection
        </p>
      )}
    </div>
  );
}

export default function QualityControl() {
  const pos = useMemo(() => getQcPurchaseOrders(), []);
  const [selectedPo, setSelectedPo] = useState<string | null>(pos[0]?.po ?? null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'result'>('idle');
  const [result, setResult] = useState<QcCheckResult | null>(null);
  const [records, setRecords] = useState<QcRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [photos, setPhotos] = useState<QcPhoto[]>([]);
  const [poSearch, setPoSearch] = useState('');
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const revokePhotos = (items: QcPhoto[]) => {
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  };

  useEffect(() => {
    setRecords(loadQcRecords());
  }, []);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  useEffect(() => {
    setPhotos((prev) => {
      revokePhotos(prev);
      return [];
    });
  }, [selectedLineId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const po = useMemo(() => pos.find((p) => p.po === selectedPo) ?? null, [pos, selectedPo]);

  const filteredPos = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return pos;
    return pos.filter((p) => {
      const haystack = [p.po, p.supplier, p.item].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [pos, poSearch]);

  useEffect(() => {
    if (filteredPos.length === 0) return;
    if (!selectedPo || !filteredPos.some((p) => p.po === selectedPo)) {
      setSelectedPo(filteredPos[0].po);
      setSelectedLineId(null);
      setResult(null);
      setPhase('idle');
      setPhotos((prev) => {
        revokePhotos(prev);
        return [];
      });
    }
  }, [filteredPos, selectedPo]);

  const lines = useMemo(() => (po ? getQcLines(po) : []), [po]);
  const line = lines.find((l) => l.id === selectedLineId) ?? null;
  const recordFor = (lineId: string) => records.find((r) => r.lineId === lineId) ?? null;
  const decidedRecord = line ? recordFor(line.id) : null;

  const currentStep = !selectedPo ? 1 : !line ? 2 : decidedRecord ? 4 : phase === 'result' ? 4 : 3;

  const checkedCount = (poNumber: string) =>
    records.filter((r) => r.po === poNumber).length;

  const selectPo = (poNumber: string) => {
    setSelectedPo(poNumber);
    setSelectedLineId(null);
    setResult(null);
    setPhase('idle');
    setPhotos((prev) => {
      revokePhotos(prev);
      return [];
    });
  };

  const selectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setResult(null);
    setPhase('idle');
  };

  const clearLine = () => {
    setSelectedLineId(null);
    setResult(null);
    setPhase('idle');
    setPhotos((prev) => {
      revokePhotos(prev);
      return [];
    });
  };

  const onPhotoUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({
        id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        previewUrl: URL.createObjectURL(f),
      }));
    if (!next.length) {
      setToast('Please choose a PNG or JPG image.');
      return;
    }
    setPhotos((prev) => [...prev, ...next]);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const startCheck = async () => {
    if (!line) return;
    setPhase('scanning');
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setResult(runQualityCheck(line));
    setPhase('result');
  };

  const decide = (decision: QcDecision) => {
    if (!line || !result) return;
    const record = applyQcDecision(
      line,
      result,
      decision,
      photos.map((p) => p.name)
    );
    setRecords((prev) => [record, ...prev.filter((r) => r.lineId !== line.id)]);
    setPhotos((prev) => {
      revokePhotos(prev);
      return [];
    });
    setToast(
      decision === 'reject'
        ? `Lot ${line.lotNumber} rejected — claim raised against ${line.supplier}.`
        : decision === 'markdown'
          ? `Lot ${line.lotNumber} received at ${result.markdownPercent}% markdown and routed to stores.`
          : `Lot ${line.lotNumber} passed and routed to stores at full price.`
    );
  };

  const nextPendingLine = lines.find((l) => !recordFor(l.id) && l.id !== selectedLineId);

  const resetDemo = () => {
    clearQcRecords();
    setRecords([]);
    setSelectedLineId(null);
    setResult(null);
    setPhase('idle');
    setPhotos((prev) => {
      revokePhotos(prev);
      return [];
    });
    setToast('Quality check history cleared.');
  };

  return (
    <div
      className={cn(
        contentCanvasClass,
        'p-3 sm:p-4 w-full h-full min-h-0 flex flex-col gap-3 overflow-hidden text-slate-900 dark:text-slate-100'
      )}
    >
      {toast && (
        <div className="fixed left-1/2 top-16 z-50 w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {toast}
        </div>
      )}

      <PageHeader title="Quality Control" className="shrink-0">
        <button
          type="button"
          onClick={resetDemo}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset checks
        </button>
      </PageHeader>

      <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <StepBar current={currentStep} />
      </div>

      <div className="flex-1 min-h-0 grid gap-3 grid-rows-1 lg:grid-cols-[minmax(280px,340px)_1fr]">
        {/* Step 1 — purchase orders (pinned shell, list scrolls inside) */}
        <section className="min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Purchase orders</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {filteredPos.length} of {pos.length} arrived with an ASN · select one to inspect
            </p>
          </div>
          <div className="shrink-0 border-b border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder="Search PO number, supplier, item…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-[#4684AD]/40 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {filteredPos.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">No purchase orders match your search.</p>
            ) : (
              filteredPos.map((p) => {
              const poLines = getQcLines(p);
              const checked = checkedCount(p.po);
              const active = p.po === selectedPo;
              return (
                <button
                  key={p.po}
                  type="button"
                  onClick={() => selectPo(p.po)}
                  className={cn(
                    'mb-2 w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-[#4684AD] bg-[#C0D5E5] dark:bg-slate-800'
                      : 'border-slate-200 bg-white hover:border-[#86A8C2] dark:border-slate-700 dark:bg-slate-900'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{p.po}</span>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-bold',
                        checked === poLines.length
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      )}
                    >
                      {checked}/{poLines.length} checked
                    </span>
                    </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-400">
                    {p.supplier}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <Boxes className="h-3 w-3" />
                    {poLines.length} item lots · {p.orderedQty.toLocaleString()} {p.unit}
                  </div>
                      </button>
              );
            })
            )}
                    </div>
        </section>

        {/* Steps 2–4 (pinned chrome, body scrolls) */}
        <section className="min-h-0 h-full flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
          {!po ? (
            <div className="flex-1 grid place-items-center text-center text-xs text-slate-500 p-8">
              Select a purchase order to begin the receiving check.
            </div>
          ) : (
            <>
              <div className="shrink-0 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                    <span>{po.po}</span>
                    {line && (
                      <>
                        <ChevronRight className="h-3 w-3" />
                        <span>{line.lotNumber}</span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {line ? line.item : `${lines.length} item lots to inspect`}
                  </h2>
                </div>
                {line && (
                  <button
                    type="button"
                    onClick={clearLine}
                    className="flex items-center gap-1.5 rounded-lg border border-[#86A8C2] bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-[#2F5472] hover:bg-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> All items
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4">
                {!line ? (
                  /* Step 2 — item lots in this PO */
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Field label="Supplier" value={po.supplier} />
                      <Field label="Material" value={po.itemDetail.materialNumber} />
                      <Field label="Storage temp" value={po.itemDetail.storageTemp} />
                      <Field label="Delivery date" value={formatShortDate(po.deliveryDate)} />
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-950">
                            <th className="px-3 py-2.5 font-semibold text-slate-500">Item</th>
                            <th className="px-3 py-2.5 font-semibold text-slate-500">Lot</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Cases</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Pallets</th>
                            <th className="px-3 py-2.5 font-semibold text-slate-500">Best before</th>
                            <th className="px-3 py-2.5 font-semibold text-slate-500">Status</th>
                            <th className="px-3 py-2.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {lines.map((l) => {
                            const record = recordFor(l.id);
                            return (
                              <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                  {l.item}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                                  {l.lotNumber}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">
                                  {l.quantity.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{l.palletCount}</td>
                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                                  {formatShortDate(l.bestBefore)}
                                </td>
                                <td className="px-3 py-2.5">
                                  {record ? (
                                    <DecisionChip decision={record.decision} />
                                  ) : (
                                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                                      Awaiting check
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => selectLine(l.id)}
                                    className={btnPrimaryClass}
                                  >
                                    {record ? 'Review' : 'Inspect'}
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  /* Steps 3–4 — inspection and decision */
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Field label="Cases" value={line.quantity.toLocaleString()} />
                      <Field label="Pallets" value={String(line.palletCount)} />
                      <Field label="Harvested" value={formatShortDate(line.harvestDate)} />
                      <Field label="Best before" value={formatShortDate(line.bestBefore)} />
                           </div>

                    {decidedRecord ? (
                      <DecisionSummary
                        record={decidedRecord}
                        line={line}
                        onNext={() => nextPendingLine && selectLine(nextPendingLine.id)}
                        hasNext={Boolean(nextPendingLine)}
                        onRecheck={() => {
                          setResult(null);
                          setPhase('idle');
                          setPhotos((prev) => {
                            revokePhotos(prev);
                            return [];
                          });
                          setRecords(removeQcRecord(line.id));
                        }}
                      />
                    ) : phase === 'result' && result ? (
                      <CheckResult
                        result={result}
                        line={line}
                        photos={photos}
                        onUpload={onPhotoUpload}
                        onRemovePhoto={removePhoto}
                        onDecide={decide}
                      />
                    ) : (
                      <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950">
                        {phase === 'scanning' ? (
                          <>
                            <Activity className="mb-3 h-8 w-8 animate-pulse text-[#4684AD]" />
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              Inspecting lot {line.lotNumber}…
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Reading cold-chain logger, sampling pallets and grading surface quality.
                            </p>
                            {photos.length > 0 && (
                              <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {photos.map((photo) => (
                                  <img
                                    key={photo.id}
                                    src={photo.previewUrl}
                                    alt={photo.name}
                                    className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                                  />
                                ))}
                        </div>
                            )}
                          </>
                        ) : (
                          <>
                            <ScanLine className="mb-3 h-8 w-8 text-slate-400" />
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              Ready to inspect {line.item}
                            </p>
                            <p className="mt-1 max-w-md text-xs text-slate-500">
                              The check grades surface quality, reviews the cold-chain log for this lot and
                              compares remaining shelf life against the receiving standard.
                            </p>
                            <div className="mt-4 flex w-full flex-col items-center gap-3">
                              <PhotoEvidence
                                photos={photos}
                                onUpload={onPhotoUpload}
                                onRemove={removePhoto}
                              />
                        <button 
                                type="button"
                                onClick={startCheck}
                                className={btnPrimaryClass}
                        >
                                <ClipboardCheck className="h-4 w-4" /> Run quality check
                        </button>
                      </div>
                          </>
                        )}
                    </div>
                )}
                  </>
                )}
            </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CheckResult({
  result,
  line,
  photos,
  onUpload,
  onRemovePhoto,
  onDecide,
}: {
  result: QcCheckResult;
  line: QcLine;
  photos: QcPhoto[];
  onUpload: (files: FileList | null) => void;
  onRemovePhoto: (id: string) => void;
  onDecide: (decision: QcDecision) => void;
}) {
  const failed = result.recommendation === 'reject';
  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <ImagePlus className="h-3.5 w-3.5" /> Inspection photos
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.previewUrl}
                alt={photo.name}
                className="h-14 w-14 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
              />
            ))}
          </div>
        </div>
      )}
      <PhotoEvidence photos={photos} onUpload={onUpload} onRemove={onRemovePhoto} compact />
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Quality score
            </div>
            <div
                className={cn(
                'text-2xl font-bold tabular-nums',
                result.score >= 85
                  ? 'text-emerald-600'
                  : result.score >= 60
                    ? 'text-amber-600'
                    : 'text-rose-600'
              )}
            >
              {result.score}/100
                  </div>
                </div>
          <div className="text-right text-[11px] text-slate-500">
            Receiving standard: 85 pass · 60–84 markdown · below 60 reject
                    </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div 
                        className={cn(
              'h-full rounded-full',
              result.score >= 85 ? 'bg-emerald-500' : result.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        )} 
            style={{ width: `${result.score}%` }}
          />
                    </div>
                  </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Thermometer className="h-3.5 w-3.5" /> Cold chain
                      </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Peak {result.tempMaxC.toFixed(1)}°C
                      </div>
          <div className="text-[11px] text-slate-500">
            {result.excursionHours > 0
              ? `${result.excursionHours}h above ${line.storageTemp}`
              : `Held within ${line.storageTemp}`}
                    </div>
                      </div>
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Package className="h-3.5 w-3.5" /> Shelf life left
                      </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {result.shelfLifeLeftDays} days
                    </div>
          <div className="text-[11px] text-slate-500">Best before {formatShortDate(line.bestBefore)}</div>
                  </div>
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Defects
                     </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {result.defects.length === 0 ? 'None found' : `${result.defects.length} found`}
                    </div>
          <div className="text-[11px] text-slate-500">Sampled {line.palletCount} pallets</div>
                    </div>
                  </div>

      {result.defects.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {result.defects.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
              {d}
            </li>
          ))}
        </ul>
      )}

      <div
                      className={cn(
          'rounded-xl border p-4',
          failed
            ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20'
            : result.recommendation === 'markdown'
              ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
              : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
        )}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Recommendation
                  </div>
        <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {QC_DECISION_LABELS[result.recommendation]}
          {result.recommendation === 'markdown' && ` (${result.markdownPercent}%)`}
                </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {result.reasoning}
        </p>
        </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <DecisionButton
          decision="pass"
          recommended={result.recommendation === 'pass'}
          title="Pass"
          sub={`Receive ${line.quantity.toLocaleString()} cases at full price`}
          onClick={() => onDecide('pass')}
        />
        <DecisionButton
          decision="markdown"
          recommended={result.recommendation === 'markdown'}
          title={`Markdown ${result.markdownPercent || 10}%`}
          sub="Receive and clear fast in store"
          onClick={() => onDecide('markdown')}
        />
        <DecisionButton
          decision="reject"
          recommended={result.recommendation === 'reject'}
          title="Reject to claim"
          sub={`Recover $${claimValue(line).toLocaleString()} from ${line.supplier}`}
          onClick={() => onDecide('reject')}
        />
      </div>
          </div>
  );
}

function DecisionButton({
  decision,
  recommended,
  title,
  sub,
  onClick,
}: {
  decision: QcDecision;
  recommended: boolean;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const tone = DECISION_TONE[decision];
  const Icon = tone.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-3 text-left transition-colors',
        recommended
          ? `${tone.chip} shadow-sm`
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Icon className="h-4 w-4" />
          {title}
          </span>
        {recommended && (
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
            Recommended
          </span>
        )}
        </div>
      <div className="mt-1 text-[11px] opacity-80">{sub}</div>
    </button>
  );
}

function DecisionSummary({
  record,
  line,
  onNext,
  hasNext,
  onRecheck,
}: {
  record: QcRecord;
  line: QcLine;
  onNext: () => void;
  hasNext: boolean;
  onRecheck: () => void;
}) {
  const tone = DECISION_TONE[record.decision];
  const Icon = tone.icon;
            return (
    <div className="space-y-4">
              <div 
                className={cn(
          'flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4',
          tone.chip
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-bold">
              {QC_DECISION_LABELS[record.decision]}
              {record.decision === 'markdown' && ` — ${record.markdownPercent}%`}
                </div>
            <p className="mt-0.5 text-xs opacity-90">
              Lot {record.lotNumber} · {record.quantity.toLocaleString()} cases · scored{' '}
              {record.score}/100
            </p>
                </div>
              </div>
        <DecisionChip decision={record.decision} />
            </div>

      <div className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          What happened next
        </div>
        {record.decision === 'reject' ? (
          <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              Claim raised against {line.supplier} for ${claimValue(line).toLocaleString()} with the
              defect log attached.
            </li>
            {record.evidencePhotos?.length ? (
              <li className="flex items-start gap-2">
                <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                {record.evidencePhotos.length} inspection photo
                {record.evidencePhotos.length === 1 ? '' : 's'} attached to the claim file.
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              Lot blocked from put-away — no stock routed to stores.
            </li>
          </ul>
        ) : (
          <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {record.quantity.toLocaleString()} cases released to put-away and split across the four
              stores.
            </li>
            {record.markdownPercent > 0 && (
              <li className="flex items-start gap-2">
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                {record.markdownPercent}% markdown applied to the retail price for this lot.
              </li>
            )}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={record.decision === 'reject' ? '/claims' : '/store'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {record.decision === 'reject' ? 'Open claims' : 'Open store inventory'}
            <ArrowRight className="h-3 w-3" />
          </Link>
          {hasNext && (
            <button
              type="button"
              onClick={onNext}
              className={btnPrimaryClass}
            >
              Inspect next item <ArrowRight className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onRecheck}
            className={btnSecondaryClass}
          >
            <RotateCcw className="h-3 w-3" /> Re-run check
          </button>
        </div>
      </div>
    </div>
  );
}
