import { AvayaInfinityAgentSdk, type AvayaInfinityAgentSdkInitParams, type User } from '@avaya/infinity-agent-sdk';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SdkManager');

/**
 * SDK Manager - Ensures SDK initialization happens only once
 * Handles idempotency so React components can call initialize() freely
 */
class SdkManager {
  private static initPromise: Promise<User> | null = null;
  private static isInitialized = false;

  /**
   * Initialize the SDK (idempotent - safe to call multiple times)
   * Returns immediately if already initialized or in progress
   */
  static async initialize(config: AvayaInfinityAgentSdkInitParams): Promise<User> {
    // If initialization in progress or already complete, return the existing promise
    if (this.initPromise) {
      logger.debug('SDK initialization promise reused');
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = AvayaInfinityAgentSdk.init(config)
      .then((user: User) => {
        this.isInitialized = true;
        return user;
      })
      .catch((error) => {
        // Reset on error so initialization can be retried
        this.initPromise = null;
        throw error;
      });

    return this.initPromise;
  }

  /**
   * Check if SDK is initialized
   */
  static getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset initialization state (useful for testing or logout)
   */
  static reset(): void {
    logger.debug('SDK manager state reset');
    this.initPromise = null;
    this.isInitialized = false;
  }

  /**
   * Destroy the SDK
   */
  static async destroy(): Promise<void> {
    await AvayaInfinityAgentSdk.destroy();
    this.initPromise = null;
    this.isInitialized = false;
  }
}

export default SdkManager;
