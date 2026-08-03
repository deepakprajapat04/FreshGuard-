import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Check,
  ChevronUp,
  LogOut,
  Mail,
  MapPin,
  Shield,
  UserCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import { usePersona } from '../context/PersonaContext';
import { useTheme } from '../context/ThemeContext';

const PROFILES = {
  admin: {
    name: 'Sarah Mitchell',
    role: 'Supply Admin',
    title: 'Enterprise Operations',
    email: 'sarah.mitchell@freshguard.retail',
    org: 'FreshGuard Retail HQ',
    location: 'HQ DC — Chicago',
    id: 'USR-BUY-014',
  },
  vendor: {
    name: 'Marcus Chen',
    role: 'Global Farms Rep',
    title: 'Vendor Access',
    email: 'marcus.chen@globalfarms.suppliers',
    org: 'Global Farms Suppliers',
    location: 'Miami Export Yard',
    id: 'USR-VEN-088',
  },
} as const;

export function UserProfileMenu({
  open,
  onToggle,
  onClose,
  collapsed,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  collapsed: boolean;
}) {
  const { persona, setPersona } = usePersona();
  const { theme, toggleTheme } = useTheme();
  const profile = PROFILES[persona === 'vendor' ? 'vendor' : 'admin'];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ bottom: 72, left: 16 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 288;
      let left = collapsed ? r.right + 8 : r.left;
      left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
      const bottom = Math.max(8, window.innerHeight - r.top + 8);
      setCoords({ bottom, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, collapsed]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center rounded-xl p-1.5 transition-colors hover:bg-white/10 text-left',
          open && 'bg-white/10',
          collapsed ? 'justify-center' : 'gap-3'
        )}
        title="Open profile"
        aria-expanded={open}
      >
        <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center border border-sky-400/40 shrink-0">
          <UserCircle className="w-6 h-6 text-sky-200" />
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{profile.role}</div>
              <div className="text-xs text-sky-300/80 truncate">{profile.title}</div>
            </div>
            <ChevronUp
              className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', !open && 'rotate-180')}
            />
          </>
        )}
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                style={{ bottom: coords.bottom, left: coords.left }}
                className="fixed z-[200] w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                role="dialog"
                aria-label="User profile"
              >
                <div className="px-4 py-3 bg-[#0c1e36] text-white">
                  <div className="text-sm font-bold">{profile.name}</div>
                  <div className="text-[11px] text-sky-300 mt-0.5">{profile.role}</div>
                </div>
                <div className="p-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{profile.org}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{profile.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ID {profile.id}</span>
                  </div>
                </div>

                <div className="px-3 pb-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1 mb-1">
                    Active persona
                  </div>
                  {(['admin', 'vendor'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPersona(p)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                        persona === p
                          ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <span>{p === 'admin' ? 'Buyer / Supply Admin' : 'Vendor representative'}</span>
                      {persona === p && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Theme: {theme === 'light' ? 'Light' : 'Dark'} (click to switch)
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Close panel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
