import { useState } from 'react';
import type {
  TeamView,
  TeamViewMember,
  TeamViewSummary,
} from '@avaya/infinity-agent-sdk';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamViewMemberCard } from './TeamViewMemberCard';
import { TeamViewSearchBar } from './TeamViewSearchBar';
import { TeamViewSelector } from './TeamViewSelector';
import {
  applyMemberSearch,
  applyStatusFilter,
  type TeamViewStatusFilter,
} from './teamViewFilters';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface TeamViewListPanelProps {
  summaries: TeamViewSummary[];
  selectedTeamId: string | null;
  onSelectTeam: (teamViewId: string) => void;
  teamView: TeamView | null;
  isLoadingTeam: boolean;
  selectedMemberId: string | null;
  onSelectMember: (member: TeamViewMember) => void;
  currentUserId: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function TeamViewListPanel({
  summaries,
  selectedTeamId,
  onSelectTeam,
  teamView,
  isLoadingTeam,
  selectedMemberId,
  onSelectMember,
  currentUserId,
  onRefresh,
  isRefreshing,
}: TeamViewListPanelProps) {
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<TeamViewStatusFilter>('all');

  // Reset search + filter whenever the user switches teams.
  // Uses the "compare-during-render" idiom rather than a useEffect — this
  // avoids the cascading-render issue flagged by react-hooks/set-state-in-effect.
  const [prevTeamId, setPrevTeamId] = useState(selectedTeamId);
  if (selectedTeamId !== prevTeamId) {
    setPrevTeamId(selectedTeamId);
    setSearchValue('');
    setStatusFilter('all');
  }

  // Computed inline (not memoized): the SDK mutates member fields in place
  // after admin actions and `teamView.refresh()`, and the `teamView` reference
  // doesn't change with those mutations. A useMemo with `[teamView, ...]`
  // deps would hand back a stale filtered list, hiding members whose status
  // changes should have moved them in or out of the active filter.
  const filteredMembers = teamView
    ? applyMemberSearch(
        applyStatusFilter(teamView.members, statusFilter),
        searchValue
      )
    : [];

  const hasFilterOrSearch = statusFilter !== 'all' || searchValue.trim().length > 0;

  return (
    <aside
      className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 h-full"
      aria-label={strings.teamView.pageTitle}
    >
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">
          {strings.teamView.pageTitle}
        </h2>
      </div>

      {summaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
          {strings.teamView.noTeamViews}
        </div>
      ) : (
        <>
          <div className="px-4 py-3 space-y-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <TeamViewSelector
                  summaries={summaries}
                  selectedTeamId={selectedTeamId}
                  onSelect={onSelectTeam}
                  disabled={isLoadingTeam}
                />
              </div>
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={!teamView || isLoadingTeam || isRefreshing}
                aria-label={strings.teamView.refreshAriaLabel}
                className="h-10 w-10 p-0 shrink-0"
              >
                <RefreshCw
                  className={cn(isRefreshing && 'animate-spin')}
                  aria-hidden="true"
                />
              </Button>
            </div>
            <TeamViewSearchBar
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list">
            {isLoadingTeam ? (
              <div
                className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {strings.teamView.loadingTeam}
              </div>
            ) : !teamView ? null : teamView.members.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                {strings.teamView.noMembers}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-500 text-center px-3">
                {hasFilterOrSearch
                  ? strings.teamView.noMatchingMembers
                  : strings.teamView.noMembers}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div key={member.userId} role="listitem">
                  <TeamViewMemberCard
                    member={member}
                    isSelected={member.userId === selectedMemberId}
                    isCurrentUser={member.userId === currentUserId}
                    onClick={onSelectMember}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}

export { TeamViewListPanel };
