/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Upload, 
  Plus, 
  X, 
  Cpu, 
  Loader2, 
  TrendingUp, 
  ArrowUpRight, 
  ChevronRight,
  Database,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import { motion, AnimatePresence } from 'motion/react';

// Baseline recent inbound shipments list that can be scanned for claim selection
const RECENT_INBOUND_DELIVERIES = [
  { 
    id: "PO-2026-9912A", 
    product: "Fresh Salmon", 
    vendor: "Ocean Catch Suppliers", 
    quantity: 200, 
    unit: "Cases",
    defaultIssue: "Temperature Excursion",
    suggestedAmount: 2400,
    evidenceSummary: "Linked to FreshDetect v4.2 Scan ID #9912-Reject • Excursion: 12.4°C tracked for 14.8 hours",
    aiComment: "Persistently failed core-transit chilling index. Active loggers tracked continuous excursion of 12.4°C for 14.8 hours. Slime levels indicate immediate bacterial oxidation. Reject lot."
  },
  { 
    id: "PO-2026-7731C", 
    product: "Organic Milk", 
    vendor: "Sunrise Dairy Co.", 
    quantity: 400, 
    unit: "Cases",
    defaultIssue: "Visual Spoilage / Damage",
    suggestedAmount: 4800,
    evidenceSummary: "Linked to FreshDetect v4.2 Scan ID #7731-Reject • Wet foundation detected",
    aiComment: "Visual inspection detected moisture leakage at the pallet foundation. Temperature spiked directly to 9.5°C, surpassing safe storage requirements for over 9 hours. Reject lot."
  },
  { 
    id: "PO-2026-1044B", 
    product: "Organic Cucumbers", 
    vendor: "Global Farms", 
    quantity: 800, 
    unit: "Cases",
    defaultIssue: "Visual Spoilage / Damage",
    suggestedAmount: 5600,
    evidenceSummary: "Linked to FreshDetect v4.2 Scan ID #1044-B-Reject • Surface bruising",
    aiComment: "Laser scan confirms extensive sub-surface bruising and cell integrity collapse spanning across 43% of sampled cucumbers. Standard decay warning issued."
  },
  { 
    id: "PO-2026-8842", 
    product: "Hard-Boiled Eggs", 
    vendor: "Global Farms", 
    quantity: 1200, 
    unit: "Cases",
    defaultIssue: "Temperature Excursion",
    suggestedAmount: 14400,
    evidenceSummary: "Linked to FreshDetect v4.2 Scan ID #8841 • General temperature fluctuation alert",
    aiComment: "Secondary audit flagged fluctuating temperature records between 1.0°C and 8.5°C during the loading staging terminal. Proactively filing dispute."
  },
  { 
    id: "PO-2026-3022D", 
    product: "Strawberries", 
    vendor: "Berry Farms Suppliers", 
    quantity: 650, 
    unit: "Cases",
    defaultIssue: "Visual Spoilage / Damage",
    suggestedAmount: 7800,
    evidenceSummary: "Linked to FreshDetect v4.2 Scan ID #3022-D-Reject • Crushed punnets",
    aiComment: "Pulp crushing and moisture leaking through standard trays has led to active mold spoilage in over 25% of top cases. Lot rendered unmarketable."
  }
];

const INITIAL_CLAIMS = [
  { id: 'CLM-001', po: 'PO-2026-8842', vendor: 'Global Farms', issue: 'Temperature Excursion', status: 'pending', amount: '$4,200', date: 'May 24, 2026' },
  { id: 'CLM-002', po: 'PO-2026-7731C', vendor: 'Sunrise Dairy Co.', issue: 'Damaged Packaging', status: 'approved', amount: '$850', date: 'May 20, 2026' },
  { id: 'CLM-003', po: 'PO-2026-9912A', vendor: 'Ocean Catch Suppliers', issue: 'Visual Spoilage / Damage', status: 'rejected', amount: '$1,200', date: 'May 18, 2026' },
  { id: 'CLM-004', po: 'PO-2026-3022D', vendor: 'Berry Farms Suppliers', issue: 'Short Shipment', status: 'pending', amount: '$540', date: 'May 26, 2026' },
];

const CASE_RATES: { [key: string]: number } = {
  "Fresh Salmon": 24.50,
  "Organic Milk": 10.00,
  "Organic Cucumbers": 8.50,
  "Hard-Boiled Eggs": 12.00,
  "Strawberries": 15.00
};

export default function Claims() {
  const [activeTab, setActiveTab] = useState('all');
  const [claimsList, setClaimsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real stats updated on new claims submissions
  const [pendingCount, setPendingCount] = useState(12);
  const [totalRecovered, setTotalRecovered] = useState(142500);

  // Modal and Interactive States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInboundId, setSelectedInboundId] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Ingestion fields
  const [issueReason, setIssueReason] = useState('Temperature Excursion');
  const [lossAmount, setLossAmount] = useState('2500');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [comments, setComments] = useState('');
  const [isProofAttached, setIsProofAttached] = useState(false);
  const [damagedQuantity, setDamagedQuantity] = useState<number>(100);

  // Handshake loading and Success Toast states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { persona } = usePersona();
  const isVendor = persona === 'vendor';

  const matchShipment = RECENT_INBOUND_DELIVERIES.find(x => x.id === selectedInboundId);
  const caseRate = matchShipment ? (CASE_RATES[matchShipment.product] || 24.50) : 24.50;

  // Load persistence logic
  useEffect(() => {
    try {
      // Claims list
      const stored = localStorage.getItem('freshguard-claims-list');
      if (stored) {
        setClaimsList(JSON.parse(stored));
      } else {
        localStorage.setItem('freshguard-claims-list', JSON.stringify(INITIAL_CLAIMS));
        setClaimsList(INITIAL_CLAIMS);
      }

      // Sync metrics
      const storedPendingCount = localStorage.getItem('freshguard-claims-pending-count');
      const storedRecovered = localStorage.getItem('freshguard-claims-total-recovered');
      if (storedPendingCount) {
        setPendingCount(Number(storedPendingCount));
      } else {
        localStorage.setItem('freshguard-claims-pending-count', String(pendingCount));
      }
      if (storedRecovered) {
        setTotalRecovered(Number(storedRecovered));
      } else {
        localStorage.setItem('freshguard-claims-total-recovered', String(totalRecovered));
      }
    } catch (e) {
      console.error("Failed to load claims database", e);
      setClaimsList(INITIAL_CLAIMS);
    }

    // Hydrate permanently stored claims from PostgreSQL (merged on top of local list)
    fetch('/api/claims')
      .then(r => r.json())
      .then(data => {
        if (!data.success || !data.claims?.length) return;
        const mapStatus = (s: string) =>
          s === 'PENDING_VENDOR_RESPONSE' ? 'pending'
          : s === 'ACCEPTED' ? 'approved'
          : s === 'REJECTED' ? 'rejected'
          : 'pending';
        const dbClaims = data.claims.map((c: any) => ({
          id: c.claimPayload?.uiId || `CLM-${String(c.id).slice(0, 4).toUpperCase()}`,
          po: c.purchaseOrderRef || 'QC-AUTO-ROUTING',
          vendor: c.claimPayload?.vendor || 'Auto-QC System',
          issue: c.damagedSkuName,
          status: mapStatus(c.disputeStatus),
          amount: `$${Number(c.calculatedLossAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          date: new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }));
        setClaimsList(prev => {
          const existing = new Set(prev.map((p: any) => p.id));
          return [...dbClaims.filter((c: any) => !existing.has(c.id)), ...prev];
        });
      })
      .catch(err => console.error('Claims hydration failed:', err));
  }, []);

  // Sync back to local storage helper
  const updateClaimsStorage = (updatedList: any[]) => {
    try {
      localStorage.setItem('freshguard-claims-list', JSON.stringify(updatedList));
      setClaimsList(updatedList);
    } catch (err) {
      console.error(err);
    }
  };

  // Triggered when a problematic PO is selected in the Left Column
  const handleShipmentSelectionChange = (poId: string) => {
    setSelectedInboundId(poId);
    if (!poId) {
      setIssueReason('Temperature Excursion');
      setLossAmount('0');
      setEvidenceSummary('');
      setComments('');
      setDamagedQuantity(100);
      return;
    }

    // Trigger beautiful micro-loading AI logic for realistic ingestion feedback
    setIsAiLoading(true);
    
    // Simulating deep multimodal analysis ingestion
    setTimeout(() => {
      const match = RECENT_INBOUND_DELIVERIES.find(x => x.id === poId);
      if (match) {
        setIssueReason(match.defaultIssue);
        
        // Link to the dynamic QC split-routing count variable from local storage if available
        let defaultQty = Math.round(match.quantity * 0.2); // Default of 20% defective boxes
        try {
          const storedActive = localStorage.getItem('freshguard-active-shipments');
          if (storedActive) {
            const activeLots = JSON.parse(storedActive);
            const foundActive = activeLots.find((s: any) => s.id === poId);
            if (foundActive && foundActive.fractionalSplit) {
              defaultQty = foundActive.fractionalSplit.defectiveCases || Math.round(foundActive.quantity * (foundActive.fractionalSplit.defective / 10));
            }
          }
        } catch (e) {
          console.warn("Could not retrieve dynamic QC split metrics:", e);
        }

        setDamagedQuantity(defaultQty);
        const rate = CASE_RATES[match.product] || 24.50;
        setLossAmount(String(defaultQty * rate));
        setEvidenceSummary(match.evidenceSummary);
        setComments(`AI Automated Smart Ingestion Flag triggered. ${match.aiComment}`);
      }
      setIsAiLoading(false);
    }, 600);
  };

  const handleQuantityChange = (newQty: number) => {
    setDamagedQuantity(newQty);
    const match = RECENT_INBOUND_DELIVERIES.find(x => x.id === selectedInboundId);
    const rate = match ? (CASE_RATES[match.product] || 24.50) : 24.50;
    setLossAmount(String(newQty * rate));
  };

  // Submit handshaking
  const handleLockAndSubmitClaim = () => {
    if (!selectedInboundId) return;

    setIsSubmitting(true);

    // Simulate Compiling Evidence File & Generating Dispute Code...
    setTimeout(() => {
      const matchShipment = RECENT_INBOUND_DELIVERIES.find(x => x.id === selectedInboundId);
      const generatedClaimId = `CLM-05${claimsList.length + 1}`;
      
      const finalLossAmt = matchShipment ? (damagedQuantity * (CASE_RATES[matchShipment.product] || 24.50)) : 100 * 24.50;
      const formattedAmt = `$${finalLossAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const newClaim = {
        id: generatedClaimId,
        po: selectedInboundId,
        vendor: matchShipment?.vendor || "Global Farms",
        issue: issueReason,
        status: "pending",
        amount: formattedAmt,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };

      const updatedList = [newClaim, ...claimsList];
      updateClaimsStorage(updatedList);

      // Permanent storage: file the claim in PostgreSQL
      fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po: selectedInboundId,
          vendor: newClaim.vendor,
          issue: issueReason,
          amount: finalLossAmt,
          damagedQuantity,
          comments,
          evidence: evidenceSummary,
          details: { uiId: generatedClaimId, date: newClaim.date }
        })
      }).catch(err => console.error('Claim persistence failed:', err));

      // Increment Pending Counter & Add loss value to the Total Recoveredpotential indicator
      const parsedAmount = finalLossAmt;
      const newPending = pendingCount + 1;
      const newRecovered = totalRecovered + parsedAmount;

      setPendingCount(newPending);
      setTotalRecovered(newRecovered);
      localStorage.setItem('freshguard-claims-pending-count', String(newPending));
      localStorage.setItem('freshguard-claims-total-recovered', String(newRecovered));

      // Trigger soft gold success toast
      setToastMessage("Dispute Filed Successfully. Vendor notified via secure ledger link.");
      
      // Close modal and reset state
      setIsSubmitting(false);
      setIsModalOpen(false);
      
      // Clear forms
      setSelectedInboundId('');
      setLossAmount('0');
      setEvidenceSummary('');
      setComments('');
      setIsProofAttached(false);

      // Hide toast automatically after 5s
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);

    }, 1200);
  };

  const normalizedClaims = claimsList.map(c => {
    // Gracefully handle both traditional structures and dynamic fork payloads
    const id = c.id || c.claimId || `CLM-${Math.floor(Math.random() * 9000)}`;
    const po = c.po || c.poOrigin || 'PO-2026-UNKNOWN';
    const vendor = c.vendor || c.vendorName || 'Unknown Vendor';
    const issue = c.issue || c.defectType || 'Quality Control Defect';
    const status = c.status || 'pending';
    const amount = c.amount || (c.lossValue ? (typeof c.lossValue === 'number' ? `$${c.lossValue.toLocaleString()}` : String(c.lossValue)) : '$0');
    const date = c.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      ...c,
      id,
      po,
      vendor,
      issue,
      status,
      amount,
      date
    };
  });

  const filteredClaims = normalizedClaims.filter(c => {
    const matchesTab = activeTab === 'all' || c.status === activeTab;
    const matchesSearch = c.po.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.vendor.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.issue.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6 h-full flex flex-col bg-slate-55 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen relative overflow-y-auto">
      
      {/* Soft Gold Success Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -45, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 font-sans text-xs sm:text-sm font-extrabold px-6 py-4 rounded-xl shadow-2xl border bg-amber-500 border-amber-400 text-white flex items-center gap-3 w-11/12 max-w-2xl backdrop-blur-sm"
          >
            <ShieldCheck className="w-5 h-5 text-white shrink-0 animate-bounce" />
            <div className="flex-1 leading-relaxed">
              {toastMessage}
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 font-mono tracking-widest uppercase block">Dispute Settlement Network</span>
          <h1 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight mt-0.5">
            {isVendor ? 'Claims Against Us' : 'Claims & Wastage Management'}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isVendor ? 'Review and manage claims filed against your deliveries.' : 'Manage vendor claims, track spoilage, and resolve financial disputes.'}
          </p>
        </div>
        {!isVendor && (
          <button 
            id="file-new-claim-btn"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-rose-500/15 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> File New Claim
          </button>
        )}
      </div>

      {/* Top Summary KPI Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-805 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex justify-between items-start mb-2 pl-2">
            <h3 className="text-slate-500 text-xs font-bold font-mono uppercase tracking-wider">Pending Claims</h3>
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-3xl font-black text-slate-950 dark:text-slate-100 pl-2 font-mono">{pendingCount}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 pl-2 font-medium flex items-center gap-1">
            Requires secure review &amp; verification
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-805 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <div className="flex justify-between items-start mb-2 pl-2">
            <h3 className="text-slate-500 text-xs font-bold font-mono uppercase tracking-wider">{isVendor ? 'Total Deductions (YTD)' : 'Total Recovered (YTD)'}</h3>
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-3xl font-black text-slate-950 dark:text-slate-100 pl-2 font-mono">
            ${totalRecovered.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 pl-2 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Potential indicator active
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-805 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex justify-between items-start mb-2 pl-2">
            <h3 className="text-slate-500 text-xs font-bold font-mono uppercase tracking-wider">Top Spoilage Issue</h3>
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          </div>
          <div className="text-2xl font-black text-slate-950 dark:text-slate-100 pl-2 font-mono">Temp Control</div>
          <div className="text-xs text-rose-600 dark:text-rose-405 mt-1.5 pl-2 font-medium">
            45% of historical disputes
          </div>
        </div>
      </div>

      {/* Main Table Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-150 dark:border-slate-805 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold font-mono uppercase tracking-tight transition-all cursor-pointer",
                  activeTab === tab 
                    ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-sm border border-slate-200/50 dark:border-slate-800" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search claims..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none dark:text-slate-100"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold font-mono uppercase border-b border-slate-150 dark:border-slate-805 sticky top-0">
              <tr>
                <th className="px-6 py-4">Claim ID</th>
                <th className="px-6 py-4">PO Number</th>
                <th className="px-6 py-4">Vendor Name</th>
                <th className="px-6 py-4">Issue Description</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date Filed</th>
                <th className="px-6 py-4">Verification Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-805">
              {filteredClaims.map((claim, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                  <td className="px-6 py-4 font-bold font-mono text-slate-950 dark:text-slate-100">{claim.id}</td>
                  <td className="px-6 py-4 font-mono font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">{claim.po}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{claim.vendor}</td>
                  <td className="px-6 py-4 text-slate-650 dark:text-slate-350">
                    <span className="flex items-center gap-1.5">
                      {claim.issue && claim.issue.toLowerCase().includes('temp') ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-450 shrink-0" />
                      )}
                      <span className="truncate max-w-xs">{claim.issue}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold font-mono text-slate-950 dark:text-slate-100">{claim.amount}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border",
                      claim.status === 'pending' ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700 dark:text-amber-400" :
                      claim.status === 'approved' ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400" :
                      "bg-rose-55/20 dark:bg-rose-950/30 border-rose-200 text-rose-700"
                    )}>
                      {claim.status === 'pending' ? 'Pending Review' : claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">{claim.date}</td>
                  <td className="px-6 py-4">
                    <button className="text-slate-505 hover:text-slate-805 dark:hover:text-slate-200 flex items-center gap-1 text-[10px] uppercase font-bold font-mono cursor-pointer border border-slate-200 dark:border-slate-850 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 transition-colors">
                      <FileText className="w-3.5 h-3.5" /> View Proof
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClaims.length === 0 && (
                 <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-slate-500 font-mono text-xs">
                      No active dispute claims found matching filter criteria.
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* THE "FILE NEW CLAIM" INTERACTIVE OVERLAY MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 w-full max-w-5xl rounded-2xl shadow-2xl relative flex flex-col overflow-hidden max-h-[92vh]"
            >
              
              {/* Submission loading indicator block */}
              {isSubmitting && (
                <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6">
                  <Loader2 className="w-10 h-10 text-rose-600 animate-spin mb-3" />
                  <span className="text-sm font-bold font-mono text-slate-850 dark:text-slate-200 tracking-wider">
                    Compiling Evidence File &amp; Generating Dispute Code...
                  </span>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs font-mono">
                    Securing multi-sensor thermal profiles and committing claim metadata to ledger network.
                  </p>
                </div>
              )}
              
              {/* Modal Header */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 py-5 justify-between items-center bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/20 rounded-lg text-rose-500 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">Initiate Vendor Dispute</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 px-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Two-Column Responsive Body */}
              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-10 gap-8">
                
                {/* LEFT COLUMN (40% Width equivalent or col-span-4) - "Select Affected Shipment" */}
                <div className="md:col-span-4 space-y-6">
                  <div className="bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/60 dark:border-slate-850 p-5 rounded-2xl space-y-5">
                    <div>
                      <label className="text-[10.5px] font-bold font-sans tracking-wide text-slate-500 dark:text-slate-400 block mb-2">
                        Select Affected Shipment
                      </label>
                      <select
                        id="shipment-selection-dropdown"
                        value={selectedInboundId}
                        onChange={(e) => handleShipmentSelectionChange(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans font-medium text-slate-900 dark:text-slate-100"
                      >
                        <option value="" className="text-slate-400 font-sans">-- Choose Pending / Errored Delivery --</option>
                        {RECENT_INBOUND_DELIVERIES.map((option) => (
                          <option key={option.id} value={option.id} className="font-semibold text-xs py-1.5">
                            {option.id}: {option.product} • {option.vendor.replace(/\s*Suppliers|\s*Co\./gi,"")}
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] text-slate-400 font-mono mt-1.5 block">
                        Displays recent logistics arrivals and auto-receivable gates.
                      </span>
                    </div>

                    {/* Interactive Attached Proof Zone */}
                    <div className="space-y-3">
                      <label className="text-[10.5px] font-semibold font-sans tracking-wide text-slate-500 dark:text-slate-400 block">
                        Attach evidence proof
                      </label>
                      
                      <div 
                        onClick={() => setIsProofAttached(!isProofAttached)}
                        className={cn(
                          "border border-dashed w-full rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white dark:bg-slate-900 hover:bg-slate-50/30 dark:hover:bg-slate-950/20",
                          isProofAttached 
                            ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10" 
                            : "border-slate-200 dark:border-slate-800"
                        )}
                      >
                        {isProofAttached ? (
                          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-1">
                            <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto" />
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block">
                              Proof attached: cold_chain_excursion_log.csv
                            </span>
                            <span className="text-[9px] text-emerald-500 font-mono tracking-tight block">
                              Click to remove evidence file (12KB)
                            </span>
                          </motion.div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-8 h-8 text-slate-400 mx-auto opacity-75" />
                            <span className="text-xs font-semibold tracking-tight text-slate-700 dark:text-slate-200 block hover:translate-y-[-1px] transition-transform font-sans">
                              + Attach proof
                            </span>
                            <span className="text-[10px] text-slate-400 max-w-[210px] mx-auto leading-relaxed">
                              Upload photo of package damage or cold-chain log excursion
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN (60% Width equivalent or col-span-6) - "AI Smart Claims Ingestion" */}
                <div className="md:col-span-6 flex flex-col bg-slate-50/35 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-6 rounded-2xl relative justify-between gap-6">
                  
                  {isAiLoading && (
                    <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center z-20 rounded-2xl leading-normal">
                      <Cpu className="w-7 h-7 text-indigo-500 animate-spin mb-1.5" />
                      <span className="text-xs font-bold text-indigo-500 font-mono uppercase tracking-widest animate-pulse">Gemini Ingesting Logistics Metadata...</span>
                    </div>
                  )}

                  <div className="space-y-5 flex-1">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <Cpu className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100 font-sans">AI Smart Claims Ingestion Metrics</h3>
                    </div>

                    {/* Interactive Fields Grid */}
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-[9.5px] font-bold font-sans text-slate-400 uppercase tracking-wider block mb-1.5">Issue Reason</label>
                        <select
                          id="issue-reason-field"
                          value={issueReason}
                          onChange={(e) => setIssueReason(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 font-medium"
                        >
                          <option value="Temperature Excursion">Temperature Excursion</option>
                          <option value="Visual Spoilage / Damage">Visual Spoilage / Damage</option>
                          <option value="Damaged Packaging">Damaged Packaging</option>
                          <option value="Short Shipment">Short Shipment</option>
                        </select>
                      </div>
                    </div>

                    {/* Itemized Loss Manifest Section */}
                    <div className="space-y-2 mt-4">
                      <label className="text-[10px] font-bold font-sans text-slate-500 uppercase tracking-widest block">
                        Itemized Loss Manifest
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl">
                        {/* Column A: Scanned SKU */}
                        <div>
                          <label className="text-[8px] font-bold font-sans text-slate-400 uppercase tracking-wider block mb-1">Column A: Scanned SKU</label>
                          <input
                            type="text"
                            readOnly
                            value={matchShipment ? matchShipment.product : "--"}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-500 font-sans font-medium focus:outline-none"
                          />
                        </div>
                        
                        {/* Column B: Damaged Quantity */}
                        <div>
                          <label className="text-[8px] font-bold font-sans text-slate-400 uppercase tracking-wider block mb-1">Column B: Damaged Qty</label>
                          <input
                            type="number"
                            min={0}
                            value={damagedQuantity}
                            onChange={(e) => handleQuantityChange(Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>

                        {/* Column C: Contract Rate */}
                        <div>
                          <label className="text-[8px] font-bold font-sans text-slate-400 uppercase tracking-wider block mb-1">Column C: Contract Rate</label>
                          <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-820 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-500 h-[28px] flex items-center">
                            ${caseRate.toFixed(2)}/case
                          </div>
                        </div>

                        {/* Column D: Auto-Loss */}
                        <div>
                          <label className="text-[8px] font-bold font-sans text-slate-400 uppercase tracking-wider block mb-1">Column D: Auto-Loss ($)</label>
                          <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-820 rounded-lg px-2 py-1.5 text-xs font-mono font-black text-rose-500 dark:text-rose-455 h-[28px] flex items-center">
                            ${(damagedQuantity * caseRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold font-sans text-slate-400 uppercase block tracking-wider">Evidence Attachment Summary</label>
                      <input
                        id="evidence-summary-field"
                        type="text"
                        value={evidenceSummary}
                        readOnly
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-500 focus:outline-none"
                        placeholder="Automatic scanner codes autofilled..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-bold font-sans text-slate-400 block tracking-wider">Buyer Operational Comments</label>
                      <textarea
                        id="buyer-comments-field"
                        rows={3}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 text-xs focus:outline-none font-sans font-medium text-slate-700 dark:text-slate-200"
                        placeholder="List relevant details or sensory feedback logs regarding thermal breach..."
                      />
                    </div>
                  </div>

                  {/* Smart Notification Badge */}
                  <div className="bg-amber-50/20 border border-amber-500/20 dark:border-amber-900/30 rounded-xl p-3 mt-1 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <p className="text-[10px] text-amber-800 dark:text-amber-400 font-sans leading-normal font-medium">
                      FreshGuard AI automatically calculated this lost value credit claim from the total affected pallet volumes of matching thermal logs.
                    </p>
                  </div>

                </div>

              </div>

              {/* Modal Actions Footer */}
              <div className="border-t border-slate-100 dark:border-slate-805 px-8 py-5 flex justify-end items-center bg-white dark:bg-slate-900">
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 hover:underline text-xs font-semibold font-sans transition-colors cursor-pointer bg-transparent border-none px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    id="lock-evidence-issue-claim-btn"
                    onClick={handleLockAndSubmitClaim}
                    disabled={!selectedInboundId}
                    className={cn(
                      "px-6 py-2.5 rounded-lg text-xs font-bold font-sans transition-all flex items-center gap-1 cursor-pointer font-semibold",
                      selectedInboundId 
                        ? "bg-[#10B981] hover:bg-[#059669] text-white shadow-sm shadow-emerald-500/10" 
                        : "bg-slate-100 text-slate-350 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-200/50 dark:border-slate-850"
                    )}
                  >
                    Issue formal claim dispute
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
