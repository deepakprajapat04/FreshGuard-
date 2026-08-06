/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Ban, 
  Leaf, 
  PackageSearch, 
  TrendingDown, 
  ScanLine, 
  AlertTriangle,
  Cpu,
  Loader2,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { DataTable, downloadExcelCsv, type DataTableColumn } from '../components/DataTable';
import { usePersona } from '../context/PersonaContext';
import { PageHeader, pageShellClass } from '../components/PageChrome';

// Baseline monthly shrinkage categories logs
const shrinkageData = [
  { month: 'Jan', freshProduce: 4.2, meat: 3.1, dairy: 1.5 },
  { month: 'Feb', freshProduce: 4.0, meat: 3.2, dairy: 1.4 },
  { month: 'Mar', freshProduce: 3.5, meat: 2.8, dairy: 1.6 },
  { month: 'Apr', freshProduce: 3.8, meat: 2.5, dairy: 1.3 },
  { month: 'May', freshProduce: 3.2, meat: 2.1, dairy: 1.2 },
  { month: 'Jun', freshProduce: 2.8, meat: 1.9, dairy: 1.0 },
];

const vendorPerformanceData = [
  { vendor: 'Global Farms', deliveryScore: 98, qualityScore: 95 },
  { vendor: 'Valley Meats', deliveryScore: 92, qualityScore: 88 },
  { vendor: 'Sunrise Dairy', deliveryScore: 99, qualityScore: 97 },
  { vendor: 'Ocean Catch', deliveryScore: 85, qualityScore: 90 },
];

// Vendor Dispatched Volume Output monthly logs
const vendorDispatchTrends = [
  { month: 'Jan', dispatchUnits: 120, target: 100 },
  { month: 'Feb', dispatchUnits: 154, target: 110 },
  { month: 'Mar', dispatchUnits: 140, target: 120 },
  { month: 'Apr', dispatchUnits: 185, target: 130 },
  { month: 'May', dispatchUnits: 210, target: 150 },
  { month: 'Jun', dispatchUnits: 250, target: 160 },
];

export default function Dashboard() {
  const { persona, setPersona } = usePersona();
  const isVendor = persona === 'vendor';

  // AI intelligence states
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [aiAlerts, setAiAlerts] = useState([
    {
      id: 'alert-1',
      title: "Flood Risk: Florida Route",
      description: "High probability of delay for 3 citrus shipments. Recommended reroute via Northern corridor (+12hrs).",
      type: "rose"
    },
    {
      id: 'alert-2',
      title: "Strike Alert: Port of LA",
      description: "Impending dockworker strike may affect 4 international frozen POs.",
      type: "amber"
    }
  ]);

  // Buyer Markdown dynamic processed logs
  const [markdowns, setMarkdowns] = useState([
    { id: 'mk-1', name: 'Organic Bananas', est: '2 Days', rec: '30%', risk: 'high', applied: false },
    { id: 'mk-2', name: 'Avocado Hass', est: '3 Days', rec: '15%', risk: 'medium', applied: false },
    { id: 'mk-3', name: 'Romaine Hearts', est: '1 Day', rec: '50%', risk: 'high', applied: false },
    { id: 'mk-4', name: 'Strawberries', est: '4 Days', rec: '0%', risk: 'low', applied: false },
  ]);

  // Vendor Pending Bids & SLA checkpoints interactive logs
  const [vendorSlas, setVendorSlas] = useState([
    { id: 'sla-1', type: 'SLA Checkpoint', title: 'Cold-Chain Thermal Tracking', detail: '99.1% Compliant', accent: 'Compliance certified • Dynamic sensor logging live', status: 'compliant' },
    { id: 'bid-1', type: 'Active Bid', title: 'Hass Avocados Supply allocation', detail: 'Bid Price: $14.20/case', accent: 'Under negotiation • FreshDetect score: 8.8/10', status: 'pending' },
    { id: 'sla-2', type: 'SLA Checkpoint', title: 'OTIF Fulfillment Window', detail: 'Target: 96.4%', accent: '98.2% Rolling score • Active on PO-2026-8842', status: 'compliant' },
    { id: 'bid-2', type: 'Active Bid', title: 'Organic Cucumber direct routing slot', detail: 'Bid Price: $9.80/case', accent: 'Approval pending • Scheduled delivery: Tuesday', status: 'pending' }
  ]);

  // 1. Trigger AI Threat Analysis core operation
  const handleTriggerAiAnalysis = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setToastMessage("AI Threat Analysis Complete");
      
      // Prevent duplicating the Midwest road closure warning
      setAiAlerts(prev => {
        if (prev.some(a => a.id === 'alert-3')) return prev;
        return [
          ...prev,
          {
            id: 'alert-3',
            title: "Transit Delay: Midwest I-90 Corridor Construction",
            description: "Midwest I-90 Corridor Construction • 3 shipments affected. Detouring to prevent cold-chain logging exposure.",
            type: "amber"
          }
        ];
      });

      setTimeout(() => setToastMessage(null), 5000);
    }, 1500);
  };

  /** Export Category Analytics Dashboard (CAD) as Excel-compatible CSV */
  const handleExportCad = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const headers = ['Section', 'Metric', 'Value', 'Detail'];
    const rows: string[][] = [];

    if (isVendor) {
      rows.push(
        ['KPI', 'Fulfillment Rate', '96.4%', '+1.2% this week'],
        ['KPI', 'Batch Freshness Score', '8.8/10', 'Premium Grade'],
        ['KPI', 'Active Disputes', '3', 'Review required'],
        ['KPI', 'Cold-Chain Integrity', '99.1%', 'Telemetry compliant']
      );
      vendorSlas.forEach((s) => {
        rows.push(['SLA / Bid', s.type, s.title, `${s.detail} · ${s.accent}`]);
      });
      vendorDispatchTrends.forEach((d) => {
        rows.push(['Dispatch Trend', d.month, String(d.dispatchUnits), `Target ${d.target}`]);
      });
    } else {
      rows.push(
        ['KPI', 'Shrinkage Rate', '2.8%', 'Fresh produce Jun'],
        ['KPI', 'QC Reject Rate', '1.4%', 'Multi-node'],
        ['KPI', 'OTIF', '97.2%', 'Rolling'],
        ['KPI', 'Active Markdown SKUs', String(markdowns.filter((m) => !m.applied && m.risk !== 'low').length), 'Pending apply']
      );
      shrinkageData.forEach((d) => {
        rows.push(
          ['Shrinkage', d.month, 'Fresh Produce', `${d.freshProduce}%`],
          ['Shrinkage', d.month, 'Meat', `${d.meat}%`],
          ['Shrinkage', d.month, 'Dairy', `${d.dairy}%`]
        );
      });
      vendorPerformanceData.forEach((v) => {
        rows.push(['Vendor Score', v.vendor, `Delivery ${v.deliveryScore}`, `Quality ${v.qualityScore}`]);
      });
      markdowns.forEach((m) => {
        rows.push(['Markdown', m.name, m.rec, `Shelf ${m.est} · Risk ${m.risk}${m.applied ? ' · Applied' : ''}`]);
      });
      aiAlerts.forEach((a) => {
        rows.push(['AI Alert', a.title, a.type, a.description]);
      });
    }

    downloadExcelCsv(`FreshGuard-CAD-${isVendor ? 'Vendor' : 'Buyer'}-${stamp}.xls`, headers, rows);
    setToastMessage('CAD export downloaded — Category Analytics Dashboard spreadsheet ready.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 2. Process Recommended Markdown Apply operation
  const handleApplyMarkdown = (id: string, name: string) => {
    setMarkdowns(prev => prev.map(m => m.id === id ? { ...m, applied: true } : m));
    setToastMessage(`Markdown accepted. Synchronizing automated POS discount pricing to retail store registers.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  type MarkdownRow = (typeof markdowns)[number];

  const markdownColumns: DataTableColumn<MarkdownRow>[] = [
    {
      key: 'name',
      label: 'SKU / Item',
      className: 'font-bold text-slate-900 dark:text-slate-100',
    },
    {
      key: 'est',
      label: 'Est. Shelf Life',
      filterType: 'select',
      render: (item) => (
        <span
          className={cn(
            'px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border',
            item.risk === 'high'
              ? 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 text-rose-700'
              : item.risk === 'medium'
                ? 'bg-amber-50 dark:bg-amber-950/25 border-amber-200 text-amber-700'
                : 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 text-emerald-700'
          )}
        >
          {item.est}
        </span>
      ),
    },
    {
      key: 'rec',
      label: 'Recommend markdown',
      className: 'font-bold text-slate-750 dark:text-slate-200',
    },
    {
      key: 'risk',
      label: 'Risk',
      filterType: 'select',
      defaultHidden: true,
    },
    {
      key: 'action',
      label: 'Action Gate',
      align: 'right',
      sortable: false,
      filterable: false,
      getValue: (item) => (item.applied ? 'Applied' : item.risk === 'low' ? 'Standard' : 'Pending'),
      render: (item) =>
        item.risk !== 'low' ? (
          item.applied ? (
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded font-bold font-mono text-[10px] uppercase">
              Applied ✓
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleApplyMarkdown(item.id, item.name)}
              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-black font-mono text-xs uppercase cursor-pointer border border-indigo-200 dark:border-indigo-900 px-3 py-1 bg-indigo-50/20 hover:bg-indigo-50/50 dark:bg-indigo-950 rounded transition-colors"
            >
              Apply
            </button>
          )
        ) : (
          <span className="text-slate-400 font-mono text-[9.5px]">Standard Pricing</span>
        ),
    },
  ];

  return (
    <div className={pageShellClass}>
      
      {/* Dynamic Success / Action Notification Toast Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 font-sans text-xs sm:text-sm font-extrabold px-6 py-4 rounded-xl shadow-2xl border bg-emerald-600 border-emerald-500 text-white flex items-center gap-3 w-11/12 max-w-2xl backdrop-blur-md transition-all duration-300"
          >
            <CheckCircle2 className="w-5 h-5 text-white shrink-0 animate-bounce" />
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
        eyebrow="FreshGuard Platform"
        title={isVendor ? 'Vendor Performance Dashboard' : 'Executive Dashboard'}
        subtitle={
          isVendor
            ? 'Real-time telemetry, OTIF delivery compliance, and active SLA checkpoints.'
            : 'Enterprise analytics monitor shrinkage, multi-node QC rejects, and smart retail pricing.'
        }
      >
          <div className="flex items-center gap-1 p-1 bg-[#0a1829] border border-sky-900/80 rounded-xl">
            <button
              onClick={() => setPersona('admin')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-tight transition-all cursor-pointer",
                !isVendor 
                  ? "bg-sky-600 text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Buyer View
            </button>
            <button
              onClick={() => setPersona('vendor')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-tight transition-all cursor-pointer",
                isVendor 
                  ? "bg-sky-600 text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Vendor View
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isVendor && (
              <button 
                onClick={handleTriggerAiAnalysis}
                disabled={isScanning}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-500/60 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scanning Supply-Chain Nodes...
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    Trigger AI Analysis
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCad}
              className="px-4 py-2.5 bg-white/10 border border-white/20 hover:bg-white/15 rounded-xl text-xs font-semibold font-mono text-white shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CAD
            </button>
          </div>
      </PageHeader>

      {/* Role-Based KPI Segment block */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={isVendor ? 'vendor-kpis' : 'buyer-kpis'}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {isVendor ? (
            <>
              <KPICard 
                title="Your Fulfillment Rate" 
                value="96.4%" 
                change="+1.2% this week" 
                trend="up"
                icon={PackageSearch}
                color="indigo"
              />
              <KPICard 
                title="Average Batch Freshness Score" 
                value="8.8/10" 
                change="Premium Grade" 
                trend="up"
                icon={Leaf}
                color="emerald"
              />
              <KPICard 
                title="Active Disputes / Claims" 
                value="3 Pending" 
                change="Review required" 
                trend="down"
                icon={AlertTriangle}
                color="rose"
              />
              <KPICard 
                title="Cold-Chain Integrity Rating" 
                value="99.1%" 
                change="Thermal Compliance" 
                trend="up"
                icon={ShieldAlert}
                color="emerald"
              />
            </>
          ) : (
            <>
              <KPICard 
                title="Total Shrinkage (YTD)" 
                value="$1.2M" 
                change="-12.5% this month" 
                trend="down"
                icon={TrendingDown}
                color="rose"
              />
              <KPICard 
                title="Fresh Produce QA Rejects" 
                value="4.2%" 
                change="-2.1% this month" 
                trend="down"
                icon={Ban}
                color="rose"
              />
              <KPICard 
                title="Avg. Shelf Life Predicted" 
                value="6.5 days" 
                change="+1.2 days" 
                trend="up"
                icon={Leaf}
                color="emerald"
              />
              <KPICard 
                title="Supplier OTIF Rate" 
                value="94.8%" 
                change="+0.5%" 
                trend="up"
                icon={PackageSearch}
                color="indigo"
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Main Charts & Disruption Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Main Chart Column (Buyer: Category Shrinkage, Vendor: Dispatched Volume Trends) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-md overflow-hidden flex flex-col justify-between">
          <div className="px-4 py-2 bg-[#0c1e36] text-white">
            <span className="text-[9px] font-extrabold text-sky-300 font-mono uppercase tracking-widest block">Analytics</span>
            <h3 className="text-xs font-black uppercase tracking-tight mt-0.5">
              {isVendor ? 'Dispatched Volume Trends' : 'Shrinkage by Category'}
            </h3>
          </div>
          <div className="p-4 flex flex-col justify-between flex-1">
          <AnimatePresence mode="wait">
            {!isVendor ? (
              <motion.div 
                key="buyer-charts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 w-full"
              >
                <div>
                  <span className="text-[9px] font-extrabold text-emerald-500 font-mono uppercase tracking-widest block">Waste Telemetry</span>
                  <h3 className="text-base font-black text-slate-950 dark:text-slate-100 uppercase tracking-tight">
                    Shrinkage by Category (%)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">6-month rolling average featuring direct micro-excursion sensors</p>
                </div>
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={shrinkageData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFresh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMeat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDairy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800/60" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Outfit, sans-serif' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Outfit, sans-serif' }} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid #e2e8f0', 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          boxShadow: '0 4px 12px -1px rgb(0 0 0 / 0.05)',
                          fontSize: '11px',
                          color: '#0f172a'
                        }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', paddingTop: '10px' }} />
                      <Area type="monotone" dataKey="freshProduce" name="Fresh Produce" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorFresh)" dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="meat" name="Meat & Seafood" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMeat)" dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="dairy" name="Dairy Lot" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDairy)" dot={{ r: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="vendor-charts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 w-full"
              >
                <div>
                  <span className="text-[9px] font-extrabold text-purple-500 font-mono uppercase tracking-widest block font-bold">Inbound Volume</span>
                  <h3 className="text-base font-black text-slate-950 dark:text-slate-100 uppercase tracking-tight">
                    Your Dispatched Volume Output Trends
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Monthly dispatched cases vs Contracted SLA target levels</p>
                </div>
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={vendorDispatchTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDispatch" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800/65" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Outfit, sans-serif' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'Outfit, sans-serif' }} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid #e2e8f0', 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          boxShadow: '0 4px 12px -1px rgb(0 0 0 / 0.05)',
                          fontSize: '11px',
                          color: '#0f172a'
                        }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', paddingTop: '10px' }} />
                      <Area type="monotone" dataKey="dispatchUnits" name="Dispatched Cases (Hunds)" stroke="#8b5cf6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDispatch)" dot={{ r: 3 }} />
                      <Area type="monotone" dataKey="target" name="Contract SLA Target" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 4" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>

        {/* AI Disruption Intelligence Sidebar Panel with interactive newly appended alert */}
        <div className="bg-gradient-to-br from-[#0c1e36] via-[#123556] to-[#0a4d68] border border-sky-900/50 rounded-xl p-4 text-white relative flex flex-col justify-between shadow-lg overflow-hidden min-h-[280px]">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-sky-500 rounded-full blur-[90px] opacity-20"></div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-emerald-400 shrink-0" />
                <h3 className="font-bold tracking-wider text-xs uppercase font-mono">AI Disruption Intelligence</h3>
              </div>
              <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-350 border border-emerald-400/20 px-2 py-0.5 rounded uppercase">Threat Guard Live</span>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              <AnimatePresence mode="popLayout">
                {aiAlerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    layoutId={alert.id}
                    initial={{ opacity: 0, x: -10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/5 hover:bg-white/10 p-3.5 rounded-xl border border-white/10 backdrop-blur-md transition-all duration-200"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-1.5 rounded mt-0.5 shrink-0",
                        alert.type === "rose" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                      )}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100">{alert.title}</div>
                        <div className="text-[10.5px] text-sky-200 mt-1 leading-normal font-sans">{alert.description}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4">
            <button className="w-full py-2.5 bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/25 rounded-xl text-xs font-bold font-mono uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5">
              <span>View All Active Gate Alarms</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Role-Based Bottom Layout Segment (Buyer: Recommended Markdowns Table & Vendor Index, Vendor: SLA Checkpoints List) */}
      <AnimatePresence mode="wait">
        {!isVendor ? (
          <motion.div 
            key="buyer-bottom-grid"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {/* Vendor Performance Index (Bar Graph) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden flex flex-col justify-between">
              <div className="px-5 py-3 bg-[#0c1e36] text-white">
                <h3 className="text-xs font-black font-mono uppercase tracking-wider text-sky-200">Performance board</h3>
              </div>
              <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <span className="text-[9px] font-extrabold text-blue-500 font-mono uppercase tracking-widest block font-bold">Comparative scorecard</span>
                <h3 className="text-base font-black text-slate-950 dark:text-slate-100 uppercase tracking-tight">Vendor Performance Index</h3>
                <p className="text-xs text-slate-500 font-medium">Visualizing Quality Score vs Delivery OTIF values</p>
              </div>
              
              <div className="h-[250px] w-full mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorPerformanceData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" className="dark:stroke-slate-800/40" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748B', fontFamily: 'Outfit, sans-serif' }} />
                    <YAxis dataKey="vendor" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 'bold' }} width={80} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif' }} />
                    <Bar dataKey="qualityScore" name="Quality Rating (%)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={8} />
                    <Bar dataKey="deliveryScore" name="Delivery OTIF (%)" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </div>
            </div>

            {/* Recent Markdowns Table (Buyer Actionable Block) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden flex flex-col">
              <DataTable
                data={markdowns}
                columns={markdownColumns}
                rowKey={(item) => item.id}
                title="Recent Markdowns Recommended"
                subtitle="Action items · FreshDetect shelf-life scoring"
                excelFileName="markdown-recommendations.xls"
                emptyMessage="No markdown recommendations."
                initialFilterOpen={false}
                className="max-h-[360px]"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="vendor-bottom-grid"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            {/* Your Pending Bids & Active SLA Checkpoints (Vendor Actionable Section) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
              <div className="px-5 py-3 bg-[#0c1e36] text-white">
                <h3 className="text-xs font-black font-mono uppercase tracking-wider text-sky-200">Vendor SLA & bids</h3>
              </div>
              <div className="p-6 border-b border-slate-150 dark:border-slate-805 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <span className="text-[9px] font-extrabold text-purple-500 font-mono uppercase tracking-widest block font-bold">Operational compliance</span>
                  <h3 className="text-base font-black text-slate-950 dark:text-slate-100 uppercase tracking-tight">Your Pending Bids &amp; Active SLA Checkpoints</h3>
                  <p className="text-xs text-slate-500 font-medium">Fulfillment benchmarks, direct pricing bids, and quality assurance checkpoints</p>
                </div>
                <span className="text-[9.5px] font-mono text-indigo-505 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 px-2.5 py-1 rounded">
                  Pending Checklist: {vendorSlas.length}
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendorSlas.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 flex items-start gap-3.5 hover:shadow-xs transition-shadow"
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0 mt-0.5",
                      item.status === 'compliant' 
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-450" 
                        : "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-450"
                    )}>
                      {item.type === 'SLA Checkpoint' ? (
                        <ShieldCheck className="w-4.5 h-4.5" />
                      ) : (
                        <FileSpreadsheet className="w-4.5 h-4.5" />
                      )}
                    </div>
                    
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-slate-400">{item.type}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase border",
                          item.status === 'compliant'
                            ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-250"
                            : "bg-amber-50 dark:bg-amber-955 text-amber-700 dark:text-amber-400 border-amber-250"
                        )}>
                          {item.detail}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
                      <p className="text-[10.5px] text-slate-500 font-medium">{item.accent}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Compact Sub-component: KPICard with navy theme matching Logistics
function KPICard({ title, value, change, trend, icon: Icon, color }: any) {
  const isPositive = trend === 'up';
  const valueTone =
    color === 'emerald' ? 'text-emerald-300' :
    color === 'rose' ? 'text-rose-300' :
    'text-sky-300';
  const barTone =
    color === 'emerald' ? 'bg-emerald-400' :
    color === 'rose' ? 'bg-rose-400' :
    'bg-sky-400';
  const accent =
    color === 'emerald' ? 'from-emerald-500/20' :
    color === 'rose' ? 'from-rose-500/20' :
    'from-sky-500/20';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl px-3 py-2.5 shadow-md border border-slate-700/80 group"
      style={{ backgroundColor: '#0f2744' }}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', accent)} />
      <div className="relative">
        <div className="flex justify-between items-start mb-2">
          <div className="p-1.5 rounded-lg bg-white/5 text-slate-200 border border-white/10">
            <Icon className="w-3.5 h-3.5 shrink-0" />
          </div>
          
          <div className={cn("flex items-center text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-full border",
            isPositive 
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" 
              : "bg-rose-500/15 border-rose-500/40 text-rose-300"
          )}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {change}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-slate-400 text-[9px] font-bold font-mono uppercase tracking-wider">{title}</h4>
            <span className={cn('h-1 w-6 rounded-full', barTone)} />
          </div>
          <div className={cn('text-xl font-black mt-0.5 tracking-tight', valueTone)}>{value}</div>
        </div>
      </div>
    </motion.div>
  );
}
