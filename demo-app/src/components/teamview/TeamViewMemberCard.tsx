import type { TeamViewMember } from '@avaya/infinity-agent-sdk';
import { ChannelCountBadges } from './ChannelCountBadges';
import { MemberAvatar } from './MemberAvatar';
import { MemberStatusBadge } from './MemberStatusBadge';
import { RelativeTimeBadge } from '@/components/shared/RelativeTimeBadge';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface TeamViewMemberCardProps {
  member: TeamViewMember;
  isSelected: boolean;
  isCurrentUser: boolean;
  onClick: (member: TeamViewMember) => void;
}

function TeamViewMemberCard({
  member,
  isSelected,
  isCurrentUser,
  onClick,
}: TeamViewMemberCardProps) {
  const handleClick = () => onClick(member);
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(member);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={strings.teamView.memberCardAriaLabel(member.userFullName)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        isSelected
          ? 'bg-blue-50/50 border-blue-600 border-2'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      )}
    >
      <MemberAvatar
        fullName={member.userFullName}
        seed={member.userId}
        isLoggedInToCx={member.isLoggedInToCx}
        isCurrentUser={isCurrentUser}
        size="md"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {member.userFullName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <MemberStatusBadge
            status={member.currentStatus}
            isLoggedInToCx={member.isLoggedInToCx}
            className="text-[10px] px-2 py-0"
          />
          <ChannelCountBadges interactions={member.assignedInteractions} />
        </div>
      </div>

      <RelativeTimeBadge
        timestamp={member.statusLastUpdatedAt}
        className="text-xs text-gray-500 shrink-0 self-start"
      />
    </div>
  );
}

export { TeamViewMemberCard };
