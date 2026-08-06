/**
 * Business rules for delay alerts, shelf shortage, and auto-sourcing proposals.
 */

export type BusinessRulesConfig = {
  /** Urgent alert when actual delay exceeds this many days */
  urgentDelayDays: number;
  urgentAlertEnabled: boolean;
  /** Warning when expected delay exceeds this many days */
  warningExpectedDelayDays: number;
  warningAlertEnabled: boolean;
  /** Auto-generate fill-in proposal for configured categories / items on expected delay */
  autoProposalEnabled: boolean;
  autoProposalCategories: string[];
  autoProposalItems: string[];
  /** Category → buyer owner who receives proposals */
  buyerOwnerByCategory: Record<string, string>;
  /** Prefer 2nd-best bidder who can ship within this many days */
  maxShipDaysForAltSupplier: number;
  /**
   * Only auto-propose when store stock would run out / fall below cover
   * while the delayed inbound is unavailable.
   */
  requireStockShortageForProposal: boolean;
  /** Days of cover below which stock is treated as shortage risk */
  minDaysOfCoverThreshold: number;
  /**
   * Which disruption families are monitored (weather, cold-chain, port congestion, …).
   * Used for logistics / buyer risk alerts.
   */
  enabledAlertTypes: AlertRiskType[];
  /** Custom alerts created from Business Rules (global or vessel). */
  customAlerts: CustomBusinessAlert[];
};

/** Disruption families FreshGuard monitors across lanes, ports, and suppliers. */
export const ALERT_TYPE_OPTIONS = [
  'Weather & climate disruption',
  'Port / terminal congestion',
  'Cold-chain breach',
  'Supply network delay',
  'Route / corridor block',
  'Labor & strike action',
  'Commodity shortage',
  'Carrier mode mismatch',
  'Regulatory / customs hold',
  'Origin quality recall',
] as const;

export type AlertRiskType = (typeof ALERT_TYPE_OPTIONS)[number];

/** Map legacy alert labels saved in older builds to the current family names. */
const LEGACY_ALERT_TYPE_MAP: Record<string, AlertRiskType> = {
  'Natural Events': 'Weather & climate disruption',
  'Socio Political': 'Labor & strike action',
  'Supply Chain': 'Supply network delay',
  'Geo Political': 'Route / corridor block',
  'Commodity Specific': 'Commodity shortage',
  Pandemic: 'Regulatory / customs hold',
  'Weather / Climate': 'Weather & climate disruption',
  'Port / Terminal': 'Port / terminal congestion',
  'Transport Mode Mismatch': 'Carrier mode mismatch',
};

export function normalizeAlertTypes(types: string[] | undefined): AlertRiskType[] {
  if (!types?.length) return [];
  const mapped = types
    .map((t) => LEGACY_ALERT_TYPE_MAP[t] ?? (ALERT_TYPE_OPTIONS.includes(t as AlertRiskType) ? (t as AlertRiskType) : null))
    .filter(Boolean) as AlertRiskType[];
  return Array.from(new Set(mapped));
}

export type AlertEventMode = 'global' | 'vessel';

export type AlertRiskScore = 'Low' | 'Medium' | 'High' | 'Critical';

export type CustomBusinessAlert = {
  id: string;
  name: string;
  eventMode: AlertEventMode;
  riskScore: AlertRiskScore;
  /** One or more types from ALERT_TYPE_OPTIONS */
  alertTypes: AlertRiskType[];
  alertCategory: string;
  eventType: string;
  country: string;
  endDate: string;
  enabled: boolean;
  createdAt: string;
};

export const ALERT_CATEGORY_OPTIONS = [
  'Transit delay',
  'Temperature integrity',
  'Lane disruption',
  'Shelf exposure',
  'Import clearance',
  'General',
] as const;

export const ALERT_EVENT_TYPE_OPTIONS = [
  'Storm / flooding',
  'Labor unrest',
  'Terminal backlog',
  'Border restriction',
  'Health advisory',
  'Ingredient shortfall',
  'Highway closure',
  'Unclassified',
] as const;

export const COUNTRY_OPTIONS = [
  'United States',
  'Singapore',
  'China',
  'India',
  'Netherlands',
  'Japan',
  'Brazil',
  'Mexico',
  'Global / Multi-country',
] as const;

export type ShelfStockSnapshot = {
  storeOnHandCases: number;
  dailyDemandCases: number;
  daysOfCover: number;
  stockoutInDays: number;
  delayDays: number;
  shortageCases: number;
  willShortage: boolean;
  inboundUnavailableCases: number;
};

export type AutoProposalStatus =
  | 'pending_buyer'
  | 'approved'
  | 'rejected'
  | 'po_issued';

/** What triggered the fill-in proposal in Inbox test cases / BRM. */
export type AutoProposalTrigger = 'delayed' | 'cancelled';

export type AutoProposal = {
  id: string;
  createdAt: string;
  status: AutoProposalStatus;
  /** delayed = late inbound; cancelled = primary lot cancelled */
  trigger?: AutoProposalTrigger;
  shipmentId: string;
  containerNumber: string;
  category: string;
  item: string;
  expectedDelayDays: number;
  buyerOwner: string;
  primarySupplier: string;
  /** Ranked alternate from prior RFQ bids */
  secondBestSupplier: string;
  secondBestBidId: string;
  secondBestEtaDays: number;
  secondBestPricePerCase: number;
  quantity: number;
  unit: string;
  rationale: string;
  /** Stock-not-available impact that justified the proposal */
  stockShortage?: {
    storeOnHandCases: number;
    dailyDemandCases: number;
    daysOfCover: number;
    stockoutInDays: number;
    shortageCases: number;
    willShortage: boolean;
  };
  issuedPo?: string;
  approvedAt?: string;
};

export const CATEGORY_OPTIONS = [
  'Fresh Produce',
  'Dairy',
  'Meat & Poultry',
  'Seafood',
] as const;

export const DEFAULT_BUYER_OWNERS: Record<string, string> = {
  'Fresh Produce': 'Sarah M. (Produce Buyer)',
  Dairy: 'Priya K. (Dairy Buyer)',
  'Meat & Poultry': 'James L. (Protein Buyer)',
  Seafood: 'Sarah M. (Seafood Buyer)',
};

export const DEFAULT_BUSINESS_RULES: BusinessRulesConfig = {
  urgentDelayDays: 2,
  urgentAlertEnabled: true,
  warningExpectedDelayDays: 1,
  warningAlertEnabled: true,
  autoProposalEnabled: true,
  autoProposalCategories: ['Fresh Produce', 'Seafood'],
  autoProposalItems: ['Hass Avocados', 'Fresh Salmon', 'Hard-Boiled Eggs'],
  buyerOwnerByCategory: { ...DEFAULT_BUYER_OWNERS },
  maxShipDaysForAltSupplier: 3,
  requireStockShortageForProposal: true,
  minDaysOfCoverThreshold: 2,
  enabledAlertTypes: [
    'Weather & climate disruption',
    'Supply network delay',
    'Port / terminal congestion',
    'Carrier mode mismatch',
    'Cold-chain breach',
  ],
  customAlerts: [
    {
      id: 'ALERT-DEMO-FLOOD',
      name: 'Gulf Coast lane storm watch',
      eventMode: 'global',
      riskScore: 'High',
      alertTypes: ['Weather & climate disruption', 'Route / corridor block'],
      alertCategory: 'Lane disruption',
      eventType: 'Storm / flooding',
      country: 'United States',
      endDate: '',
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ],
};

const RULES_KEY = 'freshguard-business-rules-v4';
/** v4: renamed disruption families + refreshed alert modal fields */
const PROPOSALS_KEY = 'freshguard-auto-proposals-v3';

function hydrateBusinessRules(parsed: Partial<BusinessRulesConfig>): BusinessRulesConfig {
  return {
    ...DEFAULT_BUSINESS_RULES,
    ...parsed,
    enabledAlertTypes: normalizeAlertTypes(parsed.enabledAlertTypes).length
      ? normalizeAlertTypes(parsed.enabledAlertTypes)
      : DEFAULT_BUSINESS_RULES.enabledAlertTypes,
    customAlerts: Array.isArray(parsed.customAlerts)
      ? parsed.customAlerts.map((alert) => ({
          ...alert,
          alertTypes: normalizeAlertTypes(alert.alertTypes).length
            ? normalizeAlertTypes(alert.alertTypes)
            : DEFAULT_BUSINESS_RULES.customAlerts[0]?.alertTypes ?? [],
          alertCategory:
            alert.alertCategory === 'Corridor disruption'
              ? 'Lane disruption'
              : alert.alertCategory === 'Delay / ETA'
                ? 'Transit delay'
                : alert.alertCategory === 'Cold chain'
                  ? 'Temperature integrity'
                  : alert.alertCategory === 'Shelf / stock risk'
                    ? 'Shelf exposure'
                    : alert.alertCategory === 'Customs / docs'
                      ? 'Import clearance'
                      : alert.alertCategory === 'Other'
                        ? 'General'
                        : alert.alertCategory || 'General',
          eventType:
            alert.eventType === 'Flood / storm'
              ? 'Storm / flooding'
              : alert.eventType === 'Strike / unrest'
                ? 'Labor unrest'
                : alert.eventType === 'Port congestion'
                  ? 'Terminal backlog'
                  : alert.eventType === 'Border closure'
                    ? 'Border restriction'
                    : alert.eventType === 'Disease outbreak'
                      ? 'Health advisory'
                      : alert.eventType === 'Commodity shortage'
                        ? 'Ingredient shortfall'
                        : alert.eventType === 'Route blockage'
                          ? 'Highway closure'
                          : alert.eventType === 'Other'
                            ? 'Unclassified'
                            : alert.eventType || 'Unclassified',
        }))
      : [...DEFAULT_BUSINESS_RULES.customAlerts],
    buyerOwnerByCategory: {
      ...DEFAULT_BUYER_OWNERS,
      ...(parsed.buyerOwnerByCategory || {}),
    },
  };
}

/**
 * Estimate whether delayed inbound will cause a shelf / store shortage.
 * While the shipment is delayed, inbound cases are treated as unavailable.
 */
export function estimateShelfShortage(opts: {
  storeOnHandCases: number;
  dailyDemandCases: number;
  delayDays: number;
  inboundCases?: number;
  minDaysOfCoverThreshold?: number;
}): ShelfStockSnapshot {
  const onHand = Math.max(0, opts.storeOnHandCases);
  const demand = Math.max(1, opts.dailyDemandCases);
  const delayDays = Math.max(0, opts.delayDays);
  const inbound = Math.max(0, opts.inboundCases ?? 0);
  const minCover = opts.minDaysOfCoverThreshold ?? 2;

  const daysOfCover = Math.round((onHand / demand) * 10) / 10;
  const stockoutInDays = Math.floor(onHand / demand);
  // Cases that would have been needed during the delay window beyond on-hand
  const demandDuringDelay = delayDays * demand;
  const shortageCases = Math.max(0, Math.ceil(demandDuringDelay - onHand));
  const willShortage =
    shortageCases > 0 || daysOfCover < minCover || delayDays >= stockoutInDays;

  return {
    storeOnHandCases: onHand,
    dailyDemandCases: demand,
    daysOfCover,
    stockoutInDays,
    delayDays,
    shortageCases,
    willShortage,
    inboundUnavailableCases: inbound,
  };
}

export function loadBusinessRules(): BusinessRulesConfig {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) {
      const legacyKeys = ['freshguard-business-rules-v3', 'freshguard-business-rules-v2'];
      for (const key of legacyKeys) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const parsed = JSON.parse(legacy) as Partial<BusinessRulesConfig>;
          return hydrateBusinessRules(parsed);
        }
      }
      return { ...DEFAULT_BUSINESS_RULES, customAlerts: [...DEFAULT_BUSINESS_RULES.customAlerts] };
    }
    const parsed = JSON.parse(raw) as Partial<BusinessRulesConfig>;
    return hydrateBusinessRules(parsed);
  } catch {
    return { ...DEFAULT_BUSINESS_RULES, customAlerts: [...DEFAULT_BUSINESS_RULES.customAlerts] };
  }
}

export function saveBusinessRules(config: BusinessRulesConfig) {
  localStorage.setItem(RULES_KEY, JSON.stringify(config));
}

export function loadAutoProposals(): AutoProposal[] {
  try {
    const raw = localStorage.getItem(PROPOSALS_KEY);
    if (!raw) return seedSampleProposals();
    const parsed = JSON.parse(raw) as AutoProposal[];
    return parsed.length ? parsed : seedSampleProposals();
  } catch {
    return seedSampleProposals();
  }
}

export function saveAutoProposals(list: AutoProposal[]) {
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(list));
}

/** Seed demo proposals so buyers see the approval flow immediately. */
export function seedSampleProposals(): AutoProposal[] {
  const now = Date.now();
  const eggsShortage = estimateShelfShortage({
    storeOnHandCases: 180,
    dailyDemandCases: 120,
    delayDays: 2,
    inboundCases: 1200,
    minDaysOfCoverThreshold: 2,
  });
  const avocadoShortage = estimateShelfShortage({
    storeOnHandCases: 90,
    dailyDemandCases: 70,
    delayDays: 3,
    inboundCases: 800,
    minDaysOfCoverThreshold: 2,
  });

  return [
    {
      id: 'APR-2026-001',
      createdAt: new Date(now - 2 * 3600_000).toISOString(),
      status: 'pending_buyer',
      trigger: 'delayed',
      shipmentId: 'PO-2026-DELAY1',
      containerNumber: 'FGUU4582190',
      category: 'Fresh Produce',
      item: 'Hard-Boiled Eggs',
      expectedDelayDays: 2,
      buyerOwner: DEFAULT_BUYER_OWNERS['Fresh Produce'],
      primarySupplier: 'Global Farms Suppliers',
      secondBestSupplier: 'AgriGro Wholesale',
      secondBestBidId: 'QUOTE-002',
      secondBestEtaDays: 2,
      secondBestPricePerCase: 22.8,
      quantity: Math.max(600, eggsShortage.shortageCases),
      unit: 'Cases',
      stockShortage: {
        storeOnHandCases: eggsShortage.storeOnHandCases,
        dailyDemandCases: eggsShortage.dailyDemandCases,
        daysOfCover: eggsShortage.daysOfCover,
        stockoutInDays: eggsShortage.stockoutInDays,
        shortageCases: eggsShortage.shortageCases,
        willShortage: eggsShortage.willShortage,
      },
      rationale:
        `TEST CASE · Delayed shipment: primary lot delayed > urgent threshold AND store stock at risk (${eggsShortage.daysOfCover}d cover, stockout ~${eggsShortage.stockoutInDays}d, shortage ${eggsShortage.shortageCases} cases). Auto-proposal targets 2nd-best RFQ bidder (AgriGro) who can ship in 2 days.`,
    },
    {
      id: 'APR-2026-003',
      createdAt: new Date(now - 1 * 3600_000).toISOString(),
      status: 'pending_buyer',
      trigger: 'cancelled',
      shipmentId: 'PO-2026-CANCEL1',
      containerNumber: 'FGRU9911001',
      category: 'Fresh Produce',
      item: 'Hass Avocados (Class A)',
      expectedDelayDays: 0,
      buyerOwner: DEFAULT_BUYER_OWNERS['Fresh Produce'],
      primarySupplier: 'Global Farms Suppliers',
      secondBestSupplier: 'FreshPack Co.',
      secondBestBidId: 'QUOTE-004',
      secondBestEtaDays: 2,
      secondBestPricePerCase: 24.1,
      quantity: Math.max(800, avocadoShortage.shortageCases),
      unit: 'Cases',
      stockShortage: {
        storeOnHandCases: avocadoShortage.storeOnHandCases,
        dailyDemandCases: avocadoShortage.dailyDemandCases,
        daysOfCover: avocadoShortage.daysOfCover,
        stockoutInDays: avocadoShortage.stockoutInDays,
        shortageCases: avocadoShortage.shortageCases,
        willShortage: avocadoShortage.willShortage,
      },
      rationale:
        `TEST CASE · Cancelled shipment: primary ASN/PO cancelled by supplier (cold-room failure at origin). Full ordered volume unavailable. Fill-in from short-lead 2nd-best bidder (FreshPack) to cover projected shelf gap of ${avocadoShortage.shortageCases} cases.`,
    },
  ];
}

export function matchesAutoProposalScope(
  config: BusinessRulesConfig,
  category: string,
  item: string
): boolean {
  if (!config.autoProposalEnabled) return false;
  const catOk = config.autoProposalCategories.some(
    (c) => c.toLowerCase() === category.toLowerCase()
  );
  const itemOk = config.autoProposalItems.some((i) =>
    item.toLowerCase().includes(i.toLowerCase())
  );
  return catOk || itemOk;
}

/**
 * Whether BRM should raise an auto-proposal given delay + optional stock shortage.
 */
export function shouldAutoGenerateProposal(
  config: BusinessRulesConfig,
  opts: {
    category: string;
    item: string;
    expectedDelayDays: number;
    stock?: ShelfStockSnapshot | null;
  }
): boolean {
  if (!matchesAutoProposalScope(config, opts.category, opts.item)) return false;
  if (opts.expectedDelayDays <= config.warningExpectedDelayDays && opts.expectedDelayDays <= config.urgentDelayDays) {
    // still allow if warning/urgent already exceeded via caller; require at least some delay signal
    if (opts.expectedDelayDays <= 0) return false;
  }
  if (!config.requireStockShortageForProposal) return true;
  if (!opts.stock) return false;
  return (
    opts.stock.willShortage ||
    opts.stock.daysOfCover < config.minDaysOfCoverThreshold ||
    opts.stock.shortageCases > 0
  );
}

export function evaluateDelayAlertLevel(
  config: BusinessRulesConfig,
  opts: { delayedDays?: number; expectedDelayDays?: number }
): 'urgent' | 'warning' | null {
  const delayed = opts.delayedDays ?? 0;
  const expected = opts.expectedDelayDays ?? 0;
  if (config.urgentAlertEnabled && delayed > config.urgentDelayDays) return 'urgent';
  if (config.warningAlertEnabled && expected > config.warningExpectedDelayDays) return 'warning';
  return null;
}

/** Approve → send RFQ acceptance to 2nd-best short-lead supplier and issue PO. */
export function approveAutoProposal(proposal: AutoProposal): AutoProposal {
  const po = `PO-2026-ALT-${proposal.id.slice(-3)}`;
  return {
    ...proposal,
    status: 'po_issued',
    issuedPo: po,
    approvedAt: new Date().toISOString(),
  };
}
