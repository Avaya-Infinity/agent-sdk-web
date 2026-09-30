import { ChevronDown, Loader2 } from 'lucide-react';
import { ReasonType, type ReasonCode, type User } from '@avaya/infinity-agent-sdk';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoginToCxControl } from '@/components/shared/LoginToCxControl';
import { LogoutFromCxControl } from '@/components/shared/LogoutFromCxControl';
import { ChangeStatusControl } from '@/components/shared/ChangeStatusControl';
import { cn } from '@/lib/utils';
import { strings } from '@/locales/en';
import { canUserSelectInitialStatus } from '@/utils/loginStatusReasons';

interface CxMenuProps {
  /** The signed-in SDK user whose CX state drives the menu content. */
  user: User;
  /** Whether the popover is open (controlled). */
  open: boolean;
  /** Called when the popover open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Whether a CX login or logout request is in flight. */
  cxLoginLoading: boolean;
  /** Assignable initial status reasons for CX login. */
  loginStatusReasons: ReasonCode[];
  /** True while login status reasons are being loaded. */
  loginStatusReasonsLoading: boolean;
  /** Assignable logout reasons for CX logout. */
  logoutStatusReasons: ReasonCode[];
  /** True while logout reasons are being loaded. */
  logoutStatusReasonsLoading: boolean;
  /** Invoked when the user confirms CX login. */
  handleLoginToCx: (reasonCode?: ReasonCode) => Promise<void>;
  /** Invoked when the user confirms CX logout with a reason. */
  handleLogoutFromCx: (reasonCode: ReasonCode) => Promise<void>;
  /** Current status (profile chip display); seeds change-status draft when menu opens. */
  currentStatus: ReasonCode | null;
  /** All assignable reason codes for change-status. */
  statusReasonCodes: ReasonCode[];
  /** Whether changeStatus is in flight. */
  statusChangeLoading: boolean;
  /** Applies a new availability status; returns true on success. */
  onChangeStatus: (type: ReasonType, reason: string) => Promise<boolean>;
}

/**
 * Header CX menu: login panel when logged out; change availability + logout when logged in.
 * Uses Popover (not Dialog) so Radix Select dropdowns commit reliably.
 */
export function CxMenu({
  user,
  open,
  onOpenChange,
  cxLoginLoading,
  loginStatusReasons,
  loginStatusReasonsLoading,
  logoutStatusReasons,
  logoutStatusReasonsLoading,
  handleLoginToCx,
  handleLogoutFromCx,
  currentStatus,
  statusReasonCodes,
  statusChangeLoading,
  onChangeStatus,
}: CxMenuProps) {
  const isLoggedIn = user.isLoggedInToCx;
  const cxActionLoading = cxLoginLoading || statusChangeLoading;

  const handleLogin = async (reasonCode?: ReasonCode) => {
    await handleLoginToCx(reasonCode);
  };

  const handleLogout = async (reasonCode: ReasonCode) => {
    await handleLogoutFromCx(reasonCode);
  };

  const handleApplyStatus = async (type: ReasonType, reason: string) => {
    const success = await onChangeStatus(type, reason);
    if (success) {
      onOpenChange(false);
    }
    return success;
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cxActionLoading}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            isLoggedIn
              ? strings.cxMenu.triggerLoggedInAriaLabel
              : strings.cxMenu.triggerLoggedOutAriaLabel
          }
          className={cn(
            'h-8 gap-1 px-3 font-semibold',
            isLoggedIn
              ? 'border-green-600 bg-green-50 text-green-800 hover:bg-green-100 data-[state=open]:bg-green-100'
              : 'border-green-600 text-green-800 hover:bg-green-50 data-[state=open]:bg-green-50',
          )}
        >
          {cxActionLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : isLoggedIn ? (
            <span
              className="size-2 shrink-0 rounded-full bg-green-600"
              aria-hidden="true"
            />
          ) : null}
          <span>{isLoggedIn ? strings.cxMenu.inCx : strings.common.loginToCX}</span>
          <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {isLoggedIn ? strings.cxMenu.panelLoggedInTitle : strings.cxMenu.panelLoginTitle}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isLoggedIn ? strings.cxMenu.panelLoggedInHint : strings.cxMenu.panelLoginHint}
          </p>
        </div>

        {isLoggedIn ? (
          <div className="space-y-4">
            <ChangeStatusControl
              menuOpen={open}
              currentStatus={currentStatus}
              reasonCodes={statusReasonCodes}
              loading={statusChangeLoading}
              disabled={cxLoginLoading}
              onApply={handleApplyStatus}
              idPrefix="cx-menu-change-status"
            />

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">
                {strings.cxMenu.leaveCxSection}
              </p>
              {logoutStatusReasonsLoading ? (
                <p className="text-sm text-gray-500">{strings.cxMenu.loadingLogoutReasons}</p>
              ) : (
                <LogoutFromCxControl
                  logoutStatusReasons={logoutStatusReasons}
                  onLogout={handleLogout}
                  loading={cxLoginLoading}
                  disabled={statusChangeLoading}
                  idPrefix="cx-menu-logout"
                  confirmLabel={strings.cxMenu.logoutButton}
                />
              )}
            </div>
          </div>
        ) : loginStatusReasonsLoading ? (
          <p className="text-sm text-gray-500">{strings.userProfile.loadingLoginStatusReasons}</p>
        ) : (
          <LoginToCxControl
            loginStatusReasons={loginStatusReasons}
            onLogin={handleLogin}
            loading={cxLoginLoading}
            idPrefix="cx-menu-login"
            confirmLabel={strings.cxMenu.loginButton}
            allowInitialStatus={canUserSelectInitialStatus(user.isEliteVoiceEnabled)}
            initialStatusUnavailableText={strings.cxMenu.eliteInitialStatusUnavailable}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
