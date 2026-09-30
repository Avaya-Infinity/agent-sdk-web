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
import { LoginStatusOptionLabel } from '@/components/shared/LoginStatusOptionLabel';
import {
  LOGIN_ONLY_KEY,
  encodeReasonCodeKey,
  isValidReasonCodeKey,
  resolveSelectedLoginReason,
} from '@/utils/loginStatusReasons';
import { createLogger } from '@/utils/logger';
import { strings } from '@/locales/en';

const logger = createLogger('LoginToCxControl');

interface LoginToCxControlProps {
  /** Assignable login status reasons (AVAILABLE, BUSY, AWAY). */
  loginStatusReasons: ReasonCode[];
  /** Invoked when the user confirms CX login with the currently selected initial status. */
  onLogin: (reasonCode?: ReasonCode) => void;
  /** Whether a CX login request is in flight. */
  loading: boolean;
  /** Disables the select and login button. */
  disabled?: boolean;
  /** Whether the caller may choose a status to apply with CX login. */
  allowInitialStatus?: boolean;
  /** Explanation shown when initial status is unavailable. */
  initialStatusUnavailableText?: string;
  /** Optional id prefix for accessible label/select association. */
  idPrefix?: string;
  /** Confirm button label; defaults to {@link strings.common.loginToCX}. */
  confirmLabel?: string;
}

/**
 * Combined initial-status select and Login to CX action.
 * Used in the header CX menu.
 */
export function LoginToCxControl({
  loginStatusReasons,
  onLogin,
  loading,
  disabled = false,
  allowInitialStatus = true,
  initialStatusUnavailableText,
  idPrefix = 'login-status',
  confirmLabel = strings.common.loginToCX,
}: LoginToCxControlProps) {
  const selectId = `${idPrefix}-select`;
  const isDisabled = disabled || loading;

  const [selectedKey, setSelectedKey] = useState(LOGIN_ONLY_KEY);
  const selectedKeyRef = useRef(selectedKey);
  const loginStatusReasonsRef = useRef(loginStatusReasons);
  loginStatusReasonsRef.current = loginStatusReasons;

  useEffect(() => {
    if (!allowInitialStatus) {
      selectedKeyRef.current = LOGIN_ONLY_KEY;
      setSelectedKey(LOGIN_ONLY_KEY);
      return;
    }

    if (selectedKey === LOGIN_ONLY_KEY) {
      return;
    }

    if (!isValidReasonCodeKey(selectedKey, loginStatusReasons)) {
      selectedKeyRef.current = LOGIN_ONLY_KEY;
      setSelectedKey(LOGIN_ONLY_KEY);
    }
  }, [allowInitialStatus, loginStatusReasons, selectedKey]);

  const handleValueChange = (key: string) => {
    selectedKeyRef.current = key;
    setSelectedKey(key);
    const reason = resolveSelectedLoginReason(key, loginStatusReasonsRef.current);
    logger.info('Login status selected', {
      type: reason?.type,
      hasReason: (reason?.reason?.length ?? 0) > 0,
      hasEliteAuxCode: reason?.eliteAuxCode !== undefined,
    });
  };

  const handleLoginClick = () => {
    const reason = allowInitialStatus
      ? resolveSelectedLoginReason(selectedKeyRef.current, loginStatusReasonsRef.current)
      : undefined;
    logger.info('Login button clicked', {
      hasReason: reason !== undefined,
      type: reason?.type,
    });
    onLogin(reason);
  };

  const selectControl = (
    <Select
      value={selectedKey}
      onValueChange={handleValueChange}
      disabled={isDisabled}
    >
      <SelectTrigger
        id={selectId}
        aria-label={strings.userProfile.initialLoginStatusAriaLabel}
      >
        <SelectValue placeholder={strings.userProfile.selectInitialLoginStatus} />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={LOGIN_ONLY_KEY}>
          {strings.userProfile.loginOnlyOption}
        </SelectItem>
        {loginStatusReasons.map((reason, index) => {
          const key = encodeReasonCodeKey(index);
          return (
            <SelectItem key={key} value={key}>
              <LoginStatusOptionLabel reasonCode={reason} />
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  const loginButton = (
    <Button
      type="button"
      variant="success"
      className="w-full"
      onClick={handleLoginClick}
      disabled={isDisabled}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
      {loading ? strings.userProfile.loggingIn : confirmLabel}
    </Button>
  );

  return (
    <div className="space-y-2">
      {allowInitialStatus ? (
        <>
          <div>
            <Label htmlFor={selectId} className="text-muted-foreground">
              {strings.userProfile.initialLoginStatus}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {strings.userProfile.initialLoginStatusHint}
            </p>
          </div>
          {selectControl}
        </>
      ) : initialStatusUnavailableText ? (
        <p className="text-sm text-muted-foreground">{initialStatusUnavailableText}</p>
      ) : null}
      {loginButton}
    </div>
  );
}
