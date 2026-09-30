import { useEffect, useRef } from 'react';
import { Loader2Icon, XIcon } from 'lucide-react';
import {
  useNotifications,
  type AppNotification,
  type NotificationLocation,
} from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';

function getLevelStyles(level: AppNotification['level']): string {
  if (level === 'error') {
    return 'border-l-red-500';
  }

  if (level === 'warning') {
    return 'border-l-amber-500';
  }

  if (level === 'success') {
    return 'border-l-green-500';
  }

  return 'border-l-blue-500';
}

interface NotificationItemProps {
  notification: AppNotification;
  onClose: (id: string) => void;
}

function NotificationItem({ notification, onClose }: Readonly<NotificationItemProps>) {
  return (
    <div
      className={`border border-gray-200 border-l-4 bg-white shadow-md rounded-md px-4 py-3 ${getLevelStyles(notification.level)}`}
      role="alert"
      aria-live={notification.level === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        {notification.loading ? (
          <Loader2Icon className="h-4 w-4 text-gray-500 animate-spin mt-0.5 shrink-0" aria-hidden="true" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-gray-900 font-medium">{notification.title}</div>
          {notification.description ? (
            <div className="text-xs text-gray-600 mt-1">{notification.description}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onClose(notification.id)}
          className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label={strings.notifications.close}
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function getLocationClasses(location: NotificationLocation): string {
  if (location === 'top-left') {
    return 'top-4 left-4';
  }

  if (location === 'bottom-left') {
    return 'bottom-4 left-4';
  }

  if (location === 'bottom-right') {
    return 'bottom-4 right-4';
  }

  return 'top-4 right-4';
}

function NotificationCenter() {
  const { notifications, removeNotification } = useNotifications();
  const timeoutByIdRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const activeIds = new Set(notifications.map((item) => item.id));

    // Clear timers for notifications that were removed manually or replaced.
    timeoutByIdRef.current.forEach((timeoutId, id) => {
      if (!activeIds.has(id)) {
        globalThis.clearTimeout(timeoutId);
        timeoutByIdRef.current.delete(id);
      }
    });

    // Add timers only for notifications that do not already have one.
    notifications.forEach((item) => {
      if (typeof item.autoDismissMs !== 'number' || item.autoDismissMs <= 0) {
        return;
      }

      if (timeoutByIdRef.current.has(item.id)) {
        return;
      }

      const timeoutId = globalThis.setTimeout(() => {
        timeoutByIdRef.current.delete(item.id);
        removeNotification(item.id);
      }, item.autoDismissMs);

      timeoutByIdRef.current.set(item.id, timeoutId);
    });
  }, [notifications, removeNotification]);

  useEffect(() => {
    return () => {
      timeoutByIdRef.current.forEach((timeoutId) => {
        globalThis.clearTimeout(timeoutId);
      });
      timeoutByIdRef.current.clear();
    };
  }, []);

  if (notifications.length === 0) {
    return null;
  }

  const notificationsByLocation: Record<NotificationLocation, AppNotification[]> = {
    'top-left': [],
    'top-right': [],
    'bottom-left': [],
    'bottom-right': [],
  };

  notifications.forEach((notification) => {
    notificationsByLocation[notification.location ?? 'top-right'].push(notification);
  });

  const locationOrder: NotificationLocation[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  return (
    <>
      {locationOrder.map((location) => {
        const locationNotifications = notificationsByLocation[location];
        if (locationNotifications.length === 0) {
          return null;
        }

        return (
          <div
            key={location}
            className={`absolute z-[1100] w-[420px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-hidden space-y-2 ${getLocationClasses(location)}`}
          >
            {locationNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={removeNotification}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

export { NotificationCenter };
