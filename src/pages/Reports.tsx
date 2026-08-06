import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, Legend, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { usePersona } from '../context/PersonaContext';
import { PageHeader, Panel, StatCard, pageShellClass } from '../components/PageChrome';
import { cn } from '../lib/utils';

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
const COLORS = ['#10b981', '#f43f5e', '#38bdf8', '#f59e0b'];

export default function Reports() {
  const { persona } = usePersona();
  const isVendor = persona === 'vendor';

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="Analytics Ledger"
        title={isVendor ? 'My Product Performance' : 'Shrinkage & Wastage Reports'}
        subtitle={
          isVendor
            ? 'Analyze your spoilage contribution and product grading patterns.'
            : 'Deep analytics into inventory loss, markdowns, and AI preventative impact.'
        }
      >
        <select className="bg-[#0a1829] border border-sky-900/80 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500">
          <option>Last 6 Months</option>
          <option>Last Quarter</option>
          <option>Year to Date</option>
        </select>
        <button className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-medium text-white shadow-sm transition-colors">
          Export PDF
        </button>
      </PageHeader>

      <div className={cn('grid grid-cols-1 gap-3', isVendor ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
        <StatCard
          label={isVendor ? 'My Shrinkage Impact' : 'Total Shrinkage Value'}
          value={isVendor ? '$14,200' : '$218,000'}
          sub={
            <span className="inline-flex items-center text-emerald-300">
              <TrendingDown className="w-3.5 h-3.5 mr-1" /> -12.5% vs previous period
            </span>
          }
          tone="sky"
        />
        {!isVendor && (
          <StatCard
            label="AI Prevented Loss (Est.)"
            value="$84,500"
            sub={
              <span className="inline-flex items-center text-emerald-300">
                <TrendingUp className="w-3.5 h-3.5 mr-1" /> +22.0% efficiency
              </span>
            }
            tone="emerald"
          />
        )}
        <StatCard
          label="Highest Loss Category"
          value="Fresh Produce"
          sub={
            <span className="inline-flex items-center gap-1 text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5" /> 45% of total shrinkage
            </span>
          }
          tone="rose"
          className={isVendor ? 'md:col-span-1' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Panel title="Shrinkage vs Markdowns Trend" subtitle="Trailing six-month performance">
          <div className="p-3.5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={shrinkageTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `$${val / 1000}k`} />
                <Tooltip
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="waste" name="Spoilage & Waste" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="markdown" name="Markdowns" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Loss by Category" subtitle="Share of total shrinkage">
          <div className="p-3.5 h-72 w-full min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
