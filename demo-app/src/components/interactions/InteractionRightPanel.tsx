import { useEffect, useState } from 'react';
import { type Interaction, type Message } from '@avaya/infinity-agent-sdk';
import { cn } from '@/lib/utils';
import { strings } from '@/locales/en';
import { MessagePanel } from './MessagePanel';
import { TransferPanel } from './TransferPanel';

type RightPanelTab = 'messages' | 'transfers';

interface InteractionRightPanelProps {
  interaction: Interaction;
  messages: Message[];
  currentUserId: string;
  /** Invoked from the message-input when the agent submits text. */
  onSendMessage: (text: string) => void;
  /** True while the next older batch is being fetched from the server. */
  historyLoading: boolean;
  /** True when more older messages may still exist on the server. */
  hasMoreHistory: boolean;
  /** Last history-load error message, if any. */
  historyError?: string;
  /** Invoked when the feed wants the next older batch (scroll-up or retry). */
  onLoadOlderHistory: () => void;
  /**
   * True whenever the Transfers tab should be available — typically when the user
   * has explicitly opened the panel OR when an attended transfer is in progress.
   * The parent computes this so this component does not duplicate TransferPanel's
   * visibility rules.
   */
  transfersTabAvailable: boolean;
  /** True when the user explicitly requested the Transfer panel via the Transfer button. */
  transferUserRequestedOpen: boolean;
  /** Invoked when the Transfer panel closes (e.g. user clicked close inside TransferPanel). */
  onTransferClose: () => void;
}

/**
 * InteractionRightPanel
 *
 * Shows the Messages feed by default. When the user requests a transfer (or one is
 * already in progress), the Transfers tab becomes available and is auto-selected;
 * the user can then swap back to Messages without losing transfer state.
 *
 * Mirrors the design where tabs are only visible once both panels are relevant —
 * with only one panel available, no tab strip is rendered.
 */
function InteractionRightPanel({
  interaction,
  messages,
  currentUserId,
  onSendMessage,
  historyLoading,
  hasMoreHistory,
  historyError,
  onLoadOlderHistory,
  transfersTabAvailable,
  transferUserRequestedOpen,
  onTransferClose,
}: InteractionRightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('messages');

  // Auto-switch to Transfers when the user requests it; switch back to Messages
  // when transfers are no longer available so the messages feed stays accessible.
  useEffect(() => {
    if (transfersTabAvailable) {
      setActiveTab('transfers');
    } else {
      setActiveTab('messages');
    }
  }, [transfersTabAvailable]);

  return (
    // Tab strip and content card are independent siblings now: the tab strip
    // floats above with its own rounded outline, and the content card below
    // is a separate card with no tab strip inside it.
    <div className="flex flex-col h-full min-h-0 gap-3">
      {transfersTabAvailable && (
        <div
          role="tablist"
          className="flex w-full items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1 shrink-0"
        >
          <TabButton
            label={strings.interactions.messages.tabLabel}
            isActive={activeTab === 'messages'}
            onClick={() => setActiveTab('messages')}
          />
          <TabButton
            label={strings.interactions.messages.transfersTabLabel}
            isActive={activeTab === 'transfers'}
            onClick={() => setActiveTab('transfers')}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Messages tab — keep mounted so message state persists across tab switches. */}
        <div
          role="tabpanel"
          aria-label={strings.interactions.messages.tabLabel}
          className={cn(
            'h-full min-h-0 overflow-hidden',
            activeTab === 'messages' ? 'flex flex-col' : 'hidden'
          )}
        >
          <MessagePanel
            interaction={interaction}
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={onSendMessage}
            historyLoading={historyLoading}
            hasMoreHistory={hasMoreHistory}
            historyError={historyError}
            onLoadOlderHistory={onLoadOlderHistory}
          />
        </div>

        {/* Transfers tab — only mounted when available. */}
        {transfersTabAvailable && (
          <div
            role="tabpanel"
            aria-label={strings.interactions.messages.transfersTabLabel}
            className={cn(
              'h-full min-h-0 overflow-hidden',
              activeTab === 'transfers' ? 'flex flex-col' : 'hidden'
            )}
          >
            <TransferPanel
              interaction={interaction}
              userRequestedOpen={transferUserRequestedOpen}
              onClose={onTransferClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-sm px-3 py-1 text-sm font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      )}
    >
      {label}
    </button>
  );
}

export { InteractionRightPanel };
