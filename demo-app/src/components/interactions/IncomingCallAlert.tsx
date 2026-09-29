import { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';
import type { Interaction } from '@avaya/infinity-agent-sdk';
import { TimerDisplay } from './TimerDisplay';
import { createLogger, getErrorDetails } from '@/utils/logger';

const logger = createLogger('IncomingCallAlert');

interface IncomingCallAlertProps {
  interaction: Interaction;
  disableAccept: boolean;
  onAccept: (interaction: Interaction) => void | Promise<void>;
  onReject: (interaction: Interaction) => void | Promise<void>;
}

/**
 * IncomingCallAlert Component
 *
 * Displays an incoming call alert with customer info and accept/reject buttons.
 * Uses amber/warning styling to draw attention.
 * Includes proper ARIA attributes for accessibility.
 */
function IncomingCallAlert({ interaction, disableAccept, onAccept, onReject }: IncomingCallAlertProps) {
  const [isResponding, setIsResponding] = useState<'accept' | 'reject' | null>(null);
  const { addNotification } = useNotifications();

  const { customer, queueDetails, startTime, transferDetails } = interaction;
  const customerName = customer.name;
  const customerPhone = customer.phone;
  const queueName = queueDetails.name;
  const callerDisplay = customerName || customerPhone;

  /**
   * Derives a human-readable transfer description when the call originated from a transfer.
   * For attended transfers, appends the originating agent's name when available.
   * @example "Blind Transfer" | "Attended Transfer from John Doe" | null
   */
  const transferDescription = transferDetails?.transferType === 'blind'
    ? 'Blind Transfer'
    : transferDetails?.transferType === 'attended'
      ? `Attended Transfer${transferDetails.user?.name ? ` from ${transferDetails.user.name}` : ''}`
      : null;

  const handleAccept = async () => {
    setIsResponding('accept');
    try {
      await onAccept(interaction);
    } catch (error) {
      logger.error('Interaction accept failed', { interactionId: interaction.interactionId, ...getErrorDetails(error) });
      addNotification({
        id: `accept-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.acceptFailed,
        description: error instanceof Error ? error.message : undefined,
      });
      setIsResponding(null);
    }
  };

  const handleReject = async () => {
    setIsResponding('reject');
    try {
      await onReject(interaction);
    } catch (error) {
      logger.error('Interaction reject failed', { interactionId: interaction.interactionId, ...getErrorDetails(error) });
      addNotification({
        id: `reject-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.rejectFailed,
        description: error instanceof Error ? error.message : undefined,
      });
      setIsResponding(null);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label={`${transferDescription ? transferDescription + ' - ' : ''}Incoming call from ${callerDisplay}`}
      className="p-4 rounded-lg bg-amber-50 border-2 border-amber-600"
    >
      <div className="flex items-start gap-3">
        {/* Pulsing phone icon */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-amber-600 rounded-full opacity-20 animate-ping" />
          <div className="relative flex items-center justify-center w-9 h-9 bg-amber-600 rounded-full">
            <Phone className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
        </div>

        {/* Call info */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
            {strings.interactions.incomingCall}
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
            {callerDisplay}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {queueName} - <TimerDisplay startTime={startTime} />
          </p>
          {transferDescription && (
            <p role="status" className="text-xs font-medium text-blue-700 mt-1">
              {transferDescription}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="success"
              size="sm"
              onClick={handleAccept}
              disabled={disableAccept || isResponding !== null}
              title={disableAccept ? 'Microphone permission is required to accept calls.' : undefined}
              aria-label={`Accept call from ${callerDisplay}`}
            >
              {isResponding === 'accept' && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
              {strings.interactions.accept}
            </Button>
            {interaction.canReject() && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={isResponding !== null}
                aria-label={`Reject call from ${callerDisplay}`}
              >
                {isResponding === 'reject' && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
                {strings.interactions.reject}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { IncomingCallAlert };
