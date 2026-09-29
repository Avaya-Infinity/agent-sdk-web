import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ReasonType, type ReasonCode } from '@avaya/infinity-agent-sdk';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { strings } from '@/locales/en';

interface ChangeStatusControlProps {
  /** When the parent CxMenu popover is open; used to seed draft values from {@link currentStatus}. */
  menuOpen: boolean;
  /** Latest status shown on the profile chip (display-only there). */
  currentStatus: ReasonCode | null;
  /** Assignable reason codes from the SDK. */
  reasonCodes: ReasonCode[];
  /** Whether a status change request is in flight. */
  loading: boolean;
  /** Disables inputs while CX login/logout runs. */
  disabled?: boolean;
  /** Invoked when the user clicks Apply; returns true on success. */
  onApply: (type: ReasonType, reason: string) => Promise<boolean>;
  /** Optional id prefix for accessible label/select association. */
  idPrefix?: string;
}

/**
 * Change availability controls for the logged-in CxMenu Popover.
 * Uses Popover (not Dialog) so Radix Select commits reliably.
 */
export function ChangeStatusControl({
  menuOpen,
  currentStatus,
  reasonCodes,
  loading,
  disabled = false,
  onApply,
  idPrefix = 'cx-change-status',
}: ChangeStatusControlProps) {
  const typeSelectId = `${idPrefix}-type`;
  const reasonSelectId = `${idPrefix}-reason`;
  const isDisabled = disabled || loading;

  const [statusType, setStatusType] = useState<ReasonType>(ReasonType.AVAILABLE);
  const [reason, setReason] = useState('');

  const [prevMenuOpen, setPrevMenuOpen] = useState(menuOpen);
  if (menuOpen !== prevMenuOpen) {
    setPrevMenuOpen(menuOpen);
    if (menuOpen && currentStatus) {
      setStatusType(currentStatus.type);
      setReason(currentStatus.reason ?? '');
    }
  }

  const filteredReasonCodes = reasonCodes.filter((code) => code.type === statusType);
  const isCurrentStatus = currentStatus !== null
    && currentStatus.type === statusType
    && (currentStatus.reason ?? '') === reason;

  const handleStatusTypeChange = (value: string) => {
    setStatusType(value as ReasonType);
    setReason('');
  };

  const handleApply = async () => {
    if (isCurrentStatus) {
      return;
    }

    await onApply(statusType, reason);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">
          {strings.cxMenu.changeAvailabilitySection}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {strings.cxMenu.changeAvailabilityHint}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={typeSelectId} className="text-gray-700">
          {strings.userProfile.statusType}
        </Label>
        <Select
          value={statusType}
          onValueChange={handleStatusTypeChange}
          disabled={isDisabled}
        >
          <SelectTrigger id={typeSelectId}>
            <SelectValue placeholder={strings.userProfile.selectStatusType} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={ReasonType.AVAILABLE}>{strings.userProfile.available}</SelectItem>
            <SelectItem value={ReasonType.AWAY}>{strings.userProfile.away}</SelectItem>
            <SelectItem value={ReasonType.BUSY}>{strings.userProfile.busy}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={reasonSelectId} className="text-gray-700">
          {strings.userProfile.reason}
        </Label>
        {filteredReasonCodes.length > 0 ? (
          <Select
            value={reason}
            onValueChange={setReason}
            disabled={isDisabled}
          >
            <SelectTrigger id={reasonSelectId}>
              <SelectValue placeholder={strings.userProfile.selectReason} />
            </SelectTrigger>
            <SelectContent position="popper">
              {filteredReasonCodes
                .filter((code) => code.reason)
                .map((code, idx) => (
                  <SelectItem
                    key={`${code.reason}-${idx}`}
                    value={code.reason!}
                    disabled={currentStatus?.type === code.type
                      && (currentStatus.reason ?? '') === (code.reason ?? '')}
                  >
                    <span className="flex items-center gap-2 w-full min-w-0">
                      <span className="truncate flex-1 min-w-0">{code.reason}</span>
                      {code.eliteAuxCode !== undefined && (
                        <Badge
                          variant="accent"
                          className="shrink-0"
                          aria-label={`${strings.userProfile.eliteAuxBadge} ${code.eliteAuxCode}`}
                        >
                          {strings.userProfile.eliteAuxBadge} {code.eliteAuxCode}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-gray-500">
            {strings.userProfile.noReasonCodes} {statusType}
          </p>
        )}
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={handleApply}
        disabled={isDisabled || isCurrentStatus}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
        {loading ? strings.userProfile.applying : strings.userProfile.apply}
      </Button>
    </div>
  );
}
