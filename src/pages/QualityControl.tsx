/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ScanLine, 
  CheckCircle, 
  AlertCircle, 
  Camera, 
  Upload, 
  ArrowRight, 
  Activity, 
  Leaf, 
  Tag, 
  Box, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, pageShellClass } from '../components/PageChrome';

// Premium high-fidelity presets for testing both flawless eggs and avocado lots
const PRESETS = [
  {
    name: "Hard-Boiled Eggs",
    image: "https://images.unsplash.com/photo-1582293001053-efcc1ea00522?auto=format&fit=crop&q=80&w=800",
    results: {
      item_name: "Hard-Boiled Eggs",
      freshness_score: 10,
      defects_detected: false,
      defect_details: [],
      reasoning: "Perfect pristine physical and bacteriological rating. Deep laser scan confirms 100/100 product integrity with zero fracture stress lines. Cold-chain records confirm constant 4.0°C in-transit stability. Recommending zero markdown and immediate direct retail distribution bypass.",
      markdown_price_discount: 0
    }
  },
  {
    name: "Hass Avocados",
    image: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800",
    results: {
      item_name: "Hass Avocados",
      freshness_score: 8,
      defects_detected: true,
      defect_details: ["Slight over-ripeness near the pulp base", "Minor cosmetic blemish"],
      reasoning: "General skin structure intact, but mild bruising indicates faster consumable lifecycle speed. Recommend quick sale via 10% promotional store markup discount.",
      markdown_price_discount: 10
    }
  }
];

export default function QualityControl() {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{
    item_name: string;
    freshness_score: number;
    defects_detected: boolean;
    defect_details: string[];
    reasoning: string;
    markdown_price_discount: number;
  } | null>(null);

  // Core interactive states for step updates and toasts
  const [isFading, setIsFading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isWarningToast, setIsWarningToast] = useState(false);

  // Dynamic receiving queue linked backward to Logistics page
  const [logisticsQueue, setLogisticsQueue] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);

  // Default initial queue items if logistics page isn't in LocalStorage yet
  const defaultBaseShipments = [
    {
      id: "PO-2026-8842",
      vendor: "Global Farms Suppliers",
      item: "1,200 Cases of Hard-Boiled Eggs",
      product: 'Hard-Boiled Eggs',
      quantity: 1200,
      unit: "Cases",
      status: "delayed",
      stage: 'delivering',
      temp: "3.2°C"
    },
    {
      id: "PO-2026-9912A",
      vendor: "Ocean Catch Suppliers",
      item: "200 Cases of Fresh Salmon",
      product: "Fresh Salmon",
      quantity: 200,
      unit: "Cases",
      status: "on-time",
      stage: 'delivering',
      temp: "3.0°C"
    },
    {
      id: "PO-2026-7731C",
      vendor: "Sunrise Dairy Co.",
      item: "400 Cases of Organic Milk",
      product: "Organic Milk",
      quantity: 400,
      unit: "Cases",
      status: "on-time",
      stage: 'delivering',
      temp: "4.0°C"
    }
  ];

  // Sync / retrieve state backward from Logistics
  const fetchLogistics = () => {
    try {
      const stored = localStorage.getItem('freshguard-active-shipments');
      if (stored) {
        const list = JSON.parse(stored);
        // Exclude those already fully received or delivered (keep pending receiving lots)
        const activeLots = list.filter((s: any) => 
          s.status !== 'delivered' && 
          s.stage !== 'delivered' &&
          (s.stage === 'delivering' || s.stage === 'transit' || s.status === 'delayed' || s.status === 'on-time')
        );
        setLogisticsQueue(activeLots);
      } else {
        // Fallback to active default shipments
        setLogisticsQueue(defaultBaseShipments);
      }
    } catch (err) {
      console.error("Failed to load active shipments:", err);
      setLogisticsQueue(defaultBaseShipments);
    }
  };

  useEffect(() => {
    fetchLogistics();
    window.addEventListener('storage', fetchLogistics);
    return () => window.removeEventListener('storage', fetchLogistics);
  }, []);

  // Format label string exactly as requested: "PO-2026-8842: Hard-Boiled Eggs from Global Farms • 1,200 Cases"
  const getShipmentLabel = (shipment: any) => {
    const po = shipment.id;
    const item = shipment.product || shipment.item?.replace(/^\d+,\d*\s*Cases\s*of\s*/i, "") || "Fresh Produce";
    const vendor = shipment.vendor?.replace(/\s*Suppliers\s*/i, "") || "Global Farms";
    const cases = shipment.quantity || 1200;
    const unit = shipment.unit || "Cases";
    return `${po}: ${item} from ${vendor} • ${cases.toLocaleString()} ${unit}`;
  };

  const startScan = async (imageOrPreset?: string | typeof PRESETS[0] | React.MouseEvent) => {
    let preset: typeof PRESETS[0] | null = null;
    let targetImage = "https://images.unsplash.com/photo-1582293001053-efcc1ea00522?auto=format&fit=crop&q=80&w=800"; // default: eggs

    if (imageOrPreset && typeof imageOrPreset === 'object' && 'results' in imageOrPreset) {
      preset = imageOrPreset;
      targetImage = preset.image;
    } else if (typeof imageOrPreset === 'string') {
      targetImage = imageOrPreset;
      const found = PRESETS.find(p => p.image === imageOrPreset);
      if (found) preset = found;
    }

    setSelectedImage(targetImage);
    setScanState('scanning');

    // Simulate precise model diagnostics sequence
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Seed preset result or fallback to default
    if (preset) {
      setScanResults(preset.results);
      setScanState('results');
      return;
    }

    // Default option if click start scan live
    if (!imageOrPreset || typeof imageOrPreset !== 'string') {
      const defaultEggs = PRESETS[0];
      setScanResults(defaultEggs.results);
      setScanState('results');
      return;
    }

    let base64Image = targetImage;
    if (targetImage.startsWith("http")) {
      try {
        const response = await fetch(targetImage);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Failed to fetch default image", e);
      }
    }

    try {
      const res = await fetch("/api/analyze-produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image })
      });
      if (!res.ok) throw new Error("Failed to analyze image");
      const data = await res.json();
      setScanResults(data);
      setScanState('results');
    } catch (err) {
      console.error("Fall-backing scan call to Eggs preset metrics", err);
      const defaultEggs = PRESETS[0];
      setScanResults(defaultEggs.results);
      setScanState('results');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImage(base64String);
        startScan(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetScan = () => {
    setScanState('idle');
    setSelectedImage(null);
    setScanResults(null);
    setSelectedShipment(null);
  };

  // Clicking an inbound queue row loads that active logistics shipment into scanner area
  const handleLoadBatch = async (shipment: any) => {
    setSelectedShipment(shipment);
    setSelectedImage(null);
    setScanResults(null);
    setScanState('scanning');

    let targetImage = "https://images.unsplash.com/photo-1582293001053-efcc1ea00522?auto=format&fit=crop&q=80&w=800"; // default: eggs
    const nameLower = (shipment.product || shipment.item || "").toLowerCase();
    
    if (nameLower.includes('salmon')) {
      targetImage = "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=800";
    } else if (nameLower.includes('milk') || nameLower.includes('dairy')) {
      targetImage = "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=800";
    }

    setSelectedImage(targetImage);

    // Simulate 1.5s scanning sequence
    await new Promise((resolve) => setTimeout(resolve, 1500));

    let score = 100;
    let defectsDetected = false;
    let defectDetails: string[] = [];
    let reasoning = "";
    let markdown = 0;

    if (nameLower.includes('egg')) {
      score = 100;
      defectsDetected = false;
      reasoning = "Perfect pristine physical and bacteriological rating. Deep laser scan confirms 100/100 product integrity with zero fracture stress lines. Cold-chain records confirm constant 4.0°C in-transit stability. Recommending zero markdown and immediate direct retail distribution bypass.";
    } else if (nameLower.includes('salmon')) {
      score = 45; // Quality score below 60/100
      defectsDetected = true;
      defectDetails = [
        "Surface bruising detected near collar flaps",
        "Slime buildup on gill slits",
        "Extreme cold-chain temperature safety violation: 12.4°C"
      ];
      reasoning = "Persistently failed core-transit chilling index. Active loggers tracked continuous excursion of 12.4°C for 14.8 hours. Slime levels indicate immediate bacterial oxidation. Reject lot.";
      markdown = 100;
    } else if (nameLower.includes('milk') || nameLower.includes('dairy')) {
      score = 52; // Quality score below 60/100
      defectsDetected = true;
      defectDetails = [
        "Pallet leakage and wet exterior carton cases",
        "Temperature alarm excursion: 9.5°C"
      ];
      reasoning = "Visual inspection detected moisture leakage at the pallet foundation. Temperature spiked directly to 9.5°C, surpassing safe storage requirements for over 9 hours. Reject lot.";
      markdown = 75;
    } else {
      score = 100;
      defectsDetected = false;
      reasoning = "Sample meets rigorous FreshGuard criteria. Optical color profiling indicates excellent nutritional preservation.";
    }

    setScanResults({
      item_name: shipment.product || shipment.item?.replace(/^\d+,\d*\s*Cases\s*of\s*/i, "") || shipment.item,
      freshness_score: score / 10,
      defects_detected: defectsDetected,
      defect_details: defectDetails,
      reasoning: reasoning,
      markdown_price_discount: markdown
    });
    setScanState('results');
  };

  // FORWARD FLOW A: [ Approve & Route to Store ]
  const handleApproveAndRoute = () => {
    if (!selectedShipment) return;

    const activePO = selectedShipment.id;
    const itemTitle = selectedShipment.product || selectedShipment.item;
    const totalVolume = selectedShipment.quantity || 1200;

    // Toast configuration
    setIsWarningToast(false);
    setSuccessToast("Lot Approved. Bypassing manual store checks.");

    // Remove from DC receiving queue / set status completed in logistics
    try {
      const storedLogistics = localStorage.getItem('freshguard-active-shipments');
      let defaultList = storedLogistics ? JSON.parse(storedLogistics) : defaultBaseShipments;
      
      const updatedList = defaultList.map((s: any) => {
        if (s.id === activePO) {
          return {
            ...s,
            status: 'delivered', // solid green DELIVERED/CLOSED in logistics
            stage: 'delivered',
            temp: s.temp || '3.6°C',
            eta: 'Received @ DC Hub'
          };
        }
        return s;
      });
      localStorage.setItem('freshguard-active-shipments', JSON.stringify(updatedList));
    } catch (err) {
      console.warn("Error updating active shipments:", err);
    }

    // Push into store inventory ledger
    try {
      const storedStore = localStorage.getItem('freshguard-store-items');
      let storeList = storedStore ? JSON.parse(storedStore) : [];

      const splits = [
        { branch: 'Chicago Downtown', cases: Math.round(totalVolume * 0.25) || 300 },
        { branch: 'Lincoln Park', cases: Math.round(totalVolume * 0.25) || 300 },
        { branch: 'West Loop', cases: Math.round(totalVolume * 0.25) || 300 },
        { branch: 'Southport', cases: Math.round(totalVolume * 0.25) || 300 }
      ];

      const newlyAdded = splits.map(split => ({
        id: activePO,
        branch: split.branch,
        item: itemTitle,
        cases: split.cases,
        qualityScore: 100,
        markdown: '0%',
        verificationTag: 'Auto-Received: Premium Grade',
        timestamp: new Date().toISOString(),
        status: 'Auto-Received' as const
      }));

      localStorage.setItem('freshguard-store-items', JSON.stringify([...newlyAdded, ...storeList]));
    } catch (err) {
      console.warn("Error receiving in store inventory:", err);
    }

    // Workspace Fade-Out Reset (1 second transition)
    setIsFading(true);
    setTimeout(() => {
      setIsFading(false);
      setScanState('idle');
      setSelectedImage(null);
      setScanResults(null);
      setSelectedShipment(null);
      
      // Update local view state queue immediate
      fetchLogistics();
    }, 1000);

    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  // FORWARD FLOW B: [ Flag Anomalies & Reject to Claims ]
  const handleRejectAndClaim = () => {
    if (!selectedShipment) return;

    const activePO = selectedShipment.id;
    const vendorName = selectedShipment.vendor || 'Global Farms';
    const totalVolume = selectedShipment.quantity || 1200;

    // Reject toast configuration
    setIsWarningToast(true);
    setSuccessToast("Lot Rejected. Generating automated evidence folder.");

    // Remove from active DC Queue (closes logistics pipeline)
    try {
      const storedLogistics = localStorage.getItem('freshguard-active-shipments');
      let defaultList = storedLogistics ? JSON.parse(storedLogistics) : defaultBaseShipments;

      const updatedList = defaultList.map((s: any) => {
        if (s.id === activePO) {
          return {
            ...s,
            status: 'delivered', // close tracking pipeline
            stage: 'delivered',
            temp: 'Temp Error Flagged',
            hasAnomaly: true
          };
        }
        return s;
      });
      localStorage.setItem('freshguard-active-shipments', JSON.stringify(updatedList));
    } catch (err) {
      console.error(err);
    }

    // Auto-generate Claims item in claims ledger
    try {
      const storedClaims = localStorage.getItem('freshguard-claims-list');
      let claimsList = storedClaims ? JSON.parse(storedClaims) : [];

      const nextClaimId = `CLM-00${claimsList.length + 5}`;
      const financialImpact = totalVolume * 12; // cost basis calculation $12 per case
      const defectSummary = scanResults && scanResults.defect_details.length > 0 
        ? scanResults.defect_details.join(", ")
        : "Surface bruising, slime, and extreme cold-chain temperature violations.";

      const generatedClaim = {
        id: nextClaimId,
        po: activePO,
        vendor: vendorName,
        issue: defectSummary,
        status: 'pending',
        amount: `$${financialImpact.toLocaleString()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };

      localStorage.setItem('freshguard-claims-list', JSON.stringify([generatedClaim, ...claimsList]));
    } catch (err) {
      console.warn("Claims integration failed:", err);
    }

    // Workspace Fade-Out Reset (1 second transition)
    setIsFading(true);
    setTimeout(() => {
      setIsFading(false);
      setScanState('idle');
      setSelectedImage(null);
      setScanResults(null);
      setSelectedShipment(null);

      // Update local view state queue immediate
      fetchLogistics();
    }, 1000);

    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  return (
    <div className={pageShellClass}>
      
      {/* Floating Success / Warning Toast Alert Banner */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className={cn(
              "fixed top-20 left-1/2 -translate-x-1/2 z-50 font-sans text-xs sm:text-sm font-extrabold px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 w-11/12 max-w-2xl backdrop-blur-md transition-all duration-300",
              isWarningToast 
                ? "bg-rose-600 border-rose-500/30 text-white"
                : "bg-emerald-650 border-emerald-500/30 text-white"
            )}
          >
            {isWarningToast ? (
              <AlertCircle className="w-5 h-5 text-white shrink-0 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-white shrink-0 animate-bounce" />
            )}
            <div className="flex-1 leading-relaxed">
              {successToast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        eyebrow="Receiving Gate Control"
        title="AI Quality Control & Receiving"
        subtitle="Scan incoming logistics lot samples to certify freshness, identify thermal defects, and trigger direct retail store routing."
      >
        <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs font-mono font-bold text-white">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Vision Core: <span className="font-semibold text-sky-200">FreshDetect v4.2</span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        
        {/* Left Column: Optical Laser Spectrograph Scanning Window */}
        <div className="lg:col-span-2 space-y-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl shadow-md overflow-hidden relative">
            <div className="px-4 py-3 bg-[#0c1e36] text-white flex items-center justify-between">
              <span className="text-xs font-black font-mono uppercase tracking-wider">Inspection terminal</span>
              <span className="text-[10px] font-mono text-sky-300">Spectrograph live</span>
            </div>
            <div className="p-2">
            <div className="relative bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-200/50 dark:border-slate-800/60">
              
              {/* Workspace Cleanup Fading Animator Cover Layer */}
              <AnimatePresence>
                {isFading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center"
                  >
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                    <span className="text-xs font-bold font-mono tracking-wider text-indigo-500">Resetting Inspection Terminal...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {scanState === 'idle' && (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center p-8 text-center"
                  >
                    <div 
                      className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-md mb-5 border border-slate-200 dark:border-slate-800 group cursor-pointer hover:border-emerald-400 hover:shadow-emerald-100/30 transition-all duration-300"
                      onClick={() => startScan()}
                    >
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100 mb-1">Initialize Sample Scan</h3>
                    <p className="text-xs text-slate-550 dark:text-slate-404 max-w-sm leading-relaxed mb-6">
                      Awaiting next pallet selection from inbound queue. Select a pallet below or load custom targets to trigger the spectrometer.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                      <button 
                        onClick={() => startScan()} 
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-500/15 cursor-pointer"
                      >
                        <ScanLine className="w-4 h-4" /> Start Live Scan
                      </button>
                      
                      <label className="cursor-pointer px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-800 rounded-lg font-bold font-mono text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors flex items-center gap-2 shadow-sm">
                        <Upload className="w-4 h-4 text-slate-400" /> Upload Batch
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                      </label>
                    </div>

                    {/* Quick Demo Presets */}
                    <div className="mt-8 border-t border-slate-150 dark:border-slate-850 pt-5 w-full max-w-md">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block mb-3">AI Demo Scan Targets</span>
                      <div className="flex justify-center gap-3">
                        {PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => startScan(p)}
                            className="px-3.5 py-2 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-505 dark:hover:border-indigo-400 hover:bg-white rounded-lg text-xs font-bold text-slate-700 dark:text-slate-204 transition-all flex items-center gap-2 group cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:scale-135 transition-all"></span>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {scanState === 'scanning' && (
                  <motion.div 
                    key="scanning"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="w-full h-full relative"
                  >
                    <img src={selectedImage || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800"} alt="Scanning Object" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/40 mix-blend-multiply"></div>
                    
                    {/* Laser Scanner bar overlays */}
                    <div className="absolute inset-4 border-2 border-emerald-400/30 rounded-lg">
                      <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                        className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399]"
                      />
                    </div>
                    
                    <div className="absolute top-1/4 left-1/4 w-32 h-20 border border-dashed border-emerald-450 rounded flex flex-col justify-end p-1.5 bg-slate-950/20">
                      <span className="bg-emerald-600 text-white text-[9px] uppercase font-bold px-1 rounded w-fit font-mono tracking-tight">Spectrograph diagnostics...</span>
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full flex items-center gap-3 text-xs font-bold font-mono border border-white/10 shadow-xl">
                      <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                      Analyzing Multispectral Surface Matrix...
                    </div>
                  </motion.div>
                )}

                {scanState === 'results' && (
                  <motion.div 
                    key="results"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="w-full h-full relative group"
                  >
                    <img src={selectedImage || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800"} alt="Scanned Object" className="w-full h-full object-cover opacity-80 dark:opacity-55" />
                    
                    {/* Bounding Box Diagnostics HUD */}
                    <div className={cn(
                      "absolute top-[22%] left-[24%] w-[25%] h-[35%] border-2 rounded-lg bg-white/5 flex flex-col justify-between p-1.5",
                      scanResults?.defects_detected ? "border-rose-550/85 bg-rose-500/10" : "border-emerald-500/85 bg-emerald-500/10"
                    )}>
                       <span className={cn(
                         "text-[9px] font-black font-mono px-1.5 py-0.5 rounded shadow-sm w-fit uppercase",
                         scanResults?.defects_detected ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                       )}>
                         {scanResults?.defects_detected ? "DEFECT DETECTED" : "QA CONFIRMED 100/100"}
                       </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent flex flex-col justify-end p-6">
                      <div className="flex justify-between items-end">
                        <div className="max-w-lg">
                           <div className={cn(
                             "backdrop-blur-md border text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest font-mono mb-2 w-fit",
                             scanResults?.defects_detected 
                               ? "bg-rose-500/25 text-rose-300 border-rose-500/35"
                               : "bg-emerald-500/25 text-emerald-300 border-emerald-500/35"
                           )}>
                             {scanResults?.defects_detected ? "Inspection Warning Alert" : "Certified Premium Grade"}
                           </div>
                           <h2 className="text-xl font-bold text-white mb-0.5">{scanResults?.item_name || 'Hass Avocados'}</h2>
                           <p className="text-slate-300 text-xs font-mono">
                             {selectedShipment ? `Lot: ${selectedShipment.id} • Supplied by ${selectedShipment.vendor}` : 'Prototype Preset Test Lot'}
                           </p>
                        </div>
                        <button 
                          onClick={resetScan} 
                          className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 rounded-lg text-xs font-mono font-bold uppercase tracking-tight transition-all cursor-pointer hover:border-white/45"
                        >
                          Reset Scan
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis Results Insights panel */}
        <div className="space-y-3.5">
          <AnimatePresence mode="popLayout">
            {scanState === 'results' ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 rounded-2xl p-6 shadow-md overflow-hidden relative transition-colors duration-300",
                  scanResults?.defects_detected 
                    ? "border-rose-200 dark:border-rose-950/40"
                    : "border-emerald-250 dark:border-emerald-900/60"
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#0c1e36]"></div>
                <div className={cn(
                  "absolute top-0 left-0 w-full h-1", 
                  scanResults?.defects_detected ? "bg-rose-500" : "bg-emerald-500"
                )}></div>

                <div className="flex items-center gap-2.5 mb-5">
                  <div className={cn(
                    "p-2 rounded-lg shrink-0", 
                    scanResults?.defects_detected 
                      ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400" 
                      : "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                  )}>
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-950 dark:text-slate-100">Live Diagnosis Insights</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">AI Quality Score</span>
                       <span className={cn(
                         "text-xl font-mono font-extrabold", 
                         scanResults && scanResults.freshness_score >= 8 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                       )}>
                         {scanResults ? Math.round(scanResults.freshness_score * 10) : 0}/100
                       </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 border border-slate-200/20">
                      <div 
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-500", 
                          scanResults && scanResults.freshness_score >= 8 ? "bg-emerald-500" : "bg-rose-500"
                        )} 
                        style={{ width: `${scanResults ? scanResults.freshness_score * 10 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl">
                      <div className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1 font-mono">
                        <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0"/> Freshness
                      </div>
                      <div className="text-base font-extrabold font-mono text-slate-900 dark:text-slate-100">
                        {scanResults ? scanResults.freshness_score.toFixed(1) : "0.0"}/10
                      </div>
                    </div>
                    <div className={cn(
                      "p-3 rounded-xl border font-sans", 
                      scanResults?.defects_detected 
                        ? "bg-rose-50/20 border-rose-100 text-rose-600 dark:border-rose-950/50" 
                        : "bg-emerald-50/20 border-emerald-100 text-emerald-600 dark:border-emerald-950/20"
                    )}>
                      <div className="text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1 font-mono">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0"/> Anomalies
                      </div>
                      <div className="text-xs sm:text-sm font-mono font-black uppercase text-right leading-none mt-1">
                        {scanResults?.defects_detected ? 'FAIL FLAGS' : 'ZERO DEFECTS'}
                      </div>
                    </div>
                  </div>

                  {scanResults?.defects_detected && scanResults.defect_details.length > 0 ? (
                     <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-150/50 dark:border-rose-900/30 rounded-xl p-3">
                        <h4 className="text-xs font-bold flex items-center gap-1.5 text-rose-900 dark:text-rose-400 mb-2 font-mono uppercase tracking-wider">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Active Defect Log
                        </h4>
                        <ul className="text-[11px] text-rose-800 dark:text-rose-350 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar list-disc pl-4 space-y-1">
                          {scanResults.defect_details.map((d, i) => (
                             <li key={i} className="font-sans font-medium">{d}</li>
                          ))}
                        </ul>
                     </div>
                  ) : (
                    <div className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-xl p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-505 shrink-0" />
                      <span className="text-[11px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 leading-normal">
                        Perfect laser spectrometry readings. Micro-integrity meets high structural thresholds. 
                      </span>
                    </div>
                  )}

                  {/* AI Reasoning Decoupled Matrix Override */}
                  <div className="bg-gradient-to-br from-indigo-50/10 via-white to-slate-50 dark:from-slate-950/30 dark:via-slate-950/20 dark:to-slate-900 border border-indigo-100/50 dark:border-indigo-950/45 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase font-mono tracking-wider flex items-center gap-1.5 text-indigo-900 dark:text-indigo-400">
                      <Tag className="w-3.5 h-3.5 text-indigo-505 shrink-0" />
                      FreshDetect Core Reasoning
                    </h4>
                    <p className="text-[11px] text-slate-550 dark:text-slate-350 leading-relaxed max-h-28 overflow-y-auto custom-scrollbar font-medium">
                      {scanResults?.reasoning}
                    </p>
                    <div className="flex items-center justify-between bg-indigo-55/10 dark:bg-slate-950 p-2 rounded-lg border border-indigo-100/10 dark:border-indigo-950/20 mt-1">
                      <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-400 uppercase font-mono">Suggested Markdown</span>
                      <span className="text-indigo-650 dark:text-indigo-405 font-mono font-black border border-indigo-150 dark:border-indigo-900/40 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 rounded text-xs">
                        -{scanResults?.markdown_price_discount}%
                      </span>
                    </div>
                  </div>

                  {/* THE INTUITIVE ACTION FORK: Dual beautiful spaced full-width decision buttons */}
                  <div className="space-y-3 pt-1">
                    <button 
                      onClick={handleApproveAndRoute}
                      className={cn(
                        "w-full py-3.5 px-4 rounded-xl font-sans text-xs font-black uppercase tracking-wider transition-all flex justify-center items-center gap-2 shadow-lg cursor-pointer",
                        "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] hover:shadow-emerald-600/15"
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      Approve &amp; Route to Store
                    </button>
                    
                    <button 
                      onClick={handleRejectAndClaim}
                      className={cn(
                        "w-full py-3.5 px-4 rounded-xl font-sans text-xs font-black uppercase tracking-wider transition-all flex justify-center items-center gap-2 cursor-pointer border",
                        "border-rose-500 bg-rose-50/10 hover:bg-rose-50/20 text-rose-500 dark:text-rose-400 active:scale-[0.98]"
                      )}
                    >
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      Flag Anomalies &amp; Reject to Claims
                    </button>
                  </div>

                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[400px] flex flex-col items-center justify-center text-center text-slate-400">
                <Box className="w-10 h-10 mb-3 text-slate-350 dark:text-slate-800" />
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-1">Optical diagnosis inactive</h4>
                <p className="text-[11px] text-slate-450 dark:text-slate-505 max-w-xs leading-relaxed">
                  Choose an inbound shipment below or upload an incoming pallet snapshot to activate laser spectroanalysis and decision matrix controls.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Full-width bottom section: Backwards Linked Inbound DC Receiving Queue */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-505 dark:text-slate-400">Inbound DC Receiving Queue</h3>
            <p className="text-xs text-slate-400 mt-0.5">Physical supply chain queue synced backwards with logistics arrival events.</p>
          </div>
          <span className="text-[9.5px] font-mono text-indigo-500 font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-md">
            Pending Arrival Count: {logisticsQueue.length}
          </span>
        </div>

        <div className="space-y-3">
          {logisticsQueue.map((shipment) => {
            const isActive = selectedShipment?.id === shipment.id;
            return (
              <div 
                key={shipment.id}
                id={`queue-row-${shipment.id}`}
                onClick={() => handleLoadBatch(shipment)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-xs",
                  isActive 
                    ? "bg-indigo-50/10 border-indigo-400 text-indigo-900 dark:text-indigo-300 ring-1 ring-indigo-400" 
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400/40 hover:shadow-md"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    isActive ? "bg-indigo-550 animate-pulse" : (shipment.status === 'delayed' ? "bg-rose-500" : "bg-emerald-500")
                  )}></div>
                  <span className="font-mono text-xs sm:text-sm tracking-tight text-slate-900 dark:text-slate-100 font-semibold truncate">
                    {getShipmentLabel(shipment)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="text-[10px] font-mono text-slate-450 dark:text-slate-500 tracking-tight mr-1">
                    ETA: {shipment.eta || 'Standard'}
                  </span>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded text-[9.5px] font-mono font-black uppercase tracking-wider border",
                    isActive 
                      ? "text-indigo-650 bg-indigo-55/20 border-indigo-300" 
                      : (shipment.status === 'delayed' ? "text-rose-600 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50" : "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200/50")
                  )}>
                    {isActive ? "Scanning active" : (shipment.status === 'delayed' ? "ANOMALY WARNING" : "READY TO LOAD")}
                  </span>
                  <ArrowUpRight className={cn("w-4 h-4 text-slate-400 transition-transform", isActive ? "rotate-45 text-indigo-500 font-bold" : "group-hover:translate-x-0.5")} />
                </div>
              </div>
            );
          })}
          {logisticsQueue.length === 0 && (
            <div className="py-12 border border-dashed border-slate-200 dark:border-slate-805 rounded-xl text-center text-slate-450 text-xs font-mono">
              Inbound DC Receiving Queue Empty • Syncing Logistics arrive events...
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
