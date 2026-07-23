import { useCallback, useEffect, useState } from 'react';
import type {
  User,
  InteractionView,
  InteractionSummary,
  InteractionSummaryPage,
} from '@avaya/infinity-agent-sdk';
import { AvayaInfinityAgentSdkError } from '@avaya/infinity-agent-sdk';
import { formatInteractionAge } from '@/utils/format-interaction-age';
import {
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  MessageSquare,
  CheckCircle2,
  Crown,
} from 'lucide-react';
import { strings } from '@/locales/en';
import { createLogger } from '@/utils/logger';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/UserProfile/UserAvatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const logger = createLogger('ViewingPage');

interface ViewingPageProps {
  user: User;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'available' | 'busy' | 'away' | 'outline' {
  switch (status) {
    case 'connected': return 'available';
    case 'hold': return 'away';
    case 'wrapUp': return 'busy';
    case 'pending': return 'secondary';
    default: return 'outline';
  }
}

function TypeIcon({ commType, subCommType }: { commType: string; subCommType: string }) {
  const isInbound = subCommType?.toLowerCase().includes('inbound');
  const isOutbound = subCommType?.toLowerCase().includes('outbound');

  if (commType === 'phone') {
    if (isInbound) return <PhoneIncoming className="size-4 text-gray-700" aria-hidden="true" />;
    if (isOutbound) return <PhoneOutgoing className="size-4 text-gray-700" aria-hidden="true" />;
    return <Phone className="size-4 text-gray-700" aria-hidden="true" />;
  }
  if (commType === 'messaging' || commType === 'chat' || commType === 'sms' || commType === 'email') {
    return <MessageSquare className="size-4 text-gray-700" aria-hidden="true" />;
  }
  return <Phone className="size-4 text-gray-700" aria-hidden="true" />;
}

/**
 * Capitalize the first letter of each word and replace separators with spaces.
 * Used for synthesizing "New Phone Inbound" from commType + subCommType when
 * the server has no explicit subject.
 */
function titleCase(value: string): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function deriveSubject(interaction: InteractionSummary): string {
  if (interaction.subject?.trim()) return interaction.subject;
  const channel = titleCase(interaction.communicationType);
  const direction = titleCase(interaction.communicationSubType);
  if (channel && direction) return `New ${channel} ${direction}`;
  if (channel) return `New ${channel}`;
  return '—';
}

function ViewingPage({ user }: ViewingPageProps) {
  const { addNotification, updateNotification } = useNotifications();

  // Views
  const [views, setViews] = useState<InteractionView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | undefined>();
  const [loadingViews, setLoadingViews] = useState(true);

  // Interactions
  const [page, setPage] = useState<InteractionSummaryPage | null>(null);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // View action in-flight
  const [viewingId, setViewingId] = useState<string | null>(null);

  // ── Load views on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await user.getInteractionViews();
        if (cancelled) return;
        setViews(result);
        if (result.length > 0) {
          const defaultView = result.find(v => v.isDefault) ?? result[0];
          setSelectedViewId(defaultView.viewId);
        }
      } catch (err) {
        logger.error('Failed to load views', err);
      } finally {
        if (!cancelled) setLoadingViews(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Load interactions when view or page changes ─────────────────────
  const fetchInteractions = useCallback(async (viewId: string, pageNum: number) => {
    const view = views.find(v => v.viewId === viewId);
    if (!view) return;
    setLoadingInteractions(true);
    try {
      const result = await view.getInteractions({ page: pageNum, pageSize: 20 });
      setPage(result);
    } catch (err) {
      logger.error('Failed to load interactions', err);
      setPage(null);
    } finally {
      setLoadingInteractions(false);
    }
  }, [views]);

  useEffect(() => {
    if (selectedViewId) {
      fetchInteractions(selectedViewId, currentPage);
    }
  }, [selectedViewId, currentPage, fetchInteractions]);

  // ── Refresh handler ─────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (selectedViewId) {
      fetchInteractions(selectedViewId, currentPage);
    }
  }, [selectedViewId, currentPage, fetchInteractions]);

  // ── View interaction handler ────────────────────────────────────────
  // The interaction created from viewInteraction() is auto-selected by MainLayout
  // (INTERACTION_VIEWING_STARTED event), and InteractionsPage exits Discover mode when
  // selectedInteractionId becomes defined — so the user lands on the new view.
  const handleView = useCallback(async (interactionId: string, viewPrivately: boolean) => {
    const notifId = `view-${interactionId}`;
    setViewingId(interactionId);
    addNotification({
      id: notifId,
      level: 'info',
      title: strings.viewing.startingView,
      loading: true,
      autoDismissMs: null,
    });

    try {
      await user.viewInteraction(interactionId, { viewPrivately });
      updateNotification({
        id: notifId,
        level: 'success',
        title: strings.viewing.viewStarted,
        loading: false,
        autoDismissMs: 3000,
      });
    } catch (err) {
      logger.error('Failed to start viewing', err);
      updateNotification({
        id: notifId,
        level: 'error',
        title: strings.viewing.viewFailed,
        description: err instanceof Error ? err.message : String(err),
        loading: false,
        autoDismissMs: 8000,
      });
    } finally {
      setViewingId(null);
    }
  }, [user, addNotification, updateNotification]);

  // ── Claim ownership directly from the discover row ──────────────────
  // Chains view (public) → claim. Same in-flight gating + auto-navigate as handleView,
  // because the underlying viewInteraction() fires INTERACTION_VIEWING_STARTED and MainLayout
  // selects the new interaction, which exits Discover mode via existing wiring.
  const handleClaim = useCallback(async (interactionId: string) => {
    const notifId = `claim-${interactionId}`;
    setViewingId(interactionId);
    addNotification({
      id: notifId,
      level: 'info',
      title: strings.viewing.startingClaim,
      loading: true,
      autoDismissMs: null,
    });

    try {
      const newInteraction = await user.viewInteraction(interactionId, { viewPrivately: false });
      await newInteraction.claimOwnership();
      updateNotification({
        id: notifId,
        level: 'success',
        title: strings.viewing.claimStarted,
        loading: false,
        autoDismissMs: 3000,
      });
    } catch (err) {
      logger.error('Failed to claim ownership', err);
      const description = AvayaInfinityAgentSdkError.is(err)
        ? (err.detail ?? err.message)
        : err instanceof Error ? err.message : String(err);
      updateNotification({
        id: notifId,
        level: 'error',
        title: strings.viewing.claimFailed,
        description,
        loading: false,
        autoDismissMs: 8000,
      });
    } finally {
      setViewingId(null);
    }
  }, [user, addNotification, updateNotification]);

  const interactions: InteractionSummary[] = page?.interactions ?? [];

  // ── Loading views state ─────────────────────────────────────────────
  if (loadingViews) {
    return (
      <div className="flex flex-col h-full gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // ── No views available ──────────────────────────────────────────────
  if (views.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground" role="status">
            <Eye className="size-12 mx-auto mb-4 opacity-30" aria-hidden="true" />
            <h2 className="text-lg font-medium">{strings.viewing.title}</h2>
            <p className="text-sm mt-1">{strings.viewing.noViews}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Filter bar — view dropdown, refresh */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedViewId}
          onValueChange={(v) => { setSelectedViewId(v); setCurrentPage(1); }}
        >
          <SelectTrigger
            className="w-64 bg-white"
            aria-label={strings.viewing.selectView}
          >
            <SelectValue placeholder={strings.viewing.selectView} />
          </SelectTrigger>
          <SelectContent>
            {views.map(view => (
              <SelectItem key={view.viewId} value={view.viewId}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={loadingInteractions}
          aria-label={strings.viewing.refresh}
          className="bg-white"
        >
          <RefreshCw className={`size-4 ${loadingInteractions ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </div>

      {/* Table card */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {loadingInteractions && !page ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : interactions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center text-muted-foreground">
                <EyeOff className="size-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
                <p className="text-sm">{strings.viewing.noInteractions}</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.viewing.type}</TableHead>
                  <TableHead>{strings.viewing.subject}</TableHead>
                  <TableHead>{strings.viewing.customer}</TableHead>
                  <TableHead>{strings.viewing.queue}</TableHead>
                  <TableHead>{strings.viewing.route}</TableHead>
                  <TableHead>{strings.viewing.tags}</TableHead>
                  <TableHead>{strings.viewing.user}</TableHead>
                  <TableHead>{strings.viewing.status}</TableHead>
                  <TableHead>{strings.viewing.age}</TableHead>
                  <TableHead>{strings.viewing.aid}</TableHead>
                  <TableHead className="text-right">{strings.viewing.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interactions.map(interaction => {
                  const startTimeDate = interaction.startTime ? new Date(interaction.startTime) : null;
                  const tagsLabel = interaction.tags.length > 0 ? interaction.tags.join(', ') : '—';
                  const routeName = interaction.route.name?.trim();
                  const routePhone = interaction.route.phoneNumber?.trim();
                  const isLive = interaction.currentStatus !== "completed";

                  return (
                    <TableRow key={interaction.interactionId}>
                      <TableCell>
                        <TypeIcon commType={interaction.communicationType} subCommType={interaction.communicationSubType} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {deriveSubject(interaction)}
                      </TableCell>
                      <TableCell>
                        {interaction.sourceDetails.name || interaction.sourceDetails.phoneNumber || '—'}
                      </TableCell>
                      <TableCell>{interaction.queueDetails.name || '—'}</TableCell>
                      <TableCell>
                        {routeName || routePhone ? (
                          <div className="flex flex-col leading-tight text-sm">
                            {routeName && <span>{routeName}{routePhone ? ',' : ''}</span>}
                            {routePhone && <span className="text-muted-foreground">{routePhone}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tagsLabel === '—'
                          ? <span className="text-muted-foreground">—</span>
                          : tagsLabel}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar fullName={interaction.user.fullName} size="sm" />
                          <span className="text-sm font-medium">{interaction.user.fullName || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(interaction.currentStatus)}>
                          {interaction.currentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {startTimeDate ? (
                          <span className="text-sm text-muted-foreground">
                            {formatInteractionAge(startTimeDate)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {interaction.isAid ? (
                          <CheckCircle2
                            className="size-5 text-green-600"
                            aria-label={strings.viewing.aidActive}
                          />
                        ) : (
                          <span className="text-muted-foreground" aria-label={strings.viewing.aidInactive}>—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={viewingId !== null}
                              aria-label={`${strings.viewing.actions} for ${interaction.user.fullName}`}
                            >
                              {strings.viewing.actions}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(interaction.interactionId, false)}>
                              <Eye className="size-4" />
                              {strings.viewing.viewPublicly}
                            </DropdownMenuItem>
                            {/* Private view and Claim only make sense for live
                                interactions. For completed ones, ownership and
                                viewer presence are historical — only public
                                view (history/recording playback) applies. */}
                            {isLive && (
                              <DropdownMenuItem onClick={() => handleView(interaction.interactionId, true)}>
                                <EyeOff className="size-4" />
                                {strings.viewing.viewPrivately}
                              </DropdownMenuItem>
                            )}
                            {isLive && !user.isEliteVoiceEnabled && !interaction.isElite && (
                              <DropdownMenuItem onClick={() => handleClaim(interaction.interactionId)}>
                                <Crown className="size-4" />
                                {strings.viewing.claim}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination footer */}
        {page && page.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t text-sm text-muted-foreground">
            <span>
              {strings.viewing.showing} {((page.currentPage - 1) * page.pageSize) + 1}–{Math.min(page.currentPage * page.pageSize, page.totalInteractions)} {strings.viewing.of} {page.totalInteractions}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={!page.hasPreviousPage || loadingInteractions}
                aria-label={strings.viewing.prev}
              >
                <ChevronLeft className="size-4" />
                {strings.viewing.prev}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!page.hasNextPage || loadingInteractions}
                aria-label={strings.viewing.next}
              >
                {strings.viewing.next}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { ViewingPage };
