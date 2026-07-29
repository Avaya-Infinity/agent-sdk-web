import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AvayaInfinityAgentSdkError,
  ChatMessageRequest,
  MediaDevicePermissionState,
  Interaction,
  InteractionEventType,
  InteractionStatus,
  ResolutionStatus,
  UserEventType,
  type ClassificationCode,
  type Message,
  type MessagesIterator,
  type User,
  type Viewer,
} from '@avaya/infinity-agent-sdk';
import type { InteractionsContextType } from '@/components/layout/MainLayout';
import { InteractionListPanel } from './InteractionListPanel';
import { CallControlsBar } from './CallControlsBar';
import { ViewerAvatarStrip } from './ViewerAvatarStrip';
import { CustomerDetailsPanel } from './CustomerDetailsPanel';
import { createLogger } from '@/utils/logger';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';
import { AgentNotesPanel } from './AgentNotesPanel';
// import { CustomFieldsPanel } from './CustomFieldsPanel';
import { ClassificationPanel } from './ClassificationPanel';
import { InteractionRightPanel } from './InteractionRightPanel';
import { ViewingPage } from '@/components/viewing';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationNames } from '@/components/notifications/notification-names';
import { strings } from '@/locales/en';

const logger = createLogger('InteractionsPage');

interface InteractionsPageProps {
  user: User;
}

/**
 * InteractionsPage Component
 *
 * Main page for managing customer interactions.
 * Displays interaction list on the left and details on the right.
 * Supports voice, chat, and SMS channels.
 *
 * Note: State is managed in MainLayout and persists across navigation.
 * This component receives state via React Router's Outlet context.
 */
function InteractionsPage({ user }: InteractionsPageProps) {
  // Get interaction state from MainLayout via Outlet context
  const {
    interactions,
    incomingInteraction,
    createdInteraction,
    selectedInteractionId,
    setInteractions,
    setIncomingInteraction,
    setSelectedInteractionId,
    isUserLoggedIn,
  } = useOutletContext<InteractionsContextType>();
  const { addNotification, removeNotification } = useNotifications();

  //ref to store the cleanup functions for the interactions
  const cleanupFunctionsRef = useRef<Map<string, () => void>>(new Map<string, () => void>());

  // Get the currently selected interaction
  const selectedInteraction = interactions.find((i) => i.interactionId === selectedInteractionId);

  // Transfer panel visibility state
  const [showTransferPanel, setShowTransferPanel] = useState(false);

  // Per-interaction message feed. Indexed by interactionId so messages persist when
  // the user switches between interactions. Cleaned up when an interaction is removed.
  const [messagesByInteractionId, setMessagesByInteractionId] = useState<
    Record<string, Message[]>
  >({});

  // Per-interaction message-history iterator. Created lazily on first feed view of
  // each interaction; reused for subsequent "load older" requests. Persists across
  // tab switches and even across interaction switches (so re-selecting an
  // interaction doesn't refetch the newest batch).
  const iteratorsRef = useRef<Map<string, MessagesIterator>>(new Map<string, MessagesIterator>());

  // Tracks which interactions have an in-flight history fetch. Backed by a ref so
  // the concurrent-call guard in `loadOlderHistory` doesn't have to read from
  // closure state — that would force the callback's identity to change on every
  // history-state update, which cascades to MessagePanel's scroll handler.
  const loadingHistoryRef = useRef<Set<string>>(new Set<string>());

  // Per-interaction history-loading UI state.
  interface HistoryUiState {
    loading: boolean;
    error?: string;
    hasMore: boolean;
  }
  const [historyStateByInteractionId, setHistoryStateByInteractionId] = useState<
    Record<string, HistoryUiState>
  >({});

  // Reset transfer panel whenever the selected interaction changes.
  // Without this, showTransferPanel stays true after an attended transfer completes:
  // the TransferPanel unmounts when the interaction enters WRAP_UP (before its
  // TRANSFER_COMPLETE handler can call onClose), leaving showTransferPanel=true and
  // causing the panel to auto-open on the next accepted interaction.
  useEffect(() => {
    setShowTransferPanel(false);
  }, [selectedInteractionId]);

  const [isAudioPermissionDenied, setIsAudioPermissionDenied] = useState(
    user.getAudioDevicePermissionState() === MediaDevicePermissionState.DENIED
  );

  // Discover Interactions tab — when active, the main content area shows the
  // discover/viewing table instead of the selected interaction's detail view.
  const [isDiscoverActive, setIsDiscoverActive] = useState(false);

  // Lightweight re-render trigger for when SDK mutates Interaction objects internally
  // (e.g. status changes, viewer updates). Incrementing this forces a re-render
  // without creating a new interactions array reference.
  const [, setInteractionTick] = useState(0);
  const triggerRerender = useCallback(() => {
    setInteractionTick(t => t + 1);
  }, []);

  // Subscribe to events on an inbound call as soon as the ring arrives,
  // before the agent accepts — avoids a race condition where accept fires
  // before we have subscribed.
  useEffect(() => {
    if (incomingInteraction) {
      subscribeToInteractionEvents(incomingInteraction);
    }
  }, [incomingInteraction]);

  // Subscribe to events on an outbound call. The interaction is already
  // CONNECTED when INTERACTION_CREATED fires, so there is no accept/reject
  // step — subscribe immediately so call-state changes (hold, mute, etc.)
  // are reflected in the UI from the moment the call connects.
  useEffect(() => {
    if (createdInteraction) {
      subscribeToInteractionEvents(createdInteraction);
    }
  }, [createdInteraction]);

  useEffect(() => {
    const grantedHandlerId = user.subscribe(
      UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED,
      () => setIsAudioPermissionDenied(false)
    );
    const deniedHandlerId = user.subscribe(
      UserEventType.AUDIO_DEVICE_PERMISSION_DENIED,
      () => setIsAudioPermissionDenied(true)
    );

    setIsAudioPermissionDenied(user.getAudioDevicePermissionState() === MediaDevicePermissionState.DENIED);

    return () => {
      safeUnsubscribeUser(user, UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED, grantedHandlerId);
      safeUnsubscribeUser(user, UserEventType.AUDIO_DEVICE_PERMISSION_DENIED, deniedHandlerId);
    };
  }, [user]);

  // Subscribe to events for interactions recovered after a page refresh.
  // getAssignedInteractions() pre-populates the interactions array on mount without
  // going through the incomingInteraction or createdInteraction paths, so we
  // catch any that have no subscription yet.
  useEffect(() => {
    interactions.forEach((interaction) => {
      if (!cleanupFunctionsRef.current.has(interaction.interactionId)) {
        logger.log('Subscribing to page-refresh recovered interaction:', interaction.interactionId);
        subscribeToInteractionEvents(interaction);
      }
    });
  }, [interactions]);

  // When an interaction becomes selected (accept, outbound dial, viewer-created),
  // exit Discover mode so the user lands on the interaction's detail view.
  useEffect(() => {
    if (selectedInteractionId) {
      setIsDiscoverActive(false);
    }
  }, [selectedInteractionId]);

  // Handler: Select an interaction
  const handleSelectInteraction = useCallback((interaction: Interaction) => {
    //if interaction current status is Pending do not select it
    if (interaction.currentStatus === InteractionStatus.PENDING) {
      logger.log('Interaction is Pending, do not select it');
      return;
    }
    logger.log('Selected interaction:', interaction.interactionId);
    setIsDiscoverActive(false);
    setSelectedInteractionId(interaction.interactionId);
  }, []);

  // Handler: Toggle Discover Interactions tab
  const handleDiscoverClick = useCallback(() => {
    setIsDiscoverActive((prev) => !prev);
  }, []);

  // Handler: Accept incoming interaction
  const handleAcceptIncoming = useCallback(async (interaction: Interaction) => {
    logger.log('Accept interaction: ', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.accept();
  }, []);

  // Handler: Reject incoming interaction
  const handleRejectIncoming = useCallback(async (interaction: Interaction) => {
    logger.log('Reject interaction: ', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.reject();
  }, []);

  // Handler: Hold/Resume
  const handleHold = useCallback(async (interaction: Interaction) => {
    if (interaction.isHold) {
      await interaction.resumeCall();
    } else {
      await interaction.holdCall();
    }
  }, []);

  // Handler: Mute/Unmute
  const handleMute = useCallback(async (interaction: Interaction) => {
    if (interaction.isMuted) {
      await interaction.unmute();
    } else {
      await interaction.mute();
    }
  }, []);

  // Handler: Transfer — toggles the transfer panel visibility
  const handleTransfer = useCallback(() => {
    setShowTransferPanel((prev) => !prev);
  }, []);

  // Handler: End call
  const handleEndCall = useCallback(async (interaction: Interaction) => {
    logger.log('End interaction:', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.disconnectCall();
  }, []);

  // Handler: Closed Resolved
  const handleClosedResolved = useCallback(async (interaction: Interaction) => {
    logger.log('Closed resolved:', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.close(ResolutionStatus.RESOLVED);
  }, []);

  // Handler: Closed Unresolved
  const handleClosedUnresolved = useCallback(async (interaction: Interaction) => {
    logger.log('Closed unresolved:', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.close(ResolutionStatus.UNRESOLVED);
  }, []);

  // Handler: Wrap Up
  const handleWrapUp = useCallback(async (interaction: Interaction) => {
    logger.log('Wrap up:', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.complete();
  }, []);

  // Handler: Extend Wrap Up
  const handleExtendWrapUp = useCallback(async (interaction: Interaction) => {
    logger.log('Extend wrap up:', interaction.interactionId, ' interaction status:', interaction.currentStatus);
    await interaction.extendWrapUp();
  }, []);

  // Handler: Viewer Mute (role-agnostic — mute() routes to the viewer self-mute path internally)
  const handleViewerMute = useCallback(async (interaction: Interaction) => {
    logger.log('Viewer mute:', interaction.interactionId);
    await interaction.mute();
  }, []);

  // Handler: Viewer Unmute (role-agnostic — unmute() routes to the viewer self-unmute path internally)
  const handleViewerUnmute = useCallback(async (interaction: Interaction) => {
    logger.log('Viewer unmute:', interaction.interactionId);
    await interaction.unmute();
  }, []);

  // Handler: Viewer Leave Call (leave audio but stay as viewer)
  const handleViewerLeave = useCallback(async (interaction: Interaction) => {
    logger.log('Viewer leave call:', interaction.interactionId);
    await interaction.leaveCall();
  }, []);

  // Handler: Viewer Join Call (rejoin audio after leaving)
  // The SDK action now waits for VIEWER_JOINED_CALL (non-Elite: synthesized after WebRTC,
  // Elite: from server updateViewer) or fails on VIEWER_LEFT_CALL / 30s timeout.
  const handleViewerJoinCall = useCallback(async (interaction: Interaction) => {
    logger.log('Viewer join call:', interaction.interactionId);
    await interaction.joinCall();
  }, []);

  // Handler: Viewer Remove (leave interaction completely)
  const handleViewerRemove = useCallback(async (interaction: Interaction) => {
    logger.log('Viewer remove:', interaction.interactionId);
    await interaction.leave();
  }, []);

  // Handler: Owner mutes/unmutes a specific public viewer. The SDK exposes
  // separate mute()/unmute() methods now; pick the direction from the current
  // viewer state so the strip's single mute-toggle button keeps working.
  // Errors are thrown to ViewerAvatarStrip so it can surface them via NotificationProvider.
  const handleOwnerMuteViewer = useCallback(async (viewer: Viewer) => {
    logger.log('Owner mute viewer:', viewer.id, 'currentlyMuted:', viewer.isMuted);
    if (viewer.isMuted) {
      await viewer.unmute();
    } else {
      await viewer.mute();
    }
  }, []);

  // Handler: Owner removes a specific public viewer from the interaction.
  const handleOwnerRemoveViewer = useCallback(async (viewer: Viewer) => {
    logger.log('Owner remove viewer:', viewer.id);
    await viewer.remove();
  }, []);

  // Handler: Owner promotes a public viewer to interaction owner.
  const handleAssignOwner = useCallback(async (viewer: Viewer) => {
    logger.log('Assign owner:', viewer.id);
    await viewer.assignOwner();
  }, []);

  // Per-interaction in-flight flag for coach/uncoach. Tracked by interactionId
  // rather than a single bool so two viewer cards can each have an independent
  // coach toggle in flight. Cleared by the COACH_STARTED / COACH_ENDED event
  // handlers or by the try/finally in the handler itself.
  const [coachLoadingIds, setCoachLoadingIds] = useState<Set<string>>(new Set());
  const setCoachLoading = useCallback((interactionId: string, loading: boolean) => {
    setCoachLoadingIds((prev) => {
      const has = prev.has(interactionId);
      if (loading === has) return prev;
      const next = new Set(prev);
      if (loading) next.add(interactionId);
      else next.delete(interactionId);
      return next;
    });
  }, []);

  // Per-interaction in-flight flag for barge/unbarge. Cleared by the
  // BARGE_STARTED / BARGE_ENDED event handlers or by the try/finally in the
  // handler itself.
  const [bargeLoadingIds, setBargeLoadingIds] = useState<Set<string>>(new Set());
  const setBargeLoading = useCallback((interactionId: string, loading: boolean) => {
    setBargeLoadingIds((prev) => {
      const has = prev.has(interactionId);
      if (loading === has) return prev;
      const next = new Set(prev);
      if (loading) next.add(interactionId);
      else next.delete(interactionId);
      return next;
    });
  }, []);

  // Handler: Coach (Elite supervisor enters coach mode — whispers to agent only).
  // coach() resolves once the server confirms the mode transition. Loading is
  // cleared in finally — guarantees the button re-enables whether the promise
  // resolves (success) or rejects (HTTP error / 30s confirmation timeout). The
  // COACH_STARTED event subscription elsewhere also clears loading; that's a
  // redundant safety net for the case where coach() resolves before the React
  // render cycle picks up the event, and it's harmless once finally is in place.
  const handleCoach = useCallback(async (interaction: Interaction) => {
    logger.log('Coach:', interaction.interactionId);
    setCoachLoading(interaction.interactionId, true);
    try {
      await interaction.coach();
    } catch (err) {
      logger.log('Coach rejected:', err instanceof Error ? err.message : err);
    } finally {
      setCoachLoading(interaction.interactionId, false);
    }
  }, [setCoachLoading]);

  // Handler: Barge (Elite supervisor enters listen-talk mode — supervisor's
  // voice is audible to BOTH customer and agent). Mirrors handleCoach exactly.
  const handleBarge = useCallback(async (interaction: Interaction) => {
    logger.log('Barge:', interaction.interactionId);
    setBargeLoading(interaction.interactionId, true);
    try {
      await interaction.barge();
    } catch (err) {
      logger.log('Barge rejected:', err instanceof Error ? err.message : err);
    } finally {
      setBargeLoading(interaction.interactionId, false);
    }
  }, [setBargeLoading]);

  // Handler: Unbarge (Elite supervisor exits listen-talk back to listen-only —
  // mic silenced again). Mirrors handleCoach exactly.
  const handleUnbarge = useCallback(async (interaction: Interaction) => {
    logger.log('Unbarge:', interaction.interactionId);
    setBargeLoading(interaction.interactionId, true);
    try {
      await interaction.unbarge();
    } catch (err) {
      logger.log('Unbarge rejected:', err instanceof Error ? err.message : err);
    } finally {
      setBargeLoading(interaction.interactionId, false);
    }
  }, [setBargeLoading]);

  // Handler: Claim Ownership (viewer takes ownership of the interaction).
  // Re-throws as a plain Error carrying the server-rejection detail so withLoading's
  // default error toast surfaces it.
  const handleClaimOwnership = useCallback(async (interaction: Interaction) => {
    logger.log('Claim ownership:', interaction.interactionId);
    try {
      await interaction.claimOwnership();
    } catch (err) {
      if (AvayaInfinityAgentSdkError.is(err)) {
        throw new Error(err.detail ?? err.message);
      }
      throw err;
    }
  }, []);

  const subscribeToInteractionEvents = useCallback((interaction: Interaction) => {

    // Prevent duplicate subscriptions for the same interaction, invoked when incominginteraction gets updated by MainLayout
    if (cleanupFunctionsRef.current.has(interaction.interactionId)) {
      logger.log('Already subscribed to interaction:', interaction.interactionId);
      return;
    }

    logger.log('Subscribe to interaction events:', interaction.interactionId);
    
    // Subscribe to accepted event
    const acceptedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_ACCEPTED, (event) => {
      logger.log('Interaction accepted:', event.type, ' isAutoAccepted:', event.payload.isAutoAccepted, ' interaction status:', interaction.currentStatus);
      setInteractions((prev) =>
        prev.some((i) => i.interactionId === interaction.interactionId)
          ? prev
          : [...prev, interaction]
      );
      setSelectedInteractionId(interaction.interactionId);
      setIncomingInteraction(undefined);
      // Confirm auto-accept post-hoc — only after the SDK actually succeeded.
      // Firing on receive-time would be premature (auto-accept can still fail).
      if (event.payload.isAutoAccepted) {
        addNotification({
          id: `${NotificationNames.AUTO_ACCEPTED}:${interaction.interactionId}`,
          level: 'info',
          title: strings.notifications.events.autoAcceptedTitle,
          description: strings.notifications.events.autoAcceptedDescription(
            interaction.customer.name || interaction.customer.phone || interaction.interactionId
          ),
          autoDismissMs: 4000,
        });
      }
    });

    // Subscribe to disconnect call event
    const disconnectedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_DISCONNECTED, (event) => {
      logger.log('Interaction call disconnected:', event.type, ' interaction status:', interaction.currentStatus);
      setInteractions((prev) => 
        prev.map(i => i.interactionId === interaction.interactionId ? interaction : i)
      );
    });

    // Subscribe to wrapup call event
    // After queue blind transfer or call end, interaction goes to wrapUp state
    // Agent needs to complete wrap up work (fill in form) before closing
    const wrapUpHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_WRAP_UP, (event) => {
      logger.log('Interaction wrap up:', event.type, ' interaction status:', interaction.currentStatus);
      removeNotification(NotificationNames.CALL_FAILURE_RECONNECTING);
      // Update interaction in list (stays visible for wrap up work)
      setInteractions((prev) =>
        prev.map(i => i.interactionId === interaction.interactionId ? interaction : i)
      );
    });

    // Subscribe to wrap-up extended event — deadline updated, re-render to refresh countdown
    const wrapUpExtendedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_WRAP_UP_EXTENDED, (event) => {
      logger.log('Interaction wrap up extended:', event.type, ' new deadline:', event.payload.deadline);
      triggerRerender();
    });

    // Subscribe to completed event
    const completedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_COMPLETED, (event) => {
      logger.log('Interaction completed:', event.type, ' interaction status:', interaction.currentStatus);
      removeNotification(NotificationNames.CALL_FAILURE_RECONNECTING);
      if (interaction.isViewer()) {
        // Viewer interactions stay until the viewer explicitly removes themselves.
        // The interaction is removed when INTERACTION_VIEWER_REMOVED fires.
        triggerRerender();
      } else {
        // Only clear selection if THIS interaction was the one selected.
        // Otherwise accepting a new interaction while another is in wrapUp
        // would deselect the newly accepted interaction when the wrapUp one auto-completes.
        setSelectedInteractionId((prev) =>
          prev === interaction.interactionId ? undefined : prev
        );
        // Clear incoming alert if the completed interaction was still pending acceptance
        setIncomingInteraction((prev) =>
          prev?.interactionId === interaction.interactionId ? undefined : prev
        );
        setInteractions((prev) => prev.filter((i) => i.interactionId !== interaction.interactionId));
        cleanupSubscription(interaction);
      }
    });

    const rejectedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_REJECTED, (event) => {
      logger.log('Interaction rejected:', event.type, ' interaction status:', interaction.currentStatus);
      setIncomingInteraction(undefined);
      cleanupSubscription(interaction);
    });

    // Subscribe to blind transfer complete event - fires for BOTH user and queue transfers
    const blindTransferredHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_BLIND_TRANSFERRED, (event) => {
      logger.log('Blind transfer completed:', event.type, ' interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Subscribe to call state events — mute/hold/established changes need to update controls UI
    const callEstablishedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_ESTABLISHED, () => {
      logger.log('Call established, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const mutedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_MUTED, () => {
      logger.log('Call muted, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const unmutedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_UNMUTED, () => {
      logger.log('Call unmuted, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const heldHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_HELD, () => {
      logger.log('Call held, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const resumedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_RESUMED, () => {
      logger.log('Call resumed, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Subscribe to attended transfer lifecycle events.
    // These trigger re-renders so the TransferPanel can sync its step with interaction status.
    const transferHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_TRANSFER, () => {
      logger.log('Attended transfer initiated, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const transferAnswerHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_TRANSFER_ANSWER, () => {
      logger.log('Consulted agent answered, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const transferCancelHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_TRANSFER_CANCEL, () => {
      logger.log('Transfer cancelled, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const transferCompleteHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_TRANSFER_COMPLETE, () => {
      logger.log('Transfer completed, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const transferFailedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_TRANSFER_FAILED, () => {
      logger.log('Transfer failed, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Subscribe to conference events
    const conferenceHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CONFERENCE, () => {
      logger.log('Conference initiated, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const conferenceCompleteHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CONFERENCE_COMPLETE, () => {
      logger.log('Conference complete, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Viewer events — trigger re-render to update viewer list / controls
    const viewerAddedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_ADDED, () => {
      logger.log('Viewer added, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const viewerRemovedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_REMOVED, (event) => {
      logger.log('Viewer removed, interaction status:', interaction.currentStatus);
      // Identify "self removed" from the event payload rather than from
      // isOwner/isViewer flags. For a user viewing their own past completed
      // interaction, `isOwner` stays true (historical user.id match) and
      // `isViewer()` flips to false after teardown — the owner heuristic
      // would incorrectly keep the card. The event payload reliably names
      // the removed viewer.
      const removedSelf = event.payload.viewer.id === user.userId;
      if (removedSelf) {
        setSelectedInteractionId((prev) =>
          prev === interaction.interactionId ? undefined : prev
        );
        setInteractions((prev) => prev.filter((i) => i.interactionId !== interaction.interactionId));
        cleanupSubscription(interaction);
      } else {
        // Another viewer was removed; the current user is still owner or viewer.
        triggerRerender();
      }
    });

    // NOTE: mute/unmute for ALL participants (owner, transfer-consult, viewers) arrives via
    // INTERACTION_CALL_MUTED / INTERACTION_CALL_UNMUTED (carrying payload.userId). 
    // Row components read live state (getViewers()[].isMuted / isMuted).

    const viewerJoinedCallHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_JOINED_CALL, () => {
      logger.log('Viewer joined call');
      triggerRerender();
    });


    const viewerLeftCallHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_LEFT_CALL, (event) => {
      logger.log('Viewer left call, interaction status:', interaction.currentStatus, 'viewer:', event.payload.viewer?.id);
      triggerRerender();
    });

    // Elite supervisor coach lifecycle — clear the in-flight loading flag and
    // re-render so ViewerAvatarStrip picks up the new eliteSupervisorMode from
    // `currentViewingState` (the START COACHING button hides once mode=='coach').
    const coachStartedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_COACH_STARTED, () => {
      logger.log('Viewer coach started, interaction:', interaction.interactionId);
      setCoachLoading(interaction.interactionId, false);
      triggerRerender();
    });

    const coachEndedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_COACH_ENDED, () => {
      logger.log('Viewer coach ended, interaction:', interaction.interactionId);
      setCoachLoading(interaction.interactionId, false);
      triggerRerender();
    });

    // Elite supervisor barge lifecycle — same shape as coach: clear in-flight
    // loading and re-render so the strip swaps BARGE IN <-> STOP BARGING + the
    // "Barged In" status badge appears/disappears based on the new
    // `currentViewer.eliteSupervisorMode`.
    const bargeStartedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_BARGE_STARTED, () => {
      logger.log('Viewer barge started, interaction:', interaction.interactionId);
      setBargeLoading(interaction.interactionId, false);
      triggerRerender();
    });

    const bargeEndedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_VIEWER_BARGE_ENDED, () => {
      logger.log('Viewer barge ended, interaction:', interaction.interactionId);
      setBargeLoading(interaction.interactionId, false);
      triggerRerender();
    });

    // Ownership transfer — when the current user claims ownership (or loses it to another viewer),
    // isViewer()/isOwner flips and the viewer-controls / owner-controls branches in CallControlsBar
    // need to swap. Trigger a re-render so the SDK-driven state is reflected in the UI.
    const ownershipChangedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_OWNERSHIP_CHANGED, () => {
      logger.log('Ownership changed, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const classificationUpdatedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CLASSIFICATION_UPDATED, () => {
      logger.log('Classification updated, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const customerInfoUpdatedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CUSTOMER_INFO_UPDATED, () => {
      logger.log('Customer info updated, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Subscribe to subject updates so the CustomerDetailsPanel's subject Input
    // re-renders when the server pushes a new subject (e.g. another agent in
    // attended transfer updated it, or the value comes back from our own setSubject PUT).
    const subjectUpdatedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_SUBJECT_UPDATED, () => {
      logger.log('Subject updated, interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Subscribe to notes updates
    const notesUpdatedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_NOTES_UPDATED, (event) => {
      logger.log('Notes updated:', event.payload.notes, ' interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    // Subscribe to custom-fields updates
    const customFieldsUpdatedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CUSTOM_FIELDS_UPDATED, (event) => {
      logger.log('Custom fields updated:', event.payload.customFields, ' interaction status:', interaction.currentStatus);
      triggerRerender();
    });

    const callFailedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_CALL_FAILED, (event) => {
      logger.log('Call failed:', event.payload.failReason, 'reconnecting:', event.payload.reconnecting, 'message:', event.payload.userFriendlyMessage);
      triggerRerender();
    });

    // Append received and sent messages to this interaction's feed.
    const appendMessage = (message: Message) => {
      setMessagesByInteractionId((prev) => {
        const existing = prev[interaction.interactionId] ?? [];
        if (existing.some((m) => m.messageId === message.messageId)) return prev;
        return { ...prev, [interaction.interactionId]: [...existing, message] };
      });
    };

    const messageReceivedHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_MESSAGE_RECEIVED, (event) => {
      logger.log('Message received:', event.payload.message.messageId, 'private:', event.payload.message.isPrivate);
      appendMessage(event.payload.message);
    });

    const messageSentHandlerId = interaction.subscribe(InteractionEventType.INTERACTION_MESSAGE_SENT, (event) => {
      logger.log('Message sent (echoed):', event.payload.message.messageId);
      appendMessage(event.payload.message);
    });

    // Store ONE combined cleanup function that unsubscribes from ALL events
    cleanupFunctionsRef.current.set(interaction.interactionId, () => {
      logger.log('Cleaning up all subscriptions for interaction:', interaction.interactionId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_ACCEPTED, acceptedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_DISCONNECTED, disconnectedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_WRAP_UP, wrapUpHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_WRAP_UP_EXTENDED, wrapUpExtendedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_COMPLETED, completedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_REJECTED, rejectedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_BLIND_TRANSFERRED, blindTransferredHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_ESTABLISHED, callEstablishedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_MUTED, mutedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_UNMUTED, unmutedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_HELD, heldHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_RESUMED, resumedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER, transferHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_ANSWER, transferAnswerHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_CANCEL, transferCancelHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_COMPLETE, transferCompleteHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_TRANSFER_FAILED, transferFailedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CONFERENCE, conferenceHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CONFERENCE_COMPLETE, conferenceCompleteHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_ADDED, viewerAddedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_REMOVED, viewerRemovedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_JOINED_CALL, viewerJoinedCallHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_LEFT_CALL, viewerLeftCallHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_COACH_STARTED, coachStartedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_COACH_ENDED, coachEndedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_BARGE_STARTED, bargeStartedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_VIEWER_BARGE_ENDED, bargeEndedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_OWNERSHIP_CHANGED, ownershipChangedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CLASSIFICATION_UPDATED, classificationUpdatedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CUSTOMER_INFO_UPDATED, customerInfoUpdatedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_SUBJECT_UPDATED, subjectUpdatedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_NOTES_UPDATED, notesUpdatedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CUSTOM_FIELDS_UPDATED, customFieldsUpdatedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_CALL_FAILED, callFailedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_MESSAGE_RECEIVED, messageReceivedHandlerId);
      interaction.unsubscribe(InteractionEventType.INTERACTION_MESSAGE_SENT, messageSentHandlerId);
    });
  }, []);

  const cleanupSubscription = useCallback((interaction: Interaction) => {
    const cleanupFunction = cleanupFunctionsRef.current.get(interaction.interactionId);
    if (cleanupFunction) {
      cleanupFunction();
      cleanupFunctionsRef.current.delete(interaction.interactionId);
    }
    setMessagesByInteractionId((prev) => {
      if (!(interaction.interactionId in prev)) return prev;
      const { [interaction.interactionId]: _removed, ...rest } = prev;
      return rest;
    });
    iteratorsRef.current.delete(interaction.interactionId);
    loadingHistoryRef.current.delete(interaction.interactionId);
    setHistoryStateByInteractionId((prev) => {
      if (!(interaction.interactionId in prev)) return prev;
      const { [interaction.interactionId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * Loads the next batch of older messages into the feed for this interaction.
   *
   * - The first call creates the iterator (`pageSize: 10`, order defaults to DESC,
   *   which starts at the newest end of the conversation).
   * - Subsequent calls reuse the same iterator and walk further back in time.
   * - Each batch is reversed (server returns newest-first within a batch) and
   *   merged into the feed with dedup-by-messageId so the existing chronological
   *   order in `messagesByInteractionId` is preserved.
   * - UI-level guard against duplicate concurrent calls; the iterator also
   *   serializes internally so this is belt-and-braces.
   */
  const loadOlderHistory = useCallback(async (interaction: Interaction) => {
    const id = interaction.interactionId;

    // Get-or-create the iterator. Only created the first time we load history
    // for this interaction; reused for subsequent scroll-up loads.
    let iter = iteratorsRef.current.get(id);
    if (!iter) {
      if (!interaction.canGetMessages()) {
        logger.log('Skipping history load: canGetMessages() returned false', id);
        // Materialize the "no history available" state so the empty-state banner
        // shows correctly; the `hasMore` default of `true` would otherwise hide
        // it forever for agents who can't fetch history.
        setHistoryStateByInteractionId((prev) => ({
          ...prev,
          [id]: { loading: false, hasMore: false },
        }));
        return;
      }
      try {
        iter = interaction.getMessages({ pageSize: 10 });
      } catch (err) {
        logger.log('Failed to construct messages iterator for', id, err);
        setHistoryStateByInteractionId((prev) => ({
          ...prev,
          [id]: {
            loading: false,
            hasMore: false,
            error: err instanceof Error ? err.message : String(err),
          },
        }));
        return;
      }
      iteratorsRef.current.set(id, iter);
    }

    // UI-level concurrent-call guard via ref — avoids a closure dep on
    // historyStateByInteractionId that would otherwise force this callback's
    // identity to change on every history-state update. The iterator also
    // serializes internally; this skips a queued no-op call.
    if (loadingHistoryRef.current.has(id)) {
      return;
    }
    if (!iter.hasPrevious()) {
      // Nothing left to fetch — make sure the UI knows.
      setHistoryStateByInteractionId((prev) => ({
        ...prev,
        [id]: { loading: false, hasMore: false },
      }));
      return;
    }

    loadingHistoryRef.current.add(id);
    setHistoryStateByInteractionId((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { hasMore: true }), loading: true, error: undefined },
    }));

    try {
      const batch = await iter.previous();
      // Batch arrives newest-first per the iterator's order=DESC contract.
      // Reverse to chronological, then dedup against existing messages so the
      // seam between history and live socket messages doesn't duplicate.
      setMessagesByInteractionId((prev) => {
        const existing = prev[id] ?? [];
        if (batch.length === 0) return prev;
        const existingIds = new Set(existing.map((m) => m.messageId));
        const reversed = [...batch].reverse();
        const newOnes = reversed.filter((m) => !existingIds.has(m.messageId));
        if (newOnes.length === 0) return prev;
        return { ...prev, [id]: [...newOnes, ...existing] };
      });
      setHistoryStateByInteractionId((prev) => ({
        ...prev,
        [id]: { loading: false, hasMore: iter!.hasPrevious() },
      }));
    } catch (err) {
      logger.log('History fetch failed for', id, err);
      setHistoryStateByInteractionId((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? { hasMore: true }),
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    } finally {
      loadingHistoryRef.current.delete(id);
    }
  }, []);

  // Trigger initial history load the first time an interaction is selected.
  // The iteratorsRef map is the "have we initiated loading?" indicator — once an
  // entry exists, we don't re-fire. This means tab switches inside the same
  // interaction never re-fetch the newest batch.
  useEffect(() => {
    if (!selectedInteraction) return;
    if (iteratorsRef.current.has(selectedInteraction.interactionId)) return;
    loadOlderHistory(selectedInteraction);
    // `loadOlderHistory` is stable (empty deps) and `selectedInteraction` is
    // derived from `selectedInteractionId`; keying the effect on the id avoids
    // re-fires on unrelated interaction-list re-renders. The iteratorsRef guard
    // above is the real safety net against double-loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInteractionId]);

  // Handler: send a chat message. The bubble appears in the feed when the
  // `INTERACTION_MESSAGE_SENT` echo arrives (~one round-trip after click);
  // no optimistic UI for now. Errors surface as a toast.
  const handleSendMessage = useCallback(async (interaction: Interaction, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await interaction.sendMessage(new ChatMessageRequest().setText(trimmed));
    } catch (err) {
      logger.log('Send message failed for interaction', interaction.interactionId, err);
      addNotification({
        id: `send-message-error-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.messages.sendErrorTitle,
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [addNotification]);

  // Handler: Save classification type
  const handleSaveClassificationType = useCallback(async (interaction: Interaction, classification: ClassificationCode) => {
    logger.log('Save classification type:', interaction.interactionId, ' type:', classification.name);
    await interaction.setClassificationType(classification);
  }, []);

  // Handler: Save classification result
  const handleSaveClassificationResult = useCallback(async (interaction: Interaction, classification: ClassificationCode) => {
    logger.log('Save classification result:', interaction.interactionId, ' result:', classification.name);
    await interaction.setClassificationResult(classification);
  }, []);

  // Handler: Save notes
  const handleSaveNotes = useCallback(async (interaction: Interaction, notes: string) => {
    logger.log('Save notes:', interaction.interactionId, ' notes:', notes);
    await interaction.setNotes(notes);
  }, []);

  return (
    <div className="flex h-full">
      {/* Left panel: Interaction list */}
      <InteractionListPanel
        user={user}
        interactions={interactions}
        incomingInteraction={incomingInteraction}
        disableAcceptIncoming={isAudioPermissionDenied}
        selectedInteractionId={selectedInteractionId}
        isDiscoverActive={isDiscoverActive}
        onSelectInteraction={handleSelectInteraction}
        onAcceptIncoming={handleAcceptIncoming}
        onRejectIncoming={handleRejectIncoming}
        onDiscoverClick={handleDiscoverClick}
        isUserLoggedIn={isUserLoggedIn}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {isDiscoverActive ? (
          <ViewingPage user={user} />
        ) : selectedInteraction ? (
          <div className="flex flex-col gap-4 h-full">
            {/* Call controls bar - shows appropriate controls based on interaction status.
                Owner perspective: full Pause/Mute/Hash/Transfer/End/Close controls.
                Viewer perspective: customer info + timer only — viewer self-actions
                are rendered in the ViewerAvatarStrip below. */}
            <CallControlsBar
              key={selectedInteraction.interactionId}
              interaction={selectedInteraction}
              onHold={handleHold}
              onMute={handleMute}
              onTransfer={handleTransfer}
              onEndCall={handleEndCall}
              onClosedResolved={handleClosedResolved}
              onClosedUnresolved={handleClosedUnresolved}
              onWrapUp={handleWrapUp}
              onExtendWrapUp={handleExtendWrapUp}
            />

            {/* Viewer avatar strip — rendered on BOTH owner and viewer views.
                - Shows the interaction owner as the first avatar (crown overlay)
                  followed by all public viewers.
                - Owner perspective: clicking a viewer reveals an inline action
                  pill next to that viewer (Assign Owner / Mute / Remove).
                - Viewer perspective: viewer self-action icon buttons
                  (Join / Leave / Mute / Claim / Stop Viewing) appear on the
                  right side of the strip. */}
            <ViewerAvatarStrip
              key={`viewers-${selectedInteraction.interactionId}`}
              interaction={selectedInteraction}
              user={user}
              onMuteViewer={handleOwnerMuteViewer}
              onRemoveViewer={handleOwnerRemoveViewer}
              onAssignOwner={handleAssignOwner}
              onViewerJoinCall={handleViewerJoinCall}
              onViewerLeaveCall={handleViewerLeave}
              onViewerMute={handleViewerMute}
              onViewerUnmute={handleViewerUnmute}
              onViewerRemove={handleViewerRemove}
              onClaimOwnership={handleClaimOwnership}
              onCoach={handleCoach}
              isCoachLoading={coachLoadingIds.has(selectedInteraction.interactionId)}
              onBarge={handleBarge}
              onUnbarge={handleUnbarge}
              isBargeLoading={bargeLoadingIds.has(selectedInteraction.interactionId)}
            />

            {/* Two-column layout for details and messages */}
            <div className="flex gap-4 flex-1 min-h-0">
              {/* Left column: Customer details and notes */}
              <div className="w-[340px] shrink-0 min-h-0 overflow-y-auto scrollbar-thin">
                <div className="flex flex-col gap-4">
                  <CustomerDetailsPanel
                    key={`customer-${selectedInteraction.interactionId}`}
                    interaction={selectedInteraction} />
                  {selectedInteraction && (
                    <ClassificationPanel
                      key={`classification-${selectedInteraction.interactionId}`}
                      interaction={selectedInteraction}
                      onSaveType={(classification) => handleSaveClassificationType(selectedInteraction, classification)}
                      onSaveResult={(classification) => handleSaveClassificationResult(selectedInteraction, classification)}
                    />
                  )}
                  {selectedInteraction ? (
                      <AgentNotesPanel
                        key={`notes-${selectedInteraction.interactionId}`}
                        interaction={selectedInteraction}
                        initialNotes={selectedInteraction.notes || ""}
                        onSave={(notes) => handleSaveNotes(selectedInteraction, notes)}
                      />
                  ) : null}
                  {/* {selectedInteraction ? (
                    <CustomFieldsPanel
                      key={`custom-fields-${selectedInteraction.interactionId}`}
                      interaction={selectedInteraction}
                    />
                  ) : null} */}
                </div>
              </div>

              {/* Right column: tabbed Messages/Transfers panel.
                  - Messages tab is always visible.
                  - Transfers tab appears once the user opens the Transfer panel
                    (or an attended transfer is already in progress) and is
                    auto-selected so the existing transfer flow is uninterrupted. */}
              <div className="flex-1 min-h-0">
                <InteractionRightPanel
                  key={selectedInteraction.interactionId}
                  interaction={selectedInteraction}
                  messages={messagesByInteractionId[selectedInteraction.interactionId] ?? []}
                  currentUserId={user.userId}
                  onSendMessage={(text) => handleSendMessage(selectedInteraction, text)}
                  historyLoading={historyStateByInteractionId[selectedInteraction.interactionId]?.loading ?? false}
                  // Default to `true` so the "No messages yet" empty-state banner doesn't
                  // flash before the initial-load useEffect fires. Unknown = assume more
                  // may exist; we only confirm "no more" after a server fetch.
                  hasMoreHistory={historyStateByInteractionId[selectedInteraction.interactionId]?.hasMore ?? true}
                  historyError={historyStateByInteractionId[selectedInteraction.interactionId]?.error}
                  onLoadOlderHistory={() => loadOlderHistory(selectedInteraction)}
                  transfersTabAvailable={
                    showTransferPanel ||
                    selectedInteraction.currentStatus === InteractionStatus.ATTENDED_TRANSFER
                  }
                  transferUserRequestedOpen={showTransferPanel}
                  onTransferClose={() => setShowTransferPanel(false)}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Empty state when no interaction selected */
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-sm">Select an interaction to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { InteractionsPage };
