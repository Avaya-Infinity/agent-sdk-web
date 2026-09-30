import { useState } from 'react';
import { InteractionStatus, type Interaction, type User } from '@avaya/infinity-agent-sdk';
import { ChevronRight, Plus } from 'lucide-react';
import { IncomingCallAlert } from './IncomingCallAlert';
import { AcceptingInteractionCard } from './AcceptingInteractionCard';
import { InteractionCard } from './InteractionCard';
import { OutboundDialPanel } from './OutboundDialPanel';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface InteractionListPanelProps {
  user: User;
  interactions: Interaction[];
  disableAcceptIncoming: boolean;
  selectedInteractionId?: string;
  isDiscoverActive: boolean;
  onSelectInteraction: (interaction: Interaction) => void;
  onAcceptIncoming: (interaction: Interaction) => void;
  onRejectIncoming: (interaction: Interaction) => void;
  onDiscoverClick: () => void;
  isUserLoggedIn?: boolean;
}

/**
 * InteractionListPanel Component
 *
 * Left panel containing the "Discover Interactions" tab and the "My Interactions" list.
 * The "+" button next to "My Interactions" opens the Create Outbound Interaction dialog.
 */
function InteractionListPanel({
  user,
  interactions,
  disableAcceptIncoming,
  selectedInteractionId,
  isDiscoverActive,
  onSelectInteraction,
  onAcceptIncoming,
  onRejectIncoming,
  onDiscoverClick,
  isUserLoggedIn = true,
}: InteractionListPanelProps) {
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);

  return (
    <aside
      className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 h-full"
      aria-label="Interactions list"
    >
      {/* Discover Interactions tab */}
      <div className="p-3">
        <button
          type="button"
          onClick={onDiscoverClick}
          aria-pressed={isDiscoverActive}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border text-left transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
            isDiscoverActive
              ? 'bg-blue-50 border-blue-600 text-blue-700'
              : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
          )}
        >
          <span className="text-sm font-semibold">
            {strings.interactions.discoverInteractions}
          </span>
          <ChevronRight
            className={cn('size-4 shrink-0', isDiscoverActive ? 'text-blue-700' : 'text-gray-500')}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Divider separating the Discover tab from the My Interactions list */}
      <div className="border-t border-gray-200" aria-hidden="true" />

      {/* My Interactions header with + button */}
      <div className="p-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500">
          {strings.interactions.myInteractions}
        </h2>
        {user.canCreateOutboundVoiceInteraction && (
          <button
            type="button"
            onClick={() => setIsOutboundOpen(true)}
            disabled={!isUserLoggedIn}
            aria-label={strings.interactions.outboundDial.createInteraction}
            className={cn(
              'inline-flex items-center justify-center h-7 w-12 rounded-full bg-gray-100 text-gray-600 transition-colors',
              'hover:bg-gray-200 hover:text-gray-900',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100'
            )}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Choose a card per item from the interaction's own state:
            viewer or non-pending → InteractionCard
            pending + acceptable  → IncomingCallAlert
            pending + not acceptable (accept in flight) → AcceptingInteractionCard */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3" role="list">
        {interactions.map((interaction) => {
          // Incoming-ring surface:
          //  - PENDING: regular customer ring — shown to the pending owner.
          //  - ATTENDED_TRANSFER: consult ring — shown to a non-viewer non-owner whose
          //    transfer has not yet been answered.
          const isRinging =
            (interaction.currentStatus === InteractionStatus.PENDING && !interaction.isViewer())
            || (
                interaction.currentStatus === InteractionStatus.ATTENDED_TRANSFER
                && !interaction.isViewer()
                && !interaction.isOwner
                && !interaction.transferDetails?.isAnswered
            );
          if (isRinging && interaction.canAccept()) {
            return (
              <div key={interaction.interactionId} role="listitem">
                <IncomingCallAlert
                  interaction={interaction}
                  disableAccept={disableAcceptIncoming}
                  onAccept={onAcceptIncoming}
                  onReject={onRejectIncoming}
                />
              </div>
            );
          }
          if (isRinging) {
            return (
              <div key={interaction.interactionId} role="listitem">
                <AcceptingInteractionCard interaction={interaction} />
              </div>
            );
          }
          return (
            <div key={interaction.interactionId} role="listitem">
              <InteractionCard
                interaction={interaction}
                isSelected={interaction.interactionId === selectedInteractionId && !isDiscoverActive}
                onClick={onSelectInteraction}
              />
            </div>
          );
        })}

        {interactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
            <p className="text-sm">{strings.interactions.noActiveInteractions}</p>
            <p className="text-xs mt-1">{strings.interactions.waitingForInteraction}</p>
          </div>
        )}
      </div>

      {/* Create Outbound Interaction dialog */}
      {user.canCreateOutboundVoiceInteraction && (
        <OutboundDialPanel
          user={user}
          open={isOutboundOpen}
          onOpenChange={setIsOutboundOpen}
          disabled={!isUserLoggedIn}
        />
      )}
    </aside>
  );
}

export { InteractionListPanel };
