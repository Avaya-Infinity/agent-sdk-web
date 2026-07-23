import { useState, useEffect, useCallback } from 'react';
import { UserEventType, type User, type AudioInputDevice, type AudioOutputDevice, type AvailableAudioDevices } from '@avaya/infinity-agent-sdk';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Mic, Speaker } from 'lucide-react';
import { strings } from '@/locales/en';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';

interface AudioDeviceSettingsProps {
  user: User;
}

/**
 * AudioDeviceSettings Component
 *
 * Allows users to select input (microphone) and output (speaker) for calls.
 * Changes are applied when Save is clicked.
 */
export const AudioDeviceSettings = ({ user }: AudioDeviceSettingsProps) => {
  const [availableDevices, setAvailableDevices] = useState<AvailableAudioDevices>({ inputDevices: [], outputDevices: [] });

  const [appliedInput, setAppliedInput] = useState<string>('');
  const [appliedOutput, setAppliedOutput] = useState<string>('');
  const [pendingInput, setPendingInput] = useState<string>('');
  const [pendingOutput, setPendingOutput] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioAvailable, setAudioAvailable] = useState(true);

  const hasChanges =
    pendingInput !== appliedInput || pendingOutput !== appliedOutput;

  // Load available devices and current selections
  const loadDevices = useCallback(async () => {
    if (!audioAvailable) {
      setError('Audio service not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const devices = await user.getAvailableAudioDevices();
      setAvailableDevices(devices);

      const selected = user.getSelectedAudioDevices();
      const inputId = selected?.inputDevice?.deviceId || (devices.inputDevices[0]?.deviceId ?? '');
      const outputId = selected?.outputDevice?.deviceId || (devices.outputDevices[0]?.deviceId ?? '');

      setAppliedInput(inputId);
      setAppliedOutput(outputId);
      setPendingInput(inputId);
      setPendingOutput(outputId);
      setAudioAvailable(true);
    } catch (err) {
      setAudioAvailable(false);
      setError('Failed to load audio devices');
      console.error('Failed to load audio devices:', err);
    } finally {
      setLoading(false);
    }
  }, [user, audioAvailable]);

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Subscribe to SDK device change events
  useEffect(() => {
    if (!user || !audioAvailable) return;

    const handlerId = user.subscribe(UserEventType.AUDIO_DEVICES_CHANGED, async () => {
      const devices = await user.getAvailableAudioDevices();
      setAvailableDevices(devices);
      
      const selected = user.getSelectedAudioDevices();
      const newAppliedInput = selected?.inputDevice?.deviceId || devices.inputDevices[0]?.deviceId || '';
      const newAppliedOutput = selected?.outputDevice?.deviceId || devices.outputDevices[0]?.deviceId || '';
      
      setAppliedInput(newAppliedInput);
      setAppliedOutput(newAppliedOutput);
      
      setPendingInput(prev => {
        const stillExists = devices.inputDevices.find((d: AudioInputDevice) => d.deviceId === prev);
        return stillExists ? prev : newAppliedInput;
      });

      setPendingOutput(prev => {
        const stillExists = devices.outputDevices.find((d: AudioOutputDevice) => d.deviceId === prev);
        return stillExists ? prev : newAppliedOutput;
      });
    });

    return () => {
      safeUnsubscribeUser(user, UserEventType.AUDIO_DEVICES_CHANGED, handlerId);
    };
  }, [user, audioAvailable]);

  // Handle save - apply all pending changes
  const handleSave = async () => {
    if (!audioAvailable || !hasChanges) return;
    
    setSaving(true);
    try {
      let allSuccess = true;
      
      if (pendingInput !== appliedInput) {
        try {
          user.setAudioInputDevice(pendingInput);
          setAppliedInput(pendingInput);
        } catch {
          allSuccess = false;
          console.warn('Failed to set input device:', pendingInput);
        }
      }
      
      if (pendingOutput !== appliedOutput) {
        try {
          user.setAudioOutputDevice(pendingOutput);
          setAppliedOutput(pendingOutput);
        } catch {
          allSuccess = false;
          console.warn('Failed to set output device:', pendingOutput);
        }
      }

      if (!allSuccess) {
        setError('Some devices could not be set');
      }
    } catch (err) {
      setError('Failed to save audio settings');
      console.error('Failed to save audio settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Get device label for display
  const getDeviceLabel = (device: AudioInputDevice | AudioOutputDevice) => {
    // Remove "Default - " prefix if present for cleaner display
    if (device.label.startsWith('Default - ')) {
      return device.label.substring(10);
    }
    return device.label || `Unknown Device (${device.deviceId.substring(0, 8)}...)`;
  };

  if (!audioAvailable) {
    return (
      <div className="text-sm text-gray-500">
        {strings.userProfile.audioNotAvailable}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        {strings.userProfile.loadingDevices}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        {strings.userProfile.failedToLoadDevices}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Microphone Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Mic className="h-4 w-4" />
          {strings.userProfile.microphone}
        </Label>
        <Select value={pendingInput} onValueChange={setPendingInput}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={strings.userProfile.selectMicrophone} />
          </SelectTrigger>
          <SelectContent>
            {availableDevices.inputDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {getDeviceLabel(device)}
              </SelectItem>
            ))}
            {availableDevices.inputDevices.length === 0 && (
              <SelectItem value="none" disabled>
                {strings.userProfile.noMicrophonesFound}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Speaker Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Speaker className="h-4 w-4" />
          {strings.userProfile.speaker}
        </Label>
        <Select value={pendingOutput} onValueChange={setPendingOutput}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={strings.userProfile.selectSpeaker} />
          </SelectTrigger>
          <SelectContent>
            {availableDevices.outputDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {getDeviceLabel(device)}
              </SelectItem>
            ))}
            {availableDevices.outputDevices.length === 0 && (
              <SelectItem value="none" disabled>
                {strings.userProfile.noSpeakersFound}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Save Button */}
      <Button 
        onClick={handleSave} 
        disabled={!hasChanges || saving}
        className="w-full mt-2"
      >
        {saving ? strings.userProfile.applying : strings.userProfile.saveAudioSettings}
      </Button>
    </div>
  );
};
