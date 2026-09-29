import { act, renderHook, waitFor } from '@testing-library/react';
import {
  MediaDeviceKind,
  UserEventType,
  type AudioDevicesChangedEvent,
  type NoAudioDeviceAvailableEvent,
  type User,
  type UserEvent,
} from '@avaya/infinity-agent-sdk';
import { StrictMode, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotifications } from '@/components/notifications/NotificationProvider';
import { NotificationNames } from '@/components/notifications/notification-names';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';
import {
  availabilityReducer,
  initialState,
  useAudioDeviceAvailability,
} from './useAudioDeviceAvailability';

vi.mock('@/utils/safe-unsubscribe', () => ({ safeUnsubscribeUser: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const input = { deviceId: 'input', groupId: 'group', label: 'Mic', kind: MediaDeviceKind.AUDIO_INPUT } as const;
const output = { deviceId: 'output', groupId: 'group', label: 'Speaker', kind: MediaDeviceKind.AUDIO_OUTPUT } as const;
const selected = { inputDevice: input, outputDevice: output };
const available = { inputDevices: [input], outputDevices: [output] };

type EventHandler = (event: UserEvent) => void;

function createUser(initialDevices = available) {
  const handlers = new Map<UserEventType, EventHandler>();
  const user = {
    subscribe: vi.fn((type: UserEventType, handler: EventHandler) => {
      handlers.set(type, handler);
      return `${type}-handler`;
    }),
    getAvailableAudioDevices: vi.fn().mockResolvedValue(initialDevices),
    getSelectedAudioDevices: vi.fn(() => selected),
  } as unknown as User;
  return { user, handlers };
}

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

function strictWrapper({ children }: Readonly<{ children: ReactNode }>) {
  return <StrictMode><NotificationProvider>{children}</NotificationProvider></StrictMode>;
}

describe('audio availability reducer', () => {
  it('tracks a missing-device incident and recovers only when both kinds return', () => {
    const missingPayload = {
      available: { inputDevices: [], outputDevices: [] },
      selected: { inputDevice: undefined, outputDevice: undefined },
    };
    const missing = availabilityReducer(initialState, {
      type: 'missing',
      inventory: missingPayload,
      missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT],
    });
    expect(missing).toMatchObject({ status: 'missing', incidentId: 1 });

    const partial = availabilityReducer(missing, {
      type: 'inventory',
      inventory: { available: { inputDevices: [input], outputDevices: [] }, selected },
    });
    expect(partial).toMatchObject({ status: 'missing', missingDeviceKinds: [MediaDeviceKind.AUDIO_OUTPUT] });

    const recovered = availabilityReducer(partial, {
      type: 'inventory',
      inventory: { available, selected },
    });
    expect(recovered.status).toBe('available');
  });

  it('gives permission denial precedence over device events', () => {
    const denied = availabilityReducer(initialState, { type: 'permissionDenied' });
    const ignored = availabilityReducer(denied, {
      type: 'missing',
      inventory: { available: { inputDevices: [], outputDevices: [] }, selected },
      missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT],
    });
    expect(ignored.status).toBe('permissionDenied');
  });

  it('does not start a new incident for duplicate missing events', () => {
    const payload = {
      available: { inputDevices: [], outputDevices: [output] },
      selected,
    };
    const first = availabilityReducer(initialState, {
      type: 'missing',
      inventory: payload,
      missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT],
    });
    const duplicate = availabilityReducer(first, {
      type: 'missing',
      inventory: payload,
      missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT],
    });
    expect(duplicate).toMatchObject({ status: 'missing', incidentId: 1 });
  });
});

describe('useAudioDeviceAvailability', () => {
  it('subscribes before querying and ignores an initial result superseded by an event', async () => {
    let resolveInitial!: (value: typeof available) => void;
    const { user, handlers } = createUser();
    vi.mocked(user.getAvailableAudioDevices).mockReturnValue(new Promise((resolve) => { resolveInitial = resolve; }));

    const { result } = renderHook(() => useAudioDeviceAvailability(user), { wrapper });
    expect(user.subscribe).toHaveBeenCalledTimes(4);
    expect(user.getAvailableAudioDevices).toHaveBeenCalledOnce();

    act(() => {
      handlers.get(UserEventType.NO_AUDIO_DEVICE_AVAILABLE)?.({
        type: UserEventType.NO_AUDIO_DEVICE_AVAILABLE,
        occurredAt: new Date(),
        payload: {
          available: { inputDevices: [], outputDevices: [] },
          selected: { inputDevice: undefined, outputDevice: undefined },
          missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT],
        },
      } as NoAudioDeviceAvailableEvent);
      resolveInitial(available);
    });

    await waitFor(() => expect(result.current.state.status).toBe('missing'));
  });

  it('shows one recovery notification for a missing-to-available transition', async () => {
    const { user, handlers } = createUser({ inputDevices: [], outputDevices: [] });
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper });

    await waitFor(() => expect(result.current.audio.state.status).toBe('missing'));
    act(() => {
      handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.({
        type: UserEventType.AUDIO_DEVICES_CHANGED,
        occurredAt: new Date(),
        payload: { available, selected },
      } as AudioDevicesChangedEvent);
    });

    await waitFor(() => expect(result.current.notifications.filter(
      (item) => item.id === NotificationNames.AUDIO_DEVICE_RECONNECTED
    )).toHaveLength(1));
  });

  it('maps permission-denied errors without showing a hardware warning', async () => {
    const { user } = createUser();
    vi.mocked(user.getAvailableAudioDevices).mockRejectedValue({
      name: 'AvayaInfinityAgentSdkError',
      code: 'ASE_4002',
      message: 'Microphone permission denied',
    });
    const { result, unmount } = renderHook(() => useAudioDeviceAvailability(user), { wrapper });

    await waitFor(() => expect(result.current.state.status).toBe('permissionDenied'));
    expect(result.current.isMissingDeviceDialogOpen).toBe(false);
    unmount();
    expect(safeUnsubscribeUser).toHaveBeenNthCalledWith(
      1, user, UserEventType.AUDIO_DEVICES_CHANGED, 'audioDevicesChanged-handler'
    );
    expect(safeUnsubscribeUser).toHaveBeenNthCalledWith(
      2, user, UserEventType.NO_AUDIO_DEVICE_AVAILABLE, 'noAudioDeviceAvailable-handler'
    );
    expect(safeUnsubscribeUser).toHaveBeenNthCalledWith(
      3, user, UserEventType.AUDIO_DEVICE_PERMISSION_DENIED, 'audioDevicePermissionDenied-handler'
    );
    expect(safeUnsubscribeUser).toHaveBeenNthCalledWith(
      4, user, UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED, 'audioDevicePermissionGranted-handler'
    );
    expect(safeUnsubscribeUser).toHaveBeenCalledTimes(4);
  });

  it('classifies ASE_4001 as an enumeration error', async () => {
    const { user } = createUser();
    vi.mocked(user.getAvailableAudioDevices).mockRejectedValue({
      name: 'AvayaInfinityAgentSdkError',
      code: 'ASE_4001',
      message: 'Audio device service unavailable',
    });
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper });

    await waitFor(() => expect(result.current.audio.state.status).toBe('enumerationError'));
    expect(result.current.notifications[0]?.title).toBe('Unable to retrieve audio devices');
  });

  it('classifies unexpected getter failures separately from enumeration errors', async () => {
    const { user } = createUser();
    vi.mocked(user.getAvailableAudioDevices).mockRejectedValue(new Error('Unexpected failure'));
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper });

    await waitFor(() => expect(result.current.audio.state.status).toBe('retrievalError'));
    expect(result.current.notifications.find(
      (item) => item.id === NotificationNames.AUDIO_DEVICE_ENUMERATION_FAILED
    )?.title).toBe('Unable to check audio devices');
  });

  it('clears stable audio notifications when the user session changes', async () => {
    const first = createUser();
    vi.mocked(first.user.getAvailableAudioDevices).mockRejectedValue({
      name: 'AvayaInfinityAgentSdkError',
      code: 'ASE_4001',
      message: 'Audio device service unavailable',
    });
    const second = createUser();
    const { result, rerender } = renderHook(
      ({ user }) => ({
        audio: useAudioDeviceAvailability(user),
        notifications: useNotifications().notifications,
      }),
      { initialProps: { user: first.user }, wrapper }
    );

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    rerender({ user: second.user });
    await waitFor(() => expect(result.current.notifications).toHaveLength(0));
    await waitFor(() => expect(result.current.audio.state.status).toBe('available'));
  });

  it('emits one recovery notification when mounted in StrictMode', async () => {
    const { user, handlers } = createUser({ inputDevices: [], outputDevices: [] });
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper: strictWrapper });
    await waitFor(() => expect(result.current.audio.state.status).toBe('missing'));

    act(() => {
      handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.({
        type: UserEventType.AUDIO_DEVICES_CHANGED,
        occurredAt: new Date(),
        payload: { available, selected },
      } as AudioDevicesChangedEvent);
    });

    await waitFor(() => expect(result.current.notifications.filter(
      (item) => item.id === NotificationNames.AUDIO_DEVICE_RECONNECTED
    )).toHaveLength(1));
  });

  it('does not toast when permission grant is followed by an available inventory', async () => {
    const { user, handlers } = createUser();
    vi.mocked(user.getAvailableAudioDevices).mockRejectedValue({
      name: 'AvayaInfinityAgentSdkError',
      code: 'ASE_4002',
      message: 'Microphone permission denied',
    });
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper });
    await waitFor(() => expect(result.current.audio.state.status).toBe('permissionDenied'));

    act(() => {
      handlers.get(UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED)?.({} as UserEvent);
      handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.({
        type: UserEventType.AUDIO_DEVICES_CHANGED,
        occurredAt: new Date(),
        payload: { available, selected },
      } as AudioDevicesChangedEvent);
    });

    expect(result.current.audio.state.status).toBe('available');
    expect(result.current.notifications.some(
      (item) => item.id === NotificationNames.AUDIO_DEVICE_RECONNECTED
    )).toBe(false);
  });

  it('gives runtime permission denial precedence and waits for inventory after grant', async () => {
    const { user, handlers } = createUser();
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper });
    await waitFor(() => expect(result.current.audio.state.status).toBe('available'));

    act(() => {
      handlers.get(UserEventType.AUDIO_DEVICE_PERMISSION_DENIED)?.({} as UserEvent);
      handlers.get(UserEventType.NO_AUDIO_DEVICE_AVAILABLE)?.({
        type: UserEventType.NO_AUDIO_DEVICE_AVAILABLE,
        occurredAt: new Date(),
        payload: {
          available: { inputDevices: [], outputDevices: [] },
          selected: { inputDevice: undefined, outputDevice: undefined },
          missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT],
        },
      } as NoAudioDeviceAvailableEvent);
    });
    expect(result.current.audio.state.status).toBe('permissionDenied');
    expect(result.current.audio.isMissingDeviceDialogOpen).toBe(false);

    act(() => handlers.get(UserEventType.AUDIO_DEVICE_PERMISSION_GRANTED)?.({} as UserEvent));
    expect(result.current.audio.state.status).toBe('checking');
    act(() => handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.({
      type: UserEventType.AUDIO_DEVICES_CHANGED,
      occurredAt: new Date(),
      payload: { available, selected },
    } as AudioDevicesChangedEvent));

    expect(result.current.audio.state.status).toBe('available');
    expect(result.current.notifications.some(
      (item) => item.id === NotificationNames.AUDIO_DEVICE_RECONNECTED
    )).toBe(false);
  });

  it('does not recreate the recovery notification for duplicate available events', async () => {
    const { user, handlers } = createUser({ inputDevices: [], outputDevices: [] });
    const { result } = renderHook(() => ({
      audio: useAudioDeviceAvailability(user),
      notifications: useNotifications().notifications,
    }), { wrapper });
    await waitFor(() => expect(result.current.audio.state.status).toBe('missing'));
    const availableEvent = {
      type: UserEventType.AUDIO_DEVICES_CHANGED,
      occurredAt: new Date(),
      payload: { available, selected },
    } as AudioDevicesChangedEvent;

    act(() => handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.(availableEvent));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    const createdAt = result.current.notifications[0]?.createdAt;
    act(() => handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.(availableEvent));

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.createdAt).toBe(createdAt);
  });

  it('keeps a dismissed incident closed and reopens for a later loss', async () => {
    const { user, handlers } = createUser({ inputDevices: [], outputDevices: [] });
    const { result } = renderHook(() => useAudioDeviceAvailability(user), { wrapper });
    await waitFor(() => expect(result.current.isMissingDeviceDialogOpen).toBe(true));

    act(() => result.current.dismissMissingDeviceDialog());
    expect(result.current.isMissingDeviceDialogOpen).toBe(false);

    act(() => {
      handlers.get(UserEventType.AUDIO_DEVICES_CHANGED)?.({
        type: UserEventType.AUDIO_DEVICES_CHANGED,
        occurredAt: new Date(),
        payload: { available, selected },
      } as AudioDevicesChangedEvent);
      handlers.get(UserEventType.NO_AUDIO_DEVICE_AVAILABLE)?.({
        type: UserEventType.NO_AUDIO_DEVICE_AVAILABLE,
        occurredAt: new Date(),
        payload: {
          available: { inputDevices: [], outputDevices: [output] },
          selected,
          missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT],
        },
      } as NoAudioDeviceAvailableEvent);
    });

    expect(result.current.isMissingDeviceDialogOpen).toBe(true);
  });
});
