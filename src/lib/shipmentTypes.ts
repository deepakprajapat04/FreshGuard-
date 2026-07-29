/**
 * Shared shipment types for FreshGuard logistics + PSA Portnet sync.
 */

import type { PsaEvent, PsaSyncStatus } from './psa';

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
  hasAnomaly?: boolean;
  rerouted?: boolean;
  stage?: 'packing' | 'delivering' | 'delivered';
  packingProgress?: number;
  preCoolingTarget?: string;
  containerNumber?: string;
  vesselName?: string;
  voyageNumber?: string;
  bookingNumber?: string;
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
  transportMode?: 'ocean' | 'road' | 'multimodal';
}

export interface AIAlert {
  hasAnomaly: boolean;
  routeId: string;
  threatVector: string;
  delayText: string;
  mitigationText: string;
  mitigationSummary: string;
  alternativeRouteName: string;
}

export type LogisticsTab = 'dashboard' | 'packing' | 'transit' | 'containers';
