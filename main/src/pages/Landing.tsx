import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ScanLine,
  ShoppingCart,
  Map,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  Thermometer,
  Truck,
  ArrowRight,
  LogIn,
  UserPlus,
  Leaf,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: ShoppingCart, title: 'Smart Procurement & Bidding', desc: 'Publish fresh-produce requirements, collect vendor quotations and award multi-vendor split contracts in minutes.' },
  { icon: Map, title: 'Live Logistics Tracking', desc: 'Follow every reefer shipment with GPS routing, ETA, and real-time cold-chain temperature telemetry.' },
  { icon: ScanLine, title: 'AI Quality Control', desc: 'Scan inbound produce for freshness, defects and shelf-life — automatically routing rejects to disputes.' },
  { icon: AlertTriangle, title: 'Claims & Wastage Recovery', desc: 'File temperature-excursion and damage claims against vendors with evidence-backed chargebacks.' },
  { icon: BarChart3, title: 'Shrinkage Analytics', desc: 'Track spoilage, recovery value and supplier performance across your entire cold-chain network.' },
  { icon: Thermometer, title: 'Cold-Chain Monitoring', desc: 'Continuous SLA enforcement on temperature and humidity from harvest gate to distribution center.' },
];

const STATS = [
  { value: '32%', label: 'Less spoilage waste' },
  { value: '$142K+', label: 'Claims recovered' },
  { value: '24/7', label: 'Cold-chain monitoring' },
  { value: '98%', label: 'On-time-in-full rate' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const goAuth = (mode: 'login' | 'signup') => navigate(`/auth?mode=${mode}`);
  const enterApp = () => navigate('/dashboard');

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden">
      {/* Top navigation */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">FreshGuard</span>
          </div>

          {/* Top-right auth buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <button
                onClick={enterApp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => goAuth('login')}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Login
                </button>
                <button
                  onClick={() => goAuth('signup')}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <UserPlus className="w-4 h-4" /> Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-white to-white" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-6">
              <Leaf className="w-3.5 h-3.5" /> Cold-Chain Intelligence Platform
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Stop fresh produce <span className="text-emerald-600">spoilage</span> before it costs you.
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-2xl">
              FreshGuard is an end-to-end platform for procuring, tracking and quality-controlling
              perishable goods — from vendor bidding and live reefer logistics to AI freshness
              inspection and automated wastage claims.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => goAuth('signup')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25"
              >
                Get Started Free <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => goAuth('login')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 transition-colors"
              >
                <LogIn className="w-5 h-5" /> I already have an account
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-400">Login with your email or phone number — your data is securely stored.</p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="text-3xl font-extrabold text-emerald-600">{s.value}</div>
                <div className="mt-1 text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">One platform for the whole cold chain</h2>
          <p className="mt-4 text-slate-600">
            Every stage of perishable supply — procurement, transit, inspection and recovery — connected in real time.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group rounded-2xl border border-slate-100 bg-white p-6 hover:shadow-xl hover:border-emerald-200 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <f.icon className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works strip */}
      <section className="bg-emerald-900 text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: ShoppingCart, step: '01', title: 'Source & Award', desc: 'Post requirements and let vetted vendors bid. Award the best multi-vendor split.' },
              { icon: Truck, step: '02', title: 'Track in Transit', desc: 'Monitor every reefer load with GPS and live temperature telemetry until delivery.' },
              { icon: ShieldCheck, step: '03', title: 'Inspect & Recover', desc: 'AI grades inbound freshness; spoilage is auto-routed into vendor chargeback claims.' },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-700/60 flex items-center justify-center">
                  <s.icon className="w-6 h-6 text-emerald-200" />
                </div>
                <div>
                  <div className="text-emerald-400 text-sm font-bold">{s.step}</div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-emerald-100/80">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-8 py-14 text-center text-white shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to protect your fresh supply chain?</h2>
          <p className="mt-3 text-emerald-50 max-w-xl mx-auto">
            Create an account in seconds and start tracking, sourcing and recovering value today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => goAuth('signup')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-700 font-semibold hover:bg-emerald-50 transition-colors"
            >
              <UserPlus className="w-5 h-5" /> Create your account
            </button>
            <button
              onClick={() => goAuth('login')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800/50 border border-emerald-400/40 text-white font-semibold hover:bg-emerald-800/80 transition-colors"
            >
              <LogIn className="w-5 h-5" /> Login
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-700">FreshGuard</span>
          </div>
          <span>© {new Date().getFullYear()} FreshGuard. Cold-chain intelligence for fresh supply.</span>
        </div>
      </footer>
    </div>
  );
}
