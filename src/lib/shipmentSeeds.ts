import { subDays } from 'date-fns';
import { createPsaEvent } from './psa';
import type { Shipment } from './shipmentTypes';

function hoursAgo(h: number) {
  return Date.now() - h * 3600_000;
}

export function seedDefaultShipments(): Shipment[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'PO-2026-8842',
      vendor: 'Global Farms Suppliers',
      item: '1,200 Cases of Hard-Boiled Eggs',
      product: 'Hard-Boiled Eggs',
      quantity: 1200,
      unit: 'Cases',
      fleetSpecification: 'Active Refrigerated',
      logisticsRouteAndProvider: 'Route #402 Corridor',
      status: 'delayed',
      eta: '14 hrs',
      origin: 'Global Farms Plant #4 — Miami Port',
      destination: 'Chicago DC',
      temp: '3.2°C',
      route: 'Miami → Chicago DC',
      date: now,
      hasAnomaly: true,
      stage: 'packing',
      packingProgress: 65,
      preCoolingTarget: 'Pre-Cooling Target: 3°C (Currently: 3.2°C)',
      containerNumber: 'FGUU4582190',
      vesselName: 'Road Reefer Unit RT-402',
      voyageNumber: 'N/A',
      bookingNumber: 'BK-8842-GF',
      psaTerminal: 'PortMiami / PSA Haulage Sync',
      psaSyncStatus: 'synced',
      psaLastSyncAt: now,
      transportMode: 'road',
      originLat: 25.7781,
      originLng: -80.1797,
      destLat: 41.8781,
      destLng: -87.6298,
      currentLat: 33.45,
      currentLng: -84.2,
      psaEvents: [
        createPsaEvent('BOOKING_CONFIRMED', 'PortMiami', {
          id: 'e-8842-1',
          timestamp: new Date(hoursAgo(48)).toISOString(),
          lat: 25.7781,
          lng: -80.1797,
        }),
        createPsaEvent('GATE_IN', 'PortMiami Gate 3', {
          id: 'e-8842-2',
          timestamp: new Date(hoursAgo(36)).toISOString(),
          lat: 25.7781,
          lng: -80.1797,
        }),
        createPsaEvent('INLAND_TRANSIT', 'I-75 North Corridor', {
          id: 'e-8842-3',
          timestamp: new Date(hoursAgo(12)).toISOString(),
          lat: 33.45,
          lng: -84.2,
          details: 'Flash flood delay near Sector 4',
        }),
        createPsaEvent('TEMP_ALERT', 'Sector 4 Gateway', {
          id: 'e-8842-4',
          timestamp: new Date(hoursAgo(2)).toISOString(),
          lat: 35.1,
          lng: -85.3,
          details: 'Reefer hold at 3.2°C — warning band',
        }),
      ],
    },
    {
      id: 'PO-2026-9912A',
      vendor: 'Ocean Catch Suppliers',
      item: '200 Cases of Fresh Salmon',
      product: 'Fresh Salmon',
      quantity: 200,
      unit: 'Cases',
      fleetSpecification: 'Active Refrigerated',
      logisticsRouteAndProvider: 'PSA Portnet · Tuas Terminal',
      status: 'on-time',
      eta: '1.5 Days',
      origin: 'PSA Singapore — Tuas Port',
      destination: 'Chicago DC',
      temp: '3°C [Stable]',
      route: 'Singapore → LA → Chicago DC',
      date: subDays(new Date(), 1).toISOString(),
      stage: 'delivering',
      packingProgress: 100,
      preCoolingTarget: 'Pre-Cooling Target: 3°C (Currently: 3.0°C)',
      containerNumber: 'PSAU8823147',
      vesselName: 'MV Pacific Fresh',
      voyageNumber: 'PF-229W',
      bookingNumber: 'SG-PSA-9912A',
      psaTerminal: 'PSA Tuas Terminal',
      psaSyncStatus: 'synced',
      psaLastSyncAt: now,
      transportMode: 'ocean',
      originLat: 1.2644,
      originLng: 103.666,
      destLat: 41.8781,
      destLng: -87.6298,
      currentLat: 28.5,
      currentLng: -145.2,
      psaEvents: [
        createPsaEvent('BOOKING_CONFIRMED', 'PSA Portnet', {
          id: 'e-9912-1',
          timestamp: new Date(hoursAgo(120)).toISOString(),
          lat: 1.2644,
          lng: 103.666,
        }),
        createPsaEvent('GATE_IN', 'PSA Tuas Gate A', {
          id: 'e-9912-2',
          timestamp: new Date(hoursAgo(96)).toISOString(),
          lat: 1.2644,
          lng: 103.666,
        }),
        createPsaEvent('LOADED', 'MV Pacific Fresh · Bay 42', {
          id: 'e-9912-3',
          timestamp: new Date(hoursAgo(84)).toISOString(),
          lat: 1.2644,
          lng: 103.666,
        }),
        createPsaEvent('VESSEL_DEPARTURE', 'Singapore Strait', {
          id: 'e-9912-4',
          timestamp: new Date(hoursAgo(72)).toISOString(),
          lat: 1.13,
          lng: 103.55,
        }),
        createPsaEvent('IN_TRANSIT_SEA', 'North Pacific', {
          id: 'e-9912-5',
          timestamp: new Date(hoursAgo(8)).toISOString(),
          lat: 28.5,
          lng: -145.2,
          details: 'AIS position synced via PSA Portnet',
        }),
      ],
    },
    {
      id: 'PO-2026-7731C',
      vendor: 'Sunrise Dairy Co.',
      item: '400 Cases of Organic Milk',
      product: 'Organic Milk',
      quantity: 400,
      unit: 'Cases',
      fleetSpecification: 'Active Refrigerated',
      logisticsRouteAndProvider: 'US-12 West',
      status: 'on-time',
      eta: '3 Days',
      origin: 'Wisconsin Farm Store',
      destination: 'Chicago DC',
      temp: '4°C [Stable]',
      route: 'Wisconsin → Chicago DC',
      date: subDays(new Date(), 2).toISOString(),
      stage: 'delivering',
      packingProgress: 100,
      preCoolingTarget: 'Pre-Cooling Target: 4°C (Currently: 4.0°C)',
      containerNumber: 'FGRU2201844',
      vesselName: 'Road Reefer Unit RT-12',
      voyageNumber: 'N/A',
      bookingNumber: 'BK-7731-SD',
      psaTerminal: 'PSA Connected Haulage',
      psaSyncStatus: 'synced',
      psaLastSyncAt: now,
      transportMode: 'road',
      originLat: 43.0731,
      originLng: -89.4012,
      destLat: 41.8781,
      destLng: -87.6298,
      currentLat: 42.5,
      currentLng: -88.4,
      psaEvents: [
        createPsaEvent('BOOKING_CONFIRMED', 'FreshGuard ↔ PSA', {
          id: 'e-7731-1',
          timestamp: new Date(hoursAgo(60)).toISOString(),
          lat: 43.0731,
          lng: -89.4012,
        }),
        createPsaEvent('GATE_IN', 'Vendor Yard Gate', {
          id: 'e-7731-2',
          timestamp: new Date(hoursAgo(40)).toISOString(),
          lat: 43.0731,
          lng: -89.4012,
        }),
        createPsaEvent('INLAND_TRANSIT', 'US-12 West', {
          id: 'e-7731-3',
          timestamp: new Date(hoursAgo(6)).toISOString(),
          lat: 42.5,
          lng: -88.4,
        }),
      ],
    },
  ];
}

export function enrichWithPsaDefaults(s: Shipment): Shipment {
  if (s.containerNumber && s.psaEvents?.length) {
    return {
      ...s,
      psaSyncStatus: s.psaSyncStatus || 'synced',
      psaLastSyncAt: s.psaLastSyncAt || new Date().toISOString(),
      destLat: s.destLat ?? 41.8781,
      destLng: s.destLng ?? -87.6298,
    };
  }
  const hash = s.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    ...s,
    containerNumber: s.containerNumber || `FGUU${(1000000 + (hash % 8999999)).toString().slice(0, 7)}`,
    vesselName:
      s.vesselName ||
      (s.fleetSpecification.includes('Ship') ? 'MV FreshGuard Link' : `Road Reefer RT-${hash % 900}`),
    voyageNumber: s.voyageNumber || 'N/A',
    bookingNumber: s.bookingNumber || `BK-${s.id.slice(-4)}`,
    psaTerminal: s.psaTerminal || 'PSA Portnet Connected',
    psaSyncStatus: s.psaSyncStatus || 'synced',
    psaLastSyncAt: s.psaLastSyncAt || new Date().toISOString(),
    transportMode: s.transportMode || 'road',
    originLat: s.originLat ?? 25.7 + (hash % 20),
    originLng: s.originLng ?? -90 + (hash % 30),
    destLat: s.destLat ?? 41.8781,
    destLng: s.destLng ?? -87.6298,
    currentLat: s.currentLat ?? 35 + (hash % 10),
    currentLng: s.currentLng ?? -88 + (hash % 8),
    psaEvents: s.psaEvents?.length
      ? s.psaEvents
      : [
          createPsaEvent('BOOKING_CONFIRMED', s.origin || 'Supplier', {
            timestamp: subDays(new Date(), 2).toISOString(),
          }),
          createPsaEvent('INLAND_TRANSIT', s.route || 'Corridor', {
            timestamp: new Date().toISOString(),
          }),
        ],
  };
}
