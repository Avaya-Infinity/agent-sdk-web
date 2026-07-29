import { useState, useRef } from 'react';
import type { Interaction } from '@avaya/infinity-agent-sdk';
import { CustomerHeader } from './CustomerHeader';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { strings } from '@/locales/en';
import { Pencil, X, Loader2 } from 'lucide-react';

interface CustomerDetailsPanelProps {
  interaction?: Interaction;
}

/**
 * CustomerDetailsPanel Component
 *
 * Displays customer information including contact details.
 * Supports inline editing of Name, Phone, Email, and Language when the agent
 * is the interaction owner and the interaction is in a valid state. Each field
 * saves individually on blur, matching core-agent-ui behavior. The Language
 * input accepts a BCP-47 string (e.g. "en-US"); the server validates and
 * rejects unrecognized values, which surface as toast notifications.
 *
 * Subject is rendered as an always-visible inline input that saves on blur
 * when `interaction.canSetSubject()` is true; otherwise the input is disabled
 * and a tooltip explains the gating rule.
 */
function CustomerDetailsPanel({ interaction }: CustomerDetailsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  // Track local edit values so blur can diff against server state
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const languageRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  if (!interaction) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500 text-center">
          Select an interaction to view customer details
        </p>
      </div>
    );
  }

  const customer = interaction.customer;
  const canEdit = customer.canEdit();
  const canEditSubject = interaction.canSetSubject();
  const customerName = customer.name?.length > 0 ? customer.name : 'Guest';
  const initials = customerName.split(' ').map((n) => n[0]).join('');
  const t = strings.interactions.customer;

  const handleBlur = async (field: 'name' | 'phone' | 'email' | 'language', value: string) => {
    // Resolve the current server value; language lives under a different key on Customer.
    const currentValue =
      field === 'language' ? (customer.languageCode ?? '') : customer[field];
    if (value === currentValue) return;

    setSavingField(field);
    try {
      if (field === 'name') {
        await customer.setName(value);
      } else if (field === 'phone') {
        await customer.setPhone(value);
      } else if (field === 'email') {
        await customer.setEmail(value);
      } else if (field === 'language') {
        await customer.setLanguageCode(value);
      }
    } catch (error) {
      // Revert input to server value on failure
      if (field === 'name' && nameRef.current) nameRef.current.value = customer.name;
      if (field === 'phone' && phoneRef.current) phoneRef.current.value = customer.phone;
      if (field === 'email' && emailRef.current) emailRef.current.value = customer.email;
      if (field === 'language' && languageRef.current) languageRef.current.value = customer.languageCode ?? '';
      addNotification({
        id: `customer-${field}-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: t.updateFailed(t[field]),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingField(null);
    }
  };

  const handleSubjectBlur = async (value: string) => {
    // No-op when nothing changed (saves an unnecessary PUT and matches the customer-info pattern)
    const currentValue = interaction.subject ?? '';
    if (value === currentValue) return;

    setSavingField('subject');
    try {
      await interaction.setSubject(value);
    } catch (error) {
      // Revert input to server value on failure
      if (subjectRef.current) subjectRef.current.value = interaction.subject ?? '';
      addNotification({
        id: `subject-failed-${interaction.interactionId}-${Date.now()}`,
        level: 'error',
        title: t.updateFailed(t.subject),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingField(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset inputs to server values
    if (nameRef.current) nameRef.current.value = customer.name;
    if (phoneRef.current) phoneRef.current.value = customer.phone;
    if (emailRef.current) emailRef.current.value = customer.email;
    if (languageRef.current) languageRef.current.value = customer.languageCode ?? '';
  };

  const editableFields = [
    { key: 'name' as const, label: t.name, value: customer.name, ref: nameRef, placeholder: undefined as string | undefined },
    { key: 'phone' as const, label: t.phone, value: customer.phone, ref: phoneRef, placeholder: undefined as string | undefined },
    { key: 'email' as const, label: t.email, value: customer.email, ref: emailRef, placeholder: undefined as string | undefined },
    { key: 'language' as const, label: t.language, value: customer.languageCode ?? '', ref: languageRef, placeholder: t.languagePlaceholder as string | undefined },
  ];

  const isSavingSubject = savingField === 'subject';
  const subjectInputDisabled = !canEditSubject || isSavingSubject;

  // The subject input itself; wrapped in a Tooltip below when disabled so the
  // agent understands why the field is unresponsive. The on-blur handler
  // mirrors the customer-field pattern (diff against server, revert on error,
  // toast on failure).
  const subjectInput = (
    <div className="relative">
      <Input
        ref={subjectRef}
        // `key` ensures the uncontrolled input re-mounts with a fresh
        // defaultValue whenever the server-side subject changes (e.g. another
        // agent updated it, or the user switched interactions).
        key={`subject-${interaction.interactionId}-${interaction.subject ?? ''}`}
        defaultValue={interaction.subject ?? ''}
        onBlur={(e) => handleSubjectBlur(e.target.value)}
        disabled={subjectInputDisabled}
        aria-disabled={subjectInputDisabled}
        aria-label={t.subject}
        placeholder={t.subjectPlaceholder}
        className={cn(
          'h-7 text-[13px] pr-7',
          subjectInputDisabled && 'cursor-not-allowed'
        )}
      />
      {isSavingSubject && (
        <Loader2
          className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <CustomerHeader name={customerName} initials={initials} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
            {t.contactInformation}
          </h4>
          {canEdit && (
            <button
              type="button"
              onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
              aria-label={isEditing ? t.cancel : t.edit}
            >
              {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </button>
          )}
        </div>

        <dl className="space-y-3">
          {editableFields.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <dt className="text-[13px] text-gray-500 w-20 shrink-0">{field.label}</dt>
              <dd className="text-[13px] text-gray-900 break-all flex-1">
                {isEditing ? (
                  <div className="relative">
                    <Input
                      ref={field.ref}
                      defaultValue={field.value}
                      placeholder={field.placeholder}
                      onBlur={(e) => handleBlur(field.key, e.target.value)}
                      className="h-7 text-[13px] pr-7"
                      disabled={savingField === field.key}
                    />
                    {savingField === field.key && (
                      <Loader2 className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>
                ) : (
                  field.value || '—'
                )}
              </dd>
            </div>
          ))}

          {/* Subject — always-visible inline input. Editable when
              canSetSubject() is true; disabled with explanatory tooltip
              otherwise. On-blur PUT mirrors the customer-info pattern. */}
          <div className="flex items-center gap-2">
            <dt className="text-[13px] text-gray-500 w-20 shrink-0">{t.subject}</dt>
            <dd className="text-[13px] text-gray-900 break-all flex-1">
              {!canEditSubject ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Wrapping span ensures the tooltip trigger receives
                        pointer events even when the inner Input is disabled
                        (disabled form controls do not dispatch hover events). */}
                    <span className="block">{subjectInput}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    {t.subjectDisabledTooltip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                subjectInput
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export { CustomerDetailsPanel };
