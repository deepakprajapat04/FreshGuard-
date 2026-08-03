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

export type BuyerAlertCategory = 'Urgent' | 'Info only' | 'Regular';

export interface BuyerShipmentAlert {
  id: string;
  shipmentId: string;
  containerNumber: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  category: BuyerAlertCategory;
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

/** Visual / semantic bucket for timeline styling */
export type PsaEventKind = 'movement' | 'alert' | 'warning' | 'milestone';

export function getPsaEventKind(code: PsaEventCode): PsaEventKind {
  if (code === 'TEMP_ALERT') return 'alert';
  if (code === 'ETA_REVISED') return 'warning';
  if (
    code === 'BOOKING_CONFIRMED' ||
    code === 'VESSEL_ARRIVAL' ||
    code === 'DC_ARRIVAL' ||
    code === 'DISCHARGE'
  ) {
    return 'milestone';
  }
  return 'movement';
}

export type ShipmentNextAction = {
  id: string;
  title: string;
  detail: string;
  owner: 'Buyer' | 'Warehouse' | 'Customs' | 'Finance' | 'Carrier';
  priority: 'urgent' | 'soon' | 'planned';
  dueHint: string;
  status: 'todo' | 'in_progress' | 'done';
};

/**
 * Operational next actions for inbound / arriving lots (DP bill, staffing, dock prep…).
 */
export function buildShipmentNextActions(shipment: {
  id: string;
  status?: string;
  stage?: string;
  eta?: string;
  transportMode?: string;
  destination?: string;
  containerNumber?: string;
  psaEvents?: PsaEvent[];
  expectedDelay?: boolean;
}): ShipmentNextAction[] {
  if (shipment.status === 'delivered' || shipment.stage === 'delivered') {
    return [
      {
        id: `${shipment.id}-qc`,
        title: 'Complete inbound QC checklist',
        detail: 'Confirm temp log, seal intact, and put-away location in WMS.',
        owner: 'Warehouse',
        priority: 'soon',
        dueHint: 'Within 2 hours of gate-in',
        status: 'todo',
      },
      {
        id: `${shipment.id}-close`,
        title: 'Close PSA container loop',
        detail: `Mark ${shipment.containerNumber || shipment.id} received and sync GRN to ERP.`,
        owner: 'Buyer',
        priority: 'planned',
        dueHint: 'Same day',
        status: 'todo',
      },
    ];
  }

  const delayed = shipment.status === 'delayed' || !!shipment.expectedDelay;
  const ocean = shipment.transportMode === 'ocean' || shipment.transportMode === 'multimodal';
  const dest = shipment.destination || 'destination DC';
  const eta = shipment.eta || 'upcoming ETA';

  const actions: ShipmentNextAction[] = [
    {
      id: `${shipment.id}-dp`,
      title: 'Prepare DP / delivery order bill',
      detail:
        'Finance must release Delivery Order / DP bill before carrier can collect cargo at terminal or hand over at DC.',
      owner: 'Finance',
      priority: delayed ? 'urgent' : 'soon',
      dueHint: `Before collection · ETA ${eta}`,
      status: 'todo',
    },
    {
      id: `${shipment.id}-staff`,
      title: 'Arrange warehouse receiving staff',
      detail: `Roster dock crew and forklift for inbound at ${dest}. Align shift with revised ETA.`,
      owner: 'Warehouse',
      priority: delayed ? 'urgent' : 'soon',
      dueHint: `Staff ready ${eta}`,
      status: 'todo',
    },
    {
      id: `${shipment.id}-dock`,
      title: 'Reserve dock door & pre-cool bay',
      detail: 'Book door slot and pull bay temp to SLA range before trailer/container arrival.',
      owner: 'Warehouse',
      priority: 'soon',
      dueHint: '4–6 hrs before ETA',
      status: 'todo',
    },
  ];

  if (ocean) {
    actions.unshift({
      id: `${shipment.id}-customs`,
      title: 'Confirm customs / clearance docs',
      detail: 'Verify BOL, packing list, and certificate of origin are filed before pickup.',
      owner: 'Customs',
      priority: delayed ? 'urgent' : 'soon',
      dueHint: 'Before gate-out',
      status: 'todo',
    });
  }

  if (delayed) {
    actions.push({
      id: `${shipment.id}-buyer-notify`,
      title: 'Notify category buyer of revised ETA',
      detail: 'Push delay impact to Inbox / shelf-cover plan so fill-in proposals can proceed if needed.',
      owner: 'Buyer',
      priority: 'urgent',
      dueHint: 'Immediately',
      status: 'in_progress',
    });
  }

  actions.push({
    id: `${shipment.id}-carrier`,
    title: 'Confirm last-mile / haulage slot',
    detail: 'Lock appointment with carrier for terminal pickup or DC drop window.',
    owner: 'Carrier',
    priority: 'planned',
    dueHint: `Window around ${eta}`,
    status: 'todo',
  });

  return actions;
}

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
      category: 'Regular',
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
      category: 'Urgent',
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
      category: 'Info only',
      source: 'PSA Portnet',
    },
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'ETA checkpoint',
      message: `Expected arrival for ${product}: ${input.eta || 'Updating'}. Vessel ${input.vesselName || 'TBD'} position refreshed from PSA.`,
      severity: 'info',
      category: 'Regular',
      source: 'FreshGuard',
    },
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'Cold-chain snapshot',
      message: `Reefer reading for ${container}: ${input.temp || 'Stable'}. PSA temperature feed is live.`,
      severity: 'info',
      category: 'Info only',
      source: 'PSA Portnet',
    },
    {
      shipmentId: input.id,
      containerNumber: container,
      title: 'Buyer tracking reminder',
      message: `Periodic reminder: open Shipment Tracking to follow ${container} milestones from PSA Portnet.`,
      severity: 'info',
      category: 'Info only',
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
