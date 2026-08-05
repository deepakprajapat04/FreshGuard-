import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileSignature,
  Inbox,
  Plus,
  Save,
  Search,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass } from '../components/PageChrome';
import {
  ALERT_CATEGORY_OPTIONS,
  ALERT_EVENT_TYPE_OPTIONS,
  ALERT_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  COUNTRY_OPTIONS,
  DEFAULT_BUYER_OWNERS,
  loadAutoProposals,
  loadBusinessRules,
  saveBusinessRules,
  type AlertEventMode,
  type AlertRiskScore,
  type AlertRiskType,
  type BusinessRulesConfig,
  type CustomBusinessAlert,
} from '../lib/businessRules';
import { useNotifications } from '../context/NotificationsContext';

const emptyAlertForm = () => ({
  eventMode: 'global' as AlertEventMode,
  name: '',
  riskScore: 'Medium' as AlertRiskScore,
  alertTypes: ['Natural Events'] as AlertRiskType[],
  alertCategory: '',
  eventType: '',
  country: '',
  endDate: '',
});

export default function BusinessRules() {
  const navigate = useNavigate();
  const { upsertMany } = useNotifications();
  const [rules, setRules] = useState<BusinessRulesConfig>(() => loadBusinessRules());
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertForm, setAlertForm] = useState(emptyAlertForm);
  const [alertTypeSearch, setAlertTypeSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => loadAutoProposals().filter((p) => p.status === 'pending_buyer').length,
    []
  );

  const filteredAlertTypes = useMemo(() => {
    const q = alertTypeSearch.trim().toLowerCase();
    if (!q) return [...ALERT_TYPE_OPTIONS];
    return ALERT_TYPE_OPTIONS.filter((t) => t.toLowerCase().includes(q));
  }, [alertTypeSearch]);

  const persistRules = () => {
    saveBusinessRules(rules);
    setSavedFlash('Rules saved. Delay alerts, risk types, and auto-proposals will use these settings.');
    upsertMany([
      {
        id: `n-rules-${Date.now()}`,
        title: 'Business rules updated',
        message: `Urgent > ${rules.urgentDelayDays}d · Warning > ${rules.warningExpectedDelayDays}d · Alert types ${rules.enabledAlertTypes.length} · Custom alerts ${rules.customAlerts.length}`,
        severity: 'success',
        category: 'Regular',
        timestamp: new Date().toISOString(),
        read: false,
        module: 'System',
        href: '/business-rules',
      },
    ]);
    setTimeout(() => setSavedFlash(null), 4000);
  };

  const toggleCategory = (cat: string) => {
    setRules((prev) => {
      const has = prev.autoProposalCategories.includes(cat);
      return {
        ...prev,
        autoProposalCategories: has
          ? prev.autoProposalCategories.filter((c) => c !== cat)
          : [...prev.autoProposalCategories, cat],
      };
    });
  };

  const toggleAlertType = (t: AlertRiskType) => {
    setRules((prev) => {
      const has = prev.enabledAlertTypes.includes(t);
      return {
        ...prev,
        enabledAlertTypes: has
          ? prev.enabledAlertTypes.filter((x) => x !== t)
          : [...prev.enabledAlertTypes, t],
      };
    });
  };

  const toggleFormAlertType = (t: AlertRiskType) => {
    setAlertForm((prev) => {
      const has = prev.alertTypes.includes(t);
      return {
        ...prev,
        alertTypes: has ? prev.alertTypes.filter((x) => x !== t) : [...prev.alertTypes, t],
      };
    });
  };

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    if (rules.autoProposalItems.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setNewItem('');
      return;
    }
    setRules((prev) => ({ ...prev, autoProposalItems: [...prev.autoProposalItems, v] }));
    setNewItem('');
  };

  const removeItem = (item: string) => {
    setRules((prev) => ({
      ...prev,
      autoProposalItems: prev.autoProposalItems.filter((i) => i !== item),
    }));
  };

  const openAddAlert = () => {
    setAlertForm(emptyAlertForm());
    setAlertTypeSearch('');
    setFormError(null);
    setAlertModalOpen(true);
  };

  const saveCustomAlert = () => {
    if (!alertForm.name.trim()) {
      setFormError('Please enter an alert name.');
      return;
    }
    if (!alertForm.alertTypes.length) {
      setFormError('Select at least one alert type.');
      return;
    }
    const next: CustomBusinessAlert = {
      id: `ALERT-${Date.now()}`,
      name: alertForm.name.trim(),
      eventMode: alertForm.eventMode,
      riskScore: alertForm.riskScore,
      alertTypes: alertForm.alertTypes,
      alertCategory: alertForm.alertCategory || 'Other',
      eventType: alertForm.eventType || 'Other',
      country: alertForm.country || 'Global / Multi-country',
      endDate: alertForm.endDate,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    setRules((prev) => ({
      ...prev,
      customAlerts: [next, ...prev.customAlerts],
      // Also turn on related monitoring types
      enabledAlertTypes: Array.from(new Set([...prev.enabledAlertTypes, ...next.alertTypes])),
    }));
    setAlertModalOpen(false);
    setFormError(null);
    setSavedFlash(`Alert "${next.name}" added. Click Save rules to keep it.`);
    setTimeout(() => setSavedFlash(null), 4000);
  };

  const removeCustomAlert = (id: string) => {
    setRules((prev) => ({
      ...prev,
      customAlerts: prev.customAlerts.filter((a) => a.id !== id),
    }));
  };

  const toggleCustomAlert = (id: string) => {
    setRules((prev) => ({
      ...prev,
      customAlerts: prev.customAlerts.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  };

  return (
    <div className={pageShellClass}>
      <PageHeader
        eyebrow="Governance"
        title="Business Rules"
        subtitle="Set delay alerts, risk alert types, and auto fill-in proposals. Approvals live in Inbox."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAddAlert}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 text-sm font-semibold hover:bg-sky-50 dark:hover:bg-sky-950/40"
          >
            <Plus className="w-4 h-4" />
            Add an alert
          </button>
          <button
            type="button"
            onClick={() => navigate('/inbox')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Inbox className="w-4 h-4" />
            Open Inbox
            {pendingCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={persistRules}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save rules
          </button>
        </div>
      </PageHeader>

      {savedFlash && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {savedFlash}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Urgent delay threshold"
          value={`> ${rules.urgentDelayDays}d`}
          tone="rose"
        />
        <StatCard
          label="Warning expected delay"
          value={`> ${rules.warningExpectedDelayDays}d`}
          tone="amber"
        />
        <StatCard
          label="Risk alert types on"
          value={String(rules.enabledAlertTypes.length)}
          tone="sky"
        />
        <StatCard
          label="Pending in Inbox"
          value={String(pendingCount)}
          tone="sky"
        />
      </div>

      <div className="grid xl:grid-cols-12 gap-5">
        <section className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0c1e36] text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">1. Urgent alert</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">If delayed more than X days</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="font-medium text-slate-700 dark:text-slate-200">Enable urgent alerts</span>
              <input
                type="checkbox"
                checked={rules.urgentAlertEnabled}
                onChange={(e) => setRules((r) => ({ ...r, urgentAlertEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Days overdue</span>
              <input
                type="number"
                min={1}
                value={rules.urgentDelayDays}
                onChange={(e) =>
                  setRules((r) => ({ ...r, urgentDelayDays: Math.max(1, Number(e.target.value) || 1) }))
                }
                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-semibold text-right"
              />
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Shipments delayed beyond this threshold raise an <strong>Urgent</strong> alert for buyers.
            </p>
          </div>
        </section>

        <section className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0c1e36] text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">2. Warning expected delay</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">If expected delay exceeds X days</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="font-medium text-slate-700 dark:text-slate-200">Enable warning alerts</span>
              <input
                type="checkbox"
                checked={rules.warningAlertEnabled}
                onChange={(e) => setRules((r) => ({ ...r, warningAlertEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Expected delay days</span>
              <input
                type="number"
                min={1}
                value={rules.warningExpectedDelayDays}
                onChange={(e) =>
                  setRules((r) => ({
                    ...r,
                    warningExpectedDelayDays: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-semibold text-right"
              />
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Forecasted ETA slip beyond this threshold raises a warning and can trigger auto-proposals.
            </p>
          </div>
        </section>

        <section className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0c1e36] text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">3. Auto-generate proposal</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Scope for fill-in proposals → Inbox</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="font-medium text-slate-700 dark:text-slate-200">Enable auto-proposals</span>
              <input
                type="checkbox"
                checked={rules.autoProposalEnabled}
                onChange={(e) => setRules((r) => ({ ...r, autoProposalEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Max ship days (alt supplier)</span>
              <input
                type="number"
                min={1}
                value={rules.maxShipDaysForAltSupplier}
                onChange={(e) =>
                  setRules((r) => ({
                    ...r,
                    maxShipDaysForAltSupplier: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-semibold text-right"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Min days of cover</span>
              <input
                type="number"
                min={0}
                value={rules.minDaysOfCoverThreshold}
                onChange={(e) =>
                  setRules((r) => ({
                    ...r,
                    minDaysOfCoverThreshold: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-semibold text-right"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="text-slate-600 dark:text-slate-300 text-[13px] leading-snug">
                Require stock-shortage for proposal
              </span>
              <input
                type="checkbox"
                checked={rules.requireStockShortageForProposal}
                onChange={(e) =>
                  setRules((r) => ({ ...r, requireStockShortageForProposal: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0"
              />
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When on, auto-proposals only fire if delay would leave stock unavailable on shelf.
              Approvals are handled in <strong>Inbox</strong>.
            </p>
          </div>
        </section>
      </div>

      {/* Alert types — like screenshot picker */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
        <div className="px-5 py-3.5 bg-[#0c1e36] text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">4. Alert types to watch</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Turn on risk families — natural events, politics, supply chain, pandemic, and more
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAddAlert}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add an alert
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-slate-500">
            Checked types are used when FreshGuard builds delay / corridor / risk alerts for buyers.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALERT_TYPE_OPTIONS.map((t) => {
              const on = rules.enabledAlertTypes.includes(t);
              return (
                <label
                  key={t}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors',
                    on
                      ? 'border-sky-400 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-700'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleAlertType(t)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-100">{t}</span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
              Your custom alerts ({rules.customAlerts.length})
            </h3>
            {rules.customAlerts.length === 0 ? (
              <p className="text-[11px] text-slate-400">No custom alerts yet. Click Add an alert.</p>
            ) : (
              <ul className="space-y-2">
                {rules.customAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{a.name}</span>
                        <span
                          className={cn(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                            a.riskScore === 'Critical'
                              ? 'bg-rose-600 text-white'
                              : a.riskScore === 'High'
                                ? 'bg-amber-500 text-white'
                                : a.riskScore === 'Medium'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {a.riskScore}
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                          {a.eventMode === 'global' ? 'Global event' : 'Vessel event'}
                        </span>
                        {!a.enabled && (
                          <span className="text-[9px] font-bold uppercase text-slate-400">Off</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {a.alertTypes.join(' · ')} · {a.alertCategory} · {a.eventType} · {a.country}
                        {a.endDate ? ` · ends ${a.endDate}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleCustomAlert(a.id)}
                        className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300"
                      >
                        {a.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomAlert(a.id)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                        aria-label={`Remove ${a.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-12 gap-5">
        <section className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0f2744] text-white">
            <h2 className="text-sm font-bold uppercase tracking-wider">In-scope categories</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Toggle categories eligible for auto-proposals</p>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const on = rules.autoProposalCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                    on
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0f2744] text-white">
            <h2 className="text-sm font-bold uppercase tracking-wider">In-scope items</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Optional item allow-list (empty = all in category)</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="e.g. Organic Hass Avocados"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {rules.autoProposalItems.length === 0 ? (
                <li className="text-[11px] text-slate-400 py-2">No item filters — all category products eligible.</li>
              ) : (
                rules.autoProposalItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      className="text-slate-400 hover:text-rose-500 p-0.5"
                      aria-label={`Remove ${item}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0f2744] text-white">
            <h2 className="text-sm font-bold uppercase tracking-wider">Category buyer owners</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Who receives Inbox proposals per category</p>
          </div>
          <div className="p-4 space-y-3">
            {CATEGORY_OPTIONS.map((cat) => (
              <label key={cat} className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">{cat}</span>
                <input
                  value={rules.buyerOwnerByCategory[cat] || DEFAULT_BUYER_OWNERS[cat] || ''}
                  onChange={(e) =>
                    setRules((r) => ({
                      ...r,
                      buyerOwnerByCategory: {
                        ...r.buyerOwnerByCategory,
                        [cat]: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
        <div className="px-5 py-3.5 bg-[#0f2744] text-white flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-emerald-300" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Auto-proposal workflow</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Expected delay → Inbox proposal → approve → 2nd-best short-lead bidder → PO issued
            </p>
          </div>
        </div>
        <ol className="p-5 grid sm:grid-cols-4 gap-3 text-xs">
          {[
            {
              n: '1',
              title: 'Detect delay + stock gap',
              body: 'Expected/urgent delay on in-scope item, and (if enabled) shelf cover / shortage risk.',
              icon: AlertTriangle,
            },
            {
              n: '2',
              title: 'Proposal in Inbox',
              body: 'Category owner reviews fill-in qty sized to shortage gap, 2nd-best bidder, and ship window.',
              icon: Bell,
            },
            {
              n: '3',
              title: 'Approve → alt supplier',
              body: `Request goes to 2nd-best RFQ bidder who can ship within ${rules.maxShipDaysForAltSupplier} days.`,
              icon: Truck,
            },
            {
              n: '4',
              title: 'Issue PO',
              body: 'On approval, a purchase order is issued automatically to cover stock-not-available risk.',
              icon: ShoppingCart,
            },
          ].map((step) => (
            <li
              key={step.n}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {step.n}
                </span>
                <step.icon className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-100">{step.title}</div>
              <p className="text-slate-500 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Add an Alert modal */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60">
          <div
            className="w-full max-w-lg rounded-2xl bg-[#0c1e36] text-white shadow-2xl border border-sky-900/60 overflow-hidden max-h-[90vh] flex flex-col"
            role="dialog"
            aria-labelledby="add-alert-title"
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <h2 id="add-alert-title" className="text-base font-bold">
                Add an Alert
              </h2>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-2">Event Mode</div>
                <div className="flex gap-4 text-sm">
                  {(
                    [
                      ['global', 'Global Event'],
                      ['vessel', 'Vessel Event'],
                    ] as const
                  ).map(([id, label]) => (
                    <label key={id} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="eventMode"
                        checked={alertForm.eventMode === id}
                        onChange={() => setAlertForm((f) => ({ ...f, eventMode: id }))}
                        className="text-sky-500 focus:ring-sky-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Alert Name</span>
                <input
                  value={alertForm.name}
                  onChange={(e) => setAlertForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter Alert Name"
                  className="w-full rounded-lg border border-sky-900/80 bg-[#0a1829] px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Risk Score</span>
                <select
                  value={alertForm.riskScore}
                  onChange={(e) =>
                    setAlertForm((f) => ({ ...f, riskScore: e.target.value as AlertRiskScore }))
                  }
                  className="w-full rounded-lg border border-sky-900/80 bg-[#0a1829] px-3 py-2.5 text-sm text-white"
                >
                  {(['Low', 'Medium', 'High', 'Critical'] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Alert Type</span>
                <div className="rounded-xl border border-sky-900/80 bg-[#0a1829] overflow-hidden">
                  <div className="relative border-b border-sky-900/60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={alertTypeSearch}
                      onChange={(e) => setAlertTypeSearch(e.target.value)}
                      placeholder="Search"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto p-2 space-y-0.5">
                    {filteredAlertTypes.map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={alertForm.alertTypes.includes(t)}
                          onChange={() => toggleFormAlertType(t)}
                          className="w-4 h-4 rounded border-slate-500 text-sky-500 focus:ring-sky-500"
                        />
                        {t}
                      </label>
                    ))}
                    {filteredAlertTypes.length === 0 && (
                      <div className="text-[11px] text-slate-500 px-2 py-3">No types match.</div>
                    )}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Alert Category</span>
                <select
                  value={alertForm.alertCategory}
                  onChange={(e) => setAlertForm((f) => ({ ...f, alertCategory: e.target.value }))}
                  className="w-full rounded-lg border border-sky-900/80 bg-[#0a1829] px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Select Alert Category</option>
                  {ALERT_CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Event Type</span>
                <select
                  value={alertForm.eventType}
                  onChange={(e) => setAlertForm((f) => ({ ...f, eventType: e.target.value }))}
                  className="w-full rounded-lg border border-sky-900/80 bg-[#0a1829] px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Select Event Type</option>
                  {ALERT_EVENT_TYPE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">Country</span>
                <select
                  value={alertForm.country}
                  onChange={(e) => setAlertForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full rounded-lg border border-sky-900/80 bg-[#0a1829] px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Select Country</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300">End Date</span>
                <input
                  type="date"
                  value={alertForm.endDate}
                  onChange={(e) => setAlertForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-sky-900/80 bg-[#0a1829] px-3 py-2.5 text-sm text-white"
                />
              </label>

              {formError && (
                <div className="text-xs text-rose-300 font-medium">{formError}</div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white text-slate-800 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomAlert}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
