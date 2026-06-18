/**
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Printer, 
  Download, 
  X, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Thermometer, 
  Award,
  Sparkles
} from 'lucide-react';

interface POPDFDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    poId: string;
    parentBpoId?: string;
    horizon?: string;
    batchIndex?: string;
    targetDC?: string;
    item: string;
    qty: number;
    unit?: string;
    pricePerUnit?: number;
    vendorName: string;
    vendorScore?: string;
    tempSpec?: string;
    transitMaxSpec?: string;
    shelfLifeSpec?: string;
    containerId?: string;
  };
}

export default function POPDFDocumentModal({ isOpen, onClose, data }: POPDFDocumentModalProps) {
  const [loading, setLoading] = useState(true);

  // Auto-calculate financials based on props
  const qty = data.qty || 1200;
  const pricePerUnit = data.pricePerUnit || 15.50;
  const subtotal = qty * pricePerUnit;
  const logisticsFee = Math.round(subtotal * 0.04 * 100) / 100; // 4% logistics surcharge
  const totalFunding = subtotal + logisticsFee;

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val);
  };

  // Simulate loading overlay upon launch
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, data.poId]);

  if (!isOpen) return null;

  // Handle browser printing using standard window.print()
  const handlePrint = () => {
    window.print();
  };

  // Simulate a neat PDF manifest download
  const handleDownloadSimulatedPDF = () => {
    const header = "=========================================================\n" +
                   "        OFFICIAL FRESHGUARD SUPPLY PLATFORM PO MANIFEST\n" +
                   "=========================================================\n\n";
    const body = `PO NUMBER: ${data.poId}\n` +
                 `Parent Blanket PO ID: ${data.parentBpoId || 'BPO-2026-8842'}\n` +
                 `Vendor Partner: ${data.vendorName}\n` +
                 `Target Segment Category: Fresh Fruits & Organic Vegetables\n` +
                 `Item Ordered: ${data.item}\n` +
                 `Consolidated Quantity: ${formatNumber(qty)} ${data.unit || 'Cases'}\n` +
                 `Unit Case Price: ${formatCurrency(pricePerUnit)}\n` +
                 `Financial Subtotal: ${formatCurrency(subtotal)}\n` +
                 `Logistics/Compliance Fees: ${formatCurrency(logisticsFee)}\n` +
                 `Total Approved Funding: ${formatCurrency(totalFunding)}\n\n` +
                 `----------------------------- SLA COMPLIANCE -----------------------------\n` +
                 `Target Core Temp Window: ${data.tempSpec || '36°F - 42°F (2.2°C - 5.5°C)'}\n` +
                 `Max Planned Transit Limit: ${data.transitMaxSpec || '36 Hours max'}\n` +
                 `SLA Violation Penalty: 10% gross value reduction per hour out of thermal limit\n\n` +
                 `----------------------------- DIGITAL SIGNATURE STAMP ---------------------\n` +
                 `Procurement Officer stamp verified via Blockchain Ledger Session ID: PO-SEC-${data.poId}-X921\n` +
                 `Auth Vendor Agent: Signed electronically at: ${new Date().toISOString()}\n`;

    const blob = new Blob([header + body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freshguard-manifest-${data.poId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 lg:p-4 overflow-hidden">
      
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm print:hidden"
      />

      {/* Main Container */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="pdf-loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-[#E2E8F0] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl flex flex-col items-center justify-center text-center gap-4 z-10 print:hidden"
          >
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-emerald-500 animate-spin"></div>
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] font-mono uppercase tracking-widest">Compiling Distributed Ledger</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Interrogating cold-chain telemetry nodes &amp; pre-compiling high-fidelity authorized PDF manifest...
              </p>
            </div>
            <span className="text-[10px] bg-[#F1F5F9] text-slate-600 border border-slate-200 px-2.5 py-1 rounded font-mono font-medium">
              IPFS Hash: QmXyZ9...{data.poId}
            </span>
          </motion.div>
        ) : (
          <motion.div 
            key="pdf-viewer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-[#F8FAFC] lg:bg-[#F8FAFC] border-0 lg:border border-slate-200 rounded-none lg:rounded-3xl max-w-5xl w-full h-full lg:h-[90vh] flex flex-col z-10 shadow-2xl overflow-hidden print:bg-white print:border-0 print:m-0 print:p-0 print:h-auto print:static"
          >
            {/* Top Bar (Interactive / Non-Print) */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-xs font-black text-[#0F172A] uppercase tracking-wider font-mono">Procurement Ledger Manifest</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Status: SLA Sealed &amp; Ledger Certified</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 rounded-full text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={handleDownloadSimulatedPDF}
                  className="px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Download Manifest</span>
                </button>
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                <button
                  onClick={onClose}
                  className="p-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-550 hover:text-slate-850 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Print Override CSS Block inserted dynamically */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                html, body {
                  background-color: white !important;
                  color: black !important;
                }
                body * {
                  visibility: hidden;
                }
                #printable-po-pdf-area, #printable-po-pdf-area * {
                  visibility: visible;
                }
                #printable-po-pdf-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  max-width: 100%;
                  margin: 0;
                  padding: 24px;
                  background-color: white !important;
                  color: black !important;
                  border: 0 !important;
                  box-shadow: none !important;
                }
              }
            `}} />

            {/* Document Workspace Panel */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 bg-slate-100/50 lg:bg-slate-50 flex justify-center custom-scrollbar print:bg-white print:p-0 print:block">
              
              {/* High-Fidelity Printable A4 Container */}
              <div 
                id="printable-po-pdf-area"
                className="w-full max-w-4xl bg-white text-slate-900 border border-slate-200 shadow-xl p-8 sm:p-12 font-sans relative overflow-visible print:shadow-none print:border-0 print:p-0 print:w-full print:max-w-none rounded-sm"
                style={{ minHeight: '1120px' }}
              >
                
                {/* 2. Upper Branding Deck */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b-2 border-slate-900 pb-6">
                  <div>
                    {/* Brand Logo */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md font-black tracking-tighter text-sm">FG</div>
                      <span className="font-sans font-black tracking-tight text-lg text-slate-900">FreshGuard <span className="font-medium text-slate-500">Supply Platform</span></span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest font-bold">Ledger Verified Biological Food Chain System</p>
                  </div>
                  
                  {/* Right Title Block */}
                  <div className="text-right sm:text-right flex flex-col items-start sm:items-end">
                    <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded tracking-wide uppercase">
                      Official Block Contract Release
                    </span>
                    <h1 className="text-xl font-black text-slate-900 mt-2 font-mono tracking-tight">RELEASE PURCHASE ORDER</h1>
                    <div className="text-xs font-mono font-bold text-slate-655 mt-1">PO Serialization: <span className="text-slate-950 font-black">{data.poId}</span></div>
                    <div className="text-[9.5px] font-mono text-slate-400 mt-0.5">Date Stamp: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>

                {/* Relational ID Ribbon (thin 4-cell row table) */}
                <div className="grid grid-cols-2 md:grid-cols-4 border border-slate-900 rounded divide-x divide-y md:divide-y-0 divide-slate-900 mt-6 font-mono text-[10.5px]">
                  <div className="p-3 text-left">
                    <span className="text-slate-500 uppercase block font-bold text-[8.5px] tracking-wider">Parent Blanket PO</span>
                    <span className="font-extrabold text-slate-900 block mt-0.5">{data.parentBpoId || 'BPO-2026-8842'}</span>
                  </div>
                  <div className="p-3 text-left">
                    <span className="text-slate-500 uppercase block font-bold text-[8.5px] tracking-wider">Increment Batch Index</span>
                    <span className="font-extrabold text-slate-900 block mt-0.5">
                      {data.batchIndex ? (data.batchIndex.includes('Release') ? data.batchIndex : `Release Batch ${data.batchIndex}`) : 'Release Batch 1 of 12'}
                    </span>
                  </div>
                  <div className="p-3 text-left">
                    <span className="text-slate-500 uppercase block font-bold text-[8.5px] tracking-wider">Logged Container ID</span>
                    <span className="font-extrabold text-slate-900 block mt-0.5">{data.containerId || 'MSKU 784219-5'}</span>
                  </div>
                  <div className="p-3 text-left">
                    <span className="text-indigo-600 uppercase block font-bold text-[8.5px] tracking-wider">Target Dispatch Node</span>
                    <span className="font-extrabold text-indigo-700 block mt-0.5">{data.targetDC || 'Chicago DC East'}</span>
                  </div>
                </div>

                {/* Entity Data Columns (Balanced robust two-column) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {/* Issued By: Corporate Buyer */}
                  <div className="border border-slate-200/80 rounded-xl p-5 bg-slate-50/50">
                    <h3 className="text-[9.5px] font-mono font-black text-slate-450 uppercase tracking-widest border-b border-slate-250/60 pb-1.5 mb-2.5">
                      Issued By (Buyer Authorized Entity)
                    </h3>
                    <div className="space-y-1 text-xs">
                      <div className="font-black text-slate-950 font-sans">FreshGuard Retail Sourcing Corp</div>
                      <div className="text-slate-600 font-medium font-sans">Central Logistics &amp; Distribution DC Hub</div>
                      <div className="text-slate-500 font-mono text-[11px]">4500 Central Pkwy, Suite 100</div>
                      <div className="text-slate-500 font-mono text-[11px]">Chicago, IL 60601, United States</div>
                      <div className="pt-2 border-t border-slate-200/50 mt-2 text-[10.5px] text-slate-400 font-mono flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Signatory: Broker Office Chicago</span>
                      </div>
                    </div>
                  </div>

                  {/* Issued To: Pre-Vetted Network Supplier */}
                  <div className="border border-slate-200/80 rounded-xl p-5 bg-slate-50/50">
                    <h3 className="text-[9.5px] font-mono font-black text-slate-450 uppercase tracking-widest border-b border-slate-250/60 pb-1.5 mb-2.5">
                      Issued To (Pre-Vetted Network Supplier)
                    </h3>
                    <div className="space-y-1 text-xs">
                      <div className="font-black text-slate-950 font-sans">{data.vendorName || 'Global Farms Suppliers Ltd'}</div>
                      <div className="text-slate-600 font-medium font-sans">Green-Valley Premium Grower Lot Sourcing</div>
                      <div className="text-slate-500 font-mono text-[11px]">Corporate ID: GEN-SPP-29837 (Zone B)</div>
                      <div className="text-slate-550 font-mono text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <span>SLA Qualification Score:</span>
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-extrabold text-[10px]">{data.vendorScore || '98%'} Verified</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200/50 mt-2 text-[10.5px] text-slate-400 font-mono flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Credentials: Class-A Certified Farm</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory Manifest Table */}
                <div className="mt-8">
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">I. Purchase Order Manifest Cargo Ledger</h3>
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white font-mono font-bold uppercase tracking-wider text-[9.5px]">
                          <th className="py-2.5 px-3 border-r border-slate-700 w-12 text-center">Line</th>
                          <th className="py-2.5 px-4 border-r border-slate-700">Product Details &amp; SKU Info</th>
                          <th className="py-2.5 px-4 border-r border-slate-700 text-right w-24">Quantity</th>
                          <th className="py-2.5 px-3 border-r border-slate-700 text-center w-20">Unit</th>
                          <th className="py-2.5 px-4 border-r border-slate-700 text-right w-28">Case Rate ($)</th>
                          <th className="py-2.5 px-4 text-right w-36">Net Cumulative ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 font-sans text-slate-800">
                        <tr className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 border-r border-slate-200 font-mono text-center text-slate-500 font-bold">01</td>
                          <td className="py-3 px-4 border-r border-slate-200 font-semibold font-sans">
                            <div className="text-slate-900">{data.item || 'Organic Hass Avocados [Class A Premium]'}</div>
                            <div className="text-[9.5px] text-slate-505 font-mono font-normal mt-0.5">Cold Chain Monitored • Real-time SLA Trigger Sourcing SKU</div>
                          </td>
                          <td className="py-3 px-4 border-r border-slate-200 text-right font-mono font-bold text-slate-900">{formatNumber(qty)}</td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center text-slate-600 font-mono font-bold">{data.unit || 'Cases'}</td>
                          <td className="py-3 px-4 border-r border-slate-200 text-right font-mono text-slate-700 font-medium">{formatCurrency(pricePerUnit)}</td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-950 font-black">{formatCurrency(subtotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary Stack (Right-aligned bottom edge) */}
                <div className="flex justify-end mt-4">
                  <div className="w-full sm:w-80 font-mono text-xs border border-slate-250/80 rounded-xl p-4.5 bg-slate-50/50 space-y-2">
                    <div className="flex justify-between text-slate-505">
                      <span>Commercial Subtotal:</span>
                      <span className="font-bold text-slate-850">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-505">
                      <span>Logistics &amp; Fuel Surchages:</span>
                      <span className="font-bold text-slate-850">{formatCurrency(logisticsFee)}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-300 pt-2 flex justify-between items-center text-sm font-black">
                      <span className="text-slate-900">Total Funding Released:</span>
                      <span className="bg-emerald-600 text-white font-mono font-black px-2.5 py-1 text-xs rounded-lg shadow-sm border border-emerald-700">
                        {formatCurrency(totalFunding)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Biological Cold-Chain Governance Block (SLA) */}
                <div className="mt-8 border-l-4 border-emerald-600 bg-emerald-50/30 p-5 rounded-r-xl space-y-3.5">
                  <h4 className="text-[10px] font-mono font-extrabold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Biological Cold-Chain Governance &amp; Enforcement Terms
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-slate-655 font-sans leading-relaxed">
                    <ul className="space-y-2.5 list-disc pl-3">
                      <li>
                        <strong className="text-slate-900">Thermodynamic Bounds:</strong> Target core product temp is mapped to <span className="font-mono text-[9.5px] font-bold bg-white text-emerald-800 px-1 py-0.2 rounded border border-emerald-150">{data.tempSpec || '36°F - 42°F (2.2°C - 5.5°C)'}</span>.
                      </li>
                      <li>
                        <strong className="text-slate-900">Thermal Slippage Offsets:</strong> Any continuous breach wider than 2.0°F exceeding cumulative 45 minutes triggers autonomous liquidated penalty claims.
                      </li>
                    </ul>
                    <ul className="space-y-2.5 list-disc pl-3">
                      <li>
                        <strong className="text-slate-900">SLA Violation Penalty:</strong> Automatic <span className="font-bold text-emerald-805">10% gross invoice valuation reduction</span> per hour transit deviates outside the scheduled thermal range.
                      </li>
                      <li>
                        <strong className="text-slate-900">Max Allowable Transit Time (MATT):</strong> Strictly limited to <span className="font-mono text-[9.5px] font-bold">{data.transitMaxSpec || '36 Hours max'}</span> from harvest seal to DC receiving gate.
                      </li>
                    </ul>
                  </div>
                  
                  <div className="text-[9.5px] font-mono font-medium text-slate-500 border-t border-emerald-200/50 pt-2 mt-1 gap-1 flex items-center">
                    <span>⚡ Note: System execution automated. Smart-contract telemetry logs are stored immutably on the distributed ledger.</span>
                  </div>
                </div>

                {/* Signatures Panel (Dual space underlines) */}
                <div className="mt-12 pt-8 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 font-mono text-[10.5px]">
                    
                    {/* Buyer Signature */}
                    <div className="space-y-3 flex flex-col justify-end">
                      <div className="h-6 flex items-end justify-center select-none">
                        <span className="font-serif italic text-sm text-slate-450 select-none">Procurement Signatory Stamp #PO-{data.poId}</span>
                      </div>
                      <div className="border-b border-slate-900 w-full"></div>
                      <div className="text-center font-bold text-slate-500 uppercase text-[9px] tracking-wider shrink-0">
                        Procurement Authority (FreshGuard Lead Buyer)
                        <div className="text-[7.5px] text-slate-400 font-normal lowercase tracking-normal mt-0.5 font-mono">
                          Session token verified via: SHA-256 FG-KEY-{data.poId}52
                        </div>
                      </div>
                    </div>

                    {/* Vendor Signature */}
                    <div className="space-y-3 flex flex-col justify-end">
                      <div className="h-6 flex items-end justify-center select-none">
                        {/* Display a simulated signature based on vendor name */}
                        <span className="font-serif italic text-sm text-indigo-750 font-extrabold tracking-widest select-none">
                          {data.vendorName?.split(' ')[0]} SLA Registered Authorized
                        </span>
                      </div>
                      <div className="border-b border-slate-900 w-full"></div>
                      <div className="text-center font-bold text-slate-500 uppercase text-[9px] tracking-wider shrink-0">
                        Supplier Authorized Agent ({data.vendorName || 'Sunrise Dairy'})
                        <div className="text-[7.5px] text-indigo-500 font-normal lowercase tracking-normal mt-0.5 font-mono font-bold animate-pulse">
                          e-Signature timestamped: {new Date().toISOString()}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
