import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  AvayaInfinityAgentSdkError,
  AvayaInfinityAgentSdkErrorCodes,
  MediaDeviceKind,
  UserEventType,
  type AvailableAudioDevices,
  type DeviceChangeEventPayload,
  type NoAudioDeviceAvailableEvent,
  type AudioDevicesChangedEvent,
  type User,
} from '@avaya/infinity-agent-sdk';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationNames } from '@/components/notifications/notification-names';
import { strings } from '@/locales/en';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AudioDeviceAvailability');

type AudioDeviceAvailabilityState =
  | { status: 'checking'; incidentId: number }
  | { status: 'available'; inventory: DeviceChangeEventPayload; incidentId: number }
  | {
      status: 'missing';
      inventory: DeviceChangeEventPayload;
      missingDeviceKinds: MediaDeviceKind[];
      incidentId: number;
    }
  | { status: 'permissionDenied'; incidentId: number }
  | { status: 'enumerationError'; incidentId: number }
  | { status: 'retrievalError'; incidentId: number };

type AvailabilityAction =
  | { type: 'reset' }
  | { type: 'inventory'; inventory: DeviceChangeEventPayload }
  | { type: 'missing'; inventory: DeviceChangeEventPayload; missingDeviceKinds: MediaDeviceKind[] }
  | { type: 'permissionDenied' }
  | { type: 'permissionGranted' }
  | { type: 'enumerationError' }
  | { type: 'retrievalError' };

const initialState: AudioDeviceAvailabilityState = { status: 'checking', incidentId: 0 };

function getMissingDeviceKinds(devices: AvailableAudioDevices): MediaDeviceKind[] {
  const missingKinds: MediaDeviceKind[] = [];
  if (devices.inputDevices.length === 0) missingKinds.push(MediaDeviceKind.AUDIO_INPUT);
  if (devices.outputDevices.length === 0) missingKinds.push(MediaDeviceKind.AUDIO_OUTPUT);
  return missingKinds;
}

function availabilityReducer(
  state: AudioDeviceAvailabilityState,
  action: AvailabilityAction
): AudioDeviceAvailabilityState {
  switch (action.type) {
    case 'reset':
      return initialState;
    case 'permissionDenied':
      return { status: 'permissionDenied', incidentId: state.incidentId };
    case 'permissionGranted':
      return { status: 'checking', incidentId: state.incidentId };
    case 'enumerationError':
      return { status: 'enumerationError', incidentId: state.incidentId };
    case 'retrievalError':
      return { status: 'retrievalError', incidentId: state.incidentId };
    case 'missing': {
      if (state.status === 'permissionDenied') return state;
      const incidentId = state.status === 'missing' ? state.incidentId : state.incidentId + 1;
      return {
        status: 'missing',
        inventory: action.inventory,
        missingDeviceKinds: action.missingDeviceKinds,
        incidentId,
      };
    }
    case 'inventory': {
      if (state.status === 'permissionDenied') return state;
      const missingKinds = getMissingDeviceKinds(action.inventory.available);
      if (missingKinds.length > 0) {
        // Runtime absence is confirmed by NO_AUDIO_DEVICE_AVAILABLE. Until that
        // event arrives, retain an existing incident but do not create a new one.
        return state.status === 'missing'
          ? { ...state, inventory: action.inventory, missingDeviceKinds: missingKinds }
          : state;
      }
      return { status: 'available', inventory: action.inventory, incidentId: state.incidentId };
    }
  }
}

function createInventory(user: User, available: AvailableAudioDevices): DeviceChangeEventPayload {
  return { available, selected: user.getSelectedAudioDevices() };
}

function useAudioDeviceAvailability(user: User) {
  const [state, dispatch] = useReducer(availabilityReducer, initialState);
  const [dismissedIncidentId, setDismissedIncidentId] = useState(0);
  const eventRevisionRef = useRef(0);
  const previousStatusRef = useRef<AudioDeviceAvailabilityState['status']>('checking');
  const { addNotification, removeNotification } = useNotifications();

  useEffect(() => {
    let active = true;
    eventRevisionRef.current = 0;
    const initialRevision = eventRevisionRef.current;
    dispatch({ type: 'reset' });
    setDismissedIncidentId(0);

    const onDevicesChanged = (event: AudioDevicesChangedEvent) => {
      if (!active) return;
      eventRevisionRef.current += 1;
      dispatch({ type: 'inventory', inventory: event.payload });
    };
    const onNoDeviceAvailable = (event: NoAudioDeviceAvailableEvent) => {
      if (!active) return;
      eventRevisionRef.current += 1;
      dispatch({
        type: 'missing',
        inventory: event.payload,
        missingDeviceKinds: event.payload.missingDeviceKinds,
      });
    };
    const onPermissionDenied = () => {
      if (!active) return;
      logger.warn('Microphone permission denied');
      eventRevisionRef.current += 1;
      dispatch({ type: 'permissionDenied' });
    };
    const onPermissionGranted = () => {
      if (!active) return;
      logger.info('Microphone permission granted');
      eventRevisionRef.current += 1;
      dispatch({ type: 'permissionGranted' });
    };

    const subscriptions = [
      [UserEventType.AUDIO_DEVICES_CHANGED, user.subscribe(UserEventType.AUDIO_DEVICES_CHANGED, onDevicesChanged)],
      [UserEventType.NO_AUDIO_DEVICE_AVAILABLE, user.subscribe(UserEventType.NO_AUDIO_DEVICE_AVAILABLE, onNoDeviceAvailable)],
      [UserEventType.AUDIO_DEVICE_PERMISSION_DENIED, user.subscribe(UserEventType.AUDIO_DEVICE_PERMISSION_DENIED, onPermissionDenied)],
      [UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED, user.subscribe(UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED, onPermissionGranted)],
    ] as const;

    void user.getAvailableAudioDevices()
      .then((available) => {
        if (!active || eventRevisionRef.current !== initialRevision) return;
        const inventory = createInventory(user, available);
        const missingDeviceKinds = getMissingDeviceKinds(available);
        dispatch(missingDeviceKinds.length > 0
          ? { type: 'missing', inventory, missingDeviceKinds }
          : { type: 'inventory', inventory });
      })
      .catch((error: unknown) => {
        if (!active || eventRevisionRef.current !== initialRevision) return;
        if (AvayaInfinityAgentSdkError.is(error)) {
          if (error.code === AvayaInfinityAgentSdkErrorCodes.ASE_4002) {
            dispatch({ type: 'permissionDenied' });
            return;
          }
          if (error.code === AvayaInfinityAgentSdkErrorCodes.ASE_4001) {
            dispatch({ type: 'enumerationError' });
            return;
          }
        }
        dispatch({ type: 'retrievalError' });
      });

    return () => {
      active = false;
      previousStatusRef.current = 'checking';
      removeNotification(NotificationNames.AUDIO_DEVICE_ENUMERATION_FAILED);
      removeNotification(NotificationNames.AUDIO_DEVICE_RECONNECTED);
      subscriptions.forEach(([eventType, handlerId]) => safeUnsubscribeUser(user, eventType, handlerId));
    };
  }, [user, removeNotification]);

  useEffect(() => {
    if (state.status === 'enumerationError' || state.status === 'retrievalError') {
      addNotification({
        id: NotificationNames.AUDIO_DEVICE_ENUMERATION_FAILED,
        level: 'error',
        title: state.status === 'enumerationError'
          ? strings.notifications.events.audioDeviceEnumerationFailedTitle
          : strings.notifications.events.audioDeviceRetrievalFailedTitle,
        description: state.status === 'enumerationError'
          ? strings.notifications.events.audioDeviceEnumerationFailedDescription
          : strings.notifications.events.audioDeviceRetrievalFailedDescription,
        autoDismissMs: null,
      });
    } else {
      removeNotification(NotificationNames.AUDIO_DEVICE_ENUMERATION_FAILED);
    }

    if (previousStatusRef.current === 'missing' && state.status === 'available') {
      addNotification({
        id: NotificationNames.AUDIO_DEVICE_RECONNECTED,
        level: 'success',
        title: strings.notifications.events.audioDeviceReconnectedTitle,
        description: strings.notifications.events.audioDeviceReconnectedDescription,
        autoDismissMs: 5000,
      });
    }
    previousStatusRef.current = state.status;
  }, [state.status, addNotification, removeNotification]);

  const dismissMissingDeviceDialog = useCallback(() => {
    if (state.status === 'missing') setDismissedIncidentId(state.incidentId);
  }, [state]);

  return {
    state,
    isMissingDeviceDialogOpen:
      state.status === 'missing' && state.incidentId !== dismissedIncidentId,
    dismissMissingDeviceDialog,
  };
}

export {
  availabilityReducer,
  getMissingDeviceKinds,
  initialState,
  useAudioDeviceAvailability,
  type AudioDeviceAvailabilityState,
  type AvailabilityAction,
};
