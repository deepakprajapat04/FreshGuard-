/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
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
import { usePersona, isSupplierPersona } from '../context/PersonaContext';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader, StatCard, pageShellClass } from '../components/PageChrome';
import { DataTable, type DataTableColumn } from '../components/DataTable';

type ClaimRow = {
  id: string;
  po: string;
  vendor: string;
  issue: string;
  status: string;
  amount: string;
  date: string;
};

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

export default function Claims() {
  const [activeTab, setActiveTab] = useState('all');
  const [claimsList, setClaimsList] = useState<ClaimRow[]>([]);
  
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

  // Handshake loading and Success Toast states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { persona } = usePersona();
  const isVendor = isSupplierPersona(persona);

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
      return;
    }

    // Trigger beautiful micro-loading AI logic for realistic ingestion feedback
    setIsAiLoading(true);
    
    // Simulating deep multimodal analysis ingestion
    setTimeout(() => {
      const match = RECENT_INBOUND_DELIVERIES.find(x => x.id === poId);
      if (match) {
        setIssueReason(match.defaultIssue);
        setLossAmount(String(match.suggestedAmount));
        setEvidenceSummary(match.evidenceSummary);
        setComments(`AI Automated Smart Ingestion Flag triggered. ${match.aiComment}`);
      }
      setIsAiLoading(false);
    }, 600);
  };

  // Submit handshaking
  const handleLockAndSubmitClaim = () => {
    if (!selectedInboundId) return;

    setIsSubmitting(true);

    // Simulate Compiling Evidence File & Generating Dispute Code...
    setTimeout(() => {
      const matchShipment = RECENT_INBOUND_DELIVERIES.find(x => x.id === selectedInboundId);
      const generatedClaimId = `CLM-05${claimsList.length + 1}`;
      
      const newClaim = {
        id: generatedClaimId,
        po: selectedInboundId,
        vendor: matchShipment?.vendor || "Global Farms",
        issue: issueReason,
        status: "pending",
        amount: `$${Number(lossAmount).toLocaleString()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };

      const updatedList = [newClaim, ...claimsList];
      updateClaimsStorage(updatedList);

      // Increment Pending Counter & Add loss value to the Total Recoveredpotential indicator
      const parsedAmount = Number(lossAmount) || 0;
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

  const filteredClaims = claimsList.filter((c) => activeTab === 'all' || c.status === activeTab);

  const claimColumns: DataTableColumn<ClaimRow>[] = [
    {
      key: 'id',
      label: 'Claim ID',
      className: 'font-bold font-mono text-slate-950 dark:text-slate-100',
    },
    {
      key: 'po',
      label: 'PO Number',
      render: (c) => (
        <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
          {c.po}
        </span>
      ),
    },
    {
      key: 'vendor',
      label: 'Vendor Name',
      filterType: 'select',
      className: 'text-slate-600 dark:text-slate-300 font-medium',
    },
    {
      key: 'issue',
      label: 'Issue Description',
      render: (c) => (
        <span className="flex items-center gap-1.5 text-slate-650 dark:text-slate-350">
          <AlertTriangle
            className={cn(
              'w-3.5 h-3.5 shrink-0',
              c.issue?.toLowerCase().includes('temp') ? 'text-amber-500' : 'text-rose-500'
            )}
          />
          <span className="truncate max-w-xs">{c.issue}</span>
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      className: 'font-bold font-mono text-slate-950 dark:text-slate-100',
    },
    {
      key: 'status',
      label: 'Status',
      filterType: 'select',
      filterOptions: ['pending', 'approved', 'rejected'],
      render: (c) => (
        <span
          className={cn(
            'px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border',
            c.status === 'pending'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700 dark:text-amber-400'
              : c.status === 'approved'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-700'
          )}
        >
          {c.status}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date Filed',
      className: 'text-slate-500 font-mono',
    },
    {
      key: 'actions',
      label: 'Verification Actions',
      sortable: false,
      filterable: false,
      getValue: () => '',
      render: () => (
        <button
          type="button"
          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 text-[10px] uppercase font-bold font-mono cursor-pointer border border-slate-200 dark:border-slate-850 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" /> View Proof
        </button>
      ),
    },
  ];

  return (
    <div className={pageShellClass}>
      
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

      <PageHeader
        eyebrow="Dispute Settlement Network"
        title={isVendor ? 'Claims Against Us' : 'Claims & Wastage Management'}
        subtitle={
          isVendor
            ? 'Review and manage claims filed against your deliveries.'
            : 'Manage vendor claims, track spoilage, and resolve financial disputes.'
        }
      >
        {!isVendor && (
          <button
            id="file-new-claim-btn"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> File New Claim
          </button>
        )}
      </PageHeader>

      {/* Top Summary KPI Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Pending Claims"
          value={pendingCount}
          sub="Requires secure review & verification"
          tone="amber"
        />
        <StatCard
          label={isVendor ? 'Total Deductions (YTD)' : 'Total Recovered (YTD)'}
          value={`$${totalRecovered.toLocaleString()}`}
          sub={
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <TrendingUp className="w-3.5 h-3.5" /> Potential indicator active
            </span>
          }
          tone="emerald"
        />
        <StatCard
          label="Top Spoilage Issue"
          value="Temp Control"
          sub="45% of historical disputes"
          tone="rose"
        />
      </div>

      {/* Main Table Ledger */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 flex-1 flex flex-col">
        <DataTable
          data={filteredClaims}
          columns={claimColumns}
          rowKey={(c) => c.id}
          title="Claims ledger"
          subtitle="Dispute settlement network"
          excelFileName="claims-ledger.xls"
          emptyMessage="No active dispute claims found matching filter criteria."
          toolbarExtra={
            <div className="flex space-x-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10">
              {['all', 'pending', 'approved', 'rejected'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-tight transition-all cursor-pointer',
                    activeTab === tab
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          }
        />
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
              <div className="flex border-b border-slate-150 dark:border-slate-805 px-6 py-4.5 justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 dark:bg-rose-950 rounded-lg text-rose-600 dark:text-rose-450">
                    <Database className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-slate-100">
                      Initiate Automated Vendor Dispute
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 tracking-normal normal-case">
                      FreshGuard automated ledger resolution protocol v4
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-850 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Two-Column Responsive Body */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-10 gap-6">
                
                {/* LEFT COLUMN (45% Width) - "Select Affected Shipment" */}
                <div className="md:col-span-4 space-y-5">
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4.5 rounded-xl space-y-4">
                    <div>
                      <label className="text-[10.5px] font-extrabold uppercase font-mono tracking-wider text-slate-505 dark:text-slate-400 block mb-2">
                        Select Affected Shipment
                      </label>
                      <select
                        id="shipment-selection-dropdown"
                        value={selectedInboundId}
                        onChange={(e) => handleShipmentSelectionChange(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans font-bold text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Choose Pending / Errored Delivery --</option>
                        {RECENT_INBOUND_DELIVERIES.map((option) => (
                          <option key={option.id} value={option.id} className="font-semibold text-xs py-1">
                            {option.id}: {option.product} • {option.vendor.replace(/\s*Suppliers|\s*Co\./gi,"")}
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] text-slate-400 font-mono mt-1.5 block">
                        Displays recent logistics arrivals and auto-receivable gates.
                      </span>
                    </div>

                    {/* Interactive Attached Proof Zone */}
                    <div className="space-y-2">
                      <label className="text-[10.5px] font-extrabold uppercase font-mono tracking-wider text-slate-505 dark:text-slate-400 block">
                        Dispute Attachment Proof
                      </label>
                      
                      <div 
                        onClick={() => setIsProofAttached(!isProofAttached)}
                        className={cn(
                          "border border-dashed w-full rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/40",
                          isProofAttached 
                            ? "border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10" 
                            : "border-slate-250 dark:border-slate-800"
                        )}
                      >
                        {isProofAttached ? (
                          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-1">
                            <FileSpreadsheet className="w-8 h-8 text-emerald-505 mx-auto" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-normal block">
                              Proof attached: cold_chain_excursion_log.csv
                            </span>
                            <span className="text-[9px] text-emerald-500 font-mono tracking-tight block">
                              Click to remove evidence file (12KB)
                            </span>
                          </motion.div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-8 h-8 text-rose-500 mx-auto opacity-75" />
                            <span className="text-xs font-bold font-mono tracking-tight text-rose-600 block hover:-translate-y-0.5 transition-transform">
                              [ + Attach Proof ]
                            </span>
                            <span className="text-[10px] text-slate-450 dark:text-slate-505 max-w-[190px] mx-auto leading-normal">
                              Upload Photo of Package Damage or Cold-Chain Log Excursion
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN (55% Width) - "AI Smart Claims Ingestion" */}
                <div className="md:col-span-6 flex flex-col bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-5.5 rounded-xl relative justify-between">
                  
                  {isAiLoading && (
                    <div className="absolute inset-0 bg-white/90 dark:bg-slate-950/90 flex flex-col items-center justify-center z-20 rounded-xl leading-normal">
                      <Cpu className="w-7 h-7 text-indigo-500 animate-spin mb-1.5" />
                      <span className="text-xs font-bold text-indigo-500 font-mono uppercase tracking-widest animate-pulse">Gemini Ingesting Logistics Metadata...</span>
                    </div>
                  )}

                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-200/50 dark:border-slate-800/60">
                      <Cpu className="w-4 h-4 text-rose-550" />
                      <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">AI Smart Claims Ingestion Metrics</h3>
                    </div>

                    {/* Interactive Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold font-mono text-slate-450 uppercase block mb-1">Issue Reason</label>
                        <select
                          id="issue-reason-field"
                          value={issueReason}
                          onChange={(e) => setIssueReason(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none text-slate-900 dark:text-slate-100 font-medium"
                        >
                          <option value="Temperature Excursion">Temperature Excursion</option>
                          <option value="Visual Spoilage / Damage">Visual Spoilage / Damage</option>
                          <option value="Damaged Packaging">Damaged Packaging</option>
                          <option value="Short Shipment">Short Shipment</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold font-mono text-slate-450 uppercase block mb-1">Calculated Loss Amount ($)</label>
                        <input
                          id="loss-amount-field"
                          type="number"
                          value={lossAmount}
                          onChange={(e) => setLossAmount(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none font-mono text-slate-900 dark:text-slate-100 font-bold"
                          placeholder="Calculated basis..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold font-mono text-slate-455 uppercase block mb-1">Evidence Attachment Summary</label>
                      <input
                        id="evidence-summary-field"
                        type="text"
                        value={evidenceSummary}
                        onChange={(e) => setEvidenceSummary(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none text-slate-500 font-medium"
                        placeholder="Automatic scanner codes autofilled..."
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold font-mono text-slate-455 uppercase block mb-1">Buyer Operational Comments</label>
                      <textarea
                        id="buyer-comments-field"
                        rows={3.5}
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl p-3 text-xs focus:outline-none font-sans font-medium text-slate-700 dark:text-slate-200"
                        placeholder="List relevant details or sensory feedback logs regarding thermal breach..."
                      />
                    </div>
                  </div>

                  {/* Smart Notification Badge */}
                  <div className="bg-amber-50/20 border border-amber-500/25 dark:border-amber-900/35 rounded-xl p-2.5 mt-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <p className="text-[10px] text-amber-800 dark:text-amber-400 font-sans leading-normal font-medium">
                      FreshGuard AI automatically calculated this lost value credit claim from the total affected pallet volumes of matching thermal logs.
                    </p>
                  </div>

                </div>

              </div>

              {/* Modal Actions Footer */}
              <div className="border-t border-slate-150 dark:border-slate-805 px-6 py-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                <span className="text-[10px] text-slate-400 font-mono select-none">ID LOG: ACTIVE</span>
                
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="lock-evidence-issue-claim-btn"
                    onClick={handleLockAndSubmitClaim}
                    disabled={!selectedInboundId}
                    className={cn(
                      "px-5 py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                      selectedInboundId 
                        ? "bg-rose-650 hover:bg-rose-700 text-white shadow-md shadow-rose-500/10" 
                        : "bg-slate-200 text-slate-400 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-850 cursor-not-allowed"
                    )}
                  >
                    Lock Evidence &amp; Issue Claim
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
