import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';
import type { Interaction } from '@avaya/infinity-agent-sdk';

interface AgentNotesPanelProps {
  interaction: Interaction;
  initialNotes: string;
  onSave: (notes: string) => Promise<void>;
}

/**
 * AgentNotesPanel Component
 *
 * Allows agents to add and save notes for the current interaction.
 * Features a textarea with save functionality.
 */
function AgentNotesPanel({ interaction, initialNotes, onSave }: AgentNotesPanelProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(notes);
      addNotification({
        id: `notes-saved-${interaction.interactionId}-${Date.now()}`,
        level: 'success',
        title: strings.interactions.notes.saveSuccess,
      });
    } catch {
      addNotification({
        id: `notes-save-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.notes.saveError,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <label
        htmlFor="agent-notes"
        className="block text-sm font-semibold text-gray-900 mb-3"
      >
        {strings.interactions.notes.title}
      </label>

      <textarea
        id="agent-notes"
        value={notes}
        disabled={!interaction.canSetNotes() || isSaving}
        onChange={handleChange}
        placeholder={strings.interactions.notes.placeholder}
        className="w-full h-[120px] px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        aria-describedby="notes-help"
      />
      <span id="notes-help" className="sr-only">
        Add notes about this interaction
      </span>

      <div className="flex justify-end mt-3">
        <Button
          disabled={!interaction.canSetNotes() || isSaving || notes === initialNotes}
          onClick={handleSave}
          size="sm"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
          {strings.interactions.notes.save}
        </Button>
      </div>
    </div>
  );
}

export { AgentNotesPanel };
