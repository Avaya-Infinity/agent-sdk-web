import { useState, useEffect } from 'react';
import { AvayaInfinityAgentSdk, LogLevel, OAuthMode, SdkEventType, UserEventType } from '@avaya/infinity-agent-sdk';import type { User } from '@avaya/infinity-agent-sdk';
import SdkManager from './sdk-manager';
import Settings, { type Config } from './Settings';
import Agent from './Agent';
import { strings } from '@/locales/en';
import type { SdkInitializationFailedEvent } from '@avaya/infinity-agent-sdk';
import { createLogger, getErrorDetails } from '@/utils/logger';

const logger = createLogger('App');

/**
 * App Component
 * 
 * Main entry point for the Avaya Infinity Agent SDK demo application.
 * This demo shows how 3rd party developers can build a custom agent interface
 * using the Agent SDK.
 * 
 * Flow:
 * 1. User enters configuration (host, clientId) in Settings
 * 2. SDK initializes and redirects to OAuth
 * 3. After successful auth, Agent screen is displayed
 */
function App() {
  // Check if this is an OAuth redirect callback
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthRedirect = urlParams.has('code') || urlParams.has('error');

  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Handle OAuth redirect or first-login on component mount.
  //
  // Tokens are held in memory only, so a hard reload always starts from no session.
  // We auto-initialise only when it is safe to do so without a user gesture:
  //  - Completing an OAuth redirect round-trip (URL has code/error): no gesture needed.
  //  - Redirect mode: a full-page redirect to the IdP needs no user gesture.
  // In popup mode with no active session we must NOT auto-initialise — init() would
  // call window.open() outside a user gesture and the popup would be blocked
  // (ASIE_AUTH_0003). Instead we fall through to the Settings screen, whose submit
  // button provides the required user-gesture "Sign in" surface.
  useEffect(() => {
    const savedConfig = sessionStorage.getItem('sdkConfig');
    if (savedConfig) {
      const config: Config = JSON.parse(savedConfig);
      const popupMode = (config.oAuthMode ?? OAuthMode.REDIRECT) === OAuthMode.POPUP;
      if (isOAuthRedirect || !popupMode) {
        // Safe to initialise without a user gesture.
        setIsInitializing(true);
        initSdk(config);
      }
      // Popup mode with no redirect in progress: render Settings and let the user
      // click "Sign in" to initialise from within the click handler.
    } else if (isOAuthRedirect) {
      // OAuth redirect but no saved config - this shouldn't happen
      setError(strings.settings.configNotFound);
    }
    // This is a one-time bootstrap effect — it MUST run exactly once on mount.
    // We intentionally read isOAuthRedirect from the mount-time URL and do NOT
    // make it a dependency: init() cleans `code`/`error` from the URL (via
    // history.replaceState), which would flip isOAuthRedirect to false and re-fire
    // this effect. On an OAuth error that re-fire would restart init() and redirect
    // to the IdP, hiding the error and risking a redirect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const sessionDestroyedId = AvayaInfinityAgentSdk.subscribe(
        SdkEventType.SESSION_DESTROYED,
        (event) => {
            logger.info('Session destroyed');
            setAuthenticated(false);
            setUser(null);
            setError(`Your session was terminated by the server. Error: ${event.payload.errorMessage}`);
            SdkManager.reset();
        }
    );
    const tokenRefreshFailedId = AvayaInfinityAgentSdk.subscribe(
        SdkEventType.TOKEN_REFRESH_FAILED,
        (event) => {
            logger.error('Token refresh failed');
            setAuthenticated(false);
            setUser(null);
            setError(`Your session has expired. Please sign in again. Error: ${event.payload.errorMessage}`);
            SdkManager.reset();
        }
    );
    const initFailedId = AvayaInfinityAgentSdk.subscribe(
        SdkEventType.INITIALIZATION_FAILED,
        (event: SdkInitializationFailedEvent) => {
            logger.error('SDK initialization failed event', getErrorDetails(event.payload.error));
            setError(`Initialization failed: ${event.payload.error.message}`);
            setIsInitializing(false);
            SdkManager.reset();
        }
    );
    const userLogoutId = AvayaInfinityAgentSdk.subscribe(
      UserEventType.USER_LOGOUT,
      () => {
        logger.info('User logged out');
          setAuthenticated(false);
          setUser(null);
          setError("You have been logged out.");
          SdkManager.reset();
      }
  );

    return () => {
        AvayaInfinityAgentSdk.unsubscribe(SdkEventType.SESSION_DESTROYED, sessionDestroyedId);
        AvayaInfinityAgentSdk.unsubscribe(SdkEventType.TOKEN_REFRESH_FAILED, tokenRefreshFailedId);
        AvayaInfinityAgentSdk.unsubscribe(SdkEventType.INITIALIZATION_FAILED, initFailedId);
        AvayaInfinityAgentSdk.unsubscribe(UserEventType.USER_LOGOUT, userLogoutId);
    };
}, []);
  /**
   * Initialize the SDK with the provided configuration
   */
  const initSdk = async (config: Config) => {
    try {
      logger.info('SDK initialization started');
      setError(null);
      setIsInitializing(true);
      
      const oAuthMode = config.oAuthMode ?? OAuthMode.REDIRECT;
      const userInstance = await SdkManager.initialize({
        avayaInfinityHost: config.avayaInfinityHost,
        clientId: config.clientId,
        oAuthRedirectUri: oAuthMode === OAuthMode.POPUP
          ? `${config.redirectUri}/callback.html`
          : config.redirectUri,
        oAuthMode,
        ...(config.idpHint ? { idpHint: config.idpHint } : {}),
        logLevel: LogLevel.DEBUG,
      });

      setUser(userInstance);
      setAuthenticated(true);
      logger.info('SDK initialization completed');
      
      // Clean up URL after successful authentication
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      logger.error('SDK initialization failed', getErrorDetails(err));
      setError(err instanceof Error ? err.message : strings.common.error);
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Handle configuration form submission
   */
  const handleSettingsSubmit = (config: Config) => {
    if (!config.avayaInfinityHost || !config.clientId) {
      setError(strings.settings.fillAllFields);
      return;
    }

    // Persist non-secret SDK config (host, clientId, oAuthMode) so it survives the
    // OAuth redirect round-trip. Use sessionStorage, not localStorage: it is tab-scoped
    // and cleared on tab close.
    //
    // SECURITY: Web storage (localStorage AND sessionStorage) is readable by any script
    // running in this page's origin — a single XSS or compromised dependency can read all
    // of it. NEVER store tokens, refresh tokens, or any secret in web storage. This stores
    // non-secret configuration only; the SDK keeps all auth tokens in memory.
    sessionStorage.setItem('sdkConfig', JSON.stringify(config));
    initSdk(config);
  };

  /**
   * Handle sign out from the application
   */
  const handleSignOut = () => {
    logger.info('Logout requested');
    void SdkManager.destroy()
      .then(() => logger.info('SDK destroy completed'))
      .catch((error: unknown) => logger.error('SDK destroy failed', getErrorDetails(error)));
    // Clear stored config and auth state
    sessionStorage.removeItem('sdkConfig');
    setUser(null);
    setAuthenticated(false);
    setError(null);
  };

  // Show loading state during SDK initialization (OAuth redirect or session restoration)
  if (isInitializing && !authenticated && !error) {
    return (
      <main className="flex justify-center items-center min-h-screen w-full p-5">
        <div 
          className="text-center text-base text-gray-500"
          role="status"
          aria-live="polite"
        >
          {strings.common.authenticating}
        </div>
      </main>
    );
  }

  // Show Agent screen when authenticated
  if (authenticated && user) {
    return <Agent user={user} onSignOut={handleSignOut} />;
  }

  // Show Settings screen for configuration
  return <Settings onSubmit={handleSettingsSubmit} error={error} />;
}

export default App;
