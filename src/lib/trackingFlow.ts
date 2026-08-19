/**
 * FreshGuard shipment tracking → risk → action flow (Blueberry / Strawberry demo).
 */

export type FreshGuardPersona =
  | 'dc_purchasing'
  | 'supplier'
  | 'transport'
  | 'receiving'
  | 'category_manager';

export type ShipmentEventStatus = 'on-time' | 'delayed' | 'early';

export type RiskCategory =
  | 'stock'
  | 'promotion'
  | 'shelf_life'
  | 'receiving'
  | 'transport'
  | 'overstock'
  | 'distribution';

export type ActionStatus =
  | 'pending_approval'
  | 'pending_category_approval'
  | 'approved'
  | 'rejected'
  | 'notified';

export type SapPoItemDetail = {
  materialNumber: string;
  description: string;
  sku: string;
  orderedQty: number;
  confirmedQty: number;
  unit: string;
  unitPrice: number;
  currency: string;
  shelfLifeDays: number;
  storageTemp: string;
  plant: string;
  storageLocation: string;
  netWeightKg: number;
  countryOfOrigin: string;
};

export type SapPoShipmentLine = {
  poNumber: string;
  item: string;
  quantity: number;
  unit: string;
  lotNumber: string;
  harvestDate: string;
  bestBefore: string;
  palletCount: number;
  grossWeightKg: number;
};

export type SapPoShipmentDetail = {
  asnNumber?: string;
  containerNumber?: string;
  shipDate?: string;
  eta?: string;
  originalEta?: string;
  origin: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  destination: string;
  transportMode: 'ocean' | 'road' | 'air';
  carrier?: string;
  vesselName?: string;
  voyageNumber?: string;
  bookingNumber?: string;
  sealNumber?: string;
  billOfLading?: string;
  incoterms: string;
  customsStatus?: string;
  tempRange: string;
  freightForwarder?: string;
  cargoLines: SapPoShipmentLine[];
};

export type SapPurchaseOrder = {
  po: string;
  item: 'Blueberries' | 'Strawberries';
  supplier: string;
  orderedQty: number;
  unit: 'Cases';
  deliveryDate: string;
  status: 'Open' | 'Acknowledged' | 'ASN Submitted' | 'In Transit' | 'Received';
  destination: string;
  companyCode: string;
  purchasingOrg: string;
  buyer: string;
  createdDate: string;
  paymentTerms: string;
  itemDetail: SapPoItemDetail;
  shipmentDetail?: SapPoShipmentDetail;
};

export type TrackShipment = {
  id: string;
  containerNumber: string;
  asnNumber: string;
  linkedPos: string[];
  item: string;
  supplier: string;
  quantity: number;
  unit: string;
  eventStatus: ShipmentEventStatus;
  eta: string;
  originalEta: string;
  origin: string;
  destination: string;
  customsStatus: 'Pending' | 'Cleared' | 'Inspection';
  stage: 'origin' | 'ocean' | 'customs' | 'inland' | 'dc_arrival' | 'delivered';
  transportMode: 'ocean' | 'road';
};

export type StoreDemand = {
  storeId: string;
  name: string;
  onHand: number;
  dailyDemand: number;
  pendingOrders: number;
  daysCover: number;
  stockoutRiskDays: number | null;
  /** ISO date — first day store is projected out of stock */
  oosStartDate?: string | null;
  /** ISO date — stock restored when inbound batch arrives */
  oosEndDate?: string | null;
  /** Remaining shelf life on current on-hand batch already in store */
  onHandShelfLifeDays: number;
  /** ISO date — current on-hand batch expires on store shelf */
  onHandExpiresDate: string;
  item: string;
};

export type PromotionRisk = {
  id: string;
  name: string;
  item: string;
  startDate: string;
  endDate: string;
  stores: string[];
  dependsOnPo: string;
  atRisk: boolean;
};

export type DcInventory = {
  dcId: string;
  name: string;
  item: string;
  availableStock: number;
  dailyDispatchRate: number;
  unit: string;
};

export type ReallocationMove = {
  type: 'dc_to_store' | 'store_to_store';
  fromLabel: string;
  toLabel: string;
  storeFromId?: string;
  storeToId?: string;
  cases: number;
  item: string;
  reason: string;
  /** Snapshot of destination store at proposal time (for drawer drill-down) */
  toOnHand?: number;
  toDailyDemand?: number;
  toPendingOrders?: number;
  toDaysCover?: number;
  toOosStartDate?: string | null;
  toOosEndDate?: string | null;
  /** Snapshot of source store (inter-store only) */
  fromOnHand?: number;
  fromDaysCover?: number;
};

export type PromotionStoreChange = {
  type: 'remove' | 'add';
  storeId: string;
  storeName: string;
  promoId: string;
  promoName: string;
  item: string;
  reason: string;
};

export type PromotionRescheduleOption = {
  promoId: string;
  promoName: string;
  originalStart: string;
  originalEnd: string;
  proposedStart: string;
  proposedEnd: string;
  reason: string;
};

export type PromotionRiskProposal = {
  promotions: PromotionRisk[];
  originalEta: string;
  revisedEta: string;
  reschedule: PromotionRescheduleOption;
  storeChanges: PromotionStoreChange[];
};

export type StockRiskProposal = {
  dcSnapshots: DcInventory[];
  storeOrders: StoreDemand[];
  atRiskStores: StoreDemand[];
  surplusStores: StoreDemand[];
  moves: ReallocationMove[];
};

export type ShelfLifeLineAnalysis = {
  item: string;
  po: string;
  storageTemp: string;
  referenceDate: string;
  /** Worst-case store for this item right now */
  atRiskStoreName: string;
  /** Days of current store stock left (from reference date) */
  currentStoreDaysLeft: number;
  /** Date current store stock runs out (quantity) */
  currentStoreStockoutDate: string;
  /** Shelf life left on pre-existing goods already on store shelf */
  currentOnHandShelfLifeDays: number;
  /** Expiry date of current on-hand batch at store */
  currentOnHandExpiresDate: string;
  originalArrivalDate: string;
  revisedArrivalDate: string;
  /** Planned: delayed_arrival is not used — planned DC + dock-to-shelf buffer */
  storeShelfDateOriginal: string;
  /** delayed_arrival_date + store_transit_buffer_days */
  storeShelfDate: string;
  /** Dock-to-shelf transit buffer (days after DC arrival before sellable in store) */
  storeTransitBufferDays: number;
  /**
   * Days store is OOS because on-hand expires before inbound hits shelf
   * (store_shelf_date − on_hand_expiration_date when positive).
   */
  oosGapDays: number;
  markdownRecommended: boolean;
  markdownPercent: number | null;
  markdownReason: string;
};

export type ShelfLifeProposal = {
  delayDays: number;
  originalEta: string;
  revisedEta: string;
  lines: ShelfLifeLineAnalysis[];
};

export type RiskAction = {
  id: string;
  shipmentId: string;
  eventStatus: ShipmentEventStatus;
  category: RiskCategory;
  title: string;
  summary: string;
  ownerPersona: FreshGuardPersona;
  approverPersona: FreshGuardPersona;
  notifyPersonas: FreshGuardPersona[];
  status: ActionStatus;
  proposal: string;
  detail?: string;
  stockProposal?: StockRiskProposal;
  promotionProposal?: PromotionRiskProposal;
  shelfLifeProposal?: ShelfLifeProposal;
};

const SUPPLIER = 'Berry Farms Co-op';

export const DEMO_POS: SapPurchaseOrder[] = [
  {
    po: 'PO-4500012345',
    item: 'Blueberries',
    supplier: SUPPLIER,
    orderedQty: 2400,
    unit: 'Cases',
    deliveryDate: '2026-08-20',
    status: 'Acknowledged',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-10',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-BB-4401',
      description: 'Fresh Blueberries — Premium Grade A',
      sku: 'SKU-BB-2345',
      orderedQty: 2400,
      confirmedQty: 2400,
      unit: 'Cases',
      unitPrice: 28.5,
      currency: 'USD',
      shelfLifeDays: 23,
      storageTemp: '0–2°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-A',
      netWeightKg: 4800,
      countryOfOrigin: 'Chile',
    },
    shipmentDetail: {
      asnNumber: 'ASN-2026-BB-0801',
      containerNumber: 'TRHU8820144',
      shipDate: '2026-08-12',
      eta: 'Aug 23, 2026 (+2 days delay)',
      originalEta: 'Aug 21, 2026',
      origin: 'Valparaíso, Chile',
      portOfLoading: 'Valparaíso',
      portOfDischarge: 'Los Angeles',
      destination: 'Chicago DC',
      transportMode: 'ocean',
      carrier: 'Maersk Reefer',
      vesselName: 'MV Andes Fresh',
      voyageNumber: 'AF-118W',
      bookingNumber: 'BB-TRHU-8820',
      sealNumber: 'SL-8820144',
      billOfLading: 'BOL-2026-8801',
      incoterms: 'FOB Valparaíso',
      customsStatus: 'Pending clearance',
      tempRange: '0–2°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012345',
          item: 'Blueberries',
          quantity: 2400,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0812-A',
          harvestDate: '2026-08-08',
          bestBefore: '2026-08-31',
          palletCount: 48,
          grossWeightKg: 5280,
        },
      ],
    },
  },
  {
    po: 'PO-4500012346',
    item: 'Strawberries',
    supplier: SUPPLIER,
    orderedQty: 1800,
    unit: 'Cases',
    deliveryDate: '2026-08-20',
    status: 'Acknowledged',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-10',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-ST-2201',
      description: 'Fresh Strawberries — Driscoll Select',
      sku: 'SKU-ST-2346',
      orderedQty: 1800,
      confirmedQty: 1800,
      unit: 'Cases',
      unitPrice: 32.0,
      currency: 'USD',
      shelfLifeDays: 22,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-B',
      netWeightKg: 2700,
      countryOfOrigin: 'Chile',
    },
    shipmentDetail: {
      asnNumber: 'ASN-2026-BB-0801',
      containerNumber: 'TRHU8820144',
      shipDate: '2026-08-12',
      eta: 'Aug 23, 2026 (+2 days delay)',
      originalEta: 'Aug 21, 2026',
      origin: 'Valparaíso, Chile',
      portOfLoading: 'Valparaíso',
      portOfDischarge: 'Los Angeles',
      destination: 'Chicago DC',
      transportMode: 'ocean',
      carrier: 'Maersk Reefer',
      vesselName: 'MV Andes Fresh',
      voyageNumber: 'AF-118W',
      bookingNumber: 'BB-TRHU-8820',
      sealNumber: 'SL-8820144',
      billOfLading: 'BOL-2026-8801',
      incoterms: 'FOB Valparaíso',
      customsStatus: 'Pending clearance',
      tempRange: '0–4°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012346',
          item: 'Strawberries',
          quantity: 1800,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0812-A',
          harvestDate: '2026-08-09',
          bestBefore: '2026-08-31',
          palletCount: 36,
          grossWeightKg: 2970,
        },
      ],
    },
  },
  {
    po: 'PO-4500012388',
    item: 'Blueberries',
    supplier: SUPPLIER,
    orderedQty: 1200,
    unit: 'Cases',
    deliveryDate: '2026-08-22',
    status: 'Open',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-14',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-BB-4401',
      description: 'Fresh Blueberries — Premium Grade A',
      sku: 'SKU-BB-2388',
      orderedQty: 1200,
      confirmedQty: 0,
      unit: 'Cases',
      unitPrice: 28.5,
      currency: 'USD',
      shelfLifeDays: 14,
      storageTemp: '0–2°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-A',
      netWeightKg: 2400,
      countryOfOrigin: 'USA',
    },
  },
];

export const DEMO_SHIPMENTS: TrackShipment[] = [
  {
    id: 'SHP-BB-DLY-01',
    containerNumber: 'TRHU8820144',
    asnNumber: 'ASN-2026-BB-0801',
    linkedPos: ['PO-4500012345', 'PO-4500012346'],
    item: 'Blueberries + Strawberries',
    supplier: SUPPLIER,
    quantity: 4200,
    unit: 'Cases',
    eventStatus: 'delayed',
    eta: 'Aug 23, 2026 (+2 days)',
    originalEta: 'Aug 21, 2026',
    origin: 'Valparaíso, Chile',
    destination: 'Chicago DC',
    customsStatus: 'Pending',
    stage: 'ocean',
    transportMode: 'ocean',
  },
  {
    id: 'SHP-ST-EARLY-01',
    containerNumber: 'MSCU7710092',
    asnNumber: 'ASN-2026-ST-0802',
    linkedPos: ['PO-4500012388'],
    item: 'Blueberries',
    supplier: SUPPLIER,
    quantity: 1200,
    unit: 'Cases',
    eventStatus: 'early',
    eta: 'Aug 19, 2026 (−1 day)',
    originalEta: 'Aug 20, 2026',
    origin: 'San Pedro, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-BB-ONT-01',
    containerNumber: 'FGRU9900331',
    asnNumber: 'ASN-2026-BB-0803',
    linkedPos: ['PO-4500012345'],
    item: 'Blueberries (partial lot)',
    supplier: SUPPLIER,
    quantity: 800,
    unit: 'Cases',
    eventStatus: 'on-time',
    eta: 'Aug 21, 2026',
    originalEta: 'Aug 21, 2026',
    origin: 'Miami Reefer Yard',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
];

export const DC_INVENTORY: DcInventory[] = [
  {
    dcId: 'DC-CHI-01',
    name: 'Chicago DC',
    item: 'Blueberries',
    availableStock: 320,
    dailyDispatchRate: 95,
    unit: 'Cases',
  },
  {
    dcId: 'DC-CHI-01',
    name: 'Chicago DC',
    item: 'Strawberries',
    availableStock: 180,
    dailyDispatchRate: 72,
    unit: 'Cases',
  },
];

export const STORE_DEMAND: StoreDemand[] = [
  {
    storeId: 'ST-101',
    name: 'Loop Market',
    onHand: 38,
    dailyDemand: 38,
    pendingOrders: 120,
    daysCover: 1.0,
    stockoutRiskDays: 1,
    oosStartDate: '2026-08-23',
    oosEndDate: '2026-08-25',
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    item: 'Blueberries',
  },
  {
    storeId: 'ST-204',
    name: 'Lincoln Park',
    onHand: 88,
    dailyDemand: 22,
    pendingOrders: 80,
    daysCover: 4.0,
    stockoutRiskDays: null,
    oosStartDate: null,
    oosEndDate: null,
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    item: 'Strawberries',
  },
  {
    storeId: 'ST-318',
    name: 'Oak Park',
    onHand: 28,
    dailyDemand: 28,
    pendingOrders: 95,
    daysCover: 1.0,
    stockoutRiskDays: 1,
    oosStartDate: '2026-08-23',
    oosEndDate: '2026-08-25',
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    item: 'Blueberries',
  },
  {
    storeId: 'ST-422',
    name: 'Evanston',
    onHand: 120,
    dailyDemand: 18,
    pendingOrders: 60,
    daysCover: 6.7,
    stockoutRiskDays: null,
    oosStartDate: null,
    oosEndDate: null,
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    item: 'Blueberries',
  },
];

/** Extra at-risk blueberry store so the delayed-batch demo has 5 stores total (3 need / 2 donate). */
STORE_DEMAND.push({
  storeId: 'ST-501',
  name: 'Wicker Park',
  onHand: 38,
  dailyDemand: 24,
  pendingOrders: 85,
  daysCover: 1.6,
  stockoutRiskDays: 1,
  oosStartDate: '2026-08-23',
  oosEndDate: '2026-08-25',
  onHandShelfLifeDays: 3,
  onHandExpiresDate: '2026-08-24',
  item: 'Blueberries',
});


export const PROMOTIONS: PromotionRisk[] = [
  {
    id: 'PROMO-882',
    name: 'Berry Weekend 2-for-1',
    item: 'Strawberries',
    startDate: '2026-08-22',
    endDate: '2026-08-24',
    stores: ['ST-101', 'ST-318'],
    dependsOnPo: 'PO-4500012346',
    atRisk: true,
  },
  {
    id: 'PROMO-901',
    name: 'Blueberry Boost — end cap',
    item: 'Blueberries',
    startDate: '2026-08-21',
    endDate: '2026-08-23',
    stores: ['ST-318', 'ST-422'],
    dependsOnPo: 'PO-4500012345',
    atRisk: true,
  },
];

/** Demo anchor date for calendar windows */
export const DEMO_TODAY = '2026-08-22';

/**
 * Dock-to-shelf transit buffer: days after DC delayed arrival before product is sellable in store.
 * store_shelf_date = delayed_arrival_date + STORE_TRANSIT_BUFFER_DAYS
 */
export const STORE_TRANSIT_BUFFER_DAYS = 2;

const SHIPMENT_ETA_ISO: Record<string, { original: string; revised: string }> = {
  'SHP-BB-DLY-01': { original: '2026-08-21', revised: '2026-08-23' },
  'SHP-ST-EARLY-01': { original: '2026-08-20', revised: '2026-08-19' },
  'SHP-BB-ONT-01': { original: '2026-08-21', revised: '2026-08-21' },
};

export function getStoreName(storeId: string): string {
  return STORE_DEMAND.find((s) => s.storeId === storeId)?.name ?? storeId;
}

export function getStoreDemandSnapshot(storeId: string, item?: string): StoreDemand | undefined {
  if (item) {
    return STORE_DEMAND.find((s) => s.storeId === storeId && s.item === item);
  }
  return STORE_DEMAND.find((s) => s.storeId === storeId);
}

export function getShipmentEtaIso(shipment: TrackShipment): { original: string; revised: string } {
  return (
    SHIPMENT_ETA_ISO[shipment.id] ?? {
      original: shipment.originalEta,
      revised: shipment.eta,
    }
  );
}
const SHIPMENT_ITEMS: Record<string, string[]> = {
  'SHP-BB-DLY-01': ['Blueberries', 'Strawberries'],
  'SHP-ST-EARLY-01': ['Blueberries'],
  'SHP-BB-ONT-01': ['Blueberries'],
};

export function getShipmentItems(shipment: TrackShipment): string[] {
  return SHIPMENT_ITEMS[shipment.id] ?? [shipment.item.split(' ')[0]];
}

export function getStoreOrdersForShipment(shipment: TrackShipment): StoreDemand[] {
  if (shipment.eventStatus !== 'delayed') return [];
  const items = getShipmentItems(shipment);
  return STORE_DEMAND.filter((s) => items.includes(s.item));
}

export function getDcInventoryForShipment(shipment: TrackShipment): DcInventory[] {
  if (shipment.eventStatus !== 'delayed') return [];
  const items = getShipmentItems(shipment);
  return DC_INVENTORY.filter((d) => items.includes(d.item));
}

export function getStoreStockoutsForShipment(shipment: TrackShipment): StoreDemand[] {
  if (shipment.eventStatus !== 'delayed') return [];
  return getStoreOrdersForShipment(shipment).filter((s) => s.stockoutRiskDays != null);
}

export function getSurplusStoresForShipment(shipment: TrackShipment): StoreDemand[] {
  if (shipment.eventStatus !== 'delayed') return [];
  return getStoreOrdersForShipment(shipment).filter(
    (s) => s.stockoutRiskDays == null && s.daysCover >= 4
  );
}

export function buildStockRiskProposal(shipment: TrackShipment): StockRiskProposal {
  const storeOrders = getStoreOrdersForShipment(shipment);
  const atRiskStores = storeOrders.filter((s) => s.stockoutRiskDays != null);
  const surplusStores = getSurplusStoresForShipment(shipment);
  const dcSnapshots = getDcInventoryForShipment(shipment);
  const moves: ReallocationMove[] = [];

  const enrichTo = (s: StoreDemand) => ({
    toOnHand: s.onHand,
    toDailyDemand: s.dailyDemand,
    toPendingOrders: s.pendingOrders,
    toDaysCover: s.daysCover,
    toOosStartDate: s.oosStartDate ?? null,
    toOosEndDate: s.oosEndDate ?? null,
  });

  const enrichFrom = (s: StoreDemand) => ({
    fromOnHand: s.onHand,
    fromDaysCover: s.daysCover,
  });

  /** Cases to bridge OOS gap: cover pending shortfall, at least 1 day of demand. */
  const casesForNeed = (dest: StoreDemand) => {
    const shortfall = Math.max(0, dest.pendingOrders - dest.onHand);
    const bridge = dest.dailyDemand * Math.max(1, dest.stockoutRiskDays ?? 1);
    return Math.max(bridge, Math.min(shortfall || bridge, 80));
  };

  /** Donor keeps ~3d cover; remaining pool is split across same-item needy stores. */
  const donatePool = (donor: StoreDemand) => {
    const keep = Math.ceil(donor.dailyDemand * 3);
    return Math.max(0, donor.onHand - keep);
  };

  // DC → at-risk stores (one move per store)
  for (const dest of atRiskStores) {
    moves.push({
      type: 'dc_to_store',
      fromLabel: 'Chicago DC',
      toLabel: dest.name,
      storeToId: dest.storeId,
      cases: casesForNeed(dest),
      item: dest.item,
      reason: `Cover ${dest.name} until inbound clears dock-to-shelf (+${STORE_TRANSIT_BUFFER_DAYS}d after DC)`,
      ...enrichTo(dest),
    });
  }

  // Inter-store: same-item surplus → needy (split donor pool so totals stay consistent)
  const needy = [...atRiskStores].sort((a, b) => a.daysCover - b.daysCover);
  const items = [...new Set(needy.map((s) => s.item))];
  for (const item of items) {
    const donor = surplusStores.find((d) => d.item === item);
    if (!donor) continue;
    const dests = needy.filter((d) => d.item === item);
    const pool = donatePool(donor);
    if (pool < dests.length * 10) continue;
    const perDest = Math.floor(pool / dests.length);
    for (const dest of dests) {
      moves.push({
        type: 'store_to_store',
        fromLabel: donor.name,
        toLabel: dest.name,
        storeFromId: donor.storeId,
        storeToId: dest.storeId,
        cases: perDest,
        item: dest.item,
        reason: `${donor.name} surplus (${donor.daysCover.toFixed(1)}d cover) → ${dest.name} OOS risk`,
        ...enrichFrom(donor),
        ...enrichTo(dest),
      });
    }
  }

  return { dcSnapshots, storeOrders, atRiskStores, surplusStores, moves };
}

export function formatStockProposalSummary(proposal: StockRiskProposal): string {
  const dcMoves = proposal.moves.filter((m) => m.type === 'dc_to_store');
  const storeMoves = proposal.moves.filter((m) => m.type === 'store_to_store');
  const parts: string[] = [];
  if (dcMoves.length) {
    parts.push(
      `DC reallocate ${dcMoves.reduce((n, m) => n + m.cases, 0)} cases to ${dcMoves.map((m) => m.toLabel).join(' & ')}`
    );
  }
  if (storeMoves.length) {
    parts.push(
      `Inter-store: ${storeMoves.map((m) => `${m.cases} ${m.item} ${m.fromLabel} → ${m.toLabel}`).join('; ')}`
    );
  }
  return parts.join('. ') + '.';
}

export function getPromotionsForShipment(shipment: TrackShipment): PromotionRisk[] {
  if (shipment.eventStatus !== 'delayed') return [];
  return PROMOTIONS.filter((p) => shipment.linkedPos.includes(p.dependsOnPo));
}

export function buildPromotionRiskProposal(shipment: TrackShipment): PromotionRiskProposal {
  const promotions = getPromotionsForShipment(shipment);
  const { original, revised } = getShipmentEtaIso(shipment);
  const primary = promotions[0] ?? PROMOTIONS[0];

  const reschedule: PromotionRescheduleOption = {
    promoId: primary.id,
    promoName: primary.name,
    originalStart: primary.startDate,
    originalEnd: primary.endDate,
    proposedStart: '2026-08-24',
    proposedEnd: '2026-08-26',
    reason: `Promo starts before revised batch arrival (${revised}). Shift window to first full sell day post-DC receipt.`,
  };

  const storeChanges: PromotionStoreChange[] = [
    {
      type: 'remove',
      storeId: 'ST-101',
      storeName: getStoreName('ST-101'),
      promoId: 'PROMO-882',
      promoName: 'Berry Weekend 2-for-1',
      item: 'Strawberries',
      reason: 'Loop Market projected OOS Aug 19–23 — cannot support promo stock from delayed batch',
    },
    {
      type: 'remove',
      storeId: 'ST-318',
      storeName: getStoreName('ST-318'),
      promoId: 'PROMO-882',
      promoName: 'Berry Weekend 2-for-1',
      item: 'Strawberries',
      reason: 'Oak Park on low cover during promo window — exclude from strawberry 2-for-1',
    },
    {
      type: 'remove',
      storeId: 'ST-318',
      storeName: getStoreName('ST-318'),
      promoId: 'PROMO-901',
      promoName: 'Blueberry Boost — end cap',
      item: 'Blueberries',
      reason: 'Oak Park blueberry promo overlap — batch delayed; exclude until inbound confirmed',
    },
    {
      type: 'add',
      storeId: 'ST-204',
      storeName: getStoreName('ST-204'),
      promoId: 'PROMO-882',
      promoName: 'Berry Weekend 2-for-1',
      item: 'Strawberries',
      reason: 'Lincoln Park has surplus strawberry cover (4.0d) — substitute promo participant',
    },
    {
      type: 'add',
      storeId: 'ST-422',
      storeName: getStoreName('ST-422'),
      promoId: 'PROMO-901',
      promoName: 'Blueberry Boost — end cap',
      item: 'Blueberries',
      reason: 'Evanston high on-hand blueberries (6.7d cover) — retain end-cap with alternate DC allocation',
    },
  ];

  return { promotions, originalEta: original, revisedEta: revised, reschedule, storeChanges };
}

export function formatPromotionProposalSummary(proposal: PromotionRiskProposal): string {
  const removed = proposal.storeChanges.filter((c) => c.type === 'remove').map((c) => c.storeName);
  const added = proposal.storeChanges.filter((c) => c.type === 'add').map((c) => c.storeName);
  return (
    `Reschedule ${proposal.reschedule.promoName} to ${proposal.reschedule.proposedStart}–${proposal.reschedule.proposedEnd}. ` +
    `Remove stores: ${removed.join(', ')}. Add stores: ${added.join(', ')}.`
  );
}

export function getShipmentDelayDays(shipment: TrackShipment): number {
  if (shipment.eventStatus === 'delayed') return 2;
  if (shipment.eventStatus === 'early') return -1;
  return 0;
}

function parseDay(iso: string): number {
  return new Date(iso + 'T12:00:00').getTime();
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / 86400000);
}

export const SHELF_QC_HOLD_DAYS = 1;
/** @deprecated Prefer STORE_TRANSIT_BUFFER_DAYS for dock-to-shelf timing */
export const SHELF_STORE_DISTRIBUTION_DAYS = 2;

function getStoreShelfContext(item: string): {
  storeName: string;
  daysLeft: number;
  stockoutDate: string;
  onHandShelfLifeDays: number;
  onHandExpiresDate: string;
} {
  const stores = STORE_DEMAND.filter((s) => s.item === item);
  const worst = stores.reduce((min, s) => (s.daysCover < min.daysCover ? s : min), stores[0]);
  const daysLeft = Math.max(0, Math.round(worst.daysCover));
  return {
    storeName: worst.name,
    daysLeft,
    stockoutDate: addDaysIso(DEMO_TODAY, Math.max(1, daysLeft || 1)),
    onHandShelfLifeDays: worst.onHandShelfLifeDays,
    onHandExpiresDate: worst.onHandExpiresDate,
  };
}

function computeMarkdown(
  oosGapDays: number,
  onHandShelfLifeDays: number,
  currentStoreDaysLeft: number
): { recommended: boolean; percent: number | null; reason: string } {
  if (oosGapDays >= 2) {
    return {
      recommended: true,
      percent: oosGapDays >= 3 ? 15 : 10,
      reason: `${oosGapDays}d out-of-stock gap — on-hand expires before inbound reaches store shelf; markdown remaining units.`,
    };
  }
  if (currentStoreDaysLeft <= 1 && onHandShelfLifeDays >= 4) {
    return {
      recommended: false,
      percent: null,
      reason: `Low qty (${currentStoreDaysLeft}d cover) but pre-existing goods still ${onHandShelfLifeDays}d shelf life — standard pricing on current on-hand.`,
    };
  }
  return {
    recommended: false,
    percent: null,
    reason: `On-hand shelf life ${onHandShelfLifeDays}d — no OOS gap vs store shelf date; standard pricing.`,
  };
}

export function buildShelfLifeProposal(shipment: TrackShipment): ShelfLifeProposal {
  const delayDays = Math.max(0, getShipmentDelayDays(shipment));
  const { original, revised } = getShipmentEtaIso(shipment);
  const storeTransitBufferDays = STORE_TRANSIT_BUFFER_DAYS;

  const linkedPos = DEMO_POS.filter((po) => shipment.linkedPos.includes(po.po) && po.shipmentDetail);

  const lines: ShelfLifeLineAnalysis[] = linkedPos.map((po) => {
    const storeCtx = getStoreShelfContext(po.item);

    // Strict dock-to-shelf: store_shelf_date = delayed_arrival + buffer (not same-day sellable)
    const storeShelfDateOriginal = addDaysIso(original, storeTransitBufferDays);
    const storeShelfDate = addDaysIso(revised, storeTransitBufferDays);

    // OOS gap when existing on-hand expires before inbound hits store shelf
    const oosGapDays = Math.max(0, daysBetween(storeCtx.onHandExpiresDate, storeShelfDate));

    const markdown = computeMarkdown(
      oosGapDays,
      storeCtx.onHandShelfLifeDays,
      storeCtx.daysLeft
    );

    return {
      item: po.item,
      po: po.po,
      storageTemp: po.itemDetail.storageTemp,
      referenceDate: DEMO_TODAY,
      atRiskStoreName: storeCtx.storeName,
      currentStoreDaysLeft: storeCtx.daysLeft,
      currentStoreStockoutDate: storeCtx.stockoutDate,
      currentOnHandShelfLifeDays: storeCtx.onHandShelfLifeDays,
      currentOnHandExpiresDate: storeCtx.onHandExpiresDate,
      originalArrivalDate: original,
      revisedArrivalDate: revised,
      storeShelfDateOriginal,
      storeShelfDate,
      storeTransitBufferDays,
      oosGapDays,
      markdownRecommended: markdown.recommended,
      markdownPercent: markdown.percent,
      markdownReason: markdown.reason,
    };
  });

  return { delayDays, originalEta: original, revisedEta: revised, lines };
}

export function formatShelfLifeProposalSummary(proposal: ShelfLifeProposal): string {
  return proposal.lines
    .map((l) => {
      const md = l.markdownRecommended ? `markdown ${l.markdownPercent}%` : 'standard pricing';
      const gap = l.oosGapDays > 0 ? `${l.oosGapDays}d OOS gap` : 'no OOS gap';
      return `${l.item}: ${gap}; deliver by ${l.currentOnHandExpiresDate}; ${md}`;
    })
    .join('. ');
}

/** What the buyer needs back from the supplier on a disrupted PO. */
export type PoSupplierRequest = {
  id: string;
  label: string;
  detail: string;
  dueDate: string;
};

/** Downstream effect of a shipment event, rolled up to a single purchase order. */
export type PoRiskImpact = {
  po: string;
  item: string;
  shipmentId: string;
  containerNumber: string;
  eventStatus: ShipmentEventStatus;
  delayDays: number;
  originalEta: string;
  revisedEta: string;
  storeShelfDate: string;
  storeTransitBufferDays: number;
  onHandExpiresDate: string;
  oosGapDays: number;
  storesAtRisk: number;
  storesTotal: number;
  moveCount: number;
  casesToMove: number;
  promosAtRisk: number;
  promoStoreChanges: number;
  markdownPercent: number | null;
  exposureValue: number;
  currency: string;
  severity: 'none' | 'watch' | 'high';
  headline: string;
  supplierRequests: PoSupplierRequest[];
};

/** Container number wins over linkedPos so a PO resolves to the shipment actually carrying it. */
export function getShipmentForPo(po: SapPurchaseOrder): TrackShipment | undefined {
  const container = po.shipmentDetail?.containerNumber;
  if (container) {
    const byContainer = DEMO_SHIPMENTS.find((s) => s.containerNumber === container);
    if (byContainer) return byContainer;
  }
  const linked = DEMO_SHIPMENTS.filter((s) => s.linkedPos.includes(po.po));
  return linked.find((s) => s.eventStatus !== 'on-time') ?? linked[0];
}

export function buildPoRiskImpact(po: SapPurchaseOrder): PoRiskImpact | null {
  const shipment = getShipmentForPo(po);
  if (!shipment) return null;

  const { original, revised } = getShipmentEtaIso(shipment);
  const delayDays = daysBetween(original, revised);
  const storeShelfDate = addDaysIso(revised, STORE_TRANSIT_BUFFER_DAYS);

  const shelfLine = buildShelfLifeProposal(shipment).lines.find((l) => l.po === po.po);
  const onHandExpiresDate = shelfLine?.currentOnHandExpiresDate ?? original;
  const oosGapDays = shelfLine?.oosGapDays ?? 0;
  const markdownPercent = shelfLine?.markdownRecommended ? shelfLine.markdownPercent : null;

  const stock = buildStockRiskProposal(shipment);
  const itemStores = stock.storeOrders.filter((s) => s.item === po.item);
  const itemMoves = stock.moves.filter((m) => m.item === po.item);

  const promos = getPromotionsForShipment(shipment).filter((p) => p.dependsOnPo === po.po);
  const promoStoreChanges = promos.length
    ? buildPromotionRiskProposal(shipment).storeChanges.filter((c) =>
        promos.some((p) => p.id === c.promoId)
      ).length
    : 0;

  const severity: PoRiskImpact['severity'] =
    shipment.eventStatus === 'delayed' && (oosGapDays > 0 || itemStores.some((s) => s.stockoutRiskDays != null))
      ? 'high'
      : shipment.eventStatus === 'on-time'
        ? 'none'
        : 'watch';

  const headline =
    shipment.eventStatus === 'delayed'
      ? `${delayDays}d late — ${oosGapDays > 0 ? `${oosGapDays}d out-of-stock gap` : 'cover holds'}`
      : shipment.eventStatus === 'early'
        ? `${Math.abs(delayDays)}d early — dock & storage capacity`
        : 'On plan';

  const supplierRequests: PoSupplierRequest[] = [];
  if (shipment.eventStatus === 'delayed') {
    supplierRequests.push(
      {
        id: 'confirm-eta',
        label: 'Confirm revised ETA',
        detail: `Acknowledge arrival ${revised} at ${po.destination} or advise a firmer date.`,
        dueDate: DEMO_TODAY,
      },
      {
        id: 'shelf-guarantee',
        label: 'Guarantee remaining shelf life',
        detail: `Goods must have at least ${po.itemDetail.shelfLifeDays - delayDays}d shelf life left on arrival; stores shelve on ${storeShelfDate}.`,
        dueDate: revised,
      }
    );
    if (oosGapDays > 0) {
      supplierRequests.push({
        id: 'partial-expedite',
        label: 'Expedite partial load',
        detail: `Air/road-split enough cases to land by ${onHandExpiresDate} and close the ${oosGapDays}d gap.`,
        dueDate: onHandExpiresDate,
      });
    }
    if (markdownPercent != null) {
      supplierRequests.push({
        id: 'markdown-share',
        label: 'Markdown cost share',
        detail: `${markdownPercent}% markdown expected on affected units — claim will be raised against this PO.`,
        dueDate: storeShelfDate,
      });
    }
  } else if (shipment.eventStatus === 'early') {
    supplierRequests.push({
      id: 'early-slot',
      label: 'Rebook dock slot',
      detail: `Arrival moved to ${revised} — confirm receiving window so the load is not held at the gate.`,
      dueDate: revised,
    });
  }

  return {
    po: po.po,
    item: po.item,
    shipmentId: shipment.id,
    containerNumber: shipment.containerNumber,
    eventStatus: shipment.eventStatus,
    delayDays,
    originalEta: original,
    revisedEta: revised,
    storeShelfDate,
    storeTransitBufferDays: STORE_TRANSIT_BUFFER_DAYS,
    onHandExpiresDate,
    oosGapDays,
    storesAtRisk: itemStores.filter((s) => s.stockoutRiskDays != null).length,
    storesTotal: itemStores.length,
    moveCount: itemMoves.length,
    casesToMove: itemMoves.reduce((n, m) => n + m.cases, 0),
    promosAtRisk: promos.filter((p) => p.atRisk).length,
    promoStoreChanges,
    markdownPercent,
    exposureValue:
      markdownPercent != null
        ? Math.round((po.orderedQty * po.itemDetail.unitPrice * markdownPercent) / 100)
        : 0,
    currency: po.itemDetail.currency,
    severity,
    headline,
    supplierRequests,
  };
}

const ACTIONS_KEY = 'freshguard-risk-actions-v6';

export function buildRiskActionsForShipment(shipment: TrackShipment): RiskAction[] {
  if (shipment.eventStatus === 'delayed') {
    const stockProposal = buildStockRiskProposal(shipment);
    const promotionProposal = buildPromotionRiskProposal(shipment);
    const shelfLifeProposal = buildShelfLifeProposal(shipment);
    return [
      {
        id: `ACT-${shipment.id}-STOCK`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'stock',
        title: 'DC stock reallocation proposal',
        summary:
          'Reallocate available DC inventory and propose inter-store transfers to stores at highest stockout risk before inbound arrives.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['transport', 'receiving'],
        status: 'pending_approval',
        proposal: formatStockProposalSummary(stockProposal),
        detail:
          'Loop Market stockout in ~2 days. Oak Park in ~3 days. Evanston & Lincoln Park have surplus cover for inter-store moves.',
        stockProposal,
      },
      {
        id: `ACT-${shipment.id}-PROMO`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'promotion',
        title: 'Promotion reschedule & store mix review',
        summary:
          'Promotions tied to this inbound batch may start before stock arrives. Propose new dates or substitute participating stores.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['category_manager'],
        status: 'pending_approval',
        proposal: formatPromotionProposalSummary(promotionProposal),
        detail:
          'Berry Weekend 2-for-1 and Blueberry Boost end-cap depend on delayed PO lines. Category sign-off required for POS & marketing updates.',
        promotionProposal,
      },
      {
        id: `ACT-${shipment.id}-SHELF`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'shelf_life',
        title: 'Revised shelf-life & markdown guidance',
        summary:
          'Delay reduces sellable window. After QC, system proposes markdown, max DC hold, and last store delivery date per item.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['receiving', 'category_manager'],
        status: 'pending_approval',
        proposal: formatShelfLifeProposalSummary(shelfLifeProposal),
        detail: 'Apply markdown guidance at store receiving if QC confirms quality with reduced remaining life.',
        shelfLifeProposal,
      },
      {
        id: `ACT-${shipment.id}-RCV`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'receiving',
        title: 'Reschedule receiving labor',
        summary: 'Receiving team must replan dock crew for revised ETA.',
        ownerPersona: 'receiving',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['receiving'],
        status: 'pending_approval',
        proposal: 'Move dock slot from Aug 21 AM → Aug 23 AM. Reduce Aug 21 swing shift by 4 FTE.',
      },
      {
        id: `ACT-${shipment.id}-TRN`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'transport',
        title: 'Reschedule transport assets',
        summary: 'Trucks assigned to this container should be redeployed.',
        ownerPersona: 'transport',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['transport'],
        status: 'pending_approval',
        proposal: 'Reassign 2 reefers to SHP-BB-ONT-01 pickup. Hold Chicago drayage until Aug 23 ETA confirmation.',
      },
    ];
  }

  if (shipment.eventStatus === 'early') {
    return [
      {
        id: `ACT-${shipment.id}-OVER`,
        shipmentId: shipment.id,
        eventStatus: 'early',
        category: 'overstock',
        title: 'Overstock & storage capacity check',
        summary: 'Early arrival may exceed chilled bay capacity.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['receiving', 'transport'],
        status: 'pending_approval',
        proposal:
          'Bay 3–4 at 92% capacity. Option A: BAU if partial put-away to overflow. Option B: accelerate store push + 10% clearance on existing Blueberry batch.',
      },
      {
        id: `ACT-${shipment.id}-RCV-E`,
        shipmentId: shipment.id,
        eventStatus: 'early',
        category: 'receiving',
        title: 'Advance receiving staffing',
        summary: 'Bring forward labor for early gate-in.',
        ownerPersona: 'receiving',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['receiving'],
        status: 'pending_approval',
        proposal: 'Add 3 FTE Aug 19 PM shift. Pre-stage pallets in pre-cool lane 2.',
      },
      {
        id: `ACT-${shipment.id}-TRN-E`,
        shipmentId: shipment.id,
        eventStatus: 'early',
        category: 'transport',
        title: 'Pull-forward drayage & yard slots',
        summary: 'Transport must advance pickup window.',
        ownerPersona: 'transport',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['transport'],
        status: 'pending_approval',
        proposal: 'Move drayage from Aug 20 → Aug 19 14:00. Cancel idle hold on 2 chassis.',
      },
      {
        id: `ACT-${shipment.id}-DIST`,
        shipmentId: shipment.id,
        eventStatus: 'early',
        category: 'distribution',
        title: 'Store distribution load planning',
        summary: 'Additional qty available earlier — adjust store delivery waves.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['transport', 'receiving'],
        status: 'pending_approval',
        proposal: 'Add supplemental delivery wave to ST-204 & ST-422 on Aug 20. Increase transport load by 1 route.',
      },
    ];
  }

  return [];
}

export function loadRiskActions(): RiskAction[] {
  try {
    const raw = localStorage.getItem(ACTIONS_KEY);
    if (raw) return JSON.parse(raw) as RiskAction[];
  } catch {
    /* ignore */
  }
  const all = DEMO_SHIPMENTS.flatMap(buildRiskActionsForShipment);
  saveRiskActions(all);
  return all;
}

export function saveRiskActions(actions: RiskAction[]) {
  localStorage.setItem(ACTIONS_KEY, JSON.stringify(actions));
}

export function getActionStatusLabel(status: ActionStatus): string {
  const labels: Record<ActionStatus, string> = {
    pending_approval: 'Pending DC approval',
    pending_category_approval: 'Pending Category Manager',
    approved: 'Approved',
    rejected: 'Rejected',
    notified: 'Notified',
  };
  return labels[status];
}

/** Whether this persona can approve/reject the action in its current state. */
export function canPersonaApproveAction(action: RiskAction, persona: FreshGuardPersona): boolean {
  if (action.status === 'approved' || action.status === 'rejected' || action.status === 'notified') {
    return false;
  }
  if (action.category === 'promotion') {
    if (action.status === 'pending_approval') return persona === 'dc_purchasing';
    if (action.status === 'pending_category_approval') return persona === 'category_manager';
    return false;
  }
  return action.status === 'pending_approval' && persona === 'dc_purchasing';
}

export function approveRiskAction(id: string, persona: FreshGuardPersona): RiskAction | null {
  const list = loadRiskActions();
  let updated: RiskAction | null = null;
  const next = list.map((a) => {
    if (a.id !== id || !canPersonaApproveAction(a, persona)) return a;
    if (a.category === 'promotion' && persona === 'dc_purchasing') {
      updated = { ...a, status: 'pending_category_approval' as const };
    } else {
      updated = { ...a, status: 'approved' as const };
    }
    return updated;
  });
  saveRiskActions(next);
  return updated;
}

export function rejectRiskAction(id: string, persona: FreshGuardPersona): void {
  const list = loadRiskActions();
  saveRiskActions(
    list.map((a) => {
      if (a.id !== id || !canPersonaApproveAction(a, persona)) return a;
      return { ...a, status: 'rejected' as const };
    })
  );
}

export const PERSONA_LABELS: Record<FreshGuardPersona, string> = {
  dc_purchasing: 'DC Purchasing',
  supplier: 'Supplier',
  transport: 'Transport Team',
  receiving: 'Receiving Team',
  category_manager: 'Category Manager',
};

export const EVENT_LABELS: Record<ShipmentEventStatus, string> = {
  'on-time': 'On time',
  delayed: 'Delayed',
  early: 'Early arrival',
};

export const EVENT_COLORS: Record<ShipmentEventStatus, string> = {
  'on-time': 'bg-emerald-100 text-emerald-900 border-emerald-200',
  delayed: 'bg-amber-100 text-amber-950 border-amber-300',
  early: 'bg-blue-100 text-blue-900 border-blue-200',
};
