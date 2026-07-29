import { ReasonType, type TeamViewMember } from '@avaya/infinity-agent-sdk';

/**
 * Status-filter values for the Team View member list.
 *
 * Mirrors the 10-option list in core-agent-ui's Team View filter so behavior
 * stays consistent with the existing supervisor experience.
 */
export type TeamViewStatusFilter =
  | 'all'
  | 'available'
  | 'availableCxOn'
  | 'availableCxOff'
  | 'cxOn'
  | 'cxOff'
  | 'away'
  | 'busy'
  | 'notOffline'
  | 'offline';

/** Display order for the dropdown — drives the rendered options list. */
export const TEAM_VIEW_STATUS_FILTERS: TeamViewStatusFilter[] = [
  'all',
  'available',
  'availableCxOn',
  'availableCxOff',
  'cxOn',
  'cxOff',
  'away',
  'busy',
  'notOffline',
  'offline',
];

const predicates: Record<TeamViewStatusFilter, (member: TeamViewMember) => boolean> = {
  all: () => true,
  available: (m) => m.currentStatus.type === ReasonType.AVAILABLE,
  availableCxOn: (m) =>
    m.currentStatus.type === ReasonType.AVAILABLE && m.isLoggedInToCx,
  availableCxOff: (m) =>
    m.currentStatus.type === ReasonType.AVAILABLE && !m.isLoggedInToCx,
  cxOn: (m) => m.isLoggedInToCx,
  cxOff: (m) => !m.isLoggedInToCx,
  away: (m) => m.currentStatus.type === ReasonType.AWAY,
  busy: (m) => m.currentStatus.type === ReasonType.BUSY,
  notOffline: (m) => m.currentStatus.type !== ReasonType.OFFLINE,
  offline: (m) => m.currentStatus.type === ReasonType.OFFLINE,
};

export function applyStatusFilter(
  members: TeamViewMember[],
  filter: TeamViewStatusFilter
): TeamViewMember[] {
  if (filter === 'all') return members;
  return members.filter(predicates[filter]);
}

export function applyMemberSearch(
  members: TeamViewMember[],
  searchValue: string
): TeamViewMember[] {
  const trimmed = searchValue.trim().toLowerCase();
  if (!trimmed) return members;
  return members.filter(
    (m) =>
      m.userFullName.toLowerCase().includes(trimmed) ||
      m.userEmail.toLowerCase().includes(trimmed)
  );
}
