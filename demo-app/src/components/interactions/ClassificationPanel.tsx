import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { strings } from '@/locales/en';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Interaction, ClassificationCode } from '@avaya/infinity-agent-sdk';

interface ClassificationPanelProps {
  interaction: Interaction;
  onSaveType: (classification: ClassificationCode) => void | Promise<void>;
  onSaveResult: (classification: ClassificationCode) => void | Promise<void>;
}

/**
 * ClassificationPanel Component
 *
 * Allows agents to set Interaction Type and End Result classification codes.
 * Options come from queue configuration; auto-saves on selection change.
 */
function ClassificationPanel({ interaction, onSaveType, onSaveResult }: ClassificationPanelProps) {
  const [isSavingType, setIsSavingType] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const { addNotification } = useNotifications();

  const queueDetails = interaction.queueDetails;
  const disabled = !interaction.canSetClassification();

  const typeOptions = queueDetails.classificationTypes ?? [];
  const resultOptions = queueDetails.classificationResults ?? [];

  if (typeOptions.length === 0 && resultOptions.length === 0) {
    return null;
  }

  const formatOptionLabel = (option: ClassificationCode) =>
    option.eliteWorkCode ? `${option.name} (${option.eliteWorkCode})` : option.name;

  const handleTypeChange = async (value: string) => {
    const selected = typeOptions.find((opt) => opt.name === value);
    if (!selected) return;
    setIsSavingType(true);
    try {
      await onSaveType({ name: selected.name, eliteWorkCode: selected.eliteWorkCode });
    } catch {
      addNotification({
        id: `classification-type-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.classification.saveTypeError,
      });
    } finally {
      setIsSavingType(false);
    }
  };

  const handleResultChange = async (value: string) => {
    const selected = resultOptions.find((opt) => opt.name === value);
    if (!selected) return;
    setIsSavingResult(true);
    try {
      await onSaveResult({ name: selected.name, eliteWorkCode: selected.eliteWorkCode });
    } catch {
      addNotification({
        id: `classification-result-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: strings.interactions.classification.saveResultError,
      });
    } finally {
      setIsSavingResult(false);
    }
  };

  const t = strings.interactions.classification;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <span className="block text-sm font-semibold text-gray-900">
        {t.title}
      </span>

      {typeOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="classification-type" className="text-xs font-medium text-gray-600">
              {t.interactionType}
            </label>
            {isSavingType && <Loader2 className="w-3 h-3 animate-spin text-gray-400" aria-hidden="true" />}
          </div>
          <Select
            value={interaction.classificationType?.name ?? ''}
            onValueChange={handleTypeChange}
            disabled={disabled || isSavingType}
          >
            <SelectTrigger id="classification-type" aria-label={t.interactionType}>
              <SelectValue placeholder={t.selectType} />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {formatOptionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {resultOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="classification-result" className="text-xs font-medium text-gray-600">
              {t.endResult}
            </label>
            {isSavingResult && <Loader2 className="w-3 h-3 animate-spin text-gray-400" aria-hidden="true" />}
          </div>
          <Select
            value={interaction.classificationResult?.name ?? ''}
            onValueChange={handleResultChange}
            disabled={disabled || isSavingResult}
          >
            <SelectTrigger id="classification-result" aria-label={t.endResult}>
              <SelectValue placeholder={t.selectResult} />
            </SelectTrigger>
            <SelectContent>
              {resultOptions.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {formatOptionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export { ClassificationPanel };
