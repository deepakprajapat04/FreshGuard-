import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';

const shrinkageTrends = [
  { month: 'Jul', waste: 45000, markdown: 20000 },
  { month: 'Aug', waste: 42000, markdown: 22000 },
  { month: 'Sep', waste: 38000, markdown: 25000 },
  { month: 'Oct', waste: 35000, markdown: 18000 },
  { month: 'Nov', waste: 30000, markdown: 15000 },
  { month: 'Dec', waste: 28000, markdown: 12000 },
];

const categoryData = [
  { name: 'Fresh Produce', value: 45 },
  { name: 'Meat & Chicken', value: 25 },
  { name: 'Dairy', value: 20 },
  { name: 'Bakery', value: 10 },
];
const COLORS = ['#10b981', '#f43f5e', '#3b82f6', '#f59e0b'];

export default function Reports() {
  const { persona } = usePersona();
  const isVendor = persona === 'vendor';

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isVendor ? 'My Product Performance' : 'Shrinkage & Wastage Reports'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isVendor ? 'Analyze your spoilage contribution and product grading patterns.' : 'Deep analytics into inventory loss, markdowns, and AI preventative impact.'}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Last 6 Months</option>
            <option>Last Quarter</option>
            <option>Year to Date</option>
          </select>
          <button className="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors">
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">
              {isVendor ? 'My Shrinkage Impact' : 'Total Shrinkage Value'}
            </h3>
            <div className="text-3xl font-bold text-slate-900">{isVendor ? '$14,200' : '$218,000'}</div>
          </div>
          <div className="flex items-center text-emerald-600 text-sm font-medium mt-4">
            <TrendingDown className="w-4 h-4 mr-1" /> -12.5% vs previous period
          </div>
        </div>
        {!isVendor && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-slate-500 text-sm font-medium mb-1">AI Prevented Loss (Est.)</h3>
              <div className="text-3xl font-bold text-slate-900">$84,500</div>
            </div>
            <div className="flex items-center text-emerald-600 text-sm font-medium mt-4">
              <TrendingUp className="w-4 h-4 mr-1" /> +22.0% efficiency
            </div>
          </div>
        )}
        <div className={cn("bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between bg-gradient-to-br from-rose-50 to-white", isVendor && "col-span-1 md:col-span-2")}>
          <div>
            <h3 className="text-rose-600 text-sm font-medium mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Highest Loss Category
            </h3>
            <div className="text-xl font-bold text-slate-900">Fresh Produce</div>
            <div className="text-sm text-slate-500">Accounts for 45% of total shrinkage</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Shrinkage vs Markdowns Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={shrinkageTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  formatter={(value) => `$${value.toLocaleString()}`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="waste" name="Spoilage & Waste" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="markdown" name="Markdowns" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Loss by Category</h3>
          <div className="flex-1 h-72 w-full min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={categoryData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={90}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {categoryData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip formatter={(value) => `${value}%`} />
                 <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '13px' }}/>
               </PieChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
