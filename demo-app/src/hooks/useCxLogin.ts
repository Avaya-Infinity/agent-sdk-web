import { useState } from 'react';
import { ReasonType, type ReasonCode, type User } from '@avaya/infinity-agent-sdk';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';

interface UseCxLoginReturn {
  cxLoginLoading: boolean;
  handleLoginToCx: () => Promise<void>;
  handleLogoutFromCx: () => Promise<void>;
  logoutReasonPicker: {
    open: boolean;
    reasons: ReasonCode[];
    loading: boolean;
    onConfirm: (reason: ReasonCode) => Promise<void>;
    onCancel: () => void;
  };
}

/**
 * Hook to manage CX login/logout state and operations.
 * Failures surface as toast notifications (consistent with the rest of the app);
 * this hook does not expose an inline error string.
 */
export const useCxLogin = (user: User, onSuccess?: () => void): UseCxLoginReturn => {
  const { addNotification } = useNotifications();
  const [cxLoginLoading, setCxLoginLoading] = useState(false);
  const [logoutPickerOpen, setLogoutPickerOpen] = useState(false);
  const [logoutPickerLoading, setLogoutPickerLoading] = useState(false);
  const [logoutReasons, setLogoutReasons] = useState<ReasonCode[]>([]);

  const notifyError = (titleKey: 'loginFailed' | 'logoutFailed', err: unknown) => {
    addNotification({
      id: `cx-${titleKey}-${Date.now()}`,
      level: 'error',
      title: strings.userProfile[titleKey],
      description: err instanceof Error ? err.message : undefined,
    });
  };

  const handleLoginToCx = async () => {
    setCxLoginLoading(true);

    try {
      await user.loginToCx();
      onSuccess?.();
    } catch (err) {
      notifyError('loginFailed', err);
    } finally {
      setCxLoginLoading(false);
    }
  };

  const handleLogoutFromCx = async () => {
    setCxLoginLoading(true);

    try {
      const reasons = await user.getAssignableReasonCodes();
      setLogoutReasons(reasons.filter(r => r.type === ReasonType.LOGOUT));
      setLogoutPickerOpen(true);
    } catch (err) {
      notifyError('logoutFailed', err);
    } finally {
      setCxLoginLoading(false);
    }
  };

  const handleLogoutReasonConfirm = async (reason: ReasonCode) => {
    setLogoutPickerLoading(true);

    try {
      await user.logoutFromCx(reason);
      setLogoutPickerOpen(false);
      onSuccess?.();
    } catch (err) {
      notifyError('logoutFailed', err);
    } finally {
      setLogoutPickerLoading(false);
    }
  };

  const handleLogoutReasonCancel = () => {
    setLogoutPickerOpen(false);
  };

  return {
    cxLoginLoading,
    handleLoginToCx,
    handleLogoutFromCx,
    logoutReasonPicker: {
      open: logoutPickerOpen,
      reasons: logoutReasons,
      loading: logoutPickerLoading,
      onConfirm: handleLogoutReasonConfirm,
      onCancel: handleLogoutReasonCancel,
    },
  };
};
