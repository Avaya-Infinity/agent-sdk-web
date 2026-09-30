import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Queue, QueueEventType, UserEventType, type User, type CreateOutboundVoiceInteractionParams } from '@avaya/infinity-agent-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { strings } from '@/locales/en';
import { createLogger, getErrorDetails } from '@/utils/logger';
import { safeUnsubscribeUser } from '@/utils/safe-unsubscribe';

const logger = createLogger('OutboundDialPanel');

interface OutboundDialPanelProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

/**
 * Create Outbound Interaction dialog: type, queue, and phone number form.
 * Calls user.createOutboundVoiceInteraction(); the SDK fires INTERACTION_CREATED
 * which MainLayout handles by adding the interaction to the active list.
 */
function OutboundDialPanel({ user, open, onOpenChange, disabled }: OutboundDialPanelProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [queueId, setQueueId] = useState<string>('');
  const [type, setType] = useState<string>('phone');
  const [isDialing, setIsDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional pre-fill fields (UC2). Empty inputs are NOT forwarded to the SDK —
  // see handleCreate. This preserves the byte-identical POST body for consumers
  // that don't supply pre-fill data (AC-9).
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerLanguageCode, setCustomerLanguageCode] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');

  // Elite Voice routes outbound calls via its own dial plan; queue selection is not used.
  const isEliteVoiceEnabled = user.isEliteVoiceEnabled;

  const [queues, setQueues] = useState(() => user.getAssignedQueues());
  const queueSubscriptionsRef = useRef<Map<string, string>>(new Map());

  const getAssignedQueues = useCallback(() => {
    const updated = user.getAssignedQueues();
    setQueues(updated);
    return updated;
  }, [user]);

  const subscribeToQueue = useCallback((queue: Queue) => {
    if (queueSubscriptionsRef.current.has(queue.queueId)) return;
    const handlerId = queue.subscribe(QueueEventType.QUEUE_STATUS_CHANGED, () => {
      getAssignedQueues();
    });
    queueSubscriptionsRef.current.set(queue.queueId, handlerId);
  }, [getAssignedQueues]);

  const unsubscribeAllQueues = useCallback((currentQueues: Queue[]) => {
    for (const [qId, hId] of queueSubscriptionsRef.current.entries()) {
      try {
        const q = currentQueues.find(queue => queue.queueId === qId);
        if (q) q.unsubscribe(QueueEventType.QUEUE_STATUS_CHANGED, hId);
      } catch { /* teardown */ }
    }
    queueSubscriptionsRef.current.clear();
  }, []);

  useEffect(() => {
    const initialQueues = getAssignedQueues();
    for (const q of initialQueues) subscribeToQueue(q);

    const cxLoggedInHandlerId = user.subscribe(UserEventType.USER_CX_LOGGED_IN, () => {
      unsubscribeAllQueues(user.getAssignedQueues());
      const updated = getAssignedQueues();
      for (const q of updated) subscribeToQueue(q);
    });
    const cxLoggedOutHandlerId = user.subscribe(UserEventType.USER_CX_LOGGED_OUT, () => {
      unsubscribeAllQueues(user.getAssignedQueues());
      const updated = getAssignedQueues();
      for (const q of updated) subscribeToQueue(q);
    });

    return () => {
      safeUnsubscribeUser(user, UserEventType.USER_CX_LOGGED_IN, cxLoggedInHandlerId);
      safeUnsubscribeUser(user, UserEventType.USER_CX_LOGGED_OUT, cxLoggedOutHandlerId);
      unsubscribeAllQueues(user.getAssignedQueues());
    };
  }, [user, getAssignedQueues, subscribeToQueue, unsubscribeAllQueues]);

  const queueOptions = useMemo(
    () => queues.filter((q) => q.isLoggedIn),
    [queues]
  );

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Reset error and form when dialog closes
  useEffect(() => {
    if (!open) {
      setError(null);
      setPhoneNumber('');
      setQueueId('');
      setType('phone');
      setIsDialing(false);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerLanguageCode('');
      setSubject('');
      setNotes('');
    }
  }, [open]);

  const handleCreate = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setError(strings.interactions.outboundDial.enterNumber);
      return;
    }
    if (!isEliteVoiceEnabled && !queueId) {
      setError(strings.interactions.outboundDial.selectQueue);
      return;
    }
    setError(null);
    setIsDialing(true);
    try {
      // Build customer pre-fill object only when at least one field is non-empty.
      // Omitting empty fields (rather than sending `name: ""`) preserves the
      // byte-identical POST body for consumers that don't supply pre-fill data
      // (AC-9 regression guarantee).
      const trimmedCustomerName = customerName.trim();
      const trimmedCustomerEmail = customerEmail.trim();
      const trimmedCustomerLanguageCode = customerLanguageCode.trim();
      const customer: NonNullable<CreateOutboundVoiceInteractionParams['customer']> = {};
      if (trimmedCustomerName) customer.name = trimmedCustomerName;
      if (trimmedCustomerEmail) customer.email = trimmedCustomerEmail;
      if (trimmedCustomerLanguageCode) customer.languageCode = trimmedCustomerLanguageCode;

      const trimmedSubject = subject.trim();
      const trimmedNotes = notes.trim();
      const details: NonNullable<CreateOutboundVoiceInteractionParams['details']> = {};
      if (trimmedSubject) details.subject = trimmedSubject;
      if (trimmedNotes) details.notes = trimmedNotes;

      const params: CreateOutboundVoiceInteractionParams = {
        phoneNumber: trimmed,
        ...(isEliteVoiceEnabled ? {} : { queueId }),
        ...(Object.keys(customer).length > 0 ? { customer } : {}),
        ...(Object.keys(details).length > 0 ? { details } : {}),
      };
      const interaction = await user.createOutboundVoiceInteraction(params);
      logger.info('Outbound call created', { interactionId: interaction.interactionId, targetType: 'external' });
      setPhoneNumber('');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Outbound dial failed', { targetType: 'external', ...getErrorDetails(err) });
      if (openRef.current) setError(message);
    } finally {
      if (openRef.current) setIsDialing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[360px] p-6 max-h-[90vh] overflow-y-auto"
        showCloseButton
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-base">
            {strings.interactions.outboundDial.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="outbound-type" className="text-sm">
              {strings.interactions.outboundDial.type}
              <span className="text-destructive ml-0.5" aria-hidden>*</span>
            </Label>
            <Select value={type} onValueChange={setType} disabled={disabled || isDialing}>
              <SelectTrigger id="outbound-type" className="text-sm h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">{strings.interactions.channels.phone}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Elite Voice routes outbound calls via its own dial plan — hide queue selector. */}
          {!isEliteVoiceEnabled && (
            <div className="space-y-1.5">
              <Label htmlFor="outbound-queue" className="text-sm">
                {strings.interactions.outboundDial.queue}
                <span className="text-destructive ml-0.5" aria-hidden>*</span>
              </Label>
              <Select
                value={queueId}
                onValueChange={setQueueId}
                disabled={disabled || isDialing}
              >
                <SelectTrigger id="outbound-queue" className="text-sm h-9 w-full">
                  <SelectValue placeholder={strings.interactions.outboundDial.selectQueue} />
                </SelectTrigger>
                <SelectContent>
                  {queueOptions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {strings.interactions.outboundDial.noQueuesLoggedIn}
                    </SelectItem>
                  ) : (
                    queueOptions.map((q) => (
                      <SelectItem key={q.queueId} value={q.queueId}>
                        {q.queueName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="outbound-phone" className="text-sm">
              {strings.interactions.outboundDial.phoneNumber}
              <span className="text-destructive ml-0.5" aria-hidden>*</span>
            </Label>
            <Input
              id="outbound-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={disabled || isDialing}
              className="text-sm"
              aria-invalid={!!error}
            />
          </div>

          {/* Optional pre-fill section — caller identity + conversation context.
              Visually subordinate to the required fields (separator + muted
              section label), implementing progressive disclosure without
              hiding inputs behind an extra click. Empty inputs are stripped
              from the POST body in handleCreate (AC-9). */}
          <Separator className="my-1" />
          <p
            className="text-[11px] uppercase tracking-wide text-muted-foreground"
            id="outbound-optional-section-label"
          >
            {strings.interactions.outboundDial.optionalSectionLabel}
          </p>

          <div
            className="space-y-3"
            role="group"
            aria-labelledby="outbound-optional-section-label"
          >
            <div className="space-y-1.5">
              <Label htmlFor="outbound-customer-name" className="text-sm">
                {strings.interactions.outboundDial.customerName}
              </Label>
              <Input
                id="outbound-customer-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={disabled || isDialing}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outbound-customer-email" className="text-sm">
                {strings.interactions.outboundDial.customerEmail}
              </Label>
              <Input
                id="outbound-customer-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                disabled={disabled || isDialing}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outbound-customer-language" className="text-sm">
                {strings.interactions.outboundDial.customerLanguageCode}
              </Label>
              <Input
                id="outbound-customer-language"
                type="text"
                value={customerLanguageCode}
                onChange={(e) => setCustomerLanguageCode(e.target.value)}
                placeholder={
                  strings.interactions.outboundDial.customerLanguageCodePlaceholder
                }
                disabled={disabled || isDialing}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outbound-subject" className="text-sm">
                {strings.interactions.outboundDial.subject}
              </Label>
              <Input
                id="outbound-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={disabled || isDialing}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outbound-notes" className="text-sm">
                {strings.interactions.outboundDial.notes}
              </Label>
              <textarea
                id="outbound-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={disabled || isDialing}
                rows={3}
                className={cn(
                  // Mirror the <Input> primitive's visual treatment so the
                  // textarea reads as part of the same form family.
                  'placeholder:text-muted-foreground border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow]',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                  'resize-y'
                )}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="button"
            variant="default"
            size="default"
            className="w-full mt-2"
            onClick={handleCreate}
            disabled={
              disabled
              || isDialing
              || !phoneNumber.trim()
              || (!isEliteVoiceEnabled && (!queueId || queueOptions.length === 0))
            }
          >
            {isDialing ? strings.interactions.outboundDial.dialing : strings.interactions.outboundDial.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { OutboundDialPanel };
