/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
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
import { usePersona } from '../context/PersonaContext';

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

interface DisruptionArticle {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function Dashboard() {
  const { persona, setPersona } = usePersona();
  const isVendor = persona === 'vendor';

  // Live market disruption news feed (News API via backend, mock fallback)
  const [newsArticles, setNewsArticles] = useState<DisruptionArticle[]>([]);
  const [newsIsLive, setNewsIsLive] = useState(false);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/news/disruptions')
      .then(res => res.json())
      .then(data => {
        if (cancelled || !data.success) return;
        setNewsArticles(data.articles || []);
        setNewsIsLive(Boolean(data.liveData));
      })
      .catch(err => console.error('Disruption news fetch failed:', err))
      .finally(() => { if (!cancelled) setNewsLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
    { id: 'mk-1', name: 'Organic Bananas', category: 'Fresh Fruit', demandVelocity: 'High', remainingDays: 2, risk: 'high', applied: false },
    { id: 'mk-2', name: 'Avocado Hass', category: 'Produce', demandVelocity: 'Medium', remainingDays: 3, risk: 'medium', applied: false },
    { id: 'mk-3', name: 'Romaine Hearts', category: 'Leafy Greens', demandVelocity: 'High', remainingDays: 1, risk: 'high', applied: false },
    { id: 'mk-4', name: 'Strawberries', category: 'Berries', demandVelocity: 'Low', remainingDays: 4, risk: 'low', applied: false },
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

  // 2. Process Recommended Markdown Apply operation
  const handleApplyMarkdown = (id: string, name: string) => {
    setMarkdowns(prev => prev.map(m => m.id === id ? { ...m, applied: true } : m));
    setToastMessage(`Markdown accepted. Synchronizing automated POS discount pricing to retail store registers.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div id="dashboard-root" className="p-4 sm:p-6 lg:p-8 space-y-6 w-full mx-auto bg-slate-50 text-[#0F172A] min-h-screen relative overflow-y-auto">
      
      {/* Dynamic Success / Action Notification Toast Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            id="dashboard-toast"
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

      {/* Header Panel with View Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <span className="text-[10px] font-extrabold text-indigo-600 font-mono tracking-widest uppercase block">FreshGuard Platform</span>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight mt-0.5">
            {isVendor ? 'Vendor Performance Dashboard' : 'Executive Dashboard'}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {isVendor 
              ? 'Real-time telemetry, OTIF delivery compliance, and active SLA checkpoints.' 
              : 'Enterprise analytics monitor shrinkage, multi-node QC rejects, and smart retail pricing.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isVendor && (
            <button 
              id="btn-run-intelligence"
              onClick={handleTriggerAiAnalysis}
              disabled={isScanning}
              className="px-5 py-2.5 bg-[#F0F5FF] border border-[#BFDBFE] hover:bg-[#DBEAFE] hover:text-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed text-[#1E40AF] rounded-full text-xs font-semibold font-sans uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer outline-none"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Scanning supply...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  <span>Run intelligence analysis</span>
                </>
              )}
            </button>
          )}
          <button 
            id="btn-export-manifest" 
            className="px-5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] hover:text-[#334155] text-[#475569] rounded-full text-xs font-semibold font-sans uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer outline-none"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>Export manifest ledger</span>
          </button>
        </div>
      </div>

      {/* Role-Based KPI Segment block */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={isVendor ? 'vendor-kpis' : 'buyer-kpis'}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart Column (Buyer: Category Shrinkage, Vendor: Dispatched Volume Trends) */}
        <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-[6px] hover:[box-shadow:0_10px_20px_rgba(15,23,42,0.05)] select-none">
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
                  <span className="text-[9px] font-extrabold text-emerald-605 font-mono uppercase tracking-widest block">Waste Telemetry</span>
                  <h3 className="text-base font-black text-[#0F172A] uppercase tracking-tight">
                    Shrinkage by Category (%)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">6-month rolling average featuring direct micro-excursion sensors</p>
                </div>
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={shrinkageData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFresh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMeat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#71717A" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#71717A" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDairy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#475569" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#475569" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} />
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
                      <Legend wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 'bold', color: '#64748B', paddingTop: '12px' }} />
                      <Area type="monotone" dataKey="freshProduce" name="Fresh Produce" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorFresh)" dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="meat" name="Meat & Seafood" stroke="#71717A" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMeat)" dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="dairy" name="Dairy Lot" stroke="#475569" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDairy)" dot={{ r: 2 }} />
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
                  <span className="text-[9px] font-extrabold text-indigo-600 font-mono uppercase tracking-widest block font-bold">Inbound Volume</span>
                  <h3 className="text-base font-black text-[#0F172A] uppercase tracking-tight">
                    Your Dispatched Volume Output Trends
                  </h3>
                  <p className="text-xs text-slate-500 font-medium font-sans">Monthly dispatched cases vs Contracted SLA target levels</p>
                </div>
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={vendorDispatchTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDispatch" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8F9FEE" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#8F9FEE" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'monospace' }} />
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
                      <Legend wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 'bold', color: '#64748B', paddingTop: '12px' }} />
                      <Area type="monotone" dataKey="dispatchUnits" name="Dispatched Cases (Hunds)" stroke="#6366f1" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDispatch)" dot={{ r: 3 }} />
                      <Area type="monotone" dataKey="target" name="Contract SLA Target" stroke="#475569" strokeWidth={1} strokeDasharray="4 4" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Disruption Intelligence Sidebar Panel with interactive newly appended alert */}
        <motion.div 
          whileHover={{ y: -6, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.05)" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden min-h-[350px] transition-all duration-300"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-[#64748B] shrink-0" />
                <h3 className="font-bold tracking-wider text-xs uppercase font-mono text-[#475569]">Disruption Intelligence Pipeline</h3>
              </div>
              <span className="text-[8px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded uppercase">Threat Guard Live</span>
            </div>

            <div className="space-y-0 divide-y divide-[#F1F5F9] max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              <AnimatePresence mode="popLayout">
                {aiAlerts.map((alert, index) => {
                  const isRouteRisk = alert.title.toLowerCase().includes("route") || alert.title.toLowerCase().includes("flood");
                  return (
                    <motion.div
                      key={alert.id}
                      layoutId={alert.id}
                      initial={{ opacity: 0, x: -10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn("py-3", index === 0 ? "pt-0" : "")}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-sm shrink-0",
                            isRouteRisk 
                              ? "bg-amber-50 text-amber-750 border border-amber-200" 
                              : "bg-rose-50 text-rose-750 border border-rose-200"
                          )}>
                            {isRouteRisk ? "Route Risk" : "Delay Alert"}
                          </span>
                          <span className="text-xs font-bold text-[#0F172A]">{alert.title}</span>
                        </div>
                        <p className="text-xs text-[#334155] leading-relaxed font-sans font-medium pl-0.5">
                          {alert.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-4 border-t border-[#F1F5F9] mt-4">
            <button className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-700 uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <span>View All Active Gate Alarms</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </motion.div>

      </div>

      {/* Live Market Disruption News Feed (News API integration) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -6, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.05)" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden transition-all duration-300"
      >
        <div className="p-6 border-b border-[#F1F5F9] bg-slate-50/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <span className="text-[9px] font-extrabold text-[#4F46E5] font-mono uppercase tracking-widest block font-bold">External intelligence</span>
            <h3 className="text-base font-black text-[#0F172A] uppercase tracking-tight">Market Disruption News Feed</h3>
            <p className="text-xs text-slate-500 font-medium font-sans">Supply-chain headlines that may affect inbound shipments and vendor reliability</p>
          </div>
          <span className={cn(
            "text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase border self-start sm:self-auto",
            newsIsLive
              ? "bg-emerald-50 text-emerald-700 border-emerald-250"
              : "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {newsIsLive ? 'Live News Wire' : 'Sample Feed — add NEWS_API_KEY to go live'}
          </span>
        </div>

        <div className="divide-y divide-[#F1F5F9]">
          {newsLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning disruption wires...
            </div>
          ) : newsArticles.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono uppercase tracking-widest">
              No disruption headlines available
            </div>
          ) : (
            newsArticles.slice(0, 6).map((article, idx) => (
              <div key={idx} className="px-6 py-3.5 flex items-start gap-3 hover:bg-slate-50/40 transition-colors">
                <span className={cn(
                  "mt-0.5 px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase border shrink-0",
                  article.severity === 'HIGH' ? "bg-rose-50 text-rose-700 border-rose-200" :
                  article.severity === 'MEDIUM' ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-emerald-50 text-emerald-700 border-emerald-250"
                )}>
                  {article.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] leading-snug">{article.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                    <span className="font-semibold">{article.source}</span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{new Date(article.publishedAt).toLocaleString()}</span>
                  </div>
                </div>
                {article.url && article.url !== '#' && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Open full article"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Role-Based Bottom Layout Segment (Buyer: Recommended Markdowns Table & Vendor Index, Vendor: SLA Checkpoints List) */}
      <AnimatePresence mode="wait">
        {!isVendor ? (
          <motion.div 
            key="buyer-bottom-grid"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Vendor Performance Index (Bar Graph) */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-[6px] hover:[box-shadow:0_10px_20px_rgba(15,23,42,0.05)] select-none">
              <div>
                <span className="text-[9px] font-extrabold text-[#4F46E5] font-mono uppercase tracking-widest block font-bold">Comparative scorecard</span>
                <h3 className="text-base font-black text-[#0F172A] uppercase tracking-tight">Vendor Performance Index</h3>
                <p className="text-xs text-slate-500 font-medium font-sans">Visualizing Quality Score vs Delivery OTIF values</p>
              </div>
              
              <div className="h-[250px] w-full mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorPerformanceData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748B', fontFamily: 'monospace' }} />
                    <YAxis dataKey="vendor" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B', fontWeight: 'bold' }} width={80} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: 'monospace' }} />
                    <Bar dataKey="qualityScore" name="Quality Rating (%)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={8} />
                    <Bar dataKey="deliveryScore" name="Delivery OTIF (%)" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Markdowns Table (Buyer Actionable Block) */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-[6px] hover:[box-shadow:0_10px_20px_rgba(15,23,42,0.05)]">
              <div className="p-6 border-b border-[#F1F5F9] flex justify-between items-center bg-slate-50/20">
                <div>
                  <span className="text-[9px] font-extrabold text-[#4F46E5] font-mono uppercase tracking-widest block font-bold">Action items</span>
                  <h3 className="text-base font-black text-[#0F172A] uppercase tracking-tight">Recent Markdowns Recommended</h3>
                  <p className="text-xs text-slate-500 font-medium font-sans">Automated POS discount suggestions to reduce retail shrink</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto max-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] text-slate-500 font-bold font-mono uppercase border-b border-[#E2E8F0] sticky top-0">
                    <tr>
                      <th className="px-6 py-4">SKU / Item</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Demand Velocity</th>
                      <th className="px-6 py-4">Proximity to Spoilage</th>
                      <th className="px-6 py-4 text-center">Recommend Markdown</th>
                      <th className="px-6 py-4 text-right">Action Gate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {markdowns.map((item) => {
                      const dynamicDiscount = item.remainingDays === 1 ? '50%' : item.remainingDays === 2 ? '30%' : item.remainingDays === 3 ? '15%' : '0%';
                      return (
                        <tr 
                          key={item.id} 
                          className={cn(
                            "transition-all duration-300 hover:bg-slate-50/40",
                            item.applied ? "opacity-50" : ""
                          )}
                        >
                          <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium font-sans">{item.category}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase",
                              item.demandVelocity === 'High' ? "text-indigo-600 bg-indigo-50" : "text-amber-600 bg-amber-50"
                            )}>
                              {item.demandVelocity} Velocity
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border",
                              item.risk === 'high' ? "bg-rose-50 border-rose-200 text-rose-750" :
                              item.risk === 'medium' ? "bg-amber-50 border-amber-200 text-amber-750" :
                              "bg-emerald-50 border-emerald-250 text-emerald-750"
                            )}>
                              {item.remainingDays} Day{item.remainingDays > 1 ? 's' : ''} Left
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-extrabold text-slate-800">{dynamicDiscount}</td>
                          <td className="px-6 py-4 text-right">
                            {item.risk !== 'low' ? (
                              item.applied ? (
                                <span className="px-2.5 py-1 bg-emerald-55/65 text-emerald-700 border border-emerald-200 rounded-lg font-black font-mono text-[9.5px] uppercase tracking-wider">
                                  Pricing Synced ✓
                                </span>
                              ) : (
                                <button 
                                  onClick={() => handleApplyMarkdown(item.id, item.name)}
                                  className="text-indigo-600 hover:text-indigo-800 font-black font-mono text-xs uppercase cursor-pointer border border-[#E2E8F0] px-3 py-1 bg-white hover:bg-slate-50 rounded transition-colors"
                                >
                                  Apply
                                </button>
                              )
                            ) : (
                              <span className="text-slate-400 font-mono text-[9.5px]">Standard Pricing</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden transition-all duration-300 ease-out hover:-translate-y-[6px] hover:[box-shadow:0_10px_20px_rgba(15,23,42,0.05)]">
              <div className="p-6 border-b border-[#F1F5F9] bg-slate-50/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <span className="text-[9px] font-extrabold text-[#4F46E5] font-mono uppercase tracking-widest block font-bold">Operational compliance</span>
                  <h3 className="text-base font-black text-[#0F172A] uppercase tracking-tight">Your Pending Bids &amp; Active SLA Checkpoints</h3>
                  <p className="text-xs text-slate-500 font-medium">Fulfillment benchmarks, direct pricing bids, and quality assurance checkpoints</p>
                </div>
                <span className="text-[9.5px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded">
                  Pending Checklist: {vendorSlas.length}
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendorSlas.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-xl border border-[#E2E8F0] bg-slate-50/10 flex items-start gap-3.5 hover:bg-slate-50/40 transition-colors"
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0 mt-0.5",
                      item.status === 'compliant' 
                        ? "bg-emerald-50 text-emerald-600" 
                        : "bg-amber-50 text-amber-600"
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
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {item.detail}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
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

// Compact Sub-component: KPICard with premium micro-shadow and border system
function KPICard({ title, value, change, trend, icon: Icon, color }: any) {
  const isPositive = trend === 'up';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.05)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-[#FFFFFF] rounded-xl p-5 border border-[#E2E8F0] relative overflow-hidden group transition-all duration-300 select-none cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <Icon className="w-5 h-5 text-slate-500 shrink-0" />
      </div>

      <div className="space-y-1.5">
        <h4 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider font-mono">{title}</h4>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-[#0F172A] font-mono tracking-tight">{value}</span>
          <span className={cn(
            "text-xs font-semibold font-mono whitespace-nowrap",
            isPositive ? "text-emerald-600" : "text-[#E11D48]"
          )}>
            {change.startsWith('-') || change.startsWith('+') ? change.split(' ')[0] : change}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
