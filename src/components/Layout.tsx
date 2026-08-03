import { ReactNode, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { usePersona } from '../context/PersonaContext';
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
  Inbox,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationsPanel } from './NotificationsPanel';
import { UserProfileMenu } from './UserProfileMenu';

const navItems = [
  { name: 'Overview & Analytics', path: '/', icon: LayoutDashboard },
  { name: 'Procurement & Bidding', path: '/procurement', icon: ShoppingCart },
  { name: 'Logistics Tracking', path: '/logistics', icon: Map },
  { name: 'Inbox', path: '/inbox', icon: Inbox, buyerOnly: true },
  { name: 'Business Rules', path: '/business-rules', icon: Settings2, buyerOnly: true },
  { name: 'AI Quality Control', path: '/qc', icon: ScanLine },
  { name: 'Store Receiving', path: '/store', icon: Store },
  { name: 'Claims & Wastage', path: '/claims', icon: AlertTriangle },
  { name: 'Shrinkage Reports', path: '/reports', icon: BarChart3 },
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

  const filteredNavItems = navItems.filter((item) => {
    if (persona === 'vendor') {
      if ((item as { buyerOnly?: boolean }).buyerOnly) return false;
      return ['/', '/procurement', '/logistics', '/claims', '/reports'].includes(item.path);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#e4ebf3] dark:bg-[#0d1a2a] flex overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
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
          'bg-gradient-to-b from-[#16324f] via-[#132a44] to-[#0f2338]',
          'border-r border-sky-500/20 shadow-[4px_0_24px_rgba(15,35,56,0.25)]',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'w-20' : 'w-72'
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-white/10 bg-white/[0.04]',
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
              'lg:hidden text-sky-300 hover:text-white shrink-0',
              !sidebarCollapsed && 'ml-2'
            )}
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1 rounded-md hover:bg-white/10 text-sky-300/80 hover:text-white shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1 overflow-x-hidden">
          {!sidebarCollapsed && (
            <div className="text-[10px] font-semibold text-sky-300/80 uppercase tracking-wide mb-3 px-3 whitespace-nowrap">
              {persona === 'admin' ? 'Platform Modules' : 'Vendor Portal'}
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
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-900/25'
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
        <header className="h-14 bg-[#e8eef5] dark:bg-[#1b334d] border-b border-slate-300/80 dark:border-sky-800/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30 sticky top-0 shadow-sm shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-sky-900/80 rounded-full px-3 py-1.5 bg-white dark:bg-[#0f2744] w-64 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 transition-all">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search POs, vendors, lots..."
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-800 dark:text-slate-100 placeholder:select-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">View as:</span>
              <div className="bg-white dark:bg-[#0f2744] p-1 rounded-lg flex gap-1 border border-slate-300 dark:border-sky-900/80">
                <button
                  onClick={() => setPersona('admin')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200',
                    persona === 'admin'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  )}
                >
                  Buyer
                </button>
                <button
                  onClick={() => setPersona('vendor')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200',
                    persona === 'vendor'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  )}
                >
                  Vendor
                </button>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 rounded-lg transition-colors relative flex items-center justify-center min-w-[36px] min-h-[36px]"
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
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10'
                )}
                title="Alerts"
                aria-label="Open alerts"
                aria-expanded={alertsOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-[#e8eef5] dark:ring-[#1b334d]">
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

            <div className="h-8 w-px bg-slate-300 dark:bg-sky-900/80 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                HQ DC - Chicago
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#e4ebf3] dark:bg-[#0d1a2a] transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
