import { Phone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InteractionCommType } from '@avaya/infinity-agent-sdk';

interface InteractionIconProps {
  communicationType: InteractionCommType;
  className?: string;
}

const channelConfig: Record<string, { 
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
}> = {
  phone: {
    icon: Phone,
    bgColor: 'bg-blue-600',
  },
  messaging: {
    icon: MessageSquare,
    bgColor: 'bg-purple-600',
  },
};

/**
 * InteractionIcon Component
 * 
 * Displays a channel-specific icon with appropriate styling.
 * Used in interaction cards to visually identify the channel type.
 */
function InteractionIcon({ communicationType, className }: InteractionIconProps) {
  const config = channelConfig[communicationType.toString()];
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
        config.bgColor,
        className
      )}
      aria-hidden="true"
    >
      <IconComponent className="w-4 h-4 text-white" />
    </div>
  );
}

export { InteractionIcon };
