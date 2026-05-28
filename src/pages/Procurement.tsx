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
  Calculator
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';

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
  status: 'Pending Approval' | 'Processing' | 'In Transit' | 'Fulfilled';
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

  // Quotation comparison award flow
  const [awardingQuoteId, setAwardingQuoteId] = useState<string | null>(null);
  const [isAwardingInProgress, setIsAwardingInProgress] = useState(false);

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

    setPublishStep(1);
    setSimulationLogs(['Extracting fresh biological & cold-chain specifications...', 'Category verified: ' + newCategory]);

    setTimeout(() => {
      setPublishStep(2);
      setSimulationLogs(prev => [
        ...prev,
        `Matching pre-vetted vendors in Category: ${newCategory}...`,
        `Matched ${matchedVendorsLive.length} approved partners automatically.`
      ]);
    }, 1200);

    setTimeout(() => {
      setPublishStep(3);
      setSimulationLogs(prev => [
        ...prev,
        `Dispatching secure RFQ payloads to matched vendor dashboards...`,
        'Encrypted cold-chain SLA targets attached successfully.',
        'Automated notifications dispatched to ' + matchedVendorsLive.map(v => v.name).join(', ') + '.',
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
        approvedVendors: [...matchedVendorsLive],
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

      // 3. Generate and Add Purchase Order
      const newPO: PurchaseOrder = {
        po: `PO-2026-0${100 + orders.length + 1}X`,
        requirementId: selectedBid.id,
        vendor: quote.vendor,
        item: selectedBid.item,
        amt: `$${quote.totalPrice.toLocaleString()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Pending Approval'
      };
      setOrders(prev => [newPO, ...prev]);

      // Push to our new active shipments list in localStorage for Logistics.tsx integration
      try {
        const stored = localStorage.getItem('freshguard-active-shipments');
        const list = stored ? JSON.parse(stored) : [];
        const newShipment = {
          id: newPO.po,
          vendor: quote.vendor,
          item: `${selectedBid.quantity} ${selectedBid.unit || 'Cases'} of ${selectedBid.item}`,
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
          date: new Date().toISOString()
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

      {/* GLOBAL PIPELINE METRICS (Top of Page) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-xl p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              {isVendor ? 'Your Active Bids' : 'Active RFQs'}
            </p>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1.5">
              {isVendor ? '3 Active Bids' : '14 Open Pipelines'}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-xl p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              {isVendor ? 'Total Dispatched Volume' : 'Sourced Volume'}
            </p>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1.5">
              {isVendor ? '12,400 Cases' : '45,000 Cases This Week'}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-xl p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              {isVendor ? 'Avg Response Rating' : 'Avg. Vendor Response'}
            </p>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1.5">
              {isVendor ? '98.5% (Excellent)' : '1.8 Hours'}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-xl p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] transition-all flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">
              {isVendor ? 'Route Risk Flags' : 'AI Sourcing Sieve'}
            </p>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1.5">
              {isVendor ? '0 Flags Active' : '2 Corridors Flagged'}
            </h3>
          </div>
        </div>
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
              {/* COLUMN B: BID RESOLUTION WORKSPACE/MATRIX (45% Width - lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-155 dark:border-slate-805 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] overflow-hidden h-[720px]">
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
              <>
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
                                : "border-slate-200 dark:border-slate-800"
                            )}
                          >
                            {/* Left Side: Supplier & Logistics Attributes Grid */}
                            <div className="w-full flex flex-col gap-5 border-b border-slate-150 dark:border-slate-800 pb-6">
                              
                              {/* Card Header Info */}
                              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-tight">{quote.vendor}</h4>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
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
                                  <span className="text-[10px] text-slate-400 dark:text-slate-550 block mt-0.5">
                                    Base Sourcing Value: ${baseQuotePrice.toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Typography Attributes Grid (Responsively configured grid) */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 bg-slate-55 dark:bg-slate-950 rounded-xl text-xs border border-slate-200/50 dark:border-slate-800 w-full max-w-full">
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Est. Delivery</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">{quote.eta}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Harvest Batch Age</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">{harvestAgeText}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">Thermal Fleet Spec</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">{quote.fleetSpecification || 'Ambient'}</span>
                                </div>
                              </div>

                              {/* AI Risk Segment */}
                              <div className="space-y-1.5 font-sans w-full">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider block">AI Shrinkage &amp; Biological Prediction</span>
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
                                  <p className="text-[10px] text-slate-550 dark:text-slate-404 mt-1">
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
                                <span className="text-[10px] text-slate-400 max-w-[100%] sm:max-w-[60%]">
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
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  Supplier Negotiations
                                </span>
                                <span className="text-[9px] text-slate-415 dark:text-slate-550 font-mono">Live Link</span>
                              </div>

                              {/* Chat Message Scroll frame */}
                              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs max-h-[180px] custom-scrollbar">
                                {(negotiationsDB[quote.id] || []).map((msg, index) => {
                                  const isSelf = msg.sender.includes('(You)');
                                  const isBuyer = msg.sender.includes('Sarah M.');
                                  return (
                                    <div key={index} className={cn("flex flex-col gap-1", isSelf ? "items-end" : "items-start")}>
                                      <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-505 font-bold">
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
                                  <div className="text-center py-6 text-[10px] text-slate-400 italic">
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
            <div className="bg-slate-55 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-[320px] shadow-inner">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-202 uppercase tracking-wider">
                  {isVendor ? 'Buyer-Supplier Collaboration' : 'Collaboration & Chat'}
                </h3>
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
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">{msg.time}</span>
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
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-850/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {isVendor ? 'Supplier Dispatch Integration SLA' : 'Automated RFQ System Status'}
              </h4>
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
                      <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-1 shrink-0 animate-ping"></div>
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
                      <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mt-1 shrink-0 animate-ping"></div>
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
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/> 
              Active SLA Sourcing Agreements & Contracts
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search agreements..." className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-100" />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
             <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-55/60 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Contract SLA ID</th>
                  <th className="px-6 py-3.5">Approved Vendor Partner</th>
                  <th className="px-6 py-3.5">Fresh Category</th>
                  <th className="px-6 py-3.5">Requirement Ref / Item Name</th>
                  <th className="px-6 py-3.5">SLA Duration</th>
                  <th className="px-6 py-3.5">Volume Commitment Value</th>
                  <th className="px-6 py-3.5 text-right">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                {(isVendor ? contracts.filter(c => c.vendor === 'Global Farms Suppliers') : contracts).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 font-mono text-[11px]">{row.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{row.vendor}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {row.cat}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{row.item}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {row.requirementId}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{row.duration}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{row.contractValue}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm",
                        row.status === 'Active' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400"
                      )}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>
          </div>
        </div>
      )}

      {/* Tab Content: purchase orders tracker table */}
      {activeTab === 'orders' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/> 
              Purchase Orders Issued & Auto-Trackers
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search POs..." className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-slate-100" />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
             <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-55/60 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">PO Number</th>
                  <th className="px-6 py-3.5">Vendor Partner</th>
                  <th className="px-6 py-3.5">Fresh Goods Description</th>
                  <th className="px-6 py-3.5">Total Amount</th>
                  <th className="px-6 py-3.5">Issue Date</th>
                  <th className="px-6 py-3.5">Fulfillment Status</th>
                  <th className="px-6 py-3.5 text-right">System Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                {(isVendor ? orders.filter(o => o.vendor === 'Global Farms Suppliers') : orders).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 font-mono text-[11px]">{row.po}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{row.vendor}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{row.item}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {row.requirementId}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-extrabold text-[12px]">{row.amt}</td>
                    <td className="px-6 py-4 text-slate-650 dark:text-slate-400">{row.date}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm",
                        row.status === 'Fulfilled' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400" : 
                        row.status === 'In Transit' ? "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400" :
                        row.status === 'Processing' ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-400 animate-pulse" : 
                        "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      )}>{row.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="px-2.5 py-1 rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[11px] font-bold">
                         View PDF Invoice
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>
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
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Target Delivery Date</label>
                        <input 
                          type="date" 
                          required
                          value={newDeliveryDate}
                          onChange={(e) => setNewDeliveryDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 dark:text-slate-100 transition-colors" 
                        />
                      </div>

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
                    </div>

                    {/* Biological constraints limits fields */}
                    <div className="p-4 bg-slate-55/60 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <Thermometer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Biological Cold-chain Parameters (SLA)</h4>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">Min Temp Limit (°F)</label>
                          <input 
                            type="number" 
                            required
                            value={newMinTemp}
                            onChange={(e) => setNewMinTemp(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">Max Temp Limit (°F)</label>
                          <input 
                            type="number" 
                            required
                            value={newMaxTemp}
                            onChange={(e) => setNewMaxTemp(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">Target Humidity (%)</label>
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
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">Target Cold-Chain Temp (°C)</label>
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
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">Max Allowable Transit</label>
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
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">Min Delivery Shelf Life</label>
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
                        <span>FreshGuard Match Engine</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Suppliers below will be immediately pinged, matched on cold-chain score:
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] md:max-h-none">
                      {matchedVendorsLive.map((v, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-20 border-slate-150 dark:border-slate-800 flex items-center justify-between shadow-sm">
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">{v.name}</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 block truncate">{v.status}</span>
                          </div>
                          <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                            IDx: {v.score}%
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                      <button 
                        type="submit"
                        className="w-full py-2.5 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-white" />
                        Publish Bid to Network
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

    </div>
  );
}
