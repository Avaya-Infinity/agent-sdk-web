import { Check, ChevronDown, Users } from 'lucide-react';
import type { TeamViewSummary } from '@avaya/infinity-agent-sdk';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface TeamViewSelectorProps {
  summaries: TeamViewSummary[];
  selectedTeamId: string | null;
  onSelect: (teamViewId: string) => void;
  disabled?: boolean;
}

function TeamViewSelector({
  summaries,
  selectedTeamId,
  onSelect,
  disabled = false,
}: TeamViewSelectorProps) {
  const currentTeam = summaries.find((s) => s.teamViewId === selectedTeamId);
  const isDisabled = disabled || summaries.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isDisabled}
          aria-label={strings.teamView.selectTeam}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 h-10 border border-gray-300 rounded-md text-sm bg-white',
            'transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            isDisabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:bg-gray-50'
          )}
        >
          <Users className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left truncate text-gray-900">
            {currentTeam?.name ?? strings.teamView.selectTeamPlaceholder}
          </span>
          <ChevronDown className="size-4 text-gray-500 shrink-0" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
      >
        {summaries.map((summary) => {
          const isSelected = summary.teamViewId === selectedTeamId;
          return (
            <DropdownMenuItem
              key={summary.teamViewId}
              onSelect={() => onSelect(summary.teamViewId)}
              className="cursor-pointer"
            >
              <span className="flex-1 truncate">{summary.name}</span>
              {isSelected && (
                <Check className="size-4 text-blue-600 shrink-0 ml-2" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { TeamViewSelector };
