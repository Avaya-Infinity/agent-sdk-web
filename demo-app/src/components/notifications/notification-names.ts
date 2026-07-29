export const NotificationNames = {
  WEBSOCKET_CONNECTION_LOST: 'websocket-connection-lost',
  WEBSOCKET_CONNECTION_ESTABLISHED: 'websocket-connection-established',
  OUTBOUND_CALL_CONNECTED: 'outbound-call-connected',
  CALL_FAILURE_RECONNECTING: 'call-failure-reconnecting',
  VIEWER_AUDIO_LOST: 'viewer-audio-lost',
  AUTO_ACCEPTED: 'auto-accepted',
  AUTO_ACCEPT_FAILED: 'auto-accept-failed',
} as const;

export type NotificationName = typeof NotificationNames[keyof typeof NotificationNames];
