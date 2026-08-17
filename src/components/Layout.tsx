import { ReactNode, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { usePersona, isSupplierPersona } from '../context/PersonaContext';
import { PERSONA_LABELS, type FreshGuardPersona } from '../lib/trackingFlow';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Map,
  ScanLine,
  AlertTriangle,
  Store,
  BarChart3,
  Menu,
  X,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Settings2,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationsPanel } from './NotificationsPanel';
import { UserProfileMenu } from './UserProfileMenu';

const ALL_PERSONAS: FreshGuardPersona[] = [
  'dc_purchasing',
  'supplier',
  'transport',
  'receiving',
];

const navItems = [
  { name: 'Track → Risk → Act', path: '/', icon: LayoutDashboard, personas: ALL_PERSONAS },
  { name: 'SAP Purchase Orders', path: '/orders', icon: ShoppingCart, personas: ['dc_purchasing', 'supplier'] as FreshGuardPersona[] },
  { name: 'Logistics Tracking', path: '/logistics', icon: Map, personas: ALL_PERSONAS },
  { name: 'Risk Actions', path: '/actions', icon: ClipboardCheck, personas: ['dc_purchasing', 'transport', 'receiving'] as FreshGuardPersona[] },
  { name: 'Business Rules', path: '/business-rules', icon: Settings2, personas: ['dc_purchasing'] as FreshGuardPersona[] },
  { name: 'AI Quality Control', path: '/qc', icon: ScanLine, personas: ['dc_purchasing', 'receiving'] as FreshGuardPersona[] },
  { name: 'Store Receiving', path: '/store', icon: Store, personas: ['dc_purchasing', 'receiving'] as FreshGuardPersona[] },
  { name: 'Claims & Wastage', path: '/claims', icon: AlertTriangle, personas: ['dc_purchasing', 'supplier'] as FreshGuardPersona[] },
  { name: 'Shrinkage Reports', path: '/reports', icon: BarChart3, personas: ['dc_purchasing', 'supplier'] as FreshGuardPersona[] },
];

export function Layout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const alertsAnchorRef = useRef<HTMLButtonElement>(null);
  const { persona, setPersona } = usePersona();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();

  const filteredNavItems = navItems.filter((item) => item.personas.includes(persona));

  return (
    <div className="min-h-screen bg-[#eef1f5] dark:bg-[#111820] flex overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 text-white transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex-shrink-0 flex flex-col group overflow-visible',
          'bg-[#1a2332]',
          'border-r border-slate-700/50 shadow-[4px_0_24px_rgba(0,0,0,0.2)]',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'w-20' : 'w-72'
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-white/10 bg-black/10',
            sidebarCollapsed
              ? 'flex-col justify-center gap-1.5 px-2 py-3'
              : 'h-16 justify-between px-4'
          )}
        >
          <div className={cn('flex items-center gap-3', !sidebarCollapsed && 'overflow-hidden min-w-0')}>
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-md overflow-hidden p-1">
              <img
                src="/freshguard-logo.png"
                alt="FreshGuard"
                className="w-full h-full object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">
                FreshGuard
              </span>
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              'lg:hidden text-slate-400 hover:text-white shrink-0',
              !sidebarCollapsed && 'ml-2'
            )}
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1 overflow-x-hidden">
          {!sidebarCollapsed && (
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3 px-3 whitespace-nowrap">
              {isSupplierPersona(persona) ? 'Supplier portal' : 'Operations console'}
            </div>
          )}
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group/link text-sm font-medium',
                  isActive
                    ? 'bg-[#2d4a6f] text-white shadow-sm'
                    : 'text-slate-300/90 hover:bg-white/8 hover:text-white',
                  sidebarCollapsed ? 'justify-center px-0' : ''
                )
              }
              title={sidebarCollapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0 group-hover/link:scale-105 transition-transform" />
              {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
            </NavLink>
          ))}
        </div>

        <div className="p-3 border-t border-white/10 bg-black/15 overflow-visible">
          <UserProfileMenu
            open={profileOpen}
            onToggle={() => {
              setProfileOpen((v) => !v);
              setAlertsOpen(false);
            }}
            onClose={() => setProfileOpen(false)}
            collapsed={sidebarCollapsed}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-14 bg-[#1a2332] border-b border-slate-700/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30 sticky top-0 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-slate-300 border border-slate-600/80 rounded-full px-3 py-1.5 bg-[#141c28] w-64 focus-within:ring-2 focus-within:ring-[#2d4a6f] focus-within:border-[#2d4a6f] transition-all">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search POs, containers, lots..."
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-500 text-slate-100 placeholder:select-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 mr-1">
              <span className="text-xs font-medium text-slate-400">Persona:</span>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as FreshGuardPersona)}
                className="bg-[#141c28] border border-slate-600/80 text-slate-200 text-xs font-medium rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#2d4a6f]"
              >
                {ALL_PERSONAS.map((p) => (
                  <option key={p} value={p}>
                    {PERSONA_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative flex items-center justify-center min-w-[36px] min-h-[36px]"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle Theme"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center"
                >
                  {theme === 'light' ? (
                    <Moon className="w-5 h-5" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-400" />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>

            <div className="relative">
              <button
                ref={alertsAnchorRef}
                type="button"
                onClick={() => {
                  setAlertsOpen((v) => !v);
                  setProfileOpen(false);
                }}
                className={cn(
                  'relative p-2 rounded-lg transition-colors',
                  alertsOpen
                    ? 'bg-[#2d4a6f] text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                )}
                title="Alerts"
                aria-label="Open alerts"
                aria-expanded={alertsOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-[#1a2332]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationsPanel
                open={alertsOpen}
                onClose={() => setAlertsOpen(false)}
                anchorRef={alertsAnchorRef}
              />
            </div>

            <div className="h-8 w-px bg-slate-600/80 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200">HQ DC — Chicago</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#eef1f5] dark:bg-[#111820] transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
