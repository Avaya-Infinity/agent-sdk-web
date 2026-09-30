import { ReasonType, type ReasonCode } from '@avaya/infinity-agent-sdk';
import { Badge } from '@/components/ui/badge';
import { strings } from '@/locales/en';

type StatusBadgeVariant = 'available' | 'busy' | 'away';

/**
 * Maps a {@link ReasonType} to the demo-app status badge variant and display label.
 */
function getTypePresentation(type: ReasonType): { variant: StatusBadgeVariant; label: string } {
  switch (type) {
    case ReasonType.AVAILABLE:
      return { variant: 'available', label: strings.userProfile.available };
    case ReasonType.BUSY:
      return { variant: 'busy', label: strings.userProfile.busy };
    case ReasonType.AWAY:
      return { variant: 'away', label: strings.userProfile.away };
    default:
      return { variant: 'available', label: type };
  }
}

interface LoginStatusOptionLabelProps {
  /** The assignable reason code to render. */
  reasonCode: ReasonCode;
}

/**
 * Renders a combined StatusType + Status label for login status select options.
 */
export function LoginStatusOptionLabel({ reasonCode }: LoginStatusOptionLabelProps) {
  const { variant, label: typeLabel } = getTypePresentation(reasonCode.type);
  const reasonLabel = reasonCode.reason?.trim() || typeLabel;

  return (
    <span className="flex items-center gap-2 w-full min-w-0">
      <Badge variant={variant} className="shrink-0 px-2 py-0 text-[10px] uppercase tracking-wide">
        {typeLabel}
      </Badge>
      <span className="truncate flex-1 min-w-0">{reasonLabel}</span>
      {reasonCode.eliteAuxCode !== undefined && (
        <Badge
          variant="accent"
          className="shrink-0"
          aria-label={`${strings.userProfile.eliteAuxBadge} ${reasonCode.eliteAuxCode}`}
        >
          {strings.userProfile.eliteAuxBadge} {reasonCode.eliteAuxCode}
        </Badge>
      )}
    </span>
  );
}
