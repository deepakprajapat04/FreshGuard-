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
  | 'TEMP_ALERT'
  | 'WEATHER_ALERT'
  | 'PORT_CONGESTION';

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
  WEATHER_ALERT: 'Weather & climate disruption',
  PORT_CONGESTION: 'Port / terminal congestion',
};

/** Visual / semantic bucket for timeline styling */
export type PsaEventKind = 'movement' | 'alert' | 'warning' | 'milestone';

export function getPsaEventKind(code: PsaEventCode): PsaEventKind {
  if (code === 'TEMP_ALERT' || code === 'WEATHER_ALERT') return 'alert';
  if (code === 'ETA_REVISED' || code === 'PORT_CONGESTION') return 'warning';
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

export type TransportCategory = 'water' | 'land' | 'air' | 'multimodal' | 'unknown';

function normalizeExpectedTransport(transportMode?: string): TransportCategory {
  const t = (transportMode || '').toLowerCase().trim();
  if (!t) return 'unknown';
  if (t === 'multimodal') return 'multimodal';
  if (t === 'ocean' || t === 'sea' || t === 'water') return 'water';
  if (t === 'road' || t === 'land') return 'land';
  if (t === 'air') return 'air';
  return 'unknown';
}

/**
 * Map Incoterms to the transport corridor they usually imply.
 * Maritime: FAS / FOB / CFR / CIF
 * Delivery-to-door (often land last-mile / inland): DAP / DPU / DDP
 * Any mode / multimodal: FCA / CPT / CIP / EXW
 */
export function inferExpectedTransportFromIncoterms(incoterms?: string): {
  category: TransportCategory;
  code: string | null;
} {
  if (!incoterms?.trim()) return { category: 'unknown', code: null };
  const raw = incoterms.toUpperCase();
  const match = raw.match(/\b(FAS|FOB|CFR|CIF|FCA|CPT|CIP|DAP|DPU|DDP|EXW|DES|DEQ|DAF|DDU)\b/);
  const code = match?.[1] || null;
  if (!code) return { category: 'unknown', code: null };

  if (['FAS', 'FOB', 'CFR', 'CIF', 'DES', 'DEQ'].includes(code)) {
    return { category: 'water', code };
  }
  if (['DAP', 'DPU', 'DDP', 'DAF', 'DDU'].includes(code)) {
    return { category: 'land', code };
  }
  if (['FCA', 'CPT', 'CIP', 'EXW'].includes(code)) {
    return { category: 'multimodal', code };
  }
  return { category: 'unknown', code };
}

function modeLabel(category: TransportCategory): string {
  if (category === 'water') return 'sea';
  if (category === 'land') return 'road';
  if (category === 'air') return 'air';
  if (category === 'multimodal') return 'multimodal';
  return 'unknown';
}

function modeDisplayLabel(category: TransportCategory): string {
  if (category === 'water') return 'Sea';
  if (category === 'land') return 'Road';
  if (category === 'air') return 'Air';
  if (category === 'multimodal') return 'Multimodal';
  return 'Unknown';
}

function categoriesCompatible(expected: TransportCategory, actual: TransportCategory): boolean {
  if (expected === 'unknown' || actual === 'unknown') return true;
  if (expected === 'multimodal' || actual === 'multimodal') return true;
  return expected === actual;
}

function inferActualTransportFromEvents(psaEvents?: PsaEvent[]): TransportCategory {
  const events = psaEvents || [];
  if (!events.length) return 'unknown';

  let waterScore = 0;
  let landScore = 0;
  let airScore = 0;

  for (const e of events) {
    const code = String(e.code || '').toLowerCase();
    const hay = `${e.label || ''} ${e.details || ''} ${e.location || ''}`.toLowerCase();

    if (
      code.includes('in_transit_sea') ||
      code.includes('vessel_departure') ||
      code.includes('vessel_arrival') ||
      code.includes('loaded') ||
      code.includes('discharge')
    ) {
      waterScore += 1;
    }

    if (code.includes('inland_transit') || code.includes('dc_arrival') || code.includes('gate_in')) {
      landScore += 1;
    }

    if (code.includes('gate_out') || code.includes('gated_out')) {
      // Most Gate-Out sequences are terminal/road handoff, but we keep it conservative.
      landScore += 0.5;
    }

    if (/air|flight|plane/.test(hay)) {
      airScore += 1;
    }

    // Also use textual cues even when codes are not explicit.
    if (/ocean|sea|vessel|port|terminal/.test(hay)) waterScore += 0.25;
    if (/inland|truck|haulage|dc arrival|warehouse|road/.test(hay)) landScore += 0.25;
  }

  const both = waterScore > 0 && landScore > 0;
  if (both && Math.abs(waterScore - landScore) <= 1) {
    return 'multimodal';
  }

  if (airScore >= Math.max(waterScore, landScore) && airScore >= 1) return 'air';
  if (waterScore >= landScore && waterScore >= 1.5) return 'water';
  if (landScore >= waterScore && landScore >= 1.5) return 'land';
  return 'unknown';
}

export function getTransportModeMismatch(input: {
  transportMode?: string;
  psaEvents?: PsaEvent[];
  /** Incoterms from ASN / booking (e.g. CIF Singapore, FOB Shanghai) */
  incoterms?: string;
}): {
  isMismatch: boolean;
  expected: TransportCategory;
  actual: TransportCategory;
  expectedFromMode: TransportCategory;
  expectedFromIncoterms: TransportCategory;
  incotermCode: string | null;
  confidence: 'low' | 'medium' | 'high';
  /** Short UI line, e.g. "Expected sea · seeing road" */
  summary: string;
  hint: string;
} {
  const expectedFromMode = normalizeExpectedTransport(input.transportMode);
  const { category: expectedFromIncoterms, code: incotermCode } =
    inferExpectedTransportFromIncoterms(input.incoterms);
  const actual = inferActualTransportFromEvents(input.psaEvents);

  // Prefer declared transport mode; fall back to Incoterms when mode is missing.
  let expected: TransportCategory = expectedFromMode;
  if (expected === 'unknown') expected = expectedFromIncoterms;
  // If mode and Incoterms both declare a concrete (non-multimodal) mode and differ,
  // keep mode as primary expected but still surface Incoterms in the hint.
  if (
    expectedFromMode !== 'unknown' &&
    expectedFromIncoterms !== 'unknown' &&
    expectedFromMode !== 'multimodal' &&
    expectedFromIncoterms !== 'multimodal' &&
    expectedFromMode !== expectedFromIncoterms
  ) {
    expected = expectedFromMode;
  }

  if (expected === 'unknown' || actual === 'unknown') {
    return {
      isMismatch: false,
      expected,
      actual,
      expectedFromMode,
      expectedFromIncoterms,
      incotermCode,
      confidence: 'low',
      summary: 'Not enough PSA data to verify transit mode.',
      hint: 'PSA event data insufficient for transport leg classification.',
    };
  }

  const modeOk = categoriesCompatible(expectedFromMode, actual);
  const incotermsOk = categoriesCompatible(expectedFromIncoterms, actual);
  const modeVsIncotermsConflict =
    expectedFromMode !== 'unknown' &&
    expectedFromIncoterms !== 'unknown' &&
    expectedFromMode !== 'multimodal' &&
    expectedFromIncoterms !== 'multimodal' &&
    expectedFromMode !== expectedFromIncoterms;

  // Mismatch when PSA legs disagree with declared mode and/or Incoterms.
  const disagreeWithMode = expectedFromMode !== 'unknown' && !modeOk;
  const disagreeWithIncoterms = expectedFromIncoterms !== 'unknown' && !incotermsOk;
  const isMismatch = disagreeWithMode || disagreeWithIncoterms || modeVsIncotermsConflict;

  if (!isMismatch) {
    return {
      isMismatch: false,
      expected,
      actual,
      expectedFromMode,
      expectedFromIncoterms,
      incotermCode,
      confidence: 'high',
      summary: `Transit matches ${modeDisplayLabel(expected).toLowerCase()}.`,
      hint: 'Transport leg matches expected corridor mode and Incoterms.',
    };
  }

  const summary = incotermCode
    ? `${incotermCode} expects ${modeDisplayLabel(expected)} · PSA shows ${modeDisplayLabel(actual)}`
    : `Expected ${modeDisplayLabel(expected)} · PSA shows ${modeDisplayLabel(actual)}`;

  const hint = incotermCode
    ? `${incotermCode} bookings are ${modeLabel(expected)} moves, but live tracking is on ${modeLabel(actual)}. Confirm carrier handoff.`
    : `Booking is ${modeLabel(expected)}, but live tracking is on ${modeLabel(actual)}. Confirm carrier handoff.`;

  return {
    isMismatch: true,
    expected,
    actual,
    expectedFromMode,
    expectedFromIncoterms,
    incotermCode,
    confidence: disagreeWithIncoterms && disagreeWithMode ? 'high' : 'medium',
    summary,
    hint,
  };
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
  incoterms?: string;
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
  const dest = shipment.destination || 'destination DC';
  const eta = shipment.eta || 'upcoming ETA';

  const mismatch = getTransportModeMismatch({
    transportMode: shipment.transportMode,
    psaEvents: shipment.psaEvents,
    incoterms: shipment.incoterms,
  });
  const customs = mismatch.actual === 'water' || mismatch.actual === 'multimodal';

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

  if (mismatch.isMismatch) {
    const expectedLabel =
      mismatch.expected === 'water' ? 'sea' : mismatch.expected === 'land' ? 'road' : mismatch.expected;
    const actualLabel =
      mismatch.actual === 'water' ? 'sea' : mismatch.actual === 'land' ? 'road' : mismatch.actual;
    const code = mismatch.incotermCode;

    actions.unshift(
      {
        id: `${shipment.id}-mismatch-carrier`,
        title: 'Ask carrier to confirm active leg',
        detail: code
          ? `${code} expects ${expectedLabel}, but PSA shows ${actualLabel}. Get written confirmation of the live corridor.`
          : `Booking expects ${expectedLabel}, but PSA shows ${actualLabel}. Confirm with carrier before next handoff.`,
        owner: 'Carrier',
        priority: 'urgent',
        dueHint: 'Now · before next leg',
        status: 'todo',
      },
      {
        id: `${shipment.id}-mismatch-buyer`,
        title: 'Escalate mismatch to category buyer',
        detail: 'Buyer decides: accept current road tracking, force sea booking correction, or raise an Inbox fill-in if delay risk grows.',
        owner: 'Buyer',
        priority: 'urgent',
        dueHint: 'Within 1 hour',
        status: 'todo',
      },
      {
        id: `${shipment.id}-mismatch-hold`,
        title: 'Hold dock / last-mile until mode confirmed',
        detail: 'Pause final door booking so warehouse does not prep for the wrong arrival mode.',
        owner: 'Warehouse',
        priority: 'soon',
        dueHint: 'Until carrier confirms',
        status: 'todo',
      },
      {
        id: `${shipment.id}-mismatch-docs`,
        title: code
          ? `Reconcile ${code} docs vs PSA tracking`
          : 'Reconcile Incoterms docs vs PSA tracking',
        detail: 'Check BOL / booking Incoterms against live PSA events and correct the booking record if needed.',
        owner: 'Customs',
        priority: 'soon',
        dueHint: 'Same day',
        status: 'todo',
      }
    );
  }

  if (customs) {
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
  transportMode?: string;
  incoterms?: string;
}): BuyerShipmentAlert | null {
  const container = input.containerNumber || 'Pending';
  const product = input.product || input.item || 'Cargo';
  const latest = input.psaEvents?.[input.psaEvents.length - 1];
  const disruption = [...(input.psaEvents || [])]
    .reverse()
    .find((event) =>
      ['WEATHER_ALERT', 'PORT_CONGESTION', 'TEMP_ALERT'].includes(event.code)
    );
  const tick = Math.floor(Date.now() / 45000) % 4;

  const mismatch = getTransportModeMismatch({
    transportMode: input.transportMode,
    psaEvents: input.psaEvents,
    incoterms: input.incoterms,
  });

  // Prefer Incoterms / mode mismatch alerts over routine heartbeats.
  if (mismatch.isMismatch && input.status !== 'delivered') {
    const code = mismatch.incotermCode;
    return {
      id: `alert-${input.id}-mode-mismatch-${tick}`,
      shipmentId: input.id,
      containerNumber: container,
      title: code
        ? `Incoterms ${code}: transit mode mismatch`
        : 'Transport mode mismatch',
      message: `${product} (${container}): ${mismatch.summary}`,
      severity: 'warning',
      category: 'Urgent',
      timestamp: new Date().toISOString(),
      read: false,
      source: 'FreshGuard',
    };
  }

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

  if (input.status === 'delayed' || disruption) {
    const isWeather = disruption?.code === 'WEATHER_ALERT';
    const isPort = disruption?.code === 'PORT_CONGESTION';
    return {
      id: `alert-${input.id}-delay-${tick}`,
      shipmentId: input.id,
      containerNumber: container,
      title: isWeather
        ? 'Natural weather / climate disruption'
        : isPort
          ? 'Port / terminal congestion'
          : tick % 2 === 0
            ? 'Shipment attention needed'
            : 'PSA corridor update',
      message:
        disruption
          ? `${product} (${container}) aboard ${input.vesselName || 'vessel'}: ${disruption.label} at ${disruption.location}. ${disruption.details || `Revised ETA ${input.eta || 'TBD'}.`}`
          : tick % 2 === 0
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
