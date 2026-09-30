import { act, render, screen, waitFor } from '@testing-library/react';
import {
  MediaDeviceKind,
  UserEventType,
  type AudioDevicesChangedEvent,
  type User,
} from '@avaya/infinity-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { AudioDeviceSettings } from './AudioDeviceSettings';

vi.mock('@/utils/safe-unsubscribe', () => ({ safeUnsubscribeUser: vi.fn() }));

describe('AudioDeviceSettings', () => {
  it('recovers from a getter error using the device-change payload', async () => {
    let deviceChangeHandler: ((event: AudioDevicesChangedEvent) => void) | undefined;
    const user = {
      getAvailableAudioDevices: vi.fn().mockRejectedValue({
        name: 'AvayaInfinityAgentSdkError',
        code: 'ASE_4001',
        message: 'Audio device service is unavailable',
      }),
      getSelectedAudioDevices: vi.fn(() => ({ inputDevice: undefined, outputDevice: undefined })),
      subscribe: vi.fn((eventType, handler) => {
        if (eventType === UserEventType.AUDIO_DEVICES_CHANGED) deviceChangeHandler = handler;
        return 'handler';
      }),
    } as unknown as User;

    render(
      <NotificationProvider>
        <AudioDeviceSettings user={user} />
      </NotificationProvider>
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to retrieve available audio devices');

    act(() => {
      deviceChangeHandler?.({
        type: UserEventType.AUDIO_DEVICES_CHANGED,
        occurredAt: new Date(),
        payload: {
          available: {
            inputDevices: [{ deviceId: 'input', groupId: 'group', label: 'Mic', kind: MediaDeviceKind.AUDIO_INPUT }],
            outputDevices: [{ deviceId: 'output', groupId: 'group', label: 'Speaker', kind: MediaDeviceKind.AUDIO_OUTPUT }],
          },
          selected: { inputDevice: undefined, outputDevice: undefined },
        },
      });
    });

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Microphone')).toBeInTheDocument();
  });

  it('renders successful empty inventories as missing picker options', async () => {
    const user = {
      getAvailableAudioDevices: vi.fn().mockResolvedValue({ inputDevices: [], outputDevices: [] }),
      getSelectedAudioDevices: vi.fn(() => ({ inputDevice: undefined, outputDevice: undefined })),
      subscribe: vi.fn(() => 'handler'),
    } as unknown as User;

    render(
      <NotificationProvider>
        <AudioDeviceSettings user={user} />
      </NotificationProvider>
    );

    expect(await screen.findByText('Select microphone')).toBeInTheDocument();
    expect(screen.getByText('Select speaker')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders microphone permission errors distinctly', async () => {
    const user = {
      getAvailableAudioDevices: vi.fn().mockRejectedValue({
        name: 'AvayaInfinityAgentSdkError',
        code: 'ASE_4002',
        message: 'Microphone permission denied',
      }),
      getSelectedAudioDevices: vi.fn(),
      subscribe: vi.fn(() => 'handler'),
    } as unknown as User;

    render(
      <NotificationProvider>
        <AudioDeviceSettings user={user} />
      </NotificationProvider>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Microphone permission is blocked in the browser'
    );
  });

  it('invalidates the initial device request when unmounted', async () => {
    let resolveDevices!: (devices: { inputDevices: never[]; outputDevices: never[] }) => void;
    const getSelectedAudioDevices = vi.fn();
    const user = {
      getAvailableAudioDevices: vi.fn(() => new Promise((resolve) => { resolveDevices = resolve; })),
      getSelectedAudioDevices,
      subscribe: vi.fn(() => 'handler'),
    } as unknown as User;
    const { unmount } = render(
      <NotificationProvider>
        <AudioDeviceSettings user={user} />
      </NotificationProvider>
    );

    unmount();
    await act(async () => resolveDevices({ inputDevices: [], outputDevices: [] }));
    expect(getSelectedAudioDevices).not.toHaveBeenCalled();
  });
});
