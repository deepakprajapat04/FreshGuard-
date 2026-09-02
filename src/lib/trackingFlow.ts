/**
 * FreshGuard shipment tracking → risk → action flow (Blueberry / Strawberry demo).
 */

import {
  estimateShelfShortage,
  loadBusinessRules,
  type BusinessRulesConfig,
} from './businessRules';
import { getRfqAlternateSupplierOptions } from './fruitsRfqFlow';
import { MVP_HIDE_PROMOTIONS } from './mvpFlags';

export type DcPurchasingPersona = 'dc_purchasing_fruits' | 'dc_purchasing_vegetables';

export type FreshGuardPersona =
  | DcPurchasingPersona
  | 'supplier'
  | 'transport'
  | 'receiving'
  | 'category_manager';

export const DC_PURCHASING_PERSONAS: DcPurchasingPersona[] = [
  'dc_purchasing_fruits',
  'dc_purchasing_vegetables',
];

export function isDcPurchasingPersona(persona: FreshGuardPersona): persona is DcPurchasingPersona {
  return persona === 'dc_purchasing_fruits' || persona === 'dc_purchasing_vegetables';
}

export type PurchasingLane = 'fruits' | 'vegetables';

const VEGETABLE_ITEM_PATTERN =
  /\b(lettuce|broccoli|tomato|pepper|carrot|celery|spinach|kale|cucumber|vegetable|romaine|cauliflower|iceberg)\b/i;

export function getPurchasingLaneForShipment(shipment: TrackShipment): PurchasingLane {
  if (shipment.purchasingLane) return shipment.purchasingLane;
  return VEGETABLE_ITEM_PATTERN.test(shipment.item) ? 'vegetables' : 'fruits';
}

export function getPurchasingLaneForPo(po: SapPurchaseOrder): PurchasingLane {
  if (po.buyer === 'David Okonkwo') return 'vegetables';
  if (po.buyer === 'Sarah Mitchell') return 'fruits';
  const hay = `${po.item} ${po.itemDetail?.description ?? ''}`;
  return VEGETABLE_ITEM_PATTERN.test(hay) ? 'vegetables' : 'fruits';
}

export function getPurchasingPersonaForLane(lane: PurchasingLane): DcPurchasingPersona {
  return lane === 'vegetables' ? 'dc_purchasing_vegetables' : 'dc_purchasing_fruits';
}

export function getShipmentPurchasingPersona(shipment: TrackShipment): DcPurchasingPersona {
  return getPurchasingPersonaForLane(getPurchasingLaneForShipment(shipment));
}

/** DC buyers only see shipments in their lane; ops personas see all. */
export function shipmentVisibleToPersona(
  shipment: TrackShipment,
  persona: FreshGuardPersona
): boolean {
  if (!isDcPurchasingPersona(persona)) return true;
  return getShipmentPurchasingPersona(shipment) === persona;
}

/** DC buyers only see POs in their lane. */
export function poVisibleToPersona(po: SapPurchaseOrder, persona: FreshGuardPersona): boolean {
  if (!isDcPurchasingPersona(persona)) return true;
  return getPurchasingPersonaForLane(getPurchasingLaneForPo(po)) === persona;
}

/** Vegetables lane — shipment intel is status-only (no risk actions / approvals). */
export function isVegetablesStatusOnlyIntel(persona: FreshGuardPersona): boolean {
  return persona === 'dc_purchasing_vegetables';
}

export type ShipmentEventStatus = 'on-time' | 'delayed' | 'early';

export type RiskCategory =
  | 'stock'
  | 'promotion'
  | 'shelf_life'
  | 'receiving'
  | 'transport'
  | 'overstock'
  | 'distribution'
  | 'clearance'
  | 'sourcing';

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

/** SAP-style PO line item (multi-line purchase orders). */
export type SapPoOrderLine = {
  lineNumber: number;
  item: string;
  materialNumber: string;
  description: string;
  sku: string;
  orderedQty: number;
  confirmedQty: number;
  unit: 'Cases';
  unitPrice: number;
  currency: string;
  shelfLifeDays: number;
  storageTemp: string;
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
  item: string;
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
  /** Multiple SAP line items on one PO header (falls back to itemDetail when omitted). */
  orderLines?: SapPoOrderLine[];
  shipmentDetail?: SapPoShipmentDetail;
};

export function getPoOrderLines(po: SapPurchaseOrder): SapPoOrderLine[] {
  if (po.orderLines?.length) return po.orderLines;
  return [
    {
      lineNumber: 10,
      item: po.item,
      materialNumber: po.itemDetail.materialNumber,
      description: po.itemDetail.description,
      sku: po.itemDetail.sku,
      orderedQty: po.itemDetail.orderedQty,
      confirmedQty: po.itemDetail.confirmedQty,
      unit: 'Cases',
      unitPrice: po.itemDetail.unitPrice,
      currency: po.itemDetail.currency,
      shelfLifeDays: po.itemDetail.shelfLifeDays,
      storageTemp: po.itemDetail.storageTemp,
      storageLocation: po.itemDetail.storageLocation,
      netWeightKg: po.itemDetail.netWeightKg,
      countryOfOrigin: po.itemDetail.countryOfOrigin,
    },
  ];
}

export function getPoLineCount(po: SapPurchaseOrder): number {
  return getPoOrderLines(po).length;
}

export function getPoNetValue(po: SapPurchaseOrder): number {
  return getPoOrderLines(po).reduce((sum, line) => sum + line.unitPrice * line.orderedQty, 0);
}

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
  /** Fruits vs vegetables procurement lane — drives buyer approval routing. */
  purchasingLane?: PurchasingLane;
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
  /**
   * Scheduled store delivery-order date (ISO). Used to count stores with a
   * delivery in the calendar week of the PO / shipment Original ETA.
   */
  deliveryDate?: string | null;
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

/** Per-item guidance when an inbound batch arrives early. */
export type EarlyArrivalBatchGuidance = {
  item: string;
  po: string;
  inboundCases: number;
  /** Remaining sellable days on the new inbound batch at DC gate-in */
  newBatchShelfLifeDays: number;
  /** Max days the new batch should sit in DC before store push */
  maxDcHoldDays: number;
  recommendedDcHoldDays: number;
  markdownPercent: number | null;
  markdownReason: string;
  clearanceGuidance: string;
};

export type EarlyStorePush = {
  storeId: string;
  storeName: string;
  item: string;
  cases: number;
  reason: string;
  /** Store must arrange bay / clear ageing stock before early delivery */
  notifyStore: boolean;
};

/**
 * Early-arrival overstock check:
 * capacity Yes → BAU (no stock action);
 * capacity No → early replenishment + store notify + shelf-life / markdown guidance.
 */
export type OverstockPresentStock = {
  item: string;
  dcOnHandCases: number;
  dcDailyDispatch: number;
  storeOnHandCases: number;
  storeCount: number;
  onHandShelfLifeDays: number;
  onHandExpiresDate: string;
};

export type OverstockProjectedStock = {
  /** DC on-hand if early inbound is put away without pushing stores */
  dcIfHeldCases: number;
  overflowCases: number;
  /** Days of DC cover after early put-away (vs daily dispatch) */
  dcDaysCoverIfHeld: number;
  /** What happens to the ageing batch already in DC/stores */
  ageingBatchAction: string;
};

export type OverstockHandlingMeasure = {
  id: string;
  step: number;
  title: string;
  action: string;
  why: string;
  owner: string;
};

export type OverstockProposal = {
  hasStorageCapacity: boolean;
  capacityPct: number;
  bayLabel: string;
  freePalletSlots: number;
  inboundPallets: number;
  inboundCases: number;
  decision: 'bau' | 'early_replenishment';
  storageCostNote: string;
  shelfLifeConsequence: string;
  presentStock: OverstockPresentStock;
  projectedStock: OverstockProjectedStock;
  handlingMeasures: OverstockHandlingMeasure[];
  batches: EarlyArrivalBatchGuidance[];
  storePushes: EarlyStorePush[];
  originalEta: string;
  revisedEta: string;
  earlyDays: number;
};

export type DistributionProposal = {
  earlyDays: number;
  revisedEta: string;
  extraRoutes: number;
  totalCases: number;
  storeDeliveries: EarlyStorePush[];
  notifyMessage: string;
  hasStorageCapacity: boolean;
  /** Ageing DC stock that must clear before / with early wave */
  ageingDcCases: number;
  ageingShelfLifeDays: number;
  ageingExpiresDate: string;
  markdownPercent: number | null;
  overflowCases: number;
  putAwayCases: number;
  measures: OverstockHandlingMeasure[];
};

/** Clear ageing stock on early arrival — markdown OR schedule a promo (Category Manager). */
export type EarlyClearanceOption = {
  id: 'markdown' | 'schedule_promotion';
  title: string;
  recommended: boolean;
  summary: string;
  casesAffected: number;
  item: string;
  unitPrice: number;
  currency: string;
  estimatedRecoveryUsd: number;
  markdownPercent?: number;
  promoName?: string;
  proposedStart?: string;
  proposedEnd?: string;
  stores?: { storeId: string; storeName: string }[];
  reason: string;
};

export type EarlyClearanceProposal = {
  item: string;
  ageingDcCases: number;
  ageingStoreCases: number;
  onHandShelfLifeDays: number;
  onHandExpiresDate: string;
  earlyDays: number;
  revisedEta: string;
  options: EarlyClearanceOption[];
  recommendedOptionId: 'markdown' | 'schedule_promotion';
  /** User-chosen plan (defaults to recommended) */
  selectedOptionId: 'markdown' | 'schedule_promotion';
  requiresCategoryApproval: boolean;
};

/** Delayed inbound — choose alternate supplier and issue a fill-in PO. */
export type AlternateSupplierOption = {
  id: string;
  supplierName: string;
  bidId: string;
  shipDays: number;
  pricePerCase: number;
  currency: string;
  origin: string;
  capacityCases: number;
  recommended: boolean;
  reason: string;
  /** Request for Quote reference when sourced from RFQ module */
  rfqId?: string;
};

export type SourcingProposal = {
  eligible: boolean;
  ineligibleReason?: string;
  delayDays: number;
  /** From Business Rules — offer alt supplier when delay ≥ this */
  minDelayDaysConfig: number;
  /** From Business Rules — only suppliers who can ship within this */
  maxShipDaysConfig: number;
  item: string;
  category: string;
  primarySupplier: string;
  primaryPo: string;
  fillInCases: number;
  unit: string;
  unitPricePrimary: number;
  currency: string;
  shortageCases: number;
  daysOfCover: number;
  options: AlternateSupplierOption[];
  selectedOptionId: string | null;
  recommendedOptionId: string | null;
  issuedPo?: string;
  issuedAt?: string;
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
  /** Shipment / PO context for task list and detail headers */
  containerNumber?: string;
  asnNumber?: string;
  supplier?: string;
  linkedPos?: string[];
  items?: string[];
  stockProposal?: StockRiskProposal;
  promotionProposal?: PromotionRiskProposal;
  shelfLifeProposal?: ShelfLifeProposal;
  overstockProposal?: OverstockProposal;
  distributionProposal?: DistributionProposal;
  clearanceProposal?: EarlyClearanceProposal;
  sourcingProposal?: SourcingProposal;
  receivingImpact?: ReceivingImpact;
  transportImpact?: TransportImpact;
};

export type RiskActionPoSummary = {
  po: string;
  item: string;
  supplier: string;
  orderedQty: number;
  unit: string;
  lineCount: number;
  lineDescriptions: string[];
};

export type RiskActionContext = {
  shipmentId: string;
  containerNumber: string;
  asnNumber?: string;
  supplier: string;
  linkedPos: string[];
  items: string[];
  totalQuantity: number;
  unit: string;
  destination: string;
  eta: string;
  poSummaries: RiskActionPoSummary[];
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
    status: 'In Transit',
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
    orderLines: [
      {
        lineNumber: 10,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4401-A',
        description: 'Fresh Blueberries — Premium Grade A',
        sku: 'SKU-BB-2345-A',
        orderedQty: 1000,
        confirmedQty: 1000,
        unit: 'Cases',
        unitPrice: 29.5,
        currency: 'USD',
        shelfLifeDays: 23,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 2200,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 20,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4402',
        description: 'Fresh Blueberries — Grade B',
        sku: 'SKU-BB-2345-B',
        orderedQty: 900,
        confirmedQty: 900,
        unit: 'Cases',
        unitPrice: 26.0,
        currency: 'USD',
        shelfLifeDays: 21,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1980,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 30,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4403-O',
        description: 'Fresh Blueberries — Organic',
        sku: 'SKU-BB-2345-O',
        orderedQty: 500,
        confirmedQty: 500,
        unit: 'Cases',
        unitPrice: 34.0,
        currency: 'USD',
        shelfLifeDays: 20,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1100,
        countryOfOrigin: 'Chile',
      },
    ],
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
          item: 'Blueberries — Premium Grade A',
          quantity: 1000,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0812-A',
          harvestDate: '2026-08-08',
          bestBefore: '2026-08-31',
          palletCount: 20,
          grossWeightKg: 2200,
        },
        {
          poNumber: 'PO-4500012345',
          item: 'Blueberries — Grade B',
          quantity: 900,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0812-B',
          harvestDate: '2026-08-09',
          bestBefore: '2026-08-29',
          palletCount: 18,
          grossWeightKg: 1980,
        },
        {
          poNumber: 'PO-4500012345',
          item: 'Blueberries — Organic',
          quantity: 500,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0813-C',
          harvestDate: '2026-08-10',
          bestBefore: '2026-08-27',
          palletCount: 10,
          grossWeightKg: 1100,
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
    status: 'In Transit',
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
    orderLines: [
      {
        lineNumber: 10,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2201-A',
        description: 'Fresh Strawberries — Driscoll Select',
        sku: 'SKU-ST-2346-A',
        orderedQty: 1000,
        confirmedQty: 1000,
        unit: 'Cases',
        unitPrice: 33.5,
        currency: 'USD',
        shelfLifeDays: 22,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 1650,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 20,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2202',
        description: 'Fresh Strawberries — Standard',
        sku: 'SKU-ST-2346-B',
        orderedQty: 800,
        confirmedQty: 800,
        unit: 'Cases',
        unitPrice: 29.0,
        currency: 'USD',
        shelfLifeDays: 20,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 1320,
        countryOfOrigin: 'Chile',
      },
    ],
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
          item: 'Strawberries — Driscoll Select',
          quantity: 1000,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0812-A',
          harvestDate: '2026-08-09',
          bestBefore: '2026-08-31',
          palletCount: 20,
          grossWeightKg: 1650,
        },
        {
          poNumber: 'PO-4500012346',
          item: 'Strawberries — Standard',
          quantity: 800,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0813-B',
          harvestDate: '2026-08-10',
          bestBefore: '2026-08-28',
          palletCount: 16,
          grossWeightKg: 1320,
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
    status: 'In Transit',
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
      confirmedQty: 1200,
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
    orderLines: [
      {
        lineNumber: 10,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4401-A',
        description: 'Fresh Blueberries — Premium Grade A',
        sku: 'SKU-BB-2388-A',
        orderedQty: 700,
        confirmedQty: 700,
        unit: 'Cases',
        unitPrice: 28.5,
        currency: 'USD',
        shelfLifeDays: 14,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1540,
        countryOfOrigin: 'USA',
      },
      {
        lineNumber: 20,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4402',
        description: 'Fresh Blueberries — Grade B',
        sku: 'SKU-BB-2388-B',
        orderedQty: 500,
        confirmedQty: 500,
        unit: 'Cases',
        unitPrice: 24.5,
        currency: 'USD',
        shelfLifeDays: 12,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1100,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-ST-0802',
      containerNumber: 'MSCU7710092',
      shipDate: '2026-08-17',
      eta: 'Aug 19, 2026 (−1 day early)',
      originalEta: 'Aug 20, 2026',
      origin: 'San Pedro, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Midwest Reefer Lines',
      bookingNumber: 'BB-MSCU-7710',
      sealNumber: 'SL-7710092',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–2°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012388',
          item: 'Blueberries — Premium Grade A',
          quantity: 700,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0816-A',
          harvestDate: '2026-08-14',
          bestBefore: '2026-08-30',
          palletCount: 14,
          grossWeightKg: 1540,
        },
        {
          poNumber: 'PO-4500012388',
          item: 'Blueberries — Grade B',
          quantity: 500,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0816-B',
          harvestDate: '2026-08-15',
          bestBefore: '2026-08-28',
          palletCount: 10,
          grossWeightKg: 1100,
        },
      ],
    },
  },
  {
    po: 'PO-4500012390',
    item: 'Strawberries',
    supplier: SUPPLIER,
    orderedQty: 1500,
    unit: 'Cases',
    deliveryDate: '2026-09-02',
    status: 'Open',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-18',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-ST-2201',
      description: 'Fresh Strawberries — Driscoll Select',
      sku: 'SKU-ST-2390',
      orderedQty: 1500,
      confirmedQty: 0,
      unit: 'Cases',
      unitPrice: 32.0,
      currency: 'USD',
      shelfLifeDays: 22,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-B',
      netWeightKg: 2250,
      countryOfOrigin: 'USA',
    },
  },
  {
    po: 'PO-4500012395',
    item: 'Strawberries',
    supplier: SUPPLIER,
    orderedQty: 600,
    unit: 'Cases',
    deliveryDate: '2026-08-21',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-15',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-ST-2201',
      description: 'Fresh Strawberries — Driscoll Select',
      sku: 'SKU-ST-2395',
      orderedQty: 600,
      confirmedQty: 600,
      unit: 'Cases',
      unitPrice: 32.0,
      currency: 'USD',
      shelfLifeDays: 16,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-B',
      netWeightKg: 900,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2201-A',
        description: 'Strawberries — Driscoll Select',
        sku: 'SKU-ST-2395-A',
        orderedQty: 350,
        confirmedQty: 350,
        unit: 'Cases',
        unitPrice: 33.5,
        currency: 'USD',
        shelfLifeDays: 16,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 525,
        countryOfOrigin: 'USA',
      },
      {
        lineNumber: 20,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2202',
        description: 'Strawberries — Standard',
        sku: 'SKU-ST-2395-B',
        orderedQty: 250,
        confirmedQty: 250,
        unit: 'Cases',
        unitPrice: 29.0,
        currency: 'USD',
        shelfLifeDays: 14,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 375,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-ST-0812',
      containerNumber: 'CAIU4402188',
      shipDate: '2026-08-18',
      eta: 'Aug 20, 2026 (−2 days early)',
      originalEta: 'Aug 22, 2026',
      origin: 'Oxnard, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Midwest Reefer Lines',
      bookingNumber: 'CAIU-4402188',
      sealNumber: 'SL-4402188',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–4°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012395',
          item: 'Strawberries — Driscoll Select',
          quantity: 350,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0818-A',
          harvestDate: '2026-08-16',
          bestBefore: '2026-09-01',
          palletCount: 7,
          grossWeightKg: 595,
        },
        {
          poNumber: 'PO-4500012395',
          item: 'Strawberries — Standard',
          quantity: 250,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0818-B',
          harvestDate: '2026-08-17',
          bestBefore: '2026-08-30',
          palletCount: 5,
          grossWeightKg: 425,
        },
      ],
    },
  },
  {
    po: 'PO-4500012401',
    item: 'Blueberries',
    supplier: SUPPLIER,
    orderedQty: 3600,
    unit: 'Cases',
    deliveryDate: '2026-08-24',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-12',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-BB-MIX',
      description: 'Blueberry program — multi-grade consolidated PO',
      sku: 'SKU-BB-2401',
      orderedQty: 3600,
      confirmedQty: 3600,
      unit: 'Cases',
      unitPrice: 27.8,
      currency: 'USD',
      shelfLifeDays: 18,
      storageTemp: '0–2°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-A',
      netWeightKg: 7200,
      countryOfOrigin: 'Chile',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4401-A',
        description: 'Blueberries — Premium Grade A',
        sku: 'SKU-BB-2401-A',
        orderedQty: 1200,
        confirmedQty: 1200,
        unit: 'Cases',
        unitPrice: 30.0,
        currency: 'USD',
        shelfLifeDays: 18,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 2640,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 20,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4402',
        description: 'Blueberries — Grade B',
        sku: 'SKU-BB-2401-B',
        orderedQty: 900,
        confirmedQty: 900,
        unit: 'Cases',
        unitPrice: 26.5,
        currency: 'USD',
        shelfLifeDays: 16,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1980,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 30,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4403-O',
        description: 'Blueberries — Organic',
        sku: 'SKU-BB-2401-O',
        orderedQty: 600,
        confirmedQty: 600,
        unit: 'Cases',
        unitPrice: 35.0,
        currency: 'USD',
        shelfLifeDays: 15,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1320,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 40,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4404-F',
        description: 'Blueberries — Family Pack',
        sku: 'SKU-BB-2401-F',
        orderedQty: 900,
        confirmedQty: 900,
        unit: 'Cases',
        unitPrice: 24.0,
        currency: 'USD',
        shelfLifeDays: 17,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1800,
        countryOfOrigin: 'Chile',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-BB-0810',
      containerNumber: 'HLXU5520198',
      shipDate: '2026-08-14',
      eta: 'Aug 25, 2026 (+1 day delay)',
      originalEta: 'Aug 24, 2026',
      origin: 'Valparaíso, Chile',
      portOfLoading: 'Valparaíso',
      portOfDischarge: 'Los Angeles',
      destination: 'Chicago DC',
      transportMode: 'ocean',
      carrier: 'Hapag-Lloyd Reefer',
      vesselName: 'MV Cordillera Express',
      voyageNumber: 'CE-204W',
      bookingNumber: 'HLXU-5520198',
      sealNumber: 'SL-5520198',
      billOfLading: 'BOL-2026-8810',
      incoterms: 'FOB Valparaíso',
      customsStatus: 'Pending clearance',
      tempRange: '0–2°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012401',
          item: 'Blueberries — Premium Grade A',
          quantity: 1200,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0814-A',
          harvestDate: '2026-08-11',
          bestBefore: '2026-08-29',
          palletCount: 24,
          grossWeightKg: 2860,
        },
        {
          poNumber: 'PO-4500012401',
          item: 'Blueberries — Grade B',
          quantity: 900,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0814-B',
          harvestDate: '2026-08-12',
          bestBefore: '2026-08-27',
          palletCount: 18,
          grossWeightKg: 2145,
        },
        {
          poNumber: 'PO-4500012401',
          item: 'Blueberries — Organic',
          quantity: 600,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0814-O',
          harvestDate: '2026-08-12',
          bestBefore: '2026-08-26',
          palletCount: 12,
          grossWeightKg: 1430,
        },
        {
          poNumber: 'PO-4500012401',
          item: 'Blueberries — Family Pack',
          quantity: 900,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0814-F',
          harvestDate: '2026-08-13',
          bestBefore: '2026-08-28',
          palletCount: 18,
          grossWeightKg: 1980,
        },
      ],
    },
  },
  {
    po: 'PO-4500012402',
    item: 'Strawberries',
    supplier: SUPPLIER,
    orderedQty: 2850,
    unit: 'Cases',
    deliveryDate: '2026-08-24',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'Sarah Mitchell',
    createdDate: '2026-08-12',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-ST-MIX',
      description: 'Strawberry seasonal — multi-line consolidated PO',
      sku: 'SKU-ST-2402',
      orderedQty: 2850,
      confirmedQty: 2850,
      unit: 'Cases',
      unitPrice: 31.2,
      currency: 'USD',
      shelfLifeDays: 20,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-B',
      netWeightKg: 4275,
      countryOfOrigin: 'Chile',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2201-A',
        description: 'Strawberries — Driscoll Select',
        sku: 'SKU-ST-2402-A',
        orderedQty: 1100,
        confirmedQty: 1100,
        unit: 'Cases',
        unitPrice: 34.0,
        currency: 'USD',
        shelfLifeDays: 20,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 1815,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 20,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2202',
        description: 'Strawberries — Standard',
        sku: 'SKU-ST-2402-B',
        orderedQty: 950,
        confirmedQty: 950,
        unit: 'Cases',
        unitPrice: 29.5,
        currency: 'USD',
        shelfLifeDays: 18,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 1568,
        countryOfOrigin: 'Chile',
      },
      {
        lineNumber: 30,
        item: 'Strawberries',
        materialNumber: 'MAT-ST-2203-P',
        description: 'Strawberries — Pint Clamshell',
        sku: 'SKU-ST-2402-P',
        orderedQty: 800,
        confirmedQty: 800,
        unit: 'Cases',
        unitPrice: 30.0,
        currency: 'USD',
        shelfLifeDays: 19,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-B',
        netWeightKg: 1200,
        countryOfOrigin: 'Chile',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-BB-0810',
      containerNumber: 'HLXU5520198',
      shipDate: '2026-08-14',
      eta: 'Aug 25, 2026 (+1 day delay)',
      originalEta: 'Aug 24, 2026',
      origin: 'Valparaíso, Chile',
      portOfLoading: 'Valparaíso',
      portOfDischarge: 'Los Angeles',
      destination: 'Chicago DC',
      transportMode: 'ocean',
      carrier: 'Hapag-Lloyd Reefer',
      vesselName: 'MV Cordillera Express',
      voyageNumber: 'CE-204W',
      bookingNumber: 'HLXU-5520198',
      sealNumber: 'SL-5520198',
      billOfLading: 'BOL-2026-8810',
      incoterms: 'FOB Valparaíso',
      customsStatus: 'Pending clearance',
      tempRange: '0–4°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012402',
          item: 'Strawberries — Driscoll Select',
          quantity: 1100,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0814-A',
          harvestDate: '2026-08-11',
          bestBefore: '2026-08-30',
          palletCount: 22,
          grossWeightKg: 1870,
        },
        {
          poNumber: 'PO-4500012402',
          item: 'Strawberries — Standard',
          quantity: 950,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0814-B',
          harvestDate: '2026-08-12',
          bestBefore: '2026-08-28',
          palletCount: 19,
          grossWeightKg: 1615,
        },
        {
          poNumber: 'PO-4500012402',
          item: 'Strawberries — Pint Clamshell',
          quantity: 800,
          unit: 'Cases',
          lotNumber: 'LOT-ST-0814-P',
          harvestDate: '2026-08-13',
          bestBefore: '2026-08-29',
          palletCount: 16,
          grossWeightKg: 1280,
        },
      ],
    },
  },
  {
    po: 'PO-4500012403',
    item: 'Blueberries',
    supplier: SUPPLIER,
    orderedQty: 2200,
    unit: 'Cases',
    deliveryDate: '2026-08-19',
    status: 'Received',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'James Chen',
    createdDate: '2026-08-05',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-BB-RCV',
      description: 'Blueberry receiving batch — five line grades',
      sku: 'SKU-BB-2403',
      orderedQty: 2200,
      confirmedQty: 2200,
      unit: 'Cases',
      unitPrice: 27.0,
      currency: 'USD',
      shelfLifeDays: 14,
      storageTemp: '0–2°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-A',
      netWeightKg: 4400,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4401-A',
        description: 'Blueberries — Premium Grade A',
        sku: 'SKU-BB-2403-A',
        orderedQty: 500,
        confirmedQty: 500,
        unit: 'Cases',
        unitPrice: 29.0,
        currency: 'USD',
        shelfLifeDays: 14,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 1100,
        countryOfOrigin: 'USA',
      },
      {
        lineNumber: 20,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4402',
        description: 'Blueberries — Grade B',
        sku: 'SKU-BB-2403-B',
        orderedQty: 450,
        confirmedQty: 450,
        unit: 'Cases',
        unitPrice: 25.0,
        currency: 'USD',
        shelfLifeDays: 12,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 990,
        countryOfOrigin: 'USA',
      },
      {
        lineNumber: 30,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4403-O',
        description: 'Blueberries — Organic',
        sku: 'SKU-BB-2403-O',
        orderedQty: 350,
        confirmedQty: 350,
        unit: 'Cases',
        unitPrice: 33.0,
        currency: 'USD',
        shelfLifeDays: 13,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 770,
        countryOfOrigin: 'USA',
      },
      {
        lineNumber: 40,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4404-F',
        description: 'Blueberries — Family Pack',
        sku: 'SKU-BB-2403-F',
        orderedQty: 450,
        confirmedQty: 450,
        unit: 'Cases',
        unitPrice: 23.5,
        currency: 'USD',
        shelfLifeDays: 12,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 900,
        countryOfOrigin: 'USA',
      },
      {
        lineNumber: 50,
        item: 'Blueberries',
        materialNumber: 'MAT-BB-4405-X',
        description: 'Blueberries — Export surplus',
        sku: 'SKU-BB-2403-X',
        orderedQty: 450,
        confirmedQty: 450,
        unit: 'Cases',
        unitPrice: 22.0,
        currency: 'USD',
        shelfLifeDays: 11,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-A',
        netWeightKg: 900,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-BB-0805',
      containerNumber: 'TGHU6633812',
      shipDate: '2026-08-10',
      eta: 'Aug 18, 2026 (on time)',
      originalEta: 'Aug 18, 2026',
      origin: 'Watsonville, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Midwest Reefer Lines',
      bookingNumber: 'TGHU-6633812',
      sealNumber: 'SL-6633812',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–2°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500012403',
          item: 'Blueberries — Premium Grade A',
          quantity: 500,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0810-A',
          harvestDate: '2026-08-08',
          bestBefore: '2026-08-22',
          palletCount: 10,
          grossWeightKg: 1150,
        },
        {
          poNumber: 'PO-4500012403',
          item: 'Blueberries — Grade B',
          quantity: 450,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0810-B',
          harvestDate: '2026-08-08',
          bestBefore: '2026-08-20',
          palletCount: 9,
          grossWeightKg: 1035,
        },
        {
          poNumber: 'PO-4500012403',
          item: 'Blueberries — Organic',
          quantity: 350,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0810-O',
          harvestDate: '2026-08-09',
          bestBefore: '2026-08-21',
          palletCount: 7,
          grossWeightKg: 805,
        },
        {
          poNumber: 'PO-4500012403',
          item: 'Blueberries — Family Pack',
          quantity: 450,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0810-F',
          harvestDate: '2026-08-09',
          bestBefore: '2026-08-20',
          palletCount: 9,
          grossWeightKg: 990,
        },
        {
          poNumber: 'PO-4500012403',
          item: 'Blueberries — Export surplus',
          quantity: 450,
          unit: 'Cases',
          lotNumber: 'LOT-BB-0810-X',
          harvestDate: '2026-08-10',
          bestBefore: '2026-08-19',
          palletCount: 9,
          grossWeightKg: 990,
        },
      ],
    },
  },
  {
    po: 'PO-4500022101',
    item: 'Romaine Lettuce',
    supplier: 'Green Valley Produce',
    orderedQty: 1800,
    unit: 'Cases',
    deliveryDate: '2026-08-22',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-11',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-RL-3301',
      description: 'Romaine Lettuce — Hearts',
      sku: 'SKU-RL-2210',
      orderedQty: 1800,
      confirmedQty: 1800,
      unit: 'Cases',
      unitPrice: 18.5,
      currency: 'USD',
      shelfLifeDays: 12,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 2700,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Romaine Lettuce',
        materialNumber: 'MAT-RL-3301',
        description: 'Romaine Lettuce — Hearts',
        sku: 'SKU-RL-2210',
        orderedQty: 1800,
        confirmedQty: 1800,
        unit: 'Cases',
        unitPrice: 18.5,
        currency: 'USD',
        shelfLifeDays: 12,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-V',
        netWeightKg: 2700,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0815',
      containerNumber: 'TCLU9920188',
      shipDate: '2026-08-14',
      eta: 'Aug 24, 2026 (+2 days delay)',
      originalEta: 'Aug 22, 2026',
      origin: 'Salinas, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Midwest Reefer Lines',
      bookingNumber: 'TCLU-9920188',
      sealNumber: 'SL-9920188',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–4°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500022101',
          item: 'Romaine Lettuce — Hearts',
          quantity: 1800,
          unit: 'Cases',
          lotNumber: 'LOT-RL-0814-A',
          harvestDate: '2026-08-12',
          bestBefore: '2026-08-24',
          palletCount: 36,
          grossWeightKg: 2700,
        },
      ],
    },
  },
  {
    po: 'PO-4500022110',
    item: 'Broccoli',
    supplier: 'Green Valley Produce',
    orderedQty: 950,
    unit: 'Cases',
    deliveryDate: '2026-08-20',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-12',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-BR-4401',
      description: 'Broccoli Crowns — Iceless',
      sku: 'SKU-BR-2110',
      orderedQty: 950,
      confirmedQty: 950,
      unit: 'Cases',
      unitPrice: 22.0,
      currency: 'USD',
      shelfLifeDays: 10,
      storageTemp: '0–2°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 1425,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Broccoli',
        materialNumber: 'MAT-BR-4401',
        description: 'Broccoli Crowns — Iceless',
        sku: 'SKU-BR-2110',
        orderedQty: 950,
        confirmedQty: 950,
        unit: 'Cases',
        unitPrice: 22.0,
        currency: 'USD',
        shelfLifeDays: 10,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-V',
        netWeightKg: 1425,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0818',
      containerNumber: 'FGRU7700442',
      shipDate: '2026-08-16',
      eta: 'Aug 19, 2026 (−1 day)',
      originalEta: 'Aug 20, 2026',
      origin: 'Yuma, AZ',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'FreshGuard Midwest',
      bookingNumber: 'FGRU-7700442',
      sealNumber: 'SL-7700442',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–2°C continuous',
      freightForwarder: 'FreshGuard Logistics',
      cargoLines: [
        {
          poNumber: 'PO-4500022110',
          item: 'Broccoli Crowns — Iceless',
          quantity: 950,
          unit: 'Cases',
          lotNumber: 'LOT-BR-0816-A',
          harvestDate: '2026-08-14',
          bestBefore: '2026-08-24',
          palletCount: 19,
          grossWeightKg: 1425,
        },
      ],
    },
  },
  {
    po: 'PO-4500022120',
    item: 'Baby Spinach',
    supplier: 'Coastal Greens Co.',
    orderedQty: 720,
    unit: 'Cases',
    deliveryDate: '2026-08-21',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-13',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-SP-2201',
      description: 'Baby Spinach — Clamshell',
      sku: 'SKU-SP-2120',
      orderedQty: 720,
      confirmedQty: 720,
      unit: 'Cases',
      unitPrice: 24.0,
      currency: 'USD',
      shelfLifeDays: 8,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 720,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Baby Spinach',
        materialNumber: 'MAT-SP-2201',
        description: 'Baby Spinach — Clamshell',
        sku: 'SKU-SP-2120',
        orderedQty: 720,
        confirmedQty: 720,
        unit: 'Cases',
        unitPrice: 24.0,
        currency: 'USD',
        shelfLifeDays: 8,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-V',
        netWeightKg: 720,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0819',
      containerNumber: 'MSCU8810233',
      shipDate: '2026-08-15',
      eta: 'Aug 22, 2026 (+1 day delay)',
      originalEta: 'Aug 21, 2026',
      origin: 'Salinas, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Midwest Reefer Lines',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–4°C continuous',
      cargoLines: [
        {
          poNumber: 'PO-4500022120',
          item: 'Baby Spinach — Clamshell',
          quantity: 720,
          unit: 'Cases',
          lotNumber: 'LOT-SP-0815',
          harvestDate: '2026-08-13',
          bestBefore: '2026-08-21',
          palletCount: 14,
          grossWeightKg: 720,
        },
      ],
    },
  },
  {
    po: 'PO-4500022125',
    item: 'Roma Tomatoes',
    supplier: 'Sunbelt Produce',
    orderedQty: 1400,
    unit: 'Cases',
    deliveryDate: '2026-08-22',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-12',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-TM-3301',
      description: 'Roma Tomatoes — Vine Ripened',
      sku: 'SKU-TM-2125',
      orderedQty: 1400,
      confirmedQty: 1400,
      unit: 'Cases',
      unitPrice: 16.5,
      currency: 'USD',
      shelfLifeDays: 9,
      storageTemp: '10–12°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 2100,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Roma Tomatoes',
        materialNumber: 'MAT-TM-3301',
        description: 'Roma Tomatoes — Vine Ripened',
        sku: 'SKU-TM-2125',
        orderedQty: 1400,
        confirmedQty: 1400,
        unit: 'Cases',
        unitPrice: 16.5,
        currency: 'USD',
        shelfLifeDays: 9,
        storageTemp: '10–12°C',
        storageLocation: 'CH01-V',
        netWeightKg: 2100,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0820',
      containerNumber: 'HLXU5590144',
      shipDate: '2026-08-14',
      eta: 'Aug 25, 2026 (+3 days)',
      originalEta: 'Aug 22, 2026',
      origin: 'Immokalee, FL',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'FreshGuard Midwest',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '10–12°C continuous',
      cargoLines: [
        {
          poNumber: 'PO-4500022125',
          item: 'Roma Tomatoes — Vine Ripened',
          quantity: 1400,
          unit: 'Cases',
          lotNumber: 'LOT-TM-0814',
          harvestDate: '2026-08-12',
          bestBefore: '2026-08-21',
          palletCount: 28,
          grossWeightKg: 2100,
        },
      ],
    },
  },
  {
    po: 'PO-4500022130',
    item: 'Cucumbers',
    supplier: 'Imperial Valley Greens',
    orderedQty: 1100,
    unit: 'Cases',
    deliveryDate: '2026-08-21',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-13',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-CU-4401',
      description: 'English Cucumbers — Film Wrapped',
      sku: 'SKU-CU-2130',
      orderedQty: 1100,
      confirmedQty: 1100,
      unit: 'Cases',
      unitPrice: 14.0,
      currency: 'USD',
      shelfLifeDays: 11,
      storageTemp: '10–12°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 1100,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Cucumbers',
        materialNumber: 'MAT-CU-4401',
        description: 'English Cucumbers — Film Wrapped',
        sku: 'SKU-CU-2130',
        orderedQty: 1100,
        confirmedQty: 1100,
        unit: 'Cases',
        unitPrice: 14.0,
        currency: 'USD',
        shelfLifeDays: 11,
        storageTemp: '10–12°C',
        storageLocation: 'CH01-V',
        netWeightKg: 1100,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0821',
      containerNumber: 'CAIU6601288',
      shipDate: '2026-08-16',
      eta: 'Aug 20, 2026 (−2 days)',
      originalEta: 'Aug 22, 2026',
      origin: 'El Centro, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Desert Haul Reefer',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '10–12°C continuous',
      cargoLines: [
        {
          poNumber: 'PO-4500022130',
          item: 'English Cucumbers — Film Wrapped',
          quantity: 1100,
          unit: 'Cases',
          lotNumber: 'LOT-CU-0816',
          harvestDate: '2026-08-14',
          bestBefore: '2026-08-25',
          palletCount: 22,
          grossWeightKg: 1100,
        },
      ],
    },
  },
  {
    po: 'PO-4500022135',
    item: 'Iceberg Lettuce',
    supplier: 'Green Valley Produce',
    orderedQty: 1600,
    unit: 'Cases',
    deliveryDate: '2026-08-22',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-14',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-IL-5501',
      description: 'Iceberg Lettuce — 24ct',
      sku: 'SKU-IL-2135',
      orderedQty: 1600,
      confirmedQty: 1600,
      unit: 'Cases',
      unitPrice: 15.75,
      currency: 'USD',
      shelfLifeDays: 14,
      storageTemp: '0–4°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 1920,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Iceberg Lettuce',
        materialNumber: 'MAT-IL-5501',
        description: 'Iceberg Lettuce — 24ct',
        sku: 'SKU-IL-2135',
        orderedQty: 1600,
        confirmedQty: 1600,
        unit: 'Cases',
        unitPrice: 15.75,
        currency: 'USD',
        shelfLifeDays: 14,
        storageTemp: '0–4°C',
        storageLocation: 'CH01-V',
        netWeightKg: 1920,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0822',
      containerNumber: 'TGHU7720399',
      shipDate: '2026-08-17',
      eta: 'Aug 22, 2026',
      originalEta: 'Aug 22, 2026',
      origin: 'Salinas, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Midwest Reefer Lines',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–4°C continuous',
      cargoLines: [
        {
          poNumber: 'PO-4500022135',
          item: 'Iceberg Lettuce — 24ct',
          quantity: 1600,
          unit: 'Cases',
          lotNumber: 'LOT-IL-0817',
          harvestDate: '2026-08-15',
          bestBefore: '2026-08-29',
          palletCount: 32,
          grossWeightKg: 1920,
        },
      ],
    },
  },
  {
    po: 'PO-4500022140',
    item: 'Cauliflower',
    supplier: 'Coastal Greens Co.',
    orderedQty: 840,
    unit: 'Cases',
    deliveryDate: '2026-08-23',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-15',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-CF-6601',
      description: 'Cauliflower — 9ct Wrapped',
      sku: 'SKU-CF-2140',
      orderedQty: 840,
      confirmedQty: 840,
      unit: 'Cases',
      unitPrice: 20.0,
      currency: 'USD',
      shelfLifeDays: 12,
      storageTemp: '0–2°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 1260,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Cauliflower',
        materialNumber: 'MAT-CF-6601',
        description: 'Cauliflower — 9ct Wrapped',
        sku: 'SKU-CF-2140',
        orderedQty: 840,
        confirmedQty: 840,
        unit: 'Cases',
        unitPrice: 20.0,
        currency: 'USD',
        shelfLifeDays: 12,
        storageTemp: '0–2°C',
        storageLocation: 'CH01-V',
        netWeightKg: 1260,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0823',
      containerNumber: 'FGRU8830155',
      shipDate: '2026-08-18',
      eta: 'Aug 23, 2026',
      originalEta: 'Aug 23, 2026',
      origin: 'Santa Maria, CA',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'FreshGuard Midwest',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '0–2°C continuous',
      cargoLines: [
        {
          poNumber: 'PO-4500022140',
          item: 'Cauliflower — 9ct Wrapped',
          quantity: 840,
          unit: 'Cases',
          lotNumber: 'LOT-CF-0818',
          harvestDate: '2026-08-16',
          bestBefore: '2026-08-28',
          palletCount: 17,
          grossWeightKg: 1260,
        },
      ],
    },
  },
  {
    po: 'PO-4500022145',
    item: 'Bell Peppers',
    supplier: 'Sunbelt Produce',
    orderedQty: 1250,
    unit: 'Cases',
    deliveryDate: '2026-08-24',
    status: 'In Transit',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer: 'David Okonkwo',
    createdDate: '2026-08-16',
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: 'MAT-BP-7701',
      description: 'Tri-Color Bell Peppers',
      sku: 'SKU-BP-2145',
      orderedQty: 1250,
      confirmedQty: 1250,
      unit: 'Cases',
      unitPrice: 26.0,
      currency: 'USD',
      shelfLifeDays: 10,
      storageTemp: '7–10°C',
      plant: 'PL-CHI-01',
      storageLocation: 'CH01-V',
      netWeightKg: 1875,
      countryOfOrigin: 'USA',
    },
    orderLines: [
      {
        lineNumber: 10,
        item: 'Bell Peppers',
        materialNumber: 'MAT-BP-7701',
        description: 'Tri-Color Bell Peppers',
        sku: 'SKU-BP-2145',
        orderedQty: 1250,
        confirmedQty: 1250,
        unit: 'Cases',
        unitPrice: 26.0,
        currency: 'USD',
        shelfLifeDays: 10,
        storageTemp: '7–10°C',
        storageLocation: 'CH01-V',
        netWeightKg: 1875,
        countryOfOrigin: 'USA',
      },
    ],
    shipmentDetail: {
      asnNumber: 'ASN-2026-VG-0824',
      containerNumber: 'TRHU9940266',
      shipDate: '2026-08-19',
      eta: 'Aug 24, 2026',
      originalEta: 'Aug 24, 2026',
      origin: 'Nogales, AZ',
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Desert Haul Reefer',
      incoterms: 'DAP Chicago DC',
      customsStatus: 'Cleared',
      tempRange: '7–10°C continuous',
      cargoLines: [
        {
          poNumber: 'PO-4500022145',
          item: 'Tri-Color Bell Peppers',
          quantity: 1250,
          unit: 'Cases',
          lotNumber: 'LOT-BP-0819',
          harvestDate: '2026-08-17',
          bestBefore: '2026-08-27',
          palletCount: 25,
          grossWeightKg: 1875,
        },
      ],
    },
  },
];

export const DEMO_SHIPMENTS: TrackShipment[] = [
  {
    id: 'SHP-BB-DLY-01',
    purchasingLane: 'fruits',
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
    purchasingLane: 'fruits',
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
    id: 'SHP-ST-EARLY-02',
    purchasingLane: 'fruits',
    containerNumber: 'CAIU4402188',
    asnNumber: 'ASN-2026-ST-0812',
    linkedPos: ['PO-4500012395'],
    item: 'Strawberries',
    supplier: SUPPLIER,
    quantity: 600,
    unit: 'Cases',
    eventStatus: 'early',
    eta: 'Aug 20, 2026 (−2 days)',
    originalEta: 'Aug 22, 2026',
    origin: 'Oxnard, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-BB-ONT-01',
    purchasingLane: 'fruits',
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
  {
    id: 'SHP-BB-MIX-01',
    purchasingLane: 'fruits',
    containerNumber: 'HLXU5520198',
    asnNumber: 'ASN-2026-BB-0810',
    linkedPos: ['PO-4500012401', 'PO-4500012402'],
    item: 'Blueberries + Strawberries (7-line POs)',
    supplier: SUPPLIER,
    quantity: 6450,
    unit: 'Cases',
    eventStatus: 'delayed',
    eta: 'Aug 25, 2026 (+1 day)',
    originalEta: 'Aug 24, 2026',
    origin: 'Valparaíso, Chile',
    destination: 'Chicago DC',
    customsStatus: 'Pending',
    stage: 'ocean',
    transportMode: 'ocean',
  },
  {
    id: 'SHP-BB-RCV-01',
    purchasingLane: 'fruits',
    containerNumber: 'TGHU6633812',
    asnNumber: 'ASN-2026-BB-0805',
    linkedPos: ['PO-4500012403'],
    item: 'Blueberries (5-line received)',
    supplier: SUPPLIER,
    quantity: 2200,
    unit: 'Cases',
    eventStatus: 'on-time',
    eta: 'Aug 18, 2026',
    originalEta: 'Aug 18, 2026',
    origin: 'Watsonville, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'delivered',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-DLY-01',
    purchasingLane: 'vegetables',
    containerNumber: 'TCLU9920188',
    asnNumber: 'ASN-2026-VG-0815',
    linkedPos: ['PO-4500022101'],
    item: 'Romaine Lettuce — Hearts',
    supplier: 'Green Valley Produce',
    quantity: 1800,
    unit: 'Cases',
    eventStatus: 'delayed',
    eta: 'Aug 24, 2026 (+2 days)',
    originalEta: 'Aug 22, 2026',
    origin: 'Salinas, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-EARLY-01',
    purchasingLane: 'vegetables',
    containerNumber: 'FGRU7700442',
    asnNumber: 'ASN-2026-VG-0818',
    linkedPos: ['PO-4500022110'],
    item: 'Broccoli Crowns — Iceless',
    supplier: 'Green Valley Produce',
    quantity: 950,
    unit: 'Cases',
    eventStatus: 'early',
    eta: 'Aug 19, 2026 (−1 day)',
    originalEta: 'Aug 20, 2026',
    origin: 'Yuma, AZ',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-DLY-02',
    purchasingLane: 'vegetables',
    containerNumber: 'MSCU8810233',
    asnNumber: 'ASN-2026-VG-0819',
    linkedPos: ['PO-4500022120'],
    item: 'Baby Spinach — Clamshell',
    supplier: 'Coastal Greens Co.',
    quantity: 720,
    unit: 'Cases',
    eventStatus: 'delayed',
    eta: 'Aug 22, 2026 (+1 day)',
    originalEta: 'Aug 21, 2026',
    origin: 'Salinas, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-DLY-03',
    purchasingLane: 'vegetables',
    containerNumber: 'HLXU5590144',
    asnNumber: 'ASN-2026-VG-0820',
    linkedPos: ['PO-4500022125'],
    item: 'Roma Tomatoes — Vine Ripened',
    supplier: 'Sunbelt Produce',
    quantity: 1400,
    unit: 'Cases',
    eventStatus: 'delayed',
    eta: 'Aug 25, 2026 (+3 days)',
    originalEta: 'Aug 22, 2026',
    origin: 'Immokalee, FL',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-EARLY-02',
    purchasingLane: 'vegetables',
    containerNumber: 'CAIU6601288',
    asnNumber: 'ASN-2026-VG-0821',
    linkedPos: ['PO-4500022130'],
    item: 'English Cucumbers — Film Wrapped',
    supplier: 'Imperial Valley Greens',
    quantity: 1100,
    unit: 'Cases',
    eventStatus: 'early',
    eta: 'Aug 20, 2026 (−2 days)',
    originalEta: 'Aug 22, 2026',
    origin: 'El Centro, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-ONT-01',
    purchasingLane: 'vegetables',
    containerNumber: 'TGHU7720399',
    asnNumber: 'ASN-2026-VG-0822',
    linkedPos: ['PO-4500022135'],
    item: 'Iceberg Lettuce — 24ct',
    supplier: 'Green Valley Produce',
    quantity: 1600,
    unit: 'Cases',
    eventStatus: 'on-time',
    eta: 'Aug 22, 2026',
    originalEta: 'Aug 22, 2026',
    origin: 'Salinas, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-ONT-02',
    purchasingLane: 'vegetables',
    containerNumber: 'FGRU8830155',
    asnNumber: 'ASN-2026-VG-0823',
    linkedPos: ['PO-4500022140'],
    item: 'Cauliflower — 9ct Wrapped',
    supplier: 'Coastal Greens Co.',
    quantity: 840,
    unit: 'Cases',
    eventStatus: 'on-time',
    eta: 'Aug 23, 2026',
    originalEta: 'Aug 23, 2026',
    origin: 'Santa Maria, CA',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'inland',
    transportMode: 'road',
  },
  {
    id: 'SHP-VEG-ONT-03',
    purchasingLane: 'vegetables',
    containerNumber: 'TRHU9940266',
    asnNumber: 'ASN-2026-VG-0824',
    linkedPos: ['PO-4500022145'],
    item: 'Tri-Color Bell Peppers',
    supplier: 'Sunbelt Produce',
    quantity: 1250,
    unit: 'Cases',
    eventStatus: 'on-time',
    eta: 'Aug 24, 2026',
    originalEta: 'Aug 24, 2026',
    origin: 'Nogales, AZ',
    destination: 'Chicago DC',
    customsStatus: 'Cleared',
    stage: 'customs',
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
  {
    dcId: 'DC-CHI-01',
    name: 'Chicago DC',
    item: 'Romaine Lettuce',
    availableStock: 140,
    dailyDispatchRate: 88,
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
    deliveryDate: '2026-08-21',
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
    deliveryDate: '2026-08-20',
    item: 'Strawberries',
  },
  {
    storeId: 'ST-205',
    name: 'River North',
    onHand: 54,
    dailyDemand: 20,
    pendingOrders: 70,
    daysCover: 2.7,
    stockoutRiskDays: null,
    oosStartDate: null,
    oosEndDate: null,
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    deliveryDate: '2026-08-21',
    item: 'Strawberries',
  },
  {
    storeId: 'ST-206',
    name: 'Hyde Park',
    onHand: 40,
    dailyDemand: 18,
    pendingOrders: 65,
    daysCover: 2.2,
    stockoutRiskDays: null,
    oosStartDate: null,
    oosEndDate: null,
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    deliveryDate: '2026-08-22',
    item: 'Strawberries',
  },
  {
    storeId: 'ST-207',
    name: 'South Loop',
    onHand: 62,
    dailyDemand: 24,
    pendingOrders: 90,
    daysCover: 2.6,
    stockoutRiskDays: null,
    oosStartDate: null,
    oosEndDate: null,
    onHandShelfLifeDays: 3,
    onHandExpiresDate: '2026-08-24',
    deliveryDate: '2026-08-19',
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
    deliveryDate: '2026-08-22',
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
    deliveryDate: '2026-08-20',
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
  deliveryDate: '2026-08-21',
  item: 'Blueberries',
});

STORE_DEMAND.push(
  {
    storeId: 'ST-101',
    name: 'Loop Market',
    onHand: 22,
    dailyDemand: 32,
    pendingOrders: 110,
    daysCover: 0.7,
    stockoutRiskDays: 1,
    oosStartDate: '2026-08-23',
    oosEndDate: '2026-08-25',
    onHandShelfLifeDays: 4,
    onHandExpiresDate: '2026-08-24',
    item: 'Romaine Lettuce',
  },
  {
    storeId: 'ST-318',
    name: 'Oak Park',
    onHand: 18,
    dailyDemand: 26,
    pendingOrders: 90,
    daysCover: 0.7,
    stockoutRiskDays: 1,
    oosStartDate: '2026-08-23',
    oosEndDate: '2026-08-25',
    onHandShelfLifeDays: 4,
    onHandExpiresDate: '2026-08-24',
    item: 'Romaine Lettuce',
  },
  {
    storeId: 'ST-204',
    name: 'Lincoln Park',
    onHand: 95,
    dailyDemand: 20,
    pendingOrders: 70,
    daysCover: 4.8,
    stockoutRiskDays: null,
    oosStartDate: null,
    oosEndDate: null,
    onHandShelfLifeDays: 5,
    onHandExpiresDate: '2026-08-25',
    item: 'Romaine Lettuce',
  }
);


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
  {
    id: 'PROMO-950',
    name: 'Salad Bowl Bundle',
    item: 'Romaine Lettuce',
    startDate: '2026-08-22',
    endDate: '2026-08-24',
    stores: ['ST-101', 'ST-318'],
    dependsOnPo: 'PO-4500022101',
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
  'SHP-ST-EARLY-02': { original: '2026-08-22', revised: '2026-08-20' },
  'SHP-BB-ONT-01': { original: '2026-08-21', revised: '2026-08-21' },
  'SHP-BB-MIX-01': { original: '2026-08-24', revised: '2026-08-25' },
  'SHP-BB-RCV-01': { original: '2026-08-18', revised: '2026-08-18' },
  'SHP-VEG-DLY-01': { original: '2026-08-22', revised: '2026-08-24' },
  'SHP-VEG-DLY-02': { original: '2026-08-21', revised: '2026-08-22' },
  'SHP-VEG-DLY-03': { original: '2026-08-22', revised: '2026-08-25' },
  'SHP-VEG-EARLY-01': { original: '2026-08-20', revised: '2026-08-19' },
  'SHP-VEG-EARLY-02': { original: '2026-08-22', revised: '2026-08-20' },
  'SHP-VEG-ONT-01': { original: '2026-08-22', revised: '2026-08-22' },
  'SHP-VEG-ONT-02': { original: '2026-08-23', revised: '2026-08-23' },
  'SHP-VEG-ONT-03': { original: '2026-08-24', revised: '2026-08-24' },
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
  'SHP-ST-EARLY-02': ['Strawberries'],
  'SHP-BB-ONT-01': ['Blueberries'],
  'SHP-BB-MIX-01': ['Blueberries', 'Strawberries'],
  'SHP-BB-RCV-01': ['Blueberries'],
  'SHP-VEG-DLY-01': ['Romaine Lettuce'],
  'SHP-VEG-DLY-02': ['Baby Spinach'],
  'SHP-VEG-DLY-03': ['Roma Tomatoes'],
  'SHP-VEG-EARLY-01': ['Broccoli'],
  'SHP-VEG-EARLY-02': ['Cucumbers'],
  'SHP-VEG-ONT-01': ['Iceberg Lettuce'],
  'SHP-VEG-ONT-02': ['Cauliflower'],
  'SHP-VEG-ONT-03': ['Bell Peppers'],
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
  if (shipment.eventStatus === 'early') return -1;
  if (shipment.eventStatus !== 'delayed') return 0;
  const eta = getShipmentEtaIso(shipment);
  const delta = daysBetween(eta.original, eta.revised);
  return Math.max(1, delta);
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

/** Monday–Sunday calendar week that contains `iso` (YYYY-MM-DD). */
export function isoWeekBounds(iso: string): { start: string; end: string } {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function formatWeekLabel(start: string, end: string): string {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${a.toLocaleDateString('en-US', opts)}–${b.toLocaleDateString('en-US', opts)}`;
}

/** Stores with a delivery order dated in the week of Original ETA (same item as the PO). */
export function getStoresWithDeliveryInOriginalEtaWeek(
  item: string,
  originalEta: string
): StoreDemand[] {
  const { start, end } = isoWeekBounds(originalEta.slice(0, 10));
  const itemMatch = (sItem: string) =>
    sItem === item ||
    sItem.startsWith(item) ||
    item.startsWith(sItem) ||
    sItem.includes(item) ||
    item.includes(sItem);
  return STORE_DEMAND.filter((s) => {
    if (!itemMatch(s.item)) return false;
    if (!s.deliveryDate || s.pendingOrders <= 0) return false;
    const d = s.deliveryDate.slice(0, 10);
    return d >= start && d <= end;
  }).sort((a, b) => (a.deliveryDate ?? '').localeCompare(b.deliveryDate ?? ''));
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
  if (!stores.length) {
    return {
      storeName: '—',
      daysLeft: 3,
      stockoutDate: addDaysIso(DEMO_TODAY, 3),
      onHandShelfLifeDays: 5,
      onHandExpiresDate: addDaysIso(DEMO_TODAY, 5),
    };
  }
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
export type PoAffectedStore = {
  storeId: string;
  storeName: string;
  /** Short affect line, e.g. "1d OOS" or delivery date. */
  affect: string;
  /** Store delivery-order date when in Original ETA week. */
  deliveryDate?: string;
};

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
  /** Early arrival: stores that need push / space notice. */
  earlyStoresImpacted: number;
  earlyCasesToPush: number;
  /**
   * Stores with a delivery order in the calendar week of Original ETA.
   * Primary risk count for delay / early impact.
   */
  storesWithDeliveryOrders: number;
  /** Mon–Sun bounds of the Original ETA week (ISO dates). */
  originalEtaWeekStart: string;
  originalEtaWeekEnd: string;
  /** Named stores impacted — delivery-week stores first. */
  affectedStores: PoAffectedStore[];
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

/** PO status follows the physical shipment so the badge can never contradict the ETA. */
export function getPoDisplayStatus(po: SapPurchaseOrder): SapPurchaseOrder['status'] {
  const shipment = getShipmentForPo(po);
  if (!shipment) return po.status === 'Received' ? 'Received' : po.status;
  if (shipment.stage === 'delivered') return 'Received';
  if (shipment.stage === 'origin') return 'ASN Submitted';
  return 'In Transit';
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
  const itemMatch = (item: string) =>
    item === po.item ||
    item.startsWith(po.item) ||
    po.item.startsWith(item) ||
    item.includes(po.item) ||
    po.item.includes(item);
  const itemStores = stock.storeOrders.filter((s) => itemMatch(s.item));
  const itemMoves = stock.moves.filter((m) => itemMatch(m.item));

  const week = isoWeekBounds(original.slice(0, 10));
  const deliveryWeekStores = getStoresWithDeliveryInOriginalEtaWeek(po.item, original);
  const storesWithDeliveryOrders = deliveryWeekStores.length;

  const overstock =
    shipment.eventStatus === 'early' ? buildOverstockProposal(shipment) : null;
  const earlyPushes = (overstock?.storePushes ?? []).filter((s) => itemMatch(s.item));

  const promos = getPromotionsForShipment(shipment).filter((p) => p.dependsOnPo === po.po);
  const promoStoreChanges = promos.length
    ? buildPromotionRiskProposal(shipment).storeChanges.filter((c) =>
        promos.some((p) => p.id === c.promoId)
      ).length
    : 0;

  const storesAtRisk = itemStores.filter((s) => s.stockoutRiskDays != null).length;
  const earlyStoresImpacted =
    earlyPushes.length > 0 ? earlyPushes.length : storesWithDeliveryOrders;

  const affectedStores: PoAffectedStore[] = deliveryWeekStores.map((s) => {
    const oos =
      s.stockoutRiskDays != null ? ` · ${s.stockoutRiskDays}d OOS` : '';
    const early =
      shipment.eventStatus === 'early' ? ' · early inbound' : '';
    return {
      storeId: s.storeId,
      storeName: s.name,
      deliveryDate: s.deliveryDate ?? undefined,
      affect: `Delivery ${s.deliveryDate}${oos}${early} · ${s.pendingOrders.toLocaleString()} cases`,
    };
  });

  const earlyCasesToPush =
    earlyPushes.length > 0
      ? earlyPushes.reduce((n, s) => n + s.cases, 0)
      : deliveryWeekStores.reduce((n, s) => n + s.pendingOrders, 0);

  const severity: PoRiskImpact['severity'] =
    shipment.eventStatus === 'delayed' &&
    (oosGapDays > 0 || storesAtRisk > 0 || storesWithDeliveryOrders > 0)
      ? 'high'
      : shipment.eventStatus === 'on-time'
        ? 'none'
        : 'watch';

  const weekLbl = formatWeekLabel(week.start, week.end);
  const headline =
    shipment.eventStatus === 'delayed'
      ? `${delayDays}d late — ${storesWithDeliveryOrders} store${storesWithDeliveryOrders === 1 ? '' : 's'} with delivery in week of original ETA (${weekLbl})${oosGapDays > 0 ? ` · ${oosGapDays}d OOS` : ''}`
      : shipment.eventStatus === 'early'
        ? `${Math.abs(delayDays)}d early — ${storesWithDeliveryOrders} store${storesWithDeliveryOrders === 1 ? '' : 's'} with delivery in week of original ETA (${weekLbl})`
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
    storesAtRisk,
    storesTotal: itemStores.length,
    moveCount: itemMoves.length,
    casesToMove: itemMoves.reduce((n, m) => n + m.cases, 0),
    earlyStoresImpacted,
    earlyCasesToPush,
    storesWithDeliveryOrders,
    originalEtaWeekStart: week.start,
    originalEtaWeekEnd: week.end,
    affectedStores,
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

/** Demo throughput assumptions used to size dock crew and truck bookings. */
const CASES_PER_PALLET = 50;
const CASES_PER_FTE_HOUR = 120;
const DOCK_SHIFT_HOURS = 8;
const CASES_PER_TRUCK = 1200;

export type ResourceStep = {
  id: string;
  action: string;
  detail: string;
  when: string;
};

export type ReceivingImpact = {
  delayDays: number;
  plannedSlot: string;
  revisedSlot: string;
  cases: number;
  pallets: number;
  crewFte: number;
  unloadHours: number;
  freedCrewHours: number;
  doorId: string;
  steps: ResourceStep[];
  /** Early + overstock: pallets that fit chilled slots */
  putAwayPallets?: number;
  /** Early + overstock: pallets flagged for cross-dock / early store push */
  crossDockPallets?: number;
  /** Early + overstock: cases that must not sit in DC */
  crossDockCases?: number;
  hasStorageCapacity?: boolean;
  capacityNote?: string;
};

export type TruckReassignment = {
  shipmentId: string;
  containerNumber: string;
  item: string;
  date: string;
  trucks: number;
  reason: string;
};

export type StoreHaulLeg = {
  storeId: string;
  storeName: string;
  item: string;
  cases: number;
  trucks: number;
  reason: string;
};

export type TransportImpact = {
  delayDays: number;
  plannedPickup: string;
  revisedPickup: string;
  cases: number;
  trucksBooked: number;
  trucksReassigned: number;
  idleTruckDays: number;
  reassignments: TruckReassignment[];
  steps: ResourceStep[];
  /** Early + capacity short: extra outbound reefers for store push */
  storeHaulTrucks?: number;
  storeHaulCases?: number;
  storeHaulLegs?: StoreHaulLeg[];
  hasStorageCapacity?: boolean;
  capacityNote?: string;
};

function getDockDoor(shipment: TrackShipment): string {
  const idx = DEMO_SHIPMENTS.findIndex((s) => s.id === shipment.id);
  return `D-${(idx < 0 ? 0 : idx) + 1}`;
}

export function buildReceivingImpact(shipment: TrackShipment): ReceivingImpact {
  const { original, revised } = getShipmentEtaIso(shipment);
  const delayDays = daysBetween(original, revised);
  const cases = shipment.quantity;
  const pallets = Math.ceil(cases / CASES_PER_PALLET);
  const crewFte = Math.min(12, Math.max(2, Math.ceil(cases / (CASES_PER_FTE_HOUR * DOCK_SHIFT_HOURS))));
  const unloadHours = Math.max(1, Math.round((cases / (CASES_PER_FTE_HOUR * crewFte)) * 10) / 10);
  const doorId = getDockDoor(shipment);
  const late = delayDays > 0;
  const early = delayDays < 0;

  let putAwayPallets: number | undefined;
  let crossDockPallets: number | undefined;
  let crossDockCases: number | undefined;
  let hasStorageCapacity: boolean | undefined;
  let capacityNote: string | undefined;

  let steps: ResourceStep[];

  if (late) {
    steps = [
      {
        id: 'release-crew',
        action: `Stand down ${crewFte} FTE on ${original}`,
        detail: `Nothing to unload on the planned date — redeploy the crew to putaway backlog or another inbound door.`,
        when: original,
      },
      {
        id: 'rebook-slot',
        action: `Rebook door ${doorId} for ${revised}`,
        detail: `${crewFte} FTE for ~${unloadHours}h to move ${pallets} pallets (${cases.toLocaleString()} cases).`,
        when: revised,
      },
      {
        id: 'qc-window',
        action: 'Book QC straight after unload',
        detail: 'Shelf-life clock already lost days in transit — no overnight wait before inspection.',
        when: revised,
      },
    ];
  } else if (early) {
    const overstock = buildOverstockProposal(shipment);
    hasStorageCapacity = overstock.hasStorageCapacity;
    putAwayPallets = Math.min(overstock.freePalletSlots, pallets);
    crossDockPallets = Math.max(0, pallets - putAwayPallets);
    crossDockCases = crossDockPallets * CASES_PER_PALLET;
    capacityNote = overstock.hasStorageCapacity
      ? `Capacity OK — put away all ${pallets} pallets into ${overstock.bayLabel}.`
      : `Overstock: only ${putAwayPallets} pallets fit chilled slots; flag ${crossDockPallets} pallets (${crossDockCases.toLocaleString()} cases) for cross-dock / early store push — do not put away into overflow.`;

    steps = overstock.hasStorageCapacity
      ? [
          {
            id: 'advance-crew',
            action: `Pull ${crewFte} FTE forward to ${revised}`,
            detail: `Early gate-in at door ${doorId} — ~${unloadHours}h for ${pallets} pallets (BAU put-away).`,
            when: revised,
          },
          {
            id: 'put-away-all',
            action: `Put away all ${pallets} pallets to ${overstock.bayLabel}`,
            detail: `${overstock.freePalletSlots} free slots cover inbound — no cross-dock required.`,
            when: revised,
          },
          {
            id: 'qc-bau',
            action: 'QC then FEFO put-away',
            detail: 'Ageing on-hand stays on FEFO; new batch behind it within max DC hold.',
            when: revised,
          },
        ]
      : [
          {
            id: 'advance-crew',
            action: `Pull ${crewFte} FTE forward to ${revised}`,
            detail: `Early arrival — door ${doorId} for ~${unloadHours}h on ${pallets} inbound pallets.`,
            when: revised,
          },
          {
            id: 'split-putaway',
            action: `Put away only ${putAwayPallets} pallets (${overstock.freePalletSlots} free slots)`,
            detail: `${overstock.bayLabel} at ${overstock.capacityPct}% — do not force remaining into overflow chill.`,
            when: revised,
          },
          {
            id: 'cross-dock',
            action: `Flag ${crossDockPallets} pallets (${crossDockCases.toLocaleString()} cases) for cross-dock`,
            detail:
              'Stage on dock for immediate store haul — same-day early replenishment per overstock plan.',
            when: revised,
          },
          {
            id: 'notify-dist',
            action: 'Hand off cross-dock list to distribution & transport',
            detail: 'Receiving must not leave overflow on ambient dock overnight.',
            when: revised,
          },
        ];
  } else {
    steps = [
      {
        id: 'advance-crew',
        action: `Crew ${crewFte} FTE on ${revised}`,
        detail: `Unload ${pallets} pallets at door ${doorId}.`,
        when: revised,
      },
    ];
  }

  return {
    delayDays,
    plannedSlot: original,
    revisedSlot: revised,
    cases,
    pallets,
    crewFte,
    unloadHours,
    freedCrewHours: late ? crewFte * DOCK_SHIFT_HOURS : 0,
    doorId,
    steps,
    putAwayPallets,
    crossDockPallets,
    crossDockCases,
    hasStorageCapacity,
    capacityNote,
  };
}

export function buildTransportImpact(shipment: TrackShipment): TransportImpact {
  const { original, revised } = getShipmentEtaIso(shipment);
  const delayDays = daysBetween(original, revised);
  const cases = shipment.quantity;
  const trucksBooked = Math.max(1, Math.ceil(cases / CASES_PER_TRUCK));
  const late = delayDays > 0;
  const early = delayDays < 0;

  const reassignments: TruckReassignment[] = [];

  if (late) {
    // Trucks freed by the delay go to shipments already inbound in the original window.
    let remaining = trucksBooked;
    for (const other of DEMO_SHIPMENTS) {
      if (other.id === shipment.id || remaining <= 0) continue;
      const otherEta = getShipmentEtaIso(other).revised;
      if (daysBetween(otherEta, original) < -1) continue;
      const need = Math.max(1, Math.ceil(other.quantity / CASES_PER_TRUCK));
      const trucks = Math.min(need, remaining);
      remaining -= trucks;
      reassignments.push({
        shipmentId: other.id,
        containerNumber: other.containerNumber,
        item: other.item,
        date: otherEta,
        trucks,
        reason:
          other.eventStatus === 'early'
            ? 'Arriving early — needs haulage sooner than booked'
            : 'On-time load in the freed window',
      });
    }
  } else if (early) {
    // Early gate-in: pull reefers booked for later loads into this earlier window.
    let remaining = trucksBooked;
    for (const other of DEMO_SHIPMENTS) {
      if (other.id === shipment.id || remaining <= 0) continue;
      if (other.eventStatus === 'early') continue;
      const otherEta = getShipmentEtaIso(other).revised;
      if (daysBetween(revised, otherEta) < 0) continue;
      const need = Math.max(1, Math.ceil(other.quantity / CASES_PER_TRUCK));
      const trucks = Math.min(need, remaining);
      remaining -= trucks;
      reassignments.push({
        shipmentId: other.id,
        containerNumber: other.containerNumber,
        item: other.item,
        date: otherEta,
        trucks,
        reason: `Pull forward from ${otherEta} booking to cover early arrival ${revised}`,
      });
    }
  }

  const trucksReassigned = reassignments.reduce((n, r) => n + r.trucks, 0);

  let storeHaulTrucks: number | undefined;
  let storeHaulCases: number | undefined;
  let storeHaulLegs: StoreHaulLeg[] | undefined;
  let hasStorageCapacity: boolean | undefined;
  let capacityNote: string | undefined;

  let steps: ResourceStep[];

  if (late) {
    steps = [
      {
        id: 'release-drayage',
        action: `Release ${trucksBooked} reefers held for ${original}`,
        detail: `Container ${shipment.containerNumber} will not gate in — cancel before detention starts.`,
        when: original,
      },
      {
        id: 'reassign',
        action:
          trucksReassigned > 0
            ? `Reassign ${trucksReassigned} of them to inbound loads`
            : 'No inbound load to absorb the freed trucks',
        detail:
          trucksReassigned > 0
            ? reassignments
                .map((r) => `${r.trucks} → ${r.containerNumber} (${r.date})`)
                .join(' · ')
            : 'Park the assets rather than run them empty.',
        when: original,
      },
      {
        id: 'rebook-pickup',
        action: `Rebook pickup for ${revised}`,
        detail: 'Hold the booking until the carrier confirms the revised arrival.',
        when: revised,
      },
    ];
  } else if (early) {
    const overstock = buildOverstockProposal(shipment);
    hasStorageCapacity = overstock.hasStorageCapacity;
    capacityNote = overstock.hasStorageCapacity
      ? 'Capacity OK — only pull inbound haulage forward; no extra store routes.'
      : 'Overstock capacity short — add outbound reefers for cross-dock overflow to stores.';

    if (!overstock.hasStorageCapacity) {
      storeHaulLegs = overstock.storePushes.map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        item: s.item,
        cases: s.cases,
        trucks: Math.max(1, Math.ceil(s.cases / CASES_PER_TRUCK)),
        reason: s.reason,
      }));
      storeHaulCases = storeHaulLegs.reduce((n, l) => n + l.cases, 0);
      storeHaulTrucks = storeHaulLegs.reduce((n, l) => n + l.trucks, 0);
    }

    steps = overstock.hasStorageCapacity
      ? [
          {
            id: 'pull-forward',
            action: `Move inbound pickup to ${revised}`,
            detail: `${trucksBooked} reefers for ${shipment.containerNumber} — BAU put-away, no extra store haul.`,
            when: revised,
          },
          {
            id: 'borrow-assets',
            action:
              trucksReassigned > 0
                ? `Reschedule ${trucksReassigned} truck(s) from later shipments`
                : 'Confirm spare reefer for early gate-in',
            detail:
              trucksReassigned > 0
                ? reassignments
                    .map((r) => `${r.trucks} from ${r.containerNumber}`)
                    .join(' · ')
                : 'Yard pool if needed.',
            when: revised,
          },
        ]
      : [
          {
            id: 'pull-forward',
            action: `Move inbound pickup to ${revised}`,
            detail: `${trucksBooked} reefers for gate-in of ${shipment.containerNumber}.`,
            when: revised,
          },
          {
            id: 'store-haul',
            action: `Book ${storeHaulTrucks ?? 0} outbound reefer(s) for early store push`,
            detail: `${(storeHaulCases ?? 0).toLocaleString()} overflow cases cross-dock same day — do not leave on DC dock.`,
            when: revised,
          },
          {
            id: 'store-legs',
            action: 'Dispatch store routes from receiving cross-dock',
            detail:
              storeHaulLegs && storeHaulLegs.length
                ? storeHaulLegs
                    .map((l) => `${l.storeName}: ${l.cases} cases (${l.trucks} truck)`)
                    .join(' · ')
                : 'Await distribution store split.',
            when: revised,
          },
          {
            id: 'notify-dispatch',
            action: 'Notify transport dispatch & drivers',
            detail: 'Inbound pull-forward + outbound early replenishment must share the same gate-in window.',
            when: revised,
          },
        ];
  } else {
    steps = [
      {
        id: 'on-plan',
        action: `Pickup on ${revised}`,
        detail: `${trucksBooked} reefers as booked.`,
        when: revised,
      },
    ];
  }

  return {
    delayDays,
    plannedPickup: original,
    revisedPickup: revised,
    cases,
    trucksBooked,
    trucksReassigned,
    idleTruckDays: late ? trucksBooked * delayDays : 0,
    reassignments,
    steps,
    storeHaulTrucks,
    storeHaulCases,
    storeHaulLegs,
    hasStorageCapacity,
    capacityNote,
  };
}

export function formatReceivingProposalSummary(impact: ReceivingImpact): string {
  if (impact.delayDays > 0) {
    return (
      `Move door ${impact.doorId} from ${impact.plannedSlot} to ${impact.revisedSlot}. ` +
      `Stand down ${impact.crewFte} FTE (${impact.freedCrewHours} crew-hours) on ${impact.plannedSlot} and ` +
      `rebook ${impact.crewFte} FTE for ~${impact.unloadHours}h to unload ${impact.pallets} pallets.`
    );
  }
  if (impact.hasStorageCapacity === false && impact.crossDockPallets != null) {
    return (
      `Early gate-in door ${impact.doorId} on ${impact.revisedSlot}: put away ${impact.putAwayPallets} pallets into free chilled slots; ` +
      `cross-dock ${impact.crossDockPallets} pallets (${impact.crossDockCases?.toLocaleString()} cases) for early store push — do not hold overflow.`
    );
  }
  return (
    `Notify receiving: pull door ${impact.doorId} forward to ${impact.revisedSlot}. ` +
    `BAU put-away of all ${impact.pallets} pallets (${impact.crewFte} FTE · ~${impact.unloadHours}h).`
  );
}

export function formatTransportProposalSummary(impact: TransportImpact): string {
  if (impact.delayDays > 0) {
    const moves = impact.reassignments.length
      ? impact.reassignments
          .map((r) => `${r.trucks} to ${r.containerNumber} on ${r.date}`)
          .join(', ')
      : 'no inbound load to absorb them';
    return (
      `Release ${impact.trucksBooked} reefers booked for ${impact.plannedPickup} (${impact.idleTruckDays} idle truck-days). ` +
      `Reassign ${moves}. Rebook this pickup for ${impact.revisedPickup}.`
    );
  }
  if (impact.hasStorageCapacity === false && (impact.storeHaulTrucks ?? 0) > 0) {
    return (
      `Pull inbound pickup to ${impact.revisedPickup} (${impact.trucksBooked} reefers). ` +
      `Add ${impact.storeHaulTrucks} outbound truck(s) for ${(impact.storeHaulCases ?? 0).toLocaleString()} overflow cases to stores (cross-dock from receiving).`
    );
  }
  return (
    `Move pickup from ${impact.plannedPickup} to ${impact.revisedPickup} — ${impact.trucksBooked} reefers for early gate-in. ` +
    `No extra store haul (capacity OK / BAU).`
  );
}

/** Max DC hold so store still gets a usable sell window (rule-of-thumb: keep ≥60% of shelf life for store). */
function maxDcHoldForShelfLife(shelfLifeDays: number): number {
  return Math.max(1, Math.min(5, Math.floor(shelfLifeDays * 0.25)));
}

export function buildOverstockProposal(shipment: TrackShipment): OverstockProposal {
  const { original, revised } = getShipmentEtaIso(shipment);
  const earlyDays = Math.max(0, -daysBetween(original, revised));
  const inboundCases = shipment.quantity;
  const inboundPallets = Math.ceil(inboundCases / CASES_PER_PALLET);

  // Two early demos: EARLY-01 capacity short; EARLY-02 capacity OK (BAU path).
  const isCapacityShortDemo = shipment.id === 'SHP-ST-EARLY-01' || (shipment.eventStatus === 'early' && shipment.id !== 'SHP-ST-EARLY-02');
  const capacityPct = isCapacityShortDemo ? 92 : shipment.eventStatus === 'early' ? 61 : 68;
  const freePalletSlots = isCapacityShortDemo ? 8 : shipment.eventStatus === 'early' ? 36 : 48;
  const hasStorageCapacity = freePalletSlots >= inboundPallets;
  const decision: OverstockProposal['decision'] = hasStorageCapacity
    ? 'bau'
    : 'early_replenishment';

  const items = getShipmentItems(shipment);
  const primaryItem = items[0] || 'Blueberries';
  const dcRows = DC_INVENTORY.filter((d) => items.includes(d.item));
  const storeRows = STORE_DEMAND.filter((s) => items.includes(s.item));
  const dcOnHandCases = dcRows.reduce((n, d) => n + d.availableStock, 0);
  const dcDailyDispatch = Math.max(
    1,
    dcRows.reduce((n, d) => n + d.dailyDispatchRate, 0)
  );
  const storeOnHandCases = storeRows.reduce((n, s) => n + s.onHand, 0);
  const ageingShelf = storeRows[0]?.onHandShelfLifeDays ?? 3;
  const ageingExpires = storeRows[0]?.onHandExpiresDate ?? addDaysIso(DEMO_TODAY, ageingShelf);

  const presentStock: OverstockPresentStock = {
    item: primaryItem,
    dcOnHandCases,
    dcDailyDispatch,
    storeOnHandCases,
    storeCount: storeRows.length || 1,
    onHandShelfLifeDays: ageingShelf,
    onHandExpiresDate: ageingExpires,
  };

  const dcIfHeldCases = dcOnHandCases + inboundCases;
  const overflowCases = Math.max(0, (inboundPallets - freePalletSlots) * CASES_PER_PALLET);
  const projectedStock: OverstockProjectedStock = {
    dcIfHeldCases,
    overflowCases,
    dcDaysCoverIfHeld: Math.round((dcIfHeldCases / dcDailyDispatch) * 10) / 10,
    ageingBatchAction: hasStorageCapacity
      ? `Keep existing ${primaryItem} (${dcOnHandCases} DC + ${storeOnHandCases} store cases, ${ageingShelf}d life left) on normal FEFO — new early batch put away behind it.`
      : `Existing ${primaryItem} already occupies chilled space (${dcOnHandCases} DC cases, ${ageingShelf}d life → expires ${ageingExpires}). Do not stack early inbound on top — markdown/clear ageing batch and push early qty to stores.`,
  };

  const linkedPos = shipment.linkedPos
    .map((poNum) => DEMO_POS.find((p) => p.po === poNum))
    .filter((p): p is SapPurchaseOrder => !!p);

  const batches: EarlyArrivalBatchGuidance[] = [];
  if (linkedPos.length) {
    for (const po of linkedPos) {
      const shelf = po.itemDetail.shelfLifeDays;
      const maxDcHoldDays = maxDcHoldForShelfLife(shelf);
      const recommendedDcHoldDays = hasStorageCapacity
        ? Math.min(maxDcHoldDays, earlyDays + 1)
        : Math.min(2, maxDcHoldDays);
      const needClearance = !hasStorageCapacity;
      const markdownPercent = needClearance ? (shelf <= 14 ? 15 : 10) : null;
      batches.push({
        item: po.item,
        po: po.po,
        inboundCases: po.orderedQty,
        newBatchShelfLifeDays: shelf,
        maxDcHoldDays,
        recommendedDcHoldDays,
        markdownPercent,
        markdownReason: needClearance
          ? `Clear ageing ${po.item} (already on hand, ${ageingShelf}d left) before early push — new batch has ${shelf}d life; hold ≤${maxDcHoldDays}d in DC.`
          : `BAU put-away — new batch shelf life ${shelf}d; recommended DC hold ${recommendedDcHoldDays}d (max ${maxDcHoldDays}d).`,
        clearanceGuidance: needClearance
          ? `Markdown ${markdownPercent}% on prior ${po.item} batch OR arrange overflow bay; then push ${po.orderedQty.toLocaleString()} cases early to stores.`
          : 'No clearance required — chilled capacity confirmed for inbound.',
      });
    }
  } else {
    const shelf = 14;
    const maxDcHoldDays = maxDcHoldForShelfLife(shelf);
    batches.push({
      item: primaryItem,
      po: shipment.linkedPos[0] || shipment.id,
      inboundCases,
      newBatchShelfLifeDays: shelf,
      maxDcHoldDays,
      recommendedDcHoldDays: hasStorageCapacity ? Math.min(maxDcHoldDays, earlyDays + 1) : 2,
      markdownPercent: hasStorageCapacity ? null : 15,
      markdownReason: hasStorageCapacity
        ? `BAU — new batch shelf life ${shelf}d.`
        : `Clear prior batch before early push — new batch ${shelf}d life.`,
      clearanceGuidance: hasStorageCapacity
        ? 'No clearance required.'
        : 'Markdown 15% on prior batch or arrange overflow space.',
    });
  }

  const storePushes: EarlyStorePush[] = [];
  if (!hasStorageCapacity) {
    const surplus = storeRows.filter((s) => s.daysCover < 4 || s.stockoutRiskDays != null);
    const targets =
      surplus.length > 0 ? surplus.slice(0, 4) : storeRows.slice(0, 4);
    const list = targets.length
      ? targets
      : STORE_DEMAND.filter((s) => s.item === primaryItem).slice(0, 4);
    const pushPool = Math.max(overflowCases, Math.ceil(inboundCases * 0.65));
    const base = Math.floor(pushPool / Math.max(1, list.length));
    let remainder = pushPool - base * Math.max(1, list.length);
    for (const s of list.length ? list : STORE_DEMAND.slice(0, 2)) {
      const extra = remainder > 0 ? 10 : 0;
      if (remainder > 0) remainder -= 10;
      const cases = Math.max(40, base + extra);
      storePushes.push({
        storeId: s.storeId,
        storeName: s.name,
        item: s.item || primaryItem,
        cases,
        reason: `Early replenishment — overflow ${overflowCases.toLocaleString()} cases cannot sit in DC. Store holds ${s.onHand} cases (${s.onHandShelfLifeDays}d life). Clear/markdown ageing stock or arrange backroom before early delivery.`,
        notifyStore: true,
      });
    }
  }

  const handlingMeasures: OverstockHandlingMeasure[] = hasStorageCapacity
    ? [
        {
          id: 'confirm-capacity',
          step: 1,
          title: 'Confirm chilled capacity',
          action: `Put away ${inboundCases.toLocaleString()} early cases into ${freePalletSlots} free slots (${capacityPct}% bay util).`,
          why: 'Free slots cover inbound — no overflow, no forced store push.',
          owner: 'Receiving / DC ops',
        },
        {
          id: 'fefo-hold',
          step: 2,
          title: 'Keep existing stock on FEFO',
          action: `Leave ${dcOnHandCases} DC + ${storeOnHandCases} store cases of ${primaryItem} on normal rotation (expires ${ageingExpires}).`,
          why: 'Early arrival does not force clearance when capacity is available.',
          owner: 'DC purchasing',
        },
        {
          id: 'dc-hold-limit',
          step: 3,
          title: 'Cap new-batch DC hold',
          action: `Hold new batch ≤${batches[0]?.maxDcHoldDays ?? 3}d in DC (reco ${batches[0]?.recommendedDcHoldDays ?? 2}d), then replenish on plan.`,
          why: `Preserves store sell window from ${batches[0]?.newBatchShelfLifeDays ?? 14}d inbound shelf life.`,
          owner: 'DC purchasing',
        },
        {
          id: 'bau-notify',
          step: 4,
          title: 'Notify receiving only',
          action: 'No store markdown or early wave. Receiving pulls door forward for early gate-in.',
          why: 'BAU stock path — only manpower/slot timing changes.',
          owner: 'Receiving',
        },
      ]
    : [
        {
          id: 'capacity-fail',
          step: 1,
          title: 'Capacity short — do not hold all inbound',
          action: `Only ${freePalletSlots} free slots for ${inboundPallets} inbound pallets (${overflowCases.toLocaleString()} cases would overflow).`,
          why: `Holding overflow costs ~$${((inboundPallets - freePalletSlots) * 18).toFixed(0)}/day and burns shelf life.`,
          owner: 'DC purchasing',
        },
        {
          id: 'clear-ageing',
          step: 2,
          title: 'Clear stock already on hand',
          action: `Markdown ${batches[0]?.markdownPercent ?? 15}% or push/clear ${dcOnHandCases} DC cases of ${primaryItem} (only ${ageingShelf}d life left → ${ageingExpires}).`,
          why: 'Ageing batch must move first so early inbound does not sit behind dying stock.',
          owner: 'Category / stores',
        },
        {
          id: 'early-push',
          step: 3,
          title: 'Early replenish to stores',
          action: `Push ${storePushes.reduce((n, s) => n + s.cases, 0).toLocaleString() || inboundCases.toLocaleString()} cases early to ${Math.max(1, storePushes.length)} store(s); notify each to arrange space.`,
          why: 'Frees DC slots and places new batch where sell-through is needed.',
          owner: 'Distribution',
        },
        {
          id: 'new-batch-hold',
          step: 4,
          title: 'Limit new-batch DC dwell',
          action: `Any residual new batch at DC: max hold ${batches[0]?.maxDcHoldDays ?? 3}d (reco ${batches[0]?.recommendedDcHoldDays ?? 2}d) from ${batches[0]?.newBatchShelfLifeDays ?? 14}d life.`,
          why: 'Stops early arrival from becoming dead stock in overflow chill.',
          owner: 'DC purchasing',
        },
      ];

  return {
    hasStorageCapacity,
    capacityPct,
    bayLabel: isCapacityShortDemo ? 'Bay 3–4 (chilled)' : 'Bay 5–6 (chilled)',
    freePalletSlots,
    inboundPallets,
    inboundCases,
    decision,
    storageCostNote: hasStorageCapacity
      ? 'No incremental storage cost — inbound fits existing chilled slots.'
      : `Holding ${inboundPallets - freePalletSlots} overflow pallets would add ~$${(
          (inboundPallets - freePalletSlots) *
          18
        ).toFixed(0)}/day in overflow / 3PL chill cost.`,
    shelfLifeConsequence: hasStorageCapacity
      ? `New batch may sit up to ${batches[0]?.maxDcHoldDays ?? 3}d in DC without cutting store sell window. Existing on-hand (${ageingShelf}d left) stays on FEFO.`
      : `Without early push, overflow hold burns ${earlyDays + 1}–${batches[0]?.maxDcHoldDays ?? 3}d of the new batch, while ageing on-hand (${ageingShelf}d left) expires unused.`,
    presentStock,
    projectedStock,
    handlingMeasures,
    batches,
    storePushes,
    originalEta: original,
    revisedEta: revised,
    earlyDays,
  };
}

export function buildDistributionProposal(shipment: TrackShipment): DistributionProposal {
  const overstock = buildOverstockProposal(shipment);
  const { revised } = getShipmentEtaIso(shipment);
  const putAwayCases = Math.min(
    overstock.freePalletSlots * CASES_PER_PALLET,
    overstock.inboundCases
  );
  const overflowCases = overstock.projectedStock.overflowCases;
  const md = overstock.batches.find((b) => b.markdownPercent != null)?.markdownPercent ?? null;

  const storeDeliveries = !overstock.hasStorageCapacity ? overstock.storePushes : [];
  const totalCases = storeDeliveries.reduce((n, s) => n + s.cases, 0);
  const extraRoutes = overstock.hasStorageCapacity
    ? 0
    : Math.max(1, Math.ceil(Math.max(totalCases, overflowCases) / 400));

  const measures: OverstockHandlingMeasure[] = overstock.hasStorageCapacity
    ? [
        {
          id: 'dist-standby',
          step: 1,
          title: 'No early wave required',
          action: 'Stand by — capacity covers inbound put-away.',
          why: 'Overstock decision is BAU; stores keep normal replenishment.',
          owner: 'Distribution',
        },
        {
          id: 'dist-monitor',
          step: 2,
          title: 'Monitor after receiving',
          action: 'If bay utilisation spikes after put-away, trigger optional early wave.',
          why: 'Safety net if capacity flips post gate-in.',
          owner: 'DC purchasing',
        },
      ]
    : [
        {
          id: 'clear-ageing',
          step: 1,
          title: 'Clear ageing DC / store stock',
          action: `Markdown ${md ?? 15}% or push ${overstock.presentStock.dcOnHandCases} DC cases of ${overstock.presentStock.item} (only ${overstock.presentStock.onHandShelfLifeDays}d life → ${overstock.presentStock.onHandExpiresDate}).`,
          why: 'Ageing batch must sell before early inbound takes shelf space.',
          owner: 'Category / stores',
        },
        {
          id: 'split-overflow',
          step: 2,
          title: 'Split overflow to stores',
          action: `Allocate ${overflowCases.toLocaleString()} overflow cases (${totalCases.toLocaleString()} planned on this wave) across ${storeDeliveries.length} stores.`,
          why: 'Matches receiving cross-dock volume so overflow never enters chilled bay.',
          owner: 'Distribution',
        },
        {
          id: 'notify-stores',
          step: 3,
          title: 'Notify each store',
          action: 'Alert stores to clear ageing stock or arrange backroom before early delivery.',
          why: 'Stores already hold stock — early inbound needs space on arrival.',
          owner: 'Store ops',
        },
        {
          id: 'extra-routes',
          step: 4,
          title: 'Add transport load',
          action: `Book ${extraRoutes} extra store route(s) on ${revised} with transport.`,
          why: 'Same-day cross-dock haul tied to early gate-in.',
          owner: 'Transport',
        },
      ];

  return {
    earlyDays: overstock.earlyDays,
    revisedEta: revised,
    extraRoutes,
    totalCases: overstock.hasStorageCapacity ? 0 : totalCases || overflowCases,
    storeDeliveries,
    notifyMessage: overstock.hasStorageCapacity
      ? 'Capacity OK — no mandatory early store wave. Distribution stands by if overflow develops after put-away.'
      : `Overstock short: put away ${putAwayCases.toLocaleString()} cases at DC; push ${overflowCases.toLocaleString()} overflow cases early to ${storeDeliveries.length} store(s). Clear ageing ${overstock.presentStock.dcOnHandCases} DC cases (${md ?? 15}% markdown). Add ${extraRoutes} route(s) on ${revised}.`,
    hasStorageCapacity: overstock.hasStorageCapacity,
    ageingDcCases: overstock.presentStock.dcOnHandCases,
    ageingShelfLifeDays: overstock.presentStock.onHandShelfLifeDays,
    ageingExpiresDate: overstock.presentStock.onHandExpiresDate,
    markdownPercent: md,
    overflowCases,
    putAwayCases,
    measures,
  };
}

export function formatOverstockProposalSummary(p: OverstockProposal): string {
  const present = `Present stock: ${p.presentStock.dcOnHandCases} DC + ${p.presentStock.storeOnHandCases} store cases (${p.presentStock.onHandShelfLifeDays}d life left).`;
  if (p.hasStorageCapacity) {
    return (
      `${present} Capacity OK (${p.bayLabel} ${p.capacityPct}% · ${p.freePalletSlots} ≥ ${p.inboundPallets} slots). ` +
      `BAU — put away early inbound; keep ageing batch on FEFO. New batch life ${p.batches[0]?.newBatchShelfLifeDays ?? '—'}d; max DC hold ${p.batches[0]?.maxDcHoldDays ?? '—'}d.`
    );
  }
  const stores = p.storePushes.map((s) => `${s.storeName} (${s.cases})`).join(', ');
  const md = p.batches.find((b) => b.markdownPercent != null);
  return (
    `${present} If held, DC becomes ${p.projectedStock.dcIfHeldCases.toLocaleString()} cases ` +
    `(${p.projectedStock.overflowCases.toLocaleString()} overflow). ` +
    `Capacity short — clear ageing stock, then early push to ${stores}. ` +
    (md ? `Markdown ${md.markdownPercent}% on prior ${md.item}. ` : '') +
    `New batch life ${p.batches[0]?.newBatchShelfLifeDays}d — max DC hold ${p.batches[0]?.maxDcHoldDays}d.`
  );
}

export function formatDistributionProposalSummary(p: DistributionProposal): string {
  return p.notifyMessage;
}

export function buildEarlyClearanceProposal(
  shipment: TrackShipment
): EarlyClearanceProposal | null {
  const overstock = buildOverstockProposal(shipment);
  if (shipment.eventStatus !== 'early' || overstock.hasStorageCapacity) return null;

  const item = overstock.presentStock.item;
  const linkedPo = shipment.linkedPos
    .map((poNum) => DEMO_POS.find((p) => p.po === poNum))
    .find((p) => p && p.item === item);
  const unitPrice = linkedPo?.itemDetail.unitPrice ?? 28.5;
  const currency = linkedPo?.itemDetail.currency ?? 'USD';
  const mdPct =
    overstock.batches.find((b) => b.markdownPercent != null)?.markdownPercent ??
    (overstock.presentStock.onHandShelfLifeDays <= 3 ? 20 : 15);
  const ageingCases =
    overstock.presentStock.dcOnHandCases + overstock.presentStock.storeOnHandCases;
  const dcCases = overstock.presentStock.dcOnHandCases;

  const promoStores = overstock.storePushes.slice(0, 3).map((s) => ({
    storeId: s.storeId,
    storeName: s.storeName,
  }));
  if (promoStores.length === 0) {
    STORE_DEMAND.filter((s) => s.item === item)
      .slice(0, 3)
      .forEach((s) => promoStores.push({ storeId: s.storeId, storeName: s.name }));
  }

  const promoStart = overstock.revisedEta;
  const promoEnd = addDaysIso(overstock.revisedEta, Math.max(2, overstock.presentStock.onHandShelfLifeDays - 1));
  const promoName = `${item} Early Clearance Flash`;
  const markdownRecovery = Math.round(dcCases * unitPrice * (1 - mdPct / 100));
  const promoRecovery = Math.round(ageingCases * unitPrice * 0.85);

  // Prefer promo when ageing volume is material; otherwise plain markdown is enough.
  const recommendPromo = !MVP_HIDE_PROMOTIONS && ageingCases >= 200;

  const options: EarlyClearanceOption[] = [
    {
      id: 'markdown',
      title: `Markdown ${mdPct}% on ageing ${item}`,
      recommended: !recommendPromo,
      summary: `Apply ${mdPct}% markdown on ${dcCases.toLocaleString()} DC cases (and store facing units) so ageing stock sells before early inbound hits shelf.`,
      casesAffected: dcCases,
      item,
      unitPrice,
      currency,
      estimatedRecoveryUsd: markdownRecovery,
      markdownPercent: mdPct,
      reason: `On-hand batch has only ${overstock.presentStock.onHandShelfLifeDays}d left (expires ${overstock.presentStock.onHandExpiresDate}). Early inbound ${overstock.earlyDays}d early would sit behind dying stock without clearance.`,
    },
    ...(MVP_HIDE_PROMOTIONS
      ? []
      : [
          {
            id: 'schedule_promotion' as const,
            title: `Schedule “${promoName}” for Category Manager`,
            recommended: recommendPromo,
            summary: `Run a short clearance promo ${promoStart} → ${promoEnd} at ${promoStores.map((s) => s.storeName).join(', ')} to burn through ageing ${item} before early put-away / store push.`,
            casesAffected: ageingCases,
            item,
            unitPrice,
            currency,
            estimatedRecoveryUsd: promoRecovery,
            promoName,
            proposedStart: promoStart,
            proposedEnd: promoEnd,
            stores: promoStores,
            reason: `Category-owned promo clears ${ageingCases.toLocaleString()} cases faster than shelf markdown alone and frees bay + store space for the early batch.`,
          },
        ]),
  ];

  return {
    item,
    ageingDcCases: overstock.presentStock.dcOnHandCases,
    ageingStoreCases: overstock.presentStock.storeOnHandCases,
    onHandShelfLifeDays: overstock.presentStock.onHandShelfLifeDays,
    onHandExpiresDate: overstock.presentStock.onHandExpiresDate,
    earlyDays: overstock.earlyDays,
    revisedEta: overstock.revisedEta,
    options,
    recommendedOptionId: recommendPromo ? 'schedule_promotion' : 'markdown',
    selectedOptionId: recommendPromo ? 'schedule_promotion' : 'markdown',
    requiresCategoryApproval: true,
  };
}

export function formatEarlyClearanceProposalSummary(p: EarlyClearanceProposal): string {
  const chosen =
    p.options.find((o) => o.id === (p.selectedOptionId ?? p.recommendedOptionId)) ?? p.options[0];
  const alt = p.options.find((o) => o.id !== chosen.id);
  return (
    `Clear ageing ${p.item} (${p.ageingDcCases} DC + ${p.ageingStoreCases} store cases, ${p.onHandShelfLifeDays}d life left). ` +
    `Selected: ${chosen.title}. ` +
    (alt ? `Other option: ${alt.title}. ` : '') +
    `Needs Category Manager sign-off.`
  );
}

export function selectClearanceOption(
  actionId: string,
  optionId: 'markdown' | 'schedule_promotion'
): RiskAction | null {
  const list = loadRiskActions();
  let updated: RiskAction | null = null;
  const next = list.map((a) => {
    if (a.id !== actionId || a.category !== 'clearance' || !a.clearanceProposal) return a;
    if (a.status !== 'pending_approval' && a.status !== 'pending_category_approval') return a;
    if (!a.clearanceProposal.options.some((o) => o.id === optionId)) return a;
    const clearanceProposal: EarlyClearanceProposal = {
      ...a.clearanceProposal,
      selectedOptionId: optionId,
    };
    updated = {
      ...a,
      clearanceProposal,
      proposal: formatEarlyClearanceProposalSummary(clearanceProposal),
    };
    return updated;
  });
  if (updated) saveRiskActions(next);
  return updated;
}

/** PO-first backup vendors for vegetables (not RFQ). */
function getVegetableAlternateSupplierOptions(
  item: string,
  primarySupplier: string,
  maxShipDays: number
): { options: AlternateSupplierOption[]; recommendedOptionId: string | null } {
  const catalog: Record<
    string,
    Omit<AlternateSupplierOption, 'currency' | 'recommended'>[]
  > = {
    'Romaine Lettuce': [
      {
        id: 'veg-alt-coastal',
        supplierName: 'Coastal Greens Co.',
        bidId: 'VEND-VG-101',
        shipDays: 2,
        pricePerCase: 19.25,
        origin: 'Salinas, CA',
        capacityCases: 1200,
        reason: 'Approved backup vendor on PO contract',
      },
      {
        id: 'veg-alt-desert',
        supplierName: 'Desert Leaf Farms',
        bidId: 'VEND-VG-102',
        shipDays: 3,
        pricePerCase: 17.8,
        origin: 'Yuma, AZ',
        capacityCases: 900,
        reason: 'Secondary PO vendor — same pack spec',
      },
    ],
    Broccoli: [
      {
        id: 'veg-alt-sunbelt',
        supplierName: 'Sunbelt Produce',
        bidId: 'VEND-VG-201',
        shipDays: 2,
        pricePerCase: 23.5,
        origin: 'Salinas, CA',
        capacityCases: 800,
        reason: 'Approved fill-in on existing PO terms',
      },
      {
        id: 'veg-alt-valley',
        supplierName: 'Imperial Valley Greens',
        bidId: 'VEND-VG-202',
        shipDays: 3,
        pricePerCase: 21.0,
        origin: 'El Centro, CA',
        capacityCases: 650,
        reason: 'Backup vendor — iceless crown spec',
      },
    ],
  };

  const rows = catalog[item] ?? [];
  const qualified = rows
    .filter((s) => s.supplierName !== primarySupplier && s.shipDays <= maxShipDays)
    .map((s, idx) => ({
      ...s,
      currency: 'USD',
      recommended: idx === 0,
    }));

  return {
    options: qualified,
    recommendedOptionId: qualified[0]?.id ?? null,
  };
}

/** Ranked short-lead alternates — RFQ bidders (fruits) or approved PO vendors (vegetables). */
export function buildSourcingProposal(shipment: TrackShipment): SourcingProposal | null {
  if (shipment.eventStatus !== 'delayed') return null;

  const rules: BusinessRulesConfig = loadBusinessRules();
  const delayDays = getShipmentDelayDays(shipment);
  const minDelayDaysConfig = rules.urgentDelayDays;
  const maxShipDaysConfig = rules.maxShipDaysForAltSupplier;

  const linkedPos = shipment.linkedPos
    .map((poNum) => DEMO_POS.find((p) => p.po === poNum))
    .filter((p): p is SapPurchaseOrder => !!p);
  const primaryPo = linkedPos[0];
  const item = primaryPo?.item ?? getShipmentItems(shipment)[0] ?? 'Blueberries';
  const primarySupplier = primaryPo?.supplier ?? shipment.supplier;
  const unitPricePrimary = primaryPo?.itemDetail.unitPrice ?? 28.5;
  const currency = primaryPo?.itemDetail.currency ?? 'USD';
  const unit = primaryPo?.unit ?? 'Cases';
  const inboundCases = linkedPos.reduce((n, p) => n + p.orderedQty, 0) || shipment.quantity;

  const storeRows = STORE_DEMAND.filter((s) => s.item === item);
  const storeOnHand = storeRows.reduce((n, s) => n + s.onHand, 0);
  const dailyDemand = Math.max(
    1,
    Math.round(storeRows.reduce((n, s) => n + s.onHand / Math.max(0.5, s.daysCover), 0))
  );
  const stock = estimateShelfShortage({
    storeOnHandCases: storeOnHand,
    dailyDemandCases: dailyDemand,
    delayDays,
    inboundCases,
    minDaysOfCoverThreshold: rules.minDaysOfCoverThreshold,
  });

  const fillInCases = Math.min(
    inboundCases,
    Math.max(stock.shortageCases, Math.round(inboundCases * 0.35), 400)
  );

  const base: Omit<SourcingProposal, 'eligible' | 'options' | 'selectedOptionId' | 'recommendedOptionId'> & {
    ineligibleReason?: string;
  } = {
    delayDays,
    minDelayDaysConfig,
    maxShipDaysConfig,
    item,
    category: 'Fresh Produce',
    primarySupplier,
    primaryPo: primaryPo?.po ?? shipment.linkedPos[0] ?? '—',
    fillInCases,
    unit,
    unitPricePrimary,
    currency,
    shortageCases: stock.shortageCases,
    daysOfCover: stock.daysOfCover,
  };

  if (delayDays < minDelayDaysConfig) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `Delay is ${delayDays}d — alternate supplier opens when delay ≥ ${minDelayDaysConfig}d (Business Rules → Urgent delay threshold).`,
      options: [],
      selectedOptionId: null,
      recommendedOptionId: null,
    };
  }

  if (rules.requireStockShortageForProposal && !stock.willShortage && stock.shortageCases <= 0) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `No shelf shortage projected (${stock.daysOfCover}d cover). Turn off “require stock shortage” in Business Rules, or wait until cover falls below ${rules.minDaysOfCoverThreshold}d.`,
      options: [],
      selectedOptionId: null,
      recommendedOptionId: null,
    };
  }

  const lane = getPurchasingLaneForShipment(shipment);
  const { options: altOptions, recommendedOptionId } =
    lane === 'vegetables'
      ? getVegetableAlternateSupplierOptions(item, primarySupplier, maxShipDaysConfig)
      : getRfqAlternateSupplierOptions(item, primarySupplier, maxShipDaysConfig);

  const qualified: AlternateSupplierOption[] = altOptions.map((s) => ({
    id: s.id,
    supplierName: s.supplierName,
    bidId: s.bidId,
    shipDays: s.shipDays,
    pricePerCase: s.pricePerCase,
    currency: s.currency,
    origin: s.origin,
    capacityCases: s.capacityCases,
    recommended: s.id === recommendedOptionId,
    reason: s.reason,
    rfqId: 'rfqId' in s ? (s as AlternateSupplierOption).rfqId : undefined,
  }));

  if (qualified.length === 0) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `No alternate can ship within ${maxShipDaysConfig}d (Business Rules → Max ship days for alt supplier).`,
      options: [],
      selectedOptionId: null,
      recommendedOptionId: null,
    };
  }

  const ranked = qualified;
  const recommendedOptionIdFinal = recommendedOptionId ?? ranked[0]?.id ?? null;

  return {
    ...base,
    eligible: true,
    options: ranked,
    selectedOptionId: recommendedOptionIdFinal,
    recommendedOptionId: recommendedOptionIdFinal,
  };
}

export function formatSourcingProposalSummary(p: SourcingProposal): string {
  if (!p.eligible) {
    return p.ineligibleReason ?? 'Alternate supplier not offered for this delay.';
  }
  const sel =
    p.options.find((o) => o.id === (p.selectedOptionId ?? p.recommendedOptionId)) ?? p.options[0];
  return (
    `Delay ${p.delayDays}d (≥ ${p.minDelayDaysConfig}d rule). Fill-in ${p.fillInCases.toLocaleString()} ${p.unit} of ${p.item} ` +
    `from ${sel.supplierName} (${sel.shipDays}d ship) → new PO. Replaces part of ${p.primaryPo} (${p.primarySupplier}).`
  );
}

export function selectSourcingSupplier(actionId: string, optionId: string): RiskAction | null {
  const list = loadRiskActions();
  let updated: RiskAction | null = null;
  const next = list.map((a) => {
    if (a.id !== actionId || a.category !== 'sourcing' || !a.sourcingProposal) return a;
    if (a.status !== 'pending_approval') return a;
    if (!a.sourcingProposal.options.some((o) => o.id === optionId)) return a;
    updated = {
      ...a,
      sourcingProposal: { ...a.sourcingProposal, selectedOptionId: optionId },
      proposal: formatSourcingProposalSummary({
        ...a.sourcingProposal,
        selectedOptionId: optionId,
      }),
    };
    return updated;
  });
  if (updated) saveRiskActions(next);
  return updated;
}

export function issueSourcingPurchaseOrder(action: RiskAction): RiskAction {
  const p = action.sourcingProposal;
  if (!p?.eligible) return action;
  const selected =
    p.options.find((o) => o.id === (p.selectedOptionId ?? p.recommendedOptionId)) ?? p.options[0];
  if (!selected) return action;
  const suffix = action.shipmentId.replace(/\D/g, '').slice(-3) || '100';
  const issuedPo = `PO-4500${String(9100 + (Number(suffix) % 800) || 9101)}`;
  const sourcingProposal: SourcingProposal = {
    ...p,
    selectedOptionId: selected.id,
    issuedPo,
    issuedAt: new Date().toISOString(),
  };
  const updated: RiskAction = {
    ...action,
    status: 'approved',
    sourcingProposal,
    proposal: `Issued ${issuedPo} to ${selected.supplierName} for ${p.fillInCases.toLocaleString()} ${p.unit} ${p.item} (${selected.shipDays}d ship).`,
    detail: `New PO replaces delayed fill-in against ${p.primaryPo}. Primary supplier ${p.primarySupplier} remains on original container.`,
  };
  persistFillInPurchaseOrder(updated, selected);
  return updated;
}

const ISSUED_FILLIN_POS_KEY = 'freshguard-issued-fillin-pos-v1';

export type FillInPoMeta = {
  fillIn: true;
  sourceShipmentId: string;
  sourceActionId: string;
  replacesPo: string;
  primarySupplier: string;
  altBidId: string;
  shipDays: number;
};

function buildFillInPurchaseOrder(
  action: RiskAction,
  selected: AlternateSupplierOption
): SapPurchaseOrder | null {
  const p = action.sourcingProposal;
  if (!p?.issuedPo) return null;
  const item = p.item;
  const isVegetable = VEGETABLE_ITEM_PATTERN.test(item);
  const buyer = isVegetable ? 'David Okonkwo' : 'Sarah Mitchell';
  const storageLocation = isVegetable ? 'CH01-V' : 'CH01-A';
  const storageTemp = isVegetable ? '0–4°C' : '0–2°C';
  const shipDate = new Date();
  const eta = new Date(shipDate);
  eta.setDate(eta.getDate() + selected.shipDays);
  const shipIso = shipDate.toISOString().slice(0, 10);
  const etaIso = eta.toISOString().slice(0, 10);
  const unitPrice = selected.pricePerCase;
  const qty = p.fillInCases;

  return {
    po: p.issuedPo,
    item,
    supplier: selected.supplierName,
    orderedQty: qty,
    unit: 'Cases',
    deliveryDate: etaIso,
    status: 'Acknowledged',
    destination: 'Chicago DC',
    companyCode: '1000',
    purchasingOrg: 'PORG-US01',
    buyer,
    createdDate: shipIso,
    paymentTerms: 'Net 30',
    itemDetail: {
      materialNumber: `MAT-FILL-${p.issuedPo.slice(-4)}`,
      description: `${item} — fill-in (alt supplier)`,
      sku: `SKU-FILL-${p.issuedPo.slice(-4)}`,
      orderedQty: qty,
      confirmedQty: qty,
      unit: 'Cases',
      unitPrice,
      currency: selected.currency || 'USD',
      shelfLifeDays: isVegetable ? 10 : 14,
      storageTemp,
      plant: 'PL-CHI-01',
      storageLocation,
      netWeightKg: Math.round(qty * 2),
      countryOfOrigin: selected.origin,
    },
    shipmentDetail: {
      asnNumber: `ASN-FILL-${p.issuedPo.slice(-4)}`,
      containerNumber: `FILL-${selected.id.slice(-4).toUpperCase()}`,
      shipDate: shipIso,
      eta: etaIso,
      origin: selected.origin,
      destination: 'Chicago DC',
      transportMode: 'road',
      carrier: 'Short-haul reefer',
      incoterms: 'DAP',
      customsStatus: 'Domestic / cleared',
      tempRange: storageTemp,
      cargoLines: [
        {
          poNumber: p.issuedPo,
          item,
          quantity: qty,
          unit: 'Cases',
          lotNumber: `LOT-FILL-${p.issuedPo.slice(-4)}`,
          harvestDate: shipIso,
          bestBefore: addDaysIso(shipIso, 14),
          palletCount: Math.max(1, Math.ceil(qty / 50)),
          grossWeightKg: Math.round(qty * 2.2),
        },
      ],
    },
  };
}

function persistFillInPurchaseOrder(action: RiskAction, selected: AlternateSupplierOption) {
  const po = buildFillInPurchaseOrder(action, selected);
  if (!po) return;
  const list = loadIssuedFillInPos();
  const next = [po, ...list.filter((p) => p.po !== po.po)];
  localStorage.setItem(ISSUED_FILLIN_POS_KEY, JSON.stringify(next));
}

export function loadIssuedFillInPos(): SapPurchaseOrder[] {
  try {
    const raw = localStorage.getItem(ISSUED_FILLIN_POS_KEY);
    if (raw) return JSON.parse(raw) as SapPurchaseOrder[];
  } catch {
    /* ignore */
  }
  return [];
}

/** Rebuild fill-in POs from approved sourcing actions (covers already-approved demos). */
export function syncIssuedFillInPosFromActions(): SapPurchaseOrder[] {
  const fromStore = loadIssuedFillInPos();
  const byPo = new Map(fromStore.map((p) => [p.po, p]));
  for (const action of loadRiskActions()) {
    const p = action.sourcingProposal;
    if (action.category !== 'sourcing' || !p?.issuedPo || action.status !== 'approved') continue;
    if (byPo.has(p.issuedPo)) continue;
    const selected =
      p.options.find((o) => o.id === (p.selectedOptionId ?? p.recommendedOptionId)) ?? p.options[0];
    if (!selected) continue;
    const built = buildFillInPurchaseOrder(action, selected);
    if (built) byPo.set(built.po, built);
  }
  const merged = Array.from(byPo.values());
  localStorage.setItem(ISSUED_FILLIN_POS_KEY, JSON.stringify(merged));
  return merged;
}

export function getAllPurchaseOrders(): SapPurchaseOrder[] {
  const fillIns = syncIssuedFillInPosFromActions();
  const rfqPos = loadFruitsRfqPosFromFlow();
  const reserved = new Set([...fillIns, ...rfqPos].map((p) => p.po));
  return [...fillIns, ...rfqPos, ...DEMO_POS.filter((p) => !reserved.has(p.po))];
}

function loadFruitsRfqPosFromFlow(): SapPurchaseOrder[] {
  try {
    // Lazy import pattern avoided — direct read keeps bundle simple
    const raw = localStorage.getItem('freshguard-fruits-rfq-pos-v1');
    if (raw) return JSON.parse(raw) as SapPurchaseOrder[];
  } catch {
    /* ignore */
  }
  return [];
}

export function isFillInPurchaseOrder(po: SapPurchaseOrder): boolean {
  return (
    po.shipmentDetail?.asnNumber?.startsWith('ASN-FILL-') === true ||
    po.itemDetail.description.toLowerCase().includes('fill-in')
  );
}

const ACTIONS_KEY = 'freshguard-risk-actions-v17';

function buildActionContextFromShipment(shipment: TrackShipment) {
  const pos = shipment.linkedPos
    .map((poNum) => DEMO_POS.find((p) => p.po === poNum))
    .filter((p): p is SapPurchaseOrder => !!p);
  const items = pos.length
    ? [...new Set(pos.map((p) => p.item))]
    : getShipmentItems(shipment);
  return {
    containerNumber: shipment.containerNumber,
    asnNumber: shipment.asnNumber,
    supplier: shipment.supplier,
    linkedPos: [...shipment.linkedPos],
    items,
  };
}

export function getRiskActionContext(action: RiskAction): RiskActionContext | null {
  const shipment = DEMO_SHIPMENTS.find((s) => s.id === action.shipmentId);
  if (!shipment) {
    if (!action.containerNumber && !action.linkedPos?.length) return null;
    return {
      shipmentId: action.shipmentId,
      containerNumber: action.containerNumber ?? '—',
      asnNumber: action.asnNumber,
      supplier: action.supplier ?? '—',
      linkedPos: action.linkedPos ?? [],
      items: action.items ?? [],
      totalQuantity: 0,
      unit: 'Cases',
      destination: '—',
      eta: '—',
      poSummaries: (action.linkedPos ?? []).map((po) => ({
        po,
        item: action.items?.[0] ?? '—',
        supplier: action.supplier ?? '—',
        orderedQty: 0,
        unit: 'Cases' as const,
        lineCount: 1,
        lineDescriptions: [],
      })),
    };
  }

  const pos = shipment.linkedPos
    .map((poNum) => DEMO_POS.find((p) => p.po === poNum))
    .filter((p): p is SapPurchaseOrder => !!p);

  const poSummaries: RiskActionPoSummary[] = pos.map((po) => {
    const lines = getPoOrderLines(po);
    return {
      po: po.po,
      item: po.item,
      supplier: po.supplier,
      orderedQty: po.orderedQty,
      unit: po.unit,
      lineCount: lines.length,
      lineDescriptions: lines.map((l) => l.description),
    };
  });

  const items =
    poSummaries.length > 0
      ? [...new Set(poSummaries.map((p) => p.item))]
      : getShipmentItems(shipment);

  return {
    shipmentId: shipment.id,
    containerNumber: shipment.containerNumber,
    asnNumber: shipment.asnNumber,
    supplier: shipment.supplier,
    linkedPos: [...shipment.linkedPos],
    items,
    totalQuantity: shipment.quantity,
    unit: shipment.unit,
    destination: shipment.destination,
    eta: shipment.eta,
    poSummaries,
  };
}

export function buildRiskActionsForShipment(shipment: TrackShipment): RiskAction[] {
  if (getPurchasingLaneForShipment(shipment) === 'vegetables') return [];

  const ctx = buildActionContextFromShipment(shipment);
  const buyer = getShipmentPurchasingPersona(shipment);
  if (shipment.eventStatus === 'delayed') {
    const stockProposal = buildStockRiskProposal(shipment);
    const promotionProposal = buildPromotionRiskProposal(shipment);
    const shelfLifeProposal = buildShelfLifeProposal(shipment);
    const sourcingProposal = buildSourcingProposal(shipment);
    const receivingImpact = buildReceivingImpact(shipment);
    const transportImpact = buildTransportImpact(shipment);
    const actions: RiskAction[] = [
      {
        id: `ACT-${shipment.id}-STOCK`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'delayed',
        category: 'stock',
        title: 'DC stock reallocation proposal',
        summary:
          'Reallocate available DC inventory and propose inter-store transfers to stores at highest stockout risk before inbound arrives.',
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: ['transport', 'receiving'],
        status: 'pending_approval',
        proposal: formatStockProposalSummary(stockProposal),
        detail:
          'Loop Market stockout in ~2 days. Oak Park in ~3 days. Evanston & Lincoln Park have surplus cover for inter-store moves.',
        stockProposal,
      },
    ];

    if (sourcingProposal) {
      const rec = sourcingProposal.options.find(
        (o) => o.id === sourcingProposal.recommendedOptionId
      );
      actions.push({
        id: `ACT-${shipment.id}-SRC`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'delayed',
        category: 'sourcing',
        title: sourcingProposal.eligible
          ? 'Alternate supplier — create fill-in PO'
          : 'Alternate supplier — not offered (check days config)',
        summary: formatSourcingProposalSummary(sourcingProposal),
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: ['supplier', 'receiving'],
        status: 'pending_approval',
        proposal: formatSourcingProposalSummary(sourcingProposal),
        detail: sourcingProposal.eligible
          ? `Choose a short-lead alternate (≤ ${sourcingProposal.maxShipDaysConfig}d). Approval creates a new PO for ${sourcingProposal.fillInCases.toLocaleString()} ${sourcingProposal.unit}. Recommended: ${rec?.supplierName ?? '—'}.`
          : sourcingProposal.ineligibleReason,
        sourcingProposal,
      });
    }

    if (!MVP_HIDE_PROMOTIONS) {
      actions.push({
        id: `ACT-${shipment.id}-PROMO`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'delayed',
        category: 'promotion',
        title: 'Promotion reschedule & store mix review',
        summary:
          'Promotions tied to this inbound batch may start before stock arrives. Propose new dates or substitute participating stores.',
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: ['category_manager'],
        status: 'pending_approval',
        proposal: formatPromotionProposalSummary(promotionProposal),
        detail:
          'Berry Weekend 2-for-1 and Blueberry Boost end-cap depend on delayed PO lines. Category sign-off required for POS & marketing updates.',
        promotionProposal,
      });
    }

    actions.push(
      {
        id: `ACT-${shipment.id}-SHELF`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'delayed',
        category: 'shelf_life',
        title: 'Revised shelf-life & markdown guidance',
        summary:
          'Delay reduces sellable window. After QC, system proposes markdown, max DC hold, and last store delivery date per item.',
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: ['receiving', 'category_manager'],
        status: 'pending_approval',
        proposal: formatShelfLifeProposalSummary(shelfLifeProposal),
        detail: 'Apply markdown guidance at store receiving if QC confirms quality with reduced remaining life.',
        shelfLifeProposal,
      },
      {
        id: `ACT-${shipment.id}-RCV`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'delayed',
        category: 'receiving',
        title: 'Replan receiving manpower',
        summary:
          'Dock crew is booked for the original date. Stand the shift down, then rebook the door and headcount against the revised arrival.',
        ownerPersona: 'receiving',
        approverPersona: buyer,
        notifyPersonas: ['receiving'],
        status: 'pending_approval',
        proposal: formatReceivingProposalSummary(receivingImpact),
        detail:
          'Crew freed on the planned date can cover putaway backlog; QC must follow the unload immediately since shelf life is already reduced.',
        receivingImpact,
      },
      {
        id: `ACT-${shipment.id}-TRN`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'delayed',
        category: 'transport',
        title: 'Redeploy trucks booked for this container',
        summary:
          'Reefers held for this pickup will sit idle. Release them, move them onto loads already inbound in that window, and rebook this pickup.',
        ownerPersona: 'transport',
        approverPersona: buyer,
        notifyPersonas: ['transport'],
        status: 'pending_approval',
        proposal: formatTransportProposalSummary(transportImpact),
        detail:
          'Release before detention accrues; hold the new booking until the carrier confirms the revised arrival.',
        transportImpact,
      }
    );

    return actions;
  }

  if (shipment.eventStatus === 'early') {
    const overstockProposal = buildOverstockProposal(shipment);
    const distributionProposal = buildDistributionProposal(shipment);
    const clearanceProposal = buildEarlyClearanceProposal(shipment);
    const receivingImpact = buildReceivingImpact(shipment);
    const transportImpact = buildTransportImpact(shipment);
    const actions: RiskAction[] = [
      {
        id: `ACT-${shipment.id}-OVER`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'early',
        category: 'overstock',
        title: overstockProposal.hasStorageCapacity
          ? 'Overstock check — capacity OK (BAU)'
          : 'Overstock risk — clear ageing stock & early push',
        summary: overstockProposal.hasStorageCapacity
          ? `Present ${overstockProposal.presentStock.item}: ${overstockProposal.presentStock.dcOnHandCases} DC + ${overstockProposal.presentStock.storeOnHandCases} store cases already held. Capacity covers early inbound — keep existing stock on FEFO, put away new batch, no forced markdown.`
          : `Present ${overstockProposal.presentStock.item}: ${overstockProposal.presentStock.dcOnHandCases} DC + ${overstockProposal.presentStock.storeOnHandCases} store cases (${overstockProposal.presentStock.onHandShelfLifeDays}d life left). Early inbound would push DC to ${overstockProposal.projectedStock.dcIfHeldCases.toLocaleString()} cases with overflow — clear ageing batch, markdown if needed, then early replenish stores.`,
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: overstockProposal.hasStorageCapacity
          ? ['receiving']
          : ['receiving', 'transport', 'category_manager'],
        status: 'pending_approval',
        proposal: formatOverstockProposalSummary(overstockProposal),
        detail: overstockProposal.hasStorageCapacity
          ? overstockProposal.shelfLifeConsequence
          : `${overstockProposal.storageCostNote} ${overstockProposal.shelfLifeConsequence}`,
        overstockProposal,
      },
    ];

    if (clearanceProposal) {
      const options = MVP_HIDE_PROMOTIONS
        ? clearanceProposal.options.filter((o) => o.id === 'markdown')
        : clearanceProposal.options;
      const proposal = MVP_HIDE_PROMOTIONS
        ? {
            ...clearanceProposal,
            options,
            recommendedOptionId: 'markdown' as const,
            selectedOptionId: 'markdown' as const,
          }
        : clearanceProposal;
      const rec =
        proposal.options.find((o) => o.id === proposal.recommendedOptionId) ?? proposal.options[0];
      actions.push({
        id: `ACT-${shipment.id}-CLR`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'early',
        category: 'clearance',
        title: MVP_HIDE_PROMOTIONS
          ? 'Clearance proposal — markdown'
          : 'Clearance proposal — markdown or schedule promo',
        summary: formatEarlyClearanceProposalSummary(proposal),
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: ['category_manager'],
        status: 'pending_approval',
        proposal: formatEarlyClearanceProposalSummary(proposal),
        detail: MVP_HIDE_PROMOTIONS
          ? `Recommended: ${rec.title}. DC Purchasing endorses; Category Manager confirms markdown depth.`
          : `Recommended: ${rec.title}. DC Purchasing endorses; Category Manager confirms markdown depth or promo calendar.`,
        clearanceProposal: proposal,
      });
    }

    actions.push(
      {
        id: `ACT-${shipment.id}-RCV-E`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'early',
        category: 'receiving',
        title: overstockProposal.hasStorageCapacity
          ? 'Receiving — early gate-in (BAU put-away)'
          : 'Receiving — split put-away & cross-dock',
        summary: overstockProposal.hasStorageCapacity
          ? `Pull crew forward for early gate-in. Put away all ${receivingImpact.pallets} pallets — capacity covers inbound.`
          : `Overstock short: put away only ${receivingImpact.putAwayPallets} of ${receivingImpact.pallets} pallets into free slots; flag ${receivingImpact.crossDockPallets} pallets (${receivingImpact.crossDockCases?.toLocaleString()} cases) for same-day cross-dock to stores.`,
        ownerPersona: 'receiving',
        approverPersona: buyer,
        notifyPersonas: ['receiving'],
        status: 'pending_approval',
        proposal: formatReceivingProposalSummary(receivingImpact),
        detail: receivingImpact.capacityNote,
        receivingImpact,
      },
      {
        id: `ACT-${shipment.id}-TRN-E`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'early',
        category: 'transport',
        title: overstockProposal.hasStorageCapacity
          ? 'Transport — pull-forward inbound only'
          : 'Transport — inbound + early store haul',
        summary: overstockProposal.hasStorageCapacity
          ? 'Pull reefers forward for early gate-in. No extra store routes while capacity is OK.'
          : `Pull inbound pickup forward and book ${transportImpact.storeHaulTrucks ?? 0} outbound truck(s) for ${(transportImpact.storeHaulCases ?? 0).toLocaleString()} overflow cases from receiving cross-dock to stores.`,
        ownerPersona: 'transport',
        approverPersona: buyer,
        notifyPersonas: ['transport'],
        status: 'pending_approval',
        proposal: formatTransportProposalSummary(transportImpact),
        detail: transportImpact.capacityNote,
        transportImpact,
      },
      {
        id: `ACT-${shipment.id}-DIST`,
        shipmentId: shipment.id,
        ...ctx,
        eventStatus: 'early',
        category: 'distribution',
        title: overstockProposal.hasStorageCapacity
          ? 'Distribution stand-by (capacity OK)'
          : 'Distribution — clear ageing & split overflow',
        summary: overstockProposal.hasStorageCapacity
          ? 'No mandatory early store wave. Stand by if bay utilisation spikes after put-away.'
          : `Clear ageing ${distributionProposal.ageingDcCases} DC cases (${distributionProposal.markdownPercent ?? 15}% markdown). Split ${distributionProposal.overflowCases.toLocaleString()} overflow cases to ${distributionProposal.storeDeliveries.length} stores; add ${distributionProposal.extraRoutes} route(s).`,
        ownerPersona: buyer,
        approverPersona: buyer,
        notifyPersonas: ['transport', 'receiving'],
        status: 'pending_approval',
        proposal: formatDistributionProposalSummary(distributionProposal),
        detail: overstockProposal.hasStorageCapacity
          ? 'Stores are not notified unless capacity flips after receiving.'
          : 'Each store on the early wave is notified to clear existing stock or arrange backroom space before delivery.',
        distributionProposal,
      }
    );

    return actions;
  }

  return [];
}

function isHiddenPromotionAction(a: RiskAction): boolean {
  if (!MVP_HIDE_PROMOTIONS) return false;
  return (
    a.category === 'promotion' ||
    a.id.includes('-PROMO') ||
    /promo/i.test(a.title) ||
    Boolean(a.promotionProposal)
  );
}

export function loadRiskActions(): RiskAction[] {
  const fresh = DEMO_SHIPMENTS.flatMap(buildRiskActionsForShipment).filter(
    (a) => !isHiddenPromotionAction(a)
  );
  try {
    const raw = localStorage.getItem(ACTIONS_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as RiskAction[];
      const existingById = new Map(existing.map((a) => [a.id, a]));
      for (const a of fresh) {
        const prev = existingById.get(a.id);
        if (!prev) {
          existingById.set(a.id, a);
        } else {
          existingById.set(a.id, {
            ...prev,
            title: a.title,
            summary: a.summary,
            detail: a.detail,
            proposal: a.proposal,
            clearanceProposal: a.clearanceProposal ?? prev.clearanceProposal,
            ownerPersona: a.ownerPersona,
            approverPersona: a.approverPersona,
            notifyPersonas: a.notifyPersonas,
          });
        }
      }
      const ordered = [
        ...fresh.map((f) => existingById.get(f.id)!),
        ...existing.filter((e) => !fresh.some((f) => f.id === e.id)),
      ].filter((a) => {
        if (isHiddenPromotionAction(a)) return false;
        const ship = DEMO_SHIPMENTS.find((s) => s.id === a.shipmentId);
        return !ship || getPurchasingLaneForShipment(ship) !== 'vegetables';
      });
      // Always rewrite storage so stale promo actions are purged.
      saveRiskActions(ordered);
      return ordered;
    }
  } catch {
    /* ignore */
  }
  saveRiskActions(fresh);
  return fresh;
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

/** Promotion / early-clearance both need DC Purchasing → Category Manager. */
export function isCategoryTwoStepAction(action: RiskAction): boolean {
  return action.category === 'promotion' || action.category === 'clearance';
}

/** Whether this persona can approve/reject the action in its current state. */
export function canPersonaApproveAction(action: RiskAction, persona: FreshGuardPersona): boolean {
  if (action.status === 'approved' || action.status === 'rejected' || action.status === 'notified') {
    return false;
  }
  if (action.category === 'sourcing' && action.sourcingProposal && !action.sourcingProposal.eligible) {
    return false;
  }
  if (isCategoryTwoStepAction(action)) {
    if (action.status === 'pending_approval') return isDcPurchasingPersona(persona) && persona === action.approverPersona;
    if (action.status === 'pending_category_approval') return persona === 'category_manager';
    return false;
  }
  return (
    action.status === 'pending_approval' &&
    isDcPurchasingPersona(persona) &&
    persona === action.approverPersona
  );
}

export function approveRiskAction(id: string, persona: FreshGuardPersona): RiskAction | null {
  const list = loadRiskActions();
  let updated: RiskAction | null = null;
  const next = list.map((a) => {
    if (a.id !== id || !canPersonaApproveAction(a, persona)) return a;
    if (isCategoryTwoStepAction(a) && isDcPurchasingPersona(persona)) {
      updated = { ...a, status: 'pending_category_approval' as const };
    } else if (a.category === 'sourcing' && isDcPurchasingPersona(persona)) {
      updated = issueSourcingPurchaseOrder(a);
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
  dc_purchasing_fruits: 'DC Purchasing — Fruits',
  dc_purchasing_vegetables: 'DC Purchasing — Vegetables',
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
