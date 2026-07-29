import { ReasonType, type ReasonCode } from '@avaya/infinity-agent-sdk';
import { Badge } from '@/components/ui/badge';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface MemberStatusBadgeProps {
  status: ReasonCode;
  isLoggedInToCx: boolean;
  className?: string;
}

function getVariant(
  status: ReasonCode,
  isLoggedInToCx: boolean
): 'available' | 'busy' | 'away' | 'offline' | 'secondary' {
  if (!isLoggedInToCx) return 'secondary';
  switch (status.type) {
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

function getLabel(status: ReasonCode, isLoggedInToCx: boolean): string {
  if (!isLoggedInToCx) return strings.teamView.notLoggedIn;
  if (status.reason && status.reason.length > 0) return status.reason;
  // Fall back to a sensible label derived from the type.
  switch (status.type) {
    case ReasonType.AVAILABLE:
      return strings.userProfile.available;
    case ReasonType.BUSY:
      return strings.userProfile.busy;
    case ReasonType.AWAY:
      return strings.userProfile.away;
    case ReasonType.OFFLINE:
      return strings.userProfile.offline;
    default:
      return status.type;
  }
}

function MemberStatusBadge({ status, isLoggedInToCx, className }: MemberStatusBadgeProps) {
  return (
    <Badge variant={getVariant(status, isLoggedInToCx)} className={cn('justify-center', className)}>
      {getLabel(status, isLoggedInToCx)}
    </Badge>
  );
}

export { MemberStatusBadge };
