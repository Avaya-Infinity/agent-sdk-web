import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ReasonCode } from '@avaya/infinity-agent-sdk';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  encodeLogoutReasonKey,
  isValidLogoutReasonKey,
  resolveSelectedLogoutReason,
} from '@/utils/logoutStatusReasons';
import { createLogger } from '@/utils/logger';
import { strings } from '@/locales/en';

const logger = createLogger('LogoutFromCxControl');

interface LogoutFromCxControlProps {
  /** Assignable logout reason codes ({@link ReasonType.LOGOUT}). */
  logoutStatusReasons: ReasonCode[];
  /** Invoked when the user confirms CX logout with the selected reason. */
  onLogout: (reasonCode: ReasonCode) => void;
  /** Whether a CX logout request is in flight. */
  loading: boolean;
  /** Disables the select and logout button. */
  disabled?: boolean;
  /** Optional id prefix for accessible label/select association. */
  idPrefix?: string;
  /** Confirm button label; defaults to {@link strings.common.logoutFromCX}. */
  confirmLabel?: string;
}

/**
 * Logout reason select and Logout from CX confirm action.
 * Mirrors {@link LoginToCxControl}: pick a reason, then click the button to call the SDK.
 */
export function LogoutFromCxControl({
  logoutStatusReasons,
  onLogout,
  loading,
  disabled = false,
  idPrefix = 'logout-status',
  confirmLabel = strings.common.logoutFromCX,
}: LogoutFromCxControlProps) {
  const selectId = `${idPrefix}-select`;
  const isDisabled = disabled || loading;
  const [selectedKey, setSelectedKey] = useState('');
  const logoutStatusReasonsRef = useRef(logoutStatusReasons);
  logoutStatusReasonsRef.current = logoutStatusReasons;

  useEffect(() => {
    if (selectedKey === '') {
      return;
    }

    if (!isValidLogoutReasonKey(selectedKey, logoutStatusReasons)) {
      setSelectedKey('');
    }
  }, [logoutStatusReasons, selectedKey]);

  const handleValueChange = (key: string) => {
    setSelectedKey(key);
    const reason = resolveSelectedLogoutReason(key, logoutStatusReasonsRef.current);
    logger.info('Logout reason selected', {
      type: reason?.type,
      hasReason: (reason?.reason?.length ?? 0) > 0,
    });
  };

  const handleLogoutClick = () => {
    const reason = resolveSelectedLogoutReason(selectedKey, logoutStatusReasonsRef.current);
    if (!reason) {
      return;
    }

    logger.info('Logout button clicked', {
      type: reason.type,
      hasReason: (reason.reason?.length ?? 0) > 0,
    });
    onLogout(reason);
  };

  const selectedReason = resolveSelectedLogoutReason(selectedKey, logoutStatusReasons);
  const canLogout = selectedReason !== undefined && !isDisabled;

  if (logoutStatusReasons.length === 0) {
    return (
      <p className="text-sm text-gray-500">{strings.cxMenu.noLogoutReasons}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={selectId} className="text-gray-700">
          {strings.cxMenu.logoutReason}
        </Label>
        <p className="text-xs text-gray-500 mt-1">
          {strings.cxMenu.logoutReasonHint}
        </p>
      </div>
      <Select
        value={selectedKey}
        onValueChange={handleValueChange}
        disabled={isDisabled}
      >
        <SelectTrigger
          id={selectId}
          aria-label={strings.cxMenu.logoutReasonAriaLabel}
        >
          <SelectValue placeholder={strings.cxMenu.selectLogoutReason} />
        </SelectTrigger>
        <SelectContent position="popper">
          {logoutStatusReasons.map((reason, index) => {
            const key = encodeLogoutReasonKey(index);
            return (
              <SelectItem key={key} value={key}>
                {reason.reason ?? reason.type}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={handleLogoutClick}
        disabled={!canLogout}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
        {loading ? strings.userProfile.loggingOut : confirmLabel}
      </Button>
    </div>
  );
}
