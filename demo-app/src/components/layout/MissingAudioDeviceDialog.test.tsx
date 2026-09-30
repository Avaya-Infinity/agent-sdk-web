import { fireEvent, render, screen } from '@testing-library/react';
import { MediaDeviceKind } from '@avaya/infinity-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import { MissingAudioDeviceDialog } from './MissingAudioDeviceDialog';

describe('MissingAudioDeviceDialog', () => {
  it.each([
    [[MediaDeviceKind.AUDIO_INPUT], 'Microphone unavailable', 'No microphone is available for browser voice calls.'],
    [[MediaDeviceKind.AUDIO_OUTPUT], 'Speaker unavailable', 'No speaker is available for browser voice calls.'],
    [[MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT], 'Audio devices unavailable', 'No microphone or speaker is available for browser voice calls.'],
  ] as const)('renders the %s variant', (missingDeviceKinds, title, description) => {
    const onDismiss = vi.fn();
    render(
      <MissingAudioDeviceDialog
        open
        missingDeviceKinds={[...missingDeviceKinds]}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it.each([
    [[MediaDeviceKind.AUDIO_INPUT], 'Microphone unavailable', 'Speaker unavailable'],
    [
      [MediaDeviceKind.AUDIO_INPUT, MediaDeviceKind.AUDIO_OUTPUT],
      'Audio devices unavailable',
      'Speaker unavailable',
    ],
  ] as const)(
    'retains the %s copy when recovery clears the missing kinds before unmount',
    (missingDeviceKinds, expectedTitle, incorrectTitle) => {
      const { rerender } = render(
        <MissingAudioDeviceDialog
          open
          missingDeviceKinds={[...missingDeviceKinds]}
          onDismiss={vi.fn()}
        />
      );

      rerender(
        <MissingAudioDeviceDialog
          open
          missingDeviceKinds={[]}
          onDismiss={vi.fn()}
        />
      );

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.queryByText(incorrectTitle)).not.toBeInTheDocument();
    }
  );
});
