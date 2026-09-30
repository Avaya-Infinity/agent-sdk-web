import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type ChatMessage,
  ChatMessageSubType,
  type Interaction,
  type Message,
  MessageAuthorType,
  MessageType,
} from '@avaya/infinity-agent-sdk';
import { ChevronDown, Loader2 } from 'lucide-react';
import { ChatMessageGroup, type ChatGroupAuthor } from './ChatMessageGroup';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Button } from '@/components/ui/button';
import { strings } from '@/locales/en';

interface MessagePanelProps {
  interaction: Interaction;
  messages: Message[];
  /** ID of the currently signed-in user — used to flip own messages to the right side. */
  currentUserId: string;
  /** Invoked when the user submits text in the input. */
  onSendMessage: (text: string) => void;
  /** True while the next older batch is being fetched from the server. */
  historyLoading: boolean;
  /** True when more older messages may still exist on the server. */
  hasMoreHistory: boolean;
  /** Last history-load error message, if any. */
  historyError?: string;
  /** Invoked when the feed wants the next older batch (scroll-up or retry). */
  onLoadOlderHistory: () => void;
}

/** Consecutive chat messages from the same author are grouped into one visual block
 *  if their gap is at most this many milliseconds. */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** Trigger `onLoadOlderHistory` when the user scrolls within this many pixels of the top. */
const LOAD_OLDER_THRESHOLD_PX = 80;

/** Auto-scroll-to-bottom on append only when the user was within this many pixels of the bottom. */
const NEAR_BOTTOM_THRESHOLD_PX = 150;

type RenderItem =
  | { kind: 'system'; message: Message }
  | {
      kind: 'chatGroup';
      groupId: string;
      author: ChatGroupAuthor;
      isOwn: boolean;
      isPrivate: boolean;
      isTranscription: boolean;
      messages: ChatMessage[];
    };

/** Stable identity key for the (singleton) customer party of an interaction. */
const CUSTOMER_IDENTITY_KEY = '__customer__';

/**
 * Build a normalized display author from any chat message. Returns undefined
 * for messages whose author type isn't surfaced as a chat group in this
 * release (e.g. SYSTEM authors come through SystemMessage, not CHAT).
 *
 * `isOwn` is true only for AGENT messages authored by the current viewer; the
 * customer is never "us".
 */
function authorFromChatMessage(
  message: ChatMessage,
  currentUserId: string,
): { author: ChatGroupAuthor; isOwn: boolean } | undefined {
  if (message.author.type === MessageAuthorType.AGENT) {
    const details = message.author.details;
    return {
      author: {
        identityKey: details.userId,
        displayName: details.displayName,
        avatarUrl: details.avatarUrl,
        hasRealName: true,
      },
      isOwn: details.userId === currentUserId,
    };
  }
  if (message.author.type === MessageAuthorType.CUSTOMER) {
    const details = message.author.details;
    // Prefer name, fall back to phone, then email — at least one is usually
    // non-empty on an interaction. Empty-string fallback is the last resort.
    const hasRealName = !!details.name;
    const displayName = details.name || details.phone || details.email || strings.interactions.messages.customerFallbackName;
    return {
      author: {
        identityKey: CUSTOMER_IDENTITY_KEY,
        displayName,
        hasRealName,
      },
      isOwn: false,
    };
  }
  return undefined;
}

/**
 * Walks the message list and emits render items. Consecutive chat messages
 * from the same author with the same privacy flag and a gap ≤ {@link GROUP_WINDOW_MS}
 * collapse into a single chatGroup. Both AGENT and CUSTOMER chat messages
 * participate; SYSTEM messages are always their own item.
 */
function groupMessages(messages: Message[], currentUserId: string): RenderItem[] {
  const items: RenderItem[] = [];

  for (const message of messages) {
    // System messages don't participate in chat grouping.
    if (message.type === MessageType.SYSTEM) {
      items.push({ kind: 'system', message });
      continue;
    }

    if (message.type !== MessageType.CHAT) {
      continue;
    }

    const resolved = authorFromChatMessage(message, currentUserId);
    if (!resolved) continue;
    const { author, isOwn } = resolved;
    const isTranscription = message.subType === ChatMessageSubType.TRANSCRIPTION;
    const last = items[items.length - 1];

    if (
      last
      && last.kind === 'chatGroup'
      && last.author.identityKey === author.identityKey
      && last.isPrivate === message.isPrivate
      && last.isTranscription === isTranscription
      && message.createdAt.getTime() - last.messages[last.messages.length - 1].createdAt.getTime() <= GROUP_WINDOW_MS
    ) {
      last.messages.push(message);
    } else {
      items.push({
        kind: 'chatGroup',
        groupId: message.messageId,
        author,
        isOwn,
        isPrivate: message.isPrivate,
        isTranscription,
        messages: [message],
      });
    }
  }

  return items;
}

/**
 * MessagePanel renders the message feed for the current interaction.
 *
 * Scroll behavior:
 *   - On initial render and on append (a live message arrives), the feed scrolls
 *     to the bottom — but only if the user was already within
 *     {@link NEAR_BOTTOM_THRESHOLD_PX} of the bottom. This keeps a reader who
 *     has scrolled up into older history from being yanked back to the bottom.
 *   - On prepend (older messages loaded via `onLoadOlderHistory`), scroll
 *     position is preserved so the message the user was reading stays at the
 *     same screen position.
 *   - When the user scrolls within {@link LOAD_OLDER_THRESHOLD_PX} of the top,
 *     `onLoadOlderHistory()` is invoked (the parent guards against concurrent
 *     calls and exhaustion).
 *
 * Consecutive chat messages from the same author within a short time window are
 * grouped into one block (single header, stacked bubbles, single timestamp).
 */
function MessagePanel({
  interaction,
  messages,
  currentUserId,
  onSendMessage,
  historyLoading,
  hasMoreHistory,
  historyError,
  onLoadOlderHistory,
}: MessagePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Snapshot of last-observed scroll metrics, updated on every scroll event
  // and after every scroll-preserving DOM mutation. useLayoutEffect reads this
  // to compute the delta between previous and new DOM heights.
  const lastScrollSnapshotRef = useRef({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

  // First / last message IDs from the previous render, used to detect
  // prepend vs append vs replace.
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const prevLastIdRef = useRef<string | undefined>(undefined);
  const prevMessagesLengthRef = useRef(0);

  // Number of messages that have arrived (via append) while the user was
  // NOT near the bottom. Surfaces as a "↓ N new messages" pill so the user
  // is aware they can scroll down for fresh content.
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);

  // Track scroll metrics continuously so we always have "the user's last known
  // position" available when messages change.
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    lastScrollSnapshotRef.current = {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
    };
    // Load-older trigger: only fire when the user is near the top AND we're
    // not already loading AND the server hasn't been exhausted.
    if (
      container.scrollTop <= LOAD_OLDER_THRESHOLD_PX
      && !historyLoading
      && hasMoreHistory
      && !historyError
    ) {
      onLoadOlderHistory();
    }
    // Clear unread-below pill once the user has naturally arrived at the bottom.
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX && unreadBelowCount > 0) {
      setUnreadBelowCount(0);
    }
  }, [historyLoading, hasMoreHistory, historyError, onLoadOlderHistory, unreadBelowCount]);

  // Pill click — smooth-scroll to the bottom and clear the counter.
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    setUnreadBelowCount(0);
  }, []);

  // Scroll-position management on messages change. Runs synchronously after
  // the DOM is updated but before paint, so the user never sees a jump.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const newFirstId = messages[0]?.messageId;
    const newLastId = messages[messages.length - 1]?.messageId;
    const prevFirstId = prevFirstIdRef.current;
    const prevLastId = prevLastIdRef.current;
    const prevLength = prevMessagesLengthRef.current;
    const isInitialPopulation = prevLength === 0 && messages.length > 0;

    const snapshot = lastScrollSnapshotRef.current;
    const newScrollHeight = container.scrollHeight;

    if (isInitialPopulation) {
      // First time the feed has content — scroll to the bottom so the most
      // recent message is in view.
      container.scrollTop = newScrollHeight;
    } else if (prevFirstId !== undefined && newFirstId !== prevFirstId) {
      // The first message changed — older messages were prepended (or the
      // feed was replaced). Preserve scroll position so the reader's anchor
      // stays put. The delta accounts for both new messages and any change
      // in the height of the top-of-feed loading/error banner.
      const heightDelta = newScrollHeight - snapshot.scrollHeight;
      container.scrollTop = snapshot.scrollTop + heightDelta;
    } else if (prevLastId !== undefined && newLastId !== prevLastId) {
      // A new message was appended (live socket event). Auto-scroll only if
      // the user was already near the bottom; otherwise leave them where
      // they are (they're reading older content) and increment the
      // "unread below" counter so they can see a pill prompting them
      // to jump to the newest content.
      const wasNearBottom =
        snapshot.scrollHeight - snapshot.scrollTop - snapshot.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
      if (wasNearBottom) {
        container.scrollTop = newScrollHeight;
      } else {
        const appendedCount = Math.max(0, messages.length - prevLength);
        if (appendedCount > 0) {
          setUnreadBelowCount((c) => c + appendedCount);
        }
      }
    }

    prevFirstIdRef.current = newFirstId;
    prevLastIdRef.current = newLastId;
    prevMessagesLengthRef.current = messages.length;
    lastScrollSnapshotRef.current = {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
    };
  }, [messages]);

  // The top-of-feed banner height may change between renders (loading spinner
  // appears or disappears, error banner toggles). Re-sync the snapshot after
  // those transitions so the next prepend's delta math is correct.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    lastScrollSnapshotRef.current = {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
    };
  }, [historyLoading, historyError]);

  // Auto-fill the viewport: if the loaded messages don't produce a scrollable
  // container, pull another page. Without scroll overflow the scroll-up
  // trigger never fires (the browser emits no `scroll` events), so short
  // conversations or tall panels would otherwise stall after the first batch.
  // The parent's loading guard + the iterator's internal serialization stop
  // this from spamming concurrent fetches; the loop terminates when either
  // the viewport overflows or `hasMoreHistory` flips false.
  useEffect(() => {
    if (historyLoading || !hasMoreHistory || historyError) return;
    if (messages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollHeight - container.clientHeight <= LOAD_OLDER_THRESHOLD_PX) {
      onLoadOlderHistory();
    }
  }, [messages, historyLoading, hasMoreHistory, historyError, onLoadOlderHistory]);

  const items = useMemo(
    () => groupMessages(messages, currentUserId),
    [messages, currentUserId]
  );

  const showEmpty = items.length === 0 && !historyLoading && !historyError && !hasMoreHistory;

  return (
    // No own card — InteractionRightPanel is the single visible card that wraps
    // both the tab strip and this panel.
    <div className="flex flex-col h-full min-h-0">
      {/* `relative` wrapper anchors the unread-below pill to the bottom of the
          feed (not the bottom of the whole panel — the input sits below this). */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          className="absolute inset-0 overflow-y-auto p-3 space-y-3"
          role="log"
          aria-label="Message history"
          aria-live="polite"
          onScroll={handleScroll}
        >
          {/* Top-of-feed banner — shows during older-history load OR after a fetch failure. */}
          {historyLoading && (
            <div className="flex items-center justify-center py-3 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" aria-hidden="true" />
              <span>{strings.interactions.messages.loadingOlder}</span>
            </div>
          )}
          {!historyLoading && historyError && (
            <div className="flex flex-col items-center gap-2 py-3 text-xs text-red-600">
              <span>{strings.interactions.messages.loadOlderErrorPrefix} {historyError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadOlderHistory}
                aria-label={strings.interactions.messages.retryAriaLabel}
              >
                {strings.interactions.messages.retry}
              </Button>
            </div>
          )}

          {showEmpty ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {strings.interactions.messages.empty}
            </p>
          ) : (
            items.map((item) =>
              item.kind === 'system' ? (
                <MessageBubble
                  key={item.message.messageId}
                  message={item.message}
                  isOwn={false}
                />
              ) : (
                <ChatMessageGroup
                  key={item.groupId}
                  messages={item.messages}
                  author={item.author}
                  isOwn={item.isOwn}
                  isPrivate={item.isPrivate}
                  isTranscription={item.isTranscription}
                />
              )
            )
          )}
        </div>

        {/* "New messages below" pill — visible only when messages arrived
            while the user was scrolled up reading older content. */}
        {unreadBelowCount > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label={strings.interactions.messages.scrollToBottomAriaLabel}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 shadow-md hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{strings.interactions.messages.newMessagesBelow(unreadBelowCount)}</span>
          </button>
        )}
      </div>
      <MessageInput interaction={interaction} onSend={onSendMessage} />
    </div>
  );
}

export { MessagePanel };
