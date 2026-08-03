import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { subMinutes } from 'date-fns';

export type AlertCategory = 'Urgent' | 'Info only' | 'Regular';

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  category: AlertCategory;
  timestamp: string;
  read: boolean;
  module: 'Logistics' | 'Procurement' | 'Claims' | 'Quality' | 'Store' | 'System';
  href?: string;
};

export function alertCategoryFromSeverity(
  severity: AppNotification['severity']
): AlertCategory {
  if (severity === 'critical' || severity === 'warning') return 'Urgent';
  if (severity === 'info') return 'Info only';
  return 'Regular';
}

type NotificationsContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  upsertMany: (items: AppNotification[]) => void;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

function seedNotifications(): AppNotification[] {
  const now = Date.now();
  return [
    {
      id: 'n-log-1',
      title: 'PSA delay on PO-2026-8842',
      message: 'Flash flood near Sector 4 · ETA slipped +14 hrs. Container FGUU4582190 still synced.',
      severity: 'warning',
      category: 'Urgent',
      timestamp: subMinutes(now, 8).toISOString(),
      read: false,
      module: 'Logistics',
      href: '/logistics',
    },
    {
      id: 'n-log-2',
      title: 'Ocean lot PSAU8823147 heartbeat',
      message: 'MV Pacific Fresh position refreshed via PSA Portnet · on-time to Chicago DC.',
      severity: 'info',
      category: 'Info only',
      timestamp: subMinutes(now, 18).toISOString(),
      read: false,
      module: 'Logistics',
      href: '/logistics',
    },
    {
      id: 'n-proc-1',
      title: 'New vendor bid received',
      message: 'Global Farms submitted $24.50/case on Organic Hass Avocados (REQ-2026-001).',
      severity: 'success',
      category: 'Regular',
      timestamp: subMinutes(now, 35).toISOString(),
      read: false,
      module: 'Procurement',
      href: '/procurement',
    },
    {
      id: 'n-claim-1',
      title: 'Claim CLM-001 awaiting review',
      message: 'Temperature excursion on PO-2026-8842 · $4,200 proposed recovery.',
      severity: 'critical',
      category: 'Urgent',
      timestamp: subMinutes(now, 55).toISOString(),
      read: false,
      module: 'Claims',
      href: '/claims',
    },
    {
      id: 'n-qc-1',
      title: 'FreshDetect reject flagged',
      message: 'Salmon lot scored 4/10 with slime indicators. Auto-claim draft ready.',
      severity: 'warning',
      category: 'Urgent',
      timestamp: subMinutes(now, 72).toISOString(),
      read: true,
      module: 'Quality',
      href: '/qc',
    },
    {
      id: 'n-store-1',
      title: 'Store auto-receive complete',
      message: 'Lincoln Park node accepted 400 cases Organic Milk without DC hold.',
      severity: 'success',
      category: 'Regular',
      timestamp: subMinutes(now, 95).toISOString(),
      read: true,
      module: 'Store',
      href: '/store',
    },
    {
      id: 'n-sys-1',
      title: 'PSA Portnet® link healthy',
      message: 'Bi-directional sync latency under 2s across active containers.',
      severity: 'info',
      category: 'Info only',
      timestamp: subMinutes(now, 120).toISOString(),
      read: true,
      module: 'System',
    },
  ];
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => seedNotifications());

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const upsertMany = useCallback((items: AppNotification[]) => {
    if (!items.length) return;
    setNotifications((prev) => {
      const map = new Map<string, AppNotification>(prev.map((n) => [n.id, n]));
      items.forEach((item) => {
        const normalized: AppNotification = {
          ...item,
          category: item.category || alertCategoryFromSeverity(item.severity),
        };
        const existing = map.get(item.id);
        map.set(
          item.id,
          existing ? { ...normalized, read: existing.read && item.read } : normalized
        );
      });
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead, dismiss, upsertMany }),
    [notifications, unreadCount, markRead, markAllRead, dismiss, upsertMany]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
