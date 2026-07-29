/**
 * Demo App Logger Utility
 * Provides consistent logging with [DEMO-APP] prefix and component-specific tags
 */

const DEMO_APP_PREFIX = '[DEMO-APP]';

export interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Creates a logger instance for a specific component
 * @param component - Component name or identifier
 * @returns Logger instance with prefixed methods
 */
export const createLogger = (component: string): Logger => {
  const prefix = `${DEMO_APP_PREFIX}:${component}`;

  return {
    log: (...args: unknown[]) => console.log(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    debug: (...args: unknown[]) => console.debug(prefix, ...args),
  };
};

/**
 * Default logger without component-specific tag (just [DEMO-APP])
 */
export const logger = createLogger('');
