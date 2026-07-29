import { Loader2 } from 'lucide-react';
import type { TeamViewMember, TeamViewMemberQueue } from '@avaya/infinity-agent-sdk';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RelativeTimeBadge } from '@/components/shared/RelativeTimeBadge';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface MemberQueuesTableProps {
  member: TeamViewMember;
  isTeamViewAdmin: boolean;
  queueActionInFlight: Set<string>;
  onToggleQueue: (queue: TeamViewMemberQueue, enable: boolean) => void;
}

function getDisableReason(
  member: TeamViewMember,
  isTeamViewAdmin: boolean
): 'notAdmin' | 'elite' | 'cxLoggedOut' | null {
  // Not-admin is the most fundamental block — without admin permission, no
  // queue action is possible regardless of member state.
  if (!isTeamViewAdmin) return 'notAdmin';
  // Elite Voice rule: treat undefined as Elite to fail safe (matches the SDK's
  // own canLogin/canLogout block on Elite-or-unknown members).
  if (member.isEliteVoiceEnabled !== false) return 'elite';
  if (!member.isLoggedInToCx) return 'cxLoggedOut';
  return null;
}

function MemberQueuesTable({
  member,
  isTeamViewAdmin,
  queueActionInFlight,
  onToggleQueue,
}: MemberQueuesTableProps) {
  const queues = member.assignedQueues;
  const disableReason = getDisableReason(member, isTeamViewAdmin);
  // Composite key matches the one set in TeamViewPage.handleToggleQueue —
  // ensures a queue's in-flight state is scoped to the specific member.
  const inFlightKey = (queueId: string) => `${member.userId}:${queueId}`;
  const tooltipText =
    disableReason === 'notAdmin'
      ? strings.teamView.queues.tooltipNotAdmin
      : disableReason === 'elite'
        ? strings.teamView.queues.tooltipElite
        : disableReason === 'cxLoggedOut'
          ? strings.teamView.queues.tooltipCxLoggedOut
          : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.queues.columnQueueName}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.queues.columnStatus}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.queues.columnLoginTime}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.queues.columnEnable}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queues.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-sm text-gray-500"
              >
                {strings.teamView.queues.noQueues}
              </TableCell>
            </TableRow>
          ) : (
            queues.map((queue) => {
              const inFlight = queueActionInFlight.has(inFlightKey(queue.queueId));
              const switchDisabled = inFlight || disableReason !== null;
              const loginMs =
                queue.isLoggedIn && queue.loginTimeUnix
                  ? queue.loginTimeUnix * 1000
                  : null;
              return (
                <TableRow key={queue.queueId}>
                  <TableCell className="py-4 font-medium text-gray-900">
                    {queue.name}
                  </TableCell>
                  <TableCell className="py-4">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        queue.isLoggedIn ? 'text-green-600' : 'text-red-500'
                      )}
                    >
                      {queue.isLoggedIn
                        ? strings.teamView.queues.statusLoggedIn
                        : strings.teamView.queues.statusLoggedOut}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'min-w-[78px] justify-center font-medium',
                        queue.isLoggedIn
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {loginMs === null ? (
                        strings.teamView.queues.noLoginTime
                      ) : (
                        <RelativeTimeBadge timestamp={loginMs} format="long" />
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <QueueToggle
                        queue={queue}
                        disabled={switchDisabled}
                        tooltip={switchDisabled ? tooltipText : null}
                        onToggle={(enable) => onToggleQueue(queue, enable)}
                      />
                      {inFlight && (
                        <Loader2
                          className="size-4 animate-spin text-gray-400"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface QueueToggleProps {
  queue: TeamViewMemberQueue;
  disabled: boolean;
  tooltip: string | null;
  onToggle: (enable: boolean) => void;
}

function QueueToggle({ queue, disabled, tooltip, onToggle }: QueueToggleProps) {
  const switchEl = (
    <Switch
      checked={queue.isLoggedIn}
      disabled={disabled}
      onCheckedChange={onToggle}
      aria-label={strings.teamView.queues.toggleAriaLabel(queue.name)}
      className="data-[state=checked]:bg-green-600"
    />
  );

  if (!tooltip) return switchEl;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span wrapper lets the tooltip fire over the disabled switch */}
        <span className="inline-flex">{switchEl}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { MemberQueuesTable };
