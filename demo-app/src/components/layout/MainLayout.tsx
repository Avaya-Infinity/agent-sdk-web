import { useState, useEffect, useCallback, useReducer } from 'react';
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
  MediaDevicePermissionState,
  InteractionEventType
} from '@avaya/infinity-agent-sdk';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { NotificationCenter } from './NotificationCenter';
import { WebRtcAudioPermissionDialog } from './WebRtcAudioPermissionDialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createLogger } from '@/utils/logger';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationNames } from '@/components/notifications/notification-names';
import { strings } from '@/locales/en';

const logger = createLogger('MainLayout');

interface MainLayoutProps {
  user: User;
  onSignOut?: () => void;
}

export interface InteractionsContextType {
  interactions: Interaction[];
  incomingInteraction: Interaction | undefined;
  createdInteraction: Interaction | undefined;
  selectedInteractionId: string | undefined;
  isUserLoggedIn: boolean;
  setInteractions: React.Dispatch<React.SetStateAction<Interaction[]>>;
  setIncomingInteraction: React.Dispatch<React.SetStateAction<Interaction | undefined>>;
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
  // Global interaction state - persists across navigation
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [incomingInteraction, setIncomingInteraction] = useState<Interaction | undefined>(undefined);
  const [createdInteraction, setCreatedInteraction] = useState<Interaction | undefined>(undefined);
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | undefined>(undefined);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(user.isLoggedInToCx);
  const [isAudioPermissionDialogOpen, setIsAudioPermissionDialogOpen] = useState(false);
  // SDK-internal action state isn't observable through React state, so we use
  // a force-render tick to make MainLayout re-render and re-evaluate
  // `interaction.canAccept()` in descendants when the SDK signals that the
  // action state changed (e.g. auto-accept failed → action cleared from
  // runningActions → canAccept now returns true again).
  const [, forceRefresh] = useReducer((x: number) => x + 1, 0);
  const { addNotification, updateNotification, removeNotification } = useNotifications();

  // Inbound: route incoming interactions to the panel. The panel uses
  // `interaction.canAccept()` to decide whether to show the manual ringing
  // alert — during auto-accept the SDK already has an accept action in flight,
  // so canAccept() returns false and the alert stays hidden until either the
  // accept succeeds (cleared in the ACCEPTED handler) or fails (canAccept goes
  // back to true, alert reappears). The "Auto-accepted" toast is fired from
  // the per-interaction ACCEPTED handler in InteractionsPage so it only shows
  // on actual success.
  const handleInteractionReceived = useCallback(
    (event: InteractionReceivedEvent) => {
      const interaction = event.payload.interaction;
      logger.log('INTERACTION_RECEIVED', interaction.interactionId, interaction.currentStatus, 'canAccept:', interaction.canAccept());
      setIncomingInteraction(interaction);
    },
    []
  );

  // Auto-accept failed mid-flight while the ring was still active: surface a
  // warning toast and force a re-render so descendants re-evaluate
  // `interaction.canAccept()` — the AcceptInteractionAction has cleared, so
  // canAccept now returns true and the ringing alert reappears for manual
  // accept. We can't bump `incomingInteraction` here: the SDK reuses the same
  // Interaction reference across the ring, so React's Object.is check would
  // bail on the setter. The force-render tick is the explicit mechanism.
  const handleAutoAcceptFailed = useCallback(
    (event: InteractionAutoAcceptFailedEvent) => {
      const { interaction } = event.payload;
      logger.warn('INTERACTION_AUTO_ACCEPT_FAILED', interaction.interactionId);
      forceRefresh();
      addNotification({
        id: `${NotificationNames.AUTO_ACCEPT_FAILED}:${interaction.interactionId}`,
        level: 'warning',
        title: strings.notifications.events.autoAcceptFailedTitle,
        description: strings.notifications.events.autoAcceptFailedDescription,
        autoDismissMs: 6000,
      });
    },
    [addNotification]
  );

  // Shared handler for any new interaction landing on the user (outbound or viewer).
  // The two dispatching events (INTERACTION_CREATED for outbound,
  // INTERACTION_VIEWING_STARTED for viewer) carry the same payload shape.
  const handleInteractionAdded = useCallback(
    (interaction: Interaction, source: UserEventType.INTERACTION_CREATED | UserEventType.INTERACTION_VIEWING_STARTED) => {
      logger.log(source, interaction.interactionId, interaction.currentStatus);
      setCreatedInteraction(interaction);
      setInteractions((prev) =>
        prev.some((i) => i.interactionId === interaction.interactionId)
          ? prev
          : [...prev, interaction]
      );
      setSelectedInteractionId(interaction.interactionId);
    },
    []
  );

  // Fire a toast when an outbound call connects. Kept separate so the callback stays
  // stable ([] deps) and doesn't affect the subscription effects below. Viewer
  // interactions do not show the outbound toast because they arrive via
  // INTERACTION_VIEWING_STARTED, not INTERACTION_CREATED.
  useEffect(() => {
    if (!createdInteraction) return;
    if (createdInteraction.isViewer()) return;
    addNotification({
      id: NotificationNames.OUTBOUND_CALL_CONNECTED,
      level: 'success',
      title: strings.notifications.events.outboundCallConnectedTitle,
      description: strings.notifications.events.outboundCallConnectedDescription(
        createdInteraction.customer.phone || createdInteraction.interactionId
      ),
      autoDismissMs: 5000,
    });
  }, [createdInteraction, addNotification]);

  // Debug: Log initial login state
  useEffect(() => {
    logger.log('Initial CX Login Status:', user.isLoggedInToCx);
    logger.log('isUserLoggedIn state:', isUserLoggedIn);
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
        logger.log('✅ INTERACTION_CREATED callback invoked!', event.payload.interaction);
        handleInteractionAdded(event.payload.interaction, UserEventType.INTERACTION_CREATED);
      }
    );
    const viewingHandlerId = user.subscribe(
      UserEventType.INTERACTION_VIEWING_STARTED,
      (event: InteractionViewingStartedEvent) => {
        logger.log('✅ INTERACTION_VIEWING_STARTED callback invoked!', event.payload.interaction);
        handleInteractionAdded(event.payload.interaction, UserEventType.INTERACTION_VIEWING_STARTED);
      }
    );
    return () => {
      safeUnsubscribeUser(user, UserEventType.INTERACTION_CREATED, createdHandlerId);
      safeUnsubscribeUser(user, UserEventType.INTERACTION_VIEWING_STARTED, viewingHandlerId);
    };
  }, [user, handleInteractionAdded]);

  // INTERACTION_RECEIVED + INTERACTION_AUTO_ACCEPT_FAILED only fire for live
  // inbound customer interactions, which require CX login. Keep these gated.
  useEffect(() => {
    logger.log('Inbound interaction subscription effect triggered. isUserLoggedIn:', isUserLoggedIn);

    if (!isUserLoggedIn) {
      logger.log('⚠️ NOT subscribing to inbound interaction events - user not logged in to CX');
      return;
    }

    const receivedHandlerId = user.subscribe(
      UserEventType.INTERACTION_RECEIVED,
      (event: InteractionReceivedEvent) => {
        logger.log('✅ INTERACTION_RECEIVED callback invoked!', event.payload.interaction);
        handleInteractionReceived(event);
      }
    );

    const autoAcceptFailedHandlerId = user.subscribe(
      UserEventType.INTERACTION_AUTO_ACCEPT_FAILED,
      (event: InteractionAutoAcceptFailedEvent) => {
        logger.warn('⚠️ INTERACTION_AUTO_ACCEPT_FAILED callback invoked!', event.payload.interaction.interactionId);
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
        logger.log('🔔 USER_CX_LOGGED_IN event received');
        setIsUserLoggedIn(true);
      }
    );

    const cxLoggedOutHandlerId = user.subscribe(
      UserEventType.USER_CX_LOGGED_OUT,
      () => {
        logger.log('🔔 USER_CX_LOGGED_OUT event received');
        setIsUserLoggedIn(false);
      }
    );

    logger.log('🔄 Getting list of interactions from SDK and setting to interactions state');
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
      () => {
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

  // Show microphone permission dialog while permission is revoked.
  useEffect(() => {
    const grantedHandlerId = user.subscribe(
      UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED,
      () => setIsAudioPermissionDialogOpen(false)
    );
    const deniedHandlerId = user.subscribe(
      UserEventType.AUDIO_DEVICE_PERMISSION_DENIED,
      () => setIsAudioPermissionDialogOpen(true)
    );

    if(user.getAudioDevicePermissionState() === MediaDevicePermissionState.DENIED) {
      setIsAudioPermissionDialogOpen(true);
    }

    return () => {
      safeUnsubscribeUser(user, UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED, grantedHandlerId);
      safeUnsubscribeUser(user, UserEventType.AUDIO_DEVICE_PERMISSION_DENIED, deniedHandlerId);
    };
  }, [user]);

  // Prepare context to pass to child routes
  const interactionsContext: InteractionsContextType = {
    interactions,
    incomingInteraction,
    createdInteraction,
    selectedInteractionId,
    isUserLoggedIn,
    setInteractions,
    setIncomingInteraction,
    setSelectedInteractionId,
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        <AppHeader user={user} onSignOut={onSignOut} />

        <div className="flex flex-1 overflow-hidden">
          <AppSidebar
            interactionCount={interactions.length}
            hasTeamViewAccess={user.hasTeamViewAccess}
          />
          <main className="flex-1 overflow-auto relative">
            <WebRtcAudioPermissionDialog
              open={isAudioPermissionDialogOpen}
              onOpenChange={setIsAudioPermissionDialogOpen}
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
