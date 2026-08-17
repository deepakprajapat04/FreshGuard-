/**
 * FreshGuard shipment tracking → risk → action flow (Blueberry / Strawberry demo).
 */

export type FreshGuardPersona =
  | 'dc_purchasing'
  | 'supplier'
  | 'transport'
  | 'receiving';

export type ShipmentEventStatus = 'on-time' | 'delayed' | 'early';

export type RiskCategory =
  | 'stock'
  | 'promotion'
  | 'shelf_life'
  | 'receiving'
  | 'transport'
  | 'overstock'
  | 'distribution';

export type ActionStatus = 'pending_approval' | 'approved' | 'rejected' | 'notified';

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
      shelfLifeDays: 14,
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
          bestBefore: '2026-08-22',
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
      shelfLifeDays: 7,
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
          bestBefore: '2026-08-16',
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

export const STORE_DEMAND: StoreDemand[] = [
  {
    storeId: 'ST-101',
    name: 'Loop Market',
    onHand: 42,
    dailyDemand: 38,
    pendingOrders: 120,
    daysCover: 1.1,
    stockoutRiskDays: 2,
    oosStartDate: '2026-08-19',
    oosEndDate: '2026-08-23',
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
    item: 'Strawberries',
  },
  {
    storeId: 'ST-318',
    name: 'Oak Park',
    onHand: 55,
    dailyDemand: 28,
    pendingOrders: 95,
    daysCover: 2.0,
    stockoutRiskDays: 3,
    oosStartDate: '2026-08-20',
    oosEndDate: '2026-08-23',
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
    item: 'Blueberries',
  },
];

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
];

/** Demo anchor date for calendar windows */
export const DEMO_TODAY = '2026-08-17';

export function getStoreStockoutsForShipment(shipment: TrackShipment): StoreDemand[] {
  if (shipment.eventStatus !== 'delayed') return [];
  return STORE_DEMAND.filter((s) => s.stockoutRiskDays != null);
}

export function getPromotionsForShipment(shipment: TrackShipment): PromotionRisk[] {
  if (shipment.eventStatus !== 'delayed') return [];
  return PROMOTIONS.filter((p) => shipment.linkedPos.includes(p.dependsOnPo));
}

export function getShipmentDelayDays(shipment: TrackShipment): number {
  if (shipment.eventStatus === 'delayed') return 2;
  if (shipment.eventStatus === 'early') return -1;
  return 0;
}

const ACTIONS_KEY = 'freshguard-risk-actions-v1';

export function buildRiskActionsForShipment(shipment: TrackShipment): RiskAction[] {
  if (shipment.eventStatus === 'delayed') {
    return [
      {
        id: `ACT-${shipment.id}-STOCK`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'stock',
        title: 'DC stock reallocation proposal',
        summary: 'Reallocate available DC inventory to stores at highest stockout risk before inbound arrives.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['transport', 'receiving'],
        status: 'pending_approval',
        proposal:
          'Shift 180 cases Blueberries from Evanston surplus to Loop Market & Oak Park. Propose inter-store transfer ST-204 → ST-101 for 40 cases Strawberries.',
        detail: 'Loop Market stockout in ~2 days. Oak Park in ~3 days. Evanston has 6.7d cover.',
      },
      {
        id: `ACT-${shipment.id}-PROMO`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'promotion',
        title: 'Promotion reschedule review',
        summary: 'Berry Weekend promo depends on delayed Strawberry PO.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['dc_purchasing'],
        status: 'pending_approval',
        proposal: 'Move PROMO-882 start to Aug 24 or exclude ST-101 until inbound confirmed.',
      },
      {
        id: `ACT-${shipment.id}-SHELF`,
        shipmentId: shipment.id,
        eventStatus: 'delayed',
        category: 'shelf_life',
        title: 'Revised shelf-life & markdown guidance',
        summary: '2-day delay reduces sellable window at store.',
        ownerPersona: 'dc_purchasing',
        approverPersona: 'dc_purchasing',
        notifyPersonas: ['receiving'],
        status: 'pending_approval',
        proposal:
          'Blueberries: 14d → 12d sellable. Strawberries: 7d → 5d. Max DC hold 3 days post-QC. Recommend 15% markdown if QC passes with ≥2d lost.',
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

export function approveRiskAction(id: string): RiskAction | null {
  const list = loadRiskActions();
  let updated: RiskAction | null = null;
  const next = list.map((a) => {
    if (a.id !== id) return a;
    updated = { ...a, status: 'approved' as const };
    return updated;
  });
  saveRiskActions(next);
  return updated;
}

export function rejectRiskAction(id: string): void {
  const list = loadRiskActions();
  saveRiskActions(list.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
}

export const PERSONA_LABELS: Record<FreshGuardPersona, string> = {
  dc_purchasing: 'DC Purchasing',
  supplier: 'Supplier',
  transport: 'Transport Team',
  receiving: 'Receiving Team',
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
