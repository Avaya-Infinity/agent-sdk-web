import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TeamViewFilterPopover } from './TeamViewFilterPopover';
import type { TeamViewStatusFilter } from './teamViewFilters';
import { strings } from '@/locales/en';

interface TeamViewSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFilter: TeamViewStatusFilter;
  onFilterChange: (filter: TeamViewStatusFilter) => void;
}

function TeamViewSearchBar({
  searchValue,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: TeamViewSearchBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={strings.teamView.filters.searchPlaceholder}
          aria-label={strings.teamView.filters.searchAriaLabel}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-10 border-gray-300"
        />
      </div>
      <TeamViewFilterPopover activeFilter={activeFilter} onChange={onFilterChange} />
    </div>
  );
}

export { TeamViewSearchBar };
