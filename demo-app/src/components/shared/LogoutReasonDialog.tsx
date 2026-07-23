import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ReasonCode } from '@avaya/infinity-agent-sdk';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { strings } from '@/locales/en';

interface LogoutReasonDialogProps {
  open: boolean;
  reasons: ReasonCode[];
  onConfirm: (reason: ReasonCode) => void;
  onCancel: () => void;
  loading?: boolean;
  position?: 'center' | 'top-right';
}

export const LogoutReasonDialog = ({
  open,
  reasons,
  onConfirm,
  onCancel,
  loading = false,
  position = 'center',
}: LogoutReasonDialogProps) => {
  const [selectedIndex, setSelectedIndex] = useState('');

  useEffect(() => {
    if (open) setSelectedIndex('');
  }, [open]);

  const handleReasonSelect = (value: string) => {
    setSelectedIndex(value);
    const idx = parseInt(value, 10);
    if (!isNaN(idx) && reasons[idx]) {
      onConfirm(reasons[idx]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading) onCancel(); }}>
      <DialogContent className="w-[320px]" position={position}>
        <DialogHeader>
          <DialogTitle>{strings.logoutReasonDialog.title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {reasons.length > 0 ? (
            <Select value={selectedIndex} onValueChange={handleReasonSelect} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={strings.logoutReasonDialog.selectReason} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {r.reason ?? r.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-gray-500">{strings.logoutReasonDialog.noReasons}</p>
          )}
        </div>
        <DialogFooter>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              {strings.logoutReasonDialog.loggingOut}
            </div>
          ) : (
            <Button variant="outline" onClick={onCancel}>
              {strings.common.cancel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
