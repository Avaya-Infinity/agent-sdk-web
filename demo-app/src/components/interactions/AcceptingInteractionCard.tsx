import { Phone, Loader2 } from 'lucide-react';
import { strings } from '@/locales/en';
import type { Interaction } from '@avaya/infinity-agent-sdk';
import { TimerDisplay } from './TimerDisplay';

interface AcceptingInteractionCardProps {
  interaction: Interaction;
}

/**
 * AcceptingInteractionCard Component
 *
 * Rendered while an accept is in progress for a still-pending inbound
 * interaction. Shows a spinner so the agent can see the SDK is working on
 * their behalf instead of a doorbell that can't be clicked.
 *
 * Visual style is intentionally close to IncomingCallAlert (amber, phone
 * icon) so the transition from ringing → accepting reads as continuous
 * state, not two unrelated cards.
 */
function AcceptingInteractionCard({ interaction }: AcceptingInteractionCardProps) {
  const callerDisplay = interaction.customer.name || interaction.customer.phone;
  const transferDetails = interaction.transferDetails;
  const transferDescription = transferDetails?.transferType === 'blind'
    ? 'Blind Transfer'
    : transferDetails?.transferType === 'attended'
      ? `Attended Transfer${transferDetails.user?.name ? ` from ${transferDetails.user.name}` : ''}`
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Accepting call from ${callerDisplay}`}
      className="p-4 rounded-lg bg-amber-50 border-2 border-amber-600"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="relative flex items-center justify-center w-9 h-9 bg-amber-600 rounded-full">
            <Phone className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
            {strings.interactions.incomingCall}
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
            {callerDisplay}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {interaction.queueDetails.name} - <TimerDisplay startTime={interaction.startTime} />
          </p>
          {transferDescription && (
            <p role="status" className="text-xs font-medium text-blue-700 mt-1">
              {transferDescription}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 text-xs font-medium text-amber-800">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>{strings.interactions.accepting}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AcceptingInteractionCard };
