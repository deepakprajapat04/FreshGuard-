/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Info,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass } from '../components/PageChrome';
import { DataTable, type DataTableColumn } from '../components/DataTable';

interface AutoReceivedItem {
  id: string; // PO number or gen id
  branch: string;
  item: string;
  cases: number;
  qualityScore: number;
  markdown: string;
  verificationTag: string;
  timestamp: string;
  status: 'Auto-Received' | 'Pending Storage';
}

export default function Store() {
  const [items, setItems] = useState<AutoReceivedItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [feedback, setFeedback] = useState<string | null>(null);

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
    return items.filter((item) => {
      const matchesBranch = selectedBranch === 'All' || item.branch === selectedBranch;
      return matchesBranch;
    });
  }, [items, selectedBranch]);

  const totalVolumeCalculated = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.cases, 0);
  }, [filteredItems]);

  const storeColumns: DataTableColumn<AutoReceivedItem>[] = [
    {
      key: 'branch',
      label: 'Branch Node',
      filterType: 'select',
      filterOptions: branches.filter((b) => b !== 'All'),
      render: (item) => (
        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-200">
          <MapPin className="w-3.5 h-3.5 text-[#4684AD] shrink-0" />
          <span>{item.branch}</span>
        </div>
      ),
    },
    {
      key: 'id',
      label: 'PO Number',
      className: 'font-mono font-bold text-slate-700 dark:text-slate-300',
    },
    {
      key: 'item',
      label: 'Item & Description',
      className: 'font-semibold text-slate-850 dark:text-slate-100',
    },
    {
      key: 'cases',
      label: 'Volume (Cases)',
      align: 'right',
      getValue: (r) => r.cases,
      render: (r) => <span className="font-mono font-bold">{r.cases.toLocaleString()}</span>,
    },
    {
      key: 'qualityScore',
      label: 'Quality score',
      align: 'center',
      getValue: (r) => r.qualityScore,
      render: (r) => (
        <span className="font-extrabold text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-mono">
          {r.qualityScore}/100
        </span>
      ),
    },
    {
      key: 'verificationTag',
      label: 'AI certification',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-[#2F5472] dark:text-blue-300 font-mono text-[10px] font-bold">
          <Sparkles className="w-3.5 h-3.5 text-[#4684AD] shrink-0" />
          <span>{r.verificationTag}</span>
        </div>
      ),
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      getValue: (r) => r.timestamp,
      render: (r) => (
        <span className="text-slate-450 dark:text-slate-505 font-mono text-[10px]">
          {new Date(r.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      filterType: 'select',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 font-mono">
          <CheckCircle2 className="w-3 h-3" />
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="Autonomous Retail Nodes"
        title="Store Auto-Receiving Logistics"
        subtitle="Real-time status of fresh logistics bypass lots routed directly to retail branches without manual DC hold times."
      >
        <button
          onClick={handleResetForDemo}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs font-mono font-bold hover:bg-slate-50 transition-colors cursor-pointer text-slate-700 dark:bg-white/10 dark:border-white/20 dark:hover:bg-white/15 dark:text-white"
          title="Reset storage for demo testing"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Node Logs
        </button>
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/40 dark:text-emerald-300 rounded-lg px-3.5 py-1.5 flex items-center gap-2 text-xs font-mono font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
          AI Audit Chain Active
        </div>
      </PageHeader>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-[#C0D5E5]/30 dark:bg-sky-950/40 text-sky-900 dark:text-[#C0D5E5] rounded-xl border border-[#86A8C2]/50 dark:border-slate-700 text-xs font-mono flex items-center gap-2 shadow-sm"
          >
            <Info className="w-4 h-4 text-[#4684AD] shrink-0" />
            <span>{feedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Bypassed QA Batches"
          value={`${filteredItems.length} Lots`}
          sub={<>Frictionless auto-acceptance: <strong className="text-emerald-600 dark:text-emerald-300">100%</strong></>}
          tone="emerald"
        />
        <StatCard
          label="Distributed Volume"
          value={`${totalVolumeCalculated.toLocaleString()} Cases`}
          sub={<>Assigned to <strong className="text-[#4684AD] dark:text-[#C0D5E5]">{branches.length - 1} metro centers</strong></>}
          tone="sky"
        />
        <StatCard
          label="Target Store Markdown Override"
          value="-0% Base"
          sub={<>Calculated by <strong className="text-cyan-600 dark:text-cyan-300">FreshDetect AI</strong></>}
          tone="cyan"
        />
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900">
        <DataTable
          data={filteredItems}
          columns={storeColumns}
          rowKey={(r) => `${r.id}-${r.branch}`}
          title="Branch receiving ledger"
          subtitle="FreshDetect v4.2 autonomous distribution node"
          excelFileName="store-receiving-ledger.xls"
          emptyMessage="No verified bypass shipments are stored under this branch node."
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-mono font-bold hidden sm:inline">
                Node:
              </span>
              {branches.map((br) => (
                <button
                  key={br}
                  onClick={() => setSelectedBranch(br)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap border',
                    selectedBranch === br
                      ? 'bg-[#4684AD] border-[#4684AD] text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-white/5 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10'
                  )}
                >
                  {br}
                </button>
              ))}
            </div>
          }
        />
      </div>
    </div>
  );
}
