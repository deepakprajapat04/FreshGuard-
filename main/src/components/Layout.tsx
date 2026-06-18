import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { usePersona } from '../context/PersonaContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
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
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { name: 'Overview & Analytics', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Procurement & Bidding', path: '/procurement', icon: ShoppingCart },
  { name: 'Logistics Tracking', path: '/logistics', icon: Map },
  { name: 'AI Quality Control', path: '/qc', icon: ScanLine },
  { name: 'Store Receiving', path: '/store', icon: Store },
  { name: 'Claims & Wastage', path: '/claims', icon: AlertTriangle },
  { name: 'Shrinkage Reports', path: '/reports', icon: BarChart3 },
];

export function Layout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { persona, setPersona } = usePersona();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const filteredNavItems = navItems.filter((item) => {
    if (persona === 'vendor') {
      return ['/dashboard', '/procurement', '/logistics', '/claims', '/reports'].includes(item.path);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
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

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-emerald-900 text-white transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex-shrink-0 shadow-2xl flex flex-col group",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-20" : "w-72"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-800/50 bg-emerald-950/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">FreshGuard</span>
            )}
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-emerald-400 hover:text-white shrink-0 ml-2"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1 rounded hover:bg-emerald-800/50 text-emerald-400 hover:text-white shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 overflow-x-hidden">
          {!sidebarCollapsed && (
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-4 px-3 whitespace-nowrap">
              {persona === 'admin' ? 'Platform Modules' : 'Vendor Portal'}
            </div>
          )}
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/link text-sm font-medium",
                isActive 
                  ? "bg-emerald-500/20 text-emerald-100 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
                  : "text-emerald-300 hover:bg-emerald-800/40 hover:text-white",
                sidebarCollapsed ? "justify-center px-0" : ""
              )}
              title={sidebarCollapsed ? item.name : undefined}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", "group-hover/link:scale-110 transition-transform", sidebarCollapsed ? '' : '')} />
              {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-emerald-800/50 bg-emerald-950/20 overflow-hidden">
          <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
            <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center border-2 border-emerald-500 shrink-0">
              <UserCircle className="w-6 h-6 text-emerald-100" />
            </div>
            {!sidebarCollapsed && (
              <div className="whitespace-nowrap flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user?.fullName || (persona === 'admin' ? 'Supply Admin' : 'Global Farms Rep')}</div>
                <div className="text-xs text-emerald-400 truncate">{user?.email || user?.phone || (persona === 'admin' ? 'Enterprise Operations' : 'Vendor Access')}</div>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800/50 transition-colors shrink-0"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
          {sidebarCollapsed && (
            <button
              onClick={handleLogout}
              title="Log out"
              className="mt-3 w-full flex justify-center p-2 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800/50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 sticky top-0 shadow-sm shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 w-64 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search POs, vendors, lots..." 
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100 placeholder:select-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">View as:</span>
              <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-lg flex gap-1 border border-transparent dark:border-slate-800">
                <button
                  onClick={() => setPersona('admin')}
                  className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all duration-200", persona === 'admin' ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}
                >
                  Buyer
                </button>
                <button
                  onClick={() => setPersona('vendor')}
                  className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all duration-200", persona === 'vendor' ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}
                >
                  Vendor
                </button>
              </div>
            </div>

            {/* Styled Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative flex items-center justify-center min-w-[36px] min-h-[36px]"
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
                    <Moon className="w-5 h-5 text-slate-600 hover:text-slate-900" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-400 hover:text-amber-300" />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>

            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">HQ DC - Chicago</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-auto bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
