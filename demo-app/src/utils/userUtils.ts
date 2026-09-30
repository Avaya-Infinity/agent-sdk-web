import { ReasonType } from '@avaya/infinity-agent-sdk';

/**
 * Get color for status type
 * Example: ReasonType.AVAILABLE -> '#4CAF50' (green)
 */
export const getStatusColor = (type: ReasonType | undefined): string => {
  switch (type) {
    case ReasonType.AVAILABLE:
      return '#4CAF50';
    case ReasonType.BUSY:
      return '#f44336';
    case ReasonType.AWAY:
      return '#FF9800';
    case ReasonType.OFFLINE:
      return '#9E9E9E';
    default:
      return '#C9C9C9';
  }
};

/**
 * Get user initials from full name
 * Example: "John Doe" -> "JD", "Alice" -> "AL"
 */
export const getUserInitials = (fullName: string | undefined): string => {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  return '??';
};
