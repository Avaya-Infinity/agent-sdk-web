import { VenetianMask } from 'lucide-react';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

function PrivateBadge() {
  return (
    <VenetianMask
      className="w-4 h-4 text-purple-600 shrink-0"
      aria-label="Private message"
    />
  );
}

/**
 * Closed-captions indicator — marks a chat message (or group) as a voice-to-text
 * transcription rather than a typed message. Styled as a literal "CC" pill to
 * read unambiguously next to {@link PrivateBadge}.
 */
function CCBadge() {
  return (
    <span
      className="inline-flex items-center justify-center h-4 px-1 rounded-sm border border-blue-600 text-blue-600 text-[10px] font-bold leading-none shrink-0"
      aria-label="Voice transcription"
      title="Voice transcription"
    >
      CC
    </span>
  );
}

export { formatTime, initialsOf, PrivateBadge, CCBadge };
