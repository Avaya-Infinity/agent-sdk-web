import { Download, Loader2 } from 'lucide-react';
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
  onClose: () => void;
  onSignOut?: () => void;
  cxLoginLoading: boolean;
  handleLoginToCx: () => Promise<void>;
  handleLogoutFromCx: () => Promise<void>;
}

/**
 * AvatarDropdown Component
 * Displays user info, CX login/logout, audio device settings, and sign out options.
 * Rendered inside a Dialog for accessibility (focus trap, Escape key, ARIA).
 */
export const AvatarDropdown = ({
  user,
  onClose,
  onSignOut,
  cxLoginLoading,
  handleLoginToCx,
  handleLogoutFromCx,
}: AvatarDropdownProps) => {
  const handleCxLogin = async () => {
    await handleLoginToCx();
    onClose();
  };

  const handleCxLogout = async () => {
    await handleLogoutFromCx();
    onClose();
  };

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
      // Always release the object URL, even if a CSP-blocked synthetic click throws.
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      {/* Header with Avatar and User Info */}
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
      
      {/* CX Login/Logout Button */}
      <div className="mt-4">
        {user.isLoggedInToCx ? (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleCxLogout}
            disabled={cxLoginLoading}
          >
            {cxLoginLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
            {cxLoginLoading ? strings.userProfile.loggingOut : strings.common.logoutFromCX}
          </Button>
        ) : (
          <Button
            variant="success"
            className="w-full"
            onClick={handleCxLogin}
            disabled={cxLoginLoading}
          >
            {cxLoginLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
            {cxLoginLoading ? strings.userProfile.loggingIn : strings.common.loginToCX}
          </Button>
        )}
      </div>
      
      <Separator className="my-3" />
      
      {/* Audio Device Settings */}
      <div className="py-2">
        <div className="text-sm font-semibold text-gray-800 mb-3">
          {strings.userProfile.audioSettings}
        </div>
        <AudioDeviceSettings user={user} />
      </div>
      
      <Separator className="my-3" />

      {/* Diagnostics */}
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

      {/* Sign Out Button */}
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
