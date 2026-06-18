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
      markdown_price_discount: 0,
      predicted_shelf_life: 15.0,
      confidence_index: 95
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
      markdown_price_discount: 10,
      predicted_shelf_life: 6.5,
      confidence_index: 95
    }
  }
];

const SAMPLE_BOX_COUNT = 10;

const CASE_RATES: Record<string, number> = {
  "Hard-Boiled Eggs": 12,
  "Hass Avocados": 18,
  "Fresh Atlantic Salmon": 24.5,
  "Fresh Salmon": 24.5,
  "Organic Milk": 10,
  "Strawberries": 15,
  "Organic Cucumbers": 8.5,
  "Roma Tomatoes": 9,
};

function getCaseRate(itemName?: string): number {
  if (!itemName) return 12;
  const lower = itemName.toLowerCase();
  for (const [key, rate] of Object.entries(CASE_RATES)) {
    if (lower.includes(key.toLowerCase())) return rate;
  }
  if (lower.includes('salmon') || lower.includes('fish')) return 24.5;
  if (lower.includes('milk') || lower.includes('dairy')) return 10;
  if (lower.includes('egg')) return 12;
  if (lower.includes('avocado')) return 18;
  if (lower.includes('strawberr')) return 15;
  if (lower.includes('tomato')) return 9;
  return 12;
}

function getReferenceImageForShipment(shipment: any): string {
  const nameLower = (shipment.product || shipment.item || "").toLowerCase();
  if (nameLower.includes('salmon') || nameLower.includes('fish')) {
    return "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=800";
  }
  if (nameLower.includes('milk') || nameLower.includes('dairy')) {
    return "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=800";
  }
  if (nameLower.includes('avocado')) {
    return "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800";
  }
  if (nameLower.includes('strawberr')) {
    return "https://images.unsplash.com/photo-1464963915981-03a15b509c2f?auto=format&fit=crop&q=80&w=800";
  }
  return "https://images.unsplash.com/photo-1582293001053-efcc1ea00522?auto=format&fit=crop&q=80&w=800";
}

async function imageToBase64(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function QualityControl() {
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

  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{
    item_name: string;
    is_fresh_produce?: boolean;
    freshness_score: number;
    defects_detected: boolean;
    defect_details: string[];
    reasoning: string;
    markdown_price_discount: number;
    predicted_shelf_life?: number;
    confidence_index?: number;
    passed_boxes?: number;
    defective_boxes?: number;
  } | null>(null);

  // Core interactive states for step updates and toasts
  const [isFading, setIsFading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isWarningToast, setIsWarningToast] = useState(false);

  // Split routing override states matching the 8/2 default fractional split
  const [passedBoxes, setPassedBoxes] = useState(8);
  const [defectiveBoxes, setDefectiveBoxes] = useState(2);

  const handleIncrementPassed = () => {
    if (passedBoxes < SAMPLE_BOX_COUNT) {
      setPassedBoxes(p => p + 1);
      setDefectiveBoxes(d => d - 1);
    }
  };

  const handleDecrementPassed = () => {
    if (passedBoxes > 0) {
      setPassedBoxes(p => p - 1);
      setDefectiveBoxes(d => d + 1);
    }
  };

  const handleIncrementDefective = () => {
    if (defectiveBoxes < SAMPLE_BOX_COUNT) {
      setDefectiveBoxes(d => d + 1);
      setPassedBoxes(p => p - 1);
    }
  };

  const handleDecrementDefective = () => {
    if (defectiveBoxes > 0) {
      setDefectiveBoxes(d => d - 1);
      setPassedBoxes(p => p + 1);
    }
  };

  // Dynamic receiving queue linked backward to Logistics page
  const [logisticsQueue, setLogisticsQueue] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any>(null);

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

  const applyScanResults = (data: NonNullable<typeof scanResults>) => {
    setScanResults(data);
    const passed = data.passed_boxes ?? Math.max(0, Math.min(SAMPLE_BOX_COUNT, Math.round(data.freshness_score ?? 0)));
    const defective = data.defective_boxes ?? Math.max(0, SAMPLE_BOX_COUNT - passed);
    setPassedBoxes(passed);
    setDefectiveBoxes(defective);
    setScanState('results');
  };

  const runAiScan = async (imageSrc: string, shipment?: any) => {
    setSelectedImage(imageSrc);
    setScanState('scanning');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
      const base64 = await imageToBase64(imageSrc);
      const res = await fetch("/api/analyze-produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          expectedProduct: shipment?.product || shipment?.item?.replace(/^\d+,\d*\s*Cases\s*of\s*/i, "") || undefined,
          poId: shipment?.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to analyze image");
      const data = await res.json();
      applyScanResults(data);

      if (shipment?.id) {
        fetch("/api/qc/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            release_po_id: shipment.id,
            assetPointer: shipment.containerId || shipment.id,
            scanMode: "computer_vision_multispectral",
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Scan API failed:", err);
      applyScanResults({
        item_name: "Analysis Error — Retry Upload",
        is_fresh_produce: false,
        freshness_score: 0,
        defects_detected: true,
        defect_details: ["Could not complete AI vision analysis"],
        reasoning: "The analysis service could not process this image. Please try again or check that the frontend server is running.",
        markdown_price_discount: 0,
        predicted_shelf_life: 0,
        confidence_index: 0,
        passed_boxes: 0,
        defective_boxes: SAMPLE_BOX_COUNT,
      });
    }
  };

  const startScan = async (imageOrPreset?: string | typeof PRESETS[0] | React.MouseEvent) => {
    if (imageOrPreset && typeof imageOrPreset === 'object' && 'results' in imageOrPreset) {
      await runAiScan(imageOrPreset.image, selectedShipment ?? undefined);
      return;
    }
    if (typeof imageOrPreset === 'string') {
      await runAiScan(imageOrPreset, selectedShipment ?? undefined);
      return;
    }
    const ref = selectedShipment
      ? getReferenceImageForShipment(selectedShipment)
      : PRESETS[0].image;
    await runAiScan(ref, selectedShipment ?? undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      runAiScan(reader.result as string, selectedShipment ?? undefined);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const resetScan = () => {
    setScanState('idle');
    setSelectedImage(null);
    setScanResults(null);
    setSelectedShipment(null);
    setPassedBoxes(8);
    setDefectiveBoxes(2);
  };

  const handleLoadBatch = async (shipment: any) => {
    setSelectedShipment(shipment);
    setScanResults(null);
    await runAiScan(getReferenceImageForShipment(shipment), shipment);
  };

  const lotCases = selectedShipment?.quantity ?? SAMPLE_BOX_COUNT;
  const lotUnit = selectedShipment?.unit || "Cases";
  const passedCases = Math.round(lotCases * (passedBoxes / SAMPLE_BOX_COUNT));
  const wastageCases = Math.round(lotCases * (defectiveBoxes / SAMPLE_BOX_COUNT));
  const caseRate = getCaseRate(scanResults?.item_name || selectedShipment?.product);
  const wastageValue = wastageCases * caseRate;
  const wastagePct = ((defectiveBoxes / SAMPLE_BOX_COUNT) * 100).toFixed(1);

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

      const isBlanketBatchItem = selectedShipment.isBlanketBatch || selectedShipment.id?.includes('BLANKET');
      const batchNum = selectedShipment.batchNum || (selectedShipment.id?.includes('-B') ? selectedShipment.id.split('-B')[1] : null) || '1';
      const pBpoId = selectedShipment.parentBpoId || selectedShipment.parentBlanketId || (isBlanketBatchItem ? 'PO-2026-BLANKET' : null);

      const newlyAdded = splits.map(split => ({
        id: activePO,
        parentBpoId: pBpoId,
        branch: split.branch,
        item: isBlanketBatchItem 
          ? `Blanket Contract Batch Release #${batchNum} Received`
          : itemTitle,
        cases: split.cases,
        qualityScore: 100,
        markdown: '0%',
        verificationTag: `Auto-Reconciled ✓ (Matched with DC QC Scan Archive ID-QA-${activePO})`,
        timestamp: new Date().toISOString(),
        status: 'Auto-Reconciled' as any,
        approvedTemp: selectedShipment.temp || '3.5°C',
        batchNum: batchNum,
        poId: activePO
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

      const activePO = {
        id: selectedShipment.id,
        vendorName: selectedShipment.vendor || 'Global Farms Suppliers',
        totalValue: totalVolume * 12 // cost basis calculation $12 per case
      };

      const activeQCResults = {
        defects: scanResults && scanResults.defect_details.length > 0 
          ? scanResults.defect_details.join(", ")
          : "Surface bruising, slime, and extreme cold-chain temperature violations."
      };

      const generatedClaim = {
        claimId: "CLM-" + Math.floor(Math.random() * 9000),
        poOrigin: activePO.id,
        vendor: activePO.vendorName,
        defectType: activeQCResults.defects,
        lossValue: activePO.totalValue,
        status: 'pending',
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

  const handleExecuteRoutingAndFileClaim = () => {
    if (!selectedShipment) return;

    const activePO = selectedShipment.id;
    const vendorName = selectedShipment.vendor || 'Global Farms Suppliers';
    const totalVolume = selectedShipment.quantity || 1200;
    const itemTitle = selectedShipment.product || selectedShipment.item;

    const passedCasesTotal = Math.round(totalVolume * (passedBoxes / SAMPLE_BOX_COUNT));
    const defectiveCasesTotal = Math.round(totalVolume * (defectiveBoxes / SAMPLE_BOX_COUNT));

    // Toast configuration
    setIsWarningToast(false);
    setSuccessToast(`Fractional Routing Completed: ${passedBoxes} boxes routed, ${defectiveBoxes} flagged to claims.`);

    // 1. Remove/Update inbound shipment DC Queue status (sets list to completed in logistics)
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
            eta: 'Received @ DC Hub',
            rerouted: true,
            fractionalSplit: {
              passed: passedBoxes,
              defective: defectiveBoxes,
              passedCases: passedCasesTotal,
              defectiveCases: defectiveCasesTotal
            }
          };
        }
        return s;
      });
      localStorage.setItem('freshguard-active-shipments', JSON.stringify(updatedList));
    } catch (err) {
      console.warn("Error updating active shipments:", err);
    }

    // 2. Generate Store receiving items (the validated portion) straight to live Store Receiving Dashboard view
    if (passedCasesTotal > 0) {
      try {
        const storedStore = localStorage.getItem('freshguard-store-items');
        let storeList = storedStore ? JSON.parse(storedStore) : [];

        // Split passed cases across general target branches to mock actual live load-splitting
        const splits = [
          { branch: 'Chicago Downtown', cases: Math.round(passedCasesTotal * 0.25) },
          { branch: 'Lincoln Park', cases: Math.round(passedCasesTotal * 0.25) },
          { branch: 'West Loop', cases: Math.round(passedCasesTotal * 0.25) },
          { branch: 'Southport', cases: Math.round(passedCasesTotal * 0.25) }
        ];

        const isBlanketBatchItem = selectedShipment.isBlanketBatch || selectedShipment.id?.includes('BLANKET');
        const batchNum = selectedShipment.batchNum || (selectedShipment.id?.includes('-B') ? selectedShipment.id.split('-B')[1] : null) || '1';
        const pBpoId = selectedShipment.parentBpoId || selectedShipment.parentBlanketId || (isBlanketBatchItem ? 'PO-2026-BLANKET' : null);

        const newlyAdded = splits.map(split => ({
          id: activePO,
          poId: activePO,
          parentBpoId: pBpoId,
          branch: split.branch,
          item: isBlanketBatchItem 
            ? `Blanket Contract Batch Release #${batchNum} Received`
            : itemTitle,
          cases: split.cases,
          qualityScore: Math.round(scanResults?.freshness_score ? scanResults.freshness_score * 10 : 80),
          markdown: '0%',
          verificationTag: `Verified Split Receiving ✓ (${passedBoxes}/${SAMPLE_BOX_COUNT} Boxes passed AI QA)`,
          timestamp: new Date().toISOString(),
          status: 'Auto-Received' as any,
          approvedTemp: selectedShipment.temp || '3.5°C',
          batchNum: batchNum
        }));

        localStorage.setItem('freshguard-store-items', JSON.stringify([...newlyAdded, ...storeList]));
      } catch (err) {
        console.warn("Error receiving in store inventory:", err);
      }
    }

    // 3. Generate a pre-filled damage report entry inside the Claims & Wastage tab targeting the specific vendor account
    if (defectiveCasesTotal > 0) {
      try {
        const storedClaims = localStorage.getItem('freshguard-claims-list');
        let claimsList = storedClaims ? JSON.parse(storedClaims) : [];

        const lossAmt = defectiveCasesTotal * 12; // cost basis calculation $12 per case
        const genClaimId = "CLM-" + Math.floor(100 + Math.random() * 900);

        const generatedClaim = {
          id: genClaimId,
          claimId: genClaimId,
          po: activePO,
          poOrigin: activePO,
          vendor: vendorName,
          vendorName: vendorName,
          issue: `Partial Damage Flag (${defectiveBoxes}/${SAMPLE_BOX_COUNT} Boxes Failed AI Scan)`,
          defectType: `Partial Damage Flag (${defectiveBoxes}/${SAMPLE_BOX_COUNT} Boxes Failed AI Scan)`,
          amount: `$${lossAmt.toLocaleString()}`,
          lossValue: lossAmt,
          status: 'pending',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };

        localStorage.setItem('freshguard-claims-list', JSON.stringify([generatedClaim, ...claimsList]));

        // Bump the global claims count metrics in localStorage for Claims dashboard to reflect it
        const storedPendingCount = localStorage.getItem('freshguard-claims-pending-count');
        if (storedPendingCount) {
          localStorage.setItem('freshguard-claims-pending-count', String(Number(storedPendingCount) + 1));
        }
      } catch (err) {
        console.warn("Claims integration failed:", err);
      }
    }

    // Workspace Fade-Out Reset (1 second transition)
    setIsFading(true);
    setTimeout(() => {
      setIsFading(false);
      setScanState('idle');
      setSelectedImage(null);
      setScanResults(null);
      setSelectedShipment(null);
      setPassedBoxes(8);
      setDefectiveBoxes(2);
      
      // Update local view state queue immediate
      fetchLogistics();
    }, 1000);

    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  const renderThermalTimelineSvg = (itemName: string) => {
    // If avocado, salmon, milk are loaded, show temperature excursions (the user requested showing steady 4°C baseline with brief micro-excursion hitting 6°C)
    const isAnomalous = itemName?.toLowerCase().includes('avocado') || itemName?.toLowerCase().includes('salmon') || itemName?.toLowerCase().includes('milk');
    
    return (
      <div className="w-full h-36 bg-slate-950 rounded-xl border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono font-extrabold tracking-widest text-[#64748b] uppercase">LIVE CONTAINER THERMAL TELEMETRY</span>
          <span className="text-[8.5px] font-mono text-emerald-400 border border-emerald-550/20 px-1.5 py-0.5 rounded bg-emerald-500/5 font-black">Buffer Target: 4°C</span>
        </div>
        
        {/* SVG Curve */}
        <div className="flex-1 w-full relative mt-2">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
            {/* Horizontal Grid lines */}
            <line x1="0" y1="10" x2="100" y2="10" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1,2" />
            <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1,2" />
            
            {/* Red Biological Safety Excursion Line (at 5.0°C which matches Y=15 in our coordinate mapping where 0=8°C, 30=2°C) */}
            <line x1="0" y1="15" x2="100" y2="15" stroke="#ef4444" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.75" />
            
            {/* Steady 4.0 °C corresponds to Y=20. Excursion to 6.2°C corresponds to Y=9 */}
            {isAnomalous ? (
              <>
                {/* Glow under the curve */}
                <path
                  d="M 0 20 L 30 20 Q 40 8, 50 8 T 60 20 L 100 20 L 100 30 L 0 30 Z"
                  fill="url(#excursionGradient)"
                  opacity="0.15"
                />
                
                {/* Real-time Temp Path */}
                <path
                  d="M 0 20 L 30 20 Q 40 8, 50 8 T 60 20 L 100 20"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                
                {/* Excursion Node */}
                <circle cx="48" cy="8.5" r="3" fill="#ef4444" className="animate-ping" />
                <circle cx="48" cy="8.5" r="2" fill="#ef4444" />
              </>
            ) : (
              <>
                {/* Steady Baseline at perfectly 4.0°C (Y=20) */}
                <path
                  d="M 0 20 L 100 20"
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="50" cy="20" r="2" fill="#4f46e5" />
              </>
            )}

            {/* Gradient Definitions */}
            <defs>
              <linearGradient id="excursionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Biological Threshold Overlay Warning Label */}
          <div className="absolute right-2 top-[32%] text-[7.5px] font-mono text-rose-500 tracking-wider font-extrabold flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping"></span>
            Critical Bio-Threshold Limit (5.0°C)
          </div>
          
          {isAnomalous ? (
            <div className="absolute left-[38%] top-[10%] text-[8px] font-mono font-black text-rose-450 bg-slate-950 border border-rose-550/35 px-1.5 py-0.5 rounded shadow-xl flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
              MicroExcursion: 6.2°C
            </div>
          ) : (
            <div className="absolute left-[40%] top-[45%] text-[8px] font-mono font-black text-indigo-400 bg-slate-950 border border-indigo-500/20 px-1.5 py-0.5 rounded">
              Steady Thermal Hold: 4.0°C
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-[7.5px] font-mono text-[#475569] pt-1.5 border-t border-slate-900 mt-1">
          <span>T-24 HRS (INTRANSIT)</span>
          <span>T-18 HRS</span>
          <span>T-12 HRS (SPIKE EVENT)</span>
          <span>T-6 HRS</span>
          <span>SCAN WINDOW (NOW)</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen relative overflow-y-auto text-slate-900 dark:text-slate-100">
      
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

      {/* Header Info Block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tracking-widest uppercase block">Receiving Gate Control</span>
          <h1 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight mt-0.5">AI Quality Control &amp; Receiving</h1>
          <p className="text-slate-500 text-xs mt-1">Scan incoming logistics lot samples to certify freshness, identify thermal defects, and trigger direct retail store routing.</p>
        </div>
        
        <div className="flex gap-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs font-mono font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Vision Core: <span className="font-semibold text-slate-705 dark:text-slate-200">FreshDetect v4.2</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Optical Laser Spectrograph Scanning Window / Live Stream */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {scanState === 'idle' ? (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 shadow-sm relative flex flex-col items-center justify-center text-center min-h-[420px]"
              >
                {/* Workspace Cleanup Fading Animator Cover Layer */}
                <AnimatePresence>
                  {isFading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-2xl"
                    >
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                      <span className="text-xs font-bold font-mono tracking-wider text-indigo-500">Resetting Inspection Terminal...</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mb-5 border border-slate-200 dark:border-slate-700">
                  <Camera className="w-8 h-8 text-slate-400" />
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Initialize Sample Scan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-6">
                  Load a shipment from the inbound queue below, or upload your own photo of the pallet or cases. AI vision will grade freshness and estimate lot wastage.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                  <button 
                    onClick={() => startScan()} 
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4" /> START LIVE SCAN
                  </button>
                  
                  <label className="cursor-pointer px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-250 dark:border-slate-800 rounded-lg font-bold font-mono text-xs uppercase tracking-wider hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm">
                    <Upload className="w-4 h-4 text-slate-400" /> UPLOAD BATCH
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                </div>

                {/* Horizontal Line Break */}
                <div className="w-full border-t border-slate-150 dark:border-slate-800/60 my-6"></div>

                {/* AI Demo Scan Targets */}
                <div className="w-full max-w-md">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block mb-3">AI DEMO SCAN TARGETS</span>
                  <div className="flex justify-center gap-3">
                    {PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => startScan(p)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-white rounded-full text-xs font-bold text-slate-705 dark:text-slate-300 transition-all flex items-center gap-2 group cursor-pointer shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <motion.div 
                  key="active"
                  initial={{ opacity: 0, scale: 0.98 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm relative"
                >
                  <div className="relative bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-250/20 dark:border-slate-800/60 min-h-[380px]">
                    
                    {/* Workspace Cleanup Fading Animator Cover Layer */}
                    <AnimatePresence>
                      {isFading && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-xl"
                        >
                          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                          <span className="text-xs font-bold font-mono tracking-wider text-indigo-500">Resetting Inspection Terminal...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                      {scanState === 'scanning' && (
                        <motion.div 
                          key="scanning"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="w-full h-full relative"
                        >
                          <img src={selectedImage || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800"} alt="Scanning Object" className="w-full h-full object-cover rounded-xl" />
                          <div className="absolute inset-0 bg-slate-950/45 mix-blend-multiply rounded-xl"></div>
                          
                          {/* Laser Scanner bar overlays */}
                          <div className="absolute inset-4 border-2 border-emerald-400/30 rounded-lg">
                            <motion.div 
                              animate={{ top: ['0%', '100%', '0%'] }}
                              transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                              className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_15px_#34d399]"
                            />
                          </div>
                          
                          <div className="absolute top-1/4 left-1/4 w-44 h-24 border border-dashed border-emerald-400 rounded flex flex-col justify-end p-2.5 bg-slate-950/40 backdrop-blur-[1px]">
                            <span className="bg-emerald-600 text-white text-[9px] uppercase font-bold px-1.5 rounded w-fit font-mono tracking-tight">Spectrograph diagnostics...</span>
                            <span className="text-[8px] text-emerald-300 font-mono mt-1">LAMBDA: 780nm • LIDAR ACTIVE</span>
                          </div>

                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-full flex items-center gap-3 text-xs font-bold font-mono border border-white/10 shadow-2xl">
                            <Activity className="w-4 h-4 animate-pulse text-emerald-400" />
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
                          <img src={selectedImage || "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=800"} alt="Scanned Object" className="w-full h-full object-cover opacity-90 dark:opacity-75 rounded-xl" />
                          
                          {/* AI vision bounding box — labels change based on actual scan results */}
                          {!scanResults?.is_fresh_produce && scanResults?.is_fresh_produce !== undefined ? (
                            <div className="absolute top-[15%] left-[10%] right-[10%] bottom-[20%] border-2 border-dashed border-amber-500 bg-amber-500/10 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] flex flex-col justify-between p-3.5 backdrop-blur-[1px]">
                              <span className="bg-amber-600/90 text-white text-[9px] font-mono font-black uppercase tracking-widest px-2 py-1 rounded shadow-md w-fit">
                                ⚠ Not Fresh Produce [{scanResults?.confidence_index ?? 85}% Confidence]
                              </span>
                              <span className="text-[8px] font-mono text-amber-200 font-bold tracking-tight">QC REJECT — NON-INVENTORY SUBJECT</span>
                            </div>
                          ) : (
                            <div className="absolute top-[20%] left-[20%] w-[45%] h-[40%] border-2 border-dashed border-emerald-500 bg-emerald-500/10 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse flex flex-col justify-between p-3.5 backdrop-blur-[1px]">
                              <span className="bg-emerald-600/90 text-white text-[9px] font-mono font-black uppercase tracking-widest px-2 py-1 rounded shadow-md w-fit">
                                {scanResults?.defects_detected ? '⚠ Quality Flag' : '✓ Healthy Tissue'} [{scanResults?.confidence_index ?? 98}% Confidence]
                              </span>
                              <span className="text-[8px] font-mono text-emerald-300 font-bold tracking-tight">REF: GEO-COORD-DECT</span>
                            </div>
                          )}

                          {scanResults?.defects_detected && scanResults?.is_fresh_produce !== false && (
                            <div className="absolute bottom-[15%] right-[15%] w-[35%] h-[30%] border-2 border-dashed border-rose-500 bg-rose-50/15 rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.5)] flex flex-col justify-between p-3 backdrop-blur-[1px]">
                              <span className="bg-rose-600/90 text-white text-[9px] font-mono font-black uppercase tracking-widest px-2 py-1 rounded shadow-md w-fit leading-tight">
                                ⚠️ Internal Bruising / Chilling Injury Detected [92% Confidence]
                              </span>
                              <span className="text-[8px] font-mono text-rose-350 font-bold tracking-tight">WARNING FLAG REF: SPECQA-92</span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent flex flex-col justify-end p-5 rounded-xl">
                            <div className="flex justify-between items-end">
                              <div className="max-w-xs md:max-w-md">
                                 <div className={cn(
                                   "backdrop-blur-md border text-[8.5px] font-black px-2 py-0.5 rounded uppercase tracking-widest font-mono mb-2 w-fit",
                                   scanResults?.is_fresh_produce === false
                                     ? "bg-amber-500/25 text-amber-300 border-amber-500/35"
                                     : scanResults?.defects_detected 
                                     ? "bg-rose-500/25 text-rose-300 border-rose-500/35"
                                     : "bg-emerald-500/25 text-emerald-300 border-emerald-500/35"
                                 )}>
                                   {scanResults?.is_fresh_produce === false
                                     ? "Not Produce — QC Rejected"
                                     : scanResults?.defects_detected ? "Inspection Warning Alert" : "Certified Premium Grade"}
                                 </div>
                                 <h2 className="text-xl font-bold text-white mb-0.5 leading-tight">{scanResults?.item_name || 'Awaiting Scan'}</h2>
                                 <p className="text-slate-350 text-xs font-mono">
                                   {selectedShipment ? `Lot ID: ${selectedShipment.id} • ${selectedShipment.vendor}` : 'Simulation Target Loaded'}
                                 </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="cursor-pointer px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white backdrop-blur-md border border-emerald-500/30 rounded-lg text-xs font-mono font-bold uppercase tracking-tight transition-all flex items-center gap-1.5">
                                  <Upload className="w-3.5 h-3.5" /> Re-scan Photo
                                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </label>
                                <button 
                                  onClick={resetScan} 
                                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 rounded-lg text-xs font-mono font-bold uppercase tracking-tight transition-all cursor-pointer hover:border-white/45"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Horizontal Split Routing Card under scanner */}
                {scanState === 'results' && (
                  <motion.div
                    key="split-routing-panel"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] text-slate-900 rounded-2xl p-6 shadow-sm flex flex-col gap-5 transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-lg translate-z-0 will-change-transform select-none"
                  >
                    {/* Progress distribution percentage rail row at top */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-[#0F172A]">
                        AI Scan Complete: {passedBoxes + defectiveBoxes} Sample Boxes Graded
                      </h3>
                      
                      {/* Sleek, horizontal percentage rail */}
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-[#10B981] transition-all duration-300" 
                          style={{ width: `${(passedBoxes / (passedBoxes + defectiveBoxes || 1)) * 100}%` }}
                        ></div>
                        <div 
                          className="h-full bg-[#F43F5E] transition-all duration-300" 
                          style={{ width: `${(defectiveBoxes / (passedBoxes + defectiveBoxes || 1)) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-[#64748B] font-mono">
                        Sample split: {passedBoxes} passed / {defectiveBoxes} wastage ({wastagePct}% of sample)
                      </p>
                    </div>

                    {/* Lot wastage extrapolation */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl border border-[#E2E8F0] bg-white">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[#64748B] uppercase font-mono tracking-wider">Lot Size</span>
                        <span className="text-sm font-black text-[#0F172A] font-mono">{lotCases.toLocaleString()} {lotUnit}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-emerald-600 uppercase font-mono tracking-wider">Passed (Est.)</span>
                        <span className="text-sm font-black text-emerald-700 font-mono">{passedCases.toLocaleString()} {lotUnit}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-rose-600 uppercase font-mono tracking-wider">Wastage (Est.)</span>
                        <span className="text-sm font-black text-rose-700 font-mono">{wastageCases.toLocaleString()} {lotUnit}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[#64748B] uppercase font-mono tracking-wider">Wastage Value</span>
                        <span className="text-sm font-black text-[#0F172A] font-mono">${wastageValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>

                    {/* Twin Channel Split-Routing Deck side-by-side (2 columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {/* Left Column (Fulfillment Routing) */}
                      <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#E2E8F0] bg-white">
                        <span className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wide">Fulfillment Routing</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            <span className="font-bold text-[#0F172A]">{passedBoxes}</span> Boxes • Passed Safety Matrix
                          </span>
                          {/* Micro Stepper Shifters */}
                          <div className="flex items-center gap-1 bg-slate-50 border border-[#E2E8F0] rounded px-1.5 py-1 shadow-xs select-none ml-auto">
                            <button 
                              onClick={handleDecrementPassed}
                              disabled={passedBoxes === 0}
                              type="button"
                              className="w-4 h-4 flex items-center justify-center text-xs font-black font-mono text-[#64748B] hover:text-[#0F172A] disabled:opacity-30 disabled:pointer-events-none transition-colors border-none bg-transparent cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-px h-3.5 bg-[#E2E8F0]"></span>
                            <button 
                              onClick={handleIncrementPassed}
                              disabled={passedBoxes === SAMPLE_BOX_COUNT}
                              type="button"
                              className="w-4 h-4 flex items-center justify-center text-xs font-black font-mono text-[#64748B] hover:text-[#0F172A] disabled:opacity-30 disabled:pointer-events-none transition-colors border-none bg-transparent cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#64748B] leading-normal font-sans font-semibold mt-1">
                          Destination: Active Store Inventory
                        </span>
                      </div>

                      {/* Right Column (Claims Mitigation) */}
                      <div className="flex flex-col gap-2 p-4 rounded-xl border border-[#E2E8F0] bg-white">
                        <span className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wide">Claims Mitigation</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            <span className="font-bold text-[#0F172A]">{defectiveBoxes}</span> Boxes • Spoilage Anomaly
                          </span>
                          {/* Micro Stepper Shifters */}
                          <div className="flex items-center gap-1 bg-slate-50 border border-[#E2E8F0] rounded px-1.5 py-1 shadow-xs select-none ml-auto">
                            <button 
                              onClick={handleDecrementDefective}
                              disabled={defectiveBoxes === 0}
                              type="button"
                              className="w-4 h-4 flex items-center justify-center text-xs font-black font-mono text-[#64748B] hover:text-[#0F172A] disabled:opacity-30 disabled:pointer-events-none transition-colors border-none bg-transparent cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-px h-3.5 bg-[#E2E8F0]"></span>
                            <button 
                              onClick={handleIncrementDefective}
                              disabled={defectiveBoxes === SAMPLE_BOX_COUNT}
                              type="button"
                              className="w-4 h-4 flex items-center justify-center text-xs font-black font-mono text-[#64748B] hover:text-[#0F172A] disabled:opacity-30 disabled:pointer-events-none transition-colors border-none bg-transparent cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#64748B] leading-normal font-sans font-semibold mt-1">
                          Destination: Claims &amp; Wastage Filing
                        </span>
                      </div>
                    </div>

                    {/* Center-aligned 'Execute routing and file claim' action button */}
                    <div className="flex justify-center mt-2">
                      <button
                        onClick={handleExecuteRoutingAndFileClaim}
                        type="button"
                        className="w-full py-3.5 px-4 bg-[#10B981] hover:bg-[#059669] text-white font-sans text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-emerald-500/10 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/20 active:translate-y-0 cursor-pointer active:scale-[0.99] border-none text-center"
                      >
                        Execute routing and file claim
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: AI Analysis Results Insights panel or Inactive Placeholder */}
        <div className="lg:col-span-1 space-y-6">
          <AnimatePresence mode="popLayout">
            {scanState === 'results' ? (
              <div className="space-y-6">
                {/* DYNAMIC INSIGHTS COLUMN RESTORATION (RIGHT SIDEBAR) */}
                <motion.div 
                  key="results-panel"
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white border border-[#E2E8F0] text-slate-900 rounded-2xl p-6 shadow-sm relative transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-lg translate-z-0 will-change-transform"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    gap: '16px',
                    background: '#F8FAFC'
                  }}
                >
                  {/* Telemetry Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg shrink-0 bg-white border border-[#E2E8F0] text-slate-600">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-[#0F172A] font-mono">Live Diagnosis Insights</h2>
                    </div>
                    {scanResults && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-white text-slate-700 border border-[#E2E8F0] rounded text-[8.5px] font-mono font-black uppercase tracking-wider shrink-0">
                        🤖 AI: {scanResults?.confidence_index || 95}% CONF
                      </span>
                    )}
                  </div>

                  {/* Focal Quality Score Line */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#64748B] font-mono uppercase tracking-wider">Overall Quality Score</span>
                    <div className="text-2xl font-black text-[#0F172A] font-sans tracking-tight">
                      {scanResults ? Math.round(scanResults.freshness_score * 10) : 0} / 100 Quality Score
                    </div>
                  </div>

                  {/* Wastage summary */}
                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#64748B] font-mono uppercase tracking-wider">Lot Wastage Estimate</span>
                      <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-mono">{wastagePct}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Sample graded</span>
                        <span className="font-black text-[#0F172A]">{passedBoxes} pass / {defectiveBoxes} waste</span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Lot extrapolation</span>
                        <span className="font-black text-rose-700">{wastageCases.toLocaleString()} {lotUnit} waste</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#E2E8F0]">
                      <span className="text-[10px] text-[#64748B] font-mono">Est. financial loss</span>
                      <span className="text-base font-black text-rose-700 font-mono">${wastageValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    {!selectedShipment && (
                      <p className="text-[9px] text-[#94A3B8] font-mono leading-relaxed">
                        Load a shipment from the queue to extrapolate wastage across the full lot.
                      </p>
                    )}
                  </div>

                  {/* Divider 1 */}
                  <div className="w-full h-px bg-[#E2E8F0]" />

                  {/* Parameter Rows */}
                  <div className="flex flex-col gap-4 font-mono text-xs">
                    {/* Freshness Index */}
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500 font-medium font-mono">Freshness Index</span>
                      <span className="font-extrabold text-[#0F172A] font-mono">
                        {scanResults ? scanResults.freshness_score.toFixed(1) : "0.0"} / 10
                      </span>
                    </div>

                    {/* Divider Rule */}
                    <div className="w-full h-px bg-[#E2E8F0]" />

                    {/* Estimated Shelf Life */}
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500 font-medium font-mono">Estimated Shelf Life</span>
                      <span className="font-extrabold text-[#0F172A] font-mono">
                        {scanResults ? `${scanResults.predicted_shelf_life?.toFixed(1) || "15.0"} Days` : "15.0 Days"}
                      </span>
                    </div>

                    {/* Divider Rule */}
                    <div className="w-full h-px bg-[#E2E8F0]" />

                    {/* Anomalies Flagged Row - Clean Block Layout */}
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-slate-500 font-medium font-mono text-[0.85rem]">
                        Anomalies Flagged
                      </span>
                      <div className="w-full">
                        {scanResults?.defects_detected ? (
                          <div 
                            style={{
                              background: '#FEF2F2',
                              borderLeft: '4px solid #EF4444',
                              padding: '10px',
                              borderRadius: '4px',
                            }}
                            className="font-extrabold font-mono text-xs text-rose-750"
                          >
                            {scanResults.defect_details && scanResults.defect_details.length > 0
                              ? scanResults.defect_details.join(", ")
                              : "Defects Detected"}
                          </div>
                        ) : (
                          <div className="font-extrabold text-[#0F172A] font-mono text-xs">
                            None Detected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              <motion.div 
                key="inactive-panel"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[400px] flex flex-col items-center justify-center text-center text-slate-400"
              >
                <Box className="w-10 h-10 mb-3 text-slate-350 dark:text-slate-800" />
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-1">OPTICAL DIAGNOSIS INACTIVE</h4>
                <p className="text-[11px] text-slate-450 dark:text-slate-505 max-w-xs leading-relaxed">
                  Choose an inbound shipment below or upload an incoming pallet snapshot to activate laser spectroanalysis and decision matrix controls.
                </p>
              </motion.div>
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
            
            // Re-slice and extract labels to form the perfect human-readable string trace
            const poCode = shipment.id;
            const itemName = shipment.product || shipment.item?.replace(/^\d+,\d*\s*Cases\s*of\s*/i, "") || "Fresh Produce";
            const vendorName = shipment.vendor?.replace(/\s*Suppliers\s*/i, "") || "Global Farms";
            const totalCases = (shipment.quantity || 1200).toLocaleString();
            const unit = shipment.unit || "Cases";
            
            // Build perfect indicator label
            const formattedLabel = `${poCode} • ${itemName} • ${vendorName} • ${totalCases} ${unit}`;
            
            return (
              <div 
                key={shipment.id}
                id={`queue-row-${shipment.id}`}
                onClick={() => handleLoadBatch(shipment)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row justify-between md:items-center gap-3.5 shadow-xs",
                  isActive 
                    ? "bg-indigo-50/10 border-indigo-400 text-indigo-900 dark:text-indigo-300 ring-1 ring-indigo-400 font-bold" 
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400/40 hover:shadow-xs"
                )}
              >
                <div className="flex items-center gap-3.5 truncate">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    isActive ? "bg-indigo-500 animate-pulse scale-125" : (shipment.status === 'delayed' ? "bg-amber-500" : "bg-emerald-505")
                  )}></div>
                  <span className="font-mono text-xs md:text-sm tracking-tight text-slate-900 dark:text-slate-100 font-black truncate">
                    {formattedLabel}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto font-mono">
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 tracking-tight">
                    ETA: {shipment.eta || 'Standard'}
                  </span>
                  
                  {shipment.status === 'delayed' ? (
                    <span className="text-xs font-black text-amber-505 dark:text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20">
                      [ ANOMALY WARNING ]
                    </span>
                  ) : (
                    <span className="text-xs font-black text-emerald-505 dark:text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                      [ READY TO LOAD ]
                    </span>
                  )}

                  <ArrowUpRight className={cn("w-4 h-4 text-slate-400 transition-transform", isActive ? "rotate-45 text-indigo-500 font-extrabold" : "group-hover:translate-x-0.5")} />
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
