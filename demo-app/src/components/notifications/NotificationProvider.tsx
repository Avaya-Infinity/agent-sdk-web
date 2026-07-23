import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type NotificationLevel = 'error' | 'warning' | 'success' | 'info';
export type NotificationLocation = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  description?: string;
  loading?: boolean;
  createdAt: number;
  autoDismissMs: number | null;
  location?: NotificationLocation;
}

interface AddNotificationInput {
  id: string;
  level: NotificationLevel;
  title: string;
  description?: string;
  loading?: boolean;
  autoDismissMs?: number | null;
  location?: NotificationLocation;
}

interface UpdateNotificationInput {
  id: string;
  level?: NotificationLevel;
  title?: string;
  description?: string;
  loading?: boolean;
  autoDismissMs?: number | null;
  location?: NotificationLocation;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  addNotification: (notification: AddNotificationInput) => void;
  updateNotification: (notification: UpdateNotificationInput) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function getDefaultDismissDuration(level: NotificationLevel): number | null {
  if (level === 'error') {
    return null;
  }

  if (level === 'warning') {
    return 8000;
  }

  return 5000;
}

function NotificationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback((notification: AddNotificationInput) => {
    setNotifications((prev) => {
      const nextNotification: AppNotification = {
        id: notification.id,
        level: notification.level,
        title: notification.title,
        description: notification.description,
        loading: notification.loading ?? false,
        createdAt: Date.now(),
        autoDismissMs:
          notification.autoDismissMs === undefined
            ? getDefaultDismissDuration(notification.level)
            : notification.autoDismissMs,
        location: notification.location ?? 'top-right',
      };

      // Replace by id so each named notification stays unique.
      const withoutSameId = prev.filter((item) => item.id !== notification.id);
      return [nextNotification, ...withoutSameId];
    });
  }, []);

  const updateNotification = useCallback((notification: UpdateNotificationInput) => {
    setNotifications((prev) => {
      const existing = prev.find((item) => item.id === notification.id);
      if (!existing) {
        return prev;
      }

      const nextNotification: AppNotification = {
        ...existing,
        ...notification,
        id: existing.id,
        createdAt: Date.now(),
      };

      const withoutSameId = prev.filter((item) => item.id !== notification.id);
      return [nextNotification, ...withoutSameId];
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      addNotification,
      updateNotification,
      removeNotification,
      clearNotifications,
    }),
    [notifications, addNotification, updateNotification, removeNotification, clearNotifications]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }

  return context;
}

export { NotificationProvider, useNotifications };
