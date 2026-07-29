import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { strings } from '@/locales/en';
import type { Interaction } from '@avaya/infinity-agent-sdk';

interface CustomFieldsPanelProps {
  interaction: Interaction;
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * CustomFieldsPanel
 *
 * Shows the interaction's `customFields` as a key/value table and (when the
 * agent is the owner and the interaction is in a writable status) exposes a
 * JSON textarea + Save control that calls `interaction.mergeCustomFields(...)`.
 *
 * Server deep-merges the payload, so partial writes preserve existing keys.
 * The panel hides entirely when there's nothing to display and the agent
 * can't write (e.g. viewer monitoring).
 */
function CustomFieldsPanel({ interaction }: CustomFieldsPanelProps) {
  const fields = interaction.customFields;
  const entries = Object.entries(fields);
  const canEdit = interaction.canMergeCustomFields();
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  const handleSave = async () => {
    setParseError(null);
    const trimmed = draft.trim();
    if (!trimmed) {
      setParseError('Provide JSON, e.g. {"caseId":"C-001"}');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      setParseError('Invalid JSON: ' + (err instanceof Error ? err.message : String(err)));
      return;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setParseError('Must be a JSON object (not null/array/scalar).');
      return;
    }
    setIsSaving(true);
    try {
      await interaction.mergeCustomFields(parsed as Record<string, unknown>);
      setDraft('');
      addNotification({
        id: `custom-fields-saved-${interaction.interactionId}-${Date.now()}`,
        level: 'success',
        title: strings.interactions.customFields.saveSuccess,
      });
    } catch {
      addNotification({
        id: `custom-fields-save-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.customFields.saveError,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Hide entirely when nothing to show and the agent can't write.
  if (entries.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        {strings.interactions.customFields.title}
      </h3>

      {entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3 text-muted-foreground">
                {strings.interactions.customFields.keyHeader}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {strings.interactions.customFields.valueHeader}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="font-medium text-foreground align-top whitespace-normal break-words">
                  {key}
                </TableCell>
                <TableCell className="text-foreground align-top whitespace-normal break-words font-mono text-xs">
                  {formatValue(value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-gray-500 mb-3">
          {strings.interactions.customFields.empty}
        </p>
      )}

      {canEdit && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label
            htmlFor={`custom-fields-input-${interaction.interactionId}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            {strings.interactions.customFields.editLabel}
          </label>
          <textarea
            id={`custom-fields-input-${interaction.interactionId}`}
            value={draft}
            disabled={isSaving}
            onChange={(e) => {
              setDraft(e.target.value);
              if (parseError) setParseError(null);
            }}
            placeholder={strings.interactions.customFields.placeholder}
            className="w-full h-[80px] px-3 py-2 text-xs font-mono text-gray-900 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {parseError ? (
            <p className="text-xs text-red-600 mt-1">{parseError}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              {strings.interactions.customFields.hint}
            </p>
          )}
          <div className="flex justify-end mt-2">
            <Button
              disabled={!draft.trim() || isSaving}
              onClick={handleSave}
              size="sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />}
              {strings.interactions.customFields.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CustomFieldsPanel };
