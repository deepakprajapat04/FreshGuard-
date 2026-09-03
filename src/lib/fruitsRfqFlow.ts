/**
 * Fruits procurement — RFQ-first flow.
 * Award RFQ → supplier uploads shipping → PO created (simulated).
 */

import type { SapPurchaseOrder } from './trackingFlow';

export const FRUITS_RFQ_SUPPLIER = 'Berry Farms Co-op';

export type FruitsRfqStatus = 'open' | 'review' | 'awarded' | 'po_created';

/** Standing-order cadence the DC wants — or the cadence a supplier offers. */
export type FruitsRfqCadence = 'weekly' | 'twice_weekly' | 'three_times_weekly';

export type FruitsRfqRepeat = {
  cadence: FruitsRfqCadence;
  /** e.g. "Tue · Fri" */
  deliveryDays: string;
  qtyPerDelivery: number;
  /** Drops in the award window. */
  deliveries: number;
  weeks: number;
};

export type FruitsRfqQuote = {
  id: string;
  vendor: string;
  pricePerCase: number;
  /** Program total = price × qty/drop × deliveries. */
  totalPrice: number;
  eta: string;
  qualityIndex: string;
  fleetSpecification: string;
  notes: string;
  /** Supplier offer; falls back to the RFQ standing-order cycle. */
  repeat?: FruitsRfqRepeat;
};

export function cadenceLabel(cadence: FruitsRfqCadence): string {
  if (cadence === 'twice_weekly') return '2× weekly';
  if (cadence === 'three_times_weekly') return '3× weekly';
  return 'Weekly';
}

export function formatRepeatSummary(repeat: FruitsRfqRepeat): string {
  return `${cadenceLabel(repeat.cadence)} · ${repeat.deliveryDays}`;
}

/** Display standing-order id as a contract number (RFQ-F-2026-001 → CN-F-2026-001). */
export function toContractNumber(rfqId: string): string {
  return rfqId.replace(/^RFQ-/i, 'CN-');
}

/** Resolve a displayed contract number back to the internal RFQ id. */
export function fromContractNumber(id: string): string {
  return id.replace(/^CN-/i, 'RFQ-');
}

/** Demo PO ↔ contract links for seed fruit shipments (before shipping creates poNumber on the RFQ). */
const DEMO_PO_FOR_CONTRACT: Record<string, string> = {
  'RFQ-F-2026-001': 'PO-4500012345',
  'RFQ-F-2026-002': 'PO-4500012346',
  'RFQ-F-2026-003': 'PO-4500012410',
  'RFQ-F-2026-004': 'PO-4500012411',
  'RFQ-F-2026-005': 'PO-4500012395',
  'RFQ-F-2026-006': 'PO-4500012412',
  'RFQ-F-2026-007': 'PO-4500012388',
  'RFQ-F-2026-008': 'PO-4500012413',
};

/** Associated standing-order contract for a fruit PO, if any. */
export function getContractNumberForPo(poNumber: string): string | null {
  const fromRfq = loadFruitsRfqs().find((r) => r.poNumber === poNumber);
  if (fromRfq) return toContractNumber(fromRfq.id);
  const demo = Object.entries(DEMO_PO_FOR_CONTRACT).find(([, po]) => po === poNumber);
  return demo ? toContractNumber(demo[0]) : null;
}

export function isPendingContractStatus(status: FruitsRfqStatus): boolean {
  return status === 'awarded';
}

export function quoteProgramTotal(pricePerCase: number, repeat: FruitsRfqRepeat): number {
  return Math.round(pricePerCase * repeat.qtyPerDelivery * repeat.deliveries);
}

export function getQuoteRepeat(quote: FruitsRfqQuote, rfq: FruitsRfq): FruitsRfqRepeat {
  return quote.repeat ?? rfq.repeat;
}

export type FruitsRfq = {
  id: string;
  item: string;
  fruitItem: 'Blueberries' | 'Strawberries' | 'Avocados' | 'Oranges' | 'Raspberries' | 'Grapes' | 'Mangoes' | 'Cherries';
  /** Weekly volume (cases). Per-drop qty lives on `repeat`. */
  quantity: number;
  unit: 'Cases';
  deliveryDate: string;
  destination: string;
  status: FruitsRfqStatus;
  buyer: string;
  createdDate: string;
  deadline: string;
  repeat: FruitsRfqRepeat;
  specifications: {
    tempRange: string;
    minShelfLife: string;
    sizeSpec: string;
  };
  quotes: FruitsRfqQuote[];
  awardedVendor?: string;
  awardedQuoteId?: string;
  unitPrice?: number;
  poNumber?: string;
  pomsCreatedAt?: string;
  /** Set when buyer awards quote — supplier action starts here. */
  awardedAt?: string;
};

export type FruitsRfqShippingInput = {
  rfqId: string;
  asnNumber: string;
  containerNumber: string;
  shipDate: string;
  eta: string;
  quantity?: number;
  quantityExpected?: number;
  quantityActual?: number;
  amount?: number;
  transportMode?: string;
  incoterms?: string;
  originalEta?: string;
  carrier?: string;
  vessel?: string;
  voyage?: string;
  origin?: string;
  destination?: string;
  billOfLading?: string;
  customs?: string;
  tempRange?: string;
};

const RFQS_KEY = 'freshguard-fruits-rfqs-v4';
const RFQ_POS_KEY = 'freshguard-fruits-rfq-pos-v1';
const PO_COUNTER_KEY = 'freshguard-fruits-po-counter';

const BB_TWICE: FruitsRfqRepeat = {
  cadence: 'twice_weekly',
  deliveryDays: 'Tue · Fri',
  qtyPerDelivery: 900,
  deliveries: 8,
  weeks: 4,
};
const ST_TWICE: FruitsRfqRepeat = {
  cadence: 'twice_weekly',
  deliveryDays: 'Mon · Thu',
  qtyPerDelivery: 1200,
  deliveries: 8,
  weeks: 4,
};
const AV_TWICE: FruitsRfqRepeat = {
  cadence: 'twice_weekly',
  deliveryDays: 'Wed · Sat',
  qtyPerDelivery: 1600,
  deliveries: 8,
  weeks: 4,
};
const OR_WEEKLY: FruitsRfqRepeat = {
  cadence: 'weekly',
  deliveryDays: 'Thursday',
  qtyPerDelivery: 4200,
  deliveries: 4,
  weeks: 4,
};
const RB_THREE: FruitsRfqRepeat = {
  cadence: 'three_times_weekly',
  deliveryDays: 'Mon · Wed · Fri',
  qtyPerDelivery: 500,
  deliveries: 12,
  weeks: 4,
};
const GR_TWICE: FruitsRfqRepeat = {
  cadence: 'twice_weekly',
  deliveryDays: 'Tue · Fri',
  qtyPerDelivery: 1400,
  deliveries: 8,
  weeks: 4,
};
const MG_WEEKLY: FruitsRfqRepeat = {
  cadence: 'weekly',
  deliveryDays: 'Wednesday',
  qtyPerDelivery: 2200,
  deliveries: 4,
  weeks: 4,
};
const CH_THREE: FruitsRfqRepeat = {
  cadence: 'three_times_weekly',
  deliveryDays: 'Mon · Wed · Fri',
  qtyPerDelivery: 400,
  deliveries: 12,
  weeks: 4,
};

function awardedHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

const SEED_RFQS: FruitsRfq[] = [
  {
    id: 'RFQ-F-2026-001',
    item: 'Premium Blueberries — Export Grade',
    fruitItem: 'Blueberries',
    quantity: 1800,
    unit: 'Cases',
    deliveryDate: '2026-09-05',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-26',
    deadline: 'Closed',
    repeat: BB_TWICE,
    specifications: {
      tempRange: '0–2°C',
      minShelfLife: '18 days at receipt',
      sizeSpec: 'Large · 12×6 oz cups',
    },
    quotes: [
      {
        id: 'FQ-001-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 29.5,
        totalPrice: quoteProgramTotal(29.5, BB_TWICE),
        eta: '2026-09-04',
        qualityIndex: '97/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Valparaíso pack-out · pre-cooled pallets · GPS reefer monitoring.',
        repeat: BB_TWICE,
      },
      {
        id: 'FQ-001-B',
        vendor: 'Andes Berry Export',
        pricePerCase: 27.8,
        totalPrice: quoteProgramTotal(27.8, {
          cadence: 'weekly',
          deliveryDays: 'Thursday',
          qtyPerDelivery: 1800,
          deliveries: 4,
          weeks: 4,
        }),
        eta: '2026-09-06',
        qualityIndex: '91/100',
        fleetSpecification: 'Passive Cooling',
        notes: 'Weekly drop at a lower rate · passive cold chain · less frequent than DC 2× weekly ask.',
        repeat: {
          cadence: 'weekly',
          deliveryDays: 'Thursday',
          qtyPerDelivery: 1800,
          deliveries: 4,
          weeks: 4,
        },
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-001-A',
    unitPrice: 29.5,
    awardedAt: awardedHoursAgo(5),
  },
  {
    id: 'RFQ-F-2026-002',
    item: 'Organic Strawberries — 1 lb Clamshell',
    fruitItem: 'Strawberries',
    quantity: 2400,
    unit: 'Cases',
    deliveryDate: '2026-09-08',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-22',
    deadline: 'Closed',
    repeat: ST_TWICE,
    specifications: {
      tempRange: '0–4°C',
      minShelfLife: '12 days at receipt',
      sizeSpec: 'US #1 · organic certified',
    },
    quotes: [
      {
        id: 'FQ-002-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 22.4,
        totalPrice: quoteProgramTotal(22.4, ST_TWICE),
        eta: '2026-09-07',
        qualityIndex: '96/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Same-day pack from Salinas cold chain · dedicated reefer lane · Mon/Thu slots held.',
        repeat: ST_TWICE,
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-002-A',
    unitPrice: 22.4,
    awardedAt: awardedHoursAgo(1),
  },
  {
    id: 'RFQ-F-2026-003',
    item: 'Organic Hass Avocados — Size 48',
    fruitItem: 'Avocados',
    quantity: 3200,
    unit: 'Cases',
    deliveryDate: '2026-09-10',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-25',
    deadline: 'Closed',
    repeat: AV_TWICE,
    specifications: {
      tempRange: '4–8°C',
      minShelfLife: '14 days at receipt',
      sizeSpec: 'Size 48 · 95% dry matter',
    },
    quotes: [
      {
        id: 'FQ-003-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 34.2,
        totalPrice: quoteProgramTotal(34.2, AV_TWICE),
        eta: '2026-09-09',
        qualityIndex: '95/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Michoacán orchard gate · ethylene scrubbers · Wed/Sat dual-drop reefer.',
        repeat: AV_TWICE,
      },
      {
        id: 'FQ-003-B',
        vendor: 'Pacific Avocado Growers',
        pricePerCase: 32.9,
        totalPrice: quoteProgramTotal(32.9, {
          cadence: 'weekly',
          deliveryDays: 'Sunday',
          qtyPerDelivery: 3200,
          deliveries: 4,
          weeks: 4,
        }),
        eta: '2026-09-11',
        qualityIndex: '92/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Certified organic block · one weekly drop · longer inland dray to port.',
        repeat: {
          cadence: 'weekly',
          deliveryDays: 'Sunday',
          qtyPerDelivery: 3200,
          deliveries: 4,
          weeks: 4,
        },
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-003-A',
    unitPrice: 34.2,
    awardedAt: awardedHoursAgo(4),
  },
  {
    id: 'RFQ-F-2026-004',
    item: 'Valencia Oranges — Seedless',
    fruitItem: 'Oranges',
    quantity: 4200,
    unit: 'Cases',
    deliveryDate: '2026-09-12',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-24',
    deadline: 'Closed',
    repeat: OR_WEEKLY,
    specifications: {
      tempRange: '3–7°C',
      minShelfLife: '21 days at receipt',
      sizeSpec: '88 count · premium exterior',
    },
    quotes: [
      {
        id: 'FQ-004-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 18.6,
        totalPrice: quoteProgramTotal(18.6, OR_WEEKLY),
        eta: '2026-09-11',
        qualityIndex: '94/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Valencia late-season block · waxed and color-sorted · Thursday weekly program.',
        repeat: OR_WEEKLY,
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-004-A',
    unitPrice: 18.6,
    awardedAt: awardedHoursAgo(10),
  },
  {
    id: 'RFQ-F-2026-005',
    item: 'Red Raspberries — 6 oz Clamshell',
    fruitItem: 'Raspberries',
    quantity: 1500,
    unit: 'Cases',
    deliveryDate: '2026-09-06',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-27',
    deadline: 'Closed',
    repeat: RB_THREE,
    specifications: {
      tempRange: '0–2°C',
      minShelfLife: '10 days at receipt',
      sizeSpec: 'US #1 · tender fruit program',
    },
    quotes: [
      {
        id: 'FQ-005-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 31.8,
        totalPrice: quoteProgramTotal(31.8, RB_THREE),
        eta: '2026-09-05',
        qualityIndex: '98/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Same-day pick · forced-air precool · Mon/Wed/Fri air-freight slots.',
        repeat: RB_THREE,
      },
      {
        id: 'FQ-005-B',
        vendor: 'Columbia Berry Co.',
        pricePerCase: 29.4,
        totalPrice: quoteProgramTotal(29.4, {
          cadence: 'twice_weekly',
          deliveryDays: 'Tue · Fri',
          qtyPerDelivery: 750,
          deliveries: 8,
          weeks: 4,
        }),
        eta: '2026-09-06',
        qualityIndex: '89/100',
        fleetSpecification: 'Passive Cooling',
        notes: '2× weekly at a lower landed cost · fewer drops than the 3× weekly ask.',
        repeat: {
          cadence: 'twice_weekly',
          deliveryDays: 'Tue · Fri',
          qtyPerDelivery: 750,
          deliveries: 8,
          weeks: 4,
        },
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-005-A',
    unitPrice: 31.8,
    awardedAt: awardedHoursAgo(2),
  },
  {
    id: 'RFQ-F-2026-006',
    item: 'Green Seedless Grapes — 18 lb Lug',
    fruitItem: 'Grapes',
    quantity: 2800,
    unit: 'Cases',
    deliveryDate: '2026-09-09',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-23',
    deadline: 'Closed',
    repeat: GR_TWICE,
    specifications: {
      tempRange: '0–2°C',
      minShelfLife: '16 days at receipt',
      sizeSpec: 'Large · SO2 pads',
    },
    quotes: [
      {
        id: 'FQ-006-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 24.6,
        totalPrice: quoteProgramTotal(24.6, GR_TWICE),
        eta: '2026-09-08',
        qualityIndex: '95/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'San Joaquin pack · SO2 pads · Tue/Fri dual-drop reefer.',
        repeat: GR_TWICE,
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-006-A',
    unitPrice: 24.6,
    awardedAt: awardedHoursAgo(6),
  },
  {
    id: 'RFQ-F-2026-007',
    item: 'Ataulfo Mangoes — 9 count',
    fruitItem: 'Mangoes',
    quantity: 2200,
    unit: 'Cases',
    deliveryDate: '2026-09-11',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-21',
    deadline: 'Closed',
    repeat: MG_WEEKLY,
    specifications: {
      tempRange: '10–13°C',
      minShelfLife: '12 days at receipt',
      sizeSpec: '9 count · stage 3 color',
    },
    quotes: [
      {
        id: 'FQ-007-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 28.1,
        totalPrice: quoteProgramTotal(28.1, MG_WEEKLY),
        eta: '2026-09-10',
        qualityIndex: '94/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Michoacán Ataulfo block · weekly Wednesday drop · ripening-room ready.',
        repeat: MG_WEEKLY,
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-007-A',
    unitPrice: 28.1,
    awardedAt: awardedHoursAgo(8),
  },
  {
    id: 'RFQ-F-2026-008',
    item: 'Rainier Cherries — 18 lb',
    fruitItem: 'Cherries',
    quantity: 1200,
    unit: 'Cases',
    deliveryDate: '2026-09-07',
    destination: 'Chicago DC',
    status: 'awarded',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-28',
    deadline: 'Closed',
    repeat: CH_THREE,
    specifications: {
      tempRange: '0–1°C',
      minShelfLife: '10 days at receipt',
      sizeSpec: '9.5 row · hydrocooled',
    },
    quotes: [
      {
        id: 'FQ-008-A',
        vendor: FRUITS_RFQ_SUPPLIER,
        pricePerCase: 42.5,
        totalPrice: quoteProgramTotal(42.5, CH_THREE),
        eta: '2026-09-06',
        qualityIndex: '98/100',
        fleetSpecification: 'Active Refrigerated',
        notes: 'Yakima hydrocool · Mon/Wed/Fri air-freight · short-life program.',
        repeat: CH_THREE,
      },
    ],
    awardedVendor: FRUITS_RFQ_SUPPLIER,
    awardedQuoteId: 'FQ-008-A',
    unitPrice: 42.5,
    awardedAt: awardedHoursAgo(3),
  },
];

function mergeSeedRfqs(overrides: FruitsRfq[]): FruitsRfq[] {
  const overrideMap = new Map(overrides.map((r) => [r.id, r]));
  return SEED_RFQS.map((seed) => {
    const override = overrideMap.get(seed.id);
    if (!override) return { ...seed };
    return {
      ...seed,
      ...override,
      repeat: override.repeat ?? seed.repeat,
      quotes: seed.quotes.map((sq) => {
        const oq = override.quotes?.find((q) => q.id === sq.id);
        return oq ? { ...sq, ...oq, repeat: oq.repeat ?? sq.repeat } : sq;
      }),
    };
  }).sort((a, b) => b.createdDate.localeCompare(a.createdDate));
}

export function loadFruitsRfqs(): FruitsRfq[] {
  try {
    const raw = localStorage.getItem(RFQS_KEY);
    if (raw) return mergeSeedRfqs(JSON.parse(raw) as FruitsRfq[]);
  } catch {
    /* ignore */
  }
  return SEED_RFQS.map((r) => ({ ...r }));
}

export function persistFruitsRfqs(rfqs: FruitsRfq[]): void {
  const overrides = rfqs.filter((r) => {
    const seed = SEED_RFQS.find((s) => s.id === r.id);
    if (!seed) return true;
    return (
      r.status !== seed.status ||
      r.awardedVendor !== seed.awardedVendor ||
      r.awardedQuoteId !== seed.awardedQuoteId ||
      r.unitPrice !== seed.unitPrice ||
      r.poNumber !== seed.poNumber ||
      r.pomsCreatedAt !== seed.pomsCreatedAt ||
      r.awardedAt !== seed.awardedAt
    );
  });
  localStorage.setItem(RFQS_KEY, JSON.stringify(overrides));
}

export function awardFruitsRfq(rfqId: string, quoteId: string): FruitsRfq | null {
  const rfqs = loadFruitsRfqs();
  let updated: FruitsRfq | null = null;
  const next = rfqs.map((r) => {
    if (r.id !== rfqId) return r;
    const quote = r.quotes.find((q) => q.id === quoteId);
    if (!quote) return r;
    updated = {
      ...r,
      status: 'awarded',
      awardedVendor: quote.vendor,
      awardedQuoteId: quoteId,
      unitPrice: quote.pricePerCase,
      awardedAt: new Date().toISOString(),
    };
    return updated;
  });
  persistFruitsRfqs(next);
  return updated;
}

export function getRfqsAwaitingShipping(vendor?: string): FruitsRfq[] {
  return loadFruitsRfqs()
    .filter(
      (r) =>
        r.status === 'awarded' &&
        (!vendor || r.awardedVendor === vendor)
    )
    .sort((a, b) => (b.awardedAt ?? '').localeCompare(a.awardedAt ?? ''));
}

export function getSupplierCompletedRfqs(vendor: string): FruitsRfq[] {
  return loadFruitsRfqs().filter(
    (r) => r.status === 'po_created' && r.awardedVendor === vendor
  );
}

export function getAwardedQuote(rfq: FruitsRfq): FruitsRfqQuote | undefined {
  if (!rfq.awardedQuoteId) {
    return rfq.quotes.find((q) => q.vendor === rfq.awardedVendor);
  }
  return rfq.quotes.find((q) => q.id === rfq.awardedQuoteId);
}

export function loadFruitsRfqPos(): SapPurchaseOrder[] {
  try {
    const raw = localStorage.getItem(RFQ_POS_KEY);
    if (raw) return JSON.parse(raw) as SapPurchaseOrder[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveFruitsRfqPos(pos: SapPurchaseOrder[]): void {
  localStorage.setItem(RFQ_POS_KEY, JSON.stringify(pos));
}

function nextPoNumber(): string {
  let n = 9901;
  try {
    const raw = localStorage.getItem(PO_COUNTER_KEY);
    if (raw) n = Number(raw) + 1;
  } catch {
    /* ignore */
  }
  localStorage.setItem(PO_COUNTER_KEY, String(n));
  return `PO-45000${n}`;
}

export function getRfqDropQty(rfq: FruitsRfq): number {
  const quote = getAwardedQuote(rfq);
  return quote ? getQuoteRepeat(quote, rfq).qtyPerDelivery : rfq.repeat.qtyPerDelivery;
}

function buildPoFromRfq(rfq: FruitsRfq, input: FruitsRfqShippingInput): SapPurchaseOrder {
  const qty =
    input.quantityActual ??
    input.quantity ??
    input.quantityExpected ??
    getRfqDropQty(rfq);
  const unitPrice = rfq.unitPrice ?? rfq.quotes[0]?.pricePerCase ?? 0;
  const po = nextPoNumber();
  const materialPrefix: Record<FruitsRfq['fruitItem'], string> = {
    Blueberries: 'BB',
    Strawberries: 'ST',
    Avocados: 'AV',
    Oranges: 'OR',
    Raspberries: 'RB',
    Grapes: 'GR',
    Mangoes: 'MG',
    Cherries: 'CH',
  };
  const prefix = materialPrefix[rfq.fruitItem];
  const shelfLifeDays: Record<FruitsRfq['fruitItem'], number> = {
    Blueberries: 21,
    Strawberries: 14,
    Avocados: 14,
    Oranges: 21,
    Raspberries: 10,
    Grapes: 16,
    Mangoes: 12,
    Cherries: 10,
  };

  const transportRaw = (input.transportMode ?? 'ocean').trim().toLowerCase();
  const transportMode: 'ocean' | 'air' | 'road' =
    transportRaw === 'air' || transportRaw.includes('air')
      ? 'air'
      : transportRaw === 'road' ||
          transportRaw === 'land' ||
          transportRaw.includes('truck') ||
          transportRaw.includes('road') ||
          transportRaw.includes('land')
        ? 'road'
        : 'ocean';

  return {
    po,
    item: rfq.fruitItem,
    supplier: rfq.awardedVendor ?? FRUITS_RFQ_SUPPLIER,
    orderedQty: qty,
    unit: 'Cases',
    deliveryDate: rfq.deliveryDate,
    status: 'ASN Submitted',
    destination: rfq.destination,
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: rfq.buyer,
    createdDate: new Date().toISOString().slice(0, 10),
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: `MAT-${prefix}-RFQ`,
      description: `${rfq.item} · ${toContractNumber(rfq.id)}`,
      sku: `SKU-${prefix}-RFQ`,
      orderedQty: input.quantityExpected ?? getRfqDropQty(rfq),
      confirmedQty: qty,
      unit: 'Cases',
      unitPrice,
      currency: 'USD',
      shelfLifeDays: shelfLifeDays[rfq.fruitItem],
      storageTemp: rfq.specifications.tempRange,
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-A',
      netWeightKg: Math.round(qty * 2),
      countryOfOrigin: 'Chile',
    },
    shipmentDetail: {
      asnNumber: input.asnNumber,
      containerNumber: input.containerNumber,
      shipDate: input.shipDate,
      eta: input.eta,
      originalEta: input.originalEta?.trim() || input.eta,
      origin: input.origin?.trim() || 'Valparaíso, Chile',
      portOfLoading: 'Valparaíso',
      portOfDischarge: 'Los Angeles',
      destination: input.destination?.trim() || rfq.destination,
      transportMode,
      carrier: input.carrier?.trim() || 'Maersk Reefer',
      vesselName: input.vessel?.trim() || 'MV Andes Fresh',
      voyageNumber: input.voyage?.trim() || 'AF-118W',
      billOfLading: input.billOfLading?.trim() || undefined,
      incoterms: input.incoterms?.trim() || 'FOB Valparaíso',
      customsStatus: input.customs?.trim() || 'Pending clearance',
      tempRange: input.tempRange?.trim() || rfq.specifications.tempRange,
      cargoLines: [
        {
          poNumber: po,
          item: rfq.fruitItem,
          quantity: qty,
          unit: 'Cases',
          lotNumber: `LOT-RFQ-${po.slice(-4)}`,
          harvestDate: input.shipDate,
          bestBefore: rfq.deliveryDate,
          palletCount: Math.max(1, Math.round(qty / 48)),
          grossWeightKg: Math.round(qty * 2.1),
        },
      ],
    },
  };
}

export function createPoFromFruitsRfqShipping(
  input: FruitsRfqShippingInput
): { po: SapPurchaseOrder; rfq: FruitsRfq } | null {
  const rfqs = loadFruitsRfqs();
  const idx = rfqs.findIndex((r) => r.id === input.rfqId && r.status === 'awarded');
  if (idx < 0) return null;

  const rfq = rfqs[idx];
  const po = buildPoFromRfq(rfq, input);

  const updatedRfq: FruitsRfq = {
    ...rfq,
    status: 'po_created',
    poNumber: po.po,
    pomsCreatedAt: new Date().toISOString(),
  };

  const nextRfqs = [...rfqs];
  nextRfqs[idx] = updatedRfq;
  persistFruitsRfqs(nextRfqs);

  const existing = loadFruitsRfqPos();
  saveFruitsRfqPos([po, ...existing.filter((p) => p.po !== po.po)]);

  return { po, rfq: updatedRfq };
}

export function getFruitsRfqById(id: string): FruitsRfq | undefined {
  return loadFruitsRfqs().find((r) => r.id === id);
}

function parseRfqQuality(qualityIndex: string): number {
  return parseInt(qualityIndex.replace(/[^\d]/g, ''), 10) || 0;
}

function shipDaysFromFleet(fleet: string): number {
  if (fleet.includes('Active')) return 2;
  if (fleet.includes('Passive')) return 3;
  return 3;
}

function originFromQuote(quote: FruitsRfqQuote): string {
  const n = quote.notes.toLowerCase();
  if (n.includes('valparaíso') || n.includes('chile')) return 'Chile';
  if (n.includes('salinas') || n.includes('michoacán') || n.includes('mexico')) return 'Mexico';
  if (n.includes('valencia') || n.includes('citrus')) return 'USA — CA';
  if (n.includes('columbia') || n.includes('airport')) return 'USA — OR';
  return 'Americas';
}

export type RfqSourcingAlternate = {
  id: string;
  supplierName: string;
  bidId: string;
  rfqId: string;
  shipDays: number;
  pricePerCase: number;
  currency: string;
  origin: string;
  capacityCases: number;
  recommended: boolean;
  reason: string;
  qualityIndex: string;
};

/** Alternate suppliers from Request for Quote — 2nd-best bidder on the matching fruit RFQ is recommended. */
export function getRfqAlternateSupplierOptions(
  item: string,
  primarySupplier: string,
  maxShipDays: number
): { options: RfqSourcingAlternate[]; recommendedOptionId: string | null } {
  const rfqs = loadFruitsRfqs();
  const fruitItem = item as FruitsRfq['fruitItem'];

  const itemRanked = rfqs
    .filter((r) => r.fruitItem === fruitItem)
    .flatMap((r) => r.quotes.map((q) => ({ quote: q, rfqId: r.id, rfqQty: r.quantity })))
    .sort((a, b) => parseRfqQuality(b.quote.qualityIndex) - parseRfqQuality(a.quote.qualityIndex));

  const secondBestVendor = itemRanked[1]?.quote.vendor ?? itemRanked[0]?.quote.vendor;

  const byVendor = new Map<
    string,
    { quote: FruitsRfqQuote; rfqId: string; rfqQty: number }
  >();

  for (const rfq of rfqs) {
    for (const quote of rfq.quotes) {
      if (quote.vendor === primarySupplier) continue;
      const existing = byVendor.get(quote.vendor);
      if (
        !existing ||
        parseRfqQuality(quote.qualityIndex) > parseRfqQuality(existing.quote.qualityIndex)
      ) {
        byVendor.set(quote.vendor, { quote, rfqId: rfq.id, rfqQty: rfq.quantity });
      }
    }
  }

  const options: RfqSourcingAlternate[] = [...byVendor.values()]
    .map(({ quote, rfqId, rfqQty }) => {
      const shipDays = shipDaysFromFleet(quote.fleetSpecification);
      const isSecondBest = quote.vendor === secondBestVendor;
      return {
        id: `alt-rfq-${quote.id}`,
        supplierName: quote.vendor,
        bidId: quote.id,
        rfqId,
        shipDays,
        pricePerCase: quote.pricePerCase,
        currency: 'USD',
        origin: originFromQuote(quote),
        capacityCases: Math.min(rfqQty, Math.max(400, Math.round(rfqQty * 0.5))),
        recommended: isSecondBest,
        reason: isSecondBest
          ? `2nd-best RFQ bidder on Request for Quote (${quote.qualityIndex} quality)`
          : `RFQ bidder on ${rfqId} · ${quote.qualityIndex} quality`,
        qualityIndex: quote.qualityIndex,
      };
    })
    .filter((o) => o.shipDays <= maxShipDays)
    .sort(
      (a, b) =>
        Number(b.recommended) - Number(a.recommended) ||
        parseRfqQuality(b.qualityIndex) - parseRfqQuality(a.qualityIndex)
    );

  const recommendedOptionId = options.find((o) => o.recommended)?.id ?? options[0]?.id ?? null;

  return { options, recommendedOptionId };
}

export const SUPPLIER_SEEN_RFQS_KEY = 'freshguard-supplier-seen-rfqs';
const ACTIVE_SHIPMENTS_KEY = 'freshguard-active-shipments-v6';

/** Clear RFQ demo state so both seed requests return to their starting statuses. */
export function resetFruitsRfqDemo(): void {
  const rfqPoNumbers = new Set(loadFruitsRfqPos().map((p) => p.po));

  localStorage.removeItem(RFQS_KEY);
  localStorage.removeItem(RFQ_POS_KEY);
  localStorage.removeItem(PO_COUNTER_KEY);
  localStorage.removeItem(SUPPLIER_SEEN_RFQS_KEY);

  try {
    const raw = localStorage.getItem(ACTIVE_SHIPMENTS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as Array<{ id?: string; linkedPos?: string[] }>;
      const filtered = list.filter((s) => {
        if (s.linkedPos?.some((p) => rfqPoNumbers.has(p))) return false;
        if (s.id && rfqPoNumbers.has(s.id)) return false;
        if (s.id && /^PO-4500099\d+$/.test(s.id)) return false;
        return true;
      });
      localStorage.setItem(ACTIVE_SHIPMENTS_KEY, JSON.stringify(filtered));
    }
  } catch {
    /* ignore */
  }
}
