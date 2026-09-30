import { useState, type KeyboardEvent } from 'react';
import { type Interaction } from '@avaya/infinity-agent-sdk';
import { Info, Send, VenetianMask } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { strings } from '@/locales/en';

interface MessageInputProps {
  interaction: Interaction;
  /**
   * Submits the trimmed text. The parent owns the optimistic-UI handling and the
   * actual SDK call — the input is decoupled and clears as soon as it fires.
   */
  onSend: (text: string) => void;
}

/**
 * MessageInput — composes and submits chat messages on the current interaction.
 *
 * The input itself does NOT call the SDK. It bubbles the trimmed text up via
 * {@link MessageInputProps.onSend} so the parent can append an optimistic feed
 * entry immediately (the input is cleared as soon as submission fires, giving
 * instant feedback). Errors and confirmations are surfaced through the feed
 * (spinner → tick) and the global notifications system, not through input
 * state.
 *
 * Structure:
 *   [purple-bordered container]
 *     banner row : "Messages will be sent privately"
 *     input row  : text field (Enter sends)
 *   action row (below container, outside the border):
 *                                        privacy + send pill (right)
 */
function MessageInput({ interaction, onSend }: MessageInputProps) {
  const [text, setText] = useState('');

  const canSend = interaction.canSendMessage();
  const trimmed = text.trim();
  const canSubmit = canSend && trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSend(trimmed);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const placeholder = canSend
    ? strings.interactions.messages.inputPlaceholder
    : strings.interactions.messages.disabledPlaceholder;

  return (
    <div className="bg-white p-3 space-y-2">
      <div className="rounded-md border border-[#5800B1] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border-b border-[#5800B1] text-xs italic text-purple-700">
          <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{strings.interactions.messages.privateBanner}</span>
        </div>
        <label htmlFor="message-input" className="sr-only">
          {strings.interactions.messages.inputPlaceholder}
        </label>
        <input
          id="message-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!canSend}
          placeholder={placeholder}
          className="w-full bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      <div className="flex items-center justify-end">
        <TooltipProvider delayDuration={200}>
          <div className="inline-flex items-stretch overflow-hidden rounded-md border border-[#5800B1]">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  aria-label={strings.interactions.messages.privateToggle}
                  aria-pressed="true"
                  className="inline-flex h-8 w-8 items-center justify-center bg-purple-100 text-purple-700 disabled:cursor-not-allowed"
                >
                  <VenetianMask className="w-4 h-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {strings.interactions.messages.privateBanner}
              </TooltipContent>
            </Tooltip>
            <div className="w-px bg-[#5800B1]" aria-hidden="true" />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              aria-label={strings.interactions.messages.send}
              className="inline-flex h-8 w-8 items-center justify-center bg-purple-50 text-purple-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-purple-100"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

export { MessageInput };
