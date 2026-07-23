import { Loader2, LogIn, LogOut } from 'lucide-react';
import type { TeamViewMember, TeamViewMemberQueue } from '@avaya/infinity-agent-sdk';
import { Button } from '@/components/ui/button';
import { MemberAvatar } from './MemberAvatar';
import { MemberQueuesTable } from './MemberQueuesTable';
import { MemberInteractionsTable } from './MemberInteractionsTable';
import { MemberStatusBadge } from './MemberStatusBadge';
import { RelativeTimeBadge } from '@/components/shared/RelativeTimeBadge';
import { strings } from '@/locales/en';

interface TeamViewMemberDetailProps {
  member: TeamViewMember;
  isCurrentUser: boolean;
  isTeamViewAdmin: boolean;
  isCxActionInFlight: boolean;
  queueActionInFlight: Set<string>;
  onLoginToCx: (member: TeamViewMember) => void;
  onLogoutFromCx: (member: TeamViewMember) => void;
  onToggleQueue: (member: TeamViewMember, queue: TeamViewMemberQueue, enable: boolean) => void;
}

function TeamViewMemberDetail({
  member,
  isCurrentUser,
  isTeamViewAdmin,
  isCxActionInFlight,
  queueActionInFlight,
  onLoginToCx,
  onLogoutFromCx,
  onToggleQueue,
}: TeamViewMemberDetailProps) {
  const canLogin = member.canLoginToCx();
  const canLogout = member.canLogoutFromCx();

  return (
    <div className="p-4 space-y-4">
      {/* Header strip */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
        <MemberAvatar
          fullName={member.userFullName}
          seed={member.userId}
          isLoggedInToCx={member.isLoggedInToCx}
          isCurrentUser={isCurrentUser}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 truncate">
            {member.userFullName}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <MemberStatusBadge status={member.currentStatus} isLoggedInToCx={member.isLoggedInToCx} />
            <RelativeTimeBadge
              timestamp={member.statusLastUpdatedAt}
              className="text-sm text-gray-500"
            />
          </div>
        </div>

        {/* CX login/logout button — only when admin permits the action. */}
        {canLogout && (
          <Button
            variant="destructive"
            onClick={() => onLogoutFromCx(member)}
            disabled={isCxActionInFlight}
          >
            {isCxActionInFlight ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut aria-hidden="true" />
            )}
            {strings.common.logoutFromCX}
          </Button>
        )}
        {canLogin && (
          <Button
            variant="success"
            onClick={() => onLoginToCx(member)}
            disabled={isCxActionInFlight}
          >
            {isCxActionInFlight ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <LogIn aria-hidden="true" />
            )}
            {strings.common.loginToCX}
          </Button>
        )}
      </div>

      {/* Queues section */}
      <section aria-label={strings.teamView.queues.sectionTitle}>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
          {strings.teamView.queues.sectionTitle}
        </h3>
        <MemberQueuesTable
          member={member}
          isTeamViewAdmin={isTeamViewAdmin}
          queueActionInFlight={queueActionInFlight}
          onToggleQueue={(queue, enable) => onToggleQueue(member, queue, enable)}
        />
      </section>

      {/* Interactions section */}
      <section aria-label={strings.teamView.interactions.sectionTitle}>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
          {strings.teamView.interactions.sectionTitle}
        </h3>
        <MemberInteractionsTable interactions={member.assignedInteractions} />
      </section>
    </div>
  );
}

export { TeamViewMemberDetail };
