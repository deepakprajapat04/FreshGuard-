/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store as StoreIcon, 
  MapPin, 
  ShieldCheck, 
  ChevronRight, 
  Calendar, 
  Search, 
  Filter, 
  CheckCircle2, 
  ArrowUpRight,
  Sparkles,
  Layers,
  Info,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AutoReceivedItem {
  id: string; // PO number or gen id
  branch: string;
  item: string;
  cases: number;
  qualityScore: number;
  markdown: string;
  verificationTag: string;
  timestamp: string;
  status: 'Auto-Reconciled' | 'Auto-Received' | 'Pending Storage';
}

export default function Store() {
  const [items, setItems] = useState<AutoReceivedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const branches = ['All', 'Chicago Downtown', 'Lincoln Park', 'West Loop', 'Southport'];

  const loadStoreItems = () => {
    try {
      const stored = localStorage.getItem('freshguard-store-items');
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Seed default store logs to make the page active and premium on first screen
        const defaults: AutoReceivedItem[] = [
          {
            id: 'PO-8843-C',
            branch: 'Lincoln Park',
            item: 'Organic Bananas',
            cases: 400,
            qualityScore: 94,
            markdown: '0%',
            verificationTag: 'Auto-Received: Verified Premium Quality by FreshDetect v4.2',
            timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
            status: 'Auto-Received'
          },
          {
            id: 'PO-8835-X',
            branch: 'Chicago Downtown',
            item: 'Strawberries',
            cases: 600,
            qualityScore: 98,
            markdown: '0%',
            verificationTag: 'Auto-Received: Verified Premium Quality by FreshDetect v4.2',
            timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
            status: 'Auto-Received'
          },
          {
            id: 'PO-7731-C',
            branch: 'West Loop',
            item: 'Organic Milk',
            cases: 200,
            qualityScore: 92,
            markdown: '0%',
            verificationTag: 'Auto-Received: Verified Premium Quality by FreshDetect v4.2',
            timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
            status: 'Auto-Received'
          }
        ];
        setItems(defaults);
        localStorage.setItem('freshguard-store-items', JSON.stringify(defaults));
      }
    } catch (e) {
      console.error("Failed to load store receiving items:", e);
    }
  };

  useEffect(() => {
    loadStoreItems();

    // Listen to storage events to auto-refresh state if other modules store data
    const handleStorageChange = () => {
      loadStoreItems();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleResetForDemo = () => {
    localStorage.removeItem('freshguard-store-items');
    loadStoreItems();
    setFeedback("Store inventory state reset to factory defaults.");
    setTimeout(() => setFeedback(null), 3000);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.verificationTag.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBranch = selectedBranch === 'All' || item.branch === selectedBranch;
      
      return matchesSearch && matchesBranch;
    });
  }, [items, searchQuery, selectedBranch]);

  const totalVolumeCalculated = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.cases, 0);
  }, [filteredItems]);

  const groupedItems = useMemo(() => {
    const normalItems: AutoReceivedItem[] = [];
    const bpoMap: Record<string, {
      parentBpoId: string;
      item: string;
      branch: string;
      totalCases: number;
      releases: Array<any>;
    }> = {};

    filteredItems.forEach((item: any) => {
      if (item.parentBpoId) {
        if (!bpoMap[item.parentBpoId]) {
          bpoMap[item.parentBpoId] = {
            parentBpoId: item.parentBpoId,
            item: 'Organic Hass Avocados (Blanket Contract)',
            branch: item.branch,
            totalCases: 0,
            releases: []
          };
        }
        bpoMap[item.parentBpoId].totalCases += item.cases;
        bpoMap[item.parentBpoId].releases.push(item);
      } else {
        normalItems.push(item);
      }
    });

    return {
      normalItems,
      bpoGroups: Object.values(bpoMap)
    };
  }, [filteredItems]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 overflow-y-auto">
      
      {/* Upper Brand / Info header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tracking-widest uppercase block">Autonomous Retail Nodes</span>
          <h1 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight mt-0.5">Store Auto-Receiving Logistics</h1>
          <p className="text-slate-500 text-xs mt-1">Real-time status of fresh logistics bypass lots routed directly to retail branches without manual DC hold times.</p>
        </div>

        <div className="flex gap-2.5">
          <button 
            onClick={handleResetForDemo}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
            title="Reset storage for demo testing"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Node Logs
          </button>

          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-400 rounded-lg px-3.5 py-1.5 flex items-center gap-2 text-xs font-mono font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
            AI Audit Chain Active
          </div>
        </div>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 rounded-xl border border-indigo-250 dark:border-indigo-900/60 text-xs font-mono flex items-center gap-2 shadow-sm"
          >
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{feedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-805 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-404">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Bypassed QA Batches</span>
            <StoreIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight">{filteredItems.length} Lots</h3>
            <p className="text-[10.5px] text-slate-400 mt-1">Frictionless auto-acceptance rate: <strong className="text-emerald-500">100%</strong></p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-805 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-404">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Distributed Volume</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight">{totalVolumeCalculated.toLocaleString()} Cases</h3>
            <p className="text-[10.5px] text-slate-400 mt-1">Assigned to <strong className="text-indigo-500">{branches.length - 1} metropolitan centers</strong></p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-805 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-404">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Target Store Markdown Override</span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-950 dark:text-slate-100 tracking-tight">-0% Base</h3>
            <p className="text-[10.5px] text-slate-400 mt-1">Calculated by <strong className="text-indigo-500">FreshDetect AI scoring matrix</strong></p>
          </div>
        </div>

      </div>

      {/* Main Filter & Table Area with CRISP 1px Borders */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-805 overflow-hidden shadow-sm">
        
        {/* Filtering Controls */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-950/20">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search incoming POs or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Branch Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto overflow-x-auto justify-end">
            <span className="text-[11px] text-slate-400 mr-2 uppercase font-mono font-bold hidden md:inline">Node Filter:</span>
            {branches.map(br => (
              <button
                key={br}
                onClick={() => setSelectedBranch(br)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap",
                  selectedBranch === br 
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-bold"
                    : "bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-350"
                )}
              >
                {br}
              </button>
            ))}
          </div>

        </div>

        {/* The Live Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/20 dark:bg-slate-950/10 border-b border-slate-100 dark:border-slate-800 text-left text-slate-450 dark:text-slate-500 font-mono text-[10px] uppercase font-bold">
                <th className="py-3.5 px-5 font-bold">Branch Node</th>
                <th className="py-3.5 px-5 font-bold">PO Number</th>
                <th className="py-3.5 px-5 font-bold">Item & Description</th>
                <th className="py-3.5 px-5 font-bold text-right">Volume (Cases)</th>
                <th className="py-3.5 px-5 font-bold text-center">Quality score</th>
                <th className="py-3.5 px-5 font-bold">AI System override certification</th>
                <th className="py-3.5 px-5 font-bold">Timestamp</th>
                <th className="py-3.5 px-5 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {groupedItems.bpoGroups.length === 0 && groupedItems.normalItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-5 text-center text-slate-450 dark:text-slate-505 font-mono text-xs">
                    No verified bypass shipments are stored under this branch node.
                  </td>
                </tr>
              ) : (
                <>
                  {/* BPO Groups with Metric Summaries and Nested Relational History Dropdowns */}
                  {groupedItems.bpoGroups.map(group => {
                    const isExpanded = !!expandedGroups[group.parentBpoId];
                    const latestTimestamp = group.releases.length > 0 
                      ? group.releases[0].timestamp 
                      : new Date().toISOString();
                    
                    return (
                      <React.Fragment key={group.parentBpoId}>
                        {/* Parent Master Contract Row */}
                        <tr 
                          className="bg-indigo-50/15 dark:bg-indigo-950/5 hover:bg-indigo-50/35 dark:hover:bg-indigo-950/10 font-sans border-l-4 border-indigo-500 transition-all cursor-pointer"
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [group.parentBpoId]: !prev[group.parentBpoId] }))}
                        >
                          {/* Branch Node */}
                          <td className="py-4 px-5 font-bold text-slate-900 dark:text-slate-200">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="text-[10.5px] uppercase tracking-wider font-extrabold">Multi-Branch Fleet</span>
                            </div>
                          </td>

                          {/* PO ID */}
                          <td className="py-4 px-5 font-mono font-black text-indigo-700 dark:text-indigo-400">
                            {group.parentBpoId}
                          </td>

                          {/* Item Name */}
                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1">
                              <span className="font-extrabold text-slate-900 dark:text-slate-150">{group.item}</span>
                              <span className="inline-flex max-w-max items-center px-2 py-0.5 mt-0.5 rounded text-[9.5px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-750 dark:text-indigo-400 border border-indigo-200/50">
                                {group.releases.length} Release Batches Synced
                              </span>
                            </div>
                          </td>

                          {/* Volume */}
                          <td className="py-4 px-5 font-mono font-black text-right text-indigo-700 dark:text-indigo-400 text-xs">
                            {group.totalCases.toLocaleString()} Cases Total
                          </td>

                          {/* Avg Score */}
                          <td className="py-4 px-5 text-center">
                            <span className="font-extrabold text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 font-mono">
                              98/100 Avg
                            </span>
                          </td>

                          {/* Verification Cert */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 font-mono text-[10px] font-bold">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>BPO Consolidated Blockchain Verification</span>
                            </div>
                          </td>

                          {/* Timestamp */}
                          <td className="py-4 px-5 text-slate-450 dark:text-slate-505 font-mono text-[10px]">
                            {new Date(latestTimestamp).toLocaleString()}
                          </td>

                          {/* Action Button */}
                          <td className="py-4 px-5 text-center">
                            <button
                              type="button"
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-650 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-sm transition-all"
                            >
                              <span>{isExpanded ? 'Hide' : 'Reveal'} Details</span>
                              <span>{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          </td>
                        </tr>

                        {/* Dropdown nested row containing sub-ledger */}
                        {isExpanded && (
                          <tr className="bg-slate-50/40 dark:bg-slate-950/20">
                            <td colSpan={8} className="p-0">
                              <div className="px-6 py-4 border-l-4 border-indigo-500 bg-indigo-50/5 dark:bg-slate-950/20 space-y-3">
                                <div className="text-[10px] uppercase font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400 pl-0.5">
                                  Historical Release Records Synced &amp; Stamped
                                </div>
                                <div className="border border-slate-200 dark:border-slate-805 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-950 font-bold border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase font-mono text-slate-400 dark:text-slate-500">
                                      <tr>
                                        <th className="py-2 px-4">Dispatched Release PO</th>
                                        <th className="py-2 px-4">Release Batch ID</th>
                                        <th className="py-2 px-4">Destination Store Node</th>
                                        <th className="py-2 px-4 text-right">Cases Received</th>
                                        <th className="py-2 px-4">Thermal Log Stamp</th>
                                        <th className="py-2 px-4">Received Timestamp</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans text-slate-800 dark:text-slate-200">
                                      {group.releases.map((rel: any) => (
                                        <tr key={rel.id + '-' + rel.branch} className="hover:bg-slate-55/10 dark:hover:bg-slate-850/40">
                                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{rel.poId || rel.id}</td>
                                          <td className="py-2.5 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">Batch #{rel.batchNum || '1'}</td>
                                          <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">{rel.branch}</td>
                                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{rel.cases.toLocaleString()} Cases</td>
                                          <td className="py-2.5 px-4 font-mono">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15">
                                              Approved: {rel.approvedTemp || '3.5°C'}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[9.5px]">{new Date(rel.timestamp).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Render Standalone Rows */}
                  {groupedItems.normalItems.map(item => (
                    <tr 
                      key={`${item.id}-${item.branch}`}
                      className="hover:bg-slate-50/40 dark:hover:bg-slate-850/20 font-sans transition-all"
                    >
                      {/* Branch Node */}
                      <td className="py-4 px-5 font-bold text-slate-900 dark:text-slate-205">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{item.branch}</span>
                        </div>
                      </td>

                      {/* PO */}
                      <td className="py-4 px-5 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {item.id}
                      </td>

                      {/* Item */}
                      <td className="py-4 px-5 font-bold text-slate-850 dark:text-slate-100">
                        {item.item}
                      </td>

                      {/* Volume */}
                      <td className="py-4 px-5 font-mono font-bold text-right text-slate-905 dark:text-slate-205">
                        {item.cases.toLocaleString()}
                      </td>

                      {/* Quality Score */}
                      <td className="py-4 px-5 text-center">
                        <span className="font-extrabold text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400 font-mono">
                          {item.qualityScore}/100
                        </span>
                      </td>

                      {/* Verification Tag */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 font-mono text-[10px] font-bold">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{item.verificationTag}</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-5 text-slate-450 dark:text-slate-505 font-mono text-[10px]">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-955/35 text-emerald-800 dark:text-emerald-305 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          {item.status === 'Auto-Reconciled' ? 'Auto-Reconciled ✓' : item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Table summary / disclaimer bottom */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-450 dark:text-slate-505 font-mono flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>FreshDetect v4.2 Autonomous Distribution Ledger Node</span>
          <span className="text-right">Synced in Real-time • Local Sourced Registry</span>
        </div>

      </div>

    </div>
  );
}
