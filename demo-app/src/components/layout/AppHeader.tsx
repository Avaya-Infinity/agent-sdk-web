import type { User } from '@avaya/infinity-agent-sdk';
import { UserProfile } from '@/components/UserProfile';
import { WebSocketConnectionIndicator } from './WebSocketConnectionIndicator';
import { WebRtcRegistrationIndicator } from './WebRtcRegistrationIndicator';

interface AppHeaderProps {
  user: User;
  onSignOut?: () => void;
}

/**
 * AppHeader Component
 * 
 * Application header with logo and user profile.
 * Consistent across all pages.
 */
function AppHeader({ user, onSignOut }: AppHeaderProps) {
  return (
    <header className="h-[58px] bg-white border-b border-gray-300 flex justify-between items-center px-3 shrink-0">
      <div className="flex items-center gap-4">
        {/* AVAYA Logo */}
        <div className="flex items-center">
          <svg width="100" height="40" viewBox="10 5 130 50" fill="none" role="img" aria-label="Avaya">
            <title>Avaya Logo</title>
            <path 
              d="M87.6718 16.105L96.3928 35.927L105.862 16.105H110.826L93.7918 50.105H89.0318L93.9278 40.823L82.6908 16.105H87.6718ZM121.859 16.105L134.201 40.823H129.22L120.125 21.732L114.413 33.802H122.76L124.12 37.066H112.832L111.047 40.823H106.066L118.408 16.105H121.859ZM27.5938 16.105L39.9358 40.823H34.9718L25.8768 21.732L20.1478 33.802H28.4948L29.8548 37.066H18.5838L16.7818 40.823H11.8008L24.1428 16.105H27.5938ZM74.5478 16.105L86.8898 40.823H81.9088L72.8308 21.732L67.1018 33.802H75.4658L76.8088 37.066H65.5378L63.7358 40.823H58.7548L71.0968 16.105H74.5478ZM40.2588 16.105L49.3538 35.553L58.4488 16.105H63.4298L51.0878 40.823H47.6368L35.2948 16.105H40.2588Z" 
              fill="#DA291C"
            />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <WebRtcRegistrationIndicator user={user} />
        <WebSocketConnectionIndicator />
        <UserProfile user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

export { AppHeader };
