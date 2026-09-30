import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import {
  AvayaInfinityAgentSdk,
  Interaction,
  WebSocketConnectionEventType,
  UserEventType,
  type InteractionReceivedEvent,
  type InteractionCreatedEvent,
  type InteractionViewingStartedEvent,
  type InteractionAutoAcceptFailedEvent,
  type InteractionCallFailedEvent,
  type User,
  InteractionEventType
} from '@avaya/infinity-agent-sdk';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { NotificationCenter } from './NotificationCenter';
import { WebRtcAudioPermissionDialog } from './WebRtcAudioPermissionDialog';
import { MissingAudioDeviceDialog } from './MissingAudioDeviceDialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createLogger } from '@/utils/logger';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationNames } from '@/components/notifications/notification-names';
import { strings } from '@/locales/en';
import { useAudioDeviceAvailability } from '@/hooks/useAudioDeviceAvailability';

const logger = createLogger('MainLayout');

/**
 * Inserts an interaction at the head of the list unless one with the same
 * `interactionId` is already present. New arrivals go to the top so a ring
 * on a busy list is visible without scrolling.
 */
function prependInteraction(list: Interaction[], interaction: Interaction): Interaction[] {
  if (list.some((existing) => existing.interactionId === interaction.interactionId)) return list;
  return [interaction, ...list];
}

interface MainLayoutProps {
  user: User;
  onSignOut?: () => void;
}

export interface InteractionsContextType {
  interactions: Interaction[];
  selectedInteractionId: string | undefined;
  isUserLoggedIn: boolean;
  setInteractions: React.Dispatch<React.SetStateAction<Interaction[]>>;
  setSelectedInteractionId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

/**
 * MainLayout Component
 * 
 * Main application layout with header, sidebar, and content area.
 * Uses React Router's Outlet for nested route rendering.
 * 
 * Manages global interaction state and subscriptions to SDK events.
 * State persists across page navigation.
 */
function MainLayout({ user, onSignOut }: Readonly<MainLayoutProps>) {
  // Every interaction the user is currently associated with — ringing,
  // connected, on hold, in wrap-up, or being viewed — lives in one list.
  // Consumers read `interaction.currentStatus` and role predicates
  // (`isViewer()`, `canAccept()`, …) to decide how to present each item.
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | undefined>(undefined);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(user.isLoggedInToCx);
  const [isAudioPermissionDialogOpen, setIsAudioPermissionDialogOpen] = useState(false);
  const { addNotification, updateNotification, removeNotification } = useNotifications();
  const {
    state: audioDeviceAvailability,
    isMissingDeviceDialogOpen,
    dismissMissingDeviceDialog,
  } = useAudioDeviceAvailability(user);

  const addInteractionToList = useCallback((interaction: Interaction) => {
    setInteractions((prev) => prependInteraction(prev, interaction));
  }, []);

  const refreshInteractionsList = useCallback(() => {
    setInteractions((prev) => [...prev]);
  }, []);

  // Inbound: the interaction is ringing. Add it to the list. Selection is not
  // set here — the agent hasn't accepted yet.
  const handleInteractionReceived = useCallback(
    (event: InteractionReceivedEvent) => {
      const interaction = event.payload.interaction;
      logger.info('Interaction received', { interactionId: interaction.interactionId, communicationType: interaction.communicationType, currentStatus: interaction.currentStatus });
      addInteractionToList(interaction);
    },
    [addInteractionToList]
  );

  // Auto-accept was attempted but did not succeed. Notify the agent so they
  // can accept manually, and refresh the list so consumers re-query
  // `canAccept()` on the interaction (it is now true again).
  const handleAutoAcceptFailed = useCallback(
    (event: InteractionAutoAcceptFailedEvent) => {
      const { interaction } = event.payload;
      logger.warn('Interaction auto accept failed', { interactionId: interaction.interactionId });
      refreshInteractionsList();
      addNotification({
        id: `${NotificationNames.AUTO_ACCEPT_FAILED}:${interaction.interactionId}`,
        level: 'warning',
        title: strings.notifications.events.autoAcceptFailedTitle,
        description: strings.notifications.events.autoAcceptFailedDescription,
        autoDismissMs: 6000,
      });
    },
    [addNotification, refreshInteractionsList]
  );

  // Outbound: the interaction is already connected when this fires. Add it
  // to the list, select it so its details open, and notify the agent that
  // their outbound call went through.
  const handleOutboundCreated = useCallback(
    (interaction: Interaction) => {
      logger.info('Interaction created', { interactionId: interaction.interactionId, communicationType: interaction.communicationType, currentStatus: interaction.currentStatus });
      addInteractionToList(interaction);
      setSelectedInteractionId(interaction.interactionId);
      addNotification({
        id: NotificationNames.OUTBOUND_CALL_CONNECTED,
        level: 'success',
        title: strings.notifications.events.outboundCallConnectedTitle,
        description: strings.notifications.events.outboundCallConnectedDescription(
          interaction.customer.phone || interaction.interactionId
        ),
        autoDismissMs: 5000,
      });
    },
    [addInteractionToList, addNotification]
  );

  // Viewer: agent joined an existing interaction as a viewer. Add it to the
  // list and select it so the viewer view opens on landing.
  const handleViewingStarted = useCallback(
    (interaction: Interaction) => {
      logger.info('Interaction viewing started', { interactionId: interaction.interactionId, communicationType: interaction.communicationType, currentStatus: interaction.currentStatus });
      addInteractionToList(interaction);
      setSelectedInteractionId(interaction.interactionId);
    },
    [addInteractionToList]
  );

  // Debug: Log initial login state
  useEffect(() => {
    logger.debug('Initial CX login state read', { loggedIn: user.isLoggedInToCx });
  }, []);

  // INTERACTION_CREATED fires for outbound calls.
  // INTERACTION_VIEWING_STARTED fires for viewer interactions.
  // Viewer-on-completed flows do not require CX login, so these subscriptions stay
  // active regardless of isUserLoggedIn — otherwise the work card never renders
  // when viewing a completed interaction while logged out of CX.
  useEffect(() => {
    const createdHandlerId = user.subscribe(
      UserEventType.INTERACTION_CREATED,
      (event: InteractionCreatedEvent) => {
        handleOutboundCreated(event.payload.interaction);
      }
    );
    const viewingHandlerId = user.subscribe(
      UserEventType.INTERACTION_VIEWING_STARTED,
      (event: InteractionViewingStartedEvent) => {
        handleViewingStarted(event.payload.interaction);
      }
    );
    return () => {
      safeUnsubscribeUser(user, UserEventType.INTERACTION_CREATED, createdHandlerId);
      safeUnsubscribeUser(user, UserEventType.INTERACTION_VIEWING_STARTED, viewingHandlerId);
    };
  }, [user, handleOutboundCreated, handleViewingStarted]);

  // INTERACTION_RECEIVED + INTERACTION_AUTO_ACCEPT_FAILED only fire for live
  // inbound customer interactions, which require CX login. Keep these gated.
  useEffect(() => {
    logger.debug('Inbound interaction subscription evaluated', { loggedIn: isUserLoggedIn });

    if (!isUserLoggedIn) {
      logger.debug('Inbound interaction subscription skipped');
      return;
    }

    const receivedHandlerId = user.subscribe(
      UserEventType.INTERACTION_RECEIVED,
      (event: InteractionReceivedEvent) => {
        handleInteractionReceived(event);
      }
    );

    const autoAcceptFailedHandlerId = user.subscribe(
      UserEventType.INTERACTION_AUTO_ACCEPT_FAILED,
      (event: InteractionAutoAcceptFailedEvent) => {
        handleAutoAcceptFailed(event);
      }
    );

    return () => {
      safeUnsubscribeUser(user, UserEventType.INTERACTION_RECEIVED, receivedHandlerId);
      safeUnsubscribeUser(user, UserEventType.INTERACTION_AUTO_ACCEPT_FAILED, autoAcceptFailedHandlerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoggedIn, handleInteractionReceived, handleAutoAcceptFailed]);

  // Track CX login state changes
  // Track CX login state and load initial interactions
  useEffect(() => {
    const cxLoggedInHandlerId = user.subscribe(
      UserEventType.USER_CX_LOGGED_IN,
      () => {
        logger.info('User logged in to CX');
        setIsUserLoggedIn(true);
      }
    );

    const cxLoggedOutHandlerId = user.subscribe(
      UserEventType.USER_CX_LOGGED_OUT,
      () => {
        logger.info('User logged out of CX');
        setIsUserLoggedIn(false);
      }
    );

    logger.debug('Assigned interactions loaded');
    setInteractions(user.getAssignedInteractions());

    return () => {
      safeUnsubscribeUser(user, UserEventType.USER_CX_LOGGED_IN, cxLoggedInHandlerId);
      safeUnsubscribeUser(user, UserEventType.USER_CX_LOGGED_OUT, cxLoggedOutHandlerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface websocket lifecycle notifications for better transparency.
  useEffect(() => {
    const connectedHandlerId = AvayaInfinityAgentSdk.subscribe(
      WebSocketConnectionEventType.CONNECTED,
      () => {
        removeNotification(NotificationNames.WEBSOCKET_CONNECTION_LOST);
        addNotification({
          id: NotificationNames.WEBSOCKET_CONNECTION_ESTABLISHED,
          level: 'success',
          title: strings.notifications.events.websocketReconnectedTitle,
          description: strings.notifications.events.websocketReconnectedDescription,
          autoDismissMs: 5000,
        });
      }
    );

    const errorHandlerId = AvayaInfinityAgentSdk.subscribe(
      WebSocketConnectionEventType.CONNECTION_ERROR,
      () => {
        removeNotification(NotificationNames.WEBSOCKET_CONNECTION_ESTABLISHED);
        addNotification({
          id: NotificationNames.WEBSOCKET_CONNECTION_LOST,
          level: 'error',
          title: strings.notifications.events.websocketLostTitle,
          description: strings.notifications.events.websocketLostDescription,
          autoDismissMs: null,
        });
      }
    );

    return () => {
      AvayaInfinityAgentSdk.unsubscribe(
        WebSocketConnectionEventType.CONNECTED,
        connectedHandlerId
      );
      AvayaInfinityAgentSdk.unsubscribe(
        WebSocketConnectionEventType.CONNECTION_ERROR,
        errorHandlerId
      );
    };
  }, [addNotification, removeNotification]);

  // Call failure notifications (SIP/telephony layer)
  useEffect(() => {
    const callFailedHandlerId = AvayaInfinityAgentSdk.subscribe(
      InteractionEventType.INTERACTION_CALL_FAILED,
      (event: InteractionCallFailedEvent) => {
        logger[event.payload.reconnecting ? 'warn' : 'error']('Call media failed', {
          interactionId: event.payload.interactionId,
          reconnecting: event.payload.reconnecting,
        });
        if (event.payload.reconnecting) {
          addNotification({
            id: NotificationNames.CALL_FAILURE_RECONNECTING,
            level: 'warning',
            title: strings.notifications.events.callFailureReconnectingTitle,
            description: strings.notifications.events.callFailureReconnectingDescription,
            loading: true,
            autoDismissMs: null,
            location: 'bottom-right',
          });
        } else {
          removeNotification(NotificationNames.CALL_FAILURE_RECONNECTING);
          addNotification({
            id: `call-failure-${event.payload.interactionId}-${Date.now()}`,
            level: 'error',
            title: strings.notifications.events.callFailureTerminalTitle,
            description: event.payload.userFriendlyMessage,
            autoDismissMs: 10000,
            location: 'top-right',
          });
        }
      }
    );

    const callEstablishedHandlerId = AvayaInfinityAgentSdk.subscribe(
      InteractionEventType.INTERACTION_CALL_ESTABLISHED,
      (event) => {
        logger.info('Call media re-established', { interactionId: event.payload.interactionId });
        updateNotification({
          id: NotificationNames.CALL_FAILURE_RECONNECTING,
          level: 'success',
          title: strings.notifications.events.callFailureReconnectedTitle,
          description: strings.notifications.events.callFailureReconnectedDescription,
          loading: false,
          autoDismissMs: 5000,
        });
      }
    );

    return () => {
      AvayaInfinityAgentSdk.unsubscribe(InteractionEventType.INTERACTION_CALL_FAILED, callFailedHandlerId);
      AvayaInfinityAgentSdk.unsubscribe(InteractionEventType.INTERACTION_CALL_ESTABLISHED, callEstablishedHandlerId);
    };
  }, [addNotification, updateNotification, removeNotification]);

  // Permission remediation remains separate from missing-hardware feedback.
  useEffect(() => {
    setIsAudioPermissionDialogOpen(audioDeviceAvailability.status === 'permissionDenied');
  }, [audioDeviceAvailability.status]);

  // Prepare context to pass to child routes
  const interactionsContext: InteractionsContextType = {
    interactions,
    selectedInteractionId,
    isUserLoggedIn,
    setInteractions,
    setSelectedInteractionId,
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        <AppHeader
          user={user}
          onSignOut={onSignOut}
          missingAudioDeviceKinds={
            audioDeviceAvailability.status === 'missing'
              ? audioDeviceAvailability.missingDeviceKinds
              : []
          }
        />

        <div className="flex flex-1 overflow-hidden">
          <AppSidebar interactionCount={interactions.length} />
          <main className="flex-1 overflow-auto relative">
            <WebRtcAudioPermissionDialog
              open={isAudioPermissionDialogOpen}
              onOpenChange={setIsAudioPermissionDialogOpen}
            />
            <MissingAudioDeviceDialog
              open={isMissingDeviceDialogOpen && audioDeviceAvailability.status === 'missing'}
              missingDeviceKinds={
                audioDeviceAvailability.status === 'missing'
                  ? audioDeviceAvailability.missingDeviceKinds
                  : []
              }
              onDismiss={dismissMissingDeviceDialog}
            />
            <NotificationCenter />
            <Outlet context={interactionsContext} />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { MainLayout };
