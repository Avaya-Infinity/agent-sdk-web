import { useState } from 'react';
import type { User } from '@avaya/infinity-agent-sdk';
import { useUserStatus } from '@/hooks/useUserStatus';
import { useCxLogin } from '@/hooks/useCxLogin';
import { UserAvatar } from './UserAvatar';
import { StatusBadge } from './StatusBadge';
import { AvatarDropdown } from './AvatarDropdown';
import { StatusDropdown } from './StatusDropdown';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { LogoutReasonDialog } from '@/components/shared/LogoutReasonDialog';
import { strings } from '@/locales/en';

interface UserProfileProps {
  user: User;
  onSignOut?: () => void;
}

/**
 * UserProfile Component
 * 
 * Displays user information, current status, and provides
 * controls to change the agent's availability status.
 */
function UserProfile({ user, onSignOut }: UserProfileProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);

  const statusHook = useUserStatus(user);
  const cxLoginHook = useCxLogin(user, () => setShowAvatarDropdown(false));

  return (
    <>
      {/* User Profile with Status */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs font-medium text-gray-700 max-w-[108px] truncate">
            {user.userFullName || user.userEmail}
          </div>
          <StatusBadge
            status={statusHook.currentStatus}
            isLoggedInToCx={user.isLoggedInToCx}
            onClick={() => setShowStatusDropdown(true)}
          />
        </div>
        
        {/* User Avatar with Initials */}
        <UserAvatar 
          fullName={user.userFullName}
          onClick={() => setShowAvatarDropdown(true)}
        />
      </div>

      {/* Avatar Dropdown Dialog */}
      <Dialog open={showAvatarDropdown} onOpenChange={setShowAvatarDropdown}>
        <DialogContent position="top-right" className="w-[320px] max-h-[80vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>{strings.userProfile.profileMenu}</DialogTitle>
          </VisuallyHidden>
          <AvatarDropdown 
            user={user}
            onClose={() => setShowAvatarDropdown(false)}
            onSignOut={onSignOut}
            {...cxLoginHook}
          />
        </DialogContent>
      </Dialog>

      {/* CX Logout Reason Dialog */}
      <LogoutReasonDialog
        open={cxLoginHook.logoutReasonPicker.open}
        reasons={cxLoginHook.logoutReasonPicker.reasons}
        loading={cxLoginHook.logoutReasonPicker.loading}
        onConfirm={cxLoginHook.logoutReasonPicker.onConfirm}
        onCancel={cxLoginHook.logoutReasonPicker.onCancel}
        position="top-right"
      />

      {/* Status Dropdown Dialog */}
      <Dialog open={showStatusDropdown} onOpenChange={setShowStatusDropdown}>
        <DialogContent position="top-right" className="w-[280px] p-5">
          <DialogTitle className="text-base font-semibold text-gray-800 mb-4">
            {strings.userProfile.changeStatus}
          </DialogTitle>
          <StatusDropdown
            onClose={() => setShowStatusDropdown(false)}
            {...statusHook}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UserProfile;
