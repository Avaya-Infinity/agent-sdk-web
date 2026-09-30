import { ReasonType, type ReasonCode } from '@avaya/infinity-agent-sdk';

/**
 * Returns reason codes that may be used when logging out of CX.
 */
export function filterLogoutStatusReasons(codes: ReasonCode[]): ReasonCode[] {
  return codes.filter((code) => code.type === ReasonType.LOGOUT);
}

/**
 * Encodes a logout-reason list index as a Radix-friendly select value.
 */
export function encodeLogoutReasonKey(index: number): string {
  return String(index);
}

/**
 * Resolves a select option value back to a {@link ReasonCode}, or `undefined` when invalid.
 */
export function decodeLogoutReasonKey(key: string, reasons: ReasonCode[]): ReasonCode | undefined {
  const index = Number(key);
  if (!Number.isInteger(index) || index < 0 || index >= reasons.length) {
    return undefined;
  }

  return reasons[index];
}

/**
 * Returns true when the select value still maps to a reason in the current list.
 */
export function isValidLogoutReasonKey(key: string, reasons: ReasonCode[]): boolean {
  return decodeLogoutReasonKey(key, reasons) !== undefined;
}

/**
 * Resolves the currently selected logout reason from select state.
 */
export function resolveSelectedLogoutReason(
  selectedKey: string,
  reasons: ReasonCode[],
): ReasonCode | undefined {
  return decodeLogoutReasonKey(selectedKey, reasons);
}
