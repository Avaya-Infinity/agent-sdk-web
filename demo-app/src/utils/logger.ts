import { AvayaInfinityAgentSdkError } from '@avaya/infinity-agent-sdk';

const DEMO_APP_PREFIX = '[DEMO-APP]';

export type LogValue = string | number | boolean | undefined;
export type LogDetails = Readonly<Record<string, LogValue>>;

export interface Logger {
  debug(message: string, details?: LogDetails): void;
  info(message: string, details?: LogDetails): void;
  warn(message: string, details?: LogDetails): void;
  error(message: string, details?: LogDetails): void;
}

const compactDetails = (details: LogDetails): Record<string, Exclude<LogValue, undefined>> =>
  Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, Exclude<LogValue, undefined>>;

export const createLogger = (component: string): Logger => {
  const prefix = `${DEMO_APP_PREFIX}:${component}`;

  const write = (
    method: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    details?: LogDetails,
  ): void => {
    if (details === undefined) {
      console[method](prefix, message);
      return;
    }

    console[method](prefix, message, compactDetails(details));
  };

  return {
    debug: (message, details) => write('debug', message, details),
    info: (message, details) => write('info', message, details),
    warn: (message, details) => write('warn', message, details),
    error: (message, details) => write('error', message, details),
  };
};

export const getErrorDetails = (error: unknown): LogDetails => {
  if (AvayaInfinityAgentSdkError.is(error)) {
    return {
      errorName: error.name,
      errorCode: error.code,
      errorMessage: error.message,
    };
  }

  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }

  return { errorName: 'UnknownError' };
};
