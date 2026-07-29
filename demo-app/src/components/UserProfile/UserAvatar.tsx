import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserInitials } from '@/utils/userUtils';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  fullName: string | undefined;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

/**
 * UserAvatar Component
 * Displays user avatar with initials using shadcn Avatar
 */
export const UserAvatar = ({ 
  fullName, 
  onClick, 
  className,
  size = 'md' 
}: UserAvatarProps) => {
  const initials = getUserInitials(fullName);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Avatar 
      className={cn(
        sizeClasses[size],
        'bg-[#003a51]',
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${fullName || 'User'} profile menu` : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
    >
      <AvatarFallback className="bg-[#003a51] text-white font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};
