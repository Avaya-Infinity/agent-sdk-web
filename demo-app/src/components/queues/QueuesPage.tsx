import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Queue, QueueEventType, ReasonType, UserEventType, type ReasonCode, type User } from '@avaya/infinity-agent-sdk';
import { QueueStatsCard } from './QueueStatsCard';
import { QueueSearchBar } from './QueueSearchBar';
import { QueueTable } from './QueueTable';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { LogoutReasonDialog } from '@/components/shared/LogoutReasonDialog';
import { strings } from '@/locales/en';
import { createLogger } from '@/utils/logger';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';

const logger = createLogger('QueuesPage');

interface QueuesPageProps {
  user: User;
}

function QueuesPage({ user }: QueuesPageProps) {
  const { addNotification } = useNotifications();
  const [searchValue, setSearchValue] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(user.isLoggedInToCx);
  const [queues, setQueues] = useState<Queue[]>([]);
  const queueSubscriptionsRef = useRef<Map<string, string>>(new Map());

  const fetchQueues = useCallback(() => {
    const sdkQueues = user.getAssignedQueues();
    setQueues(sdkQueues);
    return sdkQueues;
  }, [user]);

  const subscribeToQueue = useCallback((queue: Queue) => {
    if (queueSubscriptionsRef.current.has(queue.queueId)) return;
    const handlerId = queue.subscribe(QueueEventType.QUEUE_STATUS_CHANGED, () => {
      fetchQueues();
    });
    queueSubscriptionsRef.current.set(queue.queueId, handlerId);
  }, [fetchQueues]);

  const unsubscribeAllQueues = useCallback((currentQueues: Queue[]) => {
    for (const [queueId, handlerId] of queueSubscriptionsRef.current.entries()) {
      try {
        const queue = currentQueues.find(q => q.queueId === queueId);
        if (queue) {
          queue.unsubscribe(QueueEventType.QUEUE_STATUS_CHANGED, handlerId);
        }
      } catch (err) {
        logger.debug('queue.unsubscribe skipped during teardown', { queueId, err });
      }
    }
    queueSubscriptionsRef.current.clear();
  }, []);

  useEffect(() => {
    const initialQueues = fetchQueues();
    for (const queue of initialQueues) {
      subscribeToQueue(queue);
    }

    const cxLoggedInHandlerId = user.subscribe(UserEventType.USER_CX_LOGGED_IN, () => {
      setIsUserLoggedIn(true);
      unsubscribeAllQueues(user.getAssignedQueues());
      const updatedQueues = fetchQueues();
      for (const queue of updatedQueues) {
        subscribeToQueue(queue);
      }
    });
    const cxLoggedOutHandlerId = user.subscribe(UserEventType.USER_CX_LOGGED_OUT, () => {
      setIsUserLoggedIn(false);
      unsubscribeAllQueues(user.getAssignedQueues());
      const updatedQueues = fetchQueues();
      for (const queue of updatedQueues) {
        subscribeToQueue(queue);
      }
    });

    return () => {
      safeUnsubscribeUser(user, UserEventType.USER_CX_LOGGED_IN, cxLoggedInHandlerId);
      safeUnsubscribeUser(user, UserEventType.USER_CX_LOGGED_OUT, cxLoggedOutHandlerId);
      unsubscribeAllQueues(user.getAssignedQueues());
    };
  }, [user, fetchQueues, subscribeToQueue, unsubscribeAllQueues]);

  const filteredQueues = useMemo(() => {
    if (!searchValue.trim()) return queues;
    const search = searchValue.toLowerCase();
    return queues.filter((q) => q.queueName.toLowerCase().includes(search));
  }, [queues, searchValue]);

  const stats = useMemo(() => {
    const total = queues.length;
    const loggedIn = queues.filter((q) => q.isLoggedIn).length;
    const loggedOut = total - loggedIn;
    return { total, loggedIn, loggedOut };
  }, [queues]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await user.refreshAssignedQueues();
      unsubscribeAllQueues(user.getAssignedQueues());
      const updatedQueues = fetchQueues();
      for (const queue of updatedQueues) {
        subscribeToQueue(queue);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const [loadingQueueIds, setLoadingQueueIds] = useState<Set<string>>(new Set());
  const [logoutPicker, setLogoutPicker] = useState<{
    open: boolean;
    reasons: ReasonCode[];
    pendingQueue: Queue | null;
    loading: boolean;
  }>({ open: false, reasons: [], pendingQueue: null, loading: false });

  const handleToggleQueue = async (queue: Queue, enabled: boolean) => {
    if (enabled) {
      setLoadingQueueIds(prev => new Set(prev).add(queue.queueId));
      try {
        await queue.login();
      } catch (error) {
        addNotification({
          id: `queue-toggle-failed-${queue.queueId}-${Date.now()}`,
          level: 'error',
          title: strings.queues.loginFailed,
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setLoadingQueueIds(prev => {
          const next = new Set(prev);
          next.delete(queue.queueId);
          return next;
        });
      }
    } else {
      setLoadingQueueIds(prev => new Set(prev).add(queue.queueId));
      try {
        const reasons = await user.getAssignableReasonCodes();
        setLogoutPicker({
          open: true,
          reasons: reasons.filter(r => r.type === ReasonType.LOGOUT),
          pendingQueue: queue,
          loading: false,
        });
        // loadingQueueIds kept — switch stays disabled until picker resolves
      } catch (error) {
        setLoadingQueueIds(prev => {
          const next = new Set(prev);
          next.delete(queue.queueId);
          return next;
        });
        addNotification({
          id: `queue-toggle-failed-${queue.queueId}-${Date.now()}`,
          level: 'error',
          title: strings.queues.logoutFailed,
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  const handleLogoutReasonConfirm = async (reason: ReasonCode) => {
    const { pendingQueue } = logoutPicker;
    if (!pendingQueue) return;
    setLogoutPicker(prev => ({ ...prev, open: false, loading: true }));
    try {
      await pendingQueue.logout(reason);
    } catch (error) {
      addNotification({
        id: `queue-toggle-failed-${pendingQueue.queueId}-${Date.now()}`,
        level: 'error',
        title: strings.queues.logoutFailed,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoadingQueueIds(prev => {
        const next = new Set(prev);
        next.delete(pendingQueue.queueId);
        return next;
      });
      setLogoutPicker({ open: false, reasons: [], pendingQueue: null, loading: false });
    }
  };

  const handleLogoutReasonCancel = () => {
    const { pendingQueue } = logoutPicker;
    if (pendingQueue) {
      setLoadingQueueIds(prev => {
        const next = new Set(prev);
        next.delete(pendingQueue.queueId);
        return next;
      });
    }
    setLogoutPicker({ open: false, reasons: [], pendingQueue: null, loading: false });
  };

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex flex-wrap gap-6 mb-8">
          <QueueStatsCard
            label={strings.queues.totalQueues}
            value={stats.total}
            variant="default"
            className="w-[220px]"
          />
          <QueueStatsCard
            label={strings.queues.loggedIn}
            value={stats.loggedIn}
            variant="success"
            className="w-[220px]"
          />
          <QueueStatsCard
            label={strings.queues.loggedOut}
            value={stats.loggedOut}
            variant="danger"
            className="w-[220px]"
          />
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {strings.queues.myQueues}
        </h2>

        <div className="mb-4">
          <QueueSearchBar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </div>

        <QueueTable
          queues={filteredQueues}
          onToggleQueue={handleToggleQueue}
          isUserLoggedIn={isUserLoggedIn}
          loadingQueueIds={loadingQueueIds}
        />
      </div>
    </div>
    <LogoutReasonDialog
      open={logoutPicker.open}
      reasons={logoutPicker.reasons}
      loading={logoutPicker.loading}
      onConfirm={handleLogoutReasonConfirm}
      onCancel={handleLogoutReasonCancel}
    />
    </>
  );
}

export { QueuesPage };
