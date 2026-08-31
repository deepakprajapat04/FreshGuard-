import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  MessageSquare, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  X, 
  FileSignature, 
  Receipt,
  Sparkles,
  Building2,
  Award,
  ChevronDown,
  ShieldCheck,
  Send,
  AlertCircle,
  MapPin,
  Calendar,
  Thermometer,
  Check,
  Calculator,
  Maximize2,
  Minimize2,
  RefreshCw,
  Upload,
  Package,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import { PageHeader, StatCard, pageShellClass, statGridClass } from '../components/PageChrome';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import type { ContainerCargoLine } from '../lib/shipmentTypes';
import {
  looksLikeSampleAsn,
  mergeAsnCapture,
  parseAsnText,
  SAMPLE_ASN_CAPTURE,
  type CapturedAsnFields,
} from '../lib/asnCapture';

// Define TS Types for procurement records
interface Vendor {
  name: string;
  score: number;
  status: string;
  category: string;
}

interface Quotation {
  id: string;
  vendor: string;
  pricePerUnit: number;
  totalPrice: number;
  eta: string;
  qualityIndex: string;
  terms: string;
  notes: string;
  harvestTimestamp?: string;
  logisticsRouteAndProvider?: string;
  fleetSpecification?: 'Active Refrigerated' | 'Passive Cooling' | 'Ambient';
  pricePerCase?: number;
  availableQuantity?: number;
}

function getQuoteCompareMetrics(quote: Quotation) {
  const isRefrigerated = quote.fleetSpecification === 'Active Refrigerated';
  const isPassive = quote.fleetSpecification === 'Passive Cooling';
  let riskLabel = 'Critical risk';
  let wastePct = 15.0;
  let riskTone: 'low' | 'medium' | 'high' = 'high';
  if (isRefrigerated) {
    riskLabel = 'Low risk · ~96% shelf-life retention';
    wastePct = 1.2;
    riskTone = 'low';
  } else if (isPassive) {
    riskLabel = 'Elevated risk · ~84% shelf-life retention';
    wastePct = 5.4;
    riskTone = 'medium';
  }
  let harvestAgeText = 'N/A';
  if (quote.harvestTimestamp) {
    const hrs = Math.round((Date.now() - new Date(quote.harvestTimestamp).getTime()) / 3600000);
    harvestAgeText = hrs > 0 ? `${hrs} hrs post-harvest` : 'Freshly harvested';
  }
  const caseRate = quote.pricePerCase || quote.pricePerUnit;
  const baseQuotePrice = quote.totalPrice;
  const trueCost = Math.round(baseQuotePrice * (1 + wastePct / 100));
  const reliabilityNum = parseInt(String(quote.qualityIndex).replace(/[^\d]/g, ''), 10) || 0;
  return {
    caseRate,
    baseQuotePrice,
    trueCost,
    wastePct,
    riskLabel,
    riskTone,
    harvestAgeText,
    reliabilityNum,
    fleet: quote.fleetSpecification || 'Ambient',
    route: quote.logisticsRouteAndProvider || 'Carrier Standby',
    eta: quote.eta,
    available: quote.availableQuantity,
  };
}

type OrderType = 'one-time' | 'repeat';
type RepeatFrequency = 'weekly' | 'biweekly' | 'monthly';
type BidPanelId = 'pipeline' | 'workspace' | 'collab' | 'audit';

interface RepeatCycle {
  frequency: RepeatFrequency;
  occurrences: number;
  startDate: string;
  /** Inclusive end of delivery window for repeat bids */
  endDate?: string;
}

interface BidRequest {
  id: string;
  item: string;
  category: string;
  status: 'open' | 'review' | 'awarded';
  vendorsCount: number;
  deadline: string;
  deliveryDate: string;
  buyer: string;
  date: string;
  quantity: number;
  unit: string;
  location: string;
  orderType: OrderType;
  repeatCycle?: RepeatCycle;
  specifications: {
    tempRange: string;
    humidity: string;
    sizeSpec: string;
    targetColdChainTemp?: string;
    maxTransitTime?: string;
    minShelfLife?: string;
  };
  approvedVendors: Vendor[];
  quotations: Quotation[];
  awardedVendor?: string;
  awardedPrice?: number;
}

interface Contract {
  id: string;
  requirementId: string;
  vendor: string;
  item: string;
  cat: string;
  duration: string;
  contractValue: string;
  status: string;
}

interface PurchaseOrder {
  po: string;
  requirementId: string;
  vendor: string;
  item: string;
  amt: string;
  date: string;
  status: 'Draft' | 'Confirmed' | 'Acknowledged' | 'ASN Submitted' | 'Processing' | 'In Transit' | 'Fulfilled';
  orderedQty?: number;
  confirmedQty?: number;
  unit?: string;
  containerNumber?: string;
  eta?: string;
  shipmentNotes?: string;
  asnNumber?: string;
  shipDate?: string;
  destination?: string;
  deliveryDate?: string;
  orderType?: OrderType;
  cycleIndex?: number;
  cycleTotal?: number;
  unitPrice?: number;
}

/** Normalize any ship-date string to `YYYY-MM-DD` for `<input type="date">`. */
function toDateInputValue(raw?: string): string {
  const todayLocal = () => {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  if (!raw || !raw.trim()) return todayLocal();
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return todayLocal();
}

function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateRepeatDeliveryDates(
  startDate: string,
  frequency: RepeatFrequency,
  occurrences: number,
  endDate?: string
): string[] {
  const dates: string[] = [];
  let cur = startDate;
  if (endDate && endDate >= startDate) {
    let guard = 0;
    while (cur <= endDate && guard < 48) {
      dates.push(cur);
      if (frequency === 'weekly') cur = addCalendarDays(cur, 7);
      else if (frequency === 'biweekly') cur = addCalendarDays(cur, 14);
      else {
        const d = new Date(`${cur}T12:00:00`);
        d.setMonth(d.getMonth() + 1);
        cur = d.toISOString().slice(0, 10);
      }
      guard += 1;
    }
    return dates.length ? dates : [startDate];
  }
  for (let i = 0; i < Math.max(1, occurrences); i++) {
    dates.push(cur);
    if (frequency === 'weekly') cur = addCalendarDays(cur, 7);
    else if (frequency === 'biweekly') cur = addCalendarDays(cur, 14);
    else {
      const d = new Date(`${cur}T12:00:00`);
      d.setMonth(d.getMonth() + 1);
      cur = d.toISOString().slice(0, 10);
    }
  }
  return dates;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PO_SEED_CATALOG: Array<{
  vendor: string;
  item: string;
  unitPrice: number;
  req: string;
  dest: string;
}> = [
  { vendor: 'Global Farms Suppliers', item: 'Hass Avocados (Class A)', unitPrice: 24.5, req: 'REQ-2026-001', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'Global Farms Suppliers', item: 'Organic Cucumbers', unitPrice: 13.0, req: 'REQ-2026-002', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'Global Farms Suppliers', item: 'Baby Spinach', unitPrice: 12.0, req: 'REQ-2026-001', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'Global Farms Suppliers', item: 'Romaine Hearts', unitPrice: 11.5, req: 'REQ-2026-001', dest: 'Dallas DC South' },
  { vendor: 'Global Farms Suppliers', item: 'Valencia Oranges (Seedless)', unitPrice: 18.2, req: 'REQ-2026-008', dest: 'Atlanta DC' },
  { vendor: 'AgriGro Wholesale', item: 'Hard-Boiled Eggs', unitPrice: 22.8, req: 'REQ-2026-010', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'AgriGro Wholesale', item: 'Cherry Tomatoes', unitPrice: 16.4, req: 'REQ-2026-011', dest: 'Minneapolis DC' },
  { vendor: 'AgriGro Wholesale', item: 'Iceberg Lettuce', unitPrice: 9.8, req: 'REQ-2026-011', dest: 'Chicago DC West' },
  { vendor: 'FreshPack Co.', item: 'Mixed Berry Clamshells', unitPrice: 28.0, req: 'REQ-2026-012', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'FreshPack Co.', item: 'Organic Blueberries', unitPrice: 32.5, req: 'REQ-2026-012', dest: 'Boston DC' },
  { vendor: 'Valley Green Produce', item: 'Yellow Onions (Jumbo)', unitPrice: 8.4, req: 'REQ-2026-013', dest: 'Kansas City DC' },
  { vendor: 'Valley Green Produce', item: 'Russet Potatoes', unitPrice: 7.2, req: 'REQ-2026-013', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'Sunrise Dairy Co.', item: 'Premium Whole Milk (Gallon)', unitPrice: 3.1, req: 'REQ-2026-003', dest: 'Chicago DC' },
  { vendor: 'Sunrise Dairy Co.', item: 'Greek Yogurt Cups (12ct)', unitPrice: 14.6, req: 'REQ-2026-003', dest: 'Detroit DC' },
  { vendor: 'PureLand Creamery', item: 'Unsalted Butter Blocks', unitPrice: 21.0, req: 'REQ-2026-014', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'PureLand Creamery', item: 'Heavy Cream (Quart)', unitPrice: 6.8, req: 'REQ-2026-014', dest: 'Indianapolis DC' },
  { vendor: 'Midwest Dairy Group', item: 'Shredded Cheddar (5lb)', unitPrice: 19.5, req: 'REQ-2026-015', dest: 'Chicago DC West' },
  { vendor: 'Valley Meats Inc.', item: 'Ground Beef 80/20 Chuck', unitPrice: 30.75, req: 'REQ-2026-016', dest: 'Chicago DC' },
  { vendor: 'Valley Meats Inc.', item: 'Chicken Breast Boneless', unitPrice: 26.4, req: 'REQ-2026-016', dest: 'St. Louis DC' },
  { vendor: 'Plains Beef & Co.', item: 'Angus Ribeye Steaks', unitPrice: 48.0, req: 'REQ-2026-017', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'Ocean Catch Logistics', item: 'Fresh Salmon Portions', unitPrice: 28.4, req: 'REQ-2026-018', dest: 'Chicago DC East (Hub-1)' },
  { vendor: 'Ocean Catch Logistics', item: 'Atlantic Cod Fillets', unitPrice: 22.0, req: 'REQ-2026-018', dest: 'Boston DC' },
  { vendor: 'FreshPack Co.', item: 'Cut Fruit Cups', unitPrice: 15.2, req: 'REQ-2026-019', dest: 'Dallas DC South' },
  { vendor: 'Global Farms Suppliers', item: 'Organic Bananas', unitPrice: 10.5, req: 'REQ-2026-020', dest: 'Atlanta DC' },
  { vendor: 'AgriGro Wholesale', item: 'Bell Peppers Mixed', unitPrice: 14.1, req: 'REQ-2026-021', dest: 'Chicago DC East (Hub-1)' },
];

const PO_STATUSES: PurchaseOrder['status'][] = [
  'Draft',
  'Confirmed',
  'Acknowledged',
  'Acknowledged',
  'ASN Submitted',
  'Processing',
  'In Transit',
  'In Transit',
  'Fulfilled',
  'Fulfilled',
];

/** Build 50+ demo purchase orders spanning statuses for vendor/buyer testing. */
function seedPurchaseOrders(): PurchaseOrder[] {
  const showcase: PurchaseOrder[] = [
    {
      po: 'PO-2026-PEND1',
      requirementId: 'REQ-2026-001',
      vendor: 'Global Farms Suppliers',
      item: 'Hass Avocados (Class A)',
      amt: '$19,600',
      date: 'Jul 24, 2026',
      status: 'Acknowledged',
      orderedQty: 800,
      unit: 'Cases',
      destination: 'Chicago DC East (Hub-1)',
      unitPrice: 24.5,
    },
    {
      po: 'PO-2026-PEND2',
      requirementId: 'REQ-2026-002',
      vendor: 'Global Farms Suppliers',
      item: 'Organic Cucumbers',
      amt: '$14,300',
      date: 'Jul 25, 2026',
      status: 'Acknowledged',
      orderedQty: 1100,
      unit: 'Cases',
      destination: 'Chicago DC East (Hub-1)',
      unitPrice: 13.0,
    },
    {
      po: 'PO-2026-PEND3',
      requirementId: 'REQ-2026-001',
      vendor: 'Global Farms Suppliers',
      item: 'Baby Spinach',
      amt: '$8,640',
      date: 'Jul 26, 2026',
      status: 'ASN Submitted',
      orderedQty: 720,
      confirmedQty: 720,
      unit: 'Cases',
      containerNumber: 'FGRU8800455',
      asnNumber: 'ASN-2026-0455',
      eta: '3 Days',
      shipDate: 'Jul 28, 2026',
      destination: 'Chicago DC East (Hub-1)',
      shipmentNotes: 'Palletized leafy greens · TempTale active',
      unitPrice: 12.0,
    },
    {
      po: 'PO-2026-D156',
      requirementId: 'REQ-2026-001',
      vendor: 'Global Farms Suppliers',
      item: 'Mixed Electronics / Retail kit (ASN demo)',
      amt: '$42,500',
      date: 'Jul 15, 2026',
      status: 'Acknowledged',
      orderedQty: 4250,
      unit: 'Cases',
      destination: 'Chicago DC East (Hub-1)',
      unitPrice: 10.0,
      deliveryDate: '2026-07-15',
    },
    {
      po: 'PO-2026-784A',
      requirementId: 'REQ-2026-003',
      vendor: 'Sunrise Dairy Co.',
      item: 'Premium Whole Milk (Gallon)',
      amt: '$37,200',
      date: 'May 20, 2026',
      status: 'In Transit',
      orderedQty: 12000,
      unit: 'Cases',
      destination: 'Chicago DC',
      unitPrice: 3.1,
    },
    {
      po: 'PO-2026-512B',
      requirementId: 'PREVIOUS',
      vendor: 'Valley Meats Inc.',
      item: 'Ground Beef 80/20 Chuck',
      amt: '$12,300',
      date: 'May 17, 2026',
      status: 'Fulfilled',
      orderedQty: 400,
      unit: 'Cases',
      destination: 'Chicago DC',
      unitPrice: 30.75,
    },
  ];

  const globalCatalog = PO_SEED_CATALOG.filter((c) => c.vendor === 'Global Farms Suppliers');
  const generated: PurchaseOrder[] = [];
  const target = 55;

  for (let i = 0; generated.length + showcase.length < target; i++) {
    // Bias ~60% to Global Farms so Vendor View still has a large PO ledger
    const useGlobal = i % 5 !== 0 && i % 5 !== 1;
    const pool = useGlobal && globalCatalog.length ? globalCatalog : PO_SEED_CATALOG;
    const cat = pool[i % pool.length];
    const status = PO_STATUSES[i % PO_STATUSES.length];
    const qty = 200 + ((i * 37) % 1800);
    const amt = `$${Math.round(cat.unitPrice * qty).toLocaleString()}`;
    const day = 1 + (i % 28);
    const monthIdx = i % 6;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const date = `${months[monthIdx]} ${day}, 2026`;
    const poNum = `PO-2026-${String(1000 + i).padStart(4, '0')}`;
    const row: PurchaseOrder = {
      po: poNum,
      requirementId: cat.req,
      vendor: cat.vendor,
      item: cat.item,
      amt,
      date,
      status,
      orderedQty: qty,
      unit: 'Cases',
      destination: cat.dest,
      unitPrice: cat.unitPrice,
      deliveryDate: `2026-${String((monthIdx % 12) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
    if (status === 'ASN Submitted' || status === 'Processing' || status === 'In Transit') {
      row.confirmedQty = qty;
      row.containerNumber = `FGRU${8800000 + i}`;
      row.asnNumber = `ASN-2026-${String(2000 + i)}`;
      row.eta = `${1 + (i % 5)} Days`;
      row.shipDate = date;
    }
    if (status === 'Fulfilled') {
      row.confirmedQty = qty;
      row.asnNumber = `ASN-2026-${String(3000 + i)}`;
      row.containerNumber = `FGRU${8700000 + i}`;
    }
    if (status === 'Draft') {
      row.orderType = i % 3 === 0 ? 'repeat' : 'one-time';
      if (row.orderType === 'repeat') {
        row.cycleIndex = 1;
        row.cycleTotal = 4;
      }
    }
    generated.push(row);
  }

  return [...showcase, ...generated];
}

function frequencyLabel(f: RepeatFrequency): string {
  if (f === 'weekly') return 'Weekly';
  if (f === 'biweekly') return 'Every 2 weeks';
  return 'Monthly';
}

const APPROVED_VENDORS_DB: Vendor[] = [
  // Produce
  { name: 'Global Farms Suppliers', score: 98, status: 'Pre-vetted Cold Range', category: 'Fresh Produce' },
  { name: 'AgriGro Wholesale', score: 88, status: 'Pre-vetted Regional', category: 'Fresh Produce' },
  { name: 'FreshPack Co.', score: 95, status: 'Pre-vetted Quick Logistics', category: 'Fresh Produce' },
  { name: 'Valley Green Produce', score: 91, status: 'Pre-vetted General', category: 'Fresh Produce' },
  // Dairy
  { name: 'Sunrise Dairy Co.', score: 99, status: 'Pre-vetted Express Reefer', category: 'Dairy' },
  { name: 'PureLand Creamery', score: 94, status: 'Pre-vetted Local Source', category: 'Dairy' },
  { name: 'Midwest Dairy Group', score: 90, status: 'Pre-vetted Bulk Only', category: 'Dairy' },
  // Meat & Seafood
  { name: 'Valley Meats Inc.', score: 92, status: 'Pre-vetted Chilled Express', category: 'Meat & Poultry' },
  { name: 'Ocean Catch Logistics', score: 90, status: 'Pre-vetted Deep Freeze', category: 'Meat & Poultry' },
  { name: 'Plains Beef & Co.', score: 87, status: 'Pre-vetted Regional Rail', category: 'Meat & Poultry' }
];

export default function Procurement() {
  const [activeTab, setActiveTab] = useState<'bidding' | 'contracts' | 'orders'>('bidding');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullscreenPanel, setFullscreenPanel] = useState<BidPanelId | null>(null);
  const { persona, setPersona } = usePersona();
  const isVendor = persona === 'vendor';

  // Core App states
  const [bidsList, setBidsList] = useState<BidRequest[]>([
    {
      id: 'REQ-2026-001',
      item: 'Organic Hass Avocados (Class A)',
      category: 'Fresh Produce',
      status: 'review',
      vendorsCount: 2,
      deadline: '2.5 hours remaining',
      deliveryDate: '2026-06-03',
      buyer: 'Sarah M.',
      date: 'May 23, 2026',
      quantity: 5000,
      unit: 'Cases',
      location: 'Chicago DC East (Hub-1)',
      orderType: 'repeat',
      repeatCycle: {
        frequency: 'weekly',
        occurrences: 4,
        startDate: '2026-06-03',
      },
      specifications: {
        tempRange: '42°F - 48°F',
        humidity: '85% max',
        sizeSpec: 'Size 48 count',
        targetColdChainTemp: '4°C',
        maxTransitTime: '36 hours',
        minShelfLife: '14 days'
      },
      approvedVendors: [
        { name: 'Global Farms Suppliers', score: 98, status: 'Pre-vetted Cold Range', category: 'Fresh Produce' },
        { name: 'AgriGro Wholesale', score: 88, status: 'Pre-vetted Regional', category: 'Fresh Produce' },
        { name: 'FreshPack Co.', score: 95, status: 'Pre-vetted Quick Logistics', category: 'Fresh Produce' }
      ],
      quotations: [
        {
          id: 'QUOTE-001',
          vendor: 'Global Farms Suppliers',
          pricePerUnit: 24.50,
          totalPrice: 122500,
          eta: '2026-06-02',
          qualityIndex: '98/100',
          terms: 'Active Refrigerated Carrier',
          notes: 'Tested vacuum integrity. Pre-inspected at orchard gate. Thermally monitored.',
          harvestTimestamp: '2026-05-23T08:00',
          logisticsRouteAndProvider: 'I-80 West Expressway - CoolWay Transit',
          fleetSpecification: 'Active Refrigerated',
          pricePerCase: 24.50,
          availableQuantity: 5000
        },
        {
          id: 'QUOTE-002',
          vendor: 'AgriGro Wholesale',
          pricePerUnit: 22.80,
          totalPrice: 114000,
          eta: '2026-06-03',
          qualityIndex: '88/100',
          terms: 'Passive Cooling Container',
          notes: 'Dry ice blankets wrapped around pallets. GPS tracker deployed.',
          harvestTimestamp: '2026-05-22T14:30',
          logisticsRouteAndProvider: 'Route 66 Corridor - National Refrig Freight',
          fleetSpecification: 'Passive Cooling',
          pricePerCase: 22.80,
          availableQuantity: 4500
        }
      ]
    },
    {
      id: 'REQ-2026-002',
      item: 'Romaine Lettuce Hearts (12ct Bag)',
      category: 'Fresh Produce',
      status: 'open',
      vendorsCount: 1,
      deadline: '2 days remaining',
      deliveryDate: '2026-06-05',
      buyer: 'Sarah M.',
      date: 'May 24, 2026',
      quantity: 3500,
      unit: 'Cases',
      location: 'Newark Reefer Facility (Hub-2)',
      orderType: 'one-time',
      specifications: {
        tempRange: '34°F - 38°F',
        humidity: '90% min',
        sizeSpec: 'Class A Premium',
        targetColdChainTemp: '2°C',
        maxTransitTime: '24 hours',
        minShelfLife: '10 days'
      },
      approvedVendors: [
        { name: 'Global Farms Suppliers', score: 98, status: 'Pre-vetted Cold Range', category: 'Fresh Produce' },
        { name: 'FreshPack Co.', score: 95, status: 'Pre-vetted Quick Logistics', category: 'Fresh Produce' }
      ],
      quotations: [
        {
          id: 'QUOTE-003',
          vendor: 'FreshPack Co.',
          pricePerUnit: 18.20,
          totalPrice: 63700,
          eta: '2026-06-04',
          qualityIndex: '91/100',
          terms: 'Active Refrigerated Carrier',
          notes: 'Vacuum cooled immediately post-harvest. Nitrogen purge option included.',
          harvestTimestamp: '2026-05-23T11:00',
          logisticsRouteAndProvider: 'Interstate 95 Corridor - SwiftCold Reefer',
          fleetSpecification: 'Active Refrigerated',
          pricePerCase: 18.20,
          availableQuantity: 3500
        }
      ]
    },
    {
      id: 'REQ-2026-003',
      item: 'Premium Whole Milk (Gallon)',
      category: 'Dairy',
      status: 'awarded',
      vendorsCount: 2,
      deadline: 'Closed',
      deliveryDate: '2026-05-28',
      buyer: 'John D.',
      date: 'May 18, 2026',
      quantity: 12000,
      unit: 'Units',
      location: 'Chicago DC East (Hub-1)',
      orderType: 'one-time',
      specifications: {
        tempRange: '33°F - 37°F',
        humidity: 'Ambient',
        sizeSpec: 'Standard Gallons',
        targetColdChainTemp: '3°C',
        maxTransitTime: '12 hours',
        minShelfLife: '18 days'
      },
      approvedVendors: [
        { name: 'Sunrise Dairy Co.', score: 99, status: 'Pre-vetted Express Reefer', category: 'Dairy' },
        { name: 'PureLand Creamery', score: 94, status: 'Pre-vetted Local Source', category: 'Dairy' }
      ],
      quotations: [
        {
          id: 'QUOTE-004',
          vendor: 'Sunrise Dairy Co.',
          pricePerUnit: 3.10,
          totalPrice: 37200,
          eta: '2026-05-26',
          qualityIndex: '99/100',
          terms: 'Active Refrigerated Carrier - Dedicated Shuttle',
          notes: '100% pasture-raised high stability dairy. Direct-to-dock routing.',
          harvestTimestamp: '2026-05-25T04:00',
          logisticsRouteAndProvider: 'Local Freeway Line - Sunrise Dedicated Shuttle',
          fleetSpecification: 'Active Refrigerated',
          pricePerCase: 3.10,
          availableQuantity: 12000
        }
      ],
      awardedVendor: 'Sunrise Dairy Co.',
      awardedPrice: 37200
    }
  ]);

  const [contracts, setContracts] = useState<Contract[]>([
    { id: 'CTR-2026-101', requirementId: 'REQ-2026-003', vendor: 'Sunrise Dairy Co.', item: 'Premium Whole Milk (Gallon)', cat: 'Dairy', duration: 'May 2026 - Dec 2026', contractValue: '$37,200', status: 'Active' },
    { id: 'CTR-2026-088', requirementId: 'PREVIOUS', vendor: 'Global Farms Suppliers', item: 'Valencia Oranges (Seedless)', cat: 'Fresh Produce', duration: 'April 2026 - April 2027', contractValue: '$140,000', status: 'Active' }
  ]);

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => seedPurchaseOrders());

  const [poModal, setPoModal] = useState<{ po: PurchaseOrder; mode: 'detail' | 'draft' } | null>(null);
  const [asnModalOpen, setAsnModalOpen] = useState(false);
  const [asnLinkedPoIds, setAsnLinkedPoIds] = useState<string[]>([]);
  const [asnLineQty, setAsnLineQty] = useState<Record<string, string>>({});
  const [fulfillQty, setFulfillQty] = useState('');
  const [fulfillContainer, setFulfillContainer] = useState('');
  const [fulfillEta, setFulfillEta] = useState('');
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [fulfillAsn, setFulfillAsn] = useState('');
  const [fulfillShipDate, setFulfillShipDate] = useState('');
  const [fulfillSlipName, setFulfillSlipName] = useState('');
  const [fulfillSlipDataUrl, setFulfillSlipDataUrl] = useState('');
  const [slipScanMsg, setSlipScanMsg] = useState<string | null>(null);
  const [asnExtra, setAsnExtra] = useState<Partial<CapturedAsnFields>>({});
  const [draftDeliveryDate, setDraftDeliveryDate] = useState('');
  const [fulfillSaving, setFulfillSaving] = useState(false);

  // Selected bid detail view reference
  const [selectedBidId, setSelectedBidId] = useState<string>('REQ-2026-001');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [rightChatTab, setRightChatTab] = useState<'audit' | 'negotiation'>('audit');
  const [awardSuccessAlert, setAwardSuccessAlert] = useState<string | null>(null);
  const [slaComplianceChecked, setSlaComplianceChecked] = useState(true);
  const [newGrade, setNewGrade] = useState('Class A');
  const selectedBid = bidsList.find(b => b.id === selectedBidId) || bidsList[0];

  const asnEligibleOrders = orders.filter(
    (o) =>
      o.status === 'Acknowledged' ||
      (asnModalOpen && asnLinkedPoIds.includes(o.po) && o.status === 'ASN Submitted')
  );

  const openAsnModal = (seedPos: PurchaseOrder[] = []) => {
    const ids = seedPos.map((p) => p.po);
    const qtyMap: Record<string, string> = {};
    seedPos.forEach((p) => {
      qtyMap[p.po] = String(p.confirmedQty || p.orderedQty || '');
    });
    const primary = seedPos[0];
    setAsnLinkedPoIds(ids);
    setAsnLineQty(qtyMap);
    setFulfillQty(primary ? String(primary.orderedQty || '') : '');
    setFulfillContainer(primary?.containerNumber || '');
    setFulfillEta(primary?.eta && primary.eta !== 'Pending' ? primary.eta : '3 Days');
    setFulfillNotes(primary?.shipmentNotes || '');
    setFulfillAsn(
      primary?.asnNumber ||
        (primary ? `ASN-${primary.po.replace('PO-', '')}` : `ASN-${Date.now().toString().slice(-8)}`)
    );
    setFulfillShipDate(toDateInputValue(primary?.shipDate));
    setFulfillSlipName('');
    setFulfillSlipDataUrl('');
    setSlipScanMsg(null);
    setAsnExtra({});
    setAsnModalOpen(true);
  };

  const toggleAsnPo = (po: string) => {
    setAsnLinkedPoIds((prev) => {
      if (prev.includes(po)) return prev.filter((id) => id !== po);
      const row = orders.find((o) => o.po === po);
      if (row) {
        setAsnLineQty((q) => ({
          ...q,
          [po]: q[po] || String(row.confirmedQty || row.orderedQty || ''),
        }));
      }
      return [...prev, po];
    });
  };

  const applyCapturedAsn = (captured: CapturedAsnFields) => {
    if (captured.asnNumber) setFulfillAsn(captured.asnNumber);
    if (captured.containerNumber) setFulfillContainer(captured.containerNumber);
    if (captured.shipDate) setFulfillShipDate(toDateInputValue(captured.shipDate));
    else if (captured.asnDate) setFulfillShipDate(toDateInputValue(captured.asnDate));
    if (captured.etaDate) {
      const etaIso = toDateInputValue(captured.etaDate);
      const shipIso = toDateInputValue(captured.shipDate || captured.asnDate);
      const days = Math.max(
        1,
        Math.round(
          (new Date(`${etaIso}T12:00:00`).getTime() - new Date(`${shipIso}T12:00:00`).getTime()) /
            86400000
        )
      );
      setFulfillEta(`${days} Days · ETA ${formatDisplayDate(etaIso)}`);
    } else if (captured.shippingMethod) {
      setFulfillEta(captured.shippingMethod);
    }

    const noteBits = [
      captured.notes,
      captured.sealNumber && `Seal ${captured.sealNumber}`,
      captured.billOfLading && `BOL ${captured.billOfLading}`,
      captured.vesselName && `Vessel ${captured.vesselName}`,
      captured.voyageNumber && `Voy ${captured.voyageNumber}`,
      captured.bookingNumber && `Booking ${captured.bookingNumber}`,
      captured.shipmentNumber && `Shipment ${captured.shipmentNumber}`,
      captured.portOfLoading && `POL ${captured.portOfLoading}`,
      captured.portOfDischarge && `POD ${captured.portOfDischarge}`,
      captured.carrier && `Carrier ${captured.carrier}`,
      captured.documentsAttached?.length
        ? `Docs: ${captured.documentsAttached.join(', ')}`
        : '',
    ].filter(Boolean);
    if (noteBits.length) setFulfillNotes(noteBits.join(' · '));

    setAsnExtra(captured);

    const linkable = orders.filter(
      (o) =>
        (o.status === 'Acknowledged' ||
          o.status === 'Confirmed' ||
          o.status === 'ASN Submitted') &&
        captured.linkedPoNumbers.some(
          (po) => po.toUpperCase() === o.po.toUpperCase()
        )
    );
    // Also match PEND1 / D156 style when OCR dashes differ
    const fuzzy = orders.filter((o) => {
      if (!(o.status === 'Acknowledged' || o.status === 'Confirmed')) return false;
      const key = o.po.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return captured.linkedPoNumbers.some(
        (po) => po.toUpperCase().replace(/[^A-Z0-9]/g, '') === key
      );
    });
    const merged = Array.from(
      new Map([...linkable, ...fuzzy].map((o) => [o.po, o])).values()
    );
    if (merged.length) {
      setAsnLinkedPoIds(merged.map((m) => m.po));
      setAsnLineQty((prev) => {
        const next = { ...prev };
        merged.forEach((m) => {
          next[m.po] =
            String(captured.poQuantities[m.po] || m.confirmedQty || m.orderedQty || '');
        });
        return next;
      });
    }

    const srcLabel =
      captured.source === 'vision'
        ? 'AI vision'
        : captured.source === 'sample'
          ? 'sample ASN template'
          : 'document text';
    setSlipScanMsg(
      `Captured via ${srcLabel}: ${captured.asnNumber || 'ASN'} · container ${
        captured.containerNumber || '—'
      } · ${merged.length || captured.linkedPoNumbers.length} PO link(s). Review before submit.`
    );
  };

  const handlePackingSlipUpload = async (file: File) => {
    setFulfillSlipName(file.name);
    setSlipScanMsg('Scanning ASN / packing slip…');

    const readAsDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const dr = new FileReader();
        dr.onload = () => resolve(String(dr.result || ''));
        dr.onerror = () => reject(new Error('read failed'));
        dr.readAsDataURL(file);
      });

    const readAsText = () =>
      new Promise<string>((resolve) => {
        const tr = new FileReader();
        tr.onload = () => resolve(String(tr.result || ''));
        tr.onerror = () => resolve('');
        tr.readAsText(file);
      });

    try {
      const dataUrl = await readAsDataUrl();
      setFulfillSlipDataUrl(dataUrl);

      let captured: CapturedAsnFields | null = null;

      if (file.type.startsWith('text/') || /\.(csv|txt)$/i.test(file.name)) {
        const text = await readAsText();
        captured = parseAsnText(text, file.name);
      }

      // Image / PDF: try vision API, then sample/heuristic fallback
      if (!captured && (file.type.startsWith('image/') || /\.(png|jpe?g|webp|pdf)$/i.test(file.name))) {
        try {
          const res = await fetch('/api/analyze-asn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl, fileName: file.name }),
          });
          if (res.ok) {
            const data = await res.json();
            captured = mergeAsnCapture(parseAsnText(JSON.stringify(data), file.name), {
              ...data,
              linkedPoNumbers: data.linkedPoNumbers || [],
              poQuantities: data.poQuantities || {},
              source: 'vision',
            });
          }
        } catch {
          /* fall through */
        }
      }

      if (!captured && looksLikeSampleAsn(file.name)) {
        captured = { ...SAMPLE_ASN_CAPTURE };
      }

      // Any ASN-like image with no OCR → apply sample demo fields so upload still works
      if (
        !captured &&
        (looksLikeSampleAsn(file.name) ||
          /asn|shipping|packing|bol|advance\s*ship/i.test(file.name))
      ) {
        captured = {
          ...SAMPLE_ASN_CAPTURE,
          notes: `${SAMPLE_ASN_CAPTURE.notes} · Uploaded file: ${file.name}`,
        };
      }

      if (captured) applyCapturedAsn(captured);
      else {
        setSlipScanMsg(
          `Uploaded ${file.name}, but no ASN fields were detected. Enter details manually or try the sample ASN image.`
        );
      }
    } catch {
      if (looksLikeSampleAsn(file.name)) applyCapturedAsn({ ...SAMPLE_ASN_CAPTURE });
      else setSlipScanMsg('Could not read file. Enter ASN details manually.');
    }
  };

  const submitAsn = () => {
    const linked = orders.filter((o) => asnLinkedPoIds.includes(o.po));
    if (!linked.length || !fulfillAsn.trim()) return;
    setFulfillSaving(true);
    setTimeout(() => {
      const cargoLines: ContainerCargoLine[] = linked.map((o) => {
        const qty = Number(asnLineQty[o.po] || o.orderedQty || 0);
        return {
          poNumber: o.po,
          product: o.item,
          item: `${qty.toLocaleString()} ${o.unit || 'Cases'} of ${o.item}`,
          quantity: qty,
          unit: o.unit || 'Cases',
          sku: `SKU-${o.po.slice(-4)}`,
          lineStatus: 'shipped',
        };
      });
      const primary = linked[0];
      const totalQty = cargoLines.reduce((s, c) => s + c.quantity, 0);
      const shipId = linked.length > 1 ? fulfillAsn.trim() : primary.po;

      setOrders((prev) =>
        prev.map((o) =>
          asnLinkedPoIds.includes(o.po)
            ? {
                ...o,
                confirmedQty: Number(asnLineQty[o.po] || o.orderedQty || 0),
                containerNumber: fulfillContainer || o.containerNumber,
                eta: fulfillEta || o.eta,
                shipmentNotes: fulfillNotes,
                asnNumber: fulfillAsn.trim(),
                shipDate: fulfillShipDate || o.shipDate,
                status: 'ASN Submitted' as const,
              }
            : o
        )
      );

      try {
        const key = 'freshguard-active-shipments-v5';
        const stored = localStorage.getItem(key);
        const list = stored ? JSON.parse(stored) : [];
        const idx = list.findIndex(
          (s: { id: string; asnNumber?: string }) =>
            s.id === shipId || s.id === primary.po || s.asnNumber === fulfillAsn.trim()
        );
        const patch = {
          id: shipId,
          quantity: totalQty,
          containerNumber: fulfillContainer || undefined,
          eta: fulfillEta || '3 Days',
          stage: 'packing',
          packingProgress: 70,
          psaSyncStatus: 'pending',
          vendor: primary.vendor,
          item:
            linked.length > 1
              ? `${linked.length} POs · ${totalQty.toLocaleString()} cases consolidated`
              : `${totalQty.toLocaleString()} ${primary.unit || 'Cases'} of ${primary.item}`,
          product:
            linked.length > 1
              ? `Multi-PO ASN (${cargoLines.map((c) => c.poNumber).join(', ')})`
              : primary.item,
          unit: primary.unit || 'Cases',
          asnNumber: fulfillAsn.trim(),
          shipDate: fulfillShipDate || undefined,
          shipmentNotes: fulfillNotes || undefined,
          packingSlipName: fulfillSlipName || undefined,
          packingSlipDataUrl: fulfillSlipDataUrl || undefined,
          packingSlipCapturedAt: fulfillSlipName ? new Date().toISOString() : undefined,
          cargoLines,
          destination: asnExtra.finalDestination || primary.destination || 'Chicago DC',
          origin: asnExtra.portOfLoading || asnExtra.shipFrom || 'Supplier packhouse',
          vesselName: asnExtra.vesselName,
          voyageNumber: asnExtra.voyageNumber,
          bookingNumber: asnExtra.bookingNumber,
          sealNumber: asnExtra.sealNumber,
          billOfLading: asnExtra.billOfLading,
          shipmentNumber: asnExtra.shipmentNumber,
          shippingMethod: asnExtra.shippingMethod,
          incoterms: asnExtra.incoterms,
          portOfLoading: asnExtra.portOfLoading,
          portOfDischarge: asnExtra.portOfDischarge,
          carrier: asnExtra.carrier,
          freightForwarder: asnExtra.freightForwarder,
          etaDate: asnExtra.etaDate,
          logisticsRouteAndProvider:
            asnExtra.carrier && asnExtra.portOfDischarge
              ? `${asnExtra.carrier} · ${asnExtra.portOfLoading || ''} → ${asnExtra.portOfDischarge}`
              : 'PSA Connected Haulage',
          transportMode: /air|flight|plane/i.test(asnExtra.shippingMethod || '')
            ? 'air'
            : /ocean|sea/i.test(asnExtra.shippingMethod || '')
              ? 'ocean'
              : 'road',
        };
        if (idx >= 0) list[idx] = { ...list[idx], ...patch };
        else
          list.unshift({
            ...patch,
            fleetSpecification: 'Active Refrigerated',
            logisticsRouteAndProvider: 'PSA Connected Haulage',
            status: 'on-time',
            origin: 'Supplier packhouse',
            temp: '4°C',
            route: 'Supplier → Chicago DC',
            date: new Date().toISOString(),
            transportMode: 'road',
          });
        localStorage.setItem(key, JSON.stringify(list));
      } catch {
        /* ignore */
      }

      setFulfillSaving(false);
      setAsnModalOpen(false);
      setAwardSuccessAlert(
        `${fulfillAsn.trim()}: ASN submitted for ${linked.length} PO(s)${
          fulfillContainer ? ` · container ${fulfillContainer}` : ''
        }. Open Logistics → Warehouse & Packing to finish dispatch.`
      );
      setTimeout(() => setAwardSuccessAlert(null), 7000);
    }, 700);
  };

  // Vendor Bidding Form state
  const [vendorName, setVendorName] = useState('Global Farms Suppliers');
  const [vendorPrice, setVendorPrice] = useState('23.50');
  const [vendorEta, setVendorEta] = useState('2026-06-03');
  const [vendorTerms, setVendorTerms] = useState('Controlled Atmosphere transport with wireless telemetry');
  const [vendorNotes, setVendorNotes] = useState('Continuous temperature logging, hydro-cooled immediately post-harvest.');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);

  // Vendor biological and fleet enhancements states
  const [vendorHarvestTimestamp, setVendorHarvestTimestamp] = useState('2026-05-24T06:00');
  const [vendorLogisticsRoute, setVendorLogisticsRoute] = useState('I-80 West Expressway - CoolWay Transit');
  const [vendorFleetSpec, setVendorFleetSpec] = useState<'Active Refrigerated' | 'Passive Cooling' | 'Ambient'>('Active Refrigerated');
  const [vendorPricePerCase, setVendorPricePerCase] = useState('24.50');
  const [vendorAvailableQty, setVendorAvailableQty] = useState('5000');

  React.useEffect(() => {
    if (!fullscreenPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenPanel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreenPanel]);

  React.useEffect(() => {
    if (selectedBid) {
      if (selectedBid.approvedVendors && selectedBid.approvedVendors.length > 0) {
        setVendorName(selectedBid.approvedVendors[0].name);
      } else {
        setVendorName('Global Farms Suppliers');
      }
      setVendorEta(selectedBid.deliveryDate || '');
      const baseEstimate = selectedBid.category === 'Dairy' ? '3.10' : selectedBid.category === 'Meat & Poultry' ? '12.50' : '23.50';
      setVendorPrice(baseEstimate);
      setVendorTerms('Controlled Atmosphere transport with wireless telemetry');
      setVendorNotes(`Hydro-cooled immediately post-harvest. Ready to ship in cold-chain to ${selectedBid.location.split(' (')[0]}.`);
      
      // Sync biological and cold-chain credentials
      setVendorHarvestTimestamp('2026-05-24T06:00');
      setVendorLogisticsRoute(selectedBid.category === 'Dairy' ? 'State Route 12 North - Express Shuttle' : 'I-80 West Expressway - CoolWay Transit');
      setVendorFleetSpec('Active Refrigerated');
      setVendorPricePerCase(baseEstimate);
      setVendorAvailableQty(selectedBid.quantity.toString());
    }
  }, [selectedBidId]);

  // Forms state for New Bid request
  const [searchQuery, setSearchQuery] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newCategory, setNewCategory] = useState('Fresh Produce');
  const [newQuantity, setNewQuantity] = useState(5000);
  const [newUnit, setNewUnit] = useState('Cases');
  const [newLocation, setNewLocation] = useState('Chicago DC East (Hub-1)');
  const [newDeliveryDate, setNewDeliveryDate] = useState('2026-06-10');
  const [newDeliveryEndDate, setNewDeliveryEndDate] = useState('2026-07-08');
  const [newBidDeadline, setNewBidDeadline] = useState('24 hours');
  const [newOrderType, setNewOrderType] = useState<OrderType>('one-time');
  const [newRepeatFrequency, setNewRepeatFrequency] = useState<RepeatFrequency>('weekly');
  const [newRepeatOccurrences, setNewRepeatOccurrences] = useState(4);
  const [selectedVendorNames, setSelectedVendorNames] = useState<string[]>([]);
  const [newMinTemp, setNewMinTemp] = useState('36');
  const [newMaxTemp, setNewMaxTemp] = useState('42');
  const [newHum, setNewHum] = useState('85');

  // Multi-faceted cold chain specifications inputs
  const [newTargetColdChainTemp, setNewTargetColdChainTemp] = useState('4'); // In °C
  const [newMaxTransitTime, setNewMaxTransitTime] = useState('36 hours');
  const [newMinShelfLife, setNewMinShelfLife] = useState('14 days');

  // Live negotiation chat per quote card
  const [negotiationsDB, setNegotiationsDB] = useState<Record<string, { sender: string; avatar: string; text: string; time: string; }[]>>({
    'QUOTE-001': [
      { sender: 'Sarah M. (Buyer)', avatar: 'SM', text: 'Global Farms, your cold-chain Fleet Specification is outstanding. Can you expedite dispatch by 4 hours to bypass the Midwest humidity surge?', time: '10:50 AM' },
      { sender: 'Global Farms Rep', avatar: 'GF', text: 'Understood. We can adjust the harvest and run pre-cooling 4 hours earlier to load by noon. Temperature will remain locked at 4°C.', time: '10:52 AM' }
    ],
    'QUOTE-002': [
      { sender: 'Sarah M. (Buyer)', avatar: 'SM', text: 'AgriGro, your passive cooling fleet is a slight concern for organic avocados. Do you have secondary thermal blankets?', time: '11:00 AM' },
      { sender: 'AgriGro Rep', avatar: 'AG', text: 'Yes, we pack with dual-layer reflective blankets and continuous TempTale tags. Real-time logging will be shared upon delivery.', time: '11:03 AM' }
    ]
  });

  const [quoteChatInputs, setQuoteChatInputs] = useState<Record<string, string>>({});

  const handleSendNegotiation = (quoteId: string, quoteVendor: string) => {
    const text = quoteChatInputs[quoteId];
    if (!text || !text.trim()) return;

    const senderName = isVendor ? `${quoteVendor} Rep (You)` : 'Sarah M. (You)';
    const senderAvatar = isVendor ? quoteVendor.slice(0, 2).toUpperCase() : 'SM';

    const newMsg = {
      sender: senderName,
      avatar: senderAvatar,
      text: text.trim(),
      time: 'Just now'
    };

    setNegotiationsDB(prev => ({
      ...prev,
      [quoteId]: [...(prev[quoteId] || []), newMsg]
    }));

    setQuoteChatInputs(prev => ({ ...prev, [quoteId]: '' }));

    // Simulate reactive vendor / buyer response to keep the dashboard interactive
    setTimeout(() => {
      const answers = isVendor 
        ? [
            `Confirmed receipt. Quality control is tracing this batch back to the nursery.`,
            `Excellent. This timeline aligns with our fresh shelf-life guideline.`,
            `Great. Please lock in the contract so we can reserve this reefer transport route.`,
          ]
        : [
            `Understood. Adding special instructions to the dispatch driver. Let's lock this in!`,
            `We can commit to those thermal requirements under a locked contract rate.`,
            `Acknowledged. We will review the biological logistics SLA metrics and optimize the route.`,
            `Active pre-chilling starts at harvest gate. Telemetry stream is active.`
          ];
      const selectedAnswer = answers[Math.floor(Math.random() * answers.length)];
      setNegotiationsDB(prev => ({
        ...prev,
        [quoteId]: [
          ...(prev[quoteId] || []),
          {
            sender: isVendor ? 'Sarah M. (Buyer)' : `${quoteVendor} Rep`,
            avatar: isVendor ? 'SM' : quoteVendor.slice(0, 2).toUpperCase(),
            text: selectedAnswer,
            time: 'Just now'
          }
        ]
      }));
    }, 1500);
  };

  // Interactive matched vendors based on chosen category
  const matchedVendorsLive = APPROVED_VENDORS_DB.filter(v => v.category === newCategory);

  React.useEffect(() => {
    setSelectedVendorNames(matchedVendorsLive.map((v) => v.name));
  }, [newCategory]);

  const selectedVendorsLive = matchedVendorsLive.filter((v) =>
    selectedVendorNames.includes(v.name)
  );

  const repeatPreviewDates =
    newOrderType === 'repeat'
      ? generateRepeatDeliveryDates(
          newDeliveryDate,
          newRepeatFrequency,
          newRepeatOccurrences,
          newDeliveryEndDate
        )
      : [newDeliveryDate];

  // Simulation steps states
  const [publishStep, setPublishStep] = useState<number>(0); // 0=idle, 1=analyzing, 2=dispatching, 3=complete
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Collaboration comments state
  const [currentComment, setCurrentComment] = useState('');
  const [commentsDB, setCommentsDB] = useState<Record<string, { sender: string; avatar: string; text: string; time: string; isSelf: boolean }[]>>({
    'REQ-2026-001': [
      { sender: 'Sarah M. (Buyer)', avatar: 'SM', text: "Global Farms' proposal has exceptional biological security ratings, but they have a slightly higher tariff. Let's inspect their temperature validation charts first.", time: '10:42 AM', isSelf: true },
      { sender: 'Global Farms Rep', avatar: 'GF', text: "We have fully pre-vetted refrigerated reefers on standby. We can support any temperature threshold constraints with live sensor feeds.", time: '10:49 AM', isSelf: false }
    ],
    'REQ-2026-002': [
      { sender: 'John D. (Scheduler)', avatar: 'JD', text: "Need Romaine Lettuce Hearts delivered quickly due to extreme stock depletion in Jersey area. FreshPack seems to match perfectly.", time: 'Yesterday', isSelf: false }
    ]
  });

  // Quotation comparison award flow
  const [awardingQuoteId, setAwardingQuoteId] = useState<string | null>(null);
  const [isAwardingInProgress, setIsAwardingInProgress] = useState(false);
  const [compareQuoteIds, setCompareQuoteIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  useEffect(() => {
    setCompareQuoteIds([]);
    setShowCompareModal(false);
  }, [selectedBidId]);

  const toggleCompareQuote = (quoteId: string) => {
    setCompareQuoteIds((prev) =>
      prev.includes(quoteId) ? prev.filter((id) => id !== quoteId) : [...prev, quoteId]
    );
  };

  const comparedQuotes = useMemo(() => {
    if (!selectedBid) return [];
    return selectedBid.quotations.filter((q) => compareQuoteIds.includes(q.id));
  }, [selectedBid, compareQuoteIds]);

  const compareWinners = useMemo(() => {
    if (comparedQuotes.length < 2) return null;
    const rows = comparedQuotes.map((q) => ({ q, m: getQuoteCompareMetrics(q) }));
    const bestCase = rows.reduce((a, b) => (a.m.caseRate <= b.m.caseRate ? a : b));
    const bestTrue = rows.reduce((a, b) => (a.m.trueCost <= b.m.trueCost ? a : b));
    const bestRel = rows.reduce((a, b) => (a.m.reliabilityNum >= b.m.reliabilityNum ? a : b));
    const bestRisk = rows.reduce((a, b) => {
      const rank = { low: 0, medium: 1, high: 2 };
      return rank[a.m.riskTone] <= rank[b.m.riskTone] ? a : b;
    });
    return {
      lowestCaseRateId: bestCase.q.id,
      lowestTrueCostId: bestTrue.q.id,
      highestReliabilityId: bestRel.q.id,
      lowestRiskId: bestRisk.q.id,
    };
  }, [comparedQuotes]);

  // Initiate simulation of vendor quotes
  const [isSimulatingQuotes, setIsSimulatingQuotes] = useState(false);

  const handlePostComment = () => {
    if (!currentComment.trim()) return;
    const newMsg = {
      sender: isVendor ? 'Global Farms Rep (You)' : 'Sarah M. (You)',
      avatar: isVendor ? 'GF' : 'SM',
      text: currentComment,
      time: 'Just now',
      isSelf: true
    };
    setCommentsDB(prev => ({
      ...prev,
      [selectedBid.id]: [...(prev[selectedBid.id] || []), newMsg]
    }));
    setCurrentComment('');
  };

  // Submit and automated publish request
  const handlePublishBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    if (selectedVendorsLive.length === 0) {
      setAwardSuccessAlert('Select at least one supplier before publishing the bid.');
      setTimeout(() => setAwardSuccessAlert(null), 4000);
      return;
    }
    if (newOrderType === 'repeat' && newDeliveryEndDate < newDeliveryDate) {
      setAwardSuccessAlert('Repeat delivery end date must be on or after the start date.');
      setTimeout(() => setAwardSuccessAlert(null), 4000);
      return;
    }

    const invitees = selectedVendorsLive;
    const cycleDates =
      newOrderType === 'repeat'
        ? generateRepeatDeliveryDates(
            newDeliveryDate,
            newRepeatFrequency,
            newRepeatOccurrences,
            newDeliveryEndDate
          )
        : [newDeliveryDate];

    setPublishStep(1);
    setSimulationLogs(['Extracting fresh biological & cold-chain specifications...', 'Category verified: ' + newCategory]);

    setTimeout(() => {
      setPublishStep(2);
      setSimulationLogs(prev => [
        ...prev,
        `Matching pre-vetted vendors in Category: ${newCategory}...`,
        `Inviting ${invitees.length} selected supplier${invitees.length === 1 ? '' : 's'} (not full network).`
      ]);
    }, 1200);

    setTimeout(() => {
      setPublishStep(3);
      setSimulationLogs(prev => [
        ...prev,
        `Dispatching secure RFQ payloads to selected vendor dashboards...`,
        'Encrypted cold-chain SLA targets attached successfully.',
        'Automated notifications dispatched to ' + invitees.map(v => v.name).join(', ') + '.',
        'Active listening for incoming bids...'
      ]);
    }, 2800);

    setTimeout(() => {
      // Create new bid record
      const generatedId = `REQ-2026-0${bidsList.length + 1}`;
      const newBid: BidRequest = {
        id: generatedId,
        item: `${newItemName} [${newGrade || 'Class A'}]`,
        category: newCategory,
        status: 'open',
        vendorsCount: 0,
        deadline: newBidDeadline,
        deliveryDate: newDeliveryDate,
        buyer: 'Sarah M.',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        quantity: newQuantity,
        unit: newUnit,
        location: newLocation,
        orderType: newOrderType,
        repeatCycle:
          newOrderType === 'repeat'
            ? {
                frequency: newRepeatFrequency,
                occurrences: cycleDates.length,
                startDate: newDeliveryDate,
                endDate: newDeliveryEndDate,
              }
            : undefined,
        specifications: {
          tempRange: `${newMinTemp}°F - ${newMaxTemp}°F`,
          humidity: `${newHum}% max`,
          sizeSpec: 'Default Quality specifications enforced',
          targetColdChainTemp: `${newTargetColdChainTemp}°C`,
          maxTransitTime: newMaxTransitTime,
          minShelfLife: newMinShelfLife
        },
        approvedVendors: [...invitees],
        quotations: []
      };

      setBidsList(prev => [newBid, ...prev]);
      setSelectedBidId(generatedId);
      setPublishStep(0);
      setIsModalOpen(false);

      // Clean form fields
      setNewItemName('');
    }, 5000);
  };

  // Simulate vendor quotes incoming
  const handleSimulateIncomingQuotes = () => {
    if (selectedBid.status !== 'open') return;
    setIsSimulatingQuotes(true);

    setTimeout(() => {
      const simulatedQuotes: Quotation[] = [
        {
          id: `QUOTE-${Date.now()}-1`,
          vendor: selectedBid.approvedVendors[0]?.name || 'Global Farms Suppliers',
          pricePerUnit: parseFloat((18.5 + Math.random() * 6).toFixed(2)),
          totalPrice: 0, 
          eta: selectedBid.deliveryDate,
          qualityIndex: `${85 + Math.floor(Math.random() * 15)}/100`,
          terms: 'Active Refrigerated Carrier',
          notes: 'Guaranteed OTIF delivery with calibrated wireless monitoring tags.',
          harvestTimestamp: new Date(Date.now() - 3600000 * 18).toISOString().slice(0, 16),
          logisticsRouteAndProvider: 'I-80 Corridor - Express Freightways',
          fleetSpecification: 'Active Refrigerated',
          pricePerCase: parseFloat((18.5 + Math.random() * 6).toFixed(2)),
          availableQuantity: selectedBid.quantity
        }
      ];

      if (selectedBid.approvedVendors.length > 1) {
        simulatedQuotes.push({
          id: `QUOTE-${Date.now()}-2`,
          vendor: selectedBid.approvedVendors[1]?.name || 'FreshPack Co.',
          pricePerUnit: parseFloat((17.0 + Math.random() * 5).toFixed(2)),
          totalPrice: 0,
          eta: selectedBid.deliveryDate,
          qualityIndex: `${82 + Math.floor(Math.random() * 15)}/100`,
          terms: 'Passive Cooling Container',
          notes: 'Pallets wrapped in thermal dry ice jackets. Route monitored.',
          harvestTimestamp: new Date(Date.now() - 3600000 * 32).toISOString().slice(0, 16),
          logisticsRouteAndProvider: 'Transit Highway 4 - SafeCold Logistics',
          fleetSpecification: 'Passive Cooling',
          pricePerCase: parseFloat((17.0 + Math.random() * 5).toFixed(2)),
          availableQuantity: selectedBid.quantity - 500
        });
      }

      // Fill in calculated totals
      simulatedQuotes.forEach(q => {
        q.totalPrice = Math.round((q.pricePerCase || q.pricePerUnit) * selectedBid.quantity);
      });

      setBidsList(prev => prev.map(b => {
        if (b.id === selectedBid.id) {
          return {
            ...b,
            status: 'review',
            vendorsCount: simulatedQuotes.length,
            quotations: simulatedQuotes
          };
        }
        return b;
      }));

      setIsSimulatingQuotes(false);
    }, 2000);
  };

  // Award Quotation & Generate Contract + PO
  const handleAwardQuotation = (quote: Quotation) => {
    setAwardingQuoteId(quote.id);
    setIsAwardingInProgress(true);

    setTimeout(() => {
      // 1. Update Bid Status
      setBidsList(prev => prev.map(b => {
        if (b.id === selectedBid.id) {
          return {
            ...b,
            status: 'awarded',
            awardedVendor: quote.vendor,
            awardedPrice: quote.totalPrice
          };
        }
        return b;
      }));

      // 2. Generate and Add Contract
      const ctrId = `CTR-2026-${100 + contracts.length + 1}`;
      const newContract: Contract = {
        id: ctrId,
        requirementId: selectedBid.id,
        vendor: quote.vendor,
        item: selectedBid.item,
        cat: selectedBid.category,
        duration: `May 2026 - Dec 2026`,
        contractValue: `$${quote.totalPrice.toLocaleString()}`,
        status: 'Active'
      };
      setContracts(prev => [newContract, ...prev]);

      // 3. Auto-generate Draft POs (one-time = 1 draft; repeat = one draft per cycle date)
      const unitPrice = quote.pricePerCase || quote.pricePerUnit;
      const deliveryDates =
        selectedBid.orderType === 'repeat' && selectedBid.repeatCycle
          ? generateRepeatDeliveryDates(
              selectedBid.repeatCycle.startDate || selectedBid.deliveryDate,
              selectedBid.repeatCycle.frequency,
              selectedBid.repeatCycle.occurrences,
              selectedBid.repeatCycle.endDate
            )
          : [selectedBid.deliveryDate];

      const draftPos: PurchaseOrder[] = deliveryDates.map((deliveryIso, i) => {
        const qty = selectedBid.quantity;
        return {
          po: `PO-2026-D${100 + orders.length + i + 1}`,
          requirementId: selectedBid.id,
          vendor: quote.vendor,
          item: selectedBid.item,
          amt: `$${Math.round(unitPrice * qty).toLocaleString()}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Draft',
          orderedQty: qty,
          unit: selectedBid.unit || 'Cases',
          destination: selectedBid.location,
          deliveryDate: deliveryIso,
          orderType: selectedBid.orderType,
          cycleIndex: i + 1,
          cycleTotal: deliveryDates.length,
          unitPrice,
        };
      });
      setOrders((prev) => [...draftPos, ...prev]);
      const cycleNote =
        selectedBid.orderType === 'repeat'
          ? `${draftPos.length} draft POs created on ${frequencyLabel(selectedBid.repeatCycle!.frequency)} cycle.`
          : '1 draft PO created.';
      setAwardSuccessAlert(
        `Award locked. ${cycleNote} Review drafts → confirm delivery date & qty to send to supplier.`
      );
      setTimeout(() => setAwardSuccessAlert(null), 8000);

      setIsAwardingInProgress(false);
      setAwardingQuoteId(null);
      
      // Auto routing switch to contracts or orders tab to showcase effect
      setActiveTab('orders');
    }, 2200);
  };

  // Vendor submits official quotation
  const handleVendorSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !vendorPricePerCase) return;
    setIsSubmittingBid(true);

    setTimeout(() => {
      const casePriceVal = parseFloat(vendorPricePerCase);
      const availableQtyVal = parseInt(vendorAvailableQty) || selectedBid.quantity;
      const matchedVendor = APPROVED_VENDORS_DB.find(v => v.name === vendorName);
      const sampleQuality = matchedVendor ? `${matchedVendor.score}/100` : '92/100';

      const newQuote: Quotation = {
        id: `QUOTE-VENDOR-${Date.now()}`,
        vendor: vendorName,
        pricePerUnit: casePriceVal,
        totalPrice: Math.round(casePriceVal * Math.min(availableQtyVal, selectedBid.quantity)),
        eta: vendorEta || selectedBid.deliveryDate,
        qualityIndex: sampleQuality,
        terms: `${vendorFleetSpec} Cold-chain fleet transit via ${vendorLogisticsRoute}`,
        notes: vendorNotes,
        harvestTimestamp: vendorHarvestTimestamp,
        logisticsRouteAndProvider: vendorLogisticsRoute,
        fleetSpecification: vendorFleetSpec,
        pricePerCase: casePriceVal,
        availableQuantity: availableQtyVal
      };

      setBidsList(prev => prev.map(b => {
        if (b.id === selectedBid.id) {
          const existingIdx = b.quotations.findIndex(q => q.vendor === vendorName);
          let updatedQuotes = [...b.quotations];
          if (existingIdx > -1) {
            updatedQuotes[existingIdx] = newQuote;
          } else {
            updatedQuotes.push(newQuote);
          }
          return {
            ...b,
            status: 'review',
            vendorsCount: updatedQuotes.length,
            quotations: updatedQuotes
          };
        }
        return b;
      }));

      setIsSubmittingBid(false);
      
      const formattedHarvest = vendorHarvestTimestamp ? vendorHarvestTimestamp.replace('T', ' ') : 'Just harvested';
      const newMsg = {
        sender: `${vendorName} (You)`,
        avatar: vendorName.slice(0, 2).toUpperCase(),
        text: `Submitted official quotes: $${casePriceVal.toFixed(2)}/case (Total: $${Math.round(casePriceVal * selectedBid.quantity).toLocaleString()}). Harvest Batch: ${formattedHarvest}. Fleet: ${vendorFleetSpec}. Route: ${vendorLogisticsRoute}. Available: ${availableQtyVal} Cases. Notes: ${vendorNotes}`,
        time: 'Just now',
        isSelf: true
      };
      setCommentsDB(prev => ({
        ...prev,
        [selectedBid.id]: [...(prev[selectedBid.id] || []), newMsg]
      }));
    }, 1200);
  };

  return (
    <div className={cn(pageShellClass, 'h-full flex flex-col')}>
      {fullscreenPanel && (
        <button
          type="button"
          aria-label="Exit fullscreen panel"
          className="fixed inset-0 z-[115] bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setFullscreenPanel(null)}
        />
      )}
      
      <PageHeader
        eyebrow="Requirement Initiation Engine"
        title={isVendor ? 'FreshGuard Vendor Hub' : 'Fresh Sourcing & Procurement'}
        subtitle={
          isVendor
            ? 'Receive automated buyer requirements, submit secure cold-chain bids, and view POs.'
            : 'Initiate biological-grade requirements, auto-notify pre-vetted vendors, and manage contracts.'
        }
      >
        {isVendor ? (
          <button
            onClick={() => {
              setActiveTab('bidding');
              setSearchQuery('');
              const firstOpen = bidsList.find((b) => b.status === 'open');
              if (firstOpen) setSelectedBidId(firstOpen.id);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-[#4684AD] hover:bg-[#3B7398] rounded-lg text-sm font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4 text-white" />
            Browse Open Market Tenders
          </button>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-[#4684AD] hover:bg-[#3B7398] rounded-lg text-sm font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            Initiate Fresh Requirement
          </button>
        )}
      </PageHeader>

      {/* GLOBAL PIPELINE METRICS (Top of Page) */}
      <div className={statGridClass}>
        <StatCard
          label={isVendor ? 'Your Active Bids' : 'Active RFQs'}
          value={isVendor ? '3 Active Bids' : '14 Open Pipelines'}
          tone="sky"
        />
        <StatCard
          label={isVendor ? 'Total Dispatched Volume' : 'Sourced Volume'}
          value={isVendor ? '12,400 Cases' : '45,000 Cases This Week'}
          tone="emerald"
        />
        <StatCard
          label={isVendor ? 'Avg Response Rating' : 'Avg. Vendor Response'}
          value={isVendor ? '98.5% (Excellent)' : '1.8 Hours'}
          tone="cyan"
        />
        <StatCard
          label={isVendor ? 'Win Rate' : 'AI Match Accuracy'}
          value={isVendor ? '42%' : '94.2%'}
          tone="amber"
        />
      </div>

      {/* Tabs Switcher */}
      <div className="flex space-x-1 bg-white dark:bg-slate-900 p-1 rounded-lg w-fit border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('bidding')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'bidding' 
              ? "bg-[#4684AD] text-white shadow-sm" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
          )}
        >
          Replenishment Sourcing (Bidding)
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'contracts' 
              ? "bg-[#4684AD] text-white shadow-sm" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
          )}
        >
          SLA Agreements
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'orders' 
              ? "bg-[#4684AD] text-white shadow-sm" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
          )}
        >
          Purchase Orders
        </button>
      </div>

      {/* Tab Content: Bidding View */}
      {activeTab === 'bidding' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-[580px] items-stretch">
          
          {/* COLUMN A: Requirements Pipeline (25% Width - lg:col-span-3) */}
          <div
            className={cn(
              'lg:col-span-3 flex flex-col gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden',
              fullscreenPanel === 'pipeline' && 'fixed inset-3 z-[120] lg:col-auto'
            )}
          >
            <div className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black font-mono uppercase tracking-wider text-[#C0D5E5]">
                  {isVendor ? 'Open Buyer Requests' : 'Active Demands'}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isVendor ? 'Available Orders' : 'Requirements Pipeline'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isVendor && (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="px-2.5 py-1.5 bg-[#4684AD] hover:bg-[#3B7398] text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>Create</span>
                  </button>
                )}
                <button
                  type="button"
                  title={fullscreenPanel === 'pipeline' ? 'Exit fullscreen' : 'Fullscreen'}
                  onClick={() => setFullscreenPanel((p) => (p === 'pipeline' ? null : 'pipeline'))}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#2F5472] dark:bg-white/10 dark:hover:bg-white/20 dark:text-[#C0D5E5]"
                >
                  {fullscreenPanel === 'pipeline' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="px-4 pb-4 flex flex-col gap-4 flex-1 min-h-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search demands..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-[#4684AD] focus:border-[#4684AD] outline-none placeholder:text-slate-400 dark:text-slate-100 transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <div className={cn(
              'flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin dark:scrollbar-thumb-slate-800',
              fullscreenPanel === 'pipeline' ? 'max-h-none' : 'max-h-[550px] lg:max-h-[640px]'
            )}>
              {bidsList
                .filter(b => b.item.toLowerCase().includes(searchQuery.toLowerCase()) || b.id.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((bid) => {
                  let badgeStyle = "";
                  let badgeText = "";
                  if (bid.status === "open") {
                    badgeStyle = "bg-blue-50 dark:bg-blue-955/40 text-blue-700 dark:text-blue-450 border border-blue-150/40 dark:border-blue-900/30";
                    badgeText = "Open for Bids";
                  } else if (bid.status === "review") {
                    badgeStyle = "bg-amber-50 dark:bg-amber-955/40 text-amber-700 dark:text-amber-450 border border-amber-150/40 dark:border-amber-900/30";
                    badgeText = "Reviewing Quotes";
                  } else {
                    badgeStyle = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-150/40 dark:border-emerald-900/30";
                    badgeText = "Awarded";
                  }

                  const isSelected = bid.id === selectedBidId;

                  return (
                    <button 
                      key={bid.id} 
                      onClick={() => {
                        setSelectedBidId(bid.id);
                        setSelectedQuoteId(null);
                        setAwardSuccessAlert(null);
                      }}
                      className={cn(
                        "w-full text-left p-3.5 rounded-xl border transition-all duration-150 relative overflow-hidden flex flex-col gap-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer",
                        isSelected 
                          ? "border-[#4684AD] dark:border-[#4684AD] bg-[#C0D5E5]/300/[0.04] dark:bg-[#C0D5E5]/300/[0.05] shadow-sm" 
                          : "border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900 hover:border-[#86A8C2] dark:hover:border-sky-700"
                      )}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono">{bid.id}</span>
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            'text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide',
                            bid.orderType === 'repeat'
                              ? 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                              : 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          )}>
                            {bid.orderType === 'repeat' ? 'Repeat' : 'One-time'}
                          </span>
                          <span className={cn(
                            "text-[11px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide",
                            badgeStyle
                          )}>
                            {badgeText}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-extrabold text-slate-800 dark:text-slate-205 text-xs leading-snug">
                        {isVendor 
                          ? `${bid.item.split(' [')[0]} • ${bid.quantity.toLocaleString()} ${bid.unit} Needed` 
                          : bid.item
                        }
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-800/50 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{bid.deadline}</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <div>{bid.quotations.length} {bid.quotations.length === 1 ? 'bid' : 'bids'}</div>
                        {bid.orderType === 'repeat' && bid.repeatCycle && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                            <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                              <RefreshCw className="w-3 h-3" />
                              <span>
                                {frequencyLabel(bid.repeatCycle.frequency)} × {bid.repeatCycle.occurrences}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
            </div>
          </div>
              {/* COLUMN B: BID RESOLUTION WORKSPACE/MATRIX (45% Width - lg:col-span-5) */}
          <div
            className={cn(
              'lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden relative',
              fullscreenPanel === 'workspace' ? 'fixed inset-3 z-[120] h-auto lg:col-auto' : 'h-[720px]'
            )}
          >
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                title={fullscreenPanel === 'workspace' ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={() => setFullscreenPanel((p) => (p === 'workspace' ? null : 'workspace'))}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900/90 text-[#C0D5E5] hover:bg-white dark:bg-slate-900 border border-sky-800/50 shadow-sm"
              >
                {fullscreenPanel === 'workspace' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
            {isVendor ? (
              // Vendor Workspace View
              <>
                {/* Formulate & Submit Quotation Header */}
                <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <div>
                    <h2 className="text-[13px] font-extrabold text-[#10B981] dark:text-[#34D399] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <FileSignature className="w-4 h-4" />
                      Formulate &amp; Submit Quotation
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Requirement targets for: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedBid.item}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/5 dark:bg-red-500/10 rounded-xl border border-amber-500/20 space-y-2 font-mono">
                    <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-widest block">Buyer's Strict Core Targets:</span>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-[11px]">
                        <Thermometer className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-slate-500 dark:text-slate-404">Target Temp:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedBid.specifications.targetColdChainTemp || '4°C'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-slate-500 dark:text-slate-404">Max Transit:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedBid.specifications.maxTransitTime || '36 hours'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-slate-500 dark:text-slate-404">Min Shelf Life:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedBid.specifications.minShelfLife || '14 days'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secure submission form */}
                <form onSubmit={handleVendorSubmitQuote} className="flex-1 p-5 overflow-y-auto space-y-5 custom-scrollbar bg-slate-50/20 dark:bg-slate-950/20">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-widest font-mono">Bidding As (Approved Supplier Profile)</label>
                    <select
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 outline-none shadow-sm"
                    >
                      {selectedBid.approvedVendors.map((av) => (
                        <option key={av.name} value={av.name}>
                          {av.name} (SLA Score: {av.score}%)
                        </option>
                      ))}
                      {!selectedBid.approvedVendors.some(av => av.name === vendorName) && (
                        <option value={vendorName}>{vendorName}</option>
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-widest font-mono">Your Case Rate Offer ($)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. 23.50"
                          value={vendorPricePerCase}
                          onChange={(e) => {
                            setVendorPricePerCase(e.target.value);
                            setVendorPrice(e.target.value);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-7 pr-3.5 py-2.5 text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 outline-none shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-widest font-mono">Available Quantity (Cases)</label>
                      <input 
                        type="number" 
                        required
                        placeholder="e.g. 5000"
                        value={vendorAvailableQty}
                        onChange={(e) => setVendorAvailableQty(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-widest font-mono">Harvest / Batch Timestamp</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={vendorHarvestTimestamp}
                        onChange={(e) => setVendorHarvestTimestamp(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 outline-none shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-widest font-mono">Your Shipping Fleet Spec</label>
                      <select
                        value={vendorFleetSpec}
                        onChange={(e) => setVendorFleetSpec(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 outline-none shadow-sm"
                      >
                        <option value="Active Refrigerated">Active Refrigerated</option>
                        <option value="Passive Cooling">Passive Cooling</option>
                        <option value="Ambient">Ambient / General Carrier</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-widest font-mono">Planned Logistics Transit Route</label>
                    <input 
                      type="text" 
                      value={vendorLogisticsRoute}
                      onChange={(e) => setVendorLogisticsRoute(e.target.value)}
                      placeholder="e.g. Interstate 80 East Expressway - CoolWay Transit"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 outline-none shadow-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-widest font-mono">Quality Assurance Notes &amp; Guarantees</label>
                    <textarea 
                      rows={2}
                      value={vendorNotes}
                      onChange={(e) => setVendorNotes(e.target.value)}
                      placeholder="Describe your cold-chain safety integrity measures..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 shadow-sm"
                    />
                  </div>

                  {selectedBid.quotations.some(q => q.vendor === vendorName) && (
                    <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-emerald-800 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Quotation active on server. Updates will overwrite.</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingBid}
                      className="w-full py-3 bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer uppercase tracking-widest font-mono"
                    >
                      {isSubmittingBid ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Locking &amp; Signing Parameters...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Lock Parameters &amp; Submit Bid to Buyer</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // Buyer View Component (SLA Comparison Matrix)
              <>
                {/* Center Header Details */}
                <div className="p-4 border-b border-slate-155 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <h2 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-205 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Received Quotes &amp; SLA Matrix
                      </h2>
                      <p className="text-[11px] text-slate-450 dark:text-slate-500 mt-0.5">
                        Viewing Bids for: <span className="font-bold text-slate-755 dark:text-slate-300">{selectedBid.item}</span>
                        {' · '}
                        <span className={selectedBid.orderType === 'repeat' ? 'text-violet-600 dark:text-violet-400 font-semibold' : ''}>
                          {selectedBid.orderType === 'repeat' && selectedBid.repeatCycle
                            ? `Repeat · ${frequencyLabel(selectedBid.repeatCycle.frequency)} · ${formatDisplayDate(selectedBid.repeatCycle.startDate)}${selectedBid.repeatCycle.endDate ? ` → ${formatDisplayDate(selectedBid.repeatCycle.endDate)}` : ''} · ${selectedBid.repeatCycle.occurrences} deliveries`
                            : 'One-time order'}
                        </span>
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {selectedBid.quotations.length >= 2 && selectedBid.status !== 'awarded' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (compareQuoteIds.length >= 2) {
                              setShowCompareModal(true);
                            } else if (compareQuoteIds.length === 0) {
                              setCompareQuoteIds(selectedBid.quotations.slice(0, 3).map((q) => q.id));
                              setShowCompareModal(true);
                            } else {
                              setAwardSuccessAlert('Select at least 2 bids to compare (use the checkboxes on each quote card).');
                              setTimeout(() => setAwardSuccessAlert(null), 4000);
                            }
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer border',
                            compareQuoteIds.length >= 2
                              ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700'
                              : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                          )}
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>
                            {compareQuoteIds.length >= 2
                              ? `Compare ${compareQuoteIds.length} Bids`
                              : 'Compare Bids'}
                          </span>
                        </button>
                      )}
                      {selectedBid.status === 'open' && (
                        <button
                          onClick={handleSimulateIncomingQuotes}
                          disabled={isSimulatingQuotes}
                          className="px-2.5 py-1 bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 rounded-lg text-[10.5px] font-bold transition-all shadow-sm flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          {isSimulatingQuotes ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>Awaiting Quotes...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                              <span>Simulate Response</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Biological Parameters */}
                  <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-850">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#A1A1AA] text-slate-400 dark:text-slate-500">Biological Parameters &amp; Requirements:</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] bg-[#C0D5E5]/30 dark:bg-sky-950/30 text-[#2F5472] dark:text-sky-404 border border-sky-100/50 dark:border-sky-900/30 px-1.5 py-0.5 rounded font-mono font-extrabold">
                        Target Temp: {selectedBid.specifications.targetColdChainTemp || '4°C'}
                      </span>
                      <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-404 border border-indigo-100/50 dark:border-indigo-900/30 px-1.5 py-0.5 rounded font-mono font-extrabold">
                        Max Transit: {selectedBid.specifications.maxTransitTime || '36 hrs'}
                      </span>
                      <span className="text-[11px] bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-404 border border-teal-100/50 dark:border-teal-900/30 px-1.5 py-0.5 rounded font-mono font-extrabold">
                        Min Shelf Life: {selectedBid.specifications.minShelfLife || '14 days'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Matrix Workspace Grid */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                  {selectedBid.quotations.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl p-8 text-center space-y-3 bg-slate-50/20 dark:bg-slate-950/20 h-full flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto animate-pulse">
                        <Clock className="w-5 h-5 text-slate-400 dark:text-slate-505" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-755 dark:text-slate-300">Automated RFQ pending response</h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                          Pre-approved matching vendors match in background. Use the "Simulate Response" tool above to instantly trigger secure incoming bids.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {compareQuoteIds.length >= 1 && selectedBid.status !== 'awarded' && (
                        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2.5 shadow-sm">
                          <span className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-200">
                            {compareQuoteIds.length} bid{compareQuoteIds.length === 1 ? '' : 's'} selected for comparison
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCompareQuoteIds([])}
                              className="text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-300 hover:underline"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              disabled={compareQuoteIds.length < 2}
                              onClick={() => setShowCompareModal(true)}
                              className="px-3 py-1.5 rounded-lg text-[10.5px] font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center gap-1"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              Open comparison
                            </button>
                          </div>
                        </div>
                      )}
                      {selectedBid.quotations.map((quote) => {
                        // AI risk parameters scoring based on fleet specifications
                        const isRefrigerated = quote.fleetSpecification === 'Active Refrigerated';
                        const isPassive = quote.fleetSpecification === 'Passive Cooling';
                        
                        let riskBadgeBg = 'bg-red-50 dark:bg-red-950/25 border-red-200/50 dark:border-red-800/40 text-red-700 dark:text-red-400';
                        let riskLabel = 'Critical Risk - 65% Shelf-Life Degradation Zone';
                        let wastePct = 15.0;
                        
                        if (isRefrigerated) {
                          riskBadgeBg = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400';
                          riskLabel = 'Low Sourcing Risk - 96% Probable Shelf-Life Retention (Optimized route with stable micro-climatic controls)';
                          wastePct = 1.2;
                        } else if (isPassive) {
                          riskBadgeBg = 'bg-amber-100/60 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400';
                          riskLabel = 'Increased Risk - 84% Probable Shelf-Life Retention (Midwest thermal spike zones ahead)';
                          wastePct = 5.4;
                        }

                        // Harvest Age Computation
                        let harvestAgeText = 'N/A';
                        if (quote.harvestTimestamp) {
                          const hrs = Math.round((Date.now() - new Date(quote.harvestTimestamp).getTime()) / 3600000);
                          harvestAgeText = hrs > 0 ? `${hrs} hrs post-harvest` : 'Freshly harvested';
                        }

                        // AI True Cost Calculation
                        const baseQuotePrice = quote.totalPrice;
                        const computedWasteValue = Math.round(baseQuotePrice * (wastePct / 100));
                        const aiTrueCostValue = baseQuotePrice + computedWasteValue;

                        return (
                          <div 
                            key={quote.id}
                            className={cn(
                              "border rounded-2xl transition-all relative overflow-hidden bg-white dark:bg-slate-900 flex flex-col h-auto min-h-[max-content] p-6 shadow-sm gap-6",
                              selectedBid.awardedVendor === quote.vendor
                                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/5 dark:bg-emerald-955/5" 
                                : compareQuoteIds.includes(quote.id)
                                  ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20"
                                  : "border-slate-200 dark:border-slate-800"
                            )}
                          >
                            {/* Left Side: Supplier & Logistics Attributes Grid */}
                            <div className="w-full flex flex-col gap-5 border-b border-slate-150 dark:border-slate-800 pb-6">
                              
                              {/* Card Header Info */}
                              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                    {selectedBid.status !== 'awarded' && selectedBid.quotations.length >= 2 && (
                                      <label
                                        className="inline-flex items-center gap-1.5 cursor-pointer mr-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={compareQuoteIds.includes(quote.id)}
                                          onChange={() => toggleCompareQuote(quote.id)}
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                                          Compare
                                        </span>
                                      </label>
                                    )}
                                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-tight">{quote.vendor}</h4>
                                    <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                                      Reliability: {quote.qualityIndex}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-404 font-mono">
                                    Route: {quote.logisticsRouteAndProvider || 'Carrier Standby'}
                                  </p>
                                </div>

                                <div className="text-left sm:text-right shrink-0">
                                  <div className="text-xs font-bold text-slate-400 dark:text-slate-505">
                                    Submitted Case Rate
                                  </div>
                                  <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                                    ${(quote.pricePerCase || quote.pricePerUnit).toFixed(2)}
                                  </div>
                                  <span className="text-[11px] text-slate-400 dark:text-slate-550 block mt-0.5">
                                    Base Sourcing Value: ${baseQuotePrice.toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Typography Attributes Grid (Responsively configured grid) */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 bg-slate-55 dark:bg-slate-950 rounded-xl text-xs border border-slate-200/50 dark:border-slate-800 w-full max-w-full">
                                <div>
                                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Est. Delivery</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">{quote.eta}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Harvest Batch Age</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">{harvestAgeText}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Thermal Fleet Spec</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">{quote.fleetSpecification || 'Ambient'}</span>
                                </div>
                              </div>

                              {/* AI Risk Segment */}
                              <div className="space-y-1.5 font-sans w-full">
                                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">AI Shrinkage &amp; Biological Prediction</span>
                                <div className={cn("px-3.5 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2.5", riskBadgeBg)}>
                                  <Sparkles className="w-4 h-4 shrink-0 animate-pulse text-indigo-500 dark:text-indigo-400" />
                                  <span>{riskLabel}</span>
                                </div>
                              </div>

                              {/* AI True Cost badge (Neat nested full-width box with absolutely no negative margins or absolute positions) */}
                              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-805 flex flex-col gap-3 text-xs w-full max-w-full">
                                <div>
                                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold">
                                    <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>AI Sourcing True-Cost Analysis</span>
                                  </div>
                                  <p className="text-[11px] text-slate-550 dark:text-slate-404 mt-1">
                                    Reflects base quote + cold-chain route shrinkage/waste ({wastePct}%) prediction.
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-lg border border-slate-150 dark:border-slate-800/80 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <span className="text-slate-450 dark:text-slate-505 text-[10.5px] font-bold uppercase tracking-wider">True Sourcing Cost</span>
                                  <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 px-3 py-1 rounded border border-indigo-100/50 dark:border-indigo-950/10 font-mono">${aiTrueCostValue.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Award button */}
                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-1 w-full">
                                <span className="text-[11px] text-slate-400 max-w-[100%] sm:max-w-[60%]">
                                  Notes: <em className="text-slate-650 dark:text-slate-350">{quote.notes}</em>
                                </span>

                                {selectedBid.status !== 'awarded' ? (
                                  <button
                                    onClick={() => handleAwardQuotation(quote)}
                                    disabled={isAwardingInProgress}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-505 dark:hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                                  >
                                    {isAwardingInProgress && awardingQuoteId === quote.id ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Awarding...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-white" />
                                        <span>Award Sourcing Contract</span>
                                      </>
                                    )}
                                  </button>
                                ) : selectedBid.awardedVendor === quote.vendor ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-955/40 text-emerald-800 dark:text-emerald-400 shrink-0">
                                    <Award className="w-3.5 h-3.5" />
                                    Authorized Contract
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-550 italic font-medium shrink-0">Bidding Closed</span>
                                )}
                              </div>
                            </div>

                            {/* Right Side: Micro-Negotiation Live Chat */}
                            <div className="w-full flex flex-col justify-between bg-slate-50/70 dark:bg-slate-950/40 relative h-auto min-h-[300px] p-4 rounded-xl border border-slate-150 dark:border-slate-805/40">
                              
                              {/* Chat Header */}
                              <div className="border-b border-slate-200/50 dark:border-slate-800 pb-2 mb-3 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  Supplier Negotiations
                                </span>
                                <span className="text-[11px] text-slate-415 dark:text-slate-550 font-mono">Live Link</span>
                              </div>

                              {/* Chat Message Scroll frame */}
                              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs max-h-[180px] custom-scrollbar">
                                {(negotiationsDB[quote.id] || []).map((msg, index) => {
                                  const isSelf = msg.sender.includes('(You)');
                                  const isBuyer = msg.sender.includes('Sarah M.');
                                  return (
                                    <div key={index} className={cn("flex flex-col gap-1", isSelf ? "items-end" : "items-start")}>
                                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-505 font-bold">
                                        <span>{msg.sender.split(' Rep')[0]}</span>
                                        <span>•</span>
                                        <span>{msg.time}</span>
                                      </div>
                                      <div className={cn(
                                        "p-2 rounded-xl text-[11px] leading-snug break-words max-w-[90%]",
                                        isSelf 
                                          ? "bg-slate-800 text-white rounded-tr-none dark:bg-slate-705" 
                                          : isBuyer
                                            ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300 border border-indigo-150/40 dark:border-indigo-900/20 rounded-tl-none font-medium"
                                            : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-202 border border-slate-200 dark:border-slate-805 rounded-tl-none"
                                      )}>
                                        {msg.text}
                                      </div>
                                    </div>
                                  );
                                })}

                                {(negotiationsDB[quote.id] || []).length === 0 && (
                                  <div className="text-center py-6 text-[11px] text-slate-400 italic">
                                    No live negotiation comments initialized yet. Submit a comment below.
                                  </div>
                                )}
                              </div>

                              {/* Chat Message Input form */}
                              <div className="mt-4 border-t border-slate-200/50 dark:border-slate-800/80 pt-3">
                                <div className="sm:relative flex items-center gap-1.5">
                                  <input 
                                    type="text" 
                                    required
                                    placeholder={`Negotiate with ${quote.vendor.split(' ')[0]}...`}
                                    value={quoteChatInputs[quote.id] || ''}
                                    onChange={(e) => {
                                      const txt = e.target.value;
                                      setQuoteChatInputs(prev => ({ ...prev, [quote.id]: txt }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSendNegotiation(quote.id, quote.vendor);
                                      }
                                    }}
                                    className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-805 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <button 
                                    onClick={() => handleSendNegotiation(quote.id, quote.vendor)}
                                    className="p-1.5 bg-emerald-600 text-white dark:bg-emerald-505 hover:bg-emerald-700 rounded-md shadow-sm transition-colors cursor-pointer shrink-0"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* COLUMN C: COLLABORATION WORKSPACE & DISPATCH LOGS (30% Width - lg:col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-6 self-stretch">
            
            {/* Comments / Collaboration Chat Workspace */}
            <div
              className={cn(
                'bg-slate-55 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-inner',
                fullscreenPanel === 'collab' ? 'fixed inset-3 z-[120] h-auto' : 'h-[320px]'
              )}
            >
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-202 uppercase tracking-wider truncate">
                    {isVendor ? 'Buyer-Supplier Collaboration' : 'Collaboration & Chat'}
                  </h3>
                </div>
                <button
                  type="button"
                  title={fullscreenPanel === 'collab' ? 'Exit fullscreen' : 'Fullscreen'}
                  onClick={() => setFullscreenPanel((p) => (p === 'collab' ? null : 'collab'))}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 shrink-0"
                >
                  {fullscreenPanel === 'collab' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {(commentsDB[selectedBid.id] || []).map((msg, i) => (
                  <div key={i} className={cn("flex gap-2.5", msg.isSelf ? "flex-row-reverse" : "")}>
                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {msg.avatar}
                    </div>
                    <div className={cn("flex flex-col max-w-[80%]", msg.isSelf ? "items-end" : "items-start")}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{msg.sender}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{msg.time}</span>
                      </div>
                      <div className={cn(
                        "text-xs rounded-lg p-2.5 shadow-sm",
                        msg.isSelf 
                          ? "bg-emerald-600 text-white rounded-tr-none" 
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-202 rounded-tl-none"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-150 dark:border-slate-800 rounded-b-xl">
                <form onSubmit={(e) => { e.preventDefault(); handlePostComment(); }} className="relative flex items-center">
                  <input 
                    type="text" 
                    placeholder={isVendor ? "Send direct message or proposal to buyer..." : "Add biological audit or comment..."}
                    value={currentComment || ''}
                    onChange={(e) => setCurrentComment(e.target.value)}
                    className="w-full bg-slate-55/60 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-3 pr-10 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-100"
                  />
                  <button 
                    type="submit" 
                    className="absolute right-1.5 p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Automation audit log trail */}
            <div
              className={cn(
                'bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850/80 space-y-3',
                fullscreenPanel === 'audit' && 'fixed inset-3 z-[120] overflow-y-auto'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {isVendor ? 'Supplier Dispatch Integration SLA' : 'Automated RFQ System Status'}
                </h4>
                <button
                  type="button"
                  title={fullscreenPanel === 'audit' ? 'Exit fullscreen' : 'Fullscreen'}
                  onClick={() => setFullscreenPanel((p) => (p === 'audit' ? null : 'audit'))}
                  className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 shrink-0"
                >
                  {fullscreenPanel === 'audit' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-500 dark:text-slate-404">
                {isVendor ? (
                  <>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                      <span>Double-vetted cold range trucks ready for immediate dispatch at harvest gate.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                      <span>Auto-syncs telemetry logs directly into Buyer's tracking system on dispatch.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#C0D5E5]/300 rounded-full mt-1 shrink-0 animate-ping"></div>
                      <span>Active SLA validation engine pre-screening thermal and biological boundaries.</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                      <span>Matches category approved list of vended specialists instantly on save.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                      <span>Enforces thermal limits biological standards SLA directly.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#C0D5E5]/300 rounded-full mt-1 shrink-0 animate-ping"></div>
                      <span>Listening on secure webhooks for vendor pricing updates.</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

          </div>

            </div>
      )}

      {/* Tab Content: contracts list table */}
      {activeTab === 'contracts' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <DataTable
            data={isVendor ? contracts.filter((c) => c.vendor === 'Global Farms Suppliers') : contracts}
            columns={[
              {
                key: 'id',
                label: 'Contract SLA ID',
                className: 'font-bold text-slate-900 dark:text-slate-100 font-mono text-[11px]',
              },
              {
                key: 'vendor',
                label: 'Approved Vendor Partner',
                filterType: 'select',
                className: 'font-semibold text-slate-800 dark:text-slate-200',
              },
              {
                key: 'cat',
                label: 'Fresh Category',
                filterType: 'select',
                render: (row) => (
                  <span className="px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {row.cat}
                  </span>
                ),
              },
              {
                key: 'item',
                label: 'Requirement Ref / Item Name',
                getValue: (row) => `${row.item} ${row.requirementId}`,
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{row.item}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Ref: {row.requirementId}</div>
                  </div>
                ),
              },
              {
                key: 'duration',
                label: 'SLA Duration',
                className: 'text-slate-600 dark:text-slate-400',
              },
              {
                key: 'contractValue',
                label: 'Volume Commitment Value',
                className: 'font-bold text-emerald-600 dark:text-emerald-400',
              },
              {
                key: 'status',
                label: 'Operational Status',
                align: 'right',
                filterType: 'select',
                render: (row) => (
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-sm',
                      row.status === 'Active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
                    )}
                  >
                    {row.status}
                  </span>
                ),
              },
            ] satisfies DataTableColumn<Contract>[]}
            rowKey={(row) => row.id}
            title="Active SLA Sourcing Agreements & Contracts"
            subtitle="Filter, sort, and export contract ledger"
            excelFileName="procurement-contracts.xls"
            emptyMessage="No contracts match the current filters."
            initialFilterOpen={false}
          />
        </div>
      )}

      {/* Tab Content: purchase orders tracker table */}
      {activeTab === 'orders' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <DataTable
            data={
              isVendor
                ? orders.filter((o) => o.vendor === 'Global Farms Suppliers' && o.status !== 'Draft')
                : orders
            }
            columns={[
              {
                key: 'po',
                label: 'PO Number',
                className: 'font-bold text-slate-900 dark:text-slate-100 font-mono text-[11px]',
              },
              {
                key: 'vendor',
                label: 'Vendor Partner',
                filterType: 'select',
                className: 'font-semibold text-slate-800 dark:text-slate-200',
              },
              {
                key: 'item',
                label: 'Fresh Goods Description',
                getValue: (row) => `${row.item} ${row.requirementId}`,
                render: (row) => (
                  <div>
                    <div className="font-semibold">{row.item}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">Ref: {row.requirementId}</div>
                  </div>
                ),
              },
              {
                key: 'amt',
                label: 'Total Amount',
                className: 'text-slate-900 dark:text-slate-100 font-extrabold text-[12px]',
              },
              {
                key: 'date',
                label: 'Delivery date',
                getValue: (row) => row.deliveryDate || row.date,
                className: 'text-slate-650 dark:text-slate-400',
                render: (row) => (
                  <div>
                    <div>{row.deliveryDate ? formatDisplayDate(row.deliveryDate) : row.date}</div>
                    {row.orderType === 'repeat' && row.cycleIndex != null && (
                      <div className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                        Cycle {row.cycleIndex}/{row.cycleTotal}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'orderedQty',
                label: 'Ordered qty',
                getValue: (row) => String(row.orderedQty ?? ''),
                render: (row) => (
                  <span className="font-semibold tabular-nums">
                    {row.orderedQty != null
                      ? `${row.orderedQty.toLocaleString()} ${row.unit || 'Cases'}`
                      : '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Fulfillment Status',
                filterType: 'select',
                render: (row) => (
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shadow-sm',
                      row.status === 'Fulfilled'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400'
                        : row.status === 'In Transit'
                          ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400'
                          : row.status === 'Draft'
                            ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300'
                          : row.status === 'Confirmed'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                            : row.status === 'Acknowledged'
                              ? 'bg-[#C0D5E5]/40 dark:bg-sky-950/40 text-[#2F5472] dark:text-[#C0D5E5]'
                              : row.status === 'ASN Submitted'
                                ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300'
                                : row.status === 'Processing'
                                  ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-400 animate-pulse'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    )}
                  >
                    {row.status}
                  </span>
                ),
              },
              {
                key: 'action',
                label: 'System Action',
                align: 'right',
                sortable: false,
                filterable: false,
                getValue: () => '',
                render: (row) => {
                  if (!isVendor && row.status === 'Draft') {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setFulfillQty(String(row.orderedQty || ''));
                          setDraftDeliveryDate(row.deliveryDate || '');
                          setPoModal({ po: row, mode: 'draft' });
                        }}
                        className="px-2.5 py-1 rounded border border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-600 hover:text-white transition-all text-[11px] font-bold"
                      >
                        Review &amp; Confirm
                      </button>
                    );
                  }
                  if (isVendor && row.status === 'Confirmed') {
                    return (
                      <button
                        type="button"
                        onClick={() => setPoModal({ po: row, mode: 'detail' })}
                        className="px-2.5 py-1 rounded border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white transition-all text-[11px] font-bold"
                      >
                        View &amp; Acknowledge
                      </button>
                    );
                  }
                  if (isVendor && row.status === 'Acknowledged') {
                    return (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPoModal({ po: row, mode: 'detail' })}
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-[11px] font-bold"
                        >
                          View PO
                        </button>
                        <button
                          type="button"
                          onClick={() => openAsnModal([row])}
                          className="px-2.5 py-1 rounded border border-[#4684AD]/40 text-[#2F5472] dark:text-[#C0D5E5] hover:bg-[#4684AD] hover:text-white transition-all text-[11px] font-bold"
                        >
                          Update ASN
                        </button>
                      </div>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => setPoModal({ po: row, mode: 'detail' })}
                      className="px-2.5 py-1 rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[11px] font-bold"
                    >
                      View PO
                    </button>
                  );
                },
              },
            ] satisfies DataTableColumn<PurchaseOrder>[]}
            rowKey={(row) => row.po}
            title={isVendor ? 'Your purchase orders' : 'Purchase Orders Issued & Auto-Trackers'}
            subtitle={
              isVendor
                ? 'Acknowledge POs, create ASN (multi-PO / one container), or update ASN before dispatch'
                : 'Draft POs from awarded bids — confirm delivery date & qty to send to supplier'
            }
            excelFileName="procurement-orders.xls"
            emptyMessage="No purchase orders match the current filters."
            initialFilterOpen={false}
            toolbarExtra={
              isVendor ? (
                <button
                  type="button"
                  onClick={() => openAsnModal([])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4684AD] hover:bg-[#4684AD] text-white text-[11px] font-bold uppercase tracking-wide"
                >
                  <Package className="w-3.5 h-3.5" />
                  Create ASN
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {/* PO detail / Acknowledge + ASN modals */}
      <AnimatePresence>
        {poModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
              aria-label="Close"
              onClick={() => !fulfillSaving && setPoModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-5 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    {poModal.mode === 'draft' ? 'Review draft PO' : 'Purchase order details'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    {poModal.po.po} · {poModal.po.status}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={fulfillSaving}
                  onClick={() => setPoModal(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {poModal.mode === 'draft' ? (
                <div className="p-5 space-y-3 overflow-y-auto">
                  <p className="text-xs text-slate-500">
                    {poModal.po.item}
                    {poModal.po.orderType === 'repeat' && poModal.po.cycleIndex != null && (
                      <span className="ml-1 text-violet-600 font-semibold">
                        · Cycle {poModal.po.cycleIndex}/{poModal.po.cycleTotal}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 px-3 py-2">
                    Draft POs are buyer-only. Adjust delivery date and qty, then confirm to send to the supplier.
                  </p>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Delivery date</span>
                    <input
                      type="date"
                      value={draftDeliveryDate}
                      onChange={(e) => setDraftDeliveryDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Quantity</span>
                    <input
                      type="number"
                      min={1}
                      value={fulfillQty}
                      onChange={(e) => setFulfillQty(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-semibold"
                    />
                  </label>
                  <div className="text-xs text-slate-500">
                    Vendor: <strong>{poModal.po.vendor}</strong>
                    {poModal.po.unitPrice != null && fulfillQty && (
                      <> · Est. amount: <strong>${Math.round(poModal.po.unitPrice * Number(fulfillQty || 0)).toLocaleString()}</strong></>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={fulfillSaving || !fulfillQty || !draftDeliveryDate}
                    onClick={() => {
                      const qty = Number(fulfillQty);
                      if (!qty || qty <= 0 || !draftDeliveryDate) return;
                      setFulfillSaving(true);
                      setTimeout(() => {
                        const amt =
                          poModal.po.unitPrice != null
                            ? `$${Math.round(poModal.po.unitPrice * qty).toLocaleString()}`
                            : poModal.po.amt;
                        setOrders((prev) =>
                          prev.map((o) =>
                            o.po === poModal.po.po
                              ? {
                                  ...o,
                                  orderedQty: qty,
                                  deliveryDate: draftDeliveryDate,
                                  amt,
                                  status: 'Confirmed',
                                }
                              : o
                          )
                        );
                        setFulfillSaving(false);
                        setPoModal(null);
                        setAwardSuccessAlert(
                          `${poModal.po.po} confirmed and sent to ${poModal.po.vendor}. Supplier can now acknowledge.`
                        );
                        setTimeout(() => setAwardSuccessAlert(null), 6000);
                      }, 500);
                    }}
                    className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider"
                  >
                    {fulfillSaving ? 'Sending…' : 'Confirm & send to supplier'}
                  </button>
                </div>
              ) : poModal.mode === 'detail' ? (
                <div className="p-5 space-y-4 overflow-y-auto">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 p-3">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Item</dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{poModal.po.item}</dd>
                      <dd className="text-[11px] text-slate-400 font-mono mt-1">Ref: {poModal.po.requirementId}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vendor</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{poModal.po.vendor}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount</dt>
                      <dd className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">{poModal.po.amt}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ordered qty</dt>
                      <dd className="font-semibold tabular-nums mt-0.5">
                        {(poModal.po.orderedQty ?? 0).toLocaleString()} {poModal.po.unit || 'Cases'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery date</dt>
                      <dd className="mt-0.5 text-slate-700 dark:text-slate-300">
                        {poModal.po.deliveryDate ? formatDisplayDate(poModal.po.deliveryDate) : poModal.po.date}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Issue date</dt>
                      <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{poModal.po.date}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Destination</dt>
                      <dd className="mt-0.5 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {poModal.po.destination || 'Chicago DC'}
                      </dd>
                    </div>
                    {poModal.po.asnNumber && (
                      <>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ASN #</dt>
                          <dd className="font-mono text-xs mt-0.5">{poModal.po.asnNumber}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Container</dt>
                          <dd className="font-mono text-xs mt-0.5">{poModal.po.containerNumber || '—'}</dd>
                        </div>
                        {poModal.po.shipDate && (
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ship date</dt>
                            <dd className="mt-0.5 text-slate-700 dark:text-slate-300">
                              {/^\d{4}-\d{2}-\d{2}$/.test(poModal.po.shipDate)
                                ? formatDisplayDate(poModal.po.shipDate)
                                : poModal.po.shipDate}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>

                  {isVendor && poModal.po.status === 'Confirmed' && (
                    <button
                      type="button"
                      disabled={fulfillSaving}
                      onClick={() => {
                        setFulfillSaving(true);
                        setTimeout(() => {
                          setOrders((prev) =>
                            prev.map((o) =>
                              o.po === poModal.po.po ? { ...o, status: 'Acknowledged' } : o
                            )
                          );
                          setFulfillSaving(false);
                          setPoModal(null);
                          setAwardSuccessAlert(
                            `${poModal.po.po} acknowledged. You can now submit ASN details.`
                          );
                          setTimeout(() => setAwardSuccessAlert(null), 6000);
                        }, 500);
                      }}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {fulfillSaving ? 'Updating…' : 'Acknowledge PO'}
                    </button>
                  )}

                  {isVendor && poModal.po.status === 'Acknowledged' && (
                    <button
                      type="button"
                      onClick={() => {
                        const row = poModal.po;
                        setPoModal(null);
                        openAsnModal([row]);
                      }}
                      className="w-full py-2.5 rounded-lg bg-[#4684AD] hover:bg-[#4684AD] text-white text-xs font-black uppercase tracking-wider"
                    >
                      Continue to ASN details
                    </button>
                  )}
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Update ASN — multi-PO + packing slip */}
      <AnimatePresence>
        {asnModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
              aria-label="Close"
              onClick={() => !fulfillSaving && setAsnModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-5 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Advance ship notice (ASN)</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Create ASN directly · link one or many POs to one container · upload packing slip
                  </p>
                </div>
                <button
                  type="button"
                  disabled={fulfillSaving}
                  onClick={() => setAsnModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <label className="block space-y-1.5 rounded-xl border border-dashed border-[#86A8C2] dark:border-sky-800 bg-[#C0D5E5]/50 dark:bg-sky-950/20 p-3 cursor-pointer hover:bg-[#C0D5E5]/30 dark:hover:bg-sky-950/40 transition-colors">
                  <span className="text-[11px] font-bold uppercase text-[#2F5472] dark:text-[#C0D5E5] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Upload packing slip / ASN image
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,image/*,application/pdf"
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#4684AD] file:text-white file:text-[11px] file:font-bold file:uppercase"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePackingSlipUpload(f);
                    }}
                  />
                  {fulfillSlipName && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      Attached: {fulfillSlipName}
                    </p>
                  )}
                  {slipScanMsg && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">{slipScanMsg}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Captures ASN #, container, seal, vessel/voyage, BOL, booking, ports, ETA, linked POs, and package totals.
                    Try the{' '}
                    <a
                      href="/samples/asn-sample-multi-po.png"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#2F5472] dark:text-[#C0D5E5] font-semibold underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      sample multi-PO ASN
                    </a>{' '}
                    if testing image upload.
                  </p>
                </label>

                {(asnExtra.sealNumber ||
                  asnExtra.vesselName ||
                  asnExtra.billOfLading ||
                  asnExtra.portOfDischarge) && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 p-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="col-span-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Captured logistics visibility
                    </div>
                    {asnExtra.shipmentNumber && (
                      <div>
                        <span className="text-slate-400">Shipment #</span>
                        <div className="font-mono font-semibold">{asnExtra.shipmentNumber}</div>
                      </div>
                    )}
                    {asnExtra.sealNumber && (
                      <div>
                        <span className="text-slate-400">Seal</span>
                        <div className="font-semibold">{asnExtra.sealNumber}</div>
                      </div>
                    )}
                    {asnExtra.vesselName && (
                      <div>
                        <span className="text-slate-400">Vessel</span>
                        <div className="font-semibold">{asnExtra.vesselName}</div>
                      </div>
                    )}
                    {asnExtra.voyageNumber && (
                      <div>
                        <span className="text-slate-400">Voyage</span>
                        <div className="font-semibold">{asnExtra.voyageNumber}</div>
                      </div>
                    )}
                    {asnExtra.billOfLading && (
                      <div>
                        <span className="text-slate-400">BOL</span>
                        <div className="font-mono font-semibold">{asnExtra.billOfLading}</div>
                      </div>
                    )}
                    {asnExtra.bookingNumber && (
                      <div>
                        <span className="text-slate-400">Booking</span>
                        <div className="font-mono font-semibold">{asnExtra.bookingNumber}</div>
                      </div>
                    )}
                    {asnExtra.shippingMethod && (
                      <div>
                        <span className="text-slate-400">Method</span>
                        <div className="font-semibold">{asnExtra.shippingMethod}</div>
                      </div>
                    )}
                    {asnExtra.incoterms && (
                      <div>
                        <span className="text-slate-400">Incoterms</span>
                        <div className="font-semibold">{asnExtra.incoterms}</div>
                      </div>
                    )}
                    {asnExtra.portOfLoading && (
                      <div>
                        <span className="text-slate-400">POL</span>
                        <div className="font-semibold">{asnExtra.portOfLoading}</div>
                      </div>
                    )}
                    {asnExtra.portOfDischarge && (
                      <div>
                        <span className="text-slate-400">POD</span>
                        <div className="font-semibold">{asnExtra.portOfDischarge}</div>
                      </div>
                    )}
                    {asnExtra.etaDate && (
                      <div>
                        <span className="text-slate-400">ETA date</span>
                        <div className="font-semibold">{formatDisplayDate(asnExtra.etaDate)}</div>
                      </div>
                    )}
                    {asnExtra.carrier && (
                      <div>
                        <span className="text-slate-400">Carrier</span>
                        <div className="font-semibold">{asnExtra.carrier}</div>
                      </div>
                    )}
                    {asnExtra.totalQuantity && (
                      <div>
                        <span className="text-slate-400">Total qty</span>
                        <div className="font-semibold">{asnExtra.totalQuantity}</div>
                      </div>
                    )}
                    {asnExtra.totalCartons && (
                      <div>
                        <span className="text-slate-400">Cartons / pallets</span>
                        <div className="font-semibold">
                          {asnExtra.totalCartons}
                          {asnExtra.totalPallets ? ` / ${asnExtra.totalPallets}` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Link purchase orders (multi-PO → one container)
                  </span>
                  {asnEligibleOrders.length === 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                      No acknowledged POs available. Acknowledge a confirmed PO first, then link it here.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                      {asnEligibleOrders.map((o) => {
                        const checked = asnLinkedPoIds.includes(o.po);
                        return (
                          <label
                            key={o.po}
                            className={cn(
                              'flex items-start gap-3 px-3 py-2.5 cursor-pointer text-xs',
                              checked ? 'bg-[#C0D5E5]/80 dark:bg-sky-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAsnPo(o.po)}
                              className="mt-0.5 rounded border-slate-300"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono font-bold text-slate-800 dark:text-slate-100">{o.po}</div>
                              <div className="text-slate-500 truncate">{o.item}</div>
                            </div>
                            {checked && (
                              <input
                                type="number"
                                min={1}
                                value={asnLineQty[o.po] ?? String(o.orderedQty || '')}
                                onChange={(e) =>
                                  setAsnLineQty((prev) => ({ ...prev, [o.po]: e.target.value }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 shrink-0 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-semibold"
                                title="Ship qty"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {asnLinkedPoIds.length > 1 && (
                    <p className="text-[11px] text-[#2F5472] dark:text-[#C0D5E5] font-medium">
                      {asnLinkedPoIds.length} POs will share one ASN and container in logistics.
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-bold uppercase text-slate-400">ASN number</span>
                    <input
                      value={fulfillAsn}
                      onChange={(e) => setFulfillAsn(e.target.value)}
                      placeholder="e.g. ASN-2026-PEND2"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Container number</span>
                    <input
                      value={fulfillContainer}
                      onChange={(e) => setFulfillContainer(e.target.value)}
                      placeholder="e.g. FGRU8800121"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Ship date</span>
                    <input
                      type="date"
                      value={fulfillShipDate}
                      onChange={(e) => setFulfillShipDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase text-slate-400">ETA</span>
                    <input
                      value={fulfillEta}
                      onChange={(e) => setFulfillEta(e.target.value)}
                      placeholder="e.g. 3 Days"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Shipment notes</span>
                    <textarea
                      rows={2}
                      value={fulfillNotes}
                      onChange={(e) => setFulfillNotes(e.target.value)}
                      placeholder="Seal #, trailer, special handling…"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={
                    fulfillSaving || !fulfillAsn.trim() || asnLinkedPoIds.length === 0
                  }
                  onClick={submitAsn}
                  className="w-full py-2.5 rounded-lg bg-[#4684AD] hover:bg-[#4684AD] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider"
                >
                  {fulfillSaving
                    ? 'Saving…'
                    : `Submit ASN & push to logistics${
                        asnLinkedPoIds.length > 1 ? ` (${asnLinkedPoIds.length} POs)` : ''
                      }`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Automated Sourcing Placement Modal */}
      <AnimatePresence>
        {isModalOpen && !isVendor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => { if (publishStep === 0) setIsModalOpen(false); }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
            >
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 rounded-lg text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Initiate Buyer Sourcing Requirement</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Instantly match specs against verified cold-chain supplier databases.</p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={publishStep > 0}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {publishStep > 0 ? (
                /* Auto Match Simulation Screen */
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <Sparkles className="w-6 h-6 text-emerald-500 absolute animate-pulse animate-duration-1000" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {publishStep === 1 ? 'Calibrating Fresh Biological Spec Limits...' : 
                       publishStep === 2 ? 'Running Verified Carrier Live Range Match...' : 
                       'Dispatching Secure Encrypted RFQs'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Our database matches suppliers and checks their transport score for temperature limits automatically.
                    </p>
                  </div>

                  {/* Terminal simulation log output */}
                  <div className="w-full max-w-xl bg-slate-950 text-emerald-400 font-mono text-left p-4 rounded-lg text-xs space-y-1.5 shadow-inner border border-slate-800 max-h-[160px] overflow-y-auto select-none">
                    {simulationLogs.map((log, index) => (
                      <div key={index} className="flex gap-2.5">
                        <span className="text-indigo-400 font-bold shrink-0">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Standard Form inputs */
                <form onSubmit={handlePublishBid} className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                  
                  {/* Left Column: Form Controls */}
                  <div className="flex-1 space-y-4">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Item Category</label>
                        <select 
                          value={newCategory}
                          onChange={(e) => {
                            setNewCategory(e.target.value);
                            // Adjust placeholder metrics based on category
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-colors"
                        >
                          <option value="Fresh Produce">Fresh Produce</option>
                          <option value="Dairy">Dairy</option>
                          <option value="Meat & Poultry">Meat & Poultry</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Item Specifications & Spec Name</label>
                        <input 
                          type="text" 
                          required
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder="e.g. Organic Red Gala Apples (Medium)" 
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-colors" 
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Grade</label>
                        <select 
                          value={newGrade}
                          onChange={(e) => setNewGrade(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                        >
                          <option value="Class A">Class A</option>
                          <option value="Class B">Class B</option>
                          <option value="Premium">Premium</option>
                          <option value="Grade U.S. Fancy">Grade U.S. Fancy</option>
                          <option value="Special Selection">Special Selection</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Quantity Requested</label>
                        <input 
                          type="number" 
                          required
                          min={1}
                          value={newQuantity}
                          onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-colors" 
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Measurement Unit</label>
                        <select 
                          value={newUnit}
                          onChange={(e) => setNewUnit(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                        >
                          <option value="Cases">Cases</option>
                          <option value="Pallets">Pallets</option>
                          <option value="Units">Units</option>
                          <option value="Bags">Bags</option>
                          <option value="Lbs">Lbs</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Delivery Destination DC</label>
                      <select 
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                      >
                        <option value="Chicago DC East (Hub-1)">Chicago DC East (Hub-1)</option>
                        <option value="Newark Reefer Facility (Hub-2)">Newark Reefer Facility (Hub-2)</option>
                        <option value="Los Angeles Harbor Dist (Hub-5)">Los Angeles Harbor Dist (Hub-5)</option>
                        <option value="Miami Cross-Dock Terminal (Hub-9)">Miami Cross-Dock Terminal (Hub-9)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {newOrderType === 'repeat' ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                              Delivery window — From
                            </label>
                            <input
                              type="date"
                              required
                              value={newDeliveryDate}
                              onChange={(e) => setNewDeliveryDate(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                              Delivery window — To
                            </label>
                            <input
                              type="date"
                              required
                              min={newDeliveryDate}
                              value={newDeliveryEndDate}
                              onChange={(e) => setNewDeliveryEndDate(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Target Delivery Date
                          </label>
                          <input
                            type="date"
                            required
                            value={newDeliveryDate}
                            onChange={(e) => setNewDeliveryDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                          />
                        </div>
                      )}

                      <div className={newOrderType === 'repeat' ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Order Type</label>
                        <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setNewOrderType('one-time')}
                            className={cn(
                              'flex-1 px-3 py-2 text-xs font-bold transition-colors',
                              newOrderType === 'one-time'
                                ? 'bg-[#4684AD] text-white'
                                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                            )}
                          >
                            One-time
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewOrderType('repeat')}
                            className={cn(
                              'flex-1 px-3 py-2 text-xs font-bold transition-colors',
                              newOrderType === 'repeat'
                                ? 'bg-violet-600 text-white'
                                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                            )}
                          >
                            Repeat
                          </button>
                        </div>
                      </div>
                    </div>

                    {newOrderType === 'repeat' && (
                      <div className="rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20 p-3 space-y-3">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5" />
                          Repeat delivery cycle schedule
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Frequency</label>
                            <select
                              value={newRepeatFrequency}
                              onChange={(e) => setNewRepeatFrequency(e.target.value as RepeatFrequency)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="biweekly">Every 2 weeks</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Deliveries in window</label>
                            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-semibold">
                              {repeatPreviewDates.length} draft PO{repeatPreviewDates.length === 1 ? '' : 's'}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80">
                          Window {formatDisplayDate(newDeliveryDate)} → {formatDisplayDate(newDeliveryEndDate)} ·{' '}
                          {frequencyLabel(newRepeatFrequency)}. After award, draft POs auto-create for each date in range.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Bid SLA Window Deadline</label>
                      <select 
                        value={newBidDeadline}
                        onChange={(e) => setNewBidDeadline(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors"
                      >
                        <option value="4 hours remaining">4 Hours (Urgent Hot Replenishment)</option>
                        <option value="24 hours remaining">24 Hours (Standard Stock Replenishment)</option>
                        <option value="3 days remaining">3 Days (Forward Stock Order)</option>
                      </select>
                    </div>

                    {/* Biological constraints limits fields */}
                    <div className="p-4 bg-slate-55/60 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <Thermometer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Biological Cold-chain Parameters (SLA)</h4>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">Min Temp Limit (°F)</label>
                          <input 
                            type="number" 
                            required
                            value={newMinTemp}
                            onChange={(e) => setNewMinTemp(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">Max Temp Limit (°F)</label>
                          <input 
                            type="number" 
                            required
                            value={newMaxTemp}
                            onChange={(e) => setNewMaxTemp(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">Target Humidity (%)</label>
                          <input 
                            type="number" 
                            required
                            value={newHum}
                            onChange={(e) => setNewHum(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-150 dark:border-slate-800">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">Target Cold-Chain Temp (°C)</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g., 4"
                            value={newTargetColdChainTemp}
                            onChange={(e) => setNewTargetColdChainTemp(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">Max Allowable Transit</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g., 36 hours"
                            value={newMaxTransitTime}
                            onChange={(e) => setNewMaxTransitTime(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">Min Delivery Shelf Life</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g., 14 days"
                            value={newMinShelfLife}
                            onChange={(e) => setNewMinShelfLife(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Dynamic Auto Matching Sidebar layout */}
                  <div className="w-full md:w-80 flex flex-col gap-4 bg-slate-50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-150 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 font-bold text-sm">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                        <span>Select suppliers to invite</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Choose who receives this RFQ. Unchecked suppliers stay off the invite list.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedVendorNames(matchedVendorsLive.map((v) => v.name))}
                          className="text-[11px] font-bold uppercase text-[#2F5472] hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVendorNames([])}
                          className="text-[11px] font-bold uppercase text-slate-500 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] md:max-h-none">
                      {matchedVendorsLive.map((v, i) => {
                        const checked = selectedVendorNames.includes(v.name);
                        return (
                          <label
                            key={i}
                            className={cn(
                              'bg-white dark:bg-slate-900 p-3 rounded-xl border flex items-center gap-2.5 shadow-sm cursor-pointer',
                              checked
                                ? 'border-emerald-300 dark:border-emerald-800'
                                : 'border-slate-150 dark:border-slate-800 opacity-70'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedVendorNames((prev) =>
                                  prev.includes(v.name)
                                    ? prev.filter((n) => n !== v.name)
                                    : [...prev, v.name]
                                )
                              }
                              className="rounded border-slate-300"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">{v.name}</span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">{v.status}</span>
                            </div>
                            <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                              IDx: {v.score}%
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                      <button 
                        type="submit"
                        disabled={selectedVendorsLive.length === 0}
                        className="w-full py-2.5 bg-emerald-600 dark:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-white" />
                        Publish to {selectedVendorsLive.length || 0} supplier{selectedVendorsLive.length === 1 ? '' : 's'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="w-full py-2 bg-slate-150/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel Issue
                      </button>
                    </div>

                  </div>

                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Compare Bids Modal */}
      <AnimatePresence>
        {showCompareModal && comparedQuotes.length >= 2 && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
              onClick={() => setShowCompareModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/50">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    Compare Bids
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Side-by-side for <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedBid.item}</span>
                    {' · '}{comparedQuotes.length} suppliers selected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompareModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-slate-50 dark:bg-slate-950/70">
                      <tr>
                        <th className="px-3 py-3 font-bold text-[11px] uppercase tracking-wide text-slate-500 w-40 sticky left-0 bg-slate-50 dark:bg-slate-950/70 z-10">
                          Metric
                        </th>
                        {comparedQuotes.map((q) => (
                          <th key={q.id} className="px-3 py-3 font-bold text-slate-900 dark:text-slate-100 min-w-[160px]">
                            <div className="text-sm">{q.vendor}</div>
                            <div className="text-[11px] font-medium text-slate-400 mt-0.5 normal-case tracking-normal">
                              Reliability {q.qualityIndex}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {([
                        {
                          label: 'Case rate',
                          render: (q: Quotation) => {
                            const m = getQuoteCompareMetrics(q);
                            const win = compareWinners?.lowestCaseRateId === q.id;
                            return (
                              <span className={cn('font-extrabold font-mono', win && 'text-emerald-600 dark:text-emerald-400')}>
                                ${m.caseRate.toFixed(2)}
                                {win && <span className="ml-1.5 text-[11px] uppercase font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">Best</span>}
                              </span>
                            );
                          },
                        },
                        {
                          label: 'Base sourcing value',
                          render: (q: Quotation) => `$${getQuoteCompareMetrics(q).baseQuotePrice.toLocaleString()}`,
                        },
                        {
                          label: 'AI true cost (w/ waste)',
                          render: (q: Quotation) => {
                            const m = getQuoteCompareMetrics(q);
                            const win = compareWinners?.lowestTrueCostId === q.id;
                            return (
                              <span className={cn('font-extrabold font-mono', win && 'text-indigo-600 dark:text-indigo-400')}>
                                ${m.trueCost.toLocaleString()}
                                <span className="text-[11px] text-slate-400 font-medium ml-1">({m.wastePct}% waste)</span>
                                {win && <span className="ml-1.5 text-[11px] uppercase font-bold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">Best</span>}
                              </span>
                            );
                          },
                        },
                        {
                          label: 'Reliability score',
                          render: (q: Quotation) => {
                            const win = compareWinners?.highestReliabilityId === q.id;
                            return (
                              <span className={cn(win && 'font-extrabold text-emerald-600 dark:text-emerald-400')}>
                                {q.qualityIndex}
                                {win && <span className="ml-1.5 text-[11px] uppercase font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">Best</span>}
                              </span>
                            );
                          },
                        },
                        {
                          label: 'Est. delivery',
                          render: (q: Quotation) => getQuoteCompareMetrics(q).eta,
                        },
                        {
                          label: 'Harvest batch age',
                          render: (q: Quotation) => getQuoteCompareMetrics(q).harvestAgeText,
                        },
                        {
                          label: 'Thermal fleet',
                          render: (q: Quotation) => getQuoteCompareMetrics(q).fleet,
                        },
                        {
                          label: 'Logistics route',
                          render: (q: Quotation) => getQuoteCompareMetrics(q).route,
                        },
                        {
                          label: 'Available qty',
                          render: (q: Quotation) => {
                            const a = getQuoteCompareMetrics(q).available;
                            return a != null ? `${a.toLocaleString()} cases` : '—';
                          },
                        },
                        {
                          label: 'AI shrinkage risk',
                          render: (q: Quotation) => {
                            const m = getQuoteCompareMetrics(q);
                            const win = compareWinners?.lowestRiskId === q.id;
                            return (
                              <span
                                className={cn(
                                  'inline-flex flex-wrap items-center gap-1.5',
                                  m.riskTone === 'low' && 'text-emerald-700 dark:text-emerald-400',
                                  m.riskTone === 'medium' && 'text-amber-700 dark:text-amber-400',
                                  m.riskTone === 'high' && 'text-rose-700 dark:text-rose-400'
                                )}
                              >
                                {m.riskLabel}
                                {win && <span className="text-[11px] uppercase font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">Best</span>}
                              </span>
                            );
                          },
                        },
                        {
                          label: 'Supplier notes',
                          render: (q: Quotation) => (
                            <span className="text-slate-500 italic line-clamp-3">{q.notes || '—'}</span>
                          ),
                        },
                      ] as const).map((row) => (
                        <tr key={row.label} className="hover:bg-slate-50/80 dark:hover:bg-slate-950/40">
                          <td className="px-3 py-3 font-bold text-[11px] uppercase tracking-wide text-slate-500 sticky left-0 bg-white dark:bg-slate-900 z-10">
                            {row.label}
                          </td>
                          {comparedQuotes.map((q) => (
                            <td key={q.id} className="px-3 py-3 text-slate-800 dark:text-slate-200 align-top">
                              {row.render(q)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500 max-w-md">
                  Green / indigo <strong>Best</strong> tags highlight the strongest metric per row. Award from here or close and use the quote cards.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompareModal(false)}
                    className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
                  >
                    Close
                  </button>
                  {selectedBid.status !== 'awarded' &&
                    comparedQuotes.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        disabled={isAwardingInProgress}
                        onClick={() => {
                          setShowCompareModal(false);
                          handleAwardQuotation(q);
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Award {q.vendor.split(' ')[0]}
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
