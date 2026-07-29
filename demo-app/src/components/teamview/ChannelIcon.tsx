import { Phone, Mail, MessageSquare, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelIconProps {
  /**
   * Communication type as string. Typed loosely (rather than the SDK's
   * `InteractionCommType` enum) because two parallel declarations of that
   * enum currently exist inside the SDK; consumers can pass either variant
   * here without TypeScript complaining.
   */
  commType: string;
  className?: string;
}

function ChannelIcon({ commType, className }: ChannelIconProps) {
  const merged = cn('size-3.5', className);
  switch (commType) {
    case 'phone':
      return <Phone className={merged} aria-hidden="true" />;
    case 'email':
      return <Mail className={merged} aria-hidden="true" />;
    case 'messaging':
      return <MessageSquare className={merged} aria-hidden="true" />;
    default:
      return <Hash className={merged} aria-hidden="true" />;
  }
}

export { ChannelIcon };
