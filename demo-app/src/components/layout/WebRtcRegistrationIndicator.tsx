import { useEffect, useState } from 'react';
import {
  AvayaInfinityAgentSdk,
  WebRtcRegistrationEventType,
  WebRtcRegistrationState,
} from '@avaya/infinity-agent-sdk';
import type { User } from '@avaya/infinity-agent-sdk';
import { MediaDeviceKind } from '@avaya/infinity-agent-sdk';
import { Phone, PhoneMissed, PhoneOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { createLogger, getErrorDetails } from '@/utils/logger';
import { strings } from '@/locales/en';

const logger = createLogger('WebRtcRegistrationIndicator');

type WebRtcDisplayStatus = 'registered' | 'registration_failed' | 'unregistered' | 'unregistration_failed' | 'unknown';

interface WebRtcRegistrationIndicatorProps {
  user: User;
  missingAudioDeviceKinds?: MediaDeviceKind[];
}

function getMissingDeviceLabel(missingKinds: MediaDeviceKind[]): string {
  const inputMissing = missingKinds.includes(MediaDeviceKind.AUDIO_INPUT);
  const outputMissing = missingKinds.includes(MediaDeviceKind.AUDIO_OUTPUT);
  if (inputMissing && outputMissing) return strings.webRtcStatus.microphoneAndSpeakerUnavailable;
  if (inputMissing) return strings.webRtcStatus.microphoneUnavailable;
  return strings.webRtcStatus.speakerUnavailable;
}

function WebRtcRegistrationIndicator({ user, missingAudioDeviceKinds = [] }: WebRtcRegistrationIndicatorProps) {
  const [webRtcStatus, setWebRtcStatus] = useState<WebRtcDisplayStatus>(getInitialStatus);

  function getInitialStatus() : WebRtcDisplayStatus{
    try {
      const status = user.getWebRtcRegistrationState();
      let finalStatus: WebRtcDisplayStatus = 'unknown';
      switch(status) {
        case WebRtcRegistrationState.REGISTERED:
          finalStatus = 'registered';
          break;
        case WebRtcRegistrationState.REGISTRATION_FAILED:
          finalStatus = 'registration_failed';
          break;
        case WebRtcRegistrationState.UNREGISTERED:
          finalStatus = 'unregistered';
          break;
        case WebRtcRegistrationState.UNREGISTRATION_FAILED:
          finalStatus = 'unregistration_failed';
          break;
      }
      return finalStatus;
    } catch (e) {
      logger.error("Error fetching initial status", { ...getErrorDetails(e) });
      return 'unknown';
    }
  }

  useEffect(() => {
    const registeredHandlerId = AvayaInfinityAgentSdk.subscribe(
      WebRtcRegistrationEventType.REGISTERED,
      () => {
        logger.info('WebRTC registered');
        setWebRtcStatus('registered');
      }
    );

    const registrationFailedHandlerId = AvayaInfinityAgentSdk.subscribe(
      WebRtcRegistrationEventType.REGISTRATION_FAILED,
      () => {
        logger.error('WebRTC registration failed');
        setWebRtcStatus('registration_failed');
      }
    );

    const unregisteredHandlerId = AvayaInfinityAgentSdk.subscribe(
      WebRtcRegistrationEventType.UNREGISTERED,
      () => {
        logger.info('WebRTC unregistered');
        setWebRtcStatus('unregistered');
      }
    );

    const unregistrationFailedHandlerId = AvayaInfinityAgentSdk.subscribe(
      WebRtcRegistrationEventType.UNREGISTRATION_FAILED,
      () => {
        logger.error('WebRTC unregistration failed');
        setWebRtcStatus('unregistration_failed');
      }
    )

    return () => {
      AvayaInfinityAgentSdk.unsubscribe(
        WebRtcRegistrationEventType.REGISTERED,
        registeredHandlerId
      );
      AvayaInfinityAgentSdk.unsubscribe(
        WebRtcRegistrationEventType.REGISTRATION_FAILED,
        registrationFailedHandlerId
      );
      AvayaInfinityAgentSdk.unsubscribe(
        WebRtcRegistrationEventType.UNREGISTERED,
        unregisteredHandlerId
      );
      AvayaInfinityAgentSdk.unsubscribe(
        WebRtcRegistrationEventType.UNREGISTRATION_FAILED,
        unregistrationFailedHandlerId
      );
    };
  }, []);

  const statusIcon = {
    registered:  <Phone className="h-4 w-4 text-green-600" aria-hidden="true" />,
    registration_failed: <PhoneMissed className="h-4 w-4 text-red-600" aria-hidden="true" />,
    unregistered: <PhoneOff className="h-4 w-4 text-gray-500" aria-hidden="true" />,
    unregistration_failed: <PhoneMissed className="h-4 w-4 text-gray-500" aria-hidden="true" />,
    unknown: <Phone className="h-4 w-4 text-gray-500" aria-hidden="true" />,
  } as const;

  const statusLabel = {
    registered: 'WebRTC Registered',
    registration_failed: 'WebRTC Registration Failed',
    unregistered: 'WebRTC Unregistered',
    unregistration_failed: 'WebRTC Unregistration Failed',
    unknown: 'WebRTC Status Unknown'
  } as const;

  const hasMissingDevice = missingAudioDeviceKinds.length > 0;
  const missingDeviceLabel = hasMissingDevice ? getMissingDeviceLabel(missingAudioDeviceKinds) : '';
  const accessibleLabel = hasMissingDevice
    ? `${statusLabel[webRtcStatus]}. ${missingDeviceLabel}`
    : statusLabel[webRtcStatus];
  const displayedIcon = hasMissingDevice && webRtcStatus === 'registered'
    ? <PhoneOff className="h-4 w-4 text-destructive" aria-hidden="true" />
    : statusIcon[webRtcStatus];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={"inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"}
          aria-label={accessibleLabel}
        >
         {displayedIcon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {accessibleLabel}
      </TooltipContent>
    </Tooltip>
  );
}

export { WebRtcRegistrationIndicator };
