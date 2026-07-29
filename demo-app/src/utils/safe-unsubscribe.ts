import { AvayaInfinityAgentSdk, SdkState, type User, type UserEventType } from '@avaya/infinity-agent-sdk';
import { createLogger } from '@/utils/logger';

const logger = createLogger('safeUnsubscribeUser');

/**
 * Use in React effect cleanup for `user.unsubscribe` when the SDK may already
 * be destroyed (e.g. SESSION_DESTROYED). See {@link User.unsubscribe} — it throws
 * when the user service is not available; {@link AvayaInfinityAgentSdk.sdkState}
 * must be checked first.
 */
export function safeUnsubscribeUser(
  user: User,
  eventName: UserEventType,
  handlerId: string
): void {
  if (AvayaInfinityAgentSdk.sdkState === SdkState.UNINITIALIZED) {
    return;
  }
  try {
    user.unsubscribe(eventName, handlerId);
  } catch (err) {
    logger.debug('user.unsubscribe skipped or failed during teardown', { eventName, err });
  }
}
