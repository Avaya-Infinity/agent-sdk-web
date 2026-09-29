import { useCallback, useEffect, useState } from 'react';
import { type ReasonCode, type User } from '@avaya/infinity-agent-sdk';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { filterLoginStatusReasons } from '@/utils/loginStatusReasons';
import { filterLogoutStatusReasons } from '@/utils/logoutStatusReasons';
import { createLogger, getErrorDetails } from '@/utils/logger';
import { strings } from '@/locales/en';

const logger = createLogger('useCxLogin');

interface UseCxLoginOptions {
  /** Called after a successful CX login or logout. */
  onSuccess?: () => void;
  /**
   * When true, refreshes assignable login/logout reason codes from the SDK.
   * Tie this to the header CxMenu open state for a fresh reason list.
   */
  isCxMenuOpen?: boolean;
}

interface UseCxLoginReturn {
  cxLoginLoading: boolean;
  loginStatusReasons: ReasonCode[];
  loginStatusReasonsLoading: boolean;
  logoutStatusReasons: ReasonCode[];
  logoutStatusReasonsLoading: boolean;
  handleLoginToCx: (reasonCode?: ReasonCode) => Promise<void>;
  handleLogoutFromCx: (reasonCode: ReasonCode) => Promise<void>;
}

/**
 * Hook to manage CX login/logout state and operations for the header CxMenu.
 * Failures surface as toast notifications (consistent with the rest of the app).
 */
export const useCxLogin = (
  user: User,
  options: UseCxLoginOptions = {},
): UseCxLoginReturn => {
  const { onSuccess, isCxMenuOpen = false } = options;
  const { addNotification } = useNotifications();
  const [cxLoginLoading, setCxLoginLoading] = useState(false);
  const [loginStatusReasons, setLoginStatusReasons] = useState<ReasonCode[]>([]);
  const [loginStatusReasonsLoading, setLoginStatusReasonsLoading] = useState(false);
  const [logoutStatusReasons, setLogoutStatusReasons] = useState<ReasonCode[]>([]);
  const [logoutStatusReasonsLoading, setLogoutStatusReasonsLoading] = useState(false);

  const loadLoginStatusReasons = useCallback(async () => {
    setLoginStatusReasonsLoading(true);
    try {
      const codes = await user.getAssignableReasonCodes();
      const filtered = filterLoginStatusReasons(codes);
      setLoginStatusReasons(filtered);
      logger.info('Loaded login status reasons', { count: filtered.length });
    } catch (err) {
      logger.warn('Failed to load login status reasons', { ...getErrorDetails(err) });
      setLoginStatusReasons([]);
    } finally {
      setLoginStatusReasonsLoading(false);
    }
  }, [user]);

  const loadLogoutStatusReasons = useCallback(async () => {
    setLogoutStatusReasonsLoading(true);
    try {
      const codes = await user.getAssignableReasonCodes();
      const filtered = filterLogoutStatusReasons(codes);
      setLogoutStatusReasons(filtered);
      logger.info('Loaded logout status reasons', { count: filtered.length });
    } catch (err) {
      logger.warn('Failed to load logout status reasons', { ...getErrorDetails(err) });
      setLogoutStatusReasons([]);
    } finally {
      setLogoutStatusReasonsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLoginStatusReasons();
    void loadLogoutStatusReasons();
  }, [loadLoginStatusReasons, loadLogoutStatusReasons]);

  useEffect(() => {
    if (!isCxMenuOpen) {
      return;
    }

    if (user.isLoggedInToCx) {
      void loadLogoutStatusReasons();
    } else {
      void loadLoginStatusReasons();
    }
  }, [
    isCxMenuOpen,
    user.isLoggedInToCx,
    loadLoginStatusReasons,
    loadLogoutStatusReasons,
  ]);

  const notifyError = (titleKey: 'loginFailed' | 'logoutFailed', err: unknown) => {
    addNotification({
      id: `cx-${titleKey}-${Date.now()}`,
      level: 'error',
      title: strings.userProfile[titleKey],
      description: err instanceof Error ? err.message : undefined,
    });
  };

  const handleLoginToCx = async (reasonCode?: ReasonCode) => {
    setCxLoginLoading(true);

    try {
      if (reasonCode) {
        logger.info('Logging into CX with initial status', {
          type: reasonCode.type,
          hasReason: (reasonCode.reason?.length ?? 0) > 0,
          hasEliteAuxCode: reasonCode.eliteAuxCode !== undefined,
        });
        await user.loginToCx(reasonCode);
      } else {
        logger.info('Logging into CX without initial status');
        await user.loginToCx();
      }
      logger.info('CX login completed');
      onSuccess?.();
    } catch (err) {
      logger.error('CX login failed', { hasReason: reasonCode !== undefined, ...getErrorDetails(err) });
      notifyError('loginFailed', err);
    } finally {
      setCxLoginLoading(false);
    }
  };

  const handleLogoutFromCx = async (reasonCode: ReasonCode) => {
    setCxLoginLoading(true);

    try {
      logger.info('Logging out of CX', {
        type: reasonCode.type,
        hasReason: (reasonCode.reason?.length ?? 0) > 0,
      });
      await user.logoutFromCx(reasonCode);
      logger.info('CX logout completed');
      onSuccess?.();
    } catch (err) {
      logger.error('CX logout failed', { hasReason: (reasonCode.reason?.length ?? 0) > 0, ...getErrorDetails(err) });
      notifyError('logoutFailed', err);
    } finally {
      setCxLoginLoading(false);
    }
  };

  return {
    cxLoginLoading,
    loginStatusReasons,
    loginStatusReasonsLoading,
    logoutStatusReasons,
    logoutStatusReasonsLoading,
    handleLoginToCx,
    handleLogoutFromCx,
  };
};
