import type { Interaction } from '@avaya/infinity-agent-sdk';
import { InteractionIcon } from './InteractionIcon';
import { Badge } from '@/components/ui/badge';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';
import { TimerDisplay } from './TimerDisplay';

interface InteractionCardProps {
  interaction: Interaction;
  isSelected?: boolean;
  onClick?: (interaction: Interaction) => void;
}

const statusColors: Record<string, string> = {
  connected: 'text-blue-700',
  hold: 'text-amber-600',
};

/**
 * InteractionCard Component
 * 
 * Displays a single interaction in the list panel.
 * Shows channel icon, customer info, queue, and duration.
 * Supports selected state and click handling.
 */
function InteractionCard({ interaction, isSelected = false, onClick }: InteractionCardProps) {
  const { communicationType, currentStatus, customer, queueDetails, startTime, transferDetails } = interaction;
  const channelLabel = communicationType.toString();
  const statusLabel = strings.interactions.status[currentStatus as keyof typeof strings.interactions.status];
  const customerName = customer.name?.length > 0 ? customer.name : "Guest";
  const queueName = queueDetails.name;

  /**
   * Derives a human-readable transfer description when the interaction originated from a transfer.
   * For attended transfers, appends the originating agent's name when available.
   * @example "Blind Transfer" | "Attended Transfer from John Doe" | null
   */
  const transferDescription = !interaction.isOwner && transferDetails?.transferType === 'blind'
    ? 'Blind Transfer'
    : !interaction.isOwner && transferDetails?.transferType === 'attended'
      ? `Attended Transfer${transferDetails.user?.name ? ` from ${transferDetails.user.name}` : ''}`
      : null;
  
  const handleClick = () => {
    onClick?.(interaction);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(interaction);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${transferDescription ? transferDescription + ' - ' : ''}${interaction.isElite ? 'Elite ' : ''}${channelLabel} with ${customerName}, ${statusLabel}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        isSelected
          ? 'bg-blue-50 border-blue-600 border-2'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      )}
    >
      <InteractionIcon communicationType={communicationType} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-[10px] font-semibold uppercase', statusColors[currentStatus.toString()] || 'text-gray-600')}>
            {channelLabel} - {statusLabel}
          </span>
          {interaction.isElite && (
            <Badge
              variant="accent"
              className="px-1.5 py-0 text-[9px] uppercase tracking-wide"
              aria-label={strings.interactions.eliteBadgeAriaLabel}
            >
              {strings.interactions.eliteBadge}
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 truncate">{customerName}</p>
        <p className="text-xs text-gray-500 truncate">
          {queueName}
        </p>
        {interaction.isViewer() && (
          <p role="status" className="text-[10px] font-medium text-purple-700 truncate">
            {interaction.ownerDetails?.fullName
              ? `Viewing ${interaction.ownerDetails.fullName}`
              : 'Viewing'}
          </p>
        )}
        {transferDescription && (
          <p role="status" className="text-[10px] font-medium text-blue-700 truncate">
            {transferDescription}
          </p>
        )}
      </div>

      {/* Duration badge for active calls */}
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 shrink-0">
          <TimerDisplay startTime={startTime} />
        </Badge>
    </div>
  );
}

export { InteractionCard };
