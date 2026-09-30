import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Search, ArrowRight, ChevronUp, Loader2, Phone, User } from 'lucide-react';
import {
  InteractionEventType,
  TransferFailReason,
  AvayaInfinityAgentSdkError,
  type Interaction,
  type TransferableUser,
  type TransferableQueue,
  type TransferableUsersPage,
  type TransferableQueuesPage,
  type InteractionTransferFailedEvent,
  InteractionStatus,
} from '@avaya/infinity-agent-sdk';
import { strings } from '@/locales/en';
import { createLogger, getErrorDetails } from '@/utils/logger';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const logger = createLogger('TransferPanel');
const t = strings.interactions.transfer;

/** Map SDK TransferFailReason to a human-readable locale string. */
function getTransferFailReasonMessage(reason: TransferFailReason): string {
  switch (reason) {
    case TransferFailReason.BUSY:          return t.transferFailedBusy;
    case TransferFailReason.UNAVAILABLE:   return t.transferFailedUnavailable;
    case TransferFailReason.NOT_FOUND:     return t.transferFailedNotFound;
    case TransferFailReason.NO_ANSWER:     return t.transferFailedNoAnswer;
    case TransferFailReason.REJECTED:      return t.transferFailedRejected;
    case TransferFailReason.NETWORK_ERROR: return t.transferFailedNetworkError;
    case TransferFailReason.UNKNOWN:
    default:                               return t.transferFailedUnknown;
  }
}

/** Transfer target type: search users, queues, or external number */
type TransferType = 'users' | 'queues' | 'external';

/** Selected target can be either a user or a queue */
type SelectedTarget =
  | { type: 'user'; data: TransferableUser }
  | { type: 'queue'; data: TransferableQueue };

/**
 * Transfer flow steps (redesigned):
 * - list: Searchable user/queue list with inline row expansion for transfer method selection
 * - attendedConnecting: Consultation card (blue) — ringing target agent
 * - attendedConnected: Consultation card (green) — target answered
 * - conference: Consultation card (amber) — three-way call active
 * - conferenceCompleted: Conference ended, showing active viewers
 *
 * The `selectMethod` and `blindTransferring` steps are eliminated.
 * Blind transfer is initiated inline from the expanded row.
 * Attended/conference states show a consultation card above the dimmed list.
 */
type TransferStep =
  | 'list'
  | 'attendedConnecting'
  | 'attendedConnected'
  | 'conference'
  | 'conferenceCompleted';

/** Consultation card visual state */
type ConsultationState = 'connecting' | 'connected' | 'conference';

interface TransferPanelProps {
  interaction: Interaction;
  /** True when the user explicitly opened the panel via the Transfer button. */
  userRequestedOpen: boolean;
  onClose: () => void;
}

/**
 * TransferPanel Component
 *
 * Multi-step transfer flow panel supporting blind transfer, attended (consultative)
 * transfer, and conference scenarios.
 *
 * SDK APIs demonstrated:
 *   - interaction.getTransferableUsers({ page, name })
 *   - interaction.getTransferableQueues({ page, name })
 *   - interaction.blindTransfer({ userId/userName } | { queueId/queueName })
 *   - interaction.attendedTransfer({ userId/userName } | { queueId/queueName })
 *   - interaction.canBlindTransfer() / canAttendedTransfer() / canConference()
 *   - interaction.canCancelTransfer() / canCancelConference()
 *   - interaction.transferDetails (isAnswered, user info)
 *
 * SDK Events used:
 *   - INTERACTION_TRANSFER — attended transfer initiated
 *   - INTERACTION_TRANSFER_ANSWER — consulted agent answered
 *   - INTERACTION_TRANSFER_CANCEL — transfer cancelled
 */
function TransferPanel({ interaction, userRequestedOpen, onClose }: TransferPanelProps) {
  const [transferStep, setTransferStep] = useState<TransferStep>(
    () => deriveInitialTransferStep(interaction)
  );
  const [transferType, setTransferType] = useState<TransferType>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState<TransferableUsersPage | null>(null);
  const [queuesPage, setQueuesPage] = useState<TransferableQueuesPage | null>(null);
  const [externalNumber, setExternalNumber] = useState('');
  const [isExternalTransferring, setIsExternalTransferring] = useState(false);
  const [isExternalAttendedTransferring, setIsExternalAttendedTransferring] = useState(false);

  const { addNotification } = useNotifications();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ─── Derived state ───
  // Shows the consultation card (connecting/connected/conference amber overlay).
  const isConsultationCardVisible = (['attendedConnecting', 'attendedConnected', 'conference'] as TransferStep[]).includes(transferStep);
  // Dims the list and hides header controls — only during active connecting/connected.
  // In 'conference' the call is stable; the list stays interactive so the agent can add more participants.
  const isTransferInProgress = (['attendedConnecting', 'attendedConnected'] as TransferStep[]).includes(transferStep);
  const showListView = transferStep === 'list' || isConsultationCardVisible;

  // External tab visible when blind OR attended external transfer is available.
  const canExternalBlind = interaction.canExternalBlindTransfer();
  const canExternalAttended = interaction.canExternalAttendedTransfer();
  const showExternalTab = canExternalBlind || canExternalAttended;

  // Elite interactions cannot transfer to user/queue targets — only external is routable.
  const isEliteInteraction = interaction.isElite;
  // Elite conference lock: once warm+answered, the SBC cannot drop the controller.
  // Cancel/Close buttons must be hidden/disabled; Complete Conference is always hidden for Elite.
  const isEliteConferenceLocked = isEliteInteraction
    && interaction.transferDetails?.isConference === true
    && interaction.transferDetails?.isAnswered === true;

  // Fall back to 'users' if external tab becomes unavailable while selected.
  // For Elite interactions, users/queues are not supported, so stay on 'external'.
  useEffect(() => {
    if (transferType === 'external' && !showExternalTab && !isEliteInteraction) {
      setTransferType('users');
      setExternalNumber('');
    }
  }, [showExternalTab, transferType, isEliteInteraction]);

  // Force Elite interactions to the external tab — users/queues are not routable.
  useEffect(() => {
    if (isEliteInteraction && transferType !== 'external') {
      setTransferType('external');
    }
  }, [isEliteInteraction, transferType]);

  const consultationState: ConsultationState | null =
    transferStep === 'attendedConnecting' ? 'connecting' :
    transferStep === 'attendedConnected' ? 'connected' :
    transferStep === 'conference' ? 'conference' :
    null;

  // ─── Visibility: show if user opened OR if an active transfer/conference step ───
  // 'conferenceCompleted' is informational only — it should not pin the panel open
  // after the agent leaves the conference. Without this exclusion, the Transfer button
  // toggle in CallControlsBar has no visible effect (panel re-opens itself immediately).
  const isActiveTransferStep = transferStep !== 'list' && transferStep !== 'conferenceCompleted';
  const isVisible = userRequestedOpen || isActiveTransferStep;

  // ─── Sync transferStep with interaction status ───
  function deriveInitialTransferStep(interaction: Interaction): TransferStep {
    const status = interaction.currentStatus;
    const td = interaction.transferDetails;
    if (status === InteractionStatus.ATTENDED_TRANSFER) {
      if (td?.isConference) return 'conference';
      if (td?.isAnswered) return 'attendedConnected';
      return 'attendedConnecting';
    }
    if (status === InteractionStatus.CONNECTED) {
      if (td?.isConferenceCompleted) {
        return interaction.getViewers().length > 0 ? 'conferenceCompleted' : 'list';
      }
      if (td?.transferType === 'attended' && td?.isAnswered) {
        return 'attendedConnected';
      }
    }
    return 'list';
  }

  // Handle transfer state that arrives after mount (e.g. mid-call page reload).
  // Note: 'conferenceCompleted' is intentionally NOT re-derived here — the
  // INTERACTION_CONFERENCE_COMPLETE event subscription owns that transition, and
  // deriveInitialTransferStep covers it on mount. Re-deriving it here would fight
  // the explicit reset-to-'list' that happens when the agent reopens the panel.
  useEffect(() => {
    if (transferStep !== 'list') return;

    const status = interaction.currentStatus;
    const td = interaction.transferDetails;

    if (status === InteractionStatus.ATTENDED_TRANSFER) {
      if (td?.isConference) {
        setTransferStep('conference');
      }
      else if (td?.isAnswered) {
        setTransferStep('attendedConnected');
      }
      else {
        setTransferStep('attendedConnecting');
      }
    } else if (status === InteractionStatus.CONNECTED) {
      if (td?.transferType === 'attended' && td?.isAnswered) {
        setTransferStep('attendedConnected');
      }
    }
  }, [interaction.currentStatus, interaction.transferDetails]);

  // When the agent explicitly reopens the panel after a completed conference, reset
  // to the list step so they can start a fresh transfer instead of seeing the stale
  // conferenceCompleted view.
  useEffect(() => {
    if (userRequestedOpen && transferStep === 'conferenceCompleted') {
      setTransferStep('list');
      setSelectedTarget(null);
      setExpandedTargetId(null);
    }
  }, [userRequestedOpen]);

  // ─── Subscribe to transfer lifecycle events ───
  useEffect(() => {
    const transferHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_TRANSFER,
      () => {
        setTransferStep('attendedConnecting');
        setExpandedTargetId(null);
      }
    );

    const answerHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_TRANSFER_ANSWER,
      () => {
        setTransferStep('attendedConnected');
      }
    );

    const cancelHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_TRANSFER_CANCEL,
      () => {
        setTransferStep('list');
        setSelectedTarget(null);
        setExpandedTargetId(null);
        setIsTransferring(false);
        setIsExternalAttendedTransferring(false);
        setIsExternalTransferring(false);
      }
    );

    const transferCompleteHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_TRANSFER_COMPLETE,
      () => {
        setTransferStep('list');
        setSelectedTarget(null);
        setExpandedTargetId(null);
        setIsTransferring(false);
        setIsExternalAttendedTransferring(false);
        setIsExternalTransferring(false);
        onClose();
      }
    );

    const conferenceHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_CONFERENCE,
      () => {
        setTransferStep('conference');
      }
    );

    const conferenceCompleteHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_CONFERENCE_COMPLETE,
      () => {
        setTransferStep('conferenceCompleted');
        setIsTransferring(false);
      }
    );

    const viewerLeftCallHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_VIEWER_LEFT_CALL,
      () => {
        setTransferStep('list');
        setSelectedTarget(null);
        setExpandedTargetId(null);
        setIsTransferring(false);
        onClose();
      }
    );

    const viewerRemovedHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_VIEWER_REMOVED,
      () => {
        if (interaction.getViewers().length === 0) {
          setTransferStep('list');
          setSelectedTarget(null);
          setExpandedTargetId(null);
          setIsTransferring(false);
          onClose();
        }
      }
    );

    const transferFailedHandlerId = interaction.subscribe(
      InteractionEventType.INTERACTION_TRANSFER_FAILED,
      (event: InteractionTransferFailedEvent) => {
        const reasonMessage = getTransferFailReasonMessage(event.payload.reason);
        setTransferStep('list');
        setSelectedTarget(null);
        setExpandedTargetId(null);
        setIsTransferring(false);
        setIsExternalAttendedTransferring(false);
        setIsExternalTransferring(false);
        addNotification({
          id: `transfer-failed-${interaction.interactionId}-${Date.now()}`,
          level: 'error',
          title: t.transferFailedTitle,
          description: `Transfer failed \u2014 ${reasonMessage}. Returning to original call.`,
          autoDismissMs: 10000,
        });
      }
    );

    return () => {
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER, transferHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_ANSWER, answerHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_CANCEL, cancelHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_COMPLETE, transferCompleteHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CONFERENCE, conferenceHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CONFERENCE_COMPLETE, conferenceCompleteHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_LEFT_CALL, viewerLeftCallHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_REMOVED, viewerRemovedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_FAILED, transferFailedHandlerId);
    };
  }, [interaction]);

  // ─── Escape key to close (only when not mid-transfer) ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTransferring && transferStep === 'list') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isTransferring, transferStep]);

  // ─── Data fetching (debounced) ───
  const handleTypeChange = useCallback((type: TransferType) => {
    setTransferType(type);
    setSearchTerm('');
    setPage(1);
    setUsersPage(null);
    setQueuesPage(null);
    setSelectedTarget(null);
    setExpandedTargetId(null);
    setExternalNumber('');
  }, []);

  useEffect(() => {
    // Also fetch during 'conference' step — list is visible and interactive so the
    // agent can select a new consult target to add a fourth party to the conference.
    const listIsVisible = transferStep === 'list' || transferStep === 'conference';
    if (!listIsVisible || transferType === 'external') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(), 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [page, searchTerm, transferType, transferStep]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (transferType === 'users') {
        const result = await interaction.getTransferableUsers({ page, name: searchTerm });
        setUsersPage(result);
      } else {
        const result = await interaction.getTransferableQueues({ page, name: searchTerm });
        setQueuesPage(result);
      }
    } catch (error) {
      logger.error('Transfer targets load failed', { interactionId: interaction.interactionId, ...getErrorDetails(error) });
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination state
  const currentPage = transferType === 'users' ? usersPage?.currentPage : queuesPage?.currentPage;
  const totalPages = transferType === 'users' ? usersPage?.totalPages : queuesPage?.totalPages;
  const hasNext = transferType === 'users' ? usersPage?.hasNextPage : queuesPage?.hasNextPage;
  const hasPrev = transferType === 'users' ? usersPage?.hasPreviousPage : queuesPage?.hasPreviousPage;

  // ─── Selection handlers (inline expansion) ───
  const handleSelectUser = useCallback((user: TransferableUser) => {
    setSelectedTarget({ type: 'user', data: user });
    setExpandedTargetId((prev) => prev === user.userId ? null : user.userId);
  }, []);

  const handleSelectQueue = useCallback((queue: TransferableQueue) => {
    setSelectedTarget({ type: 'queue', data: queue });
    setExpandedTargetId((prev) => prev === queue.queueId ? null : queue.queueId);
  }, []);

  // ─── Transfer action handlers ───

  /** Blind transfer: immediately transfers and completes */
  const handleBlindTransfer = useCallback(async () => {
    if (!selectedTarget) return;
    setIsTransferring(true);

    try {
      if (selectedTarget.type === 'queue') {
        logger.info('Blind transfer requested', { interactionId: interaction.interactionId, targetId: selectedTarget.data.queueId, targetType: 'queue' });
        await interaction.blindTransfer({
          type: 'queue',
          queueId: selectedTarget.data.queueId,
          queueName: selectedTarget.data.name,
        });
      } else {
        logger.info('Blind transfer requested', { interactionId: interaction.interactionId, targetId: selectedTarget.data.userId, targetType: 'user' });
        await interaction.blindTransfer({
          type: 'user',
          userId: selectedTarget.data.userId,
          userName: selectedTarget.data.fullName,
        });
      }
      onClose();
    } catch (error) {
      logger.error('Blind transfer failed', { interactionId: interaction.interactionId, ...getErrorDetails(error) });
      addNotification({
        id: `blind-transfer-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: t.transferFailedTitle,
        description: error instanceof Error ? error.message : t.transferFailedUnknown,
        autoDismissMs: 10000,
      });
    } finally {
      setIsTransferring(false);
    }
  }, [selectedTarget, interaction, onClose, addNotification]);

  /** Blind transfer to external phone number */
  const handleExternalBlindTransfer = useCallback(async () => {
    if (!externalNumber.trim()) return;
    setIsExternalTransferring(true);

    try {
      logger.info('Blind transfer requested', { interactionId: interaction.interactionId, targetType: 'external' });
      await interaction.blindTransfer({
        type: 'external',
        externalNumber: externalNumber.trim(),
      });
      onClose();
    } catch (error) {
      logger.error('Blind transfer failed', { interactionId: interaction.interactionId, targetType: 'external', ...getErrorDetails(error) });
      addNotification({
        id: `external-transfer-failed-${Date.now()}`,
        level: 'error',
        title: t.externalTransferFailed,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsExternalTransferring(false);
    }
  }, [externalNumber, interaction, onClose, addNotification]);

  /** Attended transfer to an external phone number: initiates a consultation call */
  const handleExternalAttendedTransfer = useCallback(async () => {
    if (!externalNumber.trim()) return;
    setIsExternalAttendedTransferring(true);
    setTransferStep('attendedConnecting');

    try {
      logger.info('Attended transfer requested', { interactionId: interaction.interactionId, targetType: 'external' });
      await interaction.attendedTransfer({
        type: 'external',
        externalNumber: externalNumber.trim(),
      });
    } catch (error) {
      logger.error('Attended transfer failed', { interactionId: interaction.interactionId, targetType: 'external', ...getErrorDetails(error) });
      setTransferStep('list');
      addNotification({
        id: `external-attended-transfer-failed-${Date.now()}`,
        level: 'error',
        title: t.transferFailedTitle,
        description: error instanceof Error ? error.message : t.transferFailedUnknown,
        autoDismissMs: 10000,
      });
    } finally {
      setIsExternalAttendedTransferring(false);
    }
  }, [externalNumber, interaction, addNotification]);

  /** Attended transfer: initiates a consultation call to the target */
  const handleAttendedTransfer = useCallback(async () => {
    if (!selectedTarget) return;
    setIsTransferring(true);
    setTransferStep('attendedConnecting');

    try {
      if (selectedTarget.type === 'queue') {
        logger.info('Attended transfer requested', { interactionId: interaction.interactionId, targetId: selectedTarget.data.queueId, targetType: 'queue' });
        await interaction.attendedTransfer({
          queueId: selectedTarget.data.queueId,
          queueName: selectedTarget.data.name,
        });
      } else {
        logger.info('Attended transfer requested', { interactionId: interaction.interactionId, targetId: selectedTarget.data.userId, targetType: 'user' });
        await interaction.attendedTransfer({
          userId: selectedTarget.data.userId,
          userName: selectedTarget.data.fullName,
        });
      }
    } catch (error) {
      logger.error('Attended transfer failed', { interactionId: interaction.interactionId, ...getErrorDetails(error) });
      setTransferStep('list');
      setSelectedTarget(null);
      setExpandedTargetId(null);
      addNotification({
        id: `transfer-api-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: t.transferFailedTitle,
        description: error instanceof Error ? error.message : t.transferFailedUnknown,
        autoDismissMs: 10000,
      });
    } finally {
      setIsTransferring(false);
    }
  }, [selectedTarget, interaction, addNotification]);

  /** Cancel an in-progress attended transfer */
  const handleCancelTransfer = useCallback(async () => {
    logger.info('Transfer cancellation requested', { interactionId: interaction.interactionId });
    return interaction.cancelTransfer();
  }, [interaction]);

  /** Complete the attended transfer (hand off to consulted agent) */
  const handleCompleteTransfer = useCallback(async () => {
    logger.info('Transfer completion requested', { interactionId: interaction.interactionId });
    return interaction.completeTransfer();
  }, [interaction]);

  /** Conference the interaction */
  const handleConference = useCallback(async () => {
    logger.info('Conference requested', { interactionId: interaction.interactionId });
    return interaction.conference();
  }, [interaction]);

  /** Cancel the conference */
  const handleCancelConference = useCallback(async () => {
    logger.info('Conference cancellation requested', { interactionId: interaction.interactionId });
    return interaction.cancelConference();
  }, [interaction]);

  const handleCompleteConference = useCallback(async () => {
    logger.info('Conference completion requested', { interactionId: interaction.interactionId });
    return interaction.completeConference();
  }, [interaction]);

  // ─── Helper: display name for selected target ───
  // When no target was selected and no transfer user identity is available,
  // the consulting agent's identity is unknown (e.g. queue-routed attended transfer)
  const isUnknownTransferAgent = !selectedTarget && !interaction.transferDetails?.user;

  const getTargetDisplayName = (): string => {
    if (selectedTarget) {
      return selectedTarget.type === 'user'
        ? selectedTarget.data.fullName
        : selectedTarget.data.name;
    }
    if (interaction.transferDetails?.user?.name) {
      return interaction.transferDetails.user.name;
    }
    // Consulting agent identity unavailable — fall back to customer phone name
    return interaction.customer.name || interaction.customer.phone || '';
  };

  const getTargetInitials = (): string => {
    if (isUnknownTransferAgent) return '';
    const name = getTargetDisplayName();
    return getInitials(name);
  };

  const customerInitials = getInitials(
    interaction.customer.name?.length > 0 ? interaction.customer.name : 'G'
  );

  // ─── Render ───
  if (!isVisible) return null;

  return (
    <div className="flex-1 min-w-0 min-h-0">
    <div className="flex flex-col h-full min-h-0">

      {/* ═══ List View (with optional consultation card overlay) ═══ */}
      {showListView && (
        <>
          {/* Header: title + dropdown + close */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">{t.title}</h2>
              {!isTransferInProgress && (
                <select
                  value={transferType}
                  onChange={(e) => handleTypeChange(e.target.value as TransferType)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1"
                  aria-label="Transfer target type"
                >
                  {!isEliteInteraction && <option value="users">{t.users}</option>}
                  {!isEliteInteraction && <option value="queues">{t.queues}</option>}
                  {showExternalTab && (
                    <option value="external">{t.external}</option>
                  )}
                </select>
              )}
              {isEliteInteraction && !showExternalTab && (
                <span className="text-xs text-gray-500" role="status">
                  External transfer not enabled for this queue
                </span>
              )}
            </div>
            {!isTransferInProgress && (
              <button
                onClick={isEliteConferenceLocked ? undefined : onClose}
                disabled={isEliteConferenceLocked}
                title={isEliteConferenceLocked ? 'Not available while Elite conference is active' : undefined}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close transfer panel"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Consultation card (when attending/connected/conference) */}
          {isConsultationCardVisible && consultationState && (
            <div className="px-4 pb-3">
              <ConsultationCard
                interactionId={interaction.interactionId}
                state={consultationState}
                targetName={getTargetDisplayName()}
                targetInitials={getTargetInitials()}
                customerInitials={customerInitials}
                onCancelTransfer={handleCancelTransfer}
                onCompleteTransfer={handleCompleteTransfer}
                onConference={handleConference}
                onCancelConference={handleCancelConference}
                onCompleteConference={handleCompleteConference}
                canCancelTransfer={interaction.canCancelTransfer()}
                canCompleteTransfer={interaction.canCompleteTransfer()}
                canConference={interaction.canConference()}
                canCancelConference={interaction.canCancelConference()}
                canCompleteConference={interaction.canCompleteConference()}
                isEliteLocked={isEliteConferenceLocked}
              />
            </div>
          )}

          {/* Search + List + Pagination OR External input (dimmed when consultation active) */}
          <div className={cn(
            'flex flex-col flex-1 min-h-0',
            isTransferInProgress && 'opacity-[0.35] pointer-events-none'
          )}>
            {transferType === 'external' ? (
              /* ── External phone number input ── */
              <div className="px-4 pb-3 flex flex-col gap-3">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <Input
                    type="tel"
                    value={externalNumber}
                    onChange={(e) => setExternalNumber(e.target.value)}
                    placeholder={t.externalPlaceholder}
                    disabled={isExternalTransferring}
                    className="pl-9"
                    aria-label={t.externalPlaceholder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && externalNumber.trim() && !isExternalTransferring) {
                        handleExternalBlindTransfer();
                      }
                    }}
                  />
                </div>
                {canExternalAttended && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full font-semibold"
                    disabled={
                      !externalNumber.trim() ||
                      isExternalAttendedTransferring ||
                      isExternalTransferring
                    }
                    onClick={handleExternalAttendedTransfer}
                    aria-label={t.attendedTransferLabel}
                  >
                    {isExternalAttendedTransferring ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                        {t.transferring}
                      </>
                    ) : (
                      t.attendedTransferLabel
                    )}
                  </Button>
                )}
                {canExternalBlind && (
                  <Button
                    size="sm"
                    className="w-full font-semibold"
                    disabled={
                      !externalNumber.trim() ||
                      isExternalTransferring ||
                      isExternalAttendedTransferring
                    }
                    onClick={handleExternalBlindTransfer}
                    aria-label={t.transferAndComplete}
                  >
                    {isExternalTransferring ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                        {t.transferring}
                      </>
                    ) : (
                      t.transferAndComplete
                    )}
                  </Button>
                )}
              </div>
            ) : (
              /* ── Users / Queues search + list ── */
              <>
                {/* Search */}
                <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      placeholder={transferType === 'users' ? t.searchUsers : t.searchQueues}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                                 placeholder:text-gray-500
                                 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white"
                      tabIndex={isTransferInProgress ? -1 : 0}
                    />
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-4 min-h-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-gray-500" role="status">
                      {strings.common.loading}
                    </div>
                  ) : transferType === 'users' ? (
                    <UserList
                      users={usersPage?.users ?? []}
                      expandedTargetId={expandedTargetId}
                      onToggleExpand={handleSelectUser}
                      onBlindTransfer={handleBlindTransfer}
                      onAttendedTransfer={handleAttendedTransfer}
                      canBlindTransfer={interaction.canBlindTransfer()}
                      canAttendedTransfer={interaction.canAttendedTransfer()}
                      isTransferring={isTransferring}
                    />
                  ) : (
                    <QueueList
                      queues={queuesPage?.queues ?? []}
                      expandedTargetId={expandedTargetId}
                      onToggleExpand={handleSelectQueue}
                      onBlindTransfer={handleBlindTransfer}
                      onAttendedTransfer={handleAttendedTransfer}
                      canBlindTransfer={interaction.canBlindTransfer()}
                      canAttendedTransfer={interaction.canAttendedTransfer()}
                      isTransferring={isTransferring}
                    />
                  )}
                </div>
              </>
            )}

            {/* Pagination (not shown for external tab) */}
            {transferType !== 'external' && currentPage != null && totalPages != null && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm">
                <button
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100
                             disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
                             focus:outline-none focus:ring-2 focus:ring-blue-300"
                  aria-label="Previous page"
                  tabIndex={isTransferInProgress ? -1 : 0}
                >
                  <ChevronLeft className="w-4 h-4" /> {t.prev}
                </button>
                <span className="text-gray-600" aria-live="polite">
                  {t.page} {currentPage} {t.of} {totalPages}
                </span>
                <button
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-white bg-blue-700
                             hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
                             focus:outline-none focus:ring-2 focus:ring-blue-300"
                  aria-label="Next page"
                  tabIndex={isTransferInProgress ? -1 : 0}
                >
                  {t.next} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ Step: CONFERENCE COMPLETED ═══ */}
      {transferStep === 'conferenceCompleted' && (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{t.conferenceCompleted}</h2>
            <button
              onClick={() => { setTransferStep('list'); setSelectedTarget(null); setExpandedTargetId(null); }}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conference participants visualization */}
          <div className="flex items-center justify-center gap-3 py-4" aria-label="Conference participants">
            <div className="w-14 h-14 rounded-full bg-[#003A51] flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-white">{t.you}</span>
            </div>
            <div className="w-6 h-0.5 bg-gray-300 shrink-0" aria-hidden="true" />
            <div className="w-14 h-14 rounded-full bg-blue-700 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-white">{customerInitials}</span>
            </div>
            {interaction.getViewers().map((viewer) => (
              <div key={viewer.id} className="flex items-center gap-3">
                <div className="w-6 h-0.5 bg-gray-300 shrink-0" aria-hidden="true" />
                <div className="w-14 h-14 rounded-full bg-green-800 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-white">{getInitials(viewer.fullName ?? '')}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 py-2">
            <span className="w-2 h-2 rounded-full bg-green-800" aria-hidden="true" />
            <p className="text-sm font-semibold text-green-800">{t.conferenceActive}</p>
          </div>

          {/* Viewer list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500">{t.activeViewers}</p>
            {interaction.getViewers().map((viewer) => (
              <div key={viewer.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-white">
                    {getInitials(viewer.fullName ?? '')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{viewer.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{viewer.email}</p>
                </div>
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                  {t.viewing}
                </span>
              </div>
            ))}
            {interaction.getViewers().length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">{t.noActiveViewers}</p>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Extracts up to 2-letter initials from a full name */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Consultation Card ───

interface ConsultationCardProps {
  interactionId: string;
  state: ConsultationState;
  targetName: string;
  targetInitials: string;
  customerInitials: string;
  onCancelTransfer: () => void | Promise<void>;
  onCompleteTransfer: () => void | Promise<void>;
  onConference: () => void | Promise<void>;
  onCancelConference: () => void | Promise<void>;
  onCompleteConference: () => void | Promise<void>;
  canCancelTransfer: boolean;
  canCompleteTransfer: boolean;
  canConference: boolean;
  canCancelConference: boolean;
  canCompleteConference: boolean;
  /** Elite conference lock — hide Cancel controls entirely when true. */
  isEliteLocked: boolean;
}

/** Color-coded consultation card that evolves through connecting → connected → conference states */
function ConsultationCard({
  interactionId,
  state,
  targetName,
  targetInitials,
  customerInitials,
  onCancelTransfer,
  onCompleteTransfer,
  onConference,
  onCancelConference,
  onCompleteConference,
  canCancelTransfer,
  canCompleteTransfer,
  canConference,
  canCancelConference,
  canCompleteConference,
  isEliteLocked,
}: ConsultationCardProps) {
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const { addNotification } = useNotifications();

  const isActionLoading = (action: string) => loadingActions.has(action);
  const isAnyLoading = loadingActions.size > 0;

  const withLoading = useCallback(async (action: string, fn: () => void | Promise<void>) => {
    setLoadingActions(prev => new Set(prev).add(action));
    try {
      await fn();
    } catch (error) {
      logger.error('Transfer action failed', { actionName: action, interactionId, ...getErrorDetails(error) });
      addNotification({
        id: `transfer-action-failed-${action}-${Date.now()}`,
        level: 'error',
        title: t.transferFailedTitle,
        description: AvayaInfinityAgentSdkError.is(error) ? (error.detail ?? error.message) : error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev);
        next.delete(action);
        return next;
      });
    }
  }, [addNotification, interactionId]);

  // Card theme by state
  const cardStyles = {
    connecting: 'bg-[#EFF6FF] border-[#93C5FD]',
    connected: 'bg-[#F0FDF4] border-[#86EFAC]',
    conference: 'bg-[#FFFBEB] border-[#FDE68A]',
  };

  return (
    <div className={cn('rounded-xl border-[1.5px] p-4', cardStyles[state])}>
      {/* Connecting / Connected state: show target user info */}
      {(state === 'connecting' || state === 'connected') && (
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center shrink-0">
            {targetInitials ? (
              <span className="text-xs font-semibold text-white">{targetInitials}</span>
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{targetName}</p>
          </div>
          {state === 'connecting' && (
            <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded bg-[#DBEAFE] text-[#1D4ED8]">
              {t.connecting}
            </span>
          )}
          {state === 'connected' && (
            <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded bg-[#DCFCE7] text-[#166534]">
              <span className="w-2 h-2 rounded-full bg-[#166534]" aria-hidden="true" />
              {t.connected}
            </span>
          )}
        </div>
      )}

      {/* Conference state: show 3 participant circles */}
      {state === 'conference' && (
        <>
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#92400E]">{t.conferenceActive}</span>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4" aria-label="Conference participants">
            <div className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-[#003A51] flex items-center justify-center">
                <span className="text-xs font-semibold text-white">{t.you}</span>
              </div>
              <span className="text-[10px] text-gray-500">Agent</span>
            </div>
            <div className="w-6 h-0.5 bg-gray-300 shrink-0" aria-hidden="true" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-[#1D4ED8] flex items-center justify-center">
                <span className="text-xs font-semibold text-white">{customerInitials}</span>
              </div>
              <span className="text-[10px] text-gray-500">{t.customer}</span>
            </div>
            <div className="w-6 h-0.5 bg-gray-300 shrink-0" aria-hidden="true" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-[#166534] flex items-center justify-center">
                <span className="text-xs font-semibold text-white">{targetInitials}</span>
              </div>
              <span className="text-[10px] text-gray-500">{t.consulted}</span>
            </div>
          </div>
        </>
      )}

      {/* Action buttons — layout depends on state */}
      {state === 'connecting' && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-red-600 text-red-600 font-semibold',
              'hover:bg-red-50 focus:ring-2 focus:ring-red-400',
              (!canCancelTransfer || isAnyLoading) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canCancelTransfer && !isAnyLoading && withLoading('cancelTransfer', onCancelTransfer)}
            aria-disabled={!canCancelTransfer || isAnyLoading}
            aria-label={t.cancelTransfer}
          >
            {isActionLoading('cancelTransfer') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
            {strings.common.cancel}
          </Button>
          <Button
            size="sm"
            disabled
            className="bg-[#E5E7EB] text-gray-400 cursor-not-allowed font-semibold border-0"
          >
            {t.completeTransfer}
          </Button>
          <Button
            size="sm"
            disabled
            className="bg-[#E5E7EB] text-gray-400 cursor-not-allowed font-semibold border-0"
          >
            {t.conference}
          </Button>
        </div>
      )}

      {state === 'connected' && (
        <div className="flex gap-2">
          {!isEliteLocked && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-red-600 text-red-600 font-semibold',
              'hover:bg-red-50 focus:ring-2 focus:ring-red-400',
              (!canCancelTransfer || isAnyLoading) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canCancelTransfer && !isAnyLoading && withLoading('cancelTransfer', onCancelTransfer)}
            aria-disabled={!canCancelTransfer || isAnyLoading}
            aria-label={t.cancelTransfer}
          >
            {isActionLoading('cancelTransfer') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
            {strings.common.cancel}
          </Button>
          )}
          <Button
            size="sm"
            className={cn(
              'bg-[#1D4ED8] text-white font-semibold',
              'hover:bg-blue-800 focus:ring-2 focus:ring-blue-400',
              (!canCompleteTransfer || isAnyLoading) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canCompleteTransfer && !isAnyLoading && withLoading('completeTransfer', onCompleteTransfer)}
            aria-disabled={!canCompleteTransfer || isAnyLoading}
            aria-label={t.completeTransfer}
          >
            {isActionLoading('completeTransfer') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
            {t.completeTransfer}
          </Button>
          {canConference && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'border-[#1D4ED8] text-[#1D4ED8] font-semibold hover:bg-blue-50 focus:ring-2 focus:ring-blue-400',
                isAnyLoading && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !isAnyLoading && withLoading('conference', onConference)}
              aria-disabled={isAnyLoading}
              aria-label={t.conference}
            >
              {isActionLoading('conference') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
              {t.conference}
            </Button>
          )}
        </div>
      )}

      {state === 'conference' && (
        <div className="flex gap-2">
          {!isEliteLocked && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-red-600 text-red-600 font-semibold',
              'hover:bg-red-50 focus:ring-2 focus:ring-red-400',
              (!canCancelConference || isAnyLoading) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canCancelConference && !isAnyLoading && withLoading('cancelConference', onCancelConference)}
            aria-disabled={!canCancelConference || isAnyLoading}
            aria-label={t.cancelConference}
          >
            {isActionLoading('cancelConference') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
            {t.cancelConference}
          </Button>
          )}
          {canCompleteConference && (
          <Button
            size="sm"
            className={cn(
              'bg-[#1D4ED8] text-white font-semibold',
              'hover:bg-blue-800 focus:ring-2 focus:ring-blue-400',
              isAnyLoading && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => !isAnyLoading && withLoading('completeConference', onCompleteConference)}
            aria-disabled={isAnyLoading}
            aria-label={t.completeConference}
          >
            {isActionLoading('completeConference') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
            {t.completeConference}
          </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-[#1D4ED8] text-[#1D4ED8] font-semibold',
              'hover:bg-blue-50 focus:ring-2 focus:ring-blue-400',
              (!canCompleteTransfer || isAnyLoading) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canCompleteTransfer && !isAnyLoading && withLoading('completeTransfer', onCompleteTransfer)}
            aria-disabled={!canCompleteTransfer || isAnyLoading}
            aria-label={t.completeTransfer}
          >
            {isActionLoading('completeTransfer') && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
            {t.completeTransfer}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── User list with expandable rows ───

interface UserListProps {
  users: TransferableUser[];
  expandedTargetId: string | null;
  onToggleExpand: (user: TransferableUser) => void;
  onBlindTransfer: () => void;
  onAttendedTransfer: () => void;
  canBlindTransfer: boolean;
  canAttendedTransfer: boolean;
  isTransferring: boolean;
}

/** Renders the paginated list of transferable users with expandable inline rows */
function UserList({
  users,
  expandedTargetId,
  onToggleExpand,
  onBlindTransfer,
  onAttendedTransfer,
  canBlindTransfer,
  canAttendedTransfer,
  isTransferring,
}: UserListProps) {
  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500">
        {t.noResults}
      </div>
    );
  }

  return (
    <ul role="list" className="space-y-1">
      {users.map((user) => {
        const isExpanded = expandedTargetId === user.userId;

        return (
          <li key={user.userId}>
            {isExpanded ? (
              /* ── Expanded row ── */
              <div className="rounded-xl border-[1.5px] border-[#93C5FD] bg-[#EFF6FF] p-3">
                {/* User info + collapse chevron */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-white">{getInitials(user.fullName)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.status}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {user.connectedInteractions > 0 && (
                      <ActiveInteractionsBadge count={user.connectedInteractions} />
                    )}
                    <StatusBadge
                      status={user.status}
                      statusType={user.statusType}
                      isLoggedInToCx={user.isLoggedInToCx}
                    />
                    <button
                      onClick={() => onToggleExpand(user)}
                      className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-500
                                 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                      aria-label="Collapse"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#BFDBFE] my-3" />

                {/* Action buttons */}
                <p className="text-xs font-semibold text-gray-500 mb-2">{t.chooseAction}</p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 border-blue-700 text-blue-700 font-semibold',
                      'hover:bg-blue-50 focus:ring-2 focus:ring-blue-300',
                      (!canBlindTransfer || isTransferring) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={canBlindTransfer && !isTransferring ? onBlindTransfer : undefined}
                    disabled={!canBlindTransfer || isTransferring}
                    aria-label={t.transferAndComplete}
                  >
                    {isTransferring ? t.transferring : t.transferAndComplete}
                  </Button>
                  <Button
                    size="sm"
                    className={cn(
                      'flex-1 bg-blue-700 text-white font-semibold',
                      'hover:bg-blue-800 focus:ring-2 focus:ring-blue-300',
                      (!canAttendedTransfer || isTransferring) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={canAttendedTransfer && !isTransferring ? onAttendedTransfer : undefined}
                    disabled={!canAttendedTransfer || isTransferring}
                    aria-label={t.consultFirst}
                  >
                    {t.consultFirst}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Collapsed row ── */
              <div
                className="flex items-center justify-between py-3 px-2 rounded-lg
                           hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent
                           cursor-pointer transition-colors
                           focus-within:ring-2 focus-within:ring-blue-300"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <StatusIndicator statusType={user.statusType} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {user.connectedInteractions > 0 && (
                    <ActiveInteractionsBadge count={user.connectedInteractions} />
                  )}
                  <StatusBadge
                    status={user.status}
                    statusType={user.statusType}
                    isLoggedInToCx={user.isLoggedInToCx}
                  />
                  <button
                    onClick={() => onToggleExpand(user)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleExpand(user);
                      }
                    }}
                    className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700
                               focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                    aria-label={`Transfer to ${user.fullName}`}
                  >
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Queue list with expandable rows ───

interface QueueListProps {
  queues: TransferableQueue[];
  expandedTargetId: string | null;
  onToggleExpand: (queue: TransferableQueue) => void;
  onBlindTransfer: () => void;
  onAttendedTransfer: () => void;
  canBlindTransfer: boolean;
  canAttendedTransfer: boolean;
  isTransferring: boolean;
}

/** Renders the paginated list of transferable queues with expandable inline rows */
function QueueList({
  queues,
  expandedTargetId,
  onToggleExpand,
  onBlindTransfer,
  onAttendedTransfer,
  canBlindTransfer,
  canAttendedTransfer,
  isTransferring,
}: QueueListProps) {
  if (queues.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500">
        {t.noResults}
      </div>
    );
  }

  return (
    <ul role="list" className="space-y-1">
      {queues.map((queue) => {
        const isExpanded = expandedTargetId === queue.queueId;

        return (
          <li key={queue.queueId}>
            {isExpanded ? (
              /* ── Expanded row ── */
              <div className="rounded-xl border-[1.5px] border-[#93C5FD] bg-[#EFF6FF] p-3">
                {/* Queue info + collapse chevron */}
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{queue.name}</p>
                    <p className="text-xs text-gray-500">
                      Active: {queue.totalCurrentInteractions} &middot; Waiting: {queue.waitingInteractions} &middot; Agents: {queue.countActiveAgents}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {queue.eligible && (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        Eligible
                      </span>
                    )}
                    <button
                      onClick={() => onToggleExpand(queue)}
                      className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-500
                                 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                      aria-label="Collapse"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#BFDBFE] my-3" />

                {/* Action buttons */}
                <p className="text-xs font-semibold text-gray-500 mb-2">{t.chooseAction}</p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1 border-blue-700 text-blue-700 font-semibold',
                      'hover:bg-blue-50 focus:ring-2 focus:ring-blue-300',
                      (!canBlindTransfer || isTransferring) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={canBlindTransfer && !isTransferring ? onBlindTransfer : undefined}
                    disabled={!canBlindTransfer || isTransferring}
                    aria-label={t.transferAndComplete}
                  >
                    {isTransferring ? t.transferring : t.transferAndComplete}
                  </Button>
                  <Button
                    size="sm"
                    className={cn(
                      'flex-1 bg-blue-700 text-white font-semibold',
                      'hover:bg-blue-800 focus:ring-2 focus:ring-blue-300',
                      (!canAttendedTransfer || isTransferring) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={canAttendedTransfer && !isTransferring ? onAttendedTransfer : undefined}
                    disabled={!canAttendedTransfer || isTransferring}
                    aria-label={t.consultFirst}
                  >
                    {t.consultFirst}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Collapsed row ── */
              <div
                className="flex items-center justify-between py-3 px-2 rounded-lg
                           hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent
                           cursor-pointer transition-colors
                           focus-within:ring-2 focus-within:ring-blue-300"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{queue.name}</p>
                    <p className="text-xs text-gray-500">
                      Active: {queue.totalCurrentInteractions} &middot; Waiting: {queue.waitingInteractions} &middot; Agents: {queue.countActiveAgents}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {queue.eligible && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      Eligible
                    </span>
                  )}
                  <button
                    onClick={() => onToggleExpand(queue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleExpand(queue);
                      }
                    }}
                    className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700
                               focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                    aria-label={`Transfer to queue ${queue.name}`}
                  >
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Status indicators (WCAG 1.4.1: shape + color + text) ───

/**
 * WCAG-compliant status indicator using distinct shapes:
 * - Available: filled circle (green)
 * - Busy: half-filled circle (amber)
 * - Offline/other: hollow circle (red)
 *
 * Provides shape distinction so status is not conveyed by color alone.
 */
function StatusIndicator({ statusType }: { statusType: string }) {
  const type = statusType.toLowerCase();

  if (type === 'available') {
    return (
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="#166534" />
      </svg>
    );
  }

  if (type === 'busy') {
    return (
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="#D97706" strokeWidth="1.5" />
        <path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill="#D97706" />
      </svg>
    );
  }

  // Offline / unknown — hollow circle
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="4" fill="none" stroke="#DC2626" strokeWidth="1.5" />
    </svg>
  );
}

/** Badge showing user status text with WCAG-compliant color contrast */
function StatusBadge({
  status,
  statusType,
  isLoggedInToCx,
}: {
  status: string;
  statusType?: string;
  isLoggedInToCx?: boolean;
}) {
  const type = statusType?.toLowerCase() ?? '';
  const loggedIn = isLoggedInToCx ?? true;

  const styleMap: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    busy: 'bg-amber-100 text-amber-800',
    away: 'bg-yellow-100 text-yellow-800',
    offline: 'bg-red-100 text-red-800',
  };

  const style = loggedIn
    ? (styleMap[type] ?? 'bg-red-100 text-red-800')
    : 'bg-red-100 text-red-800';

  const displayText = loggedIn ? status : 'Not logged in';

  return (
    <span className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${style}`}>
      {displayText}
    </span>
  );
}

/** Badge showing active interaction count for a user */
function ActiveInteractionsBadge({ count }: { count: number }) {
  return (
    <span
      className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
      aria-label={`${count} active ${count === 1 ? 'interaction' : 'interactions'}`}
    >
      {count} active
    </span>
  );
}

export { TransferPanel };
