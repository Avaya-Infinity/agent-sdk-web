import { ReasonType } from '@avaya/infinity-agent-sdk';
import type { ReasonCode } from '@avaya/infinity-agent-sdk';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ReasonCode | null;
  isLoggedInToCx: boolean;
  onClick?: () => void;
}

/**
 * Get badge variant based on status type
 */
const getStatusVariant = (type: ReasonType | undefined): 'available' | 'busy' | 'away' | 'offline' | 'secondary' => {
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
};

/**
 * StatusBadge Component
 * Displays current user status with appropriate color using shadcn Badge
 */
export const StatusBadge = ({ status, isLoggedInToCx, onClick }: StatusBadgeProps) => {
  const handleClick = () => {
    if (isLoggedInToCx && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLoggedInToCx && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const variant = isLoggedInToCx ? getStatusVariant(status?.type) : 'secondary';
  const displayText = isLoggedInToCx 
    ? (status?.reason || 'Loading...') 
    : 'Not logged in';

  const ariaLabel = isLoggedInToCx 
    ? `Status: ${displayText}. Click to change status`
    : 'Status: Not logged in. Login to CX to change status';

  return (
    <Badge 
      variant={variant}
      className={cn(
        'min-w-[76px] justify-center',
        isLoggedInToCx 
          ? 'cursor-pointer hover:opacity-90 transition-opacity' 
          : 'cursor-not-allowed opacity-70'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isLoggedInToCx ? 0 : -1}
      aria-label={ariaLabel}
      aria-disabled={!isLoggedInToCx}
    >
      {displayText}
    </Badge>
  );
};
