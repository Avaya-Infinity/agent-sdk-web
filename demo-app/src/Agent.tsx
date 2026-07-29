import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import type { User } from '@avaya/infinity-agent-sdk';
import { createAppRouter } from './router';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';

interface AgentProps {
  user: User;
  onSignOut?: () => void;
}

/**
 * Agent Component
 * 
 * Main agent interface with routing support.
 * Creates and provides the application router with authenticated user context.
 */
function Agent({ user, onSignOut }: Readonly<AgentProps>) {
  // Create router with user context - memoized to prevent recreation on each render
  const router = useMemo(
    () => createAppRouter(user, onSignOut),
    [user, onSignOut]
  );

  return (
    <NotificationProvider>
      <RouterProvider router={router} />
    </NotificationProvider>
  );
}

export default Agent;
