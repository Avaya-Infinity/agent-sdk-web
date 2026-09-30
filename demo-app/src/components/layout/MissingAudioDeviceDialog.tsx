import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MediaDeviceKind } from '@avaya/infinity-agent-sdk';
import { strings } from '@/locales/en';

interface MissingAudioDeviceDialogProps {
  open: boolean;
  missingDeviceKinds: MediaDeviceKind[];
  onDismiss: () => void;
}

function getDialogCopy(missingDeviceKinds: MediaDeviceKind[]) {
  const missingInput = missingDeviceKinds.includes(MediaDeviceKind.AUDIO_INPUT);
  const missingOutput = missingDeviceKinds.includes(MediaDeviceKind.AUDIO_OUTPUT);
  if (missingInput && missingOutput) return strings.missingAudioDeviceDialog.both;
  if (missingInput) return strings.missingAudioDeviceDialog.microphone;
  if (missingOutput) return strings.missingAudioDeviceDialog.speaker;
  return null;
}

function MissingAudioDeviceDialog({
  open,
  missingDeviceKinds,
  onDismiss,
}: Readonly<MissingAudioDeviceDialogProps>) {
  const currentCopy = getDialogCopy(missingDeviceKinds);
  const lastValidCopy = useRef(currentCopy);

  useEffect(() => {
    if (currentCopy) lastValidCopy.current = currentCopy;
  }, [currentCopy]);

  const copy = currentCopy ?? lastValidCopy.current;
  if (!copy) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onDismiss(); }}>
      <DialogContent className="w-[90vw] max-w-[520px]" showCloseButton>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="space-y-2 text-foreground">
            <span className="block">{copy.description}</span>
            <span className="block">{strings.missingAudioDeviceDialog.instruction}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDismiss}>
            {strings.missingAudioDeviceDialog.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MissingAudioDeviceDialog };
