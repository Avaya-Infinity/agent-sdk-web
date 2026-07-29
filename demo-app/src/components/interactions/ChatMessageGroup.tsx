import {
  type ChatMessage,
} from '@avaya/infinity-agent-sdk';
import { Check, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { strings } from '@/locales/en';
import { CCBadge, formatTime, initialsOf, PrivateBadge } from './message-utils';

/**
 * Display-only author shape shared by AGENT and CUSTOMER chat groups. Normalized
 * locally so the same renderer can handle both — the SDK's AgentAuthorDetails
 * and CustomerAuthorDetails have different field names (displayName vs name).
 */
export interface ChatGroupAuthor {
  /** Stable id used to detect "same author" across consecutive messages. */
  identityKey: string;
  displayName: string;
  avatarUrl?: string;
  /**
   * `true` when {@link displayName} is the author's real name. `false` when it
   * is a stand-in (phone number, email) used because no name was known — in
   * that case the avatar falls back to a generic person icon rather than
   * mangled initials like `+`.
   */
  hasRealName: boolean;
}

interface ChatMessageGroupProps {
  /** Consecutive chat messages from the same author within a short time window. */
  messages: ChatMessage[];
  /** Author shared by all messages in this group. */
  author: ChatGroupAuthor;
  /** True when the current viewer authored the group — flips alignment to the right. */
  isOwn: boolean;
  /** True when the group is private (all messages in a group share the same flag). */
  isPrivate: boolean;
  /** True when every message in this group is a voice transcription. */
  isTranscription: boolean;
}

/**
 * Renders one or more consecutive chat messages from the same author as a single
 * visual block:
 *   - avatar + name + privacy mask shown once at the top
 *   - stacked bubbles, one per message
 *   - timestamp shown once at the bottom (uses the last message's time)
 *
 * For own messages the layout flips to the right side. Bubbles within a group
 * share the same indentation so they align below the author name.
 */
function ChatMessageGroup({ messages, author, isOwn, isPrivate, isTranscription }: ChatMessageGroupProps) {
  const lastTime = formatTime(messages[messages.length - 1].createdAt);

  return (
    <div
      className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}
      role="listitem"
    >
      <div
        className={cn(
          'flex items-center gap-2',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <Avatar className="h-8 w-8">
          {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
          <AvatarFallback className="bg-blue-900 text-white text-xs font-semibold">
            {author.hasRealName ? (
              initialsOf(author.displayName)
            ) : (
              <User className="w-4 h-4" aria-hidden="true" />
            )}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            'flex items-center gap-1.5',
            isOwn ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <span className="text-sm font-semibold text-gray-900">
            {author.displayName}
          </span>
          {isPrivate && <PrivateBadge />}
          {isTranscription && <CCBadge />}
        </div>
      </div>

      <div
        className={cn(
          'flex flex-col gap-1',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {messages.map((m) => {
          const content = m.body.text.content;
          return (
            <div
              key={m.messageId}
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
                // Indent so the bubbles align with the name (avatar width + gap).
                isOwn ? 'mr-10' : 'ml-10',
                // Square the corner that points back at the author header so
                // the bubbles read as "anchored" to the speaker.
                isOwn ? 'rounded-tr-none' : 'rounded-tl-none',
                isOwn
                  ? 'bg-blue-50 text-gray-900 border border-blue-100'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              {content}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          'flex items-center gap-1 text-[11px] text-gray-500',
          isOwn ? 'mr-10' : 'ml-10'
        )}
      >
        <span>{lastTime}</span>
        {isOwn && (
          <Check
            className="w-3 h-3 text-gray-500"
            aria-label={strings.interactions.messages.sentIndicator}
          />
        )}
      </div>
    </div>
  );
}

export { ChatMessageGroup };
