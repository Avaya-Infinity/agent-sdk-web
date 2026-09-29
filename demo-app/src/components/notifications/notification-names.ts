export const NotificationNames = {
  WEBSOCKET_CONNECTION_LOST: 'websocket-connection-lost',
  WEBSOCKET_CONNECTION_ESTABLISHED: 'websocket-connection-established',
  OUTBOUND_CALL_CONNECTED: 'outbound-call-connected',
  CALL_FAILURE_RECONNECTING: 'call-failure-reconnecting',
  VIEWER_AUDIO_LOST: 'viewer-audio-lost',
  AUTO_ACCEPTED: 'auto-accepted',
  AUTO_ACCEPT_FAILED: 'auto-accept-failed',
  VIEWER_CONSULT_TARGETED: 'viewer-consult-targeted',
  AUDIO_DEVICE_SAVED: 'audio-device-saved',
  AUDIO_DEVICE_SAVE_FAILED: 'audio-device-save-failed',
  AUDIO_DEVICE_ENUMERATION_FAILED: 'audio-device-enumeration-failed',
  AUDIO_DEVICE_RECONNECTED: 'audio-device-reconnected',
} as const;

export type NotificationName = typeof NotificationNames[keyof typeof NotificationNames];
