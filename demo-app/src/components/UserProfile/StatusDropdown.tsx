import { ReasonType } from '@avaya/infinity-agent-sdk';
import type { ReasonCode } from '@avaya/infinity-agent-sdk';
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

interface StatusDropdownProps {
  onClose: () => void;
  filteredReasonCodes: ReasonCode[];
  selectedStatusType: ReasonType;
  selectedReasonCode: string;
  statusChangeLoading: boolean;
  setSelectedReasonCode: (code: string) => void;
  handleStatusChange: () => Promise<boolean>;
  handleStatusTypeChange: (newType: ReasonType) => void;
}

/**
 * Status form fields for changing availability (legacy Dialog wrapper).
 * Prefer {@link ChangeStatusControl} in the CxMenu Popover for new UI.
 */
export const StatusDropdown = ({
  onClose,
  filteredReasonCodes,
  selectedStatusType,
  selectedReasonCode,
  statusChangeLoading,
  setSelectedReasonCode,
  handleStatusChange,
  handleStatusTypeChange,
}: StatusDropdownProps) => {
  const handleApply = async () => {
    const success = await handleStatusChange();
    if (success) {
      onClose();
    }
  };

  return (
    <>

      {/* Status Type Select */}
      <div className="mb-4">
        <Label htmlFor="status-type-select" className="text-gray-600 mb-2 block">
          {strings.userProfile.statusType}
        </Label>
        <Select
          value={selectedStatusType}
          onValueChange={(value) => handleStatusTypeChange(value as ReasonType)}
          disabled={statusChangeLoading}
        >
          <SelectTrigger id="status-type-select">
            <SelectValue placeholder={strings.userProfile.selectStatusType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ReasonType.AVAILABLE}>{strings.userProfile.available}</SelectItem>
            <SelectItem value={ReasonType.AWAY}>{strings.userProfile.away}</SelectItem>
            <SelectItem value={ReasonType.BUSY}>{strings.userProfile.busy}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reason Code Select */}
      <div className="mb-5">
        <Label htmlFor="reason-code-select" className="text-gray-600 mb-2 block">
          {strings.userProfile.reason}
        </Label>
        {filteredReasonCodes.length > 0 ? (
          <Select
            value={selectedReasonCode}
            onValueChange={setSelectedReasonCode}
            disabled={statusChangeLoading}
          >
            <SelectTrigger id="reason-code-select">
              <SelectValue placeholder={strings.userProfile.selectReason} />
            </SelectTrigger>
            <SelectContent>
              {filteredReasonCodes
                .filter((code) => code.reason)
                .map((code, idx) => (
                  <SelectItem key={idx} value={code.reason!}>
                    <span className="flex items-center gap-2 w-full">
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
          <p className="text-sm text-gray-400">
            {strings.userProfile.noReasonCodes} {selectedStatusType}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={onClose}
        >
          {strings.userProfile.cancel}
        </Button>
        <Button
          onClick={handleApply}
          disabled={statusChangeLoading}
        >
          {statusChangeLoading ? strings.userProfile.applying : strings.userProfile.apply}
        </Button>
      </div>
    </>
  );
};
