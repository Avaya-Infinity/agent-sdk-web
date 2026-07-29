import { Cog } from 'lucide-react';
import {
  type Message,
  MessageAuthorType,
  MessageType,
} from '@avaya/infinity-agent-sdk';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatTime, initialsOf, PrivateBadge } from './message-utils';

interface MessageBubbleProps {
  message: Message;
  /** Reserved for future symmetry with chat groups; currently unused for system rows. */
  isOwn: boolean;
}

/**
 * Renders a single system message row.
 *
 * Compact two-row layout:
 *   row 1: [Cog] System  <time>  [PrivateMask]
 *   row 2: [actor pill]?  body text
 *
 * The actor pill is rendered inline before the body text only for user-triggered
 * system events (`author.type === AGENT`); pure server notifications skip the pill
 * and render the body text alone.
 *
 * Chat-style messages (`message.type === CHAT`) are rendered by
 * {@link ./ChatMessageGroup} instead — they participate in author/time grouping.
 */
function MessageBubble({ message }: MessageBubbleProps) {
  const time = formatTime(message.createdAt);
  const isPrivate = message.isPrivate;

  // Defensive: this component now renders system rows only.
  if (message.type !== MessageType.SYSTEM) {
    return null;
  }

  const content = message.body.text.content;
  const actor =
    message.author.type === MessageAuthorType.AGENT
      ? message.author.details
      : undefined;

  return (
    <div
      className="rounded-lg bg-gray-100 px-4 py-3 space-y-2"
      role="listitem"
    >
      <div className="flex items-center gap-2 text-sm">
        <Cog className="w-4 h-4 text-gray-700 shrink-0" aria-hidden="true" />
        <span className="font-semibold text-gray-700">System</span>
        <span className="text-xs text-gray-500">{time}</span>
        {isPrivate && <PrivateBadge />}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {actor && (
          <span className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-md bg-gray-200">
            <Avatar className="h-5 w-5 shrink-0">
              {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt="" />}
              <AvatarFallback className="bg-blue-900 text-white text-[9px] font-semibold">
                {initialsOf(actor.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-900">
              {actor.displayName}
            </span>
          </span>
        )}
        <span className="text-sm text-gray-900 whitespace-pre-wrap break-words">
          {content}
        </span>
      </div>
    </div>
  );
}

export { MessageBubble };
