/**
 * Receiving quality check — PO → item lot → inspection → pass / markdown / reject to claim.
 */
import {
  DEMO_POS,
  DEMO_TODAY,
  type SapPurchaseOrder,
} from './trackingFlow';

export type QcDecision = 'pass' | 'markdown' | 'reject';

export type QcLine = {
  id: string;
  po: string;
  supplier: string;
  item: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  harvestDate: string;
  bestBefore: string;
  palletCount: number;
  storageTemp: string;
  unitPrice: number;
  currency: string;
};

export type QcCheckResult = {
  lineId: string;
  score: number;
  tempMaxC: number;
  excursionHours: number;
  shelfLifeLeftDays: number;
  defects: string[];
  recommendation: QcDecision;
  markdownPercent: number;
  reasoning: string;
};

export type QcRecord = {
  lineId: string;
  po: string;
  item: string;
  lotNumber: string;
  quantity: number;
  decision: QcDecision;
  score: number;
  markdownPercent: number;
  decidedAt: string;
  evidencePhotos?: string[];
};

export const QC_DECISION_LABELS: Record<QcDecision, string> = {
  pass: 'Pass — receive at full price',
  markdown: 'Markdown — receive at reduced price',
  reject: 'Reject — raise supplier claim',
};

const QC_RECORDS_KEY = 'freshguard-qc-records-v1';
const STORE_ITEMS_KEY = 'freshguard-store-items';
const CLAIMS_KEY = 'freshguard-claims-list';

/** Lot suffix drives the demo outcome so every run is reproducible. */
type LotProfile = {
  score: number;
  tempMaxC: number;
  excursionHours: number;
  defects: string[];
  reasoning: string;
};

const LOT_PROFILES: Record<string, LotProfile> = {
  A: {
    score: 96,
    tempMaxC: 2.1,
    excursionHours: 0,
    defects: [],
    reasoning:
      'Cold chain held within spec for the full voyage. Surface scan shows no bruising, mould or crush damage. Receive at full price.',
  },
  B: {
    score: 74,
    tempMaxC: 6.4,
    excursionHours: 5.5,
    defects: ['Minor surface bruising on outer layers', 'Softening on ~8% of punnets'],
    reasoning:
      'Short warm excursion during transhipment. Fruit is saleable but will move slower than plan — clear with a markdown rather than holding stock.',
  },
  C: {
    score: 41,
    tempMaxC: 11.8,
    excursionHours: 16.2,
    defects: [
      'Sustained temperature excursion above 10°C',
      'Mould visible on sample punnets',
      'Leaking cartons on lower pallet tier',
    ],
    reasoning:
      'Cold chain broke for over 16 hours. Product fails the receiving standard — reject the lot and recover cost from the supplier.',
  },
};

function hashProfileKey(lotNumber: string): string {
  const suffix = lotNumber.trim().slice(-1).toUpperCase();
  if (LOT_PROFILES[suffix]) return suffix;
  const sum = [...lotNumber].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return ['A', 'B', 'C'][sum % 3];
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000
  );
}

/** Only POs with an ASN can be inspected — nothing has physically arrived otherwise. */
export function getQcPurchaseOrders(): SapPurchaseOrder[] {
  return DEMO_POS.filter((po) => po.shipmentDetail && po.shipmentDetail.cargoLines.length > 0);
}

export function getQcLines(po: SapPurchaseOrder): QcLine[] {
  if (!po.shipmentDetail) return [];
  return po.shipmentDetail.cargoLines.map((line) => ({
    id: `${po.po}-${line.lotNumber}`,
    po: po.po,
    supplier: po.supplier,
    item: line.item,
    lotNumber: line.lotNumber,
    quantity: line.quantity,
    unit: line.unit,
    harvestDate: line.harvestDate,
    bestBefore: line.bestBefore,
    palletCount: line.palletCount,
    storageTemp: po.itemDetail.storageTemp,
    unitPrice: po.itemDetail.unitPrice,
    currency: po.itemDetail.currency,
  }));
}

function markdownForScore(score: number): number {
  if (score >= 85) return 0;
  if (score >= 75) return 10;
  if (score >= 65) return 15;
  return 20;
}

export function runQualityCheck(line: QcLine): QcCheckResult {
  const profile = LOT_PROFILES[hashProfileKey(line.lotNumber)];
  const recommendation: QcDecision =
    profile.score >= 85 ? 'pass' : profile.score >= 60 ? 'markdown' : 'reject';

  return {
    lineId: line.id,
    score: profile.score,
    tempMaxC: profile.tempMaxC,
    excursionHours: profile.excursionHours,
    shelfLifeLeftDays: Math.max(0, daysBetween(DEMO_TODAY, line.bestBefore)),
    defects: profile.defects,
    recommendation,
    markdownPercent: recommendation === 'reject' ? 100 : markdownForScore(profile.score),
    reasoning: profile.reasoning,
  };
}

export function loadQcRecords(): QcRecord[] {
  try {
    const raw = localStorage.getItem(QC_RECORDS_KEY);
    return raw ? (JSON.parse(raw) as QcRecord[]) : [];
  } catch {
    return [];
  }
}

function saveQcRecords(records: QcRecord[]) {
  localStorage.setItem(QC_RECORDS_KEY, JSON.stringify(records));
}

export function clearQcRecords() {
  localStorage.removeItem(QC_RECORDS_KEY);
}

export function removeQcRecord(lineId: string): QcRecord[] {
  const next = loadQcRecords().filter((r) => r.lineId !== lineId);
  saveQcRecords(next);
  return next;
}

const STORE_BRANCHES = ['Chicago Downtown', 'Lincoln Park', 'West Loop', 'Southport'];

function routeToStores(line: QcLine, result: QcCheckResult, markdownPercent: number) {
  try {
    const raw = localStorage.getItem(STORE_ITEMS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const perBranch = Math.round(line.quantity / STORE_BRANCHES.length);
    const added = STORE_BRANCHES.map((branch) => ({
      id: line.po,
      branch,
      item: line.item,
      cases: perBranch,
      qualityScore: result.score,
      markdown: `${markdownPercent}%`,
      verificationTag:
        markdownPercent > 0
          ? `QC passed with markdown — lot ${line.lotNumber}`
          : `QC passed at full price — lot ${line.lotNumber}`,
      timestamp: new Date().toISOString(),
      status: 'Auto-Received' as const,
    }));
    localStorage.setItem(STORE_ITEMS_KEY, JSON.stringify([...added, ...existing]));
  } catch {
    /* demo storage only */
  }
}

function raiseClaim(line: QcLine, result: QcCheckResult) {
  try {
    const raw = localStorage.getItem(CLAIMS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const amount = Math.round(line.quantity * line.unitPrice);
    existing.unshift({
      id: `CLM-${line.lotNumber.slice(-6)}`,
      po: line.po,
      vendor: line.supplier,
      issue: result.defects.join('; ') || 'Failed receiving quality check',
      status: 'pending',
      amount: `$${amount.toLocaleString()}`,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(existing));
  } catch {
    /* demo storage only */
  }
}

/** Records the decision and pushes the lot into store inventory or the claims ledger. */
export function applyQcDecision(
  line: QcLine,
  result: QcCheckResult,
  decision: QcDecision,
  evidencePhotos: string[] = []
): QcRecord {
  const markdownPercent = decision === 'markdown' ? result.markdownPercent || 10 : 0;

  if (decision === 'reject') {
    raiseClaim(line, result);
  } else {
    routeToStores(line, result, markdownPercent);
  }

  const record: QcRecord = {
    lineId: line.id,
    po: line.po,
    item: line.item,
    lotNumber: line.lotNumber,
    quantity: line.quantity,
    decision,
    score: result.score,
    markdownPercent,
    decidedAt: new Date().toISOString(),
    evidencePhotos: evidencePhotos.length ? evidencePhotos : undefined,
  };

  const next = [record, ...loadQcRecords().filter((r) => r.lineId !== line.id)];
  saveQcRecords(next);
  return record;
}

export function claimValue(line: QcLine): number {
  return Math.round(line.quantity * line.unitPrice);
}
