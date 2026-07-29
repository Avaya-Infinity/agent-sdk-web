import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, LogOut, Megaphone, Mic, MicOff, PhoneIncoming, PhoneOff, Radio, RadioTower, Users } from 'lucide-react';
import {
  InteractionStatus,
  type Interaction,
  type User,
  type Viewer,
  type ViewerDetails,
} from '@avaya/infinity-agent-sdk';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';
import { cn } from '@/lib/utils';

interface ViewerAvatarStripProps {
  interaction: Interaction;
  user: User;
  // Owner-on-viewer actions (used when current user is the owner). Each takes the
  // target Viewer object — actions and capability guards live on Viewer itself.
  onMuteViewer: (viewer: Viewer) => void | Promise<void>;
  onRemoveViewer: (viewer: Viewer) => void | Promise<void>;
  onAssignOwner: (viewer: Viewer) => void | Promise<void>;
  // Viewer-self actions (used when current user is a viewer)
  onViewerJoinCall?: (interaction: Interaction) => void | Promise<void>;
  onViewerLeaveCall?: (interaction: Interaction) => void | Promise<void>;
  onViewerMute?: (interaction: Interaction) => void | Promise<void>;
  onViewerUnmute?: (interaction: Interaction) => void | Promise<void>;
  onViewerRemove?: (interaction: Interaction) => void | Promise<void>;
  onClaimOwnership?: (interaction: Interaction) => void | Promise<void>;
  // Elite supervisor coach — only meaningful for Elite supervisor viewers in
  // listen-only mode; the strip's own guards keep the button hidden otherwise.
  onCoach?: (interaction: Interaction) => void | Promise<void>;
  isCoachLoading?: boolean;
  // Elite supervisor barge — only meaningful for Elite supervisor viewers in
  // listen-only mode (BARGE IN) or listen-talk mode (UNBARGE). Gated by SDK
  // capability guards (`canBarge()` / `canUnbarge()`).
  onBarge?: (interaction: Interaction) => void | Promise<void>;
  onUnbarge?: (interaction: Interaction) => void | Promise<void>;
  isBargeLoading?: boolean;
}

/**
 * A minimal "viewer-shaped" identity object so we can route `interaction.ownerDetails`
 * through the same display helpers (`getViewerInitials` / `getViewerLabel`) used
 * for viewers. The owner is always an internal agent, so `type: 'internal'`.
 */
function ownerAsViewerShape(owner: { userId: string; email: string; fullName: string }): ViewerDetails {
  return {
    id: owner.userId,
    type: 'internal',
    email: owner.email,
    fullName: owner.fullName,
    firstName: undefined,
    lastName: undefined,
    isMuted: false,
    isAudio: true,
  } as unknown as ViewerDetails;
}

/**
 * Returns a 1-2 character initials string for a viewer based on fullName or first/last.
 * External viewers fall back to the first two characters of `externalAddress`.
 */
function getViewerInitials(viewer: ViewerDetails): string {
  if (viewer.viewerType === 'external' && viewer.externalAddress) {
    return viewer.externalAddress.slice(0, 2).toUpperCase();
  }
  const fullName = viewer.fullName?.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }
  const first = viewer.firstName?.[0] ?? '';
  const last = viewer.lastName?.[0] ?? '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || viewer.email?.slice(0, 2).toUpperCase() || '??';
}

/**
 * Returns the display label for a viewer.
 * External viewers show their `externalAddress`; internal viewers show `fullName`
 * (or `firstName lastName` as fallback).
 */
function getViewerLabel(viewer: ViewerDetails): string {
  if (viewer.viewerType === 'external' && viewer.externalAddress) {
    return viewer.externalAddress;
  }
  if (viewer.fullName?.trim()) return viewer.fullName;
  const composed = `${viewer.firstName ?? ''} ${viewer.lastName ?? ''}`.trim();
  return composed || viewer.email || viewer.id;
}

/**
 * ViewerAvatarStrip
 *
 * Horizontal strip of small avatars: the interaction owner (with a crown
 * overlay) followed by all public viewers. Rendered on both the owner UI
 * and the viewer UI.
 *
 * Owner-perspective interaction:
 * - The owner avatar is a label-only chip — clicking it does not expand.
 * - Clicking a viewer avatar reveals an inline action pill RIGHT NEXT TO that
 *   viewer (Assign Owner / Mute-Unmute / Remove). Click another viewer to
 *   move the pill; click outside / press Esc to collapse.
 *
 * Viewer-perspective interaction:
 * - Avatars are read-only (no expansion).
 * - Self-actions for the viewer (Join/Leave call, Mute/Unmute, Claim,
 *   Stop Viewing) are rendered as icon buttons on the right side of the
 *   strip.
 */
function ViewerAvatarStrip({
  interaction,
  user,
  onMuteViewer,
  onRemoveViewer,
  onAssignOwner,
  onViewerJoinCall,
  onViewerLeaveCall,
  onViewerMute,
  onViewerUnmute,
  onViewerRemove,
  onClaimOwnership,
  onCoach,
  isCoachLoading,
  onBarge,
  onUnbarge,
  isBargeLoading,
}: ViewerAvatarStripProps) {
  const { addNotification } = useNotifications();

  // Re-read on every render rather than memoizing. The parent (InteractionsPage)
  // triggers a re-render via a tick counter whenever any viewer event fires
  // (added/removed/muted/unmuted/joined/left). Memoizing on `getViewers().length`
  // alone would miss field-level changes like `isMuted` flipping while the
  // viewer count stays the same — causing the mute/unmute button label to
  // stay stale.
  const publicViewers = interaction.getViewers().filter((v) => v.id !== user.userId);

  const [expandedViewerId, setExpandedViewerId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  // When the viewer count exceeds VISIBLE_COUNT, the strip collapses the
  // remainder behind a "+N" toggle. Threshold is intentionally high (10) so
  // the typical mockup case of 3–4 viewers stays fully inline.
  const [showAllViewers, setShowAllViewers] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const VISIBLE_COUNT = 10;
  const overflowCount = Math.max(0, publicViewers.length - VISIBLE_COUNT);
  const renderedViewers =
    showAllViewers || overflowCount === 0
      ? publicViewers
      : publicViewers.slice(0, VISIBLE_COUNT);

  // "Active owner" — currently driving the interaction. We deliberately
  // exclude the case where `isOwner` is true purely because of a historical
  // user.id match on a completed interaction the agent is now viewing as a
  // viewer (here `interaction.isViewer()` is also true). In that case the
  // agent is functionally a viewer and should see the viewer-self cluster,
  // not the owner's manage-viewers click-to-expand behavior.
  const isOwner = interaction.isOwner && !interaction.isViewer();
  // AXP-39050 parity: Assign-Owner is hidden in Elite. Check both flags so we
  // disable it when either the interaction or the agent themselves are Elite.
  const isEliteContext = interaction.isElite || user.isEliteVoiceEnabled;

  // Owner avatar slot: derived from `interaction.ownerDetails`. May be undefined for
  // unassigned interactions — we just skip the slot in that case.
  const ownerDetails = interaction.ownerDetails;

  // Viewer-perspective right-side action visibility.
  const isViewerSelf = !isOwner && interaction.isViewer();
  const currentViewingState = interaction.currentViewingState;
  const onAudioAsViewer = !!currentViewingState?.isAudio;
  // Role-agnostic: isMuted returns the current user's own mute state (viewer self here).
  const isViewerMuted = interaction.isMuted;

  // Collapse on outside click + Esc — only when something is expanded.
  useEffect(() => {
    if (!expandedViewerId) return;

    const onClickOutside = (e: MouseEvent) => {
      if (!stripRef.current?.contains(e.target as Node)) {
        setExpandedViewerId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedViewerId(null);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expandedViewerId]);

  // Collapse if the currently-expanded viewer is no longer on-screen — either
  // because they left the interaction or because the overflow toggle hid them
  // behind the "+N" badge.
  useEffect(() => {
    if (expandedViewerId && !renderedViewers.some((v) => v.id === expandedViewerId)) {
      setExpandedViewerId(null);
    }
  }, [expandedViewerId, renderedViewers]);

  const runAction = useCallback(
    async (
      key: string,
      title: string,
      fn: () => Promise<void> | void
    ) => {
      setPendingActions((prev) => new Set(prev).add(key));
      try {
        await fn();
      } catch (err) {
        addNotification({
          id: `viewer-action-${key}-${Date.now()}`,
          level: 'error',
          title,
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setPendingActions((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [addNotification]
  );

  // Hide the strip entirely when there is nothing to show: no owner AND no
  // public viewers (the unassigned + zero-viewers case).
  // Render the strip whenever there's something useful to show:
  // - The current user is a viewer → they need the right-side action cluster
  //   (Join / Leave / Mute / Claim / Stop Viewing) even when the interaction
  //   has no assigned owner (status="open") or no other viewers (status="completed").
  // - Other public viewers exist → owners and viewers both want to see them.
  //
  // The strip auto-hides once the current user becomes the owner with no
  // other viewers (e.g. after claiming an open interaction) — there are no
  // participants to manage and no self-actions remaining, so the work card
  // falls back to CallControlsBar's owner controls.
  if (!isViewerSelf && publicViewers.length === 0) return null;

  // Resolve from `renderedViewers` (not `publicViewers`) so the expanded panel
  // is hidden the instant the owner collapses the "+N" overflow.
  const expandedViewer = expandedViewerId
    ? renderedViewers.find((v) => v.id === expandedViewerId)
    : undefined;

  // Determine which actions are visible for the expanded viewer (owner only).
  // expandedViewer is a Viewer (from renderedViewers/publicViewers, which both
  // come from interaction.getViewers() returning Viewer[]).
  // canMute/canUnmute are direction-aware on the SDK; the strip surfaces a
  // single toggle button so we show it whenever either direction is allowed.
  const showMute = !!expandedViewer && isOwner && (expandedViewer.canMute() || expandedViewer.canUnmute());
  const showRemove = !!expandedViewer && isOwner && expandedViewer.canRemove();
  const showAssignOwner =
    !!expandedViewer &&
    isOwner &&
    !isEliteContext &&
    expandedViewer.canAssignOwner();
  const hasAnyAction = showMute || showRemove || showAssignOwner;

  const handleAvatarClick = (viewerId: string) => {
    if (!isOwner) return; // viewers see a read-only strip
    setExpandedViewerId((prev) => (prev === viewerId ? null : viewerId));
  };

  // Owner-action pill rendered inline next to the expanded viewer.
  // `viewer` is a Viewer because it comes from renderedViewers (Viewer[]).
  const renderOwnerActionPill = (viewer: Viewer) => {
    if (!hasAnyAction) {
      return (
        <span
          className="ml-1 px-2 py-0.5 rounded-full bg-purple-50 text-xs text-muted-foreground italic"
          role="note"
        >
          {strings.interactions.transfer.viewerNoActionsAvailable}
        </span>
      );
    }
    return (
      <div
        className="flex items-center gap-0.5 ml-1 pl-1 pr-1 py-0.5 rounded-full bg-purple-50"
        role="group"
        aria-label={strings.interactions.transfer.viewerActionsAriaLabel(getViewerLabel(viewer))}
      >
        {showAssignOwner && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                disabled={pendingActions.has(`assign-${viewer.id}`)}
                onClick={() =>
                  runAction(
                    `assign-${viewer.id}`,
                    strings.interactions.transfer.assignOwnerError,
                    async () => {
                      await onAssignOwner(viewer);
                      setExpandedViewerId(null);
                    }
                  )
                }
                aria-label={strings.interactions.transfer.assignOwner}
              >
                <Crown className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{strings.interactions.transfer.assignOwner}</TooltipContent>
          </Tooltip>
        )}

        {showMute && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                disabled={pendingActions.has(`mute-${viewer.id}`)}
                onClick={() =>
                  runAction(
                    `mute-${viewer.id}`,
                    viewer.isMuted
                      ? strings.interactions.transfer.unmuteViewerError
                      : strings.interactions.transfer.muteViewerError,
                    () => onMuteViewer(viewer)
                  )
                }
                aria-label={
                  viewer.isMuted
                    ? strings.interactions.transfer.unmuteViewer
                    : strings.interactions.transfer.muteViewer
                }
              >
                {viewer.isMuted ? (
                  <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {viewer.isMuted
                ? strings.interactions.transfer.unmuteViewer
                : strings.interactions.transfer.muteViewer}
            </TooltipContent>
          </Tooltip>
        )}

        {showRemove && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-purple-700 hover:bg-red-50 hover:text-destructive"
                disabled={pendingActions.has(`remove-${viewer.id}`)}
                onClick={() =>
                  runAction(
                    `remove-${viewer.id}`,
                    strings.interactions.transfer.removeViewerError,
                    async () => {
                      await onRemoveViewer(viewer);
                      setExpandedViewerId(null);
                    }
                  )
                }
                aria-label={strings.interactions.transfer.removeViewer}
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{strings.interactions.transfer.removeViewer}</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  // Viewer-perspective right-side icon button. Wraps Tooltip + Button to keep
  // call-sites concise.
  const renderViewerSelfButton = (params: {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void | Promise<void>;
    destructive?: boolean;
    /** External in-flight signal (e.g. parent-owned coach loading). Combined with local pendingActions. */
    loading?: boolean;
  }) => {
    const { key, label, icon, onClick, destructive, loading } = params;
    const isPending = pendingActions.has(key) || !!loading;
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'h-8 w-8 rounded-full',
              destructive
                ? 'text-purple-700 hover:bg-red-50 hover:text-destructive'
                : 'text-purple-700 hover:bg-purple-100 hover:text-purple-800',
              isPending && 'opacity-50 cursor-not-allowed'
            )}
            disabled={isPending}
            onClick={() => runAction(key, label, () => onClick())}
            aria-label={label}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div
        ref={stripRef}
        className="flex flex-wrap items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm"
        role="group"
        aria-label={strings.interactions.transfer.viewersStripAriaLabel}
      >
        <div className="flex gap-1 items-center">
          {/* Owner avatar — first slot, with crown overlay. Always rendered when
              `interaction.ownerDetails` is populated. Click is a no-op (owner can't
              act on themselves), but the tooltip + focus path still work. */}
          {ownerDetails && (() => {
            const ownerShape = ownerAsViewerShape(ownerDetails);
            const label = getViewerLabel(ownerShape);
            const initials = getViewerInitials(ownerShape);
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="relative inline-flex"
                    aria-label={label}
                  >
                    <Avatar className="w-7 h-7 text-xs">
                      <AvatarFallback className="bg-purple-200 text-purple-800 text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <Crown
                      className="absolute -top-1 -right-1 w-3 h-3 text-purple-700 drop-shadow-sm"
                      aria-hidden="true"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })()}

          {/* Viewer avatars — clickable for the owner (opens inline pill),
              read-only for viewers. The action pill renders inline next to
              the expanded viewer so the connection is visually obvious. */}
          {renderedViewers.map((viewer) => {
            const isExpanded = viewer.id === expandedViewerId;
            const label = getViewerLabel(viewer);
            const initials = getViewerInitials(viewer);
            return (
              <div
                key={viewer.id}
                className={cn(
                  'flex items-center',
                  isExpanded && 'pl-1 pr-0.5 py-0.5 rounded-full bg-purple-50'
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleAvatarClick(viewer.id)}
                      aria-haspopup={isOwner ? 'true' : undefined}
                      aria-expanded={isOwner ? isExpanded : undefined}
                      aria-disabled={!isOwner}
                      aria-label={label}
                      className={cn(
                        'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition',
                        isOwner ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                      )}
                    >
                      <Avatar
                        className={cn(
                          'w-7 h-7 text-xs',
                          isExpanded && 'ring-2 ring-purple-500 ring-offset-1'
                        )}
                      >
                        <AvatarFallback className="bg-purple-100 text-purple-800 text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>

                {/* Inline action pill — appears immediately to the right of the
                    selected viewer's avatar, inside the same connected group. */}
                {isExpanded && renderOwnerActionPill(viewer)}
              </div>
            );
          })}

          {overflowCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowAllViewers((v) => !v)}
                  aria-expanded={showAllViewers}
                  aria-label={
                    showAllViewers
                      ? strings.interactions.transfer.viewersShowLess
                      : strings.interactions.transfer.viewerExtraCount(overflowCount)
                  }
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold cursor-pointer hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition"
                >
                  {showAllViewers
                    ? '−'
                    : strings.interactions.transfer.viewerExtraCount(overflowCount)}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {showAllViewers
                  ? strings.interactions.transfer.viewersShowLess
                  : publicViewers
                      .slice(VISIBLE_COUNT)
                      .map((v) => getViewerLabel(v))
                      .join(', ')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Viewer-perspective: right-aligned self-action icon buttons. Owner
            sees an empty right side (no buttons here — owner call controls live
            in CallControlsBar). */}
        {isViewerSelf && (
          <div
            className="ml-auto flex items-center gap-1"
            role="group"
            aria-label={strings.interactions.transfer.viewing}
          >
            {/* "Barged In" status badge — visible only while the supervisor is
                actively in `listen-talk` mode. Mirrors the COACH state indicator
                pattern and gives the supervisor a persistent visual cue that
                their mic is hot, complementing the destructive STOP BARGING
                button next to it (color + icon + text — not color-only, per
                accessibility principle 6). */}
            {currentViewingState?.eliteSupervisorMode === 'listen-talk' && (
              <Badge
                variant="destructive"
                className="gap-1 mr-1"
                aria-label={strings.interactions.controls.bargedIn}
              >
                <Users className="w-3 h-3" aria-hidden="true" />
                {strings.interactions.controls.bargedIn}
              </Badge>
            )}

            {/* Claim Ownership — independent of the audio/not-audio split so
                non-voice viewers (chat / email / status="open" interactions)
                can claim without ever joining audio. For live voice calls the
                "must be on audio first" rule is enforced by the inline guard
                below: `currentStatus !== CONNECTED || onAudioAsViewer`. */}
            {onClaimOwnership && interaction.canClaimOwnership() &&
              (interaction.currentStatus !== InteractionStatus.CONNECTED || onAudioAsViewer) &&
              renderViewerSelfButton({
                key: 'viewer-claim',
                label: strings.interactions.transfer.claimOwnershipTooltip,
                icon: <Crown className="w-4 h-4" aria-hidden="true" />,
                onClick: () => onClaimOwnership(interaction),
              })}

            {!onAudioAsViewer ? (
              <>
                {onViewerJoinCall && interaction.canJoinCall() &&
                  renderViewerSelfButton({
                    key: 'viewer-join',
                    label: strings.interactions.transfer.joinCall,
                    icon: <PhoneIncoming className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onViewerJoinCall(interaction),
                  })}
                {/* SDK's canLeave() now returns false for Elite
                    supervisors in coach mode (server's viewerRemove leaves the
                    audio leg orphaned, breaks re-coach). No demo-level guard
                    needed — the button auto-hides via the SDK check. */}
                {onViewerRemove && interaction.canLeave() &&
                  renderViewerSelfButton({
                    key: 'viewer-leave-viewing',
                    label: strings.interactions.transfer.leaveViewing,
                    icon: <LogOut className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onViewerRemove(interaction),
                    destructive: true,
                  })}
              </>
            ) : (
              <>
                {/* Pick the direction-appropriate callback up front so the
                    button only renders when the consumer actually wired a
                    handler for the current state. Matches the existence
                    guard the other viewer-self buttons use; without it, a
                    consumer that omits only one of mute/unmute would see
                    the button render and silently no-op on click. */}
                {(() => {
                  const muteCallback = isViewerMuted ? onViewerUnmute : onViewerMute;
                  // canMute/canUnmute are direction-aware on the SDK; either being
                  // true means a self-mute toggle is currently allowed.
                  return muteCallback && (interaction.canMute() || interaction.canUnmute()) &&
                    renderViewerSelfButton({
                      key: 'viewer-self-mute',
                      label: isViewerMuted
                        ? strings.interactions.controls.unmute
                        : strings.interactions.controls.mute,
                      icon: isViewerMuted
                        ? <MicOff className="w-4 h-4" aria-hidden="true" />
                        : <Mic className="w-4 h-4" aria-hidden="true" />,
                      onClick: () => muteCallback(interaction),
                    });
                })()}
                {/* Elite supervisor: START COACHING. Disappears once coaching has started
                    — matches core-agent-ui, which deliberately omits UNCOACH because the
                    Elite API does not reliably support it. Supervisor exits coach via
                    Leave Call. canCoach() folds in Elite + listen-only + on-audio guards. */}
                {onCoach && interaction.canCoach() &&
                  renderViewerSelfButton({
                    key: 'viewer-coach',
                    label: strings.interactions.controls.startCoaching,
                    icon: <Megaphone className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onCoach(interaction),
                    loading: !!isCoachLoading,
                  })}
                {/* Elite supervisor: BARGE IN. Per SPEC REQ-1 we honor the
                    SDK's `canBarge()` guard (restricted to viewers currently in
                    `listen-only` mode to match core-agent-ui's UX). Do NOT
                    bypass this guard — the SDK is intentionally stricter than
                    the server's allowed states. canBarge() folds in Elite +
                    listen-only + on-audio guards. */}
                {onBarge && interaction.canBarge() &&
                  renderViewerSelfButton({
                    key: 'viewer-barge',
                    label: strings.interactions.controls.startBarging,
                    icon: <Radio className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onBarge(interaction),
                    loading: !!isBargeLoading,
                  })}
                {/* Elite supervisor: STOP BARGING — transitions back from
                    `listen-talk` to `listen-only`. Destructive styling
                    reinforces the "going off-air" semantics. */}
                {onUnbarge && interaction.canUnbarge() &&
                  renderViewerSelfButton({
                    key: 'viewer-unbarge',
                    label: strings.interactions.controls.stopBarging,
                    icon: <RadioTower className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onUnbarge(interaction),
                    destructive: true,
                    loading: !!isBargeLoading,
                  })}
                {onViewerLeaveCall && interaction.canLeaveCall() &&
                  renderViewerSelfButton({
                    key: 'viewer-leave-call',
                    label: strings.interactions.transfer.leaveCall,
                    icon: <PhoneOff className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onViewerLeaveCall(interaction),
                    destructive: true,
                  })}
                {/* SDK's canLeave() returns false for Elite
                    supervisors in coach mode — matches core-agent-ui which
                    offers only LEAVE CALL + MUTE in the COACH state. */}
                {onViewerRemove && interaction.canLeave() &&
                  renderViewerSelfButton({
                    key: 'viewer-leave-viewing',
                    label: strings.interactions.transfer.leaveViewing,
                    icon: <LogOut className="w-4 h-4" aria-hidden="true" />,
                    onClick: () => onViewerRemove(interaction),
                    destructive: true,
                  })}
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export { ViewerAvatarStrip };
