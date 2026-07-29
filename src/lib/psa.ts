/**
 * PSA Portnet® integration types & helpers for FreshGuard logistics.
 * Simulates bi-directional sync with PSA container / vessel event streams.
 */

export type PsaSyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

export type PsaEventCode =
  | 'BOOKING_CONFIRMED'
  | 'GATE_IN'
  | 'LOADED'
  | 'VESSEL_DEPARTURE'
  | 'IN_TRANSIT_SEA'
  | 'VESSEL_ARRIVAL'
  | 'DISCHARGE'
  | 'GATE_OUT'
  | 'INLAND_TRANSIT'
  | 'DC_ARRIVAL'
  | 'SUPPLIER_UPDATE'
  | 'ETA_REVISED'
  | 'TEMP_ALERT';

export interface PsaEvent {
  id: string;
  code: PsaEventCode;
  label: string;
  location: string;
  timestamp: string;
  source: 'PSA Portnet' | 'Supplier' | 'FreshGuard';
  lat?: number;
  lng?: number;
  details?: string;
}

export interface BuyerShipmentAlert {
  id: string;
  shipmentId: string;
  containerNumber: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
  read: boolean;
  source: 'PSA Portnet' | 'FreshGuard';
}

export interface ContainerUpdatePayload {
  containerNumber: string;
  vesselName: string;
  voyageNumber: string;
  bookingNumber: string;
  psaTerminal: string;
  eta: string;
  temp: string;
  origin: string;
  notes?: string;
  currentLat?: number;
  currentLng?: number;
}

export const PSA_EVENT_LABELS: Record<PsaEventCode, string> = {
  BOOKING_CONFIRMED: 'Booking confirmed on Portnet',
  GATE_IN: 'Container gated in at terminal',
  LOADED: 'Loaded onto vessel',
  VESSEL_DEPARTURE: 'Vessel departed',
  IN_TRANSIT_SEA: 'Ocean transit position update',
  VESSEL_ARRIVAL: 'Vessel arrived at destination port',
  DISCHARGE: 'Container discharged',
  GATE_OUT: 'Container gated out',
  INLAND_TRANSIT: 'Inland haulage in progress',
  DC_ARRIVAL: 'Arrived at destination DC',
  SUPPLIER_UPDATE: 'Supplier shipment details updated',
  ETA_REVISED: 'ETA revised via PSA sync',
  TEMP_ALERT: 'Reefer temperature alert',
};

export function createPsaEvent(
  code: PsaEventCode,
  location: string,
  overrides: Partial<PsaEvent> = {}
): PsaEvent {
  return {
    id: `PSA-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code,
    label: PSA_EVENT_LABELS[code],
    location,
    timestamp: new Date().toISOString(),
    source: 'PSA Portnet',
    ...overrides,
  };
}

/** Periodic buyer alert templates seeded from live PSA state */
export function buildPeriodicBuyerAlerts(input: {
  id: string;
  containerNumber?: string;
  product?: string;
  item?: string;
  eta?: string;
  status?: string;
  psaSyncStatus?: PsaSyncStatus;
  psaEvents?: PsaEvent[];
  temp?: string;
  vesselName?: string;
}): BuyerShipmentAlert | null {
  const container = input.containerNumber || 'Pending';
  const product = input.product || input.item || 'Cargo';
  const latest = input.psaEvents?.[input.psaEvents.length - 1];
  const tick = Math.floor(Date.now() / 45000) % 4;

  if (input.status === 'delivered') {
    if (tick !== 0) return null;
    return {
      id: `alert-${input.id}-delivered-${tick}`,
      shipmentId: input.id,
      containerNumber: container,
      title: 'Delivery confirmed',
      message: `${product} (${container}) has been received at DC. PSA Portnet closed the container loop.`,
      severity: 'success',
      timestamp: new Date().toISOString(),
      read: false,
      source: 'PSA Portnet',
    };
  }

  if (input.status === 'delayed' || latest?.code === 'TEMP_ALERT') {
    return {
      id: `alert-${input.id}-delay-${tick}`,
      shipmentId: input.id,
      containerNumber: container,
      title: tick % 2 === 0 ? 'Shipment attention needed' : 'PSA corridor update',
      message:
        tick % 2 === 0
          ? `${container} reports a delay. Latest ETA: ${input.eta || 'TBD'}. Track live on the shipment dashboard.`
          : `PSA Portnet pushed a status change for ${container} aboard ${input.vesselName || 'vessel'}: ${latest?.label || 'In transit'}.`,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      read: false,
      source: 'PSA Portnet',
    };
  }

  const messages: Array<Omit<BuyerShipmentAlert, 'id' | 'timestamp' | 'read'>> = [
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'PSA sync heartbeat',
      message: `${container} is fully synced with PSA Portnet®. Last event: ${latest?.label || 'Awaiting terminal scan'}.`,
      severity: 'info',
      source: 'PSA Portnet',
    },
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'ETA checkpoint',
      message: `Expected arrival for ${product}: ${input.eta || 'Updating'}. Vessel ${input.vesselName || 'TBD'} position refreshed from PSA.`,
      severity: 'info',
      source: 'FreshGuard',
    },
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'Cold-chain snapshot',
      message: `Reefer reading for ${container}: ${input.temp || 'Stable'}. PSA temperature feed is live.`,
      severity: 'info',
      source: 'PSA Portnet',
    },
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'Buyer tracking reminder',
      message: `Periodic reminder: open Shipment Tracking to follow ${container} milestones from PSA Portnet.`,
      severity: 'info',
      source: 'FreshGuard',
    },
  ];

  const pick = messages[tick];
  return {
    ...pick,
    id: `alert-${input.id}-${tick}-${Math.floor(Date.now() / 45000)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
}

export function formatSyncAge(iso?: string): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 15_000) return 'Just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
