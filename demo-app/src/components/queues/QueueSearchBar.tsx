import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { strings } from '@/locales/en';

interface QueueSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

/**
 * QueueSearchBar Component
 * 
 * Search input with refresh button for the queue list.
 */
function QueueSearchBar({
  searchValue,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
}: QueueSearchBarProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          type="text"
          placeholder={strings.queues.searchPlaceholder}
          aria-label={strings.queues.searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10 border-gray-300"
        />
      </div>
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-10 gap-2"
      >
        <RefreshCw 
          className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} 
          aria-hidden="true"
        />
        {strings.common.refresh}
      </Button>
    </div>
  );
}

export { QueueSearchBar };
