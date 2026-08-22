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

/** SAP-style PO line item (multi-line purchase orders). */
export type SapPoOrderLine = {
  lineNumber: number;
  item: 'Blueberries' | 'Strawberries';
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
  /** Shipment / PO context for task list and detail headers */
  containerNumber?: string;
  asnNumber?: string;
  supplier?: string;
  linkedPos?: string[];
  items?: string[];
  stockProposal?: StockRiskProposal;
  promotionProposal?: PromotionRiskProposal;
  shelfLifeProposal?: ShelfLifeProposal;
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
  {
    id: 'SHP-BB-MIX-01',
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
  'SHP-BB-MIX-01': { original: '2026-08-24', revised: '2026-08-25' },
  'SHP-BB-RCV-01': { original: '2026-08-18', revised: '2026-08-18' },
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
  'SHP-BB-MIX-01': ['Blueberries', 'Strawberries'],
  'SHP-BB-RCV-01': ['Blueberries'],
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
};

export type TruckReassignment = {
  shipmentId: string;
  containerNumber: string;
  item: string;
  date: string;
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

  const steps: ResourceStep[] = late
    ? [
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
      ]
    : [
        {
          id: 'advance-crew',
          action: `Pull ${crewFte} FTE forward to ${revised}`,
          detail: `Load arrives ${Math.abs(delayDays)}d early — cover door ${doorId} for ~${unloadHours}h.`,
          when: revised,
        },
        {
          id: 'pre-stage',
          action: 'Pre-stage pre-cool lane',
          detail: `${pallets} pallets need chilled space before the planned ${original} window.`,
          when: revised,
        },
      ];

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
  };
}

export function buildTransportImpact(shipment: TrackShipment): TransportImpact {
  const { original, revised } = getShipmentEtaIso(shipment);
  const delayDays = daysBetween(original, revised);
  const cases = shipment.quantity;
  const trucksBooked = Math.max(1, Math.ceil(cases / CASES_PER_TRUCK));
  const late = delayDays > 0;

  // Trucks freed by the delay go to shipments already inbound in the original window.
  let remaining = late ? trucksBooked : 0;
  const reassignments: TruckReassignment[] = [];
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

  const trucksReassigned = reassignments.reduce((n, r) => n + r.trucks, 0);

  const steps: ResourceStep[] = late
    ? [
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
      ]
    : [
        {
          id: 'pull-forward',
          action: `Move pickup to ${revised}`,
          detail: `${trucksBooked} reefers needed ${Math.abs(delayDays)}d earlier than booked.`,
          when: revised,
        },
      ];

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
  return (
    `Pull door ${impact.doorId} forward to ${impact.revisedSlot}. ` +
    `${impact.crewFte} FTE for ~${impact.unloadHours}h on ${impact.pallets} pallets.`
  );
}

export function formatTransportProposalSummary(impact: TransportImpact): string {
  if (impact.delayDays <= 0) {
    return `Move pickup from ${impact.plannedPickup} to ${impact.revisedPickup} — ${impact.trucksBooked} reefers needed earlier.`;
  }
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

const ACTIONS_KEY = 'freshguard-risk-actions-v8';

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
  const ctx = buildActionContextFromShipment(shipment);
  if (shipment.eventStatus === 'delayed') {
    const stockProposal = buildStockRiskProposal(shipment);
    const promotionProposal = buildPromotionRiskProposal(shipment);
    const shelfLifeProposal = buildShelfLifeProposal(shipment);
    const receivingImpact = buildReceivingImpact(shipment);
    const transportImpact = buildTransportImpact(shipment);
    return [
      {
        id: `ACT-${shipment.id}-STOCK`,
        shipmentId: shipment.id,
        ...ctx,
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
        ...ctx,
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
        ...ctx,
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
        ...ctx,
        eventStatus: 'delayed',
        category: 'receiving',
        title: 'Replan receiving manpower',
        summary:
          'Dock crew is booked for the original date. Stand the shift down, then rebook the door and headcount against the revised arrival.',
        ownerPersona: 'receiving',
        approverPersona: 'dc_purchasing',
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
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['transport'],
        status: 'pending_approval',
        proposal: formatTransportProposalSummary(transportImpact),
        detail:
          'Release before detention accrues; hold the new booking until the carrier confirms the revised arrival.',
        transportImpact,
      },
    ];
  }

  if (shipment.eventStatus === 'early') {
    return [
      {
        id: `ACT-${shipment.id}-OVER`,
        shipmentId: shipment.id,
        ...ctx,
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
        ...ctx,
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
        ...ctx,
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
        ...ctx,
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
