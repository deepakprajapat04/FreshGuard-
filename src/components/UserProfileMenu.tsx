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
import { DC_PURCHASING_PERSONAS, type FreshGuardPersona } from '../lib/trackingFlow';
import { PERSONA_LABELS } from '../lib/trackingFlow';
import { useTheme } from '../context/ThemeContext';

const PROFILES: Record<
  FreshGuardPersona,
  {
    name: string;
    role: string;
    title: string;
    email: string;
    org: string;
    location: string;
    id: string;
  }
> = {
  dc_purchasing_fruits: {
    name: 'Sarah Mitchell',
    role: 'DC Purchasing — Fruits',
    title: 'RFQ & Perishable Sourcing',
    email: 'sarah.mitchell.fruits@freshguard.retail',
    org: 'FreshGuard Retail HQ',
    location: 'HQ DC — Chicago',
    id: 'USR-DCP-F014',
  },
  dc_purchasing_vegetables: {
    name: 'David Okonkwo',
    role: 'DC Purchasing — Vegetables',
    title: 'PO & Planned Produce Sourcing',
    email: 'david.okonkwo.vegetables@freshguard.retail',
    org: 'FreshGuard Retail HQ',
    location: 'HQ DC — Chicago',
    id: 'USR-DCP-V019',
  },
  supplier: {
    name: 'Marcus Chen',
    role: 'Berry Farms Co-op',
    title: 'Supplier ASN Portal',
    email: 'marcus.chen@berryfarms.suppliers',
    org: 'Berry Farms Co-op',
    location: 'Valparaíso Export Yard',
    id: 'USR-SUP-088',
  },
  transport: {
    name: 'James Ortiz',
    role: 'Transport Coordinator',
    title: 'Fleet & Drayage',
    email: 'james.ortiz@freshguard.retail',
    org: 'FreshGuard Logistics',
    location: 'Chicago Yard',
    id: 'USR-TRN-022',
  },
  receiving: {
    name: 'Priya Nair',
    role: 'Receiving Supervisor',
    title: 'DC Dock Operations',
    email: 'priya.nair@freshguard.retail',
    org: 'FreshGuard Retail HQ',
    location: 'HQ DC — Chicago',
    id: 'USR-RCV-031',
  },
  category_manager: {
    name: 'Alex Rivera',
    role: 'Fresh Produce Category Manager',
    title: 'Category Merchandising',
    email: 'alex.rivera@freshguard.retail',
    org: 'FreshGuard Retail HQ',
    location: 'HQ — Chicago',
    id: 'USR-CAT-007',
  },
};

const ALL_PERSONAS: FreshGuardPersona[] = [
  ...DC_PURCHASING_PERSONAS,
  'supplier',
  'transport',
  'receiving',
  'category_manager',
];

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
  const profile = PROFILES[persona];
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
          'w-full flex items-center rounded-xl p-1.5 transition-colors hover:bg-white/60 text-left',
          open && 'bg-white/60',
          collapsed ? 'justify-center' : 'gap-3'
        )}
        title="Open profile"
        aria-expanded={open}
      >
        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center border border-[#86A8C2] shrink-0">
          <UserCircle className="w-6 h-6 text-[#4684AD]" />
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[#2F5472] truncate">{profile.role}</div>
              <div className="text-xs text-slate-500 truncate">{profile.title}</div>
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
                <div className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">
                  <div className="text-sm font-bold">{profile.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{profile.role}</div>
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
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-1 mb-1">
                    Active persona
                  </div>
                  {ALL_PERSONAS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPersona(p)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                        persona === p
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <span>{PERSONA_LABELS[p]}</span>
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
