import { useCallback, useState } from 'react';
import { Loader2, Pause, Play, Mic, MicOff, PhoneOff, CheckCircle, CheckSquare, XSquare, Hash, TimerReset } from 'lucide-react';
import { InteractionCommType, type Interaction } from '@avaya/infinity-agent-sdk';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';
import { TimerDisplay } from './TimerDisplay';
import { WrapUpCountdownDisplay } from './WrapUpCountdownDisplay';
import { DtmfDialPad } from './DtmfDialPad';
import { createLogger, getErrorDetails } from '@/utils/logger';

const logger = createLogger('CallControlsBar');

/**
 * Custom Transfer Icon - Two horizontal arrows stacked vertically pointing outward
 * Top arrow points left, bottom arrow points right
 * Provides clear visual indication of transfer/exchange action
 */
function TransferIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Top arrow: pointing left */}
      <line x1="5" y1="8" x2="19" y2="8" />
      <polyline points="10,4 5,8 10,12" />
      {/* Bottom arrow: pointing right */}
      <line x1="19" y1="16" x2="5" y2="16" />
      <polyline points="14,12 19,16 14,20" />
    </svg>
  );
}

/**
 * Spinning ring overlay for circular action buttons to indicate loading state.
 */
function ActionRingSpinner() {
  return (
    <div
      className="absolute inset-[-3px] rounded-full border-2 border-transparent border-t-blue-500 animate-spin pointer-events-none"
      aria-hidden="true"
    />
  );
}

interface CallControlsBarProps {
  interaction: Interaction;
  onHold: (interaction: Interaction) => void | Promise<void>;
  onMute: (interaction: Interaction) => void | Promise<void>;
  onTransfer: (interaction: Interaction) => void;
  onEndCall: (interaction: Interaction) => void | Promise<void>;
  onClosedResolved: (interaction: Interaction) => void | Promise<void>;
  onClosedUnresolved: (interaction: Interaction) => void | Promise<void>;
  onWrapUp: (interaction: Interaction) => void | Promise<void>;
  onExtendWrapUp: (interaction: Interaction) => void | Promise<void>;
}

/**
 * CallControlsBar Component
 *
 * Top bar displaying customer info and call control buttons.
 * Includes hold, mute, transfer, and end call controls.
 * Shows call duration timer.
 */
function CallControlsBar({
  interaction,
  onHold,
  onMute,
  onTransfer,
  onEndCall,
  onClosedResolved,
  onClosedUnresolved,
  onWrapUp,
  onExtendWrapUp,
}: CallControlsBarProps) {
  const [isDtmfPadOpen, setIsDtmfPadOpen] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const { addNotification } = useNotifications();

  const isActionLoading = (action: string) => loadingActions.has(action);

  const withLoading = useCallback(async (action: string, fn: () => void | Promise<void>) => {
    setLoadingActions(prev => new Set(prev).add(action));
    try {
      await fn();
    } catch (error) {
      logger.error('Call control action failed', { actionName: action, interactionId: interaction.interactionId, ...getErrorDetails(error) });
      addNotification({
        id: `call-control-failed-${action}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.controls.actionFailed,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev);
        next.delete(action);
        return next;
      });
    }
  }, [addNotification, interaction.interactionId]);

  const { customer, queueDetails, startTime } = interaction;
  const customerName = customer.name?.length > 0 ? customer.name : "Guest";
  const customerPhone = customer.phone;
  const queueName = queueDetails.name;

  const communicationType = interaction.communicationType;
  const isOnHold = interaction.isHold;
  const isMuted = interaction.isMuted;
  const isPhoneCall = communicationType === InteractionCommType.PHONE;
  const isWrapUp = interaction.canWrapUp();
  const [, setWrapUpTick] = useState<number>(0);

  const channelLabel = strings.interactions.channels[communicationType as keyof typeof strings.interactions.channels];

  return (
    <TooltipProvider>
      <div className="flex flex-col p-4 bg-white rounded-xl shadow-sm">
        <div className="flex flex-row items-center gap-4">
        {/* Customer info */}
        <div className="min-w-0 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {customerName}
            </h2>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 shrink-0">
              {channelLabel}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {customerPhone} - {queueName}
          </p>
        </div>

        {/* Call controls */}
        <div className="flex items-center flex-wrap gap-2 flex-1 justify-end" role="group" aria-label="Call controls">
          {/* Viewer-mode badge — kept so the viewer perspective is visually
              distinguished. Viewer self-action buttons (including START COACHING
              for Elite supervisors) live in ViewerAvatarStrip's right side. */}
          {interaction.isViewer() && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 shrink-0">
              {strings.interactions.transfer.viewing}
            </Badge>
          )}

          {/* Owner controls - only shown when NOT a viewer */}
          {!interaction.isViewer() && !isWrapUp && (
            <>
              {/* Hold/Resume button - Grey style with dark icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative inline-flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="icon"
                      className={cn(
                        'rounded-full w-9 h-9 lg:w-11 lg:h-11 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
                        (!(interaction.canHold() || interaction.canResume()) || isActionLoading('hold')) && 'opacity-50 cursor-not-allowed',
                        isOnHold && interaction.canResume() && !isActionLoading('hold') && 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      )}
                      onClick={() => (interaction.canHold() || interaction.canResume()) && !isActionLoading('hold') && withLoading('hold', () => onHold(interaction))}
                      aria-hidden={!isPhoneCall}
                      aria-disabled={!(interaction.canHold() || interaction.canResume()) || isActionLoading('hold')}
                      aria-pressed={isOnHold}
                      aria-label={isOnHold ? strings.interactions.controls.resumeHold : strings.interactions.controls.hold}
                    >
                      {isOnHold ? (
                        <Play className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                      ) : (
                        <Pause className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                      )}
                    </Button>
                    {isActionLoading('hold') && <ActionRingSpinner />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isOnHold ? strings.interactions.controls.resumeHold : strings.interactions.controls.hold}
                </TooltipContent>
              </Tooltip>

              {/* Mute button - Grey style with dark microphone icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative inline-flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="icon"
                      className={cn(
                        'rounded-full w-9 h-9 lg:w-11 lg:h-11 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
                        // canMute is now direction-aware (false when already muted), so combine both
                        // directions to decide the button's enabled state.
                        (!(interaction.canMute() || interaction.canUnmute()) || isActionLoading('mute')) && 'opacity-50 cursor-not-allowed',
                        // Active-muted style is gated only on isMuted now (canMute is false in that state).
                        isMuted && !isActionLoading('mute') && 'bg-red-100 text-red-700 hover:bg-red-200'
                      )}
                      onClick={() => (interaction.canMute() || interaction.canUnmute()) && !isActionLoading('mute') && withLoading('mute', () => onMute(interaction))}
                      aria-hidden={!isPhoneCall}
                      aria-disabled={!(interaction.canMute() || interaction.canUnmute()) || isActionLoading('mute')}
                      aria-pressed={isMuted}
                      aria-label={isMuted ? strings.interactions.controls.unmute : strings.interactions.controls.mute}
                    >
                      {isMuted ? (
                        <MicOff className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                      ) : (
                        <Mic className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                      )}
                    </Button>
                    {isActionLoading('mute') && <ActionRingSpinner />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isMuted ? strings.interactions.controls.unmute : strings.interactions.controls.mute}
                </TooltipContent>
              </Tooltip>

              {/* DTMF Dial Pad toggle button + floating panel */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={cn(
                        'rounded-full w-9 h-9 lg:w-11 lg:h-11 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
                        !interaction.canSendDtmf() && 'opacity-50 cursor-not-allowed',
                        isDtmfPadOpen && interaction.canSendDtmf() && 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      )}
                      onClick={() => interaction.canSendDtmf() && setIsDtmfPadOpen((prev) => !prev)}
                      aria-disabled={!interaction.canSendDtmf()}
                      aria-pressed={isDtmfPadOpen}
                      aria-expanded={isDtmfPadOpen}
                      aria-label={strings.interactions.controls.dialPad}
                    >
                      <Hash className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {strings.interactions.controls.dialPad}
                  </TooltipContent>
                </Tooltip>

                {/* Floating DTMF dial pad panel */}
                {isDtmfPadOpen && interaction.canSendDtmf() && (
                  <DtmfDialPad
                    onDigitPress={(digit) => {
                      try {
                        interaction.sendDtmf(digit);
                      } catch (error) {
                        logger.error('DTMF send failed', { interactionId: interaction.interactionId, ...getErrorDetails(error) });
                      }
                    }}
                    onClose={() => setIsDtmfPadOpen(false)}
                    showInput={true}
                  />
                )}
              </div>

              {/* Transfer button - Grey style with custom stacked arrows icon.
                  Enabled when canTransfer() (CONNECTED) OR canAttendedTransfer()
                  (also true in conference/warm state so agent can add more participants). */}
              <Tooltip>
                <TooltipTrigger asChild>
                  {(() => {
                    const canOpen = interaction.canTransfer() || interaction.canAttendedTransfer();
                    return (
                      <Button
                        variant="secondary"
                        size="icon"
                        className={cn(
                          'rounded-full w-9 h-9 lg:w-11 lg:h-11 bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
                          !canOpen && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => canOpen && onTransfer(interaction)}
                        aria-disabled={!canOpen}
                        aria-label={strings.interactions.controls.transfer}
                      >
                        <TransferIcon className="w-5 h-5 lg:w-6 lg:h-6" />
                      </Button>
                    );
                  })()}
                </TooltipTrigger>
                <TooltipContent>
                  {strings.interactions.controls.transfer}
                </TooltipContent>
              </Tooltip>

              {/* End call button - Red destructive style */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative inline-flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      className={cn(
                        'rounded-full w-9 h-9 lg:w-11 lg:h-11 focus:ring-2 focus:ring-red-400 focus:ring-offset-2',
                        (!interaction.canDisconnectCall() || isActionLoading('endCall')) && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-hidden={!isPhoneCall}
                      aria-disabled={!interaction.canDisconnectCall() || isActionLoading('endCall')}
                      onClick={() => interaction.canDisconnectCall() && !isActionLoading('endCall') && withLoading('endCall', () => onEndCall(interaction))}
                      aria-label={strings.interactions.controls.endCall}
                    >
                      <PhoneOff className="w-5 h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                    </Button>
                    {isActionLoading('endCall') && <ActionRingSpinner />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {strings.interactions.controls.endCall}
                </TooltipContent>
              </Tooltip>

              {/* Close Resolved button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="default"
                    className={cn(
                      'rounded-lg h-9 lg:h-11 px-2 lg:px-3 bg-green-100 text-green-800 font-semibold text-sm',
                      'hover:bg-green-200 focus:ring-2 focus:ring-green-400 focus:ring-offset-2',
                      (!interaction.canResolve() || isActionLoading('resolve')) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => interaction.canResolve() && !isActionLoading('resolve') && withLoading('resolve', () => onClosedResolved(interaction))}
                    aria-disabled={!interaction.canResolve() || isActionLoading('resolve')}
                    aria-label={strings.interactions.controls.closedResolved}
                  >
                    {isActionLoading('resolve') ? (
                      <Loader2 className="w-4 h-4 animate-spin lg:mr-1.5" aria-hidden="true" />
                    ) : (
                      <CheckSquare className="w-4 h-4 lg:mr-1.5" aria-hidden="true" />
                    )}
                    <span className="hidden lg:inline">{strings.interactions.controls.closedResolved}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {strings.interactions.controls.closedResolved}
                </TooltipContent>
              </Tooltip>

              {/* Close Unresolved button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="default"
                    className={cn(
                      'rounded-lg h-9 lg:h-11 px-2 lg:px-3 bg-orange-100 text-orange-800 font-semibold text-sm',
                      'hover:bg-orange-200 focus:ring-2 focus:ring-orange-400 focus:ring-offset-2',
                      (!interaction.canUnresolve() || isActionLoading('unresolve')) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => interaction.canUnresolve() && !isActionLoading('unresolve') && withLoading('unresolve', () => onClosedUnresolved(interaction))}
                    aria-disabled={!interaction.canUnresolve() || isActionLoading('unresolve')}
                    aria-label={strings.interactions.controls.closedUnresolved}
                  >
                    {isActionLoading('unresolve') ? (
                      <Loader2 className="w-4 h-4 animate-spin lg:mr-1.5" aria-hidden="true" />
                    ) : (
                      <XSquare className="w-4 h-4 lg:mr-1.5" aria-hidden="true" />
                    )}
                    <span className="hidden lg:inline">{strings.interactions.controls.closedUnresolved}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {strings.interactions.controls.closedUnresolved}
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Wrap Up controls - only shown when in wrapUp state and NOT a viewer */}
          {!interaction.isViewer() && isWrapUp && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="default"
                    className={cn(
                      'rounded-lg h-9 lg:h-11 px-3 lg:px-4 bg-purple-600 hover:bg-purple-700 focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 font-semibold text-sm',
                      isActionLoading('wrapUp') && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !isActionLoading('wrapUp') && withLoading('wrapUp', () => onWrapUp(interaction))}
                    aria-disabled={isActionLoading('wrapUp')}
                    aria-label={strings.interactions.controls.wrapUp}
                  >
                    {isActionLoading('wrapUp') ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    )}
                    {strings.interactions.controls.wrapUp}
                    <WrapUpCountdownDisplay
                      deadline={interaction.wrapUpDeadline}
                      onTick={setWrapUpTick}
                      className="ml-1.5 tabular-nums"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {strings.interactions.controls.wrapUp}
                </TooltipContent>
              </Tooltip>

              {/* Extend Wrap Up button - rendered when extend is configured, disabled when canExtendWrapUp() is false */}
              {(queueDetails.wrapUpExtendDuration ?? 0) > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="default"
                      className={cn(
                        'rounded-lg h-9 lg:h-11 px-3 lg:px-4 bg-purple-100 text-purple-800 font-semibold text-sm',
                        'hover:bg-purple-200 focus:ring-2 focus:ring-purple-400 focus:ring-offset-2',
                        (!interaction.canExtendWrapUp() || isActionLoading('extendWrapUp')) && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => interaction.canExtendWrapUp() && !isActionLoading('extendWrapUp') && withLoading('extendWrapUp', () => onExtendWrapUp(interaction))}
                      aria-disabled={!interaction.canExtendWrapUp() || isActionLoading('extendWrapUp')}
                      aria-label={strings.interactions.controls.extendWrapUp}
                    >
                      {isActionLoading('extendWrapUp') ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />
                      ) : (
                        <TimerReset className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      )}
                      +{queueDetails.wrapUpExtendDuration ?? 0}s
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {strings.interactions.controls.extendWrapUp}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}

          {/* Timer display - always shown */}
          <div
            className="flex items-center justify-center px-3 lg:px-4 h-9 lg:h-11 bg-gray-100 rounded-lg ml-2"
            role="timer"
          >
            <TimerDisplay
              startTime={startTime}
              className="text-sm lg:text-base font-bold text-gray-900 tabular-nums"
            />
          </div>
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { CallControlsBar };
