import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { strings } from '@/locales/en';

interface WebRtcAudioPermissionDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function WebRtcAudioPermissionDialog({ open, onOpenChange }: Readonly<WebRtcAudioPermissionDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[520px]" showCloseButton>
        <DialogHeader>
          <DialogTitle>{strings.audioPermissionsDialog.title}</DialogTitle>
          <DialogDescription className="text-gray-700">
            {strings.audioPermissionsDialog.blockedDescription}
          </DialogDescription>
          <DialogDescription className="text-gray-700">
            {strings.audioPermissionsDialog.instruction}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {strings.audioPermissionsDialog.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { WebRtcAudioPermissionDialog };
