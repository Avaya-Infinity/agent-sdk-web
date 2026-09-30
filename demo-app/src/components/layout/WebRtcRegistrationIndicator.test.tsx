import { render, screen } from '@testing-library/react';
import {
  MediaDeviceKind,
  WebRtcRegistrationState,
  type User,
} from '@avaya/infinity-agent-sdk';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WebRtcRegistrationIndicator } from './WebRtcRegistrationIndicator';

describe('WebRtcRegistrationIndicator', () => {
  it('announces missing hardware while preserving WebRTC registration context', () => {
    const user = {
      getWebRtcRegistrationState: () => WebRtcRegistrationState.REGISTERED,
    } as unknown as User;

    render(
      <TooltipProvider>
        <WebRtcRegistrationIndicator
          user={user}
          missingAudioDeviceKinds={[MediaDeviceKind.AUDIO_OUTPUT]}
        />
      </TooltipProvider>
    );

    expect(screen.getByRole('button', {
      name: 'WebRTC Registered. Speaker unavailable',
    })).toBeInTheDocument();
    expect(document.querySelector('.lucide-phone-off')).toBeInTheDocument();
  });

  it('does not replace an unknown registration icon with the missing-device icon', () => {
    const user = { getWebRtcRegistrationState: () => undefined } as unknown as User;
    render(
      <TooltipProvider>
        <WebRtcRegistrationIndicator
          user={user}
          missingAudioDeviceKinds={[MediaDeviceKind.AUDIO_INPUT]}
        />
      </TooltipProvider>
    );

    expect(screen.getByRole('button', {
      name: 'WebRTC Status Unknown. Microphone unavailable',
    })).toBeInTheDocument();
    expect(document.querySelector('.lucide-phone')).toBeInTheDocument();
    expect(document.querySelector('.lucide-phone-off')).not.toBeInTheDocument();
  });

  it('keeps the registration-failure icon while announcing missing hardware', () => {
    const user = {
      getWebRtcRegistrationState: () => WebRtcRegistrationState.REGISTRATION_FAILED,
    } as unknown as User;
    render(
      <TooltipProvider>
        <WebRtcRegistrationIndicator
          user={user}
          missingAudioDeviceKinds={[MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT]}
        />
      </TooltipProvider>
    );

    expect(screen.getByRole('button', {
      name: 'WebRTC Registration Failed. Microphone and speaker unavailable',
    })).toBeInTheDocument();
    expect(document.querySelector('.lucide-phone-missed')).toBeInTheDocument();
    expect(document.querySelector('.lucide-phone-off')).not.toBeInTheDocument();
  });
});
