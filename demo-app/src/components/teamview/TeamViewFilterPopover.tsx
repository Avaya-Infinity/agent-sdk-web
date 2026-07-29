import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TEAM_VIEW_STATUS_FILTERS,
  type TeamViewStatusFilter,
} from './teamViewFilters';
import { strings } from '@/locales/en';

interface TeamViewFilterPopoverProps {
  activeFilter: TeamViewStatusFilter;
  onChange: (filter: TeamViewStatusFilter) => void;
}

function TeamViewFilterPopover({ activeFilter, onChange }: TeamViewFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TeamViewStatusFilter>(activeFilter);

  // When the popover transitions to open, sync the draft to whatever is
  // currently active. Uses "compare-during-render" instead of useEffect to
  // avoid the cascading-render issue flagged by react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(activeFilter);
  }

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('all');
    setOpen(false);
  };

  const isFilterActive = activeFilter !== 'all';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={strings.teamView.filters.triggerAriaLabel}
          className="h-10 w-10 p-0 relative data-[state=open]:bg-blue-50 data-[state=open]:border-blue-300 data-[state=open]:text-blue-600"
        >
          <Filter aria-hidden="true" />
          {isFilterActive && (
            <span
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-blue-500"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {strings.teamView.filters.title}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={strings.teamView.filters.closeAriaLabel}
            className="text-gray-400 hover:text-gray-600 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <Label htmlFor="teamview-filter-status">
            {strings.teamView.filters.status}
          </Label>
          <Select
            value={draft}
            onValueChange={(v) => setDraft(v as TeamViewStatusFilter)}
          >
            <SelectTrigger id="teamview-filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAM_VIEW_STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {strings.teamView.filters.statusLabels[filter]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Button variant="secondary" onClick={handleClear} className="w-full">
            {strings.teamView.filters.clear}
          </Button>
          <Button onClick={handleApply} className="w-full">
            {strings.teamView.filters.apply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { TeamViewFilterPopover };
