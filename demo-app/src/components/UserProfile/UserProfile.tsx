import { useState } from 'react';
import type { User } from '@avaya/infinity-agent-sdk';
import { useUserStatus } from '@/hooks/useUserStatus';
import { useCxLogin } from '@/hooks/useCxLogin';
import { ProfileChip } from './ProfileChip';
import { AvatarDropdown } from './AvatarDropdown';
import { CxMenu } from '@/components/shared/CxMenu';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { strings } from '@/locales/en';

interface UserProfileProps {
  user: User;
  onSignOut?: () => void;
}

/**
 * UserProfile Component
 *
 * Header controls: CxMenu (login, change status, logout), divider, and ProfileChip (identity + read-only status).
 */
function UserProfile({ user, onSignOut }: UserProfileProps) {
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [cxMenuOpen, setCxMenuOpen] = useState(false);

  const statusHook = useUserStatus(user);
  const cxLoginHook = useCxLogin(user, {
    onSuccess: () => setCxMenuOpen(false),
    isCxMenuOpen: cxMenuOpen,
  });

  return (
    <>
      <div className="flex items-center gap-3">
        <CxMenu
          user={user}
          open={cxMenuOpen}
          onOpenChange={setCxMenuOpen}
          currentStatus={statusHook.currentStatus}
          statusReasonCodes={statusHook.reasonCodes}
          statusChangeLoading={statusHook.statusChangeLoading}
          onChangeStatus={statusHook.changeStatus}
          {...cxLoginHook}
        />

        <Separator
          orientation="vertical"
          className="h-8"
          decorative
          aria-hidden="true"
        />

        <ProfileChip
          fullName={user.userFullName}
          email={user.userEmail}
          status={statusHook.currentStatus}
          isLoggedInToCx={user.isLoggedInToCx}
          onProfileMenuClick={() => setShowAvatarDropdown(true)}
        />
      </div>

      <Dialog open={showAvatarDropdown} onOpenChange={setShowAvatarDropdown}>
        <DialogContent
          position="top-right"
          className="w-[320px] max-h-[80vh] overflow-y-auto"
          onPointerDownOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[role="listbox"]')) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[role="listbox"]')) {
              event.preventDefault();
            }
          }}
        >
          <VisuallyHidden>
            <DialogTitle>{strings.userProfile.profileMenu}</DialogTitle>
          </VisuallyHidden>
          <AvatarDropdown
            user={user}
            onSignOut={onSignOut}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UserProfile;
