/**
 * Shared shipment types for FreshGuard logistics + PSA Portnet sync.
 */

import type { PsaEvent, PsaSyncStatus } from './psa';

/** One purchase order / SKU line loaded into a container. */
export interface ContainerCargoLine {
  poNumber: string;
  product: string;
  item: string;
  quantity: number;
  unit: string;
  sku?: string;
  buyerRef?: string;
  /** Line-level status inside the shared container */
  lineStatus?: 'shipped' | 'partial' | 'held';
}

/** Audit row when supplier (or PSA) revises expected delivery date. */
export interface DeliveryDateLogEntry {
  id: string;
  at: string;
  /** Previous ISO date (if known) */
  fromDate?: string;
  /** New ISO delivery / ETA date */
  toDate: string;
  /** Human label shown alongside (e.g. "Aug 25, 2026 (+2d)") */
  toLabel: string;
  source: 'Supplier' | 'PSA Portnet' | 'FreshGuard';
  note?: string;
  /** PO numbers on this container at time of change */
  poNumbers: string[];
  by?: string;
}

export interface Shipment {
  id: string;
  vendor: string;
  item: string;
  product: string;
  quantity: number;
  unit: string;
  fleetSpecification: string;
  logisticsRouteAndProvider: string;
  status: 'delayed' | 'on-time' | 'delivered';
  eta: string;
  origin: string;
  destination: string;
  temp: string;
  route: string;
  date: string;
  /** Expected delivery / ETA calendar date (ISO). Prefer this for calendar views. */
  etaDate?: string;
  /**
   * Supplier / PSA log of delivery date changes for this container (and linked POs).
   * Newest entries last.
   */
  deliveryDateLog?: DeliveryDateLogEntry[];
  hasAnomaly?: boolean;
  /** Forecast delay ahead — paints orange remaining route on the map */
  expectedDelay?: boolean;
  rerouted?: boolean;
  /** Predicted post-delivery shelf life days (buyer impact) */
  shelfLifeDays?: number;
  shelfLifeDaysAtRisk?: number;
  /** Store / shelf stock for shortage projection when delayed */
  storeOnHandCases?: number;
  dailyDemandCases?: number;
  stage?: 'packing' | 'delivering' | 'delivered';
  packingProgress?: number;
  preCoolingTarget?: string;
  containerNumber?: string;
  vesselName?: string;
  voyageNumber?: string;
  psaTerminal?: string;
  psaSyncStatus?: PsaSyncStatus;
  psaLastSyncAt?: string;
  psaEvents?: PsaEvent[];
  currentLat?: number;
  currentLng?: number;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  transportMode?: 'ocean' | 'road' | 'air' | 'multimodal';
  /** All POs / items loaded in this container (multi-PO consolidations). */
  cargoLines?: ContainerCargoLine[];
  /** Advance ship notice number shared across cargo lines */
  asnNumber?: string;
  shipDate?: string;
  shipmentNotes?: string;
  /** Packing slip / BOL uploaded at ASN creation */
  packingSlipName?: string;
  packingSlipDataUrl?: string;
  packingSlipCapturedAt?: string;
  /** Extra ASN logistics visibility fields */
  sealNumber?: string;
  billOfLading?: string;
  bookingNumber?: string;
  shipmentNumber?: string;
  shippingMethod?: string;
  incoterms?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  carrier?: string;
  freightForwarder?: string;
}

/** Resolve cargo lines for a shipment; falls back to the primary PO fields. */
export function getShipmentCargoLines(s: Shipment): ContainerCargoLine[] {
  if (s.cargoLines?.length) return s.cargoLines;
  return [
    {
      poNumber: s.id,
      product: s.product || s.item,
      item: s.item,
      quantity: s.quantity,
      unit: s.unit,
      sku: `SKU-${s.id.slice(-4)}`,
      lineStatus: 'shipped',
    },
  ];
}

/** All distinct cargo lines for a container number across the catalog. */
export function getContainerCargoLines(
  shipments: Shipment[],
  containerNumber: string | undefined,
  primary?: Shipment
): ContainerCargoLine[] {
  if (!containerNumber) return primary ? getShipmentCargoLines(primary) : [];
  const related = shipments.filter((s) => s.containerNumber === containerNumber);
  const source = related.length ? related : primary ? [primary] : [];
  const seen = new Set<string>();
  const lines: ContainerCargoLine[] = [];
  source.forEach((s) => {
    getShipmentCargoLines(s).forEach((line) => {
      const key = `${line.poNumber}::${line.sku || line.product}`;
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(line);
    });
  });
  return lines;
}

export interface AIAlert {
  hasAnomaly: boolean;
  routeId: string;
  threatVector: string;
  delayText: string;
  mitigationText: string;
  mitigationSummary: string;
  alternativeRouteName: string;
  /** Buyer-facing shelf / availability impact */
  shelfImpact?: string;
  shelfLifeBefore?: number;
  shelfLifeAfter?: number;
  suggestedAction?: string;
  /** Store shelf shortage if inbound stays delayed */
  willShortage?: boolean;
  storeOnHandCases?: number;
  dailyDemandCases?: number;
  daysOfCover?: number;
  stockoutInDays?: number;
  shortageCases?: number;
  shortageImpact?: string;
}

export type LogisticsTab = 'dashboard' | 'packing' | 'transit' | 'containers';
