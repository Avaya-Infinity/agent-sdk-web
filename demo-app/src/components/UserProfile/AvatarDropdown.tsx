import { Download } from 'lucide-react';
import type { User } from '@avaya/infinity-agent-sdk';
import { AvayaInfinityAgentSdk } from '@avaya/infinity-agent-sdk';
import { UserAvatar } from './UserAvatar';
import { AudioDeviceSettings } from './AudioDeviceSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { strings } from '@/locales/en';

interface AvatarDropdownProps {
  user: User;
  onSignOut?: () => void;
}

/**
 * AvatarDropdown Component
 * Displays user info, audio device settings, diagnostics, and sign out.
 * CX login/logout lives in the header {@link CxMenu} instead.
 */
export const AvatarDropdown = ({
  user,
  onSignOut,
}: AvatarDropdownProps) => {
  const handleDownloadLogs = () => {
    const blob = AvayaInfinityAgentSdk.exportLogs();
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = strings.userProfile.downloadLogsFilename(timestamp);
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <UserAvatar fullName={user.userFullName} size="lg" />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-semibold text-gray-800 truncate">
              {user.userFullName}
            </div>
            {user.isEliteVoiceEnabled && (
              <Badge
                variant="accent"
                className="shrink-0 px-1.5 py-0 text-[9px] uppercase tracking-wide"
                aria-label={strings.userProfile.hybridAgentAriaLabel}
              >
                {strings.userProfile.hybridAgent}
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {user.userEmail}
          </div>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="py-2">
        <div className="text-sm font-semibold text-gray-800 mb-3">
          {strings.userProfile.audioSettings}
        </div>
        <AudioDeviceSettings user={user} />
      </div>

      <Separator className="my-3" />

      <div className="py-2">
        <div className="text-sm font-semibold text-gray-800 mb-3">
          {strings.userProfile.diagnostics}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleDownloadLogs}
        >
          <Download className="w-4 h-4 mr-2" aria-hidden="true" />
          {strings.userProfile.downloadLogs}
        </Button>
      </div>

      <Separator className="my-3" />

      <div>
        <Button
          variant="outline"
          className="w-full"
          onClick={onSignOut}
        >
          {strings.common.signOut}
        </Button>
      </div>
    </>
  );
};
