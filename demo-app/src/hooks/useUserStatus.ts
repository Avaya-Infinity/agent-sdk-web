import { useState, useEffect } from 'react';
import { ReasonType, UserEventType, AvayaInfinityAgentSdkError } from '@avaya/infinity-agent-sdk';
import type { User, ReasonCode, UserStatusChangedEvent } from '@avaya/infinity-agent-sdk';
import { createLogger } from '@/utils/logger';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';
import { useNotifications } from '@/components/notifications/NotificationProvider';

const logger = createLogger('useUserStatus');

interface UseUserStatusReturn {
  currentStatus: ReasonCode | null;
  reasonCodes: ReasonCode[];
  filteredReasonCodes: ReasonCode[];
  selectedStatusType: ReasonType;
  selectedReasonCode: string;
  statusChangeLoading: boolean;
  setSelectedStatusType: (type: ReasonType) => void;
  setSelectedReasonCode: (code: string) => void;
  handleStatusChange: () => Promise<boolean>;
  handleStatusTypeChange: (newType: ReasonType) => void;
}

/**
 * Hook to manage user status state and operations
 * Handles loading status, reason codes, and status change logic
 */
export const useUserStatus = (user: User): UseUserStatusReturn => {
  const { addNotification } = useNotifications();
  const [currentStatus, setCurrentStatus] = useState<ReasonCode | null>(null);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [selectedStatusType, setSelectedStatusType] = useState<ReasonType>(ReasonType.AVAILABLE);
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>('');

  // Filter reason codes by selected status type
  const filteredReasonCodes = reasonCodes.filter(code => code.type === selectedStatusType);

  useEffect(() => {
    // Load current status
    const loadStatus = async () => {
      try {
        const status = await user.refreshStatus();
        setCurrentStatus(status);
      } catch (err) {
        logger.error('Failed to load current status:', err);
      }
    };

    // Load reason codes
    const loadReasonCodes = async () => {
      try {
        const codes = await user.getAssignableReasonCodes();
        setReasonCodes(codes);
      } catch (err) {
        logger.error('Failed to load reason codes:', err);
      }
    };

    loadStatus();
    loadReasonCodes();

    // Subscribe to status change events
    const statusHandlerId = user.subscribe(UserEventType.USER_STATUS_CHANGED, (event: UserStatusChangedEvent) => {
      logger.log('Status changed event received:', event.payload);
      setCurrentStatus({
        type: event.payload.status.type,
        reason: event.payload.status.reason
      });
      setStatusChangeLoading(false);
    });

    //unsubscribe from status change events
    return () => {
      safeUnsubscribeUser(user, UserEventType.USER_STATUS_CHANGED, statusHandlerId);
    };
  }, [user]);

  const handleStatusTypeChange = (newType: ReasonType) => {
    setSelectedStatusType(newType);
    setSelectedReasonCode('');
  };

  const handleStatusChange = async (): Promise<boolean> => {
    setStatusChangeLoading(true);

    try {
      await user.changeStatus({
        reason: selectedReasonCode || undefined,
        type: selectedStatusType
      });
      return true;
    } catch (err) {
      addNotification({
        id: `status-change-failed-${Date.now()}`,
        level: 'error',
        title: 'Failed to change status',
        description: AvayaInfinityAgentSdkError.is(err) ? (err.detail ?? err.message) : err instanceof Error ? err.message : undefined,
      });
      setStatusChangeLoading(false);
      return false;
    }
  };

  return {
    currentStatus,
    reasonCodes,
    filteredReasonCodes,
    selectedStatusType,
    selectedReasonCode,
    statusChangeLoading,
    setSelectedStatusType,
    setSelectedReasonCode,
    handleStatusChange,
    handleStatusTypeChange,
  };
};
