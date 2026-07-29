import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserInitials } from '@/utils/userUtils';
import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  fullName: string;
  seed: string;
  isLoggedInToCx: boolean;
  /**
   * When true, uses the same Avaya brand color as the top-bar UserAvatar
   * instead of a deterministic palette color. Set this for the current user.
   */
  isCurrentUser?: boolean;
  size?: 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

const dotSizeClasses = {
  md: 'h-2.5 w-2.5 ring-2',
  lg: 'h-3 w-3 ring-[3px]',
} as const;

const palette = [
  'bg-blue-600',
  'bg-purple-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-pink-600',
  'bg-orange-600',
  'bg-cyan-600',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

// Matches the top-bar UserAvatar's hardcoded Avaya brand color.
const CURRENT_USER_BG = 'bg-[#003a51]';

function MemberAvatar({
  fullName,
  seed,
  isLoggedInToCx,
  isCurrentUser = false,
  size = 'md',
  className,
}: MemberAvatarProps) {
  const initials = getUserInitials(fullName);
  const bgColor = isCurrentUser ? CURRENT_USER_BG : colorFor(seed);

  return (
    <div className={cn('relative shrink-0', className)}>
      <Avatar className={cn(sizeClasses[size], bgColor)}>
        <AvatarFallback className={cn(bgColor, 'text-white font-semibold')}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0 right-0 rounded-full ring-white',
          dotSizeClasses[size],
          isLoggedInToCx ? 'bg-green-500' : 'bg-gray-400'
        )}
      />
    </div>
  );
}

export { MemberAvatar };
