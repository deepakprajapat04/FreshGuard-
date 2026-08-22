import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageHeader, StatCard, pageShellClass, statGridClass } from '../components/PageChrome';
import { btnGhostClass, btnPrimaryLgClass } from '../lib/sapTheme';
import {
  ALERT_CATEGORY_OPTIONS,
  ALERT_EVENT_TYPE_OPTIONS,
  ALERT_TYPE_OPTIONS,
  COUNTRY_OPTIONS,
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
  alertTypes: ['Weather & climate disruption'] as AlertRiskType[],
  alertCategory: '',
  eventType: '',
  country: '',
  endDate: '',
});

const RISK_SCORE_LABELS: Record<AlertRiskScore, string> = {
  Low: 'Minor',
  Medium: 'Moderate',
  High: 'Elevated',
  Critical: 'Severe',
};

const EVENT_MODE_LABELS: Record<AlertEventMode, string> = {
  global: 'Network-wide',
  vessel: 'Single shipment',
};

export default function BusinessRules() {
  const { upsertMany } = useNotifications();
  const [rules, setRules] = useState<BusinessRulesConfig>(() => loadBusinessRules());
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertForm, setAlertForm] = useState(emptyAlertForm);
  const [alertTypeSearch, setAlertTypeSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredAlertTypes = useMemo(() => {
    const q = alertTypeSearch.trim().toLowerCase();
    if (!q) return [...ALERT_TYPE_OPTIONS];
    return ALERT_TYPE_OPTIONS.filter((t) => t.toLowerCase().includes(q));
  }, [alertTypeSearch]);

  const persistRules = () => {
    saveBusinessRules(rules);
    setSavedFlash('Rules saved. Delay alerts and risk types will use these settings.');
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

  const openAddAlert = () => {
    setAlertForm(emptyAlertForm());
    setAlertTypeSearch('');
    setFormError(null);
    setAlertModalOpen(true);
  };

  const saveCustomAlert = () => {
    if (!alertForm.name.trim()) {
      setFormError('Please enter a watch rule name.');
      return;
    }
    if (!alertForm.alertTypes.length) {
      setFormError('Select at least one impact family.');
      return;
    }
    const next: CustomBusinessAlert = {
      id: `ALERT-${Date.now()}`,
      name: alertForm.name.trim(),
      eventMode: alertForm.eventMode,
      riskScore: alertForm.riskScore,
      alertTypes: alertForm.alertTypes,
      alertCategory: alertForm.alertCategory || 'General',
      eventType: alertForm.eventType || 'Unclassified',
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
    setSavedFlash(`Watch rule "${next.name}" added. Click Save rules to keep it.`);
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
      <PageHeader title="Business Rules">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openAddAlert} className={btnGhostClass}>
            <Plus className="w-4 h-4" />
            Create watch rule
          </button>
          <button type="button" onClick={persistRules} className={btnPrimaryLgClass}>
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

      <div className={statGridClass}>
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
          label="Watch rules saved"
          value={String(rules.customAlerts.length)}
          tone="sap"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-3.5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">1. Urgent alert</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">If delayed more than X days</p>
            </div>
          </div>
          <div className="p-3.5 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="font-medium text-slate-700 dark:text-slate-200">Enable urgent alerts</span>
              <input
                type="checkbox"
                checked={rules.urgentAlertEnabled}
                onChange={(e) => setRules((r) => ({ ...r, urgentAlertEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#4684AD] focus:ring-[#4684AD]"
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

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          <div className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">2. Warning expected delay</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">If expected delay exceeds X days</p>
            </div>
          </div>
          <div className="p-3.5 space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="font-medium text-slate-700 dark:text-slate-200">Enable warning alerts</span>
              <input
                type="checkbox"
                checked={rules.warningAlertEnabled}
                onChange={(e) => setRules((r) => ({ ...r, warningAlertEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#4684AD] focus:ring-[#4684AD]"
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
              Forecasted ETA slip beyond this threshold raises a warning alert for buyers.
            </p>
          </div>
        </section>
      </div>

      {/* Disruption families */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
        <div className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-300" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">3. Disruption families to monitor</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enable the risk signals FreshGuard scans across lanes, ports, and suppliers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAddAlert}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4684AD] hover:bg-[#3B7398] text-white text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Create watch rule
          </button>
        </div>
        <div className="p-3.5 space-y-3">
          <p className="text-[11px] text-slate-500">
            Selected families feed buyer delay alerts, corridor warnings, and exposure KPIs.
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
                      ? 'border-[#4684AD] bg-[#C0D5E5]/30 dark:bg-sky-950/30 dark:border-sky-700'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleAlertType(t)}
                    className="w-4 h-4 rounded border-slate-300 text-[#4684AD] focus:ring-[#4684AD]"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-100">{t}</span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
              Saved watch rules ({rules.customAlerts.length})
            </h3>
            {rules.customAlerts.length === 0 ? (
              <p className="text-[11px] text-slate-400">No watch rules yet. Click Create watch rule.</p>
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
                                  ? 'bg-[#C0D5E5]/40 text-[#2F5472]'
                                  : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {RISK_SCORE_LABELS[a.riskScore]}
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                          {EVENT_MODE_LABELS[a.eventMode]}
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
                        className="text-[10px] font-bold uppercase text-[#2F5472] dark:text-[#C0D5E5]"
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

      {/* Create watch rule modal */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60">
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col"
            role="dialog"
            aria-labelledby="add-alert-title"
          >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 id="add-alert-title" className="text-base font-bold">
                Create watch rule
              </h2>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Watch rule name</span>
                <input
                  value={alertForm.name}
                  onChange={(e) => setAlertForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Gulf Coast lane storm watch"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400"
                />
              </label>

              <div>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-2">Watch scope</div>
                <div className="flex gap-4 text-sm">
                  {(
                    [
                      ['global', EVENT_MODE_LABELS.global],
                      ['vessel', EVENT_MODE_LABELS.vessel],
                    ] as const
                  ).map(([id, label]) => (
                    <label key={id} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="eventMode"
                        checked={alertForm.eventMode === id}
                        onChange={() => setAlertForm((f) => ({ ...f, eventMode: id }))}
                        className="text-[#4684AD] focus:ring-[#4684AD]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Impact families</span>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="relative border-b border-slate-200 dark:border-slate-700">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={alertTypeSearch}
                      onChange={(e) => setAlertTypeSearch(e.target.value)}
                      placeholder="Filter families"
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
                          className="w-4 h-4 rounded border-slate-500 text-[#4684AD] focus:ring-[#4684AD]"
                        />
                        {t}
                      </label>
                    ))}
                    {filteredAlertTypes.length === 0 && (
                      <div className="text-[11px] text-slate-500 px-2 py-3">No families match.</div>
                    )}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Trigger category</span>
                <select
                  value={alertForm.alertCategory}
                  onChange={(e) => setAlertForm((f) => ({ ...f, alertCategory: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-white"
                >
                  <option value="">Choose trigger category</option>
                  {ALERT_CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Trigger detail</span>
                <select
                  value={alertForm.eventType}
                  onChange={(e) => setAlertForm((f) => ({ ...f, eventType: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-white"
                >
                  <option value="">Choose trigger detail</option>
                  {ALERT_EVENT_TYPE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Risk priority</span>
                <select
                  value={alertForm.riskScore}
                  onChange={(e) =>
                    setAlertForm((f) => ({ ...f, riskScore: e.target.value as AlertRiskScore }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-white"
                >
                  {(['Low', 'Medium', 'High', 'Critical'] as const).map((s) => (
                    <option key={s} value={s}>
                      {RISK_SCORE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Region</span>
                <select
                  value={alertForm.country}
                  onChange={(e) => setAlertForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-white"
                >
                  <option value="">Choose region</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Valid until</span>
                <input
                  type="date"
                  value={alertForm.endDate}
                  onChange={(e) => setAlertForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-white"
                />
              </label>

              {formError && (
                <div className="text-xs text-rose-300 font-medium">{formError}</div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2 shrink-0">
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
                className="px-4 py-2 rounded-lg bg-[#4684AD] hover:bg-[#3B7398] text-white text-sm font-semibold"
              >
                Save rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
