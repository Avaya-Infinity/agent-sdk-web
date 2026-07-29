import type { TeamViewMemberInteraction } from '@avaya/infinity-agent-sdk';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { ChannelIcon } from './ChannelIcon';
import { RelativeTimeBadge } from '@/components/shared/RelativeTimeBadge';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface MemberInteractionsTableProps {
  interactions: TeamViewMemberInteraction[];
}

// Status values are typed as `string` (rather than the SDK's `InteractionStatus`
// enum) because two parallel declarations of that enum currently exist inside
// the SDK; the runtime values are stable string literals so we can pivot on them.
function getStatusClassName(status: string): string {
  switch (status) {
    case 'connected':
      return 'text-green-600';
    case 'hold':
      return 'text-amber-600';
    case 'wrapUp':
      return 'text-blue-600';
    case 'completed':
      return 'text-gray-500';
    case 'pending':
      return 'text-orange-600';
    default:
      return 'text-gray-700';
  }
}

function getSubTypeLabel(subType: string): string | null {
  const normalized = subType?.toLowerCase();
  if (normalized === 'inbound') return strings.teamView.interactions.subTypes.inbound;
  if (normalized === 'outbound') return strings.teamView.interactions.subTypes.outbound;
  return null;
}

function getStatusLabel(status: string): string {
  const key = status as keyof typeof strings.interactions.status;
  return strings.interactions.status[key] ?? status;
}

function MemberInteractionsTable({ interactions }: MemberInteractionsTableProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-24 text-center">
              {strings.teamView.interactions.columnType}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.interactions.columnSubject}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.interactions.columnStatus}
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {strings.teamView.interactions.columnTimeElapsed}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {interactions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-12 text-center text-sm text-gray-500"
              >
                {strings.teamView.interactions.noInteractions}
              </TableCell>
            </TableRow>
          ) : (
            interactions.map((interaction) => {
              const subTypeLabel = getSubTypeLabel(interaction.communicationSubType);
              return (
                <TableRow key={interaction.interactionId}>
                  <TableCell className="py-4">
                    <div className="flex flex-col items-center gap-1">
                      <ChannelIcon
                        commType={interaction.communicationType as string}
                        className="size-5 text-gray-700"
                      />
                      {subTypeLabel && (
                        <span className="text-xs text-gray-600">
                          {subTypeLabel}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-gray-900">
                    {interaction.subject || strings.teamView.interactions.noSubject}
                  </TableCell>
                  <TableCell className="py-4">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        getStatusClassName(interaction.status as string)
                      )}
                    >
                      {getStatusLabel(interaction.status as string)}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium min-w-[60px] justify-center">
                      <RelativeTimeBadge timestamp={interaction.startTime} format='long'/>
                    </span>
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

export { MemberInteractionsTable };
