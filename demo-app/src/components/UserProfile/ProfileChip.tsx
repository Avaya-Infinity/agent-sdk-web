import { type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { ReasonType, type ReasonCode } from '@avaya/infinity-agent-sdk';
import { UserAvatar } from './UserAvatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { strings } from '@/locales/en';

interface ProfileChipProps {
  /** Agent display name; falls back to {@link email} when empty. */
  fullName: string | undefined;
  /** Used when {@link fullName} is empty. */
  email?: string;
  /** Current assignable status from the SDK. */
  status: ReasonCode | null;
  /** When false, the status row is read-only. */
  isLoggedInToCx: boolean;
  /** Opens the profile menu (audio, diagnostics, sign out). */
  onProfileMenuClick: () => void;
}

type StatusVariant = 'available' | 'busy' | 'away' | 'offline' | 'secondary';

/**
 * Maps a {@link ReasonType} to the demo-app badge variant used on the profile chip.
 */
function getStatusVariant(type: ReasonType | undefined): StatusVariant {
  switch (type) {
    case ReasonType.AVAILABLE:
      return 'available';
    case ReasonType.BUSY:
      return 'busy';
    case ReasonType.AWAY:
      return 'away';
    case ReasonType.OFFLINE:
      return 'offline';
    default:
      return 'secondary';
  }
}

/**
 * Maps a {@link ReasonType} to a short display label.
 */
function getTypeLabel(type: ReasonType | undefined): string {
  switch (type) {
    case ReasonType.AVAILABLE:
      return strings.userProfile.available;
    case ReasonType.BUSY:
      return strings.userProfile.busy;
    case ReasonType.AWAY:
      return strings.userProfile.away;
    case ReasonType.OFFLINE:
      return strings.userProfile.offline;
    default:
      return strings.userProfile.unavailable;
  }
}

interface ProfileChipStatusRowProps {
  status: ReasonCode | null;
  isLoggedInToCx: boolean;
}

/**
 * Row 2 of the profile chip: status type pill and optional reason suffix.
 */
function ProfileChipStatusRow({
  status,
  isLoggedInToCx,
}: ProfileChipStatusRowProps) {
  if (!isLoggedInToCx) {
    return (
      <div
        className="flex items-center gap-1 min-w-0"
        aria-label={strings.profileChip.notLoggedInAriaLabel}
      >
        <Badge
          variant="secondary"
          className="h-4 px-1.5 py-0 text-[10px] font-semibold gap-1"
        >
          <span
            className="size-1.5 shrink-0 rounded-full bg-gray-400"
            aria-hidden="true"
          />
          {strings.profileChip.notLoggedIn}
        </Badge>
      </div>
    );
  }

  const typeLabel = getTypeLabel(status?.type);
  const reasonLabel = status?.reason?.trim() || typeLabel;
  const showReasonSuffix = reasonLabel !== typeLabel;
  const statusSummary = showReasonSuffix
    ? `${typeLabel}, ${reasonLabel}`
    : typeLabel;

  return (
    <div
      className="flex items-center gap-1 min-w-0 max-w-full"
      aria-label={strings.profileChip.statusDisplayAriaLabel(statusSummary)}
    >
      <Badge
        variant={getStatusVariant(status?.type)}
        className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-semibold gap-1"
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-white/80"
          aria-hidden="true"
        />
        {status ? typeLabel : strings.common.loading}
      </Badge>
      {status && showReasonSuffix && (
        <span className="text-xs text-gray-600 truncate">
          {strings.profileChip.reasonSeparator} {reasonLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Header profile display: avatar, name, read-only status, and profile menu chevron.
 * Rendered without a border; the parent adds a vertical divider after the CxMenu.
 */
export function ProfileChip({
  fullName,
  email,
  status,
  isLoggedInToCx,
  onProfileMenuClick,
}: ProfileChipProps) {
  const displayName = fullName?.trim() || email?.trim() || strings.profileChip.fallbackName;

  const handleProfileKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onProfileMenuClick();
    }
  };

  return (
    <div className="flex min-w-0 max-w-[280px] items-center gap-2">
      <UserAvatar fullName={fullName || email} size="sm" />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span
          className="truncate text-sm font-semibold text-gray-900"
          title={displayName}
        >
          {displayName}
        </span>
        <ProfileChipStatusRow
          status={status}
          isLoggedInToCx={isLoggedInToCx}
        />
      </div>

      <button
        type="button"
        onClick={onProfileMenuClick}
        onKeyDown={handleProfileKeyDown}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md p-1',
          'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400',
        )}
        aria-label={strings.profileChip.openProfileMenuAriaLabel(displayName)}
        aria-haspopup="dialog"
      >
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
