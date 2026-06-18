import React, { useState } from 'react';
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
  Users,
  Sliders,
  Bot,
  Cpu
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import POPDFDocumentModal from '../components/POPDFDocumentModal';

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
  contractHorizon?: string;
  deliveryFrequency?: string;
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
  status: 'Pending Approval' | 'Processing' | 'In Transit' | 'Fulfilled' | 'Paid';
}

// Fire-and-forget write to the backend storage APIs (PostgreSQL persistence).
// UI state updates immediately; the DB write happens in the background.
function persist(path: string, body: any, method: 'POST' | 'PATCH' = 'POST') {
  fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(err => console.error(`Persist to ${path} failed:`, err));
}

// Loads the Razorpay checkout script once (used in live payment mode)
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
  const [hoveredQuoteId, setHoveredQuoteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfModalData, setPdfModalData] = useState<any>(null);
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

  const [orders, setOrders] = useState<PurchaseOrder[]>([
    { po: 'PO-2026-784A', requirementId: 'REQ-2026-003', vendor: 'Sunrise Dairy Co.', item: 'Premium Whole Milk (Gallon)', amt: '$37,200', date: 'May 20, 2026', status: 'In Transit' },
    { po: 'PO-2026-512B', requirementId: 'PREVIOUS', vendor: 'Valley Meats Inc.', amt: '$12,300', item: 'Ground Beef 80/20 Chuck', date: 'May 17, 2026', status: 'Fulfilled' }
  ]);

  // Selected bid detail view reference
  const [selectedBidId, setSelectedBidId] = useState<string>('REQ-2026-001');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [rightChatTab, setRightChatTab] = useState<'audit' | 'negotiation'>('audit');
  const [awardSuccessAlert, setAwardSuccessAlert] = useState<string | null>(null);
  const [slaComplianceChecked, setSlaComplianceChecked] = useState(true);
  const [newGrade, setNewGrade] = useState('Class A');
  const selectedBid = bidsList.find(b => b.id === selectedBidId) || bidsList[0];

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
  const [contractHorizon, setContractHorizon] = useState('Spot Order');
  const [customMonths, setCustomMonths] = useState<number>(3);
  const [fulfillmentCadence, setFulfillmentCadence] = useState('Once a Week (Standard Weekly Stocking — 4 batches/month)');
  const [customBatches, setCustomBatches] = useState<number>(12);
  const [newLocation, setNewLocation] = useState('Chicago DC East (Hub-1)');
  const [newDeliveryDate, setNewDeliveryDate] = useState('2026-06-10');
  const [newBidDeadline, setNewBidDeadline] = useState('24 hours');
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

    // Permanent storage: quote-level negotiation thread (keyed by quote id)
    persist('/api/negotiations', {
      requirementId: quoteId,
      sender: senderName,
      avatar: senderAvatar,
      text: text.trim(),
      isSelf: true,
      senderRole: isVendor ? 'VENDOR' : 'BUYER'
    });

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

  // Floating Chat toggle state
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Quotation comparison award flow
  const [awardingQuoteId, setAwardingQuoteId] = useState<string | null>(null);
  const [isAwardingInProgress, setIsAwardingInProgress] = useState(false);

  // Split Sourcing State
  const [splitSelectedQuoteIds, setSplitSelectedQuoteIds] = useState<string[]>([]);
  const [splitAllocations, setSplitAllocations] = useState<Record<string, number>>({});
  const [isSplitAwardingInProgress, setIsSplitAwardingInProgress] = useState(false);

  // Side Drawer & Side-by-Side Comparison Modal States
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailModalQuote, setDetailModalQuote] = useState<Quotation | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [contractsSearch, setContractsSearch] = useState('');
  const [selectedComplianceContract, setSelectedComplianceContract] = useState<Contract | null>(null);
  const [isComplianceDrawerOpen, setIsComplianceDrawerOpen] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [payingPoId, setPayingPoId] = useState<string | null>(null);
  const [payErrorPoId, setPayErrorPoId] = useState<string | null>(null);
  const [selectedTelemetryOrder, setSelectedTelemetryOrder] = useState<PurchaseOrder | null>(null);

  // ---------------------------------------------------------------------
  // HYDRATION: restore permanently stored data from PostgreSQL on load
  // ---------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;

    // Requirements created in earlier sessions (full UI payload stored as JSON)
    fetch('/api/requirements')
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.success) return;
        const dbBids: BidRequest[] = (data.requirements || [])
          .filter((r: any) => r.detailsPayload)
          .map((r: any) => ({ ...(r.detailsPayload as BidRequest), id: r.id }));
        if (dbBids.length) {
          setBidsList(prev => {
            const existing = new Set(prev.map(b => b.id));
            return [...dbBids.filter(b => !existing.has(b.id)), ...prev];
          });
        }
      })
      .catch(err => console.error('Requirements hydration failed:', err));

    // Purchase orders stored in the DB
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.success) return;
        const statusMap = (s: string): PurchaseOrder['status'] =>
          s === 'paid' ? 'Paid' : s === 'delivering' ? 'In Transit' : s === 'delivered' ? 'Fulfilled' : 'Processing';
        const dbOrders: PurchaseOrder[] = (data.orders || []).map((o: any) => ({
          po: o.id,
          requirementId: o.sla?.requirementId || '',
          vendor: o.vendor?.organizationName || 'Vendor',
          item: o.cargoDescription,
          amt: `$${Number(o.totalAmount).toLocaleString()}`,
          date: new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: statusMap(o.fulfillmentStatus)
        }));
        if (dbOrders.length) {
          setOrders(prev => {
            const existing = new Set(prev.map(p => p.po));
            return [...dbOrders.filter(o => !existing.has(o.po)), ...prev];
          });
        }
      })
      .catch(err => console.error('Orders hydration failed:', err));

    // Contracts (SLA agreements) stored in the DB
    fetch('/api/contracts')
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.success) return;
        const dbContracts: Contract[] = (data.contracts || []).map((c: any) => ({
          id: c.id,
          requirementId: c.requirementId || '',
          vendor: c.purchaseOrders?.[0]?.vendor?.organizationName || 'Multi-Vendor Split',
          item: c.requirement?.itemName || 'Contracted supply lot',
          cat: c.requirement?.category || 'Fresh Produce',
          duration: `${c.totalContractMonths} Months`,
          contractValue: `$${Number(c.volumeCommitmentValue).toLocaleString()}`,
          status: c.operationalStatus === 'ACTIVE' ? 'Active' : c.operationalStatus
        }));
        if (dbContracts.length) {
          setContracts(prev => {
            const existing = new Set(prev.map(p => p.id));
            return [...dbContracts.filter(o => !existing.has(o.id)), ...prev];
          });
        }
      })
      .catch(err => console.error('Contracts hydration failed:', err));

    return () => { cancelled = true; };
  }, []);

  // Restore the negotiation chat thread for the selected requirement (once each)
  const hydratedThreadsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const reqId = selectedBidId;
    if (!reqId || hydratedThreadsRef.current.has(reqId)) return;
    hydratedThreadsRef.current.add(reqId);
    fetch(`/api/negotiations/${reqId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success || !data.messages?.length) return;
        const restored = data.messages.map((m: any) => ({
          sender: m.sender,
          avatar: m.avatar || m.sender.slice(0, 2).toUpperCase(),
          text: m.text,
          time: new Date(m.createdAt).toLocaleString(),
          isSelf: m.isSelf
        }));
        setCommentsDB(prev => ({ ...prev, [reqId]: [...(prev[reqId] || []), ...restored] }));
      })
      .catch(err => console.error('Negotiation hydration failed:', err));
  }, [selectedBidId]);
  const [isTelemetryDrawerOpen, setIsTelemetryDrawerOpen] = useState(false);

  // AI Matching Engine State
  const [isAiMatchingRunning, setIsAiMatchingRunning] = useState(false);
  const [lastDispatchedSplitDetails, setLastDispatchedSplitDetails] = useState<{
    masterPo: string;
    childPos: Array<{
      po: string;
      vendor: string;
      cases: number;
      containerId: string;
      sensorTag: string;
    }>;
  } | null>(null);

  const handleAllocationChange = (quoteId: string, val: number) => {
    const clampedVal = Math.min(100, Math.max(0, val));
    setSplitAllocations(prev => {
      const updated = { ...prev, [quoteId]: clampedVal };
      // Proportionally rebalance every other selected vendor so the total stays at 100%
      const otherIds = splitSelectedQuoteIds.filter(id => id !== quoteId);
      if (otherIds.length > 0) {
        const targetOtherSum = 100 - clampedVal;
        const currentOtherSum = otherIds.reduce((sum, id) => sum + (prev[id] || 0), 0);
        let distributed = 0;
        otherIds.forEach((id, idx) => {
          if (idx === otherIds.length - 1) {
            updated[id] = Math.max(0, targetOtherSum - distributed);
          } else {
            const share = currentOtherSum > 0 ? (prev[id] || 0) / currentOtherSum : 1 / otherIds.length;
            const newVal = Math.max(0, Math.round(targetOtherSum * share));
            updated[id] = newVal;
            distributed += newVal;
          }
        });
      }
      return updated;
    });
  };

  const currentAllocationSum = splitSelectedQuoteIds.reduce((sum, id) => sum + (splitAllocations[id] || 0), 0);

  React.useEffect(() => {
    setSplitSelectedQuoteIds([]);
    setSplitAllocations({});
    setLastDispatchedSplitDetails(null);
  }, [selectedBidId]);

  // Initiate simulation of vendor quotes
  const [isSimulatingQuotes, setIsSimulatingQuotes] = useState(false);

  // Manual vendor invitation states
  const [invitedVendors, setInvitedVendors] = useState<Vendor[]>([]);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);

  React.useEffect(() => {
    if (isModalOpen) {
      const initialMatched = APPROVED_VENDORS_DB.filter(v => v.category === newCategory);
      setInvitedVendors(initialMatched);
    } else {
      setInvitedVendors([]);
      setVendorSearchQuery('');
      setIsVendorDropdownOpen(false);
    }
  }, [isModalOpen]);

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

    // Permanent storage: save the chat message thread to PostgreSQL
    persist('/api/negotiations', {
      requirementId: selectedBid.id,
      sender: newMsg.sender,
      avatar: newMsg.avatar,
      text: newMsg.text,
      isSelf: true,
      senderRole: isVendor ? 'VENDOR' : 'BUYER'
    });

    setCurrentComment('');
  };

  // Submit and automated publish request
  const handlePublishBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setPublishStep(1);
    setSimulationLogs(['Extracting fresh biological & cold-chain specifications...', 'Category verified: ' + newCategory]);

    setTimeout(() => {
      setPublishStep(2);
      setSimulationLogs(prev => [
        ...prev,
        `Matching pre-vetted vendors in Category: ${newCategory}...`,
        `Matched ${invitedVendors.length} approved partners automatically.`
      ]);
    }, 1200);

    setTimeout(() => {
      setPublishStep(3);
      setSimulationLogs(prev => [
        ...prev,
        `Dispatching secure RFQ payloads to matched vendor dashboards...`,
        'Encrypted cold-chain SLA targets attached successfully.',
        'Automated notifications dispatched to ' + invitedVendors.map(v => v.name).join(', ') + '.',
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
        specifications: {
          tempRange: `${newMinTemp}°F - ${newMaxTemp}°F`,
          humidity: `${newHum}% max`,
          sizeSpec: 'Default Quality specifications enforced',
          targetColdChainTemp: `${newTargetColdChainTemp}°C`,
          maxTransitTime: newMaxTransitTime,
          minShelfLife: newMinShelfLife
        },
        approvedVendors: [...invitedVendors],
        quotations: [],
        contractHorizon: contractHorizon === 'Custom Horizon...' ? `${customMonths} Months` : contractHorizon,
        deliveryFrequency: contractHorizon === 'Spot Order' ? undefined : (
          fulfillmentCadence === 'Custom Schedule...' ? `Custom Schedule (${customBatches} releases)` : (
            fulfillmentCadence?.startsWith('Twice a Week') ? 'Twice a Week' : (
              fulfillmentCadence?.startsWith('Once a Week') ? 'Once a Week' : (
                fulfillmentCadence?.startsWith('Bi-Weekly') ? 'Bi-Weekly' : 'Monthly'
              )
            )
          )
        ),
      };

      setBidsList(prev => [newBid, ...prev]);

      // Permanent storage: save the requirement to PostgreSQL
      persist('/api/requirements', {
        id: generatedId,
        itemName: newBid.item,
        category: newBid.category,
        quantity: newBid.quantity,
        unit: newBid.unit,
        details: newBid
      });

      setSelectedBidId(generatedId);
      setPublishStep(0);
      setIsModalOpen(false);

      // Clean form fields
      setNewItemName('');
      setContractHorizon('Spot Order');
      setCustomMonths(3);
      setFulfillmentCadence('Once a Week (Standard Weekly Stocking — 4 batches/month)');
      setCustomBatches(12);
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

      // Permanent storage: save each incoming quotation as a vendor bid
      simulatedQuotes.forEach(q => persist('/api/bids', {
        requirementId: selectedBid.id,
        vendorName: q.vendor,
        casePricing: q.pricePerCase || q.pricePerUnit,
        qualityScore: parseInt(q.qualityIndex) || 90,
        quantityAvailable: q.availableQuantity,
        details: q
      }));

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

      // Permanent storage: contract + requirement award status
      persist('/api/contracts', {
        id: ctrId,
        requirementId: selectedBid.id,
        totalValue: quote.totalPrice,
        months: parseInt(selectedBid.contractHorizon || '3') || 3
      });
      persist(`/api/requirements/${selectedBid.id}`, { status: 'AWARDED' }, 'PATCH');

      // 3. Generate and Add Purchase Order
      const isBlanket = selectedBid.contractHorizon !== 'Spot Order';
      const digits = Math.floor(1000 + Math.random() * 9000);
      const poId = isBlanket ? `BPO-2026-${digits}` : `PO-2026-0${100 + orders.length + 1}X`;

      const totalQuantity = selectedBid.quantity;
      const totalBatches = isBlanket ? (() => {
        let m = 3;
        const horizon = selectedBid.contractHorizon || '3 Months';
        if (horizon.includes('1 Month')) m = 1;
        else if (horizon.includes('2 Months')) m = 2;
        else if (horizon.includes('3 Months')) m = 3;
        else if (horizon.includes('4 Months')) m = 4;
        else if (horizon.includes('6 Months')) m = 6;
        else if (horizon.includes('12 Months')) m = 12;
        else {
          const p = parseInt(horizon.replace(/[^0-9]/g, ''), 10);
          m = isNaN(p) ? 3 : p;
        }

        const freq = selectedBid.deliveryFrequency || 'Once a Week';
        if (freq.toLowerCase().includes('twice a week')) return m * 8;
        if (freq.toLowerCase().includes('once a week')) return m * 4;
        if (freq.toLowerCase().includes('bi-weekly')) return m * 2;
        if (freq.toLowerCase().includes('monthly')) return m * 1;
        if (freq.toLowerCase().includes('custom')) {
          const p = parseInt(freq.replace(/[^0-9]/g, ''), 10);
          return isNaN(p) ? m * 4 : p;
        }
        return m * 4;
      })() : 1;

      const casesPerBatch = isBlanket ? Math.round(totalQuantity / totalBatches) : totalQuantity;
      
      let childPOs: any[] = [];
      if (isBlanket) {
        for (let idx = 1; idx <= totalBatches; idx++) {
          const padIndex = idx.toString().padStart(2, '0');
          childPOs.push({
            id: `PO-${digits}-R${padIndex}`,
            batchNum: idx,
            quantity: casesPerBatch,
            status: idx === 1 ? 'Ready to Pack' : 'Scheduled',
            date: new Date().toISOString()
          });
        }
      }

      const newPO: PurchaseOrder = {
        po: poId,
        requirementId: selectedBid.id,
        vendor: quote.vendor,
        item: isBlanket 
          ? `${totalQuantity.toLocaleString()} ${selectedBid.unit || 'Cases'} Total (${selectedBid.item}) • Master Contract`
          : selectedBid.item,
        amt: `$${quote.totalPrice.toLocaleString()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Pending Approval'
      };

      // Permanent storage: save the purchase order under its contract
      persist('/api/orders', {
        po: poId,
        slaId: ctrId,
        requirementId: selectedBid.id,
        vendorName: quote.vendor,
        item: newPO.item,
        amount: quote.totalPrice,
        quantity: totalQuantity,
        status: 'packing'
      });

      setOrders(prev => [newPO, ...prev]);

      // Push to our new active shipments list in localStorage for Logistics.tsx integration
      try {
        const stored = localStorage.getItem('freshguard-active-shipments');
        const list = stored ? JSON.parse(stored) : [];
        const newShipment = {
          id: poId,
          vendor: quote.vendor,
          item: isBlanket 
            ? `${selectedBid.item} (${totalQuantity.toLocaleString()} Current Total Contract Volume)`
            : `${selectedBid.quantity} ${selectedBid.unit || 'Cases'} of ${selectedBid.item}`,
          product: selectedBid.item,
          quantity: selectedBid.quantity,
          unit: selectedBid.unit,
          fleetSpecification: quote.fleetSpecification || 'Active Refrigerated',
          logisticsRouteAndProvider: quote.logisticsRouteAndProvider || 'Route I-80 West',
          status: 'on-time',
          eta: quote.eta || '28 hrs',
          origin: `${quote.vendor.split(' ')[0]} Warehouse`,
          destination: 'Chicago DC',
          temp: quote.fleetSpecification === 'Active Refrigerated' ? '3°C' : '8°C',
          date: new Date().toISOString(),
          // Blanket PO fields
          isBlanket: isBlanket,
          contractHorizon: selectedBid.contractHorizon,
          deliveryFrequency: selectedBid.deliveryFrequency || 'Once a Week',
          totalBatches: isBlanket ? totalBatches : undefined,
          deliveredBatches: isBlanket ? 0 : undefined,
          currentActiveBatch: isBlanket ? 1 : undefined,
          childPOs: childPOs.length > 0 ? childPOs : undefined
        };
        list.unshift(newShipment);
        localStorage.setItem('freshguard-active-shipments', JSON.stringify(list));
      } catch (err) {
        console.error("Failed to push to freshguard-active-shipments data bridge", err);
      }

      setIsAwardingInProgress(false);
      setAwardingQuoteId(null);
      
      // Auto routing switch to contracts or orders tab to showcase effect
      setActiveTab('orders');
    }, 2200);
  };

  const handleToggleSplitSelected = (quoteId: string) => {
    setSplitSelectedQuoteIds(prev => {
      const isSelected = prev.includes(quoteId);
      let updated: string[];
      if (isSelected) {
        updated = prev.filter(id => id !== quoteId);
      } else {
        updated = [...prev, quoteId];
      }

      setSplitAllocations(allocs => {
        const nextAllocs = { ...allocs };
        // Clean out unselected allocations
        for (const id of Object.keys(nextAllocs)) {
          if (!updated.includes(id)) {
            delete nextAllocs[id];
          }
        }
        // Equal division of 100% as initial default for convenience
        if (updated.length > 0) {
          const basePct = Math.floor(100 / updated.length);
          let sum = 0;
          updated.forEach((id, idx) => {
            if (idx === updated.length - 1) {
              nextAllocs[id] = 100 - sum;
            } else {
              nextAllocs[id] = basePct;
              sum += basePct;
            }
          });
        }
        return nextAllocs;
      });

      return updated;
    });
  };

  // Razorpay payment flow: create order on backend, then open checkout
  // (live mode) or simulate a successful checkout (mock mode, no keys yet).
  const handlePayNow = async (e: React.MouseEvent, row: PurchaseOrder) => {
    e.stopPropagation();
    if (payingPoId) return;
    setPayingPoId(row.po);
    setPayErrorPoId(null);

    const markPaid = () => {
      setOrders(prev => prev.map(o => o.po === row.po ? { ...o, status: 'Paid' as const } : o));
    };

    try {
      const amountNum = parseFloat(row.amt.replace(/[^0-9.]/g, '')) || 0;
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poNumber: row.po, amount: amountNum })
      });
      const order = await orderRes.json();
      if (!order.success) throw new Error(order.error || 'Order creation failed');

      if (order.liveData) {
        // Live Razorpay checkout modal
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error('Razorpay checkout script failed to load');
        const rzp = new (window as any).Razorpay({
          key: order.razorpayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: 'FreshGuard Platform',
          description: `Payment for ${row.po} — ${row.vendor}`,
          order_id: order.orderId,
          theme: { color: '#059669' },
          handler: async (resp: any) => {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: resp.razorpay_order_id,
                paymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
                poNumber: row.po
              })
            });
            const verify = await verifyRes.json();
            if (verify.verified) markPaid();
            else setPayErrorPoId(row.po);
            setPayingPoId(null);
          },
          modal: { ondismiss: () => setPayingPoId(null) }
        });
        rzp.open();
      } else {
        // Mock mode: verify the simulated order directly
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.orderId,
            paymentId: `pay_mock_${Date.now()}`,
            poNumber: row.po
          })
        });
        const verify = await verifyRes.json();
        if (verify.verified) markPaid();
        else setPayErrorPoId(row.po);
        setPayingPoId(null);
      }
    } catch (err) {
      console.error('Payment flow failed:', err);
      setPayErrorPoId(row.po);
      setPayingPoId(null);
    }
  };

  const handleRunAiOptimization = async () => {
    setIsAiMatchingRunning(true);
    try {
      const response = await fetch('/api/procurement/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requirementId: selectedBid.id,
          totalVolume: selectedBid.quantity,
          customWeights: { scoreWeight: 0.70, priceWeight: 0.30 }
        })
      });

      if (!response.ok) throw new Error("Optimize API request failed");
      
      const data = await response.json();
      const nextAllocs: Record<string, number> = {};
      const quoteIds = selectedBid.quotations.map(q => q.id);
      
      selectedBid.quotations.forEach(quote => {
        const matched = data.allocationRows.find((row: any) => 
          row.vendor.toLowerCase() === quote.vendor.toLowerCase()
        );
        if (matched) {
          nextAllocs[quote.id] = matched.allocationPercentage;
        } else {
          nextAllocs[quote.id] = Math.round(100 / selectedBid.quotations.length);
        }
      });

      const sum = Object.values(nextAllocs).reduce((acc, cur) => acc + cur, 0);
      if (sum !== 100 && quoteIds.length > 0) {
        nextAllocs[quoteIds[0]] += (100 - sum);
      }

      setSplitSelectedQuoteIds(quoteIds);
      setSplitAllocations(nextAllocs);
      setIsAiMatchingRunning(false);
    } catch (error) {
      console.warn("Falling back to local client-side AI optimization solver:", error);
      setIsAiMatchingRunning(false);
      
      // Select all quotations automatically
      const quoteIds = selectedBid.quotations.map(q => q.id);
      setSplitSelectedQuoteIds(quoteIds);

      // Distribute math precisely ensuring the sum equals 100%
      // Global Farms Suppliers gets the largest chunk (e.g. 40%) due to active reefers, and the rest gets distributed cascadingly
      const sortedQuotes = [...selectedBid.quotations].sort((a, b) => {
        const scoreA = parseInt(a.qualityIndex.split('/')[0]) || 0;
        const scoreB = parseInt(b.qualityIndex.split('/')[0]) || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (a.pricePerCase || a.pricePerUnit) - (b.pricePerCase || b.pricePerUnit);
      });

      const nextAllocs: Record<string, number> = {};
      
      if (sortedQuotes.length === 2) {
        nextAllocs[sortedQuotes[0].id] = 60;
        nextAllocs[sortedQuotes[1].id] = 40;
      } else if (sortedQuotes.length === 3) {
        nextAllocs[sortedQuotes[0].id] = 40;
        nextAllocs[sortedQuotes[1].id] = 35;
        nextAllocs[sortedQuotes[2].id] = 25;
      } else if (sortedQuotes.length === 4) {
        nextAllocs[sortedQuotes[0].id] = 40;
        nextAllocs[sortedQuotes[1].id] = 25;
        nextAllocs[sortedQuotes[2].id] = 20;
        nextAllocs[sortedQuotes[3].id] = 15;
      } else {
        // Dynamic generic split
        let remaining = 100;
        sortedQuotes.forEach((quote, idx) => {
          if (idx === sortedQuotes.length - 1) {
            nextAllocs[quote.id] = remaining;
          } else if (idx === 0) {
            nextAllocs[quote.id] = 40;
            remaining -= 40;
          } else {
            const pct = Math.max(5, Math.floor(remaining / (sortedQuotes.length - idx)));
            nextAllocs[quote.id] = pct;
            remaining -= pct;
          }
        });
      }

      setSplitAllocations(nextAllocs);
    }
  };

  const handleFinalizeSplitAward = async () => {
    if (splitSelectedQuoteIds.length < 2) return;
    const currentAllocationSum = splitSelectedQuoteIds.reduce((sum, id) => sum + (splitAllocations[id] || 0), 0);
    if (currentAllocationSum !== 100) return;

    setIsSplitAwardingInProgress(true);

    try {
      // Map selections to true vendor-indexed dictionary schema for API
      const mappedAllocations: Record<string, number> = {};
      splitSelectedQuoteIds.forEach(id => {
        const quote = selectedBid.quotations.find(q => q.id === id);
        if (quote) {
          mappedAllocations[quote.vendor] = splitAllocations[id] || 0;
        }
      });

      const response = await fetch('/api/procurement/finalize-split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requirementId: selectedBid.id,
          splitAllocations: mappedAllocations,
          totalVolume: selectedBid.quantity,
          productItem: selectedBid.item,
          category: selectedBid.category,
          unit: selectedBid.unit
        })
      });

      if (!response.ok) {
        throw new Error("Finalize split API returned an error status.");
      }

      const data = await response.json();
      
      if (data.success) {
        console.log("Committed to backend relational tables successfully", data);
        
        // Use backend generated master BPO and child PO definitions
        const masterPo = data.masterBpo.id;
        const childPos = data.childPOs.map((c: any) => {
          const user = APPROVED_VENDORS_DB.find(v => v.name.toLowerCase().includes(c.vendor_id.toLowerCase()) || c.vendor_id.toLowerCase().includes(v.name.split(' ')[0].toLowerCase()));
          const vendorName = user ? user.name : "Global Farms Suppliers";
          return {
            po: c.id,
            vendor: vendorName,
            cases: c.allocated_quantity,
            containerId: c.container_id,
            sensorTag: c.iot_beacon_id
          };
        });

        // 1. Generate Multiple distinct Contracts from database models
        let cIdx = 0;
        const newContracts: Contract[] = data.childPOs.map((c: any) => {
          const matchedVendor = APPROVED_VENDORS_DB.find(v => v.name.toLowerCase().includes(c.vendor_id.toLowerCase()) || c.vendor_id.toLowerCase().includes(v.name.split(' ')[0].toLowerCase())) || { name: "Global Farms Suppliers" };
          const value = Math.round(c.allocated_quantity * 24.50);
          const cId = `CTR-2026-SP${100 + contracts.length + cIdx + 1}`;
          cIdx++;
          return {
            id: cId,
            requirementId: selectedBid.id,
            vendor: matchedVendor.name,
            item: `${selectedBid.item} (${c.allocation_percentage}% Split)`,
            cat: selectedBid.category,
            duration: `May 2026 - Dec 2026`,
            contractValue: `$${value.toLocaleString()}`,
            status: 'Active' as const
          };
        });

        // 2. Generate Multiple distinct Purchase Orders
        let pIdx = 0;
        const newPOs: PurchaseOrder[] = data.childPOs.map((c: any) => {
          const matchedVendor = APPROVED_VENDORS_DB.find(v => v.name.toLowerCase().includes(c.vendor_id.toLowerCase()) || c.vendor_id.toLowerCase().includes(v.name.split(' ')[0].toLowerCase())) || { name: "Global Farms Suppliers" };
          const value = Math.round(c.allocated_quantity * 24.50);
          const pId = c.id;
          pIdx++;
          return {
            po: pId,
            requirementId: selectedBid.id,
            vendor: matchedVendor.name,
            item: `${c.allocated_quantity.toLocaleString()} ${selectedBid.unit || 'Cases'} of ${selectedBid.item} (${c.allocation_percentage}% Split Award)`,
            amt: `$${value.toLocaleString()}`,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: 'Pending Approval' as const
          };
        });

        // 3. Update Bid status on Client
        const totalAwardedPrice = data.childPOs.reduce((sum: number, c: any) => {
          return sum + Math.round(c.allocated_quantity * 24.50);
        }, 0);

        const awardedVendorNames = data.childPOs.map((c: any) => {
          return c.vendor_id.split(' ')[0];
        }).join(' & ');

        setBidsList(prev => prev.map(b => {
          if (b.id === selectedBid.id) {
            return {
              ...b,
              status: 'awarded',
              awardedVendor: `Split Sourcing: ${awardedVendorNames}`,
              awardedPrice: totalAwardedPrice
            };
          }
          return b;
        }));

        setContracts(prev => [...newContracts, ...prev]);
        setOrders(prev => [...newPOs, ...prev]);

        setLastDispatchedSplitDetails({
          masterPo,
          childPos
        });

        // Save server generated shipments directly into localStorage to synchronize the Logistics Tab!
        try {
          const stored = localStorage.getItem('freshguard-active-shipments');
          const list = stored ? JSON.parse(stored) : [];
          const combinedList = [...data.newShipments, ...list];
          localStorage.setItem('freshguard-active-shipments', JSON.stringify(combinedList));
        } catch (err) {
          console.error("Failed to sync split shipments to local storage", err);
        }

        setIsSplitAwardingInProgress(false);
        return;
      }
    } catch (apiError) {
      console.warn("Express split-finalize API experiencing sandbox local disruption. Engaging transaction-safe offline backup...", apiError);
    }

    // Standard high-fidelity backup simulation handler
    setTimeout(() => {
      // 1. Generate Multiple distinct Contracts
      const newContracts: Contract[] = splitSelectedQuoteIds.map((quoteId, idx) => {
        const quote = selectedBid.quotations.find(q => q.id === quoteId)!;
        const pct = splitAllocations[quoteId] || 0;
        const cases = Math.round((selectedBid.quantity * pct) / 100);
        const value = Math.round(cases * (quote.pricePerCase || quote.pricePerUnit || 20));
        return {
          id: `CTR-2026-SP${100 + contracts.length + idx + 1}`,
          requirementId: selectedBid.id,
          vendor: quote.vendor,
          item: `${selectedBid.item} (${pct}% Split)`,
          cat: selectedBid.category,
          duration: `May 2026 - Dec 2026`,
          contractValue: `$${value.toLocaleString()}`,
          status: 'Active'
        };
      });

      // 2. Generate Multiple distinct Purchase Orders
      const newPOs: PurchaseOrder[] = splitSelectedQuoteIds.map((quoteId, idx) => {
        const quote = selectedBid.quotations.find(q => q.id === quoteId)!;
        const pct = splitAllocations[quoteId] || 0;
        const cases = Math.round((selectedBid.quantity * pct) / 100);
        const value = Math.round(cases * (quote.pricePerCase || quote.pricePerUnit || 20));
        return {
          po: `PO-2026-A${100 + orders.length + idx + 1}`,
          requirementId: selectedBid.id,
          vendor: quote.vendor,
          item: `${cases.toLocaleString()} ${selectedBid.unit || 'Cases'} of ${selectedBid.item} (${pct}% Split Award)`,
          amt: `$${value.toLocaleString()}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: 'Pending Approval'
        };
      });

      // 3. Update Bid status on Client
      const totalAwardedPrice = splitSelectedQuoteIds.reduce((sum, quoteId) => {
        const quote = selectedBid.quotations.find(q => q.id === quoteId)!;
        const pct = splitAllocations[quoteId] || 0;
        const cases = Math.round((selectedBid.quantity * pct) / 100);
        return sum + Math.round(cases * (quote.pricePerCase || quote.pricePerUnit || 20));
      }, 0);

      const awardedVendorNames = splitSelectedQuoteIds.map(quoteId => {
        const quote = selectedBid.quotations.find(q => q.id === quoteId)!;
        return quote.vendor.split(' ')[0];
      }).join(' & ');

      setBidsList(prev => prev.map(b => {
        if (b.id === selectedBid.id) {
          return {
            ...b,
            status: 'awarded',
            awardedVendor: `Split Sourcing: ${awardedVendorNames}`,
            awardedPrice: totalAwardedPrice
          };
        }
        return b;
      }));

      setContracts(prev => [...newContracts, ...prev]);
      setOrders(prev => [...newPOs, ...prev]);

      const masterPo = `MPO-2026-MSC${Math.floor(1000 + Math.random() * 8999)}`;
      const childPos = splitSelectedQuoteIds.map((quoteId, idx) => {
        const quote = selectedBid.quotations.find(q => q.id === quoteId)!;
        const pct = splitAllocations[quoteId] || 0;
        const cases = Math.round((selectedBid.quantity * pct) / 100);
        return {
          po: `PO-2026-A${100 + orders.length + idx + 1}`,
          vendor: quote.vendor,
          cases,
          containerId: `CNT-${quote.vendor.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5)}-${Math.floor(1100 + idx * 230 + Math.random() * 800)}`,
          sensorTag: `IOT-BCN-${Math.floor(20500 + idx * 1150 + Math.random() * 500)}`
        };
      });

      setLastDispatchedSplitDetails({
        masterPo,
        childPos
      });

      // 4. Logistics integration: save BOTH into localStorage 'freshguard-active-shipments'
      try {
        const stored = localStorage.getItem('freshguard-active-shipments');
        const list = stored ? JSON.parse(stored) : [];

        const newSplitShipments = newPOs.map((newPO, idx) => {
          const quoteId = splitSelectedQuoteIds[idx];
          const quote = selectedBid.quotations.find(q => q.id === quoteId)!;
          const pct = splitAllocations[quoteId] || 0;
          const cases = Math.round((selectedBid.quantity * pct) / 100);
          const cinfo = childPos[idx];

          return {
            id: newPO.po,
            vendor: quote.vendor,
            item: `${cases.toLocaleString()} ${selectedBid.unit || 'Cases'} of ${selectedBid.item} (${pct}% Split)`,
            product: selectedBid.item,
            quantity: cases,
            unit: selectedBid.unit,
            fleetSpecification: quote.fleetSpecification || 'Active Refrigerated',
            logisticsRouteAndProvider: quote.logisticsRouteAndProvider || 'Carrier Standby Channel',
            status: 'on-time' as const,
            eta: quote.eta || '28 hrs',
            origin: `${quote.vendor} Hub`,
            destination: 'Chicago DC',
            temp: quote.fleetSpecification === 'Active Refrigerated' ? '3°C' : '8°C',
            date: new Date().toISOString(),
            stage: 'packing' as const,
            packingProgress: 35,
            preCoolingTarget: `Pre-Cooling Target: ${quote.fleetSpecification === 'Active Refrigerated' ? '3°C' : '8°C'} (Currently: 4.2°C)`,
            containerId: cinfo.containerId,
            sensorTag: cinfo.sensorTag,
            iotBeaconTag: cinfo.sensorTag,
            isBlanket: selectedBid.contractHorizon !== 'Spot Order',
            contractHorizon: selectedBid.contractHorizon,
            deliveryFrequency: selectedBid.deliveryFrequency || 'Once a Week',
            totalBatches: (() => {
              if (selectedBid.contractHorizon === 'Spot Order') return undefined;
              let m = 3;
              const horizon = selectedBid.contractHorizon || '3 Months';
              if (horizon.includes('1 Month')) m = 1;
              else if (horizon.includes('2 Months')) m = 2;
              else if (horizon.includes('3 Months')) m = 3;
              else if (horizon.includes('4 Months')) m = 4;
              else if (horizon.includes('6 Months')) m = 6;
              else if (horizon.includes('12 Months')) m = 12;
              else {
                const p = parseInt(horizon.replace(/[^0-9]/g, ''), 10);
                m = isNaN(p) ? 3 : p;
              }

              const freq = selectedBid.deliveryFrequency || 'Once a Week';
              if (freq.toLowerCase().includes('twice a week')) return m * 8;
              if (freq.toLowerCase().includes('once a week')) return m * 4;
              if (freq.toLowerCase().includes('bi-weekly')) return m * 2;
              if (freq.toLowerCase().includes('monthly')) return m * 1;
              return m * 4;
            })(),
            deliveredBatches: selectedBid.contractHorizon !== 'Spot Order' ? 0 : undefined,
            currentActiveBatch: selectedBid.contractHorizon !== 'Spot Order' ? 1 : undefined,
          };
        });

        const combinedList = [...newSplitShipments, ...list];
        localStorage.setItem('freshguard-active-shipments', JSON.stringify(combinedList));
      } catch (err) {
        console.error("Failed to sync split shipments backup", err);
      }

      setIsSplitAwardingInProgress(false);
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

      // Permanent storage: save the vendor's official quotation as a bid
      persist('/api/bids', {
        requirementId: selectedBid.id,
        vendorName: vendorName,
        casePricing: casePriceVal,
        qualityScore: parseInt(sampleQuality) || 92,
        quantityAvailable: availableQtyVal,
        details: newQuote
      });

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

      // Permanent storage: announce the quotation in the negotiation thread
      persist('/api/negotiations', {
        requirementId: selectedBid.id,
        sender: newMsg.sender,
        avatar: newMsg.avatar,
        text: newMsg.text,
        isSelf: true,
        senderRole: 'VENDOR'
      });
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full mx-auto h-full flex flex-col relative transition-colors duration-200">
      
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 mb-2">
            <Sparkles className="w-3 h-3" />
            Requirement Initiation Engine Active
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isVendor ? 'FreshGuard Vendor Hub' : 'Fresh Sourcing & Procurement'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isVendor 
              ? 'Receive automated buyer requirements, submit secure cold-chain bids, and view POs.' 
              : 'Initiate biological-grade requirements, auto-notify pre-vetted vendors, and manage contracts.'
            }
          </p>
        </div>
        
        {isVendor ? (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 dark:bg-emerald-500 rounded-lg text-sm font-semibold text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4 text-white" />
            Browse Open Market Tenders
          </button>
        ) : (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 dark:bg-emerald-500 rounded-lg text-sm font-semibold text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            Initiate Fresh Requirement
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg w-fit border border-transparent dark:border-slate-800/80">
        <button
          onClick={() => setActiveTab('bidding')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'bidding' 
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          )}
        >
          Replenishment Sourcing (Bidding)
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'contracts' 
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          )}
        >
          SLA Agreements
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === 'orders' 
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" 
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          )}
        >
          Purchase Orders
        </button>
      </div>

      {/* Tab Content: Bidding View */}
      {activeTab === 'bidding' && (
        <div className="flex-1 flex flex-col gap-6 w-full">
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[650px] items-stretch">
          
          {/* COLUMN A: Requirements Pipeline (25% Width - lg:col-span-3) */}
          <div className="lg:col-span-3 flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider animate-fade-in">
                  {isVendor ? 'Open Buyer Requests' : 'Active Demands'}
                </h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-505 mt-0.5">
                  {isVendor ? 'Available Orders' : 'Requirements Pipeline'}
                </p>
              </div>
              {!isVendor && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-2.5 py-1.5 bg-emerald-600 dark:bg-emerald-505 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer font-sans"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span>Create</span>
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search demands..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-slate-400 dark:text-slate-100 transition-colors"
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
            
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[550px] lg:max-h-[640px] scrollbar-thin dark:scrollbar-thumb-slate-800">
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
                          ? "border-emerald-500 dark:border-emerald-400 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] shadow-sm" 
                          : "border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">{bid.id}</span>
                        <span className={cn(
                          "text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide",
                          badgeStyle
                        )}>
                          {badgeText}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-800 dark:text-slate-205 text-xs leading-snug">
                        {isVendor 
                          ? `${bid.item.split(' [')[0]} • ${bid.quantity.toLocaleString()} ${bid.unit} Needed` 
                          : bid.item
                        }
                      </h4>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-800/50 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{bid.deadline}</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <div>{bid.quotations.length} {bid.quotations.length === 1 ? 'bid' : 'bids'}</div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
          {/* COLUMN B: BID RESOLUTION WORKSPACE/MATRIX (75% Width - lg:col-span-9) */}
          <div className="lg:col-span-9 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-155 dark:border-slate-805 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] overflow-visible min-h-[720px] h-auto pb-6">
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
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Requirement targets for: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedBid.item}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/5 dark:bg-red-500/10 rounded-xl border border-amber-500/20 space-y-2 font-mono">
                    <span className="text-[9px] font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-widest block">Buyer's Strict Core Targets:</span>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-[10px]">
                        <Thermometer className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-slate-500 dark:text-slate-404">Target Temp:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedBid.specifications.targetColdChainTemp || '4°C'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-[10px]">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-slate-500 dark:text-slate-404">Max Transit:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedBid.specifications.maxTransitTime || '36 hours'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-[10px]">
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
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 shadow-sm"
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
              <div className="buyer-view-matrix-container w-full h-full flex flex-col">
                {/* Center Header Details */}
                <div className="p-4 border-b border-slate-155 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <h2 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-205 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Received Quotes &amp; SLA Matrix
                      </h2>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5">
                        Viewing Bids for: <span className="font-bold text-slate-755 dark:text-slate-300">{selectedBid.item}</span>
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {selectedBid.status === 'open' && (
                        <button
                          onClick={handleSimulateIncomingQuotes}
                          disabled={isSimulatingQuotes}
                          className="px-2.5 py-1.5 bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 rounded-lg text-[10px] font-extrabold transition-all shadow-sm flex items-center gap-1 disabled:opacity-50 cursor-pointer uppercase font-mono tracking-wider"
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

                      <button
                        type="button"
                        onClick={handleRunAiOptimization}
                        disabled={isAiMatchingRunning}
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-bold font-mono text-[10px] uppercase tracking-wider transition-all duration-200 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]",
                          isAiMatchingRunning 
                            ? "bg-emerald-700/25 text-emerald-500 border border-emerald-500/20" 
                            : "bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent shadow-emerald-950/10"
                        )}
                      >
                        {isAiMatchingRunning ? (
                          <>
                            <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                            <span>Generating AI Splits...</span>
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3.5 h-3.5 animate-pulse text-white" />
                            <span>🤖 Run AI Optimization &amp; Match Allocation</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Biological Parameters */}
                  <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-850">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#A1A1AA] text-slate-400 dark:text-slate-500">Biological Parameters &amp; Requirements:</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-404 border border-sky-100/50 dark:border-sky-900/30 px-1.5 py-0.5 rounded font-mono font-extrabold">
                        Target Temp: {selectedBid.specifications.targetColdChainTemp || '4°C'}
                      </span>
                      <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-404 border border-indigo-100/50 dark:border-indigo-900/30 px-1.5 py-0.5 rounded font-mono font-extrabold">
                        Max Transit: {selectedBid.specifications.maxTransitTime || '36 hrs'}
                      </span>
                      <span className="text-[9px] bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-404 border border-teal-100/50 dark:border-teal-900/30 px-1.5 py-0.5 rounded font-mono font-extrabold">
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
                      {/* Modern High-Density 4-Column Bid Cards Grid */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-55 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                          <div>
                            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-302 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                              <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Active Quotation &amp; Competing Vendor Bids
                            </h3>
                            <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium leading-relaxed">
                              Compare Competing Vendor Bids below. Check profiles to enable the multi-vendor split award or launch side-by-side comparison vetting.
                            </p>
                          </div>
                        </div>

                        {isAiMatchingRunning ? (
                          <div className="w-full text-center py-24 bg-emerald-500/5 dark:bg-emerald-955/10 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="w-10 h-10 rounded-full border-4 border-emerald-600/30 border-t-emerald-500 animate-spin"></div>
                              <div className="space-y-1">
                                <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest font-mono">Running Sourcing Recommendations...</p>
                                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono text-center">Optimizing route micro-climatic telemetry and base freight tariffs</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn" id="procurement-bids-cards-grid">
                            {selectedBid.quotations.map((quote) => {
                              const isSelected = splitSelectedQuoteIds.includes(quote.id);
                              const isHovered = hoveredQuoteId === quote.id;
                              const price = quote.pricePerCase || quote.pricePerUnit || 0;
                              const volume = quote.availableQuantity !== undefined ? `${quote.availableQuantity.toLocaleString()} cases` : `${selectedBid.quantity.toLocaleString()} cases`;
                              const thermalSpec = quote.fleetSpecification || 'Ambient';
                              const isRecommended = quote.vendor.includes('Global Farms') || quote.vendor.includes('Sunrise Dairy') || quote.qualityIndex.includes('98') || quote.qualityIndex.includes('99');
                              
                              return (
                                <div 
                                  key={quote.id} 
                                  id={`bid-card-${quote.id}`}
                                  onMouseEnter={() => setHoveredQuoteId(quote.id)}
                                  onMouseLeave={() => setHoveredQuoteId(null)}
                                  className={cn(
                                    "border rounded-xl p-4 bg-white dark:bg-slate-900 flex flex-col justify-between relative",
                                    isSelected 
                                      ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/5 dark:bg-emerald-955/5" 
                                      : "border-slate-200 dark:border-slate-800"
                                  )}
                                  style={{
                                    cursor: 'pointer',
                                    transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.3s ease',
                                    transform: isHovered ? 'translateY(-6px)' : 'translateY(0px)',
                                    boxShadow: isHovered 
                                      ? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '0 10px 25px rgba(0, 0, 0, 0.4)' : '0 10px 20px rgba(15, 23, 42, 0.08)') 
                                      : 'none',
                                    borderColor: isHovered 
                                      ? (isSelected ? '#059669' : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#475569' : '#cbd5e1')) 
                                      : (isSelected ? '#10b981' : undefined),
                                    willChange: 'transform, box-shadow'
                                  }}
                                >
                                  {isRecommended && (
                                    <div className="absolute -top-2.5 left-3 px-2 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500 text-white dark:bg-emerald-600 shadow-sm uppercase tracking-widest font-mono">
                                      ★ AI Recommended
                                    </div>
                                  )}
                                  
                                  {/* Upper Section — Dual-Row Wrapper Architecture */}
                                  <div className="flex flex-col w-full">
                                    {/* Top Row (FLEX HEADER STRIP) */}
                                    <div className="flex flex-row justify-between items-start w-full gap-2">
                                      {/* Left Vendor Name */}
                                      <div className="max-w-[70%] flex-1 min-w-0 pr-3 pointer-events-auto">
                                        <span 
                                          className="text-slate-900 dark:text-slate-100 tracking-tight block whitespace-normal break-words animate-fadeIn" 
                                          title={quote.vendor}
                                          style={{ 
                                            fontSize: quote.vendor.length > 12 ? '0.95rem' : '1.1rem',
                                            lineHeight: '1.2',
                                            fontWeight: 700
                                          }}
                                        >
                                          {quote.vendor}
                                        </span>
                                      </div>
                                      
                                      {/* Right Standalone Checkbox */}
                                      {selectedBid.status !== 'awarded' && (
                                        <div className="flex-shrink-0 flex items-center justify-end h-6">
                                          <input 
                                            type="checkbox"
                                            id={`check-split-${quote.id}`}
                                            checked={isSelected}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleToggleSplitSelected(quote.id);
                                            }}
                                            className="rounded border-slate-350 dark:border-slate-700 text-emerald-600 outline-none accent-emerald-500 cursor-pointer w-[18px] h-[18px]"
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {/* Second Row / Vertical content block (Score Indicator) */}
                                    <div className="flex items-center animate-fadeIn" style={{ marginTop: '8px' }}>
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-105 dark:bg-slate-805 text-slate-705 dark:text-slate-300">
                                        Score: {quote.qualityIndex}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Middle Section */}
                                  <div 
                                    className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800/80"
                                    style={{ marginTop: '8px' }}
                                  >
                                    <div className="font-mono text-emerald-650 dark:text-emerald-400 font-black text-sm">
                                      ${price.toFixed(2)}/case
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                      Offer Vol: <span className="font-bold text-slate-700 dark:text-slate-202">{volume}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn(
                                        "text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border",
                                        thermalSpec.includes('Active') 
                                          ? "bg-emerald-50 dark:bg-emerald-955/40 text-emerald-705 dark:text-emerald-304 border-emerald-150 dark:border-emerald-900/30" 
                                          : thermalSpec.includes('Passive') 
                                            ? "bg-amber-50 dark:bg-amber-955/20 text-amber-755 dark:text-amber-404 border-amber-150 dark:border-amber-900/30" 
                                            : "bg-slate-55 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300 border-slate-150 dark:border-slate-800"
                                      )}>
                                        ❄️ {thermalSpec}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Lower Action Ribbon */}
                                  <div className="pt-2 flex flex-col items-center gap-2 w-full">
                                    {selectedBid.status !== 'awarded' && (
                                      <button
                                        type="button"
                                        id={`btn-award-100-${quote.id}`}
                                        disabled={isAwardingInProgress}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAwardQuotation(quote);
                                        }}
                                        className="w-full py-2 px-3 rounded-lg text-[11px] font-sans font-semibold tracking-wider uppercase transition-all duration-200 text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:shadow-emerald-500/10 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-550/20"
                                      >
                                        {isAwardingInProgress && awardingQuoteId === quote.id ? (
                                          <>
                                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Awarding Contract...
                                          </>
                                        ) : (
                                          "Award Contract"
                                        )}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      id={`btn-details-${quote.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailModalQuote(quote);
                                        setDetailDrawerOpen(true);
                                      }}
                                      className="text-[11px] font-sans font-semibold text-indigo-650 hover:text-indigo-850 dark:text-indigo-400 dark:hover:text-indigo-305 transition-colors cursor-pointer py-1 hover:underline text-center"
                                    >
                                      View details and negotiate
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* MULTI-VENDOR ALLOCATION PIPELINE WORKSPACE */}
                      {splitSelectedQuoteIds.length >= 2 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl flex flex-col gap-6 font-sans relative text-slate-850"
                        >
                          <div className="flex flex-row justify-between items-center gap-3 border-b border-slate-150 pb-4 w-full">
                            <div className="flex flex-col">
                              <h3 className="text-sm font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                                Multi-Vendor Sourcing &amp; Allocation Pipeline
                              </h3>
                              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                                Divide requirement volume of <span className="text-slate-850 font-extrabold">{selectedBid.quantity.toLocaleString()} {selectedBid.unit || 'Cases'}</span> among selected suppliers:
                              </p>
                            </div>
                            <div className="shrink-0">
                              <button
                                onClick={() => setIsCompareModalOpen(true)}
                                className="px-4 py-2 border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-slate-50 text-[#334155] rounded-full text-[0.85rem] font-medium transition-all duration-150 cursor-pointer shadow-sm flex items-center justify-center focus:outline-none"
                              >
                                Compare selected profiles
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            {/* Allocation cards */}
                            <div className="md:col-span-2 flex flex-wrap gap-6">
                              {splitSelectedQuoteIds.map(quoteId => {
                                const quote = selectedBid.quotations.find(q => q.id === quoteId);
                                if (!quote) return null;
                                const pct = splitAllocations[quoteId] || 0;
                                const allocatedCases = Math.round((selectedBid.quantity * pct) / 100);

                                return (
                                  <div key={quoteId} className="flex-1 py-1 flex flex-col gap-2.5 min-w-[240px]">
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="font-extrabold text-xs text-[#0F172A] truncate pr-2" title={quote.vendor}>
                                        {quote.vendor}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={pct}
                                          onChange={(e) => handleAllocationChange(quoteId, parseInt(e.target.value) || 0)}
                                          className="w-14 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-center text-xs font-bold font-mono text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                        <span className="text-xs font-bold text-[#0F172A] font-mono">%</span>
                                      </div>
                                    </div>
                                    
                                    {/* Visual Range Slider */}
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={pct}
                                      onChange={(e) => handleAllocationChange(quoteId, parseInt(e.target.value) || 0)}
                                      className="w-full h-1 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-slate-500 hover:accent-slate-600 transition-colors"
                                      style={{
                                        background: `linear-gradient(to right, #64748b 0%, #64748b ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`
                                      }}
                                    />

                                    <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                                      <span>Specific Share:</span>
                                      <span className="text-[#0F172A] font-mono">
                                        {allocatedCases.toLocaleString()} {selectedBid.unit || 'Cases'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Verification and final split award button */}
                            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col gap-4 justify-center">
                              {(() => {
                                const currentSum = splitSelectedQuoteIds.reduce((sum, id) => sum + (splitAllocations[id] || 0), 0);
                                return (
                                  <>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Sourcing Allocation</span>
                                      <div className="mt-1 font-sans text-sm font-bold text-slate-850">
                                        {currentSum === 100 ? (
                                          <span className="text-emerald-650">Total Allocation: 100% (Balanced)</span>
                                        ) : (
                                          <span className="text-slate-700">Total Allocation: {currentSum}% <span className="text-amber-600 font-medium font-mono text-xs">(Remaining: {100 - currentSum}%)</span></span>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      disabled={isSplitAwardingInProgress || currentSum !== 100}
                                      onClick={handleFinalizeSplitAward}
                                      className={cn(
                                        "w-full py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 text-white cursor-pointer active:scale-95",
                                        currentSum === 100
                                          ? "bg-[#10B981] hover:bg-[#0d9488]"
                                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                      )}
                                    >
                                      {isSplitAwardingInProgress ? (
                                        <>
                                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                          <span>Validating Relational Dispatch...</span>
                                        </>
                                      ) : (
                                        <span>Confirm allocation and dispatch POs</span>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={currentSum !== 100}
                                      onClick={() => {
                                        const firstQuote = selectedBid.quotations.find(q => splitSelectedQuoteIds.includes(q.id));
                                        const vendorsList = selectedBid.quotations
                                          .filter(q => splitSelectedQuoteIds.includes(q.id))
                                          .map(q => q.vendor)
                                          .join(' & ');
                                        
                                        setPdfModalData({
                                          poId: `PO-${selectedBid.id.split('-')[2] || '8842'}-SPLIT-R01`,
                                          parentBpoId: `BPO-2026-${selectedBid.id.split('-')[2] || '8842'}`,
                                          horizon: '3 Months Commitment (Split-Vendor Sourcing)',
                                          batchIndex: 'Release 1 of 12 Batches',
                                          targetDC: 'Multi-Terminal Hub Nodes (Chicago Segment)',
                                          item: selectedBid.item,
                                          qty: selectedBid.quantity,
                                          unit: selectedBid.unit || 'Cases',
                                          pricePerUnit: firstQuote ? firstQuote.pricePerUnit : 15.50,
                                          vendorName: vendorsList,
                                          vendorScore: '98%',
                                          tempSpec: selectedBid.specifications.targetColdChainTemp || '36°F - 42°F',
                                          transitMaxSpec: selectedBid.specifications.maxTransitTime || '36 Hours max',
                                          shelfLifeSpec: selectedBid.specifications.minShelfLife || '14 days'
                                        });
                                        setIsPdfModalOpen(true);
                                      }}
                                      className="w-full py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      <span>Export split manifest</span>
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* LEDGER UNLOCK & DISPATCHED SPLIT CONFIRMATION */}
                          {lastDispatchedSplitDetails && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="mt-4 bg-emerald-50/50 border border-emerald-250 rounded-xl p-5 space-y-4 text-slate-800"
                            >
                              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                                    Overarching Master PO Registered
                                  </span>
                                </div>
                                <span className="font-mono text-xs text-slate-800 font-bold bg-white border border-emerald-250 px-2.5 py-1 rounded">
                                  {lastDispatchedSplitDetails.masterPo}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-slate-600">
                                Overarching contract terms fully locked. Split off corresponding unique child Release POs into the Logistics Tracking Pipeline:
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {lastDispatchedSplitDetails.childPos.map((cp) => (
                                  <div key={cp.po} className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] font-bold text-slate-800">{cp.vendor.split(' ')[0]} Sourcing Release</span>
                                      <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                        {cp.po}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2 text-[9.5px] text-slate-500 font-mono">
                                      <div>
                                        <span className="block text-[8.5px] text-slate-400 font-sans font-sans font-sans">Volume</span>
                                        <span className="text-slate-850 font-bold">{cp.cases.toLocaleString()} cs</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8.5px] text-slate-400 font-sans font-sans font-sans">Container ID</span>
                                        <span className="text-indigo-650 font-bold">{cp.containerId}</span>
                                      </div>
                                      <div>
                                        <span className="block text-[8.5px] text-slate-400 font-sans font-sans font-sans">IoT Beacon</span>
                                        <span className="text-emerald-700 font-bold">{cp.sensorTag}</span>
                                      </div>
                                    </div>
                                    <div className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-2 py-0.5 inline-flex items-center gap-1">
                                      <span className="flex h-1.5 w-1.5 relative shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                      </span>
                                      Beacon Active &amp; Pingable
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLastDispatchedSplitDetails(null);
                                    setActiveTab('shipments'); // Switch to active shipments logs
                                  }}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                  Go to Logistics Fleet Control Dashboard →
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                      </div>
                    )}
                  </div>
                </div>
              )}



  </div>

  </div>

        </div>
      )}

      {/* Tab Content: contracts list table */}
      {activeTab === 'contracts' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-emerald-600"/> 
              Active SLA Sourcing Agreements & Contracts
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search agreements..." 
                value={contractsSearch}
                onChange={(e) => setContractsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 placeholder:text-slate-450" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar select-none">
            {(() => {
              const filtered = (isVendor ? contracts.filter(c => c.vendor === 'Global Farms Suppliers') : contracts).filter(c => {
                const search = contractsSearch.toLowerCase();
                return c.id.toLowerCase().includes(search) || 
                       c.vendor.toLowerCase().includes(search) || 
                       c.item.toLowerCase().includes(search) || 
                       c.cat.toLowerCase().includes(search);
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400 text-xs font-sans uppercase tracking-widest font-semibold">
                    No matching contracts found
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                  {filtered.map((row) => (
                    <div 
                      key={row.id}
                      onClick={() => {
                        setSelectedComplianceContract(row);
                        setIsComplianceDrawerOpen(true);
                      }}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-1.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.06)] cursor-pointer select-none"
                    >
                      {/* Top Ribbon */}
                      <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                        <span className="font-mono text-[11px] font-bold text-slate-450 tracking-wider">
                          {row.id}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-150/40 uppercase tracking-widest">
                          {row.status}
                        </span>
                      </div>

                      {/* Body Core */}
                      <div className="flex flex-col gap-1.5 flex-1">
                        <h4 className="font-bold text-[#0F172A] text-sm tracking-tight leading-snug">
                          {row.vendor}
                        </h4>
                        <div className="text-xs text-slate-650 font-medium font-sans">
                          {row.item}
                        </div>
                        <div className="mt-1">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/50 text-slate-500 uppercase tracking-wide">
                            {row.cat}
                          </span>
                        </div>
                      </div>

                      {/* Financial & Timeline Footer */}
                      <div className="pt-3 border-t border-slate-150 flex justify-between items-center text-xs text-slate-705">
                        <div>
                          <span className="block text-[9px] text-slate-400 font-sans uppercase tracking-wider font-semibold">Volume Commitment</span>
                          <span className="font-bold text-[#334155] font-mono text-[13px]">{row.contractValue}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] text-slate-400 font-sans uppercase tracking-wider font-semibold">SLA Duration</span>
                          <span className="font-medium text-slate-605 font-sans">{row.duration}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tab Content: purchase orders tracker table */}
      {activeTab === 'orders' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600"/> 
              Purchase Orders Issued & Auto-Trackers
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search POs..." 
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 placeholder:text-slate-450" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar select-none">
            {(() => {
              const filtered = (isVendor ? orders.filter(o => o.vendor === 'Global Farms Suppliers') : orders).filter(o => {
                const search = ordersSearch.toLowerCase();
                return o.po.toLowerCase().includes(search) || 
                       o.vendor.toLowerCase().includes(search) || 
                       o.item.toLowerCase().includes(search);
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400 text-xs font-sans uppercase tracking-widest font-semibold">
                    No matching purchase orders found
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                  {filtered.map((row) => (
                    <div 
                      key={row.po}
                      onClick={() => {
                        setSelectedTelemetryOrder(row);
                        setIsTelemetryDrawerOpen(true);
                      }}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-1.5 hover:shadow-[0_10px_20px_rgba(15, 23, 42, 0.06)] cursor-pointer select-none animate-in fade-in zoom-in-95 duration-200"
                    >
                      {/* Upper Section */}
                      <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                        <span className="font-mono text-[11px] font-bold text-slate-450 tracking-wider">
                          {row.po}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border",
                          row.status === 'Paid' ? "bg-emerald-500 text-white border-emerald-600" :
                          row.status === 'Fulfilled' ? "bg-emerald-50 text-emerald-700 border-emerald-150/40" : 
                          row.status === 'In Transit' ? "bg-blue-50 text-blue-700 border-blue-150/40" :
                          row.status === 'Processing' ? "bg-indigo-50 text-indigo-700 border-indigo-150/40 animate-pulse" : 
                          "bg-slate-50 text-slate-700 border-slate-150/40"
                        )}>
                          {row.status}
                        </span>
                      </div>

                      {/* Center Section */}
                      <div className="flex flex-col gap-1 flex-1">
                        <h4 className="font-bold text-[#0F172A] text-sm tracking-tight leading-snug">
                          {row.vendor}
                        </h4>
                        <div className="text-xs text-[#334155] font-medium font-sans">
                          {row.item}
                        </div>
                        {(() => {
                          if (row.po.startsWith('BPO-') || row.po.includes('BLANKET')) {
                            try {
                              const stored = localStorage.getItem('freshguard-active-shipments');
                              if (stored) {
                                const list = JSON.parse(stored);
                                const master = list.find((s: any) => s.id === row.po);
                                if (master) {
                                  return (
                                    <div className="mt-1 text-[10px] font-semibold text-indigo-600 font-mono">
                                      Progress: {master.deliveredBatches || 0} / {master.totalBatches || 12} Batches Completed
                                    </div>
                                  );
                                }
                              }
                            } catch (e) {}
                            return (
                              <div className="mt-1 text-[10px] font-semibold text-indigo-600 font-mono">
                                Progress: 0 / 12 Batches Completed
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Footer Section */}
                      <div className="pt-3 border-t border-slate-150 flex justify-between items-center text-xs text-slate-700">
                        <div>
                          <span className="block text-[9px] text-slate-400 font-sans uppercase tracking-wider font-semibold">Total Amount</span>
                          <span className="font-bold text-[#0F172A] font-mono text-[13px]">{row.amt}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] text-slate-400 font-sans uppercase tracking-wider font-semibold">Issue Date</span>
                          <span className="font-light text-slate-500 font-mono text-[11px]">{row.date}</span>
                        </div>
                      </div>

                      {/* Payment Action (buyer only) */}
                      {!isVendor && (
                        row.status === 'Paid' ? (
                          <div className="w-full py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black font-mono uppercase tracking-widest text-center">
                            ✓ Payment Settled
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handlePayNow(e, row)}
                            disabled={payingPoId === row.po}
                            className={cn(
                              "w-full py-2 rounded-lg text-[10px] font-black font-mono uppercase tracking-widest transition-colors cursor-pointer",
                              payErrorPoId === row.po
                                ? "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 disabled:opacity-60 disabled:cursor-wait"
                            )}
                          >
                            {payingPoId === row.po
                              ? 'Processing Payment…'
                              : payErrorPoId === row.po
                                ? 'Payment Failed — Retry'
                                : 'Pay Now'}
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Premium Automated Sourcing Placement Modal */}
      <AnimatePresence>
        {isModalOpen && (
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
                <form onSubmit={handlePublishBid} className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
                  
                  {/* Left Column: Form Controls (De-congested with expanded width & margins) */}
                  <div className="flex-1 space-y-8 pr-1">
                    
                    {/* INPUT GROUP 1: Item Details */}
                    <div className="space-y-4 pb-4 border-b border-slate-150 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-205">
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 font-bold px-2 py-0.5 rounded-md font-mono">STEP 1</span>
                        <h4 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-750 dark:text-slate-300">
                          Item Specifications & Quality Details
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Item Category</label>
                          <select 
                            value={newCategory}
                            onChange={(e) => {
                              setNewCategory(e.target.value);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-1"
                          >
                            <option value="Fresh Produce">Fresh Produce</option>
                            <option value="Dairy">Dairy</option>
                            <option value="Meat & Poultry">Meat & Poultry</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Grade</label>
                          <select 
                            value={newGrade}
                            onChange={(e) => setNewGrade(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1"
                          >
                            <option value="Class A">Class A</option>
                            <option value="Class B">Class B</option>
                            <option value="Premium">Premium</option>
                            <option value="Grade U.S. Fancy">Grade U.S. Fancy</option>
                            <option value="Special Selection">Special Selection</option>
                          </select>
                        </div>
                      </div>

                      {/* ITEM SPECIFICATIONS & SPEC NAME - now isolated dynamically to span smoothly and drop down on its own row */}
                      <div className="w-full">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Item Specifications & Spec Name</label>
                        <input 
                          type="text" 
                          required
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder="e.g. Organic Red Gala Apples (Medium)" 
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-1" 
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Quantity Requested</label>
                          <input 
                            type="number" 
                            required
                            min={1}
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-1" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Measurement Unit</label>
                          <select 
                            value={newUnit}
                            onChange={(e) => setNewUnit(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1"
                          >
                            <option value="Cases">Cases</option>
                            <option value="Pallets">Pallets</option>
                            <option value="Units">Units</option>
                            <option value="Bags">Bags</option>
                            <option value="Lbs">Lbs</option>
                          </select>
                        </div>
                      </div>

                      {/* Contract Duration & Fulfillment Cadence Section */}
                      <div className="space-y-4 pt-4 border-t border-slate-150 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-700 dark:text-slate-300">
                            Contract Duration &amp; Fulfillment Cadence
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contract Horizon</label>
                            <select 
                              value={contractHorizon}
                              onChange={(e) => {
                                setContractHorizon(e.target.value);
                                if (e.target.value !== 'Spot Order' && fulfillmentCadence === 'Once a Week') {
                                  setFulfillmentCadence('Once a Week (Standard Weekly Stocking — 4 batches/month)');
                                }
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1"
                            >
                              <option value="Spot Order">Spot Order (Single Delivery)</option>
                              <option value="1 Month">1 Month</option>
                              <option value="2 Months">2 Months</option>
                              <option value="3 Months">3 Months</option>
                              <option value="4 Months">4 Months</option>
                              <option value="6 Months">6 Months</option>
                              <option value="12 Months (Annual Contract)">12 Months (Annual Contract)</option>
                              <option value="Custom Horizon...">Custom Horizon...</option>
                            </select>
                          </div>

                          {contractHorizon === 'Custom Horizon...' ? (
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Enter Number of Months
                              </label>
                              <input 
                                type="number"
                                min={1}
                                max={60}
                                value={customMonths}
                                onChange={(e) => setCustomMonths(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 focus:outline-none focus:ring-1"
                              />
                            </div>
                          ) : (
                            <div className="hidden sm:block"></div>
                          )}
                        </div>

                        {contractHorizon !== 'Spot Order' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Fulfillment Cadence
                              </label>
                              <select 
                                value={fulfillmentCadence}
                                onChange={(e) => setFulfillmentCadence(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1"
                              >
                                <option value="Twice a Week (High-Frequency Fresh Rotation — 8 batches/month)">
                                  Twice a Week (High-Frequency Fresh Rotation — 8 batches/month)
                                </option>
                                <option value="Once a Week (Standard Weekly Stocking — 4 batches/month)">
                                  Once a Week (Standard Weekly Stocking — 4 batches/month)
                                </option>
                                <option value="Bi-Weekly (Every 2 Weeks — 2 batches/month)">
                                  Bi-Weekly (Every 2 Weeks — 2 batches/month)
                                </option>
                                <option value="Monthly (Once a Month — 1 batch/month)">
                                  Monthly (Once a Month — 1 batch/month)
                                </option>
                                <option value="Custom Schedule...">Custom Schedule...</option>
                              </select>
                            </div>

                            {fulfillmentCadence === 'Custom Schedule...' ? (
                              <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Expected Releases (Explicit Target Count)
                                </label>
                                <input 
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={customBatches}
                                  onChange={(e) => setCustomBatches(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 focus:outline-none focus:ring-1"
                                />
                              </div>
                            ) : (
                              <div className="hidden sm:block"></div>
                            )}
                          </div>
                        )}

                        {(() => {
                          let months = 0;
                          if (contractHorizon === '1 Month') months = 1;
                          else if (contractHorizon === '2 Months') months = 2;
                          else if (contractHorizon === '3 Months') months = 3;
                          else if (contractHorizon === '4 Months') months = 4;
                          else if (contractHorizon === '6 Months') months = 6;
                          else if (contractHorizon === '12 Months (Annual Contract)') months = 12;
                          else if (contractHorizon === 'Custom Horizon...') months = customMonths;

                          if (contractHorizon === 'Spot Order' || months === 0) {
                            return (
                              <div className="p-3 bg-slate-50 dark:bg-slate-955/45 border border-slate-150 dark:border-slate-800 rounded-xl leading-relaxed">
                                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block font-bold">
                                  📋 Spot Order Confirmed: Single immediate delivery of {newQuantity.toLocaleString()} {newUnit.toLowerCase()} scheduled.
                                </span>
                              </div>
                            );
                          }

                          const totalWeeks = months * 4;
                          let totalBatches = 0;
                          let matchesMonthly = false;

                          if (fulfillmentCadence === 'Custom Schedule...') {
                            totalBatches = customBatches;
                          } else if (fulfillmentCadence?.startsWith('Twice a Week')) {
                            totalBatches = months * 8;
                          } else if (fulfillmentCadence?.startsWith('Once a Week')) {
                            totalBatches = months * 4;
                          } else if (fulfillmentCadence?.startsWith('Bi-Weekly')) {
                            totalBatches = months * 2;
                          } else if (fulfillmentCadence?.startsWith('Monthly')) {
                            totalBatches = months * 1;
                            matchesMonthly = true;
                          }

                          const casesPerBatch = totalBatches > 0 ? Math.round(newQuantity / totalBatches) : 0;

                          let summaryText = '';
                          if (totalBatches === 1 && months === 1 && matchesMonthly) {
                            summaryText = `📋 Single Milestone Schedule Confirmed: 1 release of ${newQuantity.toLocaleString()} ${newUnit.toLowerCase()} at the end of the month.`;
                          } else if (totalBatches === 1) {
                            summaryText = `📋 Single Milestone Schedule Confirmed: 1 release of ${newQuantity.toLocaleString()} ${newUnit.toLowerCase()} at the end of the ${months === 1 ? 'month' : `${months}-month period`}.`;
                          } else {
                            const isTwice = fulfillmentCadence?.startsWith('Twice a Week');
                            const releaseWord = isTwice ? 'individual high-frequency releases' : 'individual releases';
                            summaryText = `📋 Standing Blanket Schedule Confirmed: ${totalBatches} ${releaseWord} of ${casesPerBatch.toLocaleString()} ${newUnit.toLowerCase()} scheduled over ${totalWeeks} weeks.`;
                          }

                          return (
                            <div className="p-3 bg-slate-50 dark:bg-slate-955/45 border border-slate-150 dark:border-slate-800 rounded-xl leading-relaxed">
                              <span className="text-[11px] font-mono text-indigo-650 dark:text-indigo-400 block whitespace-normal break-words font-black">
                                {summaryText}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* INPUT GROUP 2: Target Logistics */}
                    <div className="space-y-4 pb-4 border-b border-slate-150 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-205">
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 font-bold px-2 py-0.5 rounded-md font-mono">STEP 2</span>
                        <h4 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-755 dark:text-slate-300">
                          Target Logistics & Routing Deadlines
                        </h4>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Delivery Destination DC</label>
                        <select 
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1"
                        >
                          <option value="Chicago DC East (Hub-1)">Chicago DC East (Hub-1)</option>
                          <option value="Newark Reefer Facility (Hub-2)">Newark Reefer Facility (Hub-2)</option>
                          <option value="Los Angeles Harbor Dist (Hub-5)">Los Angeles Harbor Dist (Hub-5)</option>
                          <option value="Miami Cross-Dock Terminal (Hub-9)">Miami Cross-Dock Terminal (Hub-9)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Target Delivery Date</label>
                          <input 
                            type="date" 
                            required
                            value={newDeliveryDate}
                            onChange={(e) => setNewDeliveryDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Bid SLA Window Deadline</label>
                          <select 
                            value={newBidDeadline}
                            onChange={(e) => setNewBidDeadline(e.target.value)}
                            className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors focus:outline-none focus:ring-1"
                          >
                            <option value="4 hours remaining">4 Hours (Urgent Hot Replenishment)</option>
                            <option value="24 hours remaining">24 Hours (Standard Stock Replenishment)</option>
                            <option value="3 days remaining">3 Days (Forward Stock Order)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* INPUT GROUP 3: Biological SLA Parameters */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-205">
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-400 font-bold px-2 py-0.5 rounded-md font-mono">STEP 3</span>
                        <h4 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-755 dark:text-slate-300">
                          Biological SLA Parameters
                        </h4>
                      </div>

                      <div className="p-5 bg-slate-55/65 dark:bg-slate-955/30 rounded-xl border border-slate-150 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <Thermometer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider">Biological Cold-chain Parameters (SLA)</h4>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-505 mb-1.5">Min Temp Limit (°F)</label>
                            <input 
                              type="number" 
                              required
                              value={newMinTemp}
                              onChange={(e) => setNewMinTemp(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-505 mb-1.5">Max Temp Limit (°F)</label>
                            <input 
                              type="number" 
                              required
                              value={newMaxTemp}
                              onChange={(e) => setNewMaxTemp(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-505 mb-1.5">Target Humidity (%)</label>
                            <input 
                              type="number" 
                              required
                              value={newHum}
                              onChange={(e) => setNewHum(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-150 dark:border-slate-800">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-505 mb-1.5">Target Cold-Chain (C)</label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g., 4"
                              value={newTargetColdChainTemp}
                              onChange={(e) => setNewTargetColdChainTemp(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-505 mb-1.5">Max Allowable Transit</label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g., 36 hours"
                              value={newMaxTransitTime}
                              onChange={(e) => setNewMaxTransitTime(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-505 mb-1.5">Min Delivery Shelf Life</label>
                            <input 
                              type="text" 
                              required
                              placeholder="e.g., 14 days"
                              value={newMinShelfLife}
                              onChange={(e) => setNewMinShelfLife(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Invite Target Suppliers */}
                  <div className="w-full md:w-80 flex flex-col gap-5 bg-slate-50 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 relative select-none">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold text-sm">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Invite Target Suppliers</span>
                      </div>
                      <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-semibold">
                        Manually choose which certified logistics & cargo suppliers receive bid invitations:
                      </p>
                    </div>

                    {/* Highly visible, spacious Multi-Select search bar */}
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="🔍 Search and Add Certified Vendors..."
                        value={vendorSearchQuery}
                        onChange={(e) => {
                          setVendorSearchQuery(e.target.value);
                          setIsVendorDropdownOpen(true);
                        }}
                        onFocus={() => setIsVendorDropdownOpen(true)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg pl-3 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-100 placeholder:text-slate-400 font-medium cursor-text shadow-sm"
                      />
                      {isVendorDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setIsVendorDropdownOpen(false)} 
                          />
                          <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-40 divide-y divide-slate-100 dark:divide-slate-800 animate-fade-in">
                            {APPROVED_VENDORS_DB.filter(v => 
                              !invitedVendors.some(invited => invited.name === v.name) &&
                              v.name.toLowerCase().includes(vendorSearchQuery.toLowerCase())
                            ).length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-450 dark:text-slate-500 text-center font-mono">
                                No matching suppliers to add
                              </div>
                            ) : (
                              APPROVED_VENDORS_DB.filter(v => 
                                !invitedVendors.some(invited => invited.name === v.name) &&
                                v.name.toLowerCase().includes(vendorSearchQuery.toLowerCase())
                              ).map((vendor) => (
                                <button
                                  key={vendor.name}
                                  type="button"
                                  onClick={() => {
                                    setInvitedVendors(prev => [...prev, vendor]);
                                    setVendorSearchQuery('');
                                    setIsVendorDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex flex-col gap-0.5 cursor-pointer"
                                >
                                  <div className="flex justify-between items-center w-full">
                                    <span className="text-xs font-bold text-slate-850 dark:text-slate-200">{vendor.name}</span>
                                    <span className="text-[9px] bg-slate-100 dark:bg-emerald-950/30 text-slate-650 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                      {vendor.score}% Match
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center w-full text-[9px] text-slate-400 font-mono mt-0.5">
                                    <span>{vendor.category}</span>
                                    <span>{vendor.status}</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Spaced-out mini badges list of invited vendors */}
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Selected Invitation Queue ({invitedVendors.length})
                      </div>
                      
                      {invitedVendors.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 p-6 rounded-xl text-center min-h-[140px] bg-white/50 dark:bg-slate-900/10">
                          <span className="text-2xl text-slate-405 mb-1.5">📬</span>
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            Queue is Empty
                          </span>
                          <p className="text-[10px] text-slate-450 dark:text-slate-500 max-w-[170px] mt-1 leading-relaxed">
                            Certified service suppliers selected above will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 py-1 max-h-[180px] md:max-h-none overflow-y-auto">
                          {invitedVendors.map((v) => (
                            <div 
                              key={v.name} 
                              className="flex items-center gap-1.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/20 text-slate-850 dark:text-slate-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm animate-fade-in pr-1.5 shrink-0"
                            >
                              <span className="truncate max-w-[170px]">{v.name}</span>
                              <button
                                type="button"
                                onClick={() => setInvitedVendors(prev => prev.filter(iv => iv.name !== v.name))}
                                className="w-4 h-4 rounded-full bg-emerald-100 hover:bg-rose-500 hover:text-white dark:bg-emerald-900/50 dark:hover:bg-rose-600 dark:hover:text-white text-emerald-800 dark:text-emerald-300 flex items-center justify-center cursor-pointer transition-all shrink-0"
                                title={`Remove ${v.name}`}
                              >
                                <X className="w-2 h-2" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action footprint base with generous vertical negative space */}
                    <div className="pt-8 mt-auto border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                      <button 
                        type="submit"
                        className="w-full py-3 bg-emerald-600 dark:bg-emerald-555 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-white" />
                        Publish Bid to Network
                      </button>
                      
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="w-full py-1 text-slate-500 dark:text-slate-400 hover:text-rose-550 dark:hover:text-rose-400 text-xs font-semibold text-center underline cursor-pointer hover:no-underline transition-all"
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
      </AnimatePresence>      {/* FLOATING ACTION CHAT & COLLABORATION OVERLAY */}
      <div className={cn(
        "fixed right-6 z-50 flex flex-col items-end gap-3 font-sans transition-all duration-300",
        "bottom-6"
      )}>
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[400px] shadow-2xl overflow-hidden"
              style={{ maxHeight: "calc(100vh - 120px)" }}
            >
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-202 uppercase tracking-wider">
                    {isVendor ? 'Buyer-Supplier Collaboration' : 'Collaboration & Chat'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 transition-colors cursor-pointer"
                  title="Close collaboration chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/20 dark:bg-slate-950/20">
                {(commentsDB[selectedBid.id] || []).map((msg, i) => (
                  <div key={i} className={cn("flex gap-2.5", msg.isSelf ? "flex-row-reverse" : "")}>
                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {msg.avatar}
                    </div>
                    <div className={cn("flex flex-col max-w-[80%]", msg.isSelf ? "items-end" : "items-start")}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{msg.sender}</span>
                        <span className="text-[9px] text-slate-450 dark:text-slate-505">{msg.time}</span>
                      </div>
                      <div className={cn(
                        "text-xs rounded-lg p-2.5 shadow-sm leading-relaxed",
                        msg.isSelf 
                          ? "bg-emerald-600 text-white rounded-tr-none font-medium" 
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-202 rounded-tl-none font-medium"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
                {(commentsDB[selectedBid.id] || []).length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-505 space-y-2">
                    <MessageSquare className="w-8 h-8 opacity-30 animate-pulse" />
                    <p className="text-xs font-semibold">No comments on this demand yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-150 dark:border-slate-800">
                <form onSubmit={(e) => { e.preventDefault(); handlePostComment(); }} className="relative flex items-center">
                  <input 
                    type="text" 
                    placeholder={isVendor ? "Send direct message or proposal to buyer..." : "Type collaboration messages here..."}
                    value={currentComment || ''}
                    onChange={(e) => setCurrentComment(e.target.value)}
                    className="w-full bg-slate-55/60 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  <button 
                    type="submit" 
                    className="absolute right-1.5 p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Circular Floating Messenger Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 rounded-full bg-emerald-600 dark:bg-[#10B981] text-white flex items-center justify-center shadow-2xl hover:bg-emerald-700 dark:hover:bg-[#059669] transition-all transform hover:scale-105 active:scale-95 cursor-pointer group relative"
          title={isChatOpen ? "Hide Collaboration" : "Show Collaboration"}
        >
          <MessageSquare className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          
          {/* Unread dot signal animation */}
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white dark:border-slate-900 items-center justify-center">
              <span className="text-[7px] text-white font-extrabold font-mono">!</span>
            </span>
          </span>
        </button>
      </div>

      <AnimatePresence>
        {isPdfModalOpen && pdfModalData && (
          <POPDFDocumentModal
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            data={pdfModalData}
          />
        )}
      </AnimatePresence>

      {/* INDIVIDUAL BID SIDE-PANEL OVERLAY MODAL (DRAWER) */}
      <AnimatePresence>
        {detailDrawerOpen && detailModalQuote && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs z-50 cursor-pointer"
            />
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg md:max-w-xl bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 text-slate-800 dark:text-slate-150 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-205 dark:border-slate-805 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                    <Bot className="text-emerald-500 dark:text-emerald-400 w-4 h-4 animate-pulse shrink-0" />
                    Supplier Intel &amp; Negotiation Center
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase font-mono">
                    Vendor Portal • {detailModalQuote.vendor}
                  </p>
                </div>
                <button
                  onClick={() => setDetailDrawerOpen(false)}
                  className="p-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
                >
                  [ Close ]
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/40">
                
                {/* Quick Vendor Meta Stats */}
                <div className="grid grid-cols-3 gap-3 bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800/80 shadow-xs">
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-slate-500 font-mono">Base Rate</span>
                    <span className="font-mono text-xs text-slate-900 dark:text-emerald-400 font-extrabold">${(detailModalQuote.pricePerCase || detailModalQuote.pricePerUnit || 18.50).toFixed(2)}/cs</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-slate-500 font-mono">SLA Score</span>
                    <span className="text-xs text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center gap-1 font-mono">
                      <Award className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      {detailModalQuote.qualityIndex}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-slate-500 font-mono">Availability</span>
                    <span className="text-[11px] text-slate-800 dark:text-slate-200 font-black truncate block mt-0.5" title={detailModalQuote.terms}>
                      {detailModalQuote.availableQuantity !== undefined ? `${detailModalQuote.availableQuantity.toLocaleString()} cs` : 'Full Vol'}
                    </span>
                  </div>
                </div>

                {/* Section 1: True-Cost Sourcing Analysis box */}
                <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-805 rounded-xl p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5 font-mono">
                    <Receipt className="text-emerald-650 dark:text-emerald-400 w-4 h-4" />
                    True-Cost Landed Sourcing Analysis
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                    Accounting for dynamic fuel surcharges, cold-chain regulatory fees, and carrier tariff tiers:
                  </p>

                  <div className="space-y-2 pt-1 font-mono">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-450">Base Sourcing rate:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-300">${(detailModalQuote.pricePerCase || detailModalQuote.pricePerUnit || 18.50).toFixed(2)}/case</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-450">Logistics Freight surcharge:</span>
                      <span className="font-extrabold text-rose-650 dark:text-rose-400">+$2.85/case</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-450">Active Smart Refrigeration compliance fee:</span>
                      <span className="font-extrabold text-[#10B981] dark:text-[#10B981]">+$1.20/case</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 my-2 pt-2 flex justify-between items-center">
                      <span className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200">True Landed Cost limit:</span>
                      <span className="text-sm font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2.5 py-0.5 rounded">
                        ${((detailModalQuote.pricePerCase || detailModalQuote.pricePerUnit || 18.50) + 4.05).toFixed(2)}/case
                      </span>
                    </div>
                  </div>

                  <div className="text-[9.5px] p-2 bg-emerald-50 dark:bg-emerald-500/5 hover:bg-emerald-100/50 dark:hover:bg-emerald-500/10 transition-colors border border-emerald-200 dark:border-emerald-500/20 rounded-lg flex items-center gap-1.5 font-mono text-emerald-700 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Optimal margin distribution based on baseline SLA requirements</span>
                  </div>
                </div>

                {/* Section 2: Route tracking maps */}
                <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-805 rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5 font-mono">
                      <MapPin className="text-indigo-500 dark:text-indigo-400 w-4 h-4" />
                      Dynamic Route Corridor Tracking Map
                    </h4>
                    <span className="text-[9px] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-1.5 py-0.5 rounded font-mono text-indigo-700 dark:text-indigo-305 uppercase tracking-widest font-extrabold">
                      Active Corridor
                    </span>
                  </div>
                  
                  {/* Visual Stylized Map Drawing */}
                  <div className="border border-slate-200 dark:border-slate-800/80 rounded-xl bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden h-32 flex flex-col justify-between">
                    <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
                    
                    {/* Visual dashed path connecting nodes */}
                    <div className="absolute top-1/2 left-8 right-8 h-0.5 border-t border-dashed border-slate-300 dark:border-slate-800 -translate-y-1/2 pointer-events-none z-0" />
                    
                    {/* Connected stylized nodes along the route path */}
                    <div className="flex justify-between items-center relative z-10 w-full h-full pt-4">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-[8px] font-black uppercase font-mono text-emerald-700 dark:text-emerald-400 mt-2">Origin Farm</span>
                        <span className="text-[7.5px] text-slate-500 dark:text-slate-500 mt-0.5 font-mono">Pre-Cooling OK</span>
                      </div>
                      
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg relative">
                          <span className="absolute animate-ping inset-0 rounded-full bg-indigo-400 dark:bg-indigo-450 opacity-75"></span>
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-200 dark:bg-indigo-200" />
                        </div>
                        <span className="text-[8px] font-black uppercase font-mono text-indigo-700 dark:text-indigo-400 mt-2">Logistics Route</span>
                        <span className="text-[7.5px] text-indigo-600 dark:text-indigo-305 mt-0.5 font-mono font-medium">In Transit</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-850 border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg text-slate-500 dark:text-slate-400">
                          <Clock className="w-2.5 h-2.5" />
                        </div>
                        <span className="text-[8px] font-black uppercase font-mono text-slate-600 dark:text-slate-400 mt-2">Receiver DC</span>
                        <span className="text-[7.5px] text-slate-500 dark:text-slate-550 mt-0.5 font-mono">ETA: {detailModalQuote.eta || 'Tomorrow'}</span>
                      </div>
                    </div>
                    
                    {/* Telemetry data overlay */}
                    <div className="absolute top-2 left-3 text-[8px] text-slate-750 dark:text-slate-400 font-mono uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded shadow-xs">
                      Route Telemetry: {detailModalQuote.terms ? (detailModalQuote.terms.includes(' via ') ? detailModalQuote.terms.split(' via ')[1] : 'Main Corridor') : 'Reefer Express'}
                    </div>
                  </div>

                  {/* Route Parameters list */}
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono leading-relaxed text-slate-500">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-205 dark:border-slate-850 space-y-1">
                      <span className="text-slate-500 dark:text-slate-500 block text-[8px] uppercase font-bold">Planned Carrier Segment:</span>
                      <span className="text-slate-800 dark:text-slate-205 font-extrabold font-mono text-xs block truncate" title={detailModalQuote.terms}>
                        {detailModalQuote.terms || 'Continuous Cold-Chain Transit'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-205 dark:border-slate-850 space-y-1">
                      <span className="text-slate-500 dark:text-slate-500 block text-[8px] uppercase font-bold">Estimated Route Risk:</span>
                      <span className="text-emerald-750 dark:text-[#10B981] font-extrabold font-mono text-xs block">
                        0.05 index (Stable Corridor)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Active "SUPPLIER NEGOTIATIONS" chat window interface */}
                <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col h-[320px] shadow-sm space-y-3">
                  <div className="flex justify-between items-center text-xs font-mono font-black uppercase text-slate-800 dark:text-slate-205 border-b border-slate-150 dark:border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5 font-sans font-bold text-slate-800 dark:text-slate-205">
                      <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                      Supplier Negotiations Chat
                    </span>
                    <span className="text-[8.5px] font-bold text-emerald-750 dark:text-[#10B981] bg-emerald-50 dark:bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/10">
                      Live Link Enabled
                    </span>
                  </div>

                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 p-1 text-xs custom-scrollbar">
                    {(negotiationsDB[detailModalQuote.id] || []).map((msg, i) => {
                      const isSelf = msg.sender.includes('You');
                      return (
                        <div key={i} className={cn("flex gap-2.5", isSelf ? "flex-row-reverse" : "")}>
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0 uppercase">
                            {msg.avatar}
                          </div>
                          <div className={cn("flex flex-col max-w-[85%]", isSelf ? "items-end" : "items-start")}>
                            <div className="flex items-baseline gap-2 mb-0.5 font-mono">
                              <span className="text-[10px] font-bold text-slate-605 dark:text-slate-300">{msg.sender}</span>
                              <span className="text-[8.5px] text-slate-450 dark:text-slate-500">{msg.time}</span>
                            </div>
                            <div className={cn(
                              "rounded-lg p-2.5 shadow-sm leading-relaxed text-xs",
                              isSelf 
                                ? "bg-indigo-600 text-white rounded-tr-none font-medium" 
                                : "bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-850 rounded-tl-none font-medium"
                            )}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(negotiationsDB[detailModalQuote.id] || []).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-450 dark:text-slate-500 space-y-1 font-mono">
                        <MessageSquare className="w-8 h-8 opacity-20" />
                        <p className="text-[11px] font-bold uppercase mt-2">No Negotiations Initiated</p>
                        <p className="text-[9px] text-slate-500">Send an inquiry below to negotiate rates or refrigeration criteria.</p>
                      </div>
                    )}
                  </div>

                  {/* Quick Chat Input */}
                  <div className="bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl p-1.5 flex items-center shrink-0">
                    <input 
                      type="text" 
                      placeholder="Type parameters counter-offer or proposal counter..."
                      value={quoteChatInputs[detailModalQuote.id] || ''}
                      onChange={(e) => {
                        const text = e.target.value;
                        setQuoteChatInputs(prev => ({ ...prev, [detailModalQuote.id]: text }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendNegotiation(detailModalQuote.id, detailModalQuote.vendor);
                        }
                      }}
                      className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-450 dark:placeholder:text-slate-600 px-2 outline-none py-1 dark:text-white"
                    />
                    <button 
                      onClick={() => handleSendNegotiation(detailModalQuote.id, detailModalQuote.vendor)}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-transform cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                      title="Send negotiation proposal"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* ADVANCED COMPARISON TABULAR SIDE-BY-SIDE OVERLAY MODAL */}
      <AnimatePresence>
        {isCompareModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCompareModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 cursor-pointer"
            />
            {/* Modal Box */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden text-slate-800 dark:text-slate-100"
              >
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-805 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest leading-none">
                        Quotation Side-by-Side Comparison Ledger
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono mt-1.5 leading-none">
                        Contrasting checked profiles for final procurement vetting &amp; SLA compliance
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCompareModalOpen(false)}
                    className="p-1 px-3 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all font-mono font-bold text-xs cursor-pointer border border-slate-200 dark:border-slate-700/60 shadow-xs"
                  >
                    [ Dismiss Table ]
                  </button>
                </div>

                {/* Content - Scrollable Table */}
                <div className="flex-1 overflow-auto p-5 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/20">
                  <div className="min-w-[620px]">
                    <table className="w-full border-collapse text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-450 uppercase text-[9px] tracking-widest font-extrabold pb-3 text-left">
                          <th className="py-3 px-2 font-bold w-[180px] text-slate-500 dark:text-slate-400">Comparing Metrics</th>
                          {selectedBid.quotations
                              .filter(q => splitSelectedQuoteIds.includes(q.id))
                              .map(quote => (
                                <th key={quote.id} className="py-3 px-3 text-indigo-700 dark:text-indigo-400 font-black text-center uppercase tracking-normal truncate max-w-[170px]" title={quote.vendor}>
                                  {quote.vendor.split(' ')[0]} Sourcing Pro
                                </th>
                              ))
                          }
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-850 text-slate-700 dark:text-slate-350">
                        
                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Base Rate</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => (
                              <td key={quote.id} className="py-3.5 px-3 text-center text-emerald-700 dark:text-emerald-405 font-black text-sm">
                                ${(quote.pricePerCase || quote.pricePerUnit || 18.50).toFixed(2)}/cs
                              </td>
                            ))
                          }
                        </tr>

                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Quality Score</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => (
                              <td key={quote.id} className="py-3.5 px-3 text-center">
                                <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono">
                                  {quote.qualityIndex}
                                </span>
                              </td>
                            ))
                          }
                        </tr>

                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Offer Volume Cap</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => {
                              const volume = quote.availableQuantity !== undefined ? `${quote.availableQuantity.toLocaleString()} cases` : `${selectedBid.quantity.toLocaleString()} cases`;
                              return (
                                <td key={quote.id} className="py-3.5 px-3 text-center text-slate-800 dark:text-slate-200">
                                  {volume}
                                </td>
                              );
                            })
                          }
                        </tr>

                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Cooling Fleet</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => {
                              const tech = quote.fleetSpecification || 'Ambient';
                              return (
                                <td key={quote.id} className="py-3.5 px-3 text-center">
                                  <span className={cn(
                                    "text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono border",
                                    tech.includes('Active') 
                                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-405 border-emerald-200 dark:border-emerald-500/20" 
                                      : tech.includes('Passive') 
                                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-705 dark:text-amber-405 border-amber-200 dark:border-amber-500/20" 
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                  )}>
                                    {tech}
                                  </span>
                                </td>
                               );
                            })
                          }
                        </tr>

                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Landed Surcharge</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => (
                              <td key={quote.id} className="py-3.5 px-3 text-center text-rose-650 dark:text-rose-450 font-semibold font-mono font-bold">
                                +$4.05/case
                              </td>
                            ))
                          }
                        </tr>

                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Estimated Transit ETA</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => (
                              <td key={quote.id} className="py-3.5 px-3 text-center text-slate-800 dark:text-slate-200 text-[11px]">
                                {quote.eta || selectedBid.deliveryDate}
                              </td>
                            ))
                          }
                        </tr>

                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Fulfillment Risk Profile</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => (
                              <td key={quote.id} className="py-3.5 px-3 text-center">
                                <span className="text-emerald-700 dark:text-[#10B981] font-bold">Stable (0.05 Index)</span>
                              </td>
                            ))
                          }
                        </tr>

                        <tr className="hover:bg-slate-101 hover:dark:bg-slate-900/20 transition-colors">
                          <td className="py-3.5 px-2 text-slate-500 font-extrabold uppercase text-[8.5px] tracking-wider">Action Vetting</td>
                          {selectedBid.quotations
                            .filter(q => splitSelectedQuoteIds.includes(q.id))
                            .map(quote => (
                              <td key={quote.id} className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => {
                                    setDetailModalQuote(quote);
                                    setDetailDrawerOpen(true);
                                    setIsCompareModalOpen(false);
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-[9.5px] uppercase font-bold tracking-wider text-white transition-all cursor-pointer font-mono"
                                >
                                  👁️ View details &amp; Chat
                                </button>
                              </td>
                            ))
                          }
                        </tr>

                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Footer Instructions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-center text-[9px] text-slate-500 uppercase font-mono tracking-widest">
                  Modify the checkboxes on the parent bid grid anytime to swap compared vendors.
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* SLA OPERATIONAL COMPLIANCE AUDIT SIDE-DRAWER */}
      <AnimatePresence>
        {isComplianceDrawerOpen && selectedComplianceContract && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComplianceDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 cursor-pointer"
            />
            
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg md:max-w-xl bg-white border-l border-slate-200 shadow-2xl z-50 text-slate-800 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="text-emerald-600 w-4 h-4 shrink-0" />
                    SLA Operational Compliance Audit
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">
                    Agreement ID • {selectedComplianceContract.id}
                  </p>
                </div>
                <button
                  onClick={() => setIsComplianceDrawerOpen(false)}
                  className="p-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all font-bold text-xs border border-slate-200 shadow-sm cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/50">
                
                {/* Contract Overview Box */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono">Vendor Partner</span>
                      <span className="text-sm font-extrabold text-[#0F172A]">{selectedComplianceContract.vendor}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase tracking-wider">
                      {selectedComplianceContract.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono">Requirement Category</span>
                      <span className="text-xs font-semibold text-slate-700">{selectedComplianceContract.cat}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono">Commitment</span>
                      <span className="text-xs font-semibold text-slate-700">{selectedComplianceContract.contractValue}</span>
                    </div>
                  </div>
                </div>

                {/* Section 1: Delivery SLA Performance Score */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-sans">
                    <Award className="text-emerald-600 w-4 h-4" />
                    Delivery SLA Performance Score
                  </h4>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900">99.2%</span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Excellent Reliability</span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '99.2%' }}></div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed font-sans font-medium">
                    This vendor maintains a high delivery frequency compliance under SLA with zero reported delays in the last 30 business cycles.
                  </p>
                </div>

                {/* Section 2: Cold-Chain Thermal Integrity Tracker */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-sans">
                    <Thermometer className="text-sky-500 w-4 h-4" />
                    Cold-Chain Thermal Integrity Tracker
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                    Real-time IoT sensors checking biological safety threshold (baseline limit: max 4°C):
                  </p>

                  <div className="space-y-2 pt-1 font-mono">
                    <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-slate-605 font-sans font-semibold text-[11px]">Checkpoint 1 (Load Stage)</span>
                      </div>
                      <span className="font-bold text-[#0F172A] text-[11px]">3.8°C — Safe baseline verified</span>
                    </div>
                    <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-slate-605 font-sans font-semibold text-[11px]">Checkpoint 2 (In Transit)</span>
                      </div>
                      <span className="font-bold text-[#0F172A] text-[11px]">4.1°C — Active cooling correction</span>
                    </div>
                    <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-slate-605 font-sans font-semibold text-[11px]">Checkpoint 3 (Hub Ingress)</span>
                      </div>
                      <span className="font-bold text-[#0F172A] text-[11px]">3.9°C — Target safety verified</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Associated Active Shipments Ledger */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-sans">
                    <Receipt className="text-indigo-650 w-4 h-4" />
                    Associated Active Shipments Ledger
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                    Click any live Child Release PO to review active manifests and temperature threshold limits:
                  </p>

                  <div className="space-y-2 pt-1">
                    {orders.filter(o => o.vendor === selectedComplianceContract.vendor).length > 0 ? (
                      orders
                        .filter(o => o.vendor === selectedComplianceContract.vendor)
                        .map((order) => (
                          <div 
                            key={order.po}
                            onClick={() => {
                              const isMasterBpo = order.po.startsWith('BPO-') || order.po.includes('BLANKET') || order.po.startsWith('PO-');
                              setPdfModalData({
                                poId: order.po,
                                parentBpoId: `BPO-2026-8842`,
                                horizon: isMasterBpo ? 'Multi-Month Sourcing Commitment' : 'Standard 1-Month Contract',
                                batchIndex: 'Immediate Direct Sourcing',
                                targetDC: 'Central Logistics Hub (Node-A)',
                                item: order.item,
                                qty: 1200,
                                unit: 'Cases',
                                pricePerUnit: 15.50,
                                vendorName: order.vendor,
                                vendorScore: '99%',
                                tempSpec: '36°F - 42°F',
                                transitMaxSpec: '24 Hours max',
                                shelfLifeSpec: '18 days'
                              });
                              setIsPdfModalOpen(true);
                            }}
                            className="flex justify-between items-center text-xs p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs cursor-pointer transition-all group"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-indigo-650 group-hover:text-indigo-800 font-mono">{order.po}</span>
                              <span className="text-[10px] text-slate-500 font-medium">{order.item}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest",
                                order.status === 'Fulfilled' ? "bg-emerald-50 text-emerald-700" :
                                order.status === 'In Transit' ? "bg-blue-50 text-blue-700" :
                                "bg-indigo-50 text-indigo-700"
                              )}>
                                {order.status}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-medium">No active child shipments found on-road</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* REAL-TIME ORDER TELEMETRY & MANIFEST AUDIT SIDE-DRAWER */}
      <AnimatePresence>
        {isTelemetryDrawerOpen && selectedTelemetryOrder && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTelemetryDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 cursor-pointer"
            />
            
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg md:max-w-xl bg-white border-l border-slate-200 shadow-2xl z-50 text-slate-800 flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Receipt className="text-emerald-600 w-4 h-4 shrink-0" />
                    Real-Time Order Telemetry & Manifest Audit
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">
                    Order Ref • {selectedTelemetryOrder.po}
                  </p>
                </div>
                <button
                  onClick={() => setIsTelemetryDrawerOpen(false)}
                  className="p-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all font-bold text-xs border border-slate-200 shadow-sm cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/50">
                
                {/* PO Overview Box */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono">Vendor Partner</span>
                      <span className="text-sm font-extrabold text-[#0F172A]">{selectedTelemetryOrder.vendor}</span>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider",
                      selectedTelemetryOrder.status === 'Fulfilled' ? "bg-emerald-50 text-emerald-700 border-emerald-150" : 
                      selectedTelemetryOrder.status === 'In Transit' ? "bg-blue-50 text-blue-700 border-blue-150" :
                      selectedTelemetryOrder.status === 'Processing' ? "bg-indigo-50 text-indigo-700 border-indigo-150 animate-pulse" : 
                      "bg-slate-50 text-slate-700 border-slate-150"
                    )}>
                      {selectedTelemetryOrder.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono">Cargo Description</span>
                      <span className="text-xs font-semibold text-slate-700">{selectedTelemetryOrder.item}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono">Total Amount</span>
                      <span className="text-xs font-bold text-slate-900 font-mono">{selectedTelemetryOrder.amt}</span>
                    </div>
                  </div>
                </div>

                {/* Section 1: Active IoT Sensor Streaming Module */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-sans">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-450 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                    </span>
                    Active IoT Sensor Streaming Module
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono mb-1">Live Coordinates</span>
                      <span className="text-xs font-bold font-mono text-slate-800">
                        {selectedTelemetryOrder.status === 'Fulfilled' ? '34.0522° N, 118.2437° W (Delivered)' : '37.7749° N, 122.4194° W (En Route)'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono mb-1">Internal Container Temp</span>
                      <span className="text-xs font-bold font-mono text-slate-800 flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        {selectedTelemetryOrder.status === 'Fulfilled' ? '3.5°C' : '3.8°C'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="block text-[8px] uppercase tracking-widest text-slate-400 font-mono mb-1.5">Telemetry Health Logs</span>
                    <div className="space-y-1.5 font-mono text-[10px]">
                      <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded border border-emerald-100 text-emerald-800">
                        <span>[STREAM LOG] Cold-chain biological stability normal</span>
                        <span>09:42:15 UTC</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-slate-600">
                        <span>[GNSS LOCK] GPS tracker active, accuracy 2.5m</span>
                        <span>09:41:00 UTC</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Smart Dynamic ETA Matrix */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-sans">
                    <Clock className="text-indigo-650 w-4 h-4" />
                    Smart Dynamic ETA Matrix
                  </h4>

                  {(() => {
                    const isFulfilled = selectedTelemetryOrder.status === 'Fulfilled';
                    const isProcessing = selectedTelemetryOrder.status === 'Processing';
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                          <span className="text-2xl font-black text-slate-900">
                            {isFulfilled ? 'Delivered' : isProcessing ? '48h Expected' : '14h Expected'}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wide",
                            isFulfilled ? "text-emerald-600" : isProcessing ? "text-amber-500" : "text-blue-500"
                          )}>
                            {isFulfilled ? "SLA Target Completed" : isProcessing ? "Warning: Intake Pending" : "In Transit (On-Time)"}
                          </span>
                        </div>

                        {isProcessing && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 font-sans font-medium flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Pending Intake Alert:</span> Delayed carrier dispatch or high warehouse queue at the loading hub.
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 pt-1 font-mono text-[10px]">
                          <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-slate-500">Departure Timestamp</span>
                            <span className="font-bold text-slate-800">{selectedTelemetryOrder.date}</span>
                          </div>
                          <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-slate-500">E.T.A. Threshold</span>
                            <span className="font-bold text-slate-800">
                              {isFulfilled ? 'Completed' : '15 days post-issue max'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Section 3: Document Controller Component */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
                  <button
                    onClick={() => {
                      const row = selectedTelemetryOrder;
                      const isMasterBpo = row.po.startsWith('BPO-') || row.po.includes('BLANKET');
                      setPdfModalData({
                        poId: isMasterBpo ? row.po + '-R01' : row.po,
                        parentBpoId: isMasterBpo ? row.po : `BPO-2026-${row.po.split('-')[1] || '8842'}`,
                        horizon: isMasterBpo ? 'Multi-Month Sourcing Commitment' : 'Standard 1-Month Contract',
                        batchIndex: isMasterBpo ? 'Release 1 of 12 Batches' : 'Immediate Direct Sourcing',
                        targetDC: 'Central Logistics Hub (Node-A)',
                        item: row.item,
                        qty: 1200,
                        unit: 'Cases',
                        pricePerUnit: 15.50,
                        vendorName: row.vendor,
                        vendorScore: '98%',
                        tempSpec: '36°F - 42°F',
                        transitMaxSpec: '24 Hours max',
                        shelfLifeSpec: '14 days'
                      });
                      setIsPdfModalOpen(true);
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors uppercase tracking-widest cursor-pointer underline decoration-dotted underline-offset-4"
                  >
                    View PDF manifest
                  </button>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
