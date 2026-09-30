import { Loader2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { strings } from '@/locales/en';
import type { Queue } from '@avaya/infinity-agent-sdk';

/**
 * Calculates the duration since the given UTC timestamp and returns a human-readable string.
 * @param loginTime - ISO date in UTC (e.g., "2026-01-29T06:53:38.000Z")
 * @returns Human-readable duration string (e.g., "1 hour", "15 seconds", "2 days")
 */
function getLoggedInDuration(loginTime: Date | undefined): string | null {
  if (!loginTime) return null;

  const now = new Date();
  const diffMs = now.getTime() - loginTime.getTime();

  // Handle invalid dates or future timestamps
  if (isNaN(diffMs) || diffMs < 0) return null;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

interface QueueTableProps {
  queues: Queue[];
  onToggleQueue: (queue: Queue, enabled: boolean) => void;
  isLoading?: boolean;
  isUserLoggedIn?: boolean;
  loadingQueueIds?: Set<string>;
}

/**
 * QueueTable Component
 * 
 * Displays the list of queues with toggle controls.
 */
function QueueTable({ queues, onToggleQueue, isLoading = false, isUserLoggedIn = true, loadingQueueIds }: QueueTableProps) {
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center py-12 text-gray-500"
        role="status"
        aria-live="polite"
      >
        {strings.common.loading}
      </div>
    );
  }

  if (queues.length === 0) {
    return (
      <div 
        className="flex items-center justify-center py-12 text-gray-500"
        role="status"
      >
        {strings.queues.noQueuesFound}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 max-w-[1000px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">
              {strings.queues.columnQueueName}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.queues.columnLoginTime}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
              {strings.queues.columnEnable}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queues.map((queue, index) => (
            <TableRow
              key={queue.queueId}
              className={index % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}
            >
              <TableCell className="py-4">
                <span
                  className={`font-medium ${
                    queue.isLoggedIn ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {queue.queueName}
                </span>
              </TableCell>
              <TableCell className="py-4">
                <span className={queue.isLoggedIn ? 'text-gray-900' : 'text-gray-400'}>
                  {queue.isLoggedIn && queue.loggedInAt
                    ? getLoggedInDuration(queue.loggedInAt)
                    : strings.queues.noLoginTime}
                </span>
              </TableCell>
              <TableCell className="py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  {loadingQueueIds?.has(queue.queueId) && (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-hidden="true" />
                  )}
                  <Switch
                    checked={queue.isLoggedIn}
                    onCheckedChange={(checked) => onToggleQueue(queue, checked)}
                    disabled={!isUserLoggedIn || loadingQueueIds?.has(queue.queueId)}
                    aria-label={`Toggle queue ${queue.queueName}`}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { QueueTable };
export type { Queue };
