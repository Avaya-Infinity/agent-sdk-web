import { render, screen, waitFor } from '@testing-library/react';
import { MediaDeviceKind, type User } from '@avaya/infinity-agent-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import type { AudioDeviceAvailabilityState } from '@/hooks/useAudioDeviceAvailability';
import { MainLayout } from './MainLayout';

const audioHook = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAudioDeviceAvailability', () => ({
  useAudioDeviceAvailability: audioHook,
}));
vi.mock('react-router-dom', () => ({ Outlet: () => <div>Outlet</div> }));
vi.mock('./AppSidebar', () => ({ AppSidebar: () => <aside>Sidebar</aside> }));
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => <div>Notifications</div> }));
vi.mock('./AppHeader', () => ({
  AppHeader: ({ missingAudioDeviceKinds }: { missingAudioDeviceKinds: MediaDeviceKind[] }) => (
    <div data-testid="header-missing">{missingAudioDeviceKinds.join(',')}</div>
  ),
}));
vi.mock('./MissingAudioDeviceDialog', () => ({
  MissingAudioDeviceDialog: ({ open }: { open: boolean }) => open ? <div>Missing device dialog</div> : null,
}));
vi.mock('./WebRtcAudioPermissionDialog', () => ({
  WebRtcAudioPermissionDialog: ({ open }: { open: boolean }) => open ? <div>Permission dialog</div> : null,
}));
vi.mock('@/utils/safe-unsubscribe', () => ({ safeUnsubscribeUser: vi.fn() }));

const missingState: AudioDeviceAvailabilityState = {
  status: 'missing',
  incidentId: 1,
  inventory: {
    available: { inputDevices: [], outputDevices: [] },
    selected: { inputDevice: undefined, outputDevice: undefined },
  },
  missingDeviceKinds: [MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT],
};

function createUser(): User {
  return {
    isLoggedInToCx: false,
    subscribe: vi.fn(() => 'handler'),
    getAssignedInteractions: vi.fn(() => []),
  } as unknown as User;
}

function setAudioState(state: AudioDeviceAvailabilityState, dialogOpen = false) {
  audioHook.mockReturnValue({
    state,
    isMissingDeviceDialogOpen: dialogOpen,
    dismissMissingDeviceDialog: vi.fn(),
  });
}

describe('MainLayout audio-device wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes missing state to the header and opens the missing-device dialog for every user', () => {
    setAudioState(missingState, true);
    render(<NotificationProvider><MainLayout user={createUser()} /></NotificationProvider>);

    expect(screen.getByTestId('header-missing')).toHaveTextContent('audioinput,audiooutput');
    expect(screen.getByText('Missing device dialog')).toBeInTheDocument();
    expect(screen.queryByText('Permission dialog')).not.toBeInTheDocument();
  });

  it('opens only the permission dialog when permission is denied', async () => {
    setAudioState({ status: 'permissionDenied', incidentId: 0 });
    render(<NotificationProvider><MainLayout user={createUser()} /></NotificationProvider>);

    expect(await screen.findByText('Permission dialog')).toBeInTheDocument();
    expect(screen.queryByText('Missing device dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('header-missing')).toBeEmptyDOMElement();
  });

  it('clears warning UI when the hook reports recovery', async () => {
    const user = createUser();
    setAudioState(missingState, true);
    const { rerender } = render(
      <NotificationProvider><MainLayout user={user} /></NotificationProvider>
    );
    setAudioState({
      status: 'available',
      incidentId: 1,
      inventory: missingState.inventory,
    });
    rerender(<NotificationProvider><MainLayout user={user} /></NotificationProvider>);

    await waitFor(() => expect(screen.queryByText('Missing device dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('header-missing')).toBeEmptyDOMElement();
  });
});
