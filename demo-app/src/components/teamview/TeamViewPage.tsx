import { useCallback, useEffect, useState } from 'react';
import {
  AvayaInfinityAgentSdkError,
  type TeamView,
  type TeamViewMember,
  type TeamViewMemberQueue,
  type TeamViewSummary,
  type User,
} from '@avaya/infinity-agent-sdk';
import { ShieldOff } from 'lucide-react';
import { TeamViewListPanel } from './TeamViewListPanel';
import { TeamViewMemberDetail } from './TeamViewMemberDetail';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { createLogger } from '@/utils/logger';
import { strings } from '@/locales/en';

const logger = createLogger('TeamViewPage');

interface TeamViewPageProps {
  user: User;
}

function TeamViewPage({ user }: TeamViewPageProps) {
  const { addNotification } = useNotifications();

  const [summaries, setSummaries] = useState<TeamViewSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamView, setTeamView] = useState<TeamView | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // In-flight admin action tracking (the SDK has no events for these — we track locally).
  const [memberCxInFlight, setMemberCxInFlight] = useState<Set<string>>(new Set());
  const [queueActionInFlight, setQueueActionInFlight] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lightweight re-render trigger. The SDK mutates member/queue objects in place
  // after admin actions; bumping this forces the tree to read the fresh values.
  const [, setTick] = useState(0);
  const triggerRerender = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Load team view summaries on mount.
  useEffect(() => {
    if (!user.hasTeamViewAccess) return;

    try {
      const list = user.getAssignedTeamViews();
      setSummaries(list);
      if (list.length > 0) {
        setSelectedTeamId(list[0].teamViewId);
      }
    } catch (err) {
      logger.error('Failed to read team views', err);
      addNotification({
        id: `team-views-load-failed-${Date.now()}`,
        level: 'error',
        title: strings.teamView.loadTeamViewsFailed,
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [user, addNotification]);

  // Load the selected team view whenever the selection changes.
  useEffect(() => {
    if (!selectedTeamId) return;

    let cancelled = false;
    setIsLoadingTeam(true);

    user
      .getTeamViewById(selectedTeamId)
      .then((loaded) => {
        if (cancelled) return;
        setTeamView(loaded);
        setSelectedMemberId((prevId) => {
          if (prevId && loaded.members.some((m) => m.userId === prevId)) {
            return prevId;
          }
          return loaded.members[0]?.userId ?? null;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Failed to load team view', selectedTeamId, err);
        addNotification({
          id: `team-view-load-failed-${selectedTeamId}-${Date.now()}`,
          level: 'error',
          title: strings.teamView.loadFailed,
          description:
            err instanceof AvayaInfinityAgentSdkError ? err.message : undefined,
        });
        setTeamView(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingTeam(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, selectedTeamId, addNotification]);

  const handleSelectTeam = useCallback((teamViewId: string) => {
    setSelectedMemberId(null);
    setSelectedTeamId(teamViewId);
  }, []);

  const handleSelectMember = useCallback((member: TeamViewMember) => {
    setSelectedMemberId(member.userId);
  }, []);

  const markMemberCxInFlight = useCallback((memberId: string, inFlight: boolean) => {
    setMemberCxInFlight((prev) => {
      const next = new Set(prev);
      if (inFlight) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }, []);

  // Composite key — the same queueId can appear across multiple members, so
  // tracking by queueId alone would bleed in-flight state from one member's
  // queue toggle onto another member's matching queue.
  const markQueueInFlight = useCallback((key: string, inFlight: boolean) => {
    setQueueActionInFlight((prev) => {
      const next = new Set(prev);
      if (inFlight) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // Pull the latest team-view state from the server. Called after every admin
  // action so that fields the in-place mutation does NOT touch (e.g. queue
  // state after a CX login, availability label/reason) reflect the server.
  // Refresh failures here are logged but not toasted — the user already sees
  // the direct outcome of their action.
  const refreshTeamSilently = useCallback(async () => {
    if (!teamView) return;
    try {
      await teamView.refresh();
    } catch (err) {
      logger.warn('teamView.refresh after admin action failed', err);
    }
  }, [teamView]);

  // Explicit refresh triggered from the toolbar button. Failures here are
  // toasted because the user invoked the action and expects feedback.
  const handleRefresh = useCallback(async () => {
    if (!teamView || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await teamView.refresh();
      triggerRerender();
    } catch (err) {
      logger.error('Manual team-view refresh failed', err);
      addNotification({
        id: `team-view-refresh-failed-${Date.now()}`,
        level: 'error',
        title: strings.teamView.refreshFailed,
        description:
          err instanceof AvayaInfinityAgentSdkError ? err.message : undefined,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [teamView, isRefreshing, triggerRerender, addNotification]);

  const handleLoginToCx = useCallback(
    async (member: TeamViewMember) => {
      markMemberCxInFlight(member.userId, true);
      try {
        await member.loginToCx();
        await refreshTeamSilently();
        triggerRerender();
      } catch (err) {
        logger.error('CX login failed', member.userId, err);
        addNotification({
          id: `cx-login-failed-${member.userId}-${Date.now()}`,
          level: 'error',
          title: strings.teamView.cxLoginFailed,
          description:
            err instanceof AvayaInfinityAgentSdkError ? err.message : undefined,
        });
      } finally {
        markMemberCxInFlight(member.userId, false);
      }
    },
    [addNotification, markMemberCxInFlight, refreshTeamSilently, triggerRerender]
  );

  const handleLogoutFromCx = useCallback(
    async (member: TeamViewMember) => {
      markMemberCxInFlight(member.userId, true);
      try {
        await member.logoutFromCx();
        await refreshTeamSilently();
        triggerRerender();
      } catch (err) {
        logger.error('CX logout failed', member.userId, err);
        addNotification({
          id: `cx-logout-failed-${member.userId}-${Date.now()}`,
          level: 'error',
          title: strings.teamView.cxLogoutFailed,
          description:
            err instanceof AvayaInfinityAgentSdkError ? err.message : undefined,
        });
      } finally {
        markMemberCxInFlight(member.userId, false);
      }
    },
    [addNotification, markMemberCxInFlight, refreshTeamSilently, triggerRerender]
  );

  const handleToggleQueue = useCallback(
    async (member: TeamViewMember, queue: TeamViewMemberQueue, enable: boolean) => {
      const key = `${member.userId}:${queue.queueId}`;
      markQueueInFlight(key, true);
      try {
        if (enable) {
          await queue.login();
        } else {
          await queue.logout();
        }
        await refreshTeamSilently();
        triggerRerender();
      } catch (err) {
        logger.error(
          enable ? 'Queue login failed' : 'Queue logout failed',
          { memberId: member.userId, queueId: queue.queueId },
          err
        );
        addNotification({
          id: `queue-toggle-failed-${key}-${Date.now()}`,
          level: 'error',
          title: enable
            ? strings.teamView.queues.queueLoginFailed
            : strings.teamView.queues.queueLogoutFailed,
          description:
            err instanceof AvayaInfinityAgentSdkError
              ? (typeof err.metadata?.serverMessage === 'string' ? err.metadata.serverMessage : err.message)
              : undefined,
        });
      } finally {
        markQueueInFlight(key, false);
      }
    },
    [addNotification, markQueueInFlight, refreshTeamSilently, triggerRerender]
  );

  if (!user.hasTeamViewAccess) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-gray-500" role="status">
            <ShieldOff className="size-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
            <h1 className="text-lg font-medium">{strings.teamView.noAccess}</h1>
          </div>
        </div>
      </div>
    );
  }

  const selectedMember =
    teamView?.members.find((m) => m.userId === selectedMemberId) ?? null;

  return (
    <div className="flex h-full">
      <TeamViewListPanel
        summaries={summaries}
        selectedTeamId={selectedTeamId}
        onSelectTeam={handleSelectTeam}
        teamView={teamView}
        isLoadingTeam={isLoadingTeam}
        selectedMemberId={selectedMemberId}
        onSelectMember={handleSelectMember}
        currentUserId={user.userId}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto bg-gray-100">
          {summaries.length === 0 ? (
            <EmptyState message={strings.teamView.noTeamViews} />
          ) : isLoadingTeam && !teamView ? (
            <EmptyState message={strings.teamView.loadingTeam} />
          ) : !selectedMember ? (
            <EmptyState message={strings.teamView.selectMember} />
          ) : (
            <TeamViewMemberDetail
              key={selectedMember.userId}
              member={selectedMember}
              isCurrentUser={selectedMember.userId === user.userId}
              isTeamViewAdmin={user.isTeamViewAdmin}
              isCxActionInFlight={memberCxInFlight.has(selectedMember.userId)}
              queueActionInFlight={queueActionInFlight}
              onLoginToCx={handleLoginToCx}
              onLogoutFromCx={handleLogoutFromCx}
              onToggleQueue={handleToggleQueue}
            />
          )}
        </main>
        {teamView && (
          <div className="flex justify-end items-center px-4 py-2 text-xs text-gray-500 border-t border-gray-200 bg-white">
            {strings.teamView.lastUpdatedAt} {teamView.lastSyncedAt.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-gray-500">
      {message}
    </div>
  );
}

export { TeamViewPage };
