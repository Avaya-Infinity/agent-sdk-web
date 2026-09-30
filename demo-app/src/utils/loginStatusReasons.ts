import { ReasonType, type ReasonCode } from '@avaya/infinity-agent-sdk';

/** Select value when the user wants CX login without setting an initial status. */
export const LOGIN_ONLY_KEY = '__login_only__';

const LOGIN_STATUS_TYPES = new Set<ReasonType>([
  ReasonType.AVAILABLE,
  ReasonType.BUSY,
  ReasonType.AWAY,
]);

/**
 * Returns reason codes that may be applied as an initial status during CX login.
 */
export function filterLoginStatusReasons(codes: ReasonCode[]): ReasonCode[] {
  return codes.filter((code) => LOGIN_STATUS_TYPES.has(code.type));
}

/**
 * Encodes a login-status list index as a Radix-friendly select value.
 * Uses simple numeric strings (not JSON) so Select inside Dialog commits reliably.
 */
export function encodeReasonCodeKey(index: number): string {
  return String(index);
}

/**
 * Resolves a select option value back to a {@link ReasonCode}, or `undefined` for login-only.
 */
export function decodeReasonCodeKey(key: string, reasons: ReasonCode[]): ReasonCode | undefined {
  if (key === LOGIN_ONLY_KEY) {
    return undefined;
  }

  const index = Number(key);
  if (!Number.isInteger(index) || index < 0 || index >= reasons.length) {
    return undefined;
  }

  return reasons[index];
}

/**
 * Returns true when the select value still maps to a reason in the current list.
 */
export function isValidReasonCodeKey(key: string, reasons: ReasonCode[]): boolean {
  return key === LOGIN_ONLY_KEY || decodeReasonCodeKey(key, reasons) !== undefined;
}

/**
 * Resolves the currently selected login status from select state.
 */
export function resolveSelectedLoginReason(
  selectedKey: string,
  reasons: ReasonCode[],
): ReasonCode | undefined {
  return decodeReasonCodeKey(selectedKey, reasons);
}

/** Resets a stale or disallowed selection to login-only. */
export function normalizeLoginStatusSelection(
  allowInitialStatus: boolean,
  selectedKey: string,
  reasons: ReasonCode[],
): string {
  return allowInitialStatus && isValidReasonCodeKey(selectedKey, reasons)
    ? selectedKey
    : LOGIN_ONLY_KEY;
}

/** Self login may include status unless Elite Voice is enabled. */
export function canUserSelectInitialStatus(isEliteVoiceEnabled: boolean): boolean {
  return !isEliteVoiceEnabled;
}
